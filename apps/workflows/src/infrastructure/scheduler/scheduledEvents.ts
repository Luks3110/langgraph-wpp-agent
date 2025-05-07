import { v4 as uuidv4 } from 'uuid';
import { TriggerMetadata } from '../../domain/commands/index.js';
import { WorkflowExecutionEngine } from '../../domain/execution/executionEngine.js';
import { WorkflowCommandService } from '../../services/command/workflowCommandService.js';
import { JobQueue } from '../bullmq/jobQueue.js';
import { SupabaseConnection } from '../database/supabase.js';

/**
 * Map of node types to their corresponding queue names
 */
const NODE_TYPE_QUEUE_MAP: Record<string, string> = {
    'agent': 'agent-execution',
    'message': 'message-processing',
    'api': 'api-request',
    'decision': 'decision-processing',
    'transform': 'data-transformation',
    'delay': 'scheduled-delay',
    'email': 'email-sending',
    'webhook': 'webhook-trigger',
    // Add more mappings as needed
    'default': 'workflow-node-execution' // Fallback queue
};

/**
 * Interface for scheduled events
 */
export interface ScheduledEvent {
    id?: string;
    workflowId: string;
    nodeId: string;
    clientId: string;
    data: any;
    schedule?: {
        frequency: string; // cron expression like "* * * * *"
        startTime?: string; // ISO date string
        endTime?: string; // ISO date string
        timezone?: string; // Timezone for the cron expression, e.g., "America/New_York"
    };
    lastRun?: string; // ISO date string
    nextRun?: string; // ISO date string
    status?: 'active' | 'paused' | 'completed';
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Service for managing scheduled events
 */
export class ScheduledEventService {
    constructor(
        private workflowCommandService: WorkflowCommandService,
        private workflowExecutionEngine: WorkflowExecutionEngine,
        private jobQueue: JobQueue,
        private supabaseConnection: SupabaseConnection
    ) { }

    /**
     * Handle a scheduled event (e.g., from a cron job)
     */
    async handleScheduledEvent(event: ScheduledEvent): Promise<string> {
        // Create execution context
        const executionId = uuidv4();
        const metadata: TriggerMetadata = {
            source: 'scheduler',
            sourceType: 'cron',
            actionType: 'scheduled',
            customerId: event.clientId,
            clientId: event.clientId,
            receivedAt: new Date().toISOString()
        };

        // Add custom metadata from the event
        if (event.metadata) {
            Object.entries(event.metadata).forEach(([key, value]) => {
                (metadata as any)[key] = value;
            });
        }

        // Trigger initial node
        await this.workflowCommandService.triggerWorkflowNode(event.nodeId, event.data, metadata);

        // Get the workflow definition to find and queue the next nodes
        const workflow = await this.getWorkflowDefinition(event.workflowId);

        if (workflow) {
            // Get the next nodes based on the workflow edges
            const nextNodes = this.getNextNodesFromWorkflow(workflow, event.nodeId);

            // Schedule next nodes for execution if available
            if (nextNodes && nextNodes.length > 0) {
                for (const nextNode of nextNodes) {
                    // Determine the appropriate queue based on node type
                    const nodeType = this.getNodeType(nextNode);
                    const queueName = this.getQueueNameForNodeType(nodeType);

                    console.log(`Scheduling next node ${nextNode.id} (type: ${nodeType}) in workflow ${event.workflowId} to queue ${queueName}`);

                    // Queue the next node execution to its specific queue
                    await this.jobQueue.addJob(queueName, {
                        nodeId: nextNode.id,
                        nodeType: nodeType,
                        workflowId: event.workflowId,
                        executionId: executionId,
                        input: event.data,
                        metadata: metadata
                    }, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000
                        },
                        workflowId: event.workflowId,
                        tenantId: event.clientId,
                        eventType: `${nodeType}.execution`
                    });
                }
            }
        }

        // Update the last run time
        await this.updateScheduledEventLastRun(event.id || uuidv4(), new Date().toISOString());

        return executionId;
    }

    /**
     * Create or update a scheduled event
     */
    async createOrUpdateScheduledEvent(event: ScheduledEvent): Promise<ScheduledEvent> {
        const now = new Date().toISOString();
        const id = event.id || uuidv4();

        const scheduledEvent: ScheduledEvent = {
            ...event,
            id,
            status: event.status || 'active',
            createdAt: event.createdAt || now,
            updatedAt: now
        };

        // Calculate next run time if not provided
        if (scheduledEvent.schedule && scheduledEvent.schedule.frequency && !scheduledEvent.nextRun) {
            // In a real implementation, calculate the next run based on the cron expression
            // This is a simple placeholder
            scheduledEvent.nextRun = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
        }

        // Convert to database format (lowercase property names)
        const dbEvent = {
            id: scheduledEvent.id!, // Use non-null assertion as we've set id above
            workflowid: scheduledEvent.workflowId,
            nodeid: scheduledEvent.nodeId,
            clientid: scheduledEvent.clientId,
            data: scheduledEvent.data,
            schedule: scheduledEvent.schedule,
            status: scheduledEvent.status,
            metadata: scheduledEvent.metadata,
            lastrun: scheduledEvent.lastRun,
            nextrun: scheduledEvent.nextRun,
            createdat: scheduledEvent.createdAt,
            updatedat: scheduledEvent.updatedAt
        };

        // Save to database
        await this.supabaseConnection.getClient()
            .from('scheduled_events')
            .upsert(dbEvent);

        return scheduledEvent;
    }

    /**
     * Get all scheduled events for a client
     */
    async getScheduledEvents(clientId: string, status?: 'active' | 'paused' | 'completed'): Promise<ScheduledEvent[]> {
        let query = this.supabaseConnection.getClient()
            .from('scheduled_events')
            .select('*')
            .eq('clientid', clientId);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error retrieving scheduled events: ${error.message}`);
        }

        // Convert database format to application format
        return (data || []).map(item => ({
            id: item.id,
            workflowId: item.workflowid,
            nodeId: item.nodeid,
            clientId: item.clientid,
            data: item.data,
            schedule: item.schedule,
            status: item.status,
            metadata: item.metadata,
            lastRun: item.lastrun,
            nextRun: item.nextrun,
            createdAt: item.createdat,
            updatedAt: item.updatedat
        } as ScheduledEvent));
    }

    /**
     * Get due scheduled events (events that should be triggered now)
     */
    async getDueEvents(): Promise<ScheduledEvent[]> {
        const now = new Date().toISOString();

        const { data, error } = await this.supabaseConnection.getClient()
            .from('scheduled_events')
            .select('*')
            .eq('status', 'active')
            .lte('nextrun', now);

        if (error) {
            throw new Error(`Error retrieving due scheduled events: ${error.message}`);
        }

        // Convert database format to application format
        return (data || []).map(item => ({
            id: item.id,
            workflowId: item.workflowid,
            nodeId: item.nodeid,
            clientId: item.clientid,
            data: item.data,
            schedule: item.schedule,
            status: item.status,
            metadata: item.metadata,
            lastRun: item.lastrun,
            nextRun: item.nextrun,
            createdAt: item.createdat,
            updatedAt: item.updatedat
        } as ScheduledEvent));
    }

    /**
     * Update the last run time for a scheduled event
     */
    private async updateScheduledEventLastRun(id: string, lastRun: string): Promise<void> {
        try {
            // Calculate next run time based on frequency
            // This is a simple placeholder
            const nextRun = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

            await this.supabaseConnection.getClient()
                .from('scheduled_events')
                .update({
                    lastrun: lastRun,
                    nextrun: nextRun,
                    updatedat: new Date().toISOString()
                })
                .eq('id', id);
        } catch (error) {
            console.error(`Error updating scheduled event ${id} last run:`, error);
        }
    }

    /**
     * Get the workflow definition from the database
     */
    private async getWorkflowDefinition(workflowId: string): Promise<any> {
        try {
            const { data, error } = await this.supabaseConnection.getClient()
                .from('workflows')
                .select('*')
                .eq('id', workflowId)
                .single();

            if (error) {
                throw new Error(`Error retrieving workflow: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error(`Error retrieving workflow ${workflowId}:`, error);
            return null;
        }
    }

    /**
     * Get the next nodes to execute in the workflow based on the current node
     */
    private getNextNodesFromWorkflow(workflow: any, currentNodeId: string): any[] {
        try {
            if (!workflow || !workflow.nodes || !workflow.edges) {
                return [];
            }

            // Parse nodes and edges if they're strings
            const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes;
            const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges;

            // Find edges that have the current node as the source
            const outgoingEdges = edges.filter((edge: any) => edge.source === currentNodeId || edge.sourceId === currentNodeId);

            if (!outgoingEdges || outgoingEdges.length === 0) {
                return [];
            }

            // Get the target node IDs
            const targetNodeIds = outgoingEdges.map((edge: any) => edge.target || edge.targetId);

            // Find the corresponding nodes
            const nextNodes = targetNodeIds
                .map((nodeId: string) => {
                    const node = nodes.find((n: any) => n.id === nodeId);
                    return node || null;
                })
                .filter((node: any) => node !== null);

            return nextNodes;
        } catch (error) {
            console.error(`Error extracting next nodes from workflow:`, error);
            return [];
        }
    }

    /**
     * Extract the node type from the node data
     */
    private getNodeType(node: any): string {
        if (!node) return 'unknown';

        // Different schemas might store type in different properties
        return node.type ||
            node.nodeType ||
            (node.data && node.data.type) ||
            (node.properties && node.properties.type) ||
            'unknown';
    }

    /**
     * Get the appropriate queue name for a node type
     */
    private getQueueNameForNodeType(nodeType: string): string {
        // Look up the queue name from the mapping, or use the default
        return NODE_TYPE_QUEUE_MAP[nodeType.toLowerCase()] || NODE_TYPE_QUEUE_MAP.default;
    }
} 
