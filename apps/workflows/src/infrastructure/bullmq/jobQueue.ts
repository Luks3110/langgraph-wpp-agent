import { JobsOptions, Queue, QueueOptions } from 'bullmq';
import { RedisConnection } from '../database/redis';
import { SupabaseConnection } from '../database/supabase';

export interface JobOptions extends JobsOptions {
    workflowId?: string;
    tenantId?: string;
    eventType?: string;
}

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export interface JobQueue {
    addJob(queueName: string, data: any, options?: JobOptions): Promise<string>;
    getJobStatus(jobId: string): Promise<JobStatus | null>;
}

export class BullMQAdapter implements JobQueue {
    private queues: Map<string, Queue>;
    private redisConnection: RedisConnection;
    private supabaseConnection: SupabaseConnection;

    constructor(
        redisConnection: RedisConnection,
        supabaseConnection?: SupabaseConnection
    ) {
        this.queues = new Map();
        this.redisConnection = redisConnection;
        this.supabaseConnection = supabaseConnection || SupabaseConnection.getInstance();
    }

    private getQueue(queueName: string): Queue {
        if (!this.queues.has(queueName)) {
            const queueOptions: QueueOptions = {
                connection: this.redisConnection.getConnection().options,
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 500
                }
            };
            this.queues.set(queueName, new Queue(queueName, queueOptions));
        }
        return this.queues.get(queueName)!;
    }

    async addJob(queueName: string, data: any, options?: JobOptions): Promise<string> {
        const queue = this.getQueue(queueName);
        const job = await queue.add('process', data, options);
        if (!job || !job.id) {
            throw new Error('Failed to add job to queue');
        }

        // If we have workflow and tenant info, store job reference in the database
        if (options?.workflowId && options?.tenantId && options?.eventType) {
            await this.storeJobReference(
                job.id.toString(),
                options.workflowId,
                options.tenantId,
                options.eventType,
                data
            );
        }

        return job.id.toString();
    }

    private async storeJobReference(
        jobId: string,
        workflowId: string,
        tenantId: string,
        eventType: string,
        payload: any
    ): Promise<void> {
        try {
            const client = this.supabaseConnection.getClient();
            await client.from('event_store').insert({
                id: jobId,
                workflow_id: workflowId,
                tenant_id: tenantId,
                event_type: eventType,
                status: 'waiting',
                payload,
                timestamp: new Date().toISOString(),
                sequence_number: Date.now() // Simple sequence number for now
            });
        } catch (error) {
            console.error('Failed to store job reference:', error);
            // Don't throw here, we still want to return the job ID even if DB storage fails
        }
    }

    async getJobStatus(jobId: string): Promise<JobStatus | null> {
        // Step 1: Check all in-memory queues first for active/waiting jobs
        for (const queue of this.queues.values()) {
            const job = await queue.getJob(jobId);
            if (job) {
                const state = await job.getState();

                // Update the job status in the database if found in-memory
                await this.updateJobStatus(jobId, state as JobStatus);

                return state as JobStatus;
            }
        }

        // Step 2: If not found in-memory, check the event_store table
        try {
            const client = this.supabaseConnection.getClient();
            const { data, error } = await client
                .from('event_store')
                .select('status')
                .eq('id', jobId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Job not found
                }
                throw new Error(`Failed to get job status: ${error.message}`);
            }

            // Map database status to JobStatus
            if (data) {
                return this.mapDatabaseStatusToJobStatus(data.status);
            }
        } catch (error) {
            console.error('Error querying job status from database:', error);
            // Continue to check BullMQ's history
        }

        // Step 3: Check completed or failed jobs in BullMQ history
        for (const queueName of this.queues.keys()) {
            try {
                const queue = this.getQueue(queueName);
                // Check completed jobs
                const completedJob = await queue.getJob(jobId);
                if (completedJob) {
                    const state = await completedJob.getState();
                    return state as JobStatus;
                }
            } catch (error) {
                // Ignore errors for specific queue - continue checking others
                console.error(`Error checking queue ${queueName}:`, error);
            }
        }

        // Job not found anywhere
        return null;
    }

    private mapDatabaseStatusToJobStatus(dbStatus: string | null): JobStatus {
        if (!dbStatus) return 'waiting';

        switch (dbStatus.toLowerCase()) {
            case 'completed':
            case 'success':
                return 'completed';
            case 'failed':
            case 'error':
                return 'failed';
            case 'active':
            case 'processing':
                return 'active';
            case 'delayed':
                return 'delayed';
            case 'paused':
                return 'paused';
            case 'waiting':
            default:
                return 'waiting';
        }
    }

    private async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
        try {
            const client = this.supabaseConnection.getClient();
            await client
                .from('event_store')
                .update({ status })
                .eq('id', jobId);
        } catch (error) {
            console.error('Failed to update job status in database:', error);
            // Don't throw - this is a background update
        }
    }

    async close(): Promise<void> {
        const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
        await Promise.all(closePromises);
        this.queues.clear();
    }
} 
