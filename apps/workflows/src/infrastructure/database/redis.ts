import type { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';

export class RedisConnection {
    private static instance: RedisConnection;
    private connection: Redis;

    private constructor(options: RedisOptions = {}) {
        this.connection = new Redis(options);
    }

    public static getInstance(options?: RedisOptions): RedisConnection {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection(options);
        }
        return RedisConnection.instance;
    }

    public getConnection(): Redis {
        return this.connection;
    }

    public async disconnect(): Promise<void> {
        await this.connection.quit();
    }

    public async ping(): Promise<boolean> {
        try {
            const result = await this.connection.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('Redis ping failed:', error);
            return false;
        }
    }
} 
