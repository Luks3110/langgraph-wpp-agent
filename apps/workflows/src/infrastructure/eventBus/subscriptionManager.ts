import { DomainEvent } from '../../domain/events/index';

/**
 * Event handler function type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

/**
 * Backoff strategy for retrying failed event handling
 */
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';

/**
 * Options for event subscription
 */
export interface SubscriptionOptions {
    maxRetries?: number;
    backoffStrategy?: BackoffStrategy;
    backoffDelay?: number; // Base delay in ms
    errorHandler?: ErrorHandler;
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
    handleError(error: Error, event: DomainEvent, attempt: number, subscription: EventSubscription): Promise<boolean>;
}

/**
 * Subscription data
 */
export interface EventSubscription {
    id: string;
    eventType: string;
    handler: EventHandler;
    options: Required<SubscriptionOptions>;
}

/**
 * Default error handler implementation
 */
export class DefaultErrorHandler implements ErrorHandler {
    async handleError(
        error: Error,
        event: DomainEvent,
        attempt: number,
        subscription: EventSubscription
    ): Promise<boolean> {
        console.error(
            `Error processing event ${event.type} (attempt ${attempt}/${subscription.options.maxRetries}):`,
            error
        );

        // Return true to retry, false to stop retrying
        return attempt < subscription.options.maxRetries;
    }
}

/**
 * Default subscription options
 */
const DEFAULT_SUBSCRIPTION_OPTIONS: Required<SubscriptionOptions> = {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    backoffDelay: 1000,
    errorHandler: new DefaultErrorHandler()
};

/**
 * Subscription manager for handling event subscriptions
 */
export class SubscriptionManager {
    private subscriptions = new Map<string, EventSubscription>();
    private typeToSubscriptions = new Map<string, Set<string>>();
    private wildcardSubscriptions = new Set<string>(); // Store wildcard subscription IDs
    private nextId = 1;

    /**
     * Subscribe to an event type
     */
    subscribe<T extends DomainEvent>(
        eventType: string,
        handler: EventHandler<T>,
        options: SubscriptionOptions = {}
    ): string {
        const id = `subscription_${this.nextId++}`;
        const finalOptions: Required<SubscriptionOptions> = {
            ...DEFAULT_SUBSCRIPTION_OPTIONS,
            ...options
        };

        const subscription: EventSubscription = {
            id,
            eventType,
            handler: handler as EventHandler,
            options: finalOptions
        };

        // Store subscription by ID
        this.subscriptions.set(id, subscription);

        // Handle wildcard subscriptions
        if (eventType === '*') {
            this.wildcardSubscriptions.add(id);
        } else {
            // Add to type-based lookup
            if (!this.typeToSubscriptions.has(eventType)) {
                this.typeToSubscriptions.set(eventType, new Set());
            }
            this.typeToSubscriptions.get(eventType)!.add(id);
        }

        return id;
    }

    /**
     * Unsubscribe from an event
     */
    unsubscribe(subscriptionId: string): boolean {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            return false;
        }

        // Remove from ID-based lookup
        this.subscriptions.delete(subscriptionId);

        // Handle wildcard subscriptions
        if (subscription.eventType === '*') {
            this.wildcardSubscriptions.delete(subscriptionId);
        } else {
            // Remove from type-based lookup
            const subscriptionsForType = this.typeToSubscriptions.get(subscription.eventType);
            if (subscriptionsForType) {
                subscriptionsForType.delete(subscriptionId);
                if (subscriptionsForType.size === 0) {
                    this.typeToSubscriptions.delete(subscription.eventType);
                }
            }
        }

        return true;
    }

    /**
     * Get all subscriptions for an event type
     */
    getSubscriptionsForType(eventType: string): EventSubscription[] {
        const result: EventSubscription[] = [];

        // Get specific subscriptions for this event type
        const subscriptionIds = this.typeToSubscriptions.get(eventType);
        if (subscriptionIds && subscriptionIds.size > 0) {
            for (const id of subscriptionIds) {
                const subscription = this.subscriptions.get(id);
                if (subscription) {
                    result.push(subscription);
                }
            }
        }

        // Add all wildcard subscriptions
        if (this.wildcardSubscriptions.size > 0) {
            for (const id of this.wildcardSubscriptions) {
                const subscription = this.subscriptions.get(id);
                if (subscription) {
                    result.push(subscription);
                }
            }
        }

        return result;
    }

    /**
     * Route an event to all subscribers
     */
    async routeEvent(event: DomainEvent): Promise<void> {
        const subscriptions = this.getSubscriptionsForType(event.type);

        // Process all subscriptions in parallel
        await Promise.all(
            subscriptions.map(subscription =>
                this.executeHandler(event, subscription)
            )
        );
    }

    /**
     * Execute a handler with retry logic
     */
    private async executeHandler(
        event: DomainEvent,
        subscription: EventSubscription
    ): Promise<void> {
        let attempt = 1;
        let shouldRetry = false;

        do {
            try {
                await subscription.handler(event);
                return; // Success, exit retry loop
            } catch (error) {
                // Handle error and determine if we should retry
                shouldRetry = await subscription.options.errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    event,
                    attempt,
                    subscription
                );

                if (shouldRetry) {
                    // Calculate backoff delay based on strategy
                    const delay = this.calculateBackoffDelay(
                        attempt,
                        subscription.options.backoffStrategy,
                        subscription.options.backoffDelay
                    );

                    // Wait before retrying
                    await this.delay(delay);
                    attempt++;
                }
            }
        } while (shouldRetry && attempt <= subscription.options.maxRetries);
    }

    /**
     * Calculate backoff delay based on strategy
     */
    private calculateBackoffDelay(
        attempt: number,
        strategy: BackoffStrategy,
        baseDelay: number
    ): number {
        switch (strategy) {
            case 'fixed':
                return baseDelay;

            case 'linear':
                return baseDelay * attempt;

            case 'exponential':
            default:
                return baseDelay * Math.pow(2, attempt - 1);
        }
    }

    /**
     * Helper function to delay execution
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 
