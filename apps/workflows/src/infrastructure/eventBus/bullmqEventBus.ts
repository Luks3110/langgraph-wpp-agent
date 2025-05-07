import { ConnectionOptions, Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { DomainEvent } from '../../domain/events/index';
import { MonitoringService } from '../monitoring/monitoring';
import { EventStoreRepository } from '../repositories/eventStoreRepository';
import { EventStore, PersistentEventStore } from './persistentEventStore';
import { SubscriptionManager } from './subscriptionManager';

/**
 * Options for the event bus
 */
export interface EventBusOptions {
    connection: {
        host: string;
        port: number;
        password?: string;
        username?: string;
    };
    queueName: string;
    jobOptions?: {
        attempts?: number;
        backoff?: {
            type: 'exponential' | 'fixed';
            delay: number;
        };
        removeOnComplete?: boolean | number;
        removeOnFail?: boolean | number;
    };
    eventStore?: EventStore;
}

/**
 * Event bus interface
 */
export interface EventBus {
    /**
     * Initialize the event bus
     */
    initialize(): Promise<void>;

    /**
     * Publish an event to the bus
     */
    publish(event: DomainEvent): Promise<void>;

    /**
     * Subscribe to events of a specific type
     */
    subscribe<T extends DomainEvent>(
        eventType: string,
        handler: (event: T) => Promise<void> | void
    ): Promise<string>;

    /**
     * Unsubscribe from events using subscription ID
     */
    unsubscribe(subscriptionId: string): Promise<boolean>;

    /**
     * Replay events from a specific timestamp
     */
    replayEvents(from: Date, to?: Date, eventTypes?: string[]): Promise<void>;

    /**
     * Get events by workflow ID
     */
    getEventsByWorkflowId(workflowId: string): Promise<DomainEvent[]>;

    /**
     * Close the event bus connections
     */
    close(): Promise<void>;
}

/**
 * BullMQ implementation of the event bus
 */
export class BullMQEventBus implements EventBus {
    private queue: Queue | null = null;
    private worker: Worker | null = null;
    private redis: Redis | null = null;
    private initialized = false;
    private subscriptionManager = new SubscriptionManager();
    private eventStore: EventStore;
    private monitoring: MonitoringService;

    constructor(private options: EventBusOptions) {
        // Initialize event store if not provided
        this.eventStore = options.eventStore ||
            new PersistentEventStore(new EventStoreRepository());

        // Get the monitoring service
        this.monitoring = MonitoringService.getInstance();
    }

    /**
     * Initialize the event bus connections
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        // Create Redis connection
        this.redis = new Redis(
            this.options.connection.port,
            this.options.connection.host,
            {
                password: this.options.connection.password,
                username: this.options.connection.username
            }
        );

        // Create connection options object for BullMQ
        const connectionOptions: ConnectionOptions = {
            host: this.options.connection.host,
            port: this.options.connection.port,
            password: this.options.connection.password,
            username: this.options.connection.username
        };

        // Create queue for publishing events
        this.queue = new Queue(this.options.queueName, {
            connection: connectionOptions
        });

        // Create worker for processing events
        this.worker = new Worker(
            this.options.queueName,
            async (job: Job) => {
                const event = job.data as DomainEvent;

                // Start tracking the event processing
                const startTime = Date.now();

                try {
                    await this.subscriptionManager.routeEvent(event);

                    // Track successful event processing
                    this.monitoring.trackEvent(event, 'processed');

                    // Track processing time
                    const processingTime = Date.now() - startTime;
                    this.monitoring.trackApiRequest(
                        'event_processing',
                        event.type,
                        200,
                        processingTime
                    );
                } catch (error) {
                    // Track failed event processing
                    this.monitoring.trackEvent(event, 'failed');
                    this.monitoring.trackEventError(event, error instanceof Error ? error : new Error(String(error)));

                    // Rethrow to let BullMQ handle retries
                    throw error;
                }
            },
            {
                connection: connectionOptions
            }
        );

        // Set up error handler for worker
        this.worker.on('failed', (job: Job | undefined, error: Error) => {
            console.error(`Event processing failed for job ${job?.id}:`, error);
        });

        // Instrument queue and worker for monitoring
        this.monitoring.instrumentQueue(this.queue, this.options.queueName);
        this.monitoring.instrumentWorker(this.worker, this.options.queueName);

        // Start monitoring service
        this.monitoring.start();

        this.initialized = true;
    }

    /**
     * Publish an event to the queue
     */
    async publish(event: DomainEvent): Promise<void> {
        if (!this.initialized || !this.queue) {
            await this.initialize();
        }

        // Ensure the event has the required properties
        if (!event.id) {
            event.id = randomUUID();
        }

        if (!event.timestamp) {
            event.timestamp = new Date().toISOString();
        }

        // Initialize metadata if not present
        if (!event.metadata) {
            event.metadata = {};
        }

        // Get or extract workflow ID if available
        if (!event.metadata.workflowId && event.payload?.workflowId) {
            event.metadata.workflowId = event.payload.workflowId;
        } else if (!event.metadata.workflowId && event.payload?.workflowExecutionId) {
            // Try to extract from executionId if in format workflowId:executionId
            const parts = String(event.payload.workflowExecutionId).split(':');
            if (parts.length > 1) {
                event.metadata.workflowId = parts[0];
            }
        }

        // Store the event in the persistent store
        try {
            await this.eventStore.saveEvent(event);
            console.log(`Event ${event.id} of type ${event.type} persisted to store`);
        } catch (error) {
            console.error(`Failed to persist event ${event.id} to store:`, error);
            // Track database error
            this.monitoring.trackEventError(
                event,
                error instanceof Error ? error : new Error(`Failed to persist event: ${String(error)}`)
            );
            // Continue processing even if persistence fails
        }

        // Track that we're publishing an event
        this.monitoring.trackEvent(event, 'published');

        // Add the event to the queue
        const job = await this.queue!.add(
            event.type,
            event,
            {
                attempts: this.options.jobOptions?.attempts || 3,
                backoff: this.options.jobOptions?.backoff || {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: this.options.jobOptions?.removeOnComplete ?? 1000,
                removeOnFail: this.options.jobOptions?.removeOnFail ?? 5000,
                jobId: event.id
            }
        );

        // Store job ID in metadata for tracking
        event.metadata.jobId = job.id;

        // Update the event in the store with the job ID if persistence succeeded earlier
        try {
            await this.eventStore.saveEvent(event);
        } catch (error) {
            console.error(`Failed to update event ${event.id} with job ID:`, error);
            // Track database error
            this.monitoring.trackEventError(
                event,
                error instanceof Error ? error : new Error(`Failed to update event: ${String(error)}`)
            );
        }
    }

    /**
     * Subscribe to events of a specific type
     */
    async subscribe<T extends DomainEvent>(
        eventType: string,
        handler: (event: T) => Promise<void> | void
    ): Promise<string> {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.subscriptionManager.subscribe(
            eventType,
            handler as any
        );
    }

    /**
     * Unsubscribe from events
     */
    async unsubscribe(subscriptionId: string): Promise<boolean> {
        return this.subscriptionManager.unsubscribe(subscriptionId);
    }

    /**
     * Replay events from a specific timestamp
     */
    async replayEvents(
        from: Date,
        to: Date = new Date(),
        eventTypes?: string[]
    ): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        console.log(`Replaying events from ${from.toISOString()} to ${to.toISOString()}`);

        // Use the event store to replay events
        const processedCount = await this.eventStore.replayEvents(
            from,
            to,
            async (event: DomainEvent) => {
                // Filter by event types if specified
                if (eventTypes && eventTypes.length > 0 && !eventTypes.includes(event.type)) {
                    return; // Skip events not in the eventTypes list
                }

                // Ensure timestamp is in ISO string format
                if (event.timestamp && typeof event.timestamp !== 'string') {
                    event.timestamp = new Date(event.timestamp).toISOString();
                }

                // Republish the event
                try {
                    await this.publish(event);
                    // Track the event as processed since it's been republished
                    this.monitoring.trackEvent(event, 'processed');
                } catch (error) {
                    console.error(`Failed to replay event ${event.id}:`, error);
                    this.monitoring.trackEventError(
                        event,
                        error instanceof Error ? error : new Error(`Replay failed: ${String(error)}`)
                    );
                }
            }
        );

        console.log(`Replayed ${processedCount} events`);
    }

    /**
     * Get events by workflow ID
     */
    async getEventsByWorkflowId(workflowId: string): Promise<DomainEvent[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.eventStore.getEventsByWorkflowId(workflowId);
    }

    /**
     * Close the event bus connections
     */
    async close(): Promise<void> {
        // Close the worker if it exists
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
        }

        // Close the queue if it exists
        if (this.queue) {
            await this.queue.close();
            this.queue = null;
        }

        // Close the Redis connection if it exists
        if (this.redis) {
            this.redis.disconnect();
            this.redis = null;
        }

        // Stop the monitoring
        this.monitoring.stop();

        this.initialized = false;
    }
} 
