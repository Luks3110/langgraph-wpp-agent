// @ts-nocheck - Disable TypeScript checking for test file
import { BullMQAdapter, JobStatus } from '@/infrastructure/bullmq/jobQueue';
import { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { createMockRedisConnection, createMockSupabaseConnection } from '../mocks';

// Mocks
vi.mock('bullmq', () => {
    const mockJob = {
        id: '1',
        getState: vi.fn().mockResolvedValue('waiting'),
    };

    const mockQueue = {
        add: vi.fn().mockResolvedValue(mockJob),
        getJob: vi.fn().mockResolvedValue(mockJob),
        close: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(1),
    };

    return {
        Queue: vi.fn().mockImplementation(() => mockQueue),
    };
});

// Mock Redis connection with ioredis-mock
const mockRedisConnection = createMockRedisConnection();

// Create mock Supabase connection
const mockSupabaseConnection = createMockSupabaseConnection();

describe('BullMQAdapter', () => {
    let adapter: BullMQAdapter;
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
        // Spy on console.error to prevent test output pollution
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        adapter = new BullMQAdapter(mockRedisConnection as any, mockSupabaseConnection as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy.mockRestore();
    });

    describe('addJob', () => {
        it('should add a job to the queue and return the job ID', async () => {
            const queueName = 'test-queue';
            const data = { test: 'data' };
            const options = {};

            const jobId = await adapter.addJob(queueName, data, options);

            expect(jobId).toBe('1');
            expect(Queue).toHaveBeenCalledWith(queueName, expect.objectContaining({
                connection: expect.any(Object)
            }));

            const mockQueueInstance = (Queue as any).mock.results[0].value;
            expect(mockQueueInstance.add).toHaveBeenCalledWith('process', data, options);
        });

        it('should store job reference in Supabase when workflow info is provided', async () => {
            const queueName = 'test-queue';
            const data = { test: 'data' };
            const options = {
                workflowId: 'workflow-123',
                tenantId: 'tenant-123',
                eventType: 'test.event',
            };

            const mockSupabaseClient = mockSupabaseConnection.getClient();
            mockSupabaseClient.insert.mockReturnValue({
                data: null,
                error: null,
            });

            const jobId = await adapter.addJob(queueName, data, options);

            expect(jobId).toBe('1');
            expect(mockSupabaseConnection.getClient).toHaveBeenCalled();
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('event_store');
            expect(mockSupabaseClient.insert).toHaveBeenCalledWith(expect.objectContaining({
                id: '1',
                workflow_id: 'workflow-123',
                tenant_id: 'tenant-123',
                event_type: 'test.event',
                status: 'waiting',
                payload: data,
            }));
        });

        it('should handle errors when adding a job', async () => {
            const queueName = 'test-queue';
            const data = { test: 'data' };
            const options = {};

            const mockQueueInstance = (Queue as any).mock.results[0].value;
            mockQueueInstance.add.mockRejectedValueOnce(new Error('Failed to add job'));

            await expect(adapter.addJob(queueName, data, options)).rejects.toThrow('Failed to add job');
        });
    });

    describe('getJobStatus', () => {
        it('should get job status from in-memory queue', async () => {
            const jobId = '1';
            const mockQueueInstance = (Queue as any).mock.results[0].value;
            mockQueueInstance.getJob.mockResolvedValueOnce({
                id: jobId,
                getState: vi.fn().mockResolvedValueOnce('active'),
            });

            const status = await adapter.getJobStatus(jobId);

            expect(status).toBe('active');
            expect(mockQueueInstance.getJob).toHaveBeenCalledWith(jobId);

            // Should update the status in Supabase
            const mockSupabaseClient = mockSupabaseConnection.getClient();
            expect(mockSupabaseConnection.getClient).toHaveBeenCalled();
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('event_store');
            expect(mockSupabaseClient.update).toHaveBeenCalledWith({ status: 'active' });
            expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', jobId);
        });

        it('should check Supabase if job not found in memory', async () => {
            const jobId = '999';
            const mockQueueInstance = (Queue as any).mock.results[0].value;
            mockQueueInstance.getJob.mockResolvedValueOnce(null);

            // Mock Supabase response
            const mockSupabaseClient = mockSupabaseConnection.getClient();
            mockSupabaseClient.single.mockReturnValueOnce({
                data: { status: 'completed' },
                error: null,
            });

            const status = await adapter.getJobStatus(jobId);

            expect(status).toBe('completed');
            expect(mockSupabaseConnection.getClient).toHaveBeenCalled();
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('event_store');
            expect(mockSupabaseClient.select).toHaveBeenCalledWith('status');
            expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', jobId);
        });

        it('should handle various status mappings from database', async () => {
            const jobId = '999';
            const mockQueueInstance = (Queue as any).mock.results[0].value;
            mockQueueInstance.getJob.mockResolvedValueOnce(null);

            // Test different status mappings
            const testCases: [string, JobStatus][] = [
                ['success', 'completed'],
                ['error', 'failed'],
                ['processing', 'active'],
                ['delayed', 'delayed'],
                ['paused', 'paused'],
                ['unknown_status', 'waiting'],
            ];

            const mockSupabaseClient = mockSupabaseConnection.getClient();
            for (const [dbStatus, expectedStatus] of testCases) {
                mockSupabaseClient.single.mockReturnValueOnce({
                    data: { status: dbStatus },
                    error: null,
                });

                const status = await adapter.getJobStatus(jobId);
                expect(status).toBe(expectedStatus);
            }
        });

        it('should return null if job not found anywhere', async () => {
            const jobId = '999';
            const mockQueueInstance = (Queue as any).mock.results[0].value;
            mockQueueInstance.getJob.mockResolvedValueOnce(null);

            // Mock Supabase response - not found
            const mockSupabaseClient = mockSupabaseConnection.getClient();
            mockSupabaseClient.single.mockReturnValueOnce({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
            });

            const status = await adapter.getJobStatus(jobId);

            expect(status).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            const jobId = '999';
            const mockQueueInstance = (Queue as any).mock.results[0].value;
            mockQueueInstance.getJob.mockResolvedValueOnce(null);

            // Mock Supabase error
            const mockSupabaseClient = mockSupabaseConnection.getClient();
            mockSupabaseClient.single.mockReturnValueOnce({
                data: null,
                error: { code: 'ERROR', message: 'Database error' },
            });

            await expect(adapter.getJobStatus(jobId)).rejects.toThrow('Failed to get job status: Database error');
        });
    });

    describe('close', () => {
        it('should close all queues', async () => {
            // Create a few queues by calling addJob with different queue names
            await adapter.addJob('queue1', { data: 1 });
            await adapter.addJob('queue2', { data: 2 });

            const mockQueueInstance = (Queue as any).mock.results[0].value;

            await adapter.close();

            expect(mockQueueInstance.close).toHaveBeenCalled();
        });
    });
}); 
