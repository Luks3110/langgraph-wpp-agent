import { ConnectionOptions, Job, Worker } from 'bullmq';
import { TriggerMetadata } from '../../domain/commands/index.js';
import { NormalizedWebhookPayload } from '../../domain/webhooks/providerAdapters.js';
import { WhatsAppWebhookAdapter } from '../../domain/webhooks/providers/whatsappAdapter.js';
import { WorkflowCommandService } from '../../services/command/workflowCommandService.js';
import { RedisConnection } from '../database/redis.js';
import { SupabaseConnection } from '../database/supabase.js';
import { MonitoringService } from '../monitoring/monitoring.js';
import { WebhookRepository } from '../repositories/webhookRepository.js';
import { JobQueue } from './jobQueue.js';

/**
 * Options for webhook worker
 */
export interface WebhookWorkerOptions {
    connection: ConnectionOptions;
    queueName: string;
    webhookQueueName?: string;
    concurrency?: number;
    maxRetries?: number;
}

/**
 * BullMQ worker for processing webhook events
 */
export class WebhookWorker {
    private worker: Worker;
    private monitoringService: MonitoringService;
    private webhookRepository: WebhookRepository;
    private whatsappAdapter: WhatsAppWebhookAdapter;
    private supabaseConnection: SupabaseConnection;
    private workflowCommandService: WorkflowCommandService;
    private jobQueue: JobQueue;

    constructor(
        private options: WebhookWorkerOptions,
        redisConnection: RedisConnection,
        supabaseConnection: SupabaseConnection,
        workflowCommandService: WorkflowCommandService,
        jobQueue: JobQueue
    ) {
        this.monitoringService = MonitoringService.getInstance();
        this.supabaseConnection = supabaseConnection;
        this.webhookRepository = new WebhookRepository(supabaseConnection);
        this.whatsappAdapter = new WhatsAppWebhookAdapter();
        this.workflowCommandService = workflowCommandService;
        this.jobQueue = jobQueue;

        // Set the job queue for WhatsApp adapter for direct message queuing
        this.whatsappAdapter.setJobQueue(this.jobQueue);

        // Create worker for processing webhook events
        this.worker = new Worker(
            options.queueName,
            this.processWebhookJob.bind(this),
            {
                connection: options.connection,
                concurrency: options.concurrency || 5
            }
        );

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Process a webhook job
     */
    private async processWebhookJob(job: Job): Promise<any> {
        const startTime = Date.now();
        const webhookData = job.data;

        try {
            this.monitoringService.trackApiRequest(
                'webhook_processing',
                webhookData.provider || 'unknown',
                202, // Accepted
                0
            );

            // Get webhook record from database to know which workflow node to trigger
            const webhook = await this.getWebhookDetails(webhookData.webhookId);

            if (!webhook) {
                throw new Error(`Webhook not found: ${webhookData.webhookId}`);
            }

            // Extract normalized payload from the job data
            const normalizedPayload = webhookData.normalizedPayload as NormalizedWebhookPayload;

            // Create trigger metadata
            const metadata: TriggerMetadata = {
                source: 'webhook',
                sourceType: normalizedPayload.provider.toLowerCase(),
                actionType: normalizedPayload.eventType,
                customerId: normalizedPayload.customerId,
                clientId: webhookData.clientId,
                receivedAt: new Date().toISOString()
            };

            // Log the webhook processing
            console.log(`Processing webhook ${webhookData.webhookId} for workflow node ${webhook.node_id}`);

            // Trigger the workflow node
            const executionId = await this.workflowCommandService.triggerWorkflowNode(
                webhook.node_id,
                normalizedPayload.data,
                metadata
            );

            // Update webhook last triggered timestamp
            await this.updateWebhookLastTriggeredAt(webhookData.webhookId);

            // Log processing time metrics
            const processingTime = Date.now() - startTime;
            this.monitoringService.trackApiRequest(
                'webhook_processing',
                webhookData.provider || 'unknown',
                200, // Success
                processingTime
            );

            return {
                success: true,
                executionId
            };
        } catch (error) {
            // Log error
            console.error(`Error processing webhook ${webhookData.webhookId}:`, error);

            // Track error in monitoring
            this.monitoringService.trackApiRequest(
                'webhook_processing',
                webhookData.provider || 'unknown',
                500, // Error
                Date.now() - startTime
            );

            // Rethrow to handle retries via BullMQ
            throw error;
        }
    }

    /**
     * Set up event handlers for the worker
     */
    private setupEventHandlers(): void {
        // Handle completed jobs
        this.worker.on('completed', (job: Job, result: any) => {
            console.log(`Webhook job ${job.id} completed:`, result);
        });

        // Handle failed jobs
        this.worker.on('failed', (job: Job | undefined, error: Error) => {
            console.error(`Webhook job ${job?.id} failed:`, error);

            // Add to monitoring
            this.monitoringService.trackError(
                'webhook_processing_failed',
                error,
                {
                    jobId: job?.id,
                    webhookId: job?.data?.webhookId,
                    provider: job?.data?.provider
                }
            );
        });

        // Handle worker errors
        this.worker.on('error', (error: Error) => {
            console.error('Webhook worker error:', error);

            // Add to monitoring
            this.monitoringService.trackError('webhook_worker_error', error, {});
        });
    }

    /**
     * Get webhook details from the database
     */
    private async getWebhookDetails(webhookId: string): Promise<any> {
        try {
            const { data, error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .select('*')
                .eq('id', webhookId)
                .single();

            if (error) {
                throw new Error(`Error retrieving webhook: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error(`Error retrieving webhook ${webhookId}:`, error);
            return null;
        }
    }

    /**
     * Update the webhook's last triggered timestamp
     */
    private async updateWebhookLastTriggeredAt(webhookId: string): Promise<void> {
        try {
            await this.supabaseConnection.getClient()
                .from('webhooks')
                .update({
                    last_triggered_at: new Date().toISOString()
                })
                .eq('id', webhookId);
        } catch (error) {
            console.error(`Error updating webhook ${webhookId} last triggered timestamp:`, error);
            // Don't throw here, it's not critical
        }
    }

    /**
     * Close the worker
     */
    async close(): Promise<void> {
        await this.worker.close();
    }
} 
