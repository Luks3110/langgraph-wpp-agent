import { ConnectionOptions, Job, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowExecutionEngine } from '../../domain/execution/executionEngine.js';
import { WorkflowCommandService } from '../../services/command/workflowCommandService.js';
import { RedisConnection } from '../database/redis.js';
import { SupabaseConnection } from '../database/supabase.js';
import { MonitoringService } from '../monitoring/monitoring.js';
import { JobQueue } from './jobQueue.js';

/**
 * Options for scheduler worker
 */
export interface SchedulerWorkerOptions {
    connection: ConnectionOptions;
    queueName: string;
    schedulerQueueName?: string;
    concurrency?: number;
    maxRetries?: number;
    cronCheckInterval?: number; // in milliseconds
}

/**
 * BullMQ worker for processing scheduled events
 */
export class SchedulerWorker {
    private worker: Worker;
    private monitoringService: MonitoringService;
    private workflowCommandService: WorkflowCommandService;
    private workflowExecutionEngine: WorkflowExecutionEngine;
    private supabaseConnection: SupabaseConnection;
    private jobQueue: JobQueue;
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(
        private options: SchedulerWorkerOptions,
        redisConnection: RedisConnection,
        supabaseConnection: SupabaseConnection,
        workflowCommandService: WorkflowCommandService,
        workflowExecutionEngine: WorkflowExecutionEngine,
        jobQueue: JobQueue
    ) {
        this.monitoringService = MonitoringService.getInstance();
        this.supabaseConnection = supabaseConnection;
        this.workflowCommandService = workflowCommandService;
        this.workflowExecutionEngine = workflowExecutionEngine;
        this.jobQueue = jobQueue;

        // Create worker for processing scheduled events
        this.worker = new Worker(
            options.queueName,
            this.processScheduledEventJob.bind(this),
            {
                connection: options.connection,
                concurrency: options.concurrency || 5
            }
        );

        // Setup event handlers
        this.setupEventHandlers();

        // Start cron check if interval specified
        if (options.cronCheckInterval) {
            this.startCronCheck(options.cronCheckInterval);
        }
    }

    /**
     * Start the scheduler to periodically check for due scheduled events
     */
    private startCronCheck(interval: number): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(async () => {
            try {
                await this.checkForDueEvents();
            } catch (error) {
                console.error('Error checking for due scheduled events:', error);
            }
        }, interval);

        console.log(`Scheduler started, checking for events every ${interval}ms`);
    }

    /**
     * Check for scheduled events that are due to run
     */
    private async checkForDueEvents(): Promise<void> {
        try {
            const now = new Date().toISOString();

            // Find scheduled events that are due
            const { data: dueEvents, error } = await this.supabaseConnection.getClient()
                .from('scheduled_events')
                .select('*')
                .eq('status', 'active')
                .lte('nextRun', now);

            if (error) {
                throw new Error(`Error retrieving due scheduled events: ${error.message}`);
            }

            if (!dueEvents || dueEvents.length === 0) {
                return;
            }

            console.log(`Found ${dueEvents.length} scheduled events to process`);

            // Queue each due event for processing
            for (const event of dueEvents) {
                await this.jobQueue.addJob(this.options.queueName, {
                    eventId: event.id,
                    workflowId: event.workflowid,
                    nodeId: event.nodeid,
                    clientId: event.clientid,
                    data: event.data,
                    schedule: event.schedule,
                    metadata: event.metadata
                }, {
                    attempts: this.options.maxRetries || 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000
                    }
                });

                // Update the lastRun timestamp to prevent duplicate processing
                await this.supabaseConnection.getClient()
                    .from('scheduled_events')
                    .update({
                        lastrun: now,
                        updatedat: now
                    })
                    .eq('id', event.id);
            }
        } catch (error) {
            console.error('Error checking for due events:', error);
            this.monitoringService.trackApiRequest(
                'scheduled_events_check',
                'cron',
                500,
                0
            );
        }
    }

    /**
     * Process a scheduled event job
     */
    private async processScheduledEventJob(job: Job): Promise<any> {
        const startTime = Date.now();
        const eventData = job.data;

        try {
            this.monitoringService.trackApiRequest(
                'scheduled_event_processing',
                'cron',
                202, // Accepted
                0
            );

            // Create execution context
            const executionId = uuidv4();
            const metadata = {
                source: 'scheduler',
                sourceType: 'cron',
                actionType: 'scheduled',
                customerId: eventData.clientId,
                clientId: eventData.clientId,
                workflowId: eventData.workflowId,
                receivedAt: new Date().toISOString()
            };

            // Add custom metadata from the event
            if (eventData.metadata) {
                Object.assign(metadata, eventData.metadata);
            }

            // Log the scheduled event processing
            console.log(`Processing scheduled event ${eventData.eventId} for workflow ${eventData.workflowId}, node ${eventData.nodeId}`);

            // Trigger the workflow node
            await this.workflowCommandService.triggerWorkflowNode(
                eventData.nodeId,
                eventData.data,
                metadata
            );

            // Get the workflow definition
            const workflow = await this.getWorkflowDefinition(eventData.workflowId);

            if (workflow) {
                // Get the next nodes based on the workflow edges
                const nextNodes = this.getNextNodesFromWorkflow(workflow, eventData.nodeId);

                // Schedule next nodes for execution if available
                if (nextNodes && nextNodes.length > 0) {
                    for (const nextNode of nextNodes) {
                        // Determine the appropriate queue based on node type
                        const nodeType = this.getNodeType(nextNode);
                        const queueName = this.getQueueNameForNodeType(nodeType);

                        console.log(`Scheduling next node ${nextNode.id} (type: ${nodeType}) in workflow ${eventData.workflowId} to queue ${queueName}`);

                        // Queue the next node execution to its specific queue
                        await this.jobQueue.addJob(queueName, {
                            nodeId: nextNode.id,
                            nodeType: nodeType,
                            workflowId: eventData.workflowId,
                            executionId: executionId,
                            input: eventData.data,
                            metadata: metadata
                        }, {
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 5000
                            },
                            workflowId: eventData.workflowId,
                            tenantId: eventData.clientId,
                            eventType: `${nodeType}.execution`
                        });
                    }
                }
            }

            // Calculate the next run time based on cron expression
            // In a real implementation, this would use a cron parser library
            const nextRun = this.calculateNextRunTime(eventData.schedule);
            if (nextRun) {
                // Update the scheduled event with the new next run time
                await this.supabaseConnection.getClient()
                    .from('scheduled_events')
                    .update({
                        lastrun: new Date().toISOString(),
                        nextrun: nextRun,
                        updatedat: new Date().toISOString()
                    })
                    .eq('id', eventData.eventId);
            }

            // Log processing time metrics
            const processingTime = Date.now() - startTime;
            this.monitoringService.trackApiRequest(
                'scheduled_event_processing',
                'cron',
                200, // Success
                processingTime
            );

            return {
                success: true,
                executionId
            };
        } catch (error) {
            // Log error
            console.error(`Error processing scheduled event ${eventData.eventId}:`, error);

            // Track error in monitoring
            this.monitoringService.trackApiRequest(
                'scheduled_event_processing',
                'cron',
                500, // Error
                Date.now() - startTime
            );

            // Rethrow to handle retries via BullMQ
            throw error;
        }
    }

    /**
     * Calculate the next run time based on the schedule
     */
    private calculateNextRunTime(schedule: any): string | null {
        if (!schedule || !schedule.frequency) {
            return null;
        }

        // In a real implementation, use a cron parser library
        // For this example, just add one day
        const nextRun = new Date();
        nextRun.setDate(nextRun.getDate() + 1);
        return nextRun.toISOString();
    }

    /**
     * Set up event handlers for the worker
     */
    private setupEventHandlers(): void {
        // Handle completed jobs
        this.worker.on('completed', (job: Job, result: any) => {
            console.log(`Scheduled event job ${job.id} completed:`, result);
        });

        // Handle failed jobs
        this.worker.on('failed', (job: Job | undefined, error: Error) => {
            console.error(`Scheduled event job ${job?.id} failed:`, error);
        });

        // Handle worker errors
        this.worker.on('error', (error: Error) => {
            console.error('Scheduler worker error:', error);
        });
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

        // Look up the queue name from the mapping, or use the default
        return NODE_TYPE_QUEUE_MAP[nodeType.toLowerCase()] || NODE_TYPE_QUEUE_MAP.default;
    }

    /**
     * Close the worker and cleanup resources
     */
    async close(): Promise<void> {
        // Stop the cron check interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        // Close the worker
        await this.worker.close();
    }
} 
