import { faker } from '@faker-js/faker';
import { SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis-mock';
import { Database } from '../src/infrastructure/database/supabase.types';

/**
 * Create a mock Redis connection
 */
export function createMockRedis() {
    return new Redis();
}

/**
 * Create a mock Redis connection adapter
 */
export function createMockRedisConnection() {
    const mockRedis = createMockRedis();

    return {
        getConnection: jest.fn().mockReturnValue({
            options: {
                host: 'localhost',
                port: 6379
            }
        }),
        close: jest.fn().mockResolvedValue(undefined)
    };
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient() {
    const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnValue({
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
        getClient: jest.fn().mockReturnValue(mockClient)
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
    private jobs = new Map();
    private addedJobs = [];

    constructor(public name: string, public opts = {}) { }

    async add(name: string, data: any, opts = {}) {
        const id = faker.string.uuid();
        const job = {
            id,
            name,
            data,
            opts,
            getState: async () => 'waiting',
            finished: () => Promise.resolve(),
            remove: () => Promise.resolve()
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
            job.getState = async () => state;
            this.jobs.set(id, job);
        }
    }
}

// Vitest expects mock.fn() instead of jest.fn()
export const vi = {
    fn: function () {
        return function (...args: any[]) {
            const mockFn = function (...innerArgs: any[]) {
                mockFn.mock.calls.push(innerArgs);
                return mockFn.mockReturnValue;
            };

            mockFn.mock = {
                calls: [],
                instances: [],
                invocationCallOrder: [],
                results: []
            };

            mockFn.mockReturnValue = undefined;
            mockFn.mockReturnThis = function () {
                mockFn.mockReturnValue = this;
                return mockFn;
            };
            mockFn.mockResolvedValue = function (value: any) {
                mockFn.mockReturnValue = Promise.resolve(value);
                return mockFn;
            };
            mockFn.mockImplementation = function (implementation: Function) {
                const originalMockFn = mockFn;
                mockFn = function (...innerArgs: any[]) {
                    originalMockFn.mock.calls.push(innerArgs);
                    return implementation(...innerArgs);
                };
                mockFn.mock = originalMockFn.mock;
                mockFn.mockReturnValue = originalMockFn.mockReturnValue;
                mockFn.mockReturnThis = originalMockFn.mockReturnThis;
                mockFn.mockResolvedValue = originalMockFn.mockResolvedValue;
                mockFn.mockImplementation = originalMockFn.mockImplementation;
                return mockFn;
            };

            if (args.length > 0) {
                mockFn.mockReturnValue = args[0];
            }

            return mockFn;
        };
    }
}; 
