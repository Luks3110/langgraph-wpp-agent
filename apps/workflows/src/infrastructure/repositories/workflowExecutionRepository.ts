import { SupabaseConnection } from '../database/supabase.js';
import { Database } from '../database/supabase.types.js';

export type WorkflowExecution = Database['public']['Tables']['workflow_executions']['Row'];
export type WorkflowExecutionInsert = Database['public']['Tables']['workflow_executions']['Insert'];
export type WorkflowExecutionUpdate = Database['public']['Tables']['workflow_executions']['Update'];

export type NodeExecution = Database['public']['Tables']['node_executions']['Row'];
export type NodeExecutionInsert = Database['public']['Tables']['node_executions']['Insert'];
export type NodeExecutionUpdate = Database['public']['Tables']['node_executions']['Update'];

export interface WorkflowExecutionRepository {
    createExecution(execution: WorkflowExecutionInsert): Promise<WorkflowExecution>;
    getExecution(executionId: string): Promise<WorkflowExecution | null>;
    updateExecution(executionId: string, updates: WorkflowExecutionUpdate): Promise<WorkflowExecution>;
    listExecutions(workflowId?: string, tenantId?: string): Promise<WorkflowExecution[]>;
    
    // Node execution methods
    createNodeExecution(nodeExecution: NodeExecutionInsert): Promise<NodeExecution>;
    getNodeExecution(nodeExecutionId: string): Promise<NodeExecution | null>;
    updateNodeExecution(nodeExecutionId: string, updates: NodeExecutionUpdate): Promise<NodeExecution>;
    listNodeExecutions(workflowExecutionId: string): Promise<NodeExecution[]>;
    getNodeExecutionByWorkflowAndNode(workflowExecutionId: string, nodeId: string): Promise<NodeExecution | null>;
}

export class SupabaseWorkflowExecutionRepository implements WorkflowExecutionRepository {
    constructor(private supabase: SupabaseConnection) {}

    /**
     * Create a new workflow execution
     */
    async createExecution(execution: WorkflowExecutionInsert): Promise<WorkflowExecution> {
        const { data, error } = await this.supabase
            .getClient()
            .from('workflow_executions')
            .insert(execution)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create workflow execution: ${error.message}`);
        }

        return data;
    }

    /**
     * Get a workflow execution by ID
     */
    async getExecution(executionId: string): Promise<WorkflowExecution | null> {
        const { data, error } = await this.supabase
            .getClient()
            .from('workflow_executions')
            .select('*')
            .eq('id', executionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get workflow execution: ${error.message}`);
        }

        return data;
    }

    /**
     * Update a workflow execution
     */
    async updateExecution(executionId: string, updates: WorkflowExecutionUpdate): Promise<WorkflowExecution> {
        const { data, error } = await this.supabase
            .getClient()
            .from('workflow_executions')
            .update(updates)
            .eq('id', executionId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update workflow execution: ${error.message}`);
        }

        return data;
    }

    /**
     * List workflow executions
     */
    async listExecutions(workflowId?: string, tenantId?: string): Promise<WorkflowExecution[]> {
        let query = this.supabase
            .getClient()
            .from('workflow_executions')
            .select('*');

        if (workflowId) {
            query = query.eq('workflow_id', workflowId);
        }

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to list workflow executions: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Create a new node execution
     */
    async createNodeExecution(nodeExecution: NodeExecutionInsert): Promise<NodeExecution> {
        const { data, error } = await this.supabase
            .getClient()
            .from('node_executions')
            .insert(nodeExecution)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create node execution: ${error.message}`);
        }

        return data;
    }

    /**
     * Get a node execution by ID
     */
    async getNodeExecution(nodeExecutionId: string): Promise<NodeExecution | null> {
        const { data, error } = await this.supabase
            .getClient()
            .from('node_executions')
            .select('*')
            .eq('id', nodeExecutionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get node execution: ${error.message}`);
        }

        return data;
    }

    /**
     * Update a node execution
     */
    async updateNodeExecution(nodeExecutionId: string, updates: NodeExecutionUpdate): Promise<NodeExecution> {
        const { data, error } = await this.supabase
            .getClient()
            .from('node_executions')
            .update(updates)
            .eq('id', nodeExecutionId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update node execution: ${error.message}`);
        }

        return data;
    }

    /**
     * List node executions for a workflow execution
     */
    async listNodeExecutions(workflowExecutionId: string): Promise<NodeExecution[]> {
        const { data, error } = await this.supabase
            .getClient()
            .from('node_executions')
            .select('*')
            .eq('workflow_execution_id', workflowExecutionId)
            .order('created_at', { ascending: true });

        if (error) {
            throw new Error(`Failed to list node executions: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get a node execution by workflow execution and node ID
     */
    async getNodeExecutionByWorkflowAndNode(workflowExecutionId: string, nodeId: string): Promise<NodeExecution | null> {
        const { data, error } = await this.supabase
            .getClient()
            .from('node_executions')
            .select('*')
            .eq('workflow_execution_id', workflowExecutionId)
            .eq('node_id', nodeId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get node execution: ${error.message}`);
        }

        return data;
    }
}