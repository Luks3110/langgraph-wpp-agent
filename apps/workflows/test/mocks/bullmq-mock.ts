import { ConnectionOptions, Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis-mock';
import { vi } from 'vitest';

// Mock jobs storage
const mockJobs = new Map<string, any>();

// Create mocks for Queue, Worker and QueueEvents
export function createBullMQMock() {
    // Setup redis mock
    const mockRedis = new IORedis();

    // Connection options using the mock Redis
    const connectionOptions: ConnectionOptions = {
        host: 'localhost',
        port: 6379
    };

    // Mock Queue methods
    const mockQueue = {
        add: vi.fn().mockImplementation((name, data, options) => {
            const jobId = options?.jobId || `job-${Date.now()}-${Math.random()}`;
            const job = { id: jobId, name, data, opts: options };
            mockJobs.set(jobId, job);
            return Promise.resolve(job);
        }),
        getJob: vi.fn().mockImplementation((jobId) => {
            return Promise.resolve(mockJobs.get(jobId) || null);
        }),
        getJobs: vi.fn().mockResolvedValue([]),
        getJobCounts: vi.fn().mockResolvedValue({ active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 }),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        removeJobs: vi.fn().mockResolvedValue(undefined),
        clean: vi.fn().mockResolvedValue([]),
        obliterate: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Worker methods with process property
    type MockWorker = {
        on: ReturnType<typeof vi.fn>;
        off: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        pause: ReturnType<typeof vi.fn>;
        resume: ReturnType<typeof vi.fn>;
        process: (name: string, data: any) => Promise<any>;
    };

    const mockWorker: MockWorker = {
        on: vi.fn().mockImplementation(() => mockWorker),
        off: vi.fn().mockImplementation(() => mockWorker),
        close: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        process: vi.fn().mockImplementation((name, data) => Promise.resolve(data))
    };

    // Mock QueueEvents methods
    const mockQueueEvents = {
        on: vi.fn().mockImplementation(() => mockQueueEvents),
        off: vi.fn().mockImplementation(() => mockQueueEvents),
        close: vi.fn().mockResolvedValue(undefined),
    };

    // Create mockRedis for ioredis implementation
    const redisImplementation = () => mockRedis;

    // Mock the constructors
    vi.mock('bullmq', () => {
        return {
            Queue: vi.fn().mockImplementation(() => mockQueue),
            Worker: vi.fn().mockImplementation((queueName, processor) => {
                // Store processor function so tests can manually trigger job processing
                mockWorker.process = processor;
                return mockWorker;
            }),
            QueueEvents: vi.fn().mockImplementation(() => mockQueueEvents),
        };
    });

    // Mock IORedis
    vi.mock('ioredis', () => {
        return {
            default: vi.fn().mockImplementation(redisImplementation)
        };
    });

    return {
        mockQueue,
        mockWorker,
        mockQueueEvents,
        mockJobs,
        mockRedis,
        connectionOptions,
        Queue,
        Worker,
        QueueEvents,
        clearMockJobs: () => mockJobs.clear(),
    };
} 
