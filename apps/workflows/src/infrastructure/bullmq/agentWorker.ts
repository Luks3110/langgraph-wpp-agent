import { ConnectionOptions, Job, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import {
    LangGraphAgentConfig,
    LangGraphAgentInput,
    executeLangGraphAgent
} from '../../domain/nodes/langGraphAgent.js';
import { RedisConnection } from '../database/redis.js';
import { SupabaseConnection } from '../database/supabase.js';
import { MonitoringService } from '../monitoring/monitoring.js';
import { JobQueue } from './jobQueue.js';

/**
 * Options for agent worker
 */
export interface AgentWorkerOptions {
    connection: ConnectionOptions;
    queueName: string;
    responseQueueName?: string;
    concurrency?: number;
    maxRetries?: number;
}

/**
 * BullMQ worker for processing agent tasks
 */
export class AgentWorker {
    private worker: Worker;
    private monitoringService: MonitoringService;
    private supabaseConnection: SupabaseConnection;
    private jobQueue: JobQueue;

    constructor(
        private options: AgentWorkerOptions,
        redisConnection: RedisConnection,
        supabaseConnection: SupabaseConnection,
        jobQueue: JobQueue
    ) {
        this.monitoringService = MonitoringService.getInstance();
        this.supabaseConnection = supabaseConnection;
        this.jobQueue = jobQueue;

        // Create worker for processing agent tasks
        this.worker = new Worker(
            options.queueName,
            this.processAgentJob.bind(this),
            {
                connection: options.connection,
                concurrency: options.concurrency || 5
            }
        );

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Process an agent job
     */
    private async processAgentJob(job: Job): Promise<any> {
        const startTime = Date.now();
        const jobData = job.data;

        try {
            this.monitoringService.trackApiRequest(
                'agent_processing',
                jobData.provider || 'default',
                202, // Accepted
                0
            );

            console.log(`Processing agent job ${job.id} for conversation ${jobData.conversationId}`);

            // Get agent configuration from job data or database
            const agentConfig = await this.getAgentConfig(jobData);

            // Create agent input from job data
            const agentInput: LangGraphAgentInput = {
                message: jobData.message,
                conversationId: jobData.conversationId,
                history: jobData.history || [],
                context: jobData.context || {}
            };

            // Execute the agent
            const result = await executeLangGraphAgent(
                agentConfig,
                agentInput,
                {
                    jobId: job.id,
                    ...jobData.metadata
                }
            );

            if (!result.success) {
                throw new Error(result.error || 'Unknown error executing agent');
            }

            // Get response queue name from options or use default
            const responseQueueName = this.options.responseQueueName || 'response-queue';

            // Queue response for delivery (e.g., send back to WhatsApp)
            await this.jobQueue.addJob(responseQueueName, {
                responseId: uuidv4(),
                conversationId: jobData.conversationId,
                recipientId: jobData.senderId,
                message: result.output?.response,
                history: result.output?.history,
                metadata: {
                    ...(result.output?.metadata || {}),
                    channelType: jobData.channelType || 'default',
                    originalMessageId: jobData.messageId,
                    processingTime: Date.now() - startTime
                }
            });

            // Store conversation history in database
            await this.storeConversationHistory(
                jobData.conversationId,
                jobData.message,
                result.output?.response || 'No response generated',
                jobData.clientId || 'default'
            );

            // Log processing time metrics
            const processingTime = Date.now() - startTime;
            this.monitoringService.trackApiRequest(
                'agent_processing',
                jobData.provider || 'default',
                200, // Success
                processingTime
            );

            return {
                success: true,
                response: result.output?.response,
                metadata: result.output?.metadata
            };
        } catch (error) {
            // Log error
            console.error(`Error processing agent job ${job.id}:`, error);

            // Track error in monitoring
            this.monitoringService.trackApiRequest(
                'agent_processing',
                jobData.provider || 'default',
                500, // Error
                Date.now() - startTime
            );

            // Attempt to send error response back to user
            try {
                if (jobData.senderId && this.options.responseQueueName) {
                    await this.jobQueue.addJob(this.options.responseQueueName, {
                        responseId: uuidv4(),
                        conversationId: jobData.conversationId,
                        recipientId: jobData.senderId,
                        message: "I'm sorry, I encountered an error processing your message. Please try again later.",
                        error: error instanceof Error ? error.message : String(error),
                        metadata: {
                            channelType: jobData.channelType || 'default',
                            originalMessageId: jobData.messageId,
                            isError: true
                        }
                    });
                }
            } catch (responseError) {
                console.error('Error sending error response:', responseError);
            }

            // Rethrow to handle retries via BullMQ
            throw error;
        }
    }

    /**
     * Get agent configuration from job data or database
     */
    private async getAgentConfig(jobData: any): Promise<LangGraphAgentConfig> {
        // If job data includes complete config, use it
        if (jobData.agentConfig) {
            return jobData.agentConfig;
        }

        // Otherwise, try to get from database
        if (jobData.agentConfigId) {
            try {
                const { data, error } = await this.supabaseConnection.getClient()
                    .from('agent_configs')
                    .select('*')
                    .eq('id', jobData.agentConfigId)
                    .single();

                if (error || !data) {
                    throw new Error(`Error retrieving agent config: ${error?.message || 'Not found'}`);
                }

                return {
                    model: data.model,
                    character: data.character,
                    maxTokens: data.max_tokens,
                    temperature: data.temperature
                };
            } catch (error) {
                console.error(`Error retrieving agent config ${jobData.agentConfigId}:`, error);
                // Fall back to default
            }
        }

        // Default configuration
        return {
            model: jobData.model || process.env.DEFAULT_AGENT_MODEL || 'gemini-2.0-flash',
            character: {
                name: jobData.characterName || 'AI Assistant',
                description: jobData.characterDescription || 'A helpful AI assistant',
                personality: jobData.characterPersonality || ['helpful', 'friendly', 'professional'],
                responseStyle: jobData.responseStyle || 'conversational'
            },
            maxTokens: jobData.maxTokens || parseInt(process.env.DEFAULT_MAX_TOKENS || '1024', 10),
            temperature: jobData.temperature || parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7')
        };
    }

    /**
     * Store conversation history in database
     */
    private async storeConversationHistory(
        conversationId: string,
        userMessage: string,
        assistantResponse: string,
        clientId: string
    ): Promise<void> {
        try {
            const timestamp = new Date().toISOString();

            await this.supabaseConnection.getClient()
                .from('conversation_history')
                .insert([
                    {
                        conversation_id: conversationId,
                        client_id: clientId,
                        role: 'user',
                        content: userMessage,
                        timestamp
                    },
                    {
                        conversation_id: conversationId,
                        client_id: clientId,
                        role: 'assistant',
                        content: assistantResponse,
                        timestamp
                    }
                ]);
        } catch (error) {
            console.error(`Error storing conversation history for ${conversationId}:`, error);
            // Don't throw, as this shouldn't fail the job
        }
    }

    /**
     * Set up event handlers for the worker
     */
    private setupEventHandlers(): void {
        // Handle completed jobs
        this.worker.on('completed', (job: Job, result: any) => {
            console.log(`Agent job ${job.id} completed:`, result.success ? 'success' : 'failure');
        });

        // Handle failed jobs
        this.worker.on('failed', (job: Job | undefined, error: Error) => {
            console.error(`Agent job ${job?.id} failed:`, error);
        });

        // Handle worker errors
        this.worker.on('error', (error: Error) => {
            console.error('Agent worker error:', error);
        });
    }

    /**
     * Close the worker
     */
    async close(): Promise<void> {
        await this.worker.close();
    }
} 
