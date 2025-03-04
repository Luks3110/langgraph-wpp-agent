import { AgentRequestMessage, AgentResponseMessage } from '@products-monorepo/shared';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { AGENT_REQUEST_QUEUE, AGENT_RESPONSE_QUEUE } from '../config/env.js';
import { webhookController } from '../controllers/webhook-controller.js';
import { redisClient } from './redis.js';

/**
 * BullMQ Queue client for the WhatsApp service
 */
export class QueueClient {
    private requestQueue: Queue;
    private responseWorker: Worker;
    private requestQueueEvents: QueueEvents;

    constructor() {
        // Initialize agent request queue
        this.requestQueue = new Queue(AGENT_REQUEST_QUEUE, {
            connection: redisClient
        });

        // Initialize queue events (for monitoring)
        this.requestQueueEvents = new QueueEvents(AGENT_REQUEST_QUEUE, {
            connection: redisClient
        });

        // Initialize response worker to process agent responses first
        this.responseWorker = new Worker(AGENT_RESPONSE_QUEUE, this.processAgentResponse.bind(this), {
            connection: redisClient,
            autorun: true,
        });

        // Set up event listeners after all components are initialized
        this.setupEventListeners();
    }

    /**
     * Set up queue event listeners
     */
    private setupEventListeners(): void {
        // Request queue events
        this.requestQueueEvents.on('completed', ({ jobId }) => {
            console.log(`Job ${jobId} has been completed`);
        });

        this.requestQueueEvents.on('failed', ({ jobId, failedReason }) => {
            console.error(`Job ${jobId} has failed with reason: ${failedReason}`);
        });

        // Response worker events
        this.responseWorker.on('completed', (job) => {
            console.log(`Response job ${job.id} completed successfully`);
        });

        this.responseWorker.on('failed', (job, error) => {
            console.error(`Response job ${job?.id} failed:`, error);
        });
    }

    /**
     * Send a message to the agent processing queue
     */
    public async sendMessageToAgent(message: AgentRequestMessage): Promise<string | undefined> {
        try {
            const job = await this.requestQueue.add('process-message', message, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: 1000, // Keep failed jobs for 1000 seconds
            });

            console.log(`Message sent to agent queue, job ID: ${job.id}`);
            return job.id;
        } catch (error) {
            console.error('Error sending message to agent queue:', error);
            throw error;
        }
    }

    /**
     * Process agent responses and send back to WhatsApp
     */
    private async processAgentResponse(job: any): Promise<void> {
        const agentResponse = job.data as AgentResponseMessage;

        console.log(`Processing agent response to ${agentResponse.to}`);

        try {
            await webhookController.handleAgentResponse({
                body: agentResponse
            } as any, {
                status: () => ({ json: () => { } })
            } as any);

            return Promise.resolve();
        } catch (error) {
            console.error('Error processing agent response:', error);
            return Promise.reject(error);
        }
    }

    /**
     * Close all queue connections
     */
    public async close(): Promise<void> {
        await this.requestQueue.close();
        await this.responseWorker.close();
        await this.requestQueueEvents.close();
    }
}

// Export a singleton instance
export const queueClient = new QueueClient(); 
