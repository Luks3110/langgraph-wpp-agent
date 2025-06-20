import type { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';

export class RedisConnection {
    private static instance: RedisConnection;
    private connection: Redis;
    private options: RedisOptions;

    private constructor(options: RedisOptions = {}) {
        this.options = options;
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

    /**
     * Get connection options in the format expected by BullMQ
     */
    public getConnectionOptions(): { host: string; port: number; password?: string; username?: string } {
        return {
            host: this.options.host || 'localhost',
            port: this.options.port || 6379,
            password: this.options.password,
            username: this.options.username
        };
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
