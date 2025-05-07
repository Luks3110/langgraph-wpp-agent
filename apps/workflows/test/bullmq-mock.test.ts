// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { createBullMQMock } from './mocks/bullmq-mock';

describe('BullMQ Mocks', () => {
    it('should create a functioning BullMQ mock', () => {
        const mock = createBullMQMock();
        expect(mock.mockQueue).toBeDefined();
        expect(mock.mockWorker).toBeDefined();
        expect(mock.mockQueueEvents).toBeDefined();
        expect(mock.mockJobs).toBeDefined();
        expect(mock.connectionOptions).toBeDefined();
        expect(mock.mockRedis).toBeDefined();
    });

    it('should properly mock Queue operations', async () => {
        const { mockQueue, mockJobs, clearMockJobs } = createBullMQMock();

        // Clear any existing jobs
        clearMockJobs();

        // Test adding a job
        const testData = { test: 'data' };
        const job = await mockQueue.add('test-job', testData, { jobId: 'test-id-1' });

        expect(job).toBeDefined();
        expect(job.id).toBe('test-id-1');
        expect(job.name).toBe('test-job');
        expect(job.data).toEqual(testData);

        // Test fetching a job
        const retrievedJob = await mockQueue.getJob('test-id-1');
        expect(retrievedJob).toBeDefined();
        expect(retrievedJob.id).toBe('test-id-1');
        expect(retrievedJob.data).toEqual(testData);

        // Test job counts
        const counts = await mockQueue.getJobCounts();
        expect(counts).toEqual({ active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 });
    });

    it('should properly mock Worker operations', async () => {
        const { mockWorker } = createBullMQMock();

        // Test event listeners
        const mockCallback = vi.fn();
        mockWorker.on('completed', mockCallback);

        // The underlying implementation returns the worker for chaining
        expect(mockWorker.on('completed', mockCallback)).toBe(mockWorker);

        // Test worker methods
        await expect(mockWorker.close()).resolves.toBeUndefined();
        await expect(mockWorker.pause()).resolves.toBeUndefined();
        await expect(mockWorker.resume()).resolves.toBeUndefined();

        // Test processor function
        expect(mockWorker.process).toBeDefined();
        const testData = { test: 'data' };
        await expect(mockWorker.process('test-job', testData)).resolves.toEqual(testData);
    });

    it('should properly mock QueueEvents operations', async () => {
        const { mockQueueEvents } = createBullMQMock();

        // Test event listeners
        const mockCallback = vi.fn();
        mockQueueEvents.on('completed', mockCallback);

        // The underlying implementation returns the queue events for chaining
        expect(mockQueueEvents.on('completed', mockCallback)).toBe(mockQueueEvents);

        // Test queue events methods
        await expect(mockQueueEvents.close()).resolves.toBeUndefined();
    });

    it('should properly mock job lifecycle', async () => {
        const { mockQueue, mockWorker, mockJobs, clearMockJobs } = createBullMQMock();

        // Clear any existing jobs
        clearMockJobs();

        // Define a processor function
        const processor = vi.fn().mockImplementation(job => {
            return { processed: true, data: job.data };
        });

        // Override the worker process method
        mockWorker.process = processor;

        // Add a job
        const jobData = { task: 'important task' };
        const job = await mockQueue.add('process-job', jobData, { jobId: 'lifecycle-test' });

        // Verify job was added
        expect(mockJobs.get('lifecycle-test')).toBeDefined();

        // Process the job manually (in real scenarios BullMQ would do this)
        const result = await processor({ id: job.id, name: job.name, data: job.data });

        // Verify processor was called with correct data
        expect(processor).toHaveBeenCalled();
        expect(result).toEqual({ processed: true, data: jobData });
    });
}); 
