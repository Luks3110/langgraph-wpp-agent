import { DomainEvent } from '../../domain/events/index';
import { EventEntity, EventStoreRepository } from '../repositories/eventStoreRepository';

export interface EventStore {
    saveEvent(event: DomainEvent): Promise<void>;
    getEventsByType(eventType: string, limit?: number): Promise<DomainEvent[]>;
    getEventsByTenantId(tenantId: string): Promise<DomainEvent[]>;
    getEventsInTimeRange(startTime: Date, endTime: Date): Promise<DomainEvent[]>;
    replayEvents(
        startTime: Date,
        endTime: Date,
        handler: (event: DomainEvent) => Promise<void>,
        batchSize?: number
    ): Promise<number>;
    getEventsByWorkflowId(workflowId: string): Promise<DomainEvent[]>;
}

export class PersistentEventStore implements EventStore {
    constructor(private readonly repository: EventStoreRepository) { }

    /**
     * Save an event to the store
     */
    async saveEvent(event: DomainEvent): Promise<void> {
        await this.repository.persistEvent(event);
    }

    /**
     * Get events by type
     */
    async getEventsByType(eventType: string, limit = 100): Promise<DomainEvent[]> {
        const entities = await this.repository.getEventsByType(eventType, limit);
        return entities.map(this.mapToDomainEvent);
    }

    /**
     * Get events by tenant ID
     */
    async getEventsByTenantId(tenantId: string): Promise<DomainEvent[]> {
        const entities = await this.repository.getEventsByTenantId(tenantId);
        return entities.map(this.mapToDomainEvent);
    }

    /**
     * Get events within a time range
     */
    async getEventsInTimeRange(startTime: Date, endTime: Date): Promise<DomainEvent[]> {
        const entities = await this.repository.getEventsInTimeRange(startTime, endTime);
        return entities.map(this.mapToDomainEvent);
    }

    /**
     * Replay events in chronological order
     * Returns the number of events processed
     */
    async replayEvents(
        startTime: Date,
        endTime: Date,
        handler: (event: DomainEvent) => Promise<void>,
        batchSize = 100
    ): Promise<number> {
        let processedCount = 0;
        let currentStartTime = new Date(startTime);
        let hasMoreEvents = true;

        // Process in batches to avoid memory issues with large event sets
        while (hasMoreEvents) {
            const entities = await this.getBatchOfEvents(currentStartTime, endTime, batchSize);

            if (entities.length === 0) {
                hasMoreEvents = false;
                break;
            }

            // Process events in order
            for (const entity of entities) {
                const event = this.mapToDomainEvent(entity);
                await handler(event);
                processedCount++;

                // Update the timestamp for the next batch
                const eventTimestamp = new Date(entity.timestamp);
                if (eventTimestamp > currentStartTime) {
                    currentStartTime = new Date(eventTimestamp.getTime() + 1); // Add 1ms to avoid duplicates
                }
            }

            // If we got fewer than the batch size, we're at the end
            if (entities.length < batchSize) {
                hasMoreEvents = false;
            }
        }

        return processedCount;
    }

    /**
     * Get a batch of events for replay
     */
    private async getBatchOfEvents(
        startTime: Date,
        endTime: Date,
        limit: number
    ): Promise<EventEntity[]> {
        // This is a simplified implementation - in a real system, you would
        // use a more complex query with pagination tokens.
        const events = await this.repository.getEventsInTimeRange(startTime, endTime);
        return events
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(0, limit);
    }

    /**
     * Map from event entity to domain event
     */
    private mapToDomainEvent(entity: EventEntity): DomainEvent {
        // Create metadata object if we have job_id or workflow_id
        const metadata: Record<string, any> = {};

        if (entity.job_id) {
            metadata.jobId = entity.job_id;
        }

        if (entity.workflow_id) {
            metadata.workflowId = entity.workflow_id;
        }

        return {
            id: entity.id,
            type: entity.event_type,
            timestamp: entity.timestamp,
            tenantId: entity.tenant_id,
            payload: entity.payload,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        };
    }

    /**
     * Get events by workflow ID
     */
    async getEventsByWorkflowId(workflowId: string): Promise<DomainEvent[]> {
        const entities = await this.repository.getEventsByWorkflowId(workflowId);
        return entities.map(this.mapToDomainEvent);
    }
} 
