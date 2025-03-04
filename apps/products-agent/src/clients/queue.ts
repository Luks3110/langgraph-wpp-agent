import { AgentRequestMessage, AgentResponseMessage } from '@products-monorepo/shared';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { AGENT_REQUEST_QUEUE, AGENT_RESPONSE_QUEUE } from '../config/env.js';
import { agentController } from '../controllers/agent-controller.js';
import { redisClient } from './redis.js';

/**
 * BullMQ Queue client for the Products Agent service
 */
export class QueueClient {
    private responseQueue: Queue;
    private requestWorker: Worker;
    private responseQueueEvents: QueueEvents | null = null;

    constructor() {
        try {
            console.log('Initializing BullMQ Queue Client...');

            // Initialize agent response queue
            this.responseQueue = new Queue(AGENT_RESPONSE_QUEUE, {
                connection: redisClient
            });
            console.log(`Response queue '${AGENT_RESPONSE_QUEUE}' initialized`);

            // Initialize request worker to process incoming messages
            this.requestWorker = new Worker(
                AGENT_REQUEST_QUEUE,
                this.processAgentRequest,
                {
                    connection: redisClient,
                    autorun: true,
                }
            );
            console.log(`Request worker for queue '${AGENT_REQUEST_QUEUE}' initialized`);

            // Try to initialize queue events (for monitoring)
            try {
                this.responseQueueEvents = new QueueEvents(AGENT_RESPONSE_QUEUE, {
                    connection: redisClient
                });
                console.log('Queue events initialized');

                // Only set up event listeners if queue events initialized successfully
                this.setupEventListeners();
            } catch (eventsError) {
                console.warn('Failed to initialize queue events, monitoring disabled:', eventsError);
                this.responseQueueEvents = null;
            }
        } catch (error) {
            console.error('Error initializing queue client:', error);
            throw error;
        }
    }

    /**
     * Set up queue event listeners
     */
    private setupEventListeners(): void {
        if (!this.responseQueueEvents) {
            console.warn('Queue events not initialized, skipping event listeners setup');
            return;
        }

        // Response queue events
        try {
            // Response queue events
            this.responseQueueEvents.on('completed', ({ jobId }) => {
                console.log(`Response job ${jobId} has been completed`);
            });

            this.responseQueueEvents.on('failed', ({ jobId, failedReason }) => {
                console.error(`Response job ${jobId} has failed with reason: ${failedReason}`);
            });

            // Request worker events
            this.requestWorker.on('completed', (job) => {
                console.log(`Request job ${job.id} completed successfully`);
            });

            this.requestWorker.on('failed', (job, error) => {
                console.error(`Request job ${job?.id} failed:`, error);
            });

            console.log('Queue event listeners setup completed');
        } catch (error) {
            console.error('Error setting up queue event listeners:', error);
        }
    }

    /**
     * Send a response back to the WhatsApp service
     */
    public async sendResponseToWhatsApp(response: AgentResponseMessage): Promise<string | undefined> {
        try {
            const job = await this.responseQueue.add('send-response', response, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: 1000, // Keep failed jobs for 1000 seconds
            });

            console.log(`Response sent to WhatsApp service, job ID: ${job.id}`);
            return job.id;
        } catch (error) {
            console.error('Error sending response to WhatsApp service:', error);
            throw error;
        }
    }

    /**
     * Process incoming agent requests
     */
    private async processAgentRequest(job: any): Promise<void> {
        const agentRequest = job.data as AgentRequestMessage;

        console.log(`Processing agent request from ${agentRequest.from}`);

        try {
            // Call the agent controller to process the message
            await agentController.handleMessageAsync(agentRequest);
            return Promise.resolve();
        } catch (error) {
            console.error('Error processing agent request:', error);
            return Promise.reject(error);
        }
    }

    /**
     * Close all queue connections
     */
    public async close(): Promise<void> {
        await this.responseQueue.close();
        await this.requestWorker.close();
        if (this.responseQueueEvents) {
            await this.responseQueueEvents.close();
        }
    }
}

// Export a singleton instance
export const queueClient = new QueueClient(); 
