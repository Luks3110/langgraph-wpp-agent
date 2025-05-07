import { RedisConnection } from '@/infrastructure/database/redis';
import IORedis from 'ioredis-mock';
import { vi } from 'vitest';

// Create a proper Redis mock using ioredis-mock
export function createRedisMock() {
    // Create a Redis mock instance
    const redisMock = new IORedis();

    // Add spy functions to track calls
    vi.spyOn(redisMock, 'connect');
    vi.spyOn(redisMock, 'disconnect');
    vi.spyOn(redisMock, 'set');
    vi.spyOn(redisMock, 'get');

    // Create a mock Redis connection that returns our mock instance
    const mockRedisConnection = {
        getConnection: () => redisMock,
        close: vi.fn().mockResolvedValue(undefined),
    };

    // Mock the singleton instance
    vi.spyOn(RedisConnection, 'getInstance').mockReturnValue(
        mockRedisConnection as unknown as RedisConnection
    );

    return {
        redisMock,
        mockRedisConnection
    };
} 
