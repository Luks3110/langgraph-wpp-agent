// @ts-nocheck
import { faker } from '@faker-js/faker';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { Database } from '../src/infrastructure/database/supabase.types';

// Import Redis from our setup
const mockRedis = vi.hoisted(() => {
    const Redis = function () {
        return {
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            set: vi.fn().mockImplementation((key, value) => {
                Redis.data[key] = value;
                return Promise.resolve('OK');
            }),
            get: vi.fn().mockImplementation((key) => {
                return Promise.resolve(Redis.data[key] || null);
            }),
            options: {}
        };
    };

    // Store for Redis mock data
    Redis.data = {};

    return {
        Redis,
        default: Redis
    };
});

/**
 * Create a mock Redis connection
 */
export function createMockRedis() {
    return new mockRedis.Redis();
}

/**
 * Create a mock Redis connection adapter
 */
export function createMockRedisConnection() {
    const redis = createMockRedis();

    return {
        getConnection: () => redis,
        close: vi.fn().mockResolvedValue(undefined)
    };
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient() {
    const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
            data: null,
            error: null
        })
    };

    return mockClient as unknown as SupabaseClient<Database>;
}

/**
 * Create a mock Supabase connection
 */
export function createMockSupabaseConnection() {
    const mockClient = createMockSupabaseClient();

    return {
        getClient: vi.fn().mockReturnValue(mockClient)
    };
}

/**
 * Mock job data generator
 */
export function createMockJobData() {
    return {
        id: faker.string.uuid(),
        type: faker.helpers.arrayElement(['email', 'notification', 'process']),
        payload: {
            title: faker.lorem.sentence(),
            body: faker.lorem.paragraph(),
            timestamp: faker.date.recent().toISOString()
        }
    };
}

/**
 * Mock job options generator
 */
export function createMockJobOptions() {
    return {
        workflowId: faker.string.uuid(),
        tenantId: faker.string.uuid(),
        eventType: faker.helpers.arrayElement(['workflow.started', 'task.completed', 'process.failed']),
        attempts: faker.number.int({ min: 1, max: 5 }),
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    };
}

/**
 * Mock BullMQ Queue
 */
export class MockQueue {
    private jobs = new Map<string, any>();
    private addedJobs: any[] = [];

    constructor(public name: string, public opts = {}) { }

    async add(name: string, data: any, opts = {}) {
        const id = faker.string.uuid();
        const job = {
            id,
            name,
            data,
            opts,
            getState: vi.fn().mockResolvedValue('waiting'),
            finished: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        };

        this.jobs.set(id, job);
        this.addedJobs.push(job);
        return job;
    }

    async getJob(id: string) {
        return this.jobs.get(id);
    }

    async count() {
        return this.jobs.size;
    }

    async close() {
        return Promise.resolve();
    }

    setMockJobState(id: string, state: string) {
        if (this.jobs.has(id)) {
            const job = this.jobs.get(id);
            job.getState.mockResolvedValue(state);
            this.jobs.set(id, job);
        }
    }
} 
