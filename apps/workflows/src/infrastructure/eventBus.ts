import { Queue } from 'bullmq';
import { DomainEvent } from '../domain/events/index.js';
import { RedisConnection } from './database/redis.js';

export interface EventBus {
    publish(event: DomainEvent): Promise<void>;
    subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void;
}

export class BullMQEventBus implements EventBus {
    private eventQueue: Queue;
    private handlers: Map<string, Array<(event: any) => Promise<void>>>;

    constructor(redisConnection: RedisConnection) {
        this.eventQueue = new Queue('events', {
            connection: redisConnection.getConnection().options
        });
        this.handlers = new Map();

        // Set up worker to process events
        this.setupEventProcessor(redisConnection);
    }

    async publish(event: DomainEvent): Promise<void> {
        await this.eventQueue.add(event.type, event, {
            removeOnComplete: 100,
            removeOnFail: 500
        });
    }

    subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType)!.push(handler);
    }

    private setupEventProcessor(redisConnection: RedisConnection): void {
        // Implement a worker using bullmq to process events
        // For simplicity, this is not fully implemented here
        // In a real implementation, you would:
        // 1. Create a Worker from bullmq
        // 2. Register a processor function that calls handlers for each event type
        // 3. Handle errors and retries
    }
} 
