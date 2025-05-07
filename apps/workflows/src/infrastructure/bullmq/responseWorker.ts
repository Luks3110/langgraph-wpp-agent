import { ConnectionOptions, Job, Worker } from 'bullmq';
import { getWhatsAppClient } from '../clients/whatsapp.js';
import { RedisConnection } from '../database/redis.js';
import { MonitoringService } from '../monitoring/monitoring.js';

/**
 * Options for response worker
 */
export interface ResponseWorkerOptions {
    connection: ConnectionOptions;
    queueName: string;
    concurrency?: number;
    maxRetries?: number;
}

/**
 * BullMQ worker for processing response messages
 */
export class ResponseWorker {
    private worker: Worker;
    private monitoringService: MonitoringService;

    constructor(
        private options: ResponseWorkerOptions,
        redisConnection: RedisConnection
    ) {
        this.monitoringService = MonitoringService.getInstance();

        // Create worker for processing response messages
        this.worker = new Worker(
            options.queueName,
            this.processResponseJob.bind(this),
            {
                connection: options.connection,
                concurrency: options.concurrency || 10
            }
        );

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Process a response job
     */
    private async processResponseJob(job: Job): Promise<any> {
        const startTime = Date.now();
        const responseData = job.data;

        try {
            // Channel type determines where to send the response
            const channelType = responseData.metadata?.channelType || 'whatsapp';
            console.log(`Processing response for ${channelType} channel, recipient: ${responseData.recipientId}`);

            // Track start of processing
            this.monitoringService.trackApiRequest(
                'response_processing',
                channelType,
                202, // Accepted
                0
            );

            // Send response based on channel type
            switch (channelType.toLowerCase()) {
                case 'whatsapp':
                    await this.sendWhatsAppResponse(responseData);
                    break;

                // Add more channel types as needed
                // case 'telegram':
                //     await this.sendTelegramResponse(responseData);
                //     break;

                default:
                    console.warn(`Unknown channel type: ${channelType}`);
                    break;
            }

            // Track successful processing
            const processingTime = Date.now() - startTime;
            this.monitoringService.trackApiRequest(
                'response_processing',
                channelType,
                200, // Success
                processingTime
            );

            return {
                success: true,
                channelType,
                processingTime
            };
        } catch (error) {
            // Log error
            console.error(`Error processing response job ${job.id}:`, error);

            // Track error in monitoring
            this.monitoringService.trackApiRequest(
                'response_processing',
                responseData.metadata?.channelType || 'unknown',
                500, // Error
                Date.now() - startTime
            );

            // Rethrow to handle retries via BullMQ
            throw error;
        }
    }

    /**
     * Send response to WhatsApp
     */
    private async sendWhatsAppResponse(responseData: any): Promise<string> {
        try {
            // Get WhatsApp client
            const whatsappClient = getWhatsAppClient();

            // Validate required fields
            if (!responseData.recipientId) {
                throw new Error('Missing required field: recipientId');
            }
            if (!responseData.message) {
                throw new Error('Missing required field: message');
            }

            // Send message
            const messageId = await whatsappClient.sendMessage(
                responseData.recipientId,
                responseData.message
            );

            console.log(`WhatsApp message sent to ${responseData.recipientId}, messageId: ${messageId}`);
            return messageId;
        } catch (error) {
            console.error('Error sending WhatsApp response:', error);
            throw error;
        }
    }

    /**
     * Set up event handlers for the worker
     */
    private setupEventHandlers(): void {
        // Handle completed jobs
        this.worker.on('completed', (job: Job, result: any) => {
            console.log(`Response job ${job.id} completed for ${result.channelType} channel`);
        });

        // Handle failed jobs
        this.worker.on('failed', (job: Job | undefined, error: Error) => {
            console.error(`Response job ${job?.id} failed:`, error);
        });

        // Handle worker errors
        this.worker.on('error', (error: Error) => {
            console.error('Response worker error:', error);
        });
    }

    /**
     * Close the worker
     */
    async close(): Promise<void> {
        await this.worker.close();
    }
} 
