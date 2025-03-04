import { Redis } from 'ioredis';
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from '../config/env.js';

/**
 * Create a new Redis connection
 */
export function createRedisConnection(): Redis {
    const redis = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    redis.on('error', (error) => {
        console.error('Redis connection error:', error);
    });

    redis.on('connect', () => {
        console.log(`Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    });

    return redis;
}

// Export a singleton Redis client
export const redisClient = createRedisConnection(); 
