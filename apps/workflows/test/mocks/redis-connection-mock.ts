import { RedisConnection } from '@/infrastructure/database/redis';
import { vi } from 'vitest';

export function createRedisConnectionMock() {
    const mockRedisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(0),
        hget: vi.fn().mockResolvedValue(null),
        hset: vi.fn().mockResolvedValue(1),
        hdel: vi.fn().mockResolvedValue(1),
        hgetall: vi.fn().mockResolvedValue({}),
        pipeline: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
        quit: vi.fn().mockResolvedValue('OK'),
    };

    const mockRedisConnection = {
        getClient: vi.fn().mockReturnValue(mockRedisClient),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockReturnValue(true),
    };

    // Mock the singleton instance
    vi.spyOn(RedisConnection, 'getInstance').mockReturnValue(
        mockRedisConnection as unknown as RedisConnection
    );

    return {
        mockRedisClient,
        mockRedisConnection,
        RedisConnection
    };
} 
