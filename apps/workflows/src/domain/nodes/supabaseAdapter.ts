import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../infrastructure/database/supabase.types.js';
import { WorkflowContext, WorkflowState } from '../execution/models.js';

/**
 * Repository for workflow executions in Supabase
 */
export class WorkflowRepository {
    private client: SupabaseClient<Database>;

    constructor(client: SupabaseClient<Database>) {
        this.client = client;
    }

    /**
     * Get a workflow by ID
     */
    async getWorkflow(workflowId: string) {
        const { data, error } = await this.client
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .single();

        if (error) {
            throw new Error(`Error retrieving workflow: ${error.message}`);
        }

        return data;
    }

    /**
     * Get workflows by tenant ID
     */
    async getWorkflowsByTenant(tenantId: string, status?: string) {
        let query = this.client
            .from('workflows')
            .select('*')
            .eq('tenant_id', tenantId);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error retrieving workflows: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Store a workflow execution
     */
    async storeExecution(context: WorkflowContext): Promise<void> {
        // First check if execution exists
        const { data: existing } = await this.client
            .from('workflow_executions')
            .select('id')
            .eq('id', context.id)
            .maybeSingle();

        if (existing) {
            // Update existing execution
            await this.updateExecution(context);
            return;
        }

        // Create new execution record
        const { error } = await this.client
            .from('workflow_executions')
            .insert({
                id: context.id,
                workflow_id: context.workflowId,
                tenant_id: context.tenantId,
                state: context.state,
                metadata: context.metadata,
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error) {
            throw new Error(`Error creating workflow execution: ${error.message}`);
        }
    }

    /**
     * Update a workflow execution
     */
    async updateExecution(context: WorkflowContext): Promise<void> {
        const updateData: any = {
            state: context.state,
            metadata: context.metadata,
            updated_at: new Date().toISOString()
        };

        // Add result or error if execution is complete
        if (context.state === WorkflowState.COMPLETED && context.result) {
            updateData.result = context.result;
            updateData.completed_at = new Date().toISOString();
        } else if (
            (context.state === WorkflowState.FAILED || context.state === WorkflowState.CANCELED) &&
            context.error
        ) {
            updateData.error = context.error instanceof Error ? context.error.message : String(context.error);
            updateData.completed_at = new Date().toISOString();
        }

        const { error } = await this.client
            .from('workflow_executions')
            .update(updateData)
            .eq('id', context.id);

        if (error) {
            throw new Error(`Error updating workflow execution: ${error.message}`);
        }
    }

    /**
     * Store a node execution
     */
    async storeNodeExecution(
        executionId: string,
        nodeId: string,
        state: string,
        input?: any,
        output?: any,
        error?: Error | string
    ): Promise<string> {
        const id = uuidv4();

        const { error: storeError } = await this.client
            .from('node_executions')
            .insert({
                id,
                workflow_execution_id: executionId,
                node_id: nodeId,
                state,
                input,
                output,
                error: error instanceof Error ? error.message : error,
                started_at: new Date().toISOString()
            });

        if (storeError) {
            throw new Error(`Error creating node execution: ${storeError.message}`);
        }

        return id;
    }

    /**
     * Update a node execution
     */
    async updateNodeExecution(
        nodeExecutionId: string,
        state: string,
        output?: any,
        error?: Error | string
    ): Promise<void> {
        const updateData: any = {
            state,
            updated_at: new Date().toISOString()
        };

        if (output !== undefined) {
            updateData.output = output;
        }

        if (error) {
            updateData.error = error instanceof Error ? error.message : error;
        }

        // Add completion time if node is in a final state
        if (['completed', 'failed', 'skipped'].includes(state)) {
            updateData.completed_at = new Date().toISOString();
        }

        const { error: updateError } = await this.client
            .from('node_executions')
            .update(updateData)
            .eq('id', nodeExecutionId);

        if (updateError) {
            throw new Error(`Error updating node execution: ${updateError.message}`);
        }
    }

    /**
     * Get node executions for a workflow execution
     */
    async getNodeExecutions(executionId: string) {
        const { data, error } = await this.client
            .from('node_executions')
            .select('*')
            .eq('workflow_execution_id', executionId)
            .order('started_at', { ascending: true });

        if (error) {
            throw new Error(`Error retrieving node executions: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Store an event in the event store
     */
    async storeEvent(
        type: string,
        tenantId: string,
        payload: any,
        workflowId?: string,
        jobId?: string
    ): Promise<void> {
        const { error } = await this.client
            .from('event_store')
            .insert({
                id: uuidv4(),
                event_type: type,
                tenant_id: tenantId,
                workflow_id: workflowId,
                job_id: jobId,
                payload,
                sequence_number: Date.now(), // Simple approach for sequence
                timestamp: new Date().toISOString(),
                status: 'created'
            });

        if (error) {
            console.error(`Error storing event: ${error.message}`);
            // Don't throw, just log the error to prevent disrupting execution
        }
    }
} 
