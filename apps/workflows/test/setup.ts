import { afterEach } from 'vitest';
import { RedisConnection } from '../src/infrastructure/database/redis';
import { SupabaseConnection } from '../src/infrastructure/database/supabase';

// Mock all external dependencies
jest.mock('ioredis', () => {
    return class MockRedis {
        constructor() { }
        connect() {
            return Promise.resolve();
        }
        disconnect() {
            return Promise.resolve();
        }
        get() {
            return Promise.resolve();
        }
        set() {
            return Promise.resolve();
        }
    };
});

jest.mock('@supabase/supabase-js', () => {
    return {
        createClient: () => ({
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: null, error: null }),
                    }),
                }),
                insert: () => Promise.resolve({ data: null, error: null }),
                update: () => ({
                    eq: () => Promise.resolve({ data: null, error: null }),
                }),
                delete: () => ({
                    eq: () => Promise.resolve({ data: null, error: null }),
                }),
            }),
        }),
    };
});

// Create a common setup for database connections
export function setupTestEnvironment() {
    // Mock Redis connection
    const mockRedisConnection = {
        getConnection: () => ({
            options: {
                host: 'localhost',
                port: 6379,
            },
        }),
        close: () => Promise.resolve(),
    };

    // Mock Supabase connection
    const mockSupabaseConnection = {
        getClient: () => ({
            from: (table: string) => ({
                select: (fields: string) => ({
                    eq: (field: string, value: string) => ({
                        single: () => Promise.resolve({
                            data: { status: 'completed' },
                            error: null,
                        }),
                    }),
                }),
                insert: (data: any) => Promise.resolve({
                    data,
                    error: null,
                }),
                update: (data: any) => ({
                    eq: (field: string, value: string) => Promise.resolve({
                        data,
                        error: null,
                    }),
                }),
                delete: () => ({
                    eq: (field: string, value: string) => Promise.resolve({
                        data: null,
                        error: null,
                    }),
                }),
            }),
        }),
    };

    // Override singleton instances if needed
    jest.spyOn(RedisConnection, 'getInstance').mockReturnValue(
        mockRedisConnection as unknown as RedisConnection
    );

    jest.spyOn(SupabaseConnection, 'getInstance').mockReturnValue(
        mockSupabaseConnection as unknown as SupabaseConnection
    );

    return {
        mockRedisConnection,
        mockSupabaseConnection,
    };
}

// Register global cleanup
afterEach(() => {
    jest.clearAllMocks();
}); 
