import { SupabaseClient } from '@supabase/supabase-js';
import { DomainEvent } from '../../domain/events/index';
import { SupabaseConnection } from '../database/supabase';
import { Database } from '../database/supabase.types';

export interface EventEntity {
    id: string;
    event_type: string;
    tenant_id: string;
    payload: Record<string, any>;
    timestamp: string;
    created_at: string;
    sequence_number: number;
    job_id?: string;
    workflow_id?: string;
    status?: string;
}

export class EventStoreRepository {
    private client: SupabaseClient<Database>;
    private tableName = 'event_store' as const;

    constructor(connection?: SupabaseConnection) {
        this.client = connection
            ? connection.getClient()
            : SupabaseConnection.getInstance().getClient();
    }

    async persistEvent(event: DomainEvent): Promise<EventEntity> {
        const workflowId = this.extractWorkflowId(event);

        const eventEntity: Omit<EventEntity, 'created_at'> = {
            id: event.id,
            event_type: event.type,
            tenant_id: event.tenantId,
            payload: event.payload,
            timestamp: event.timestamp,
            sequence_number: await this.getNextSequenceNumber(this.getAggregateIdFromEvent(event)),
            workflow_id: workflowId,
            status: 'processed'
        };

        if (event.metadata?.jobId) {
            eventEntity.job_id = event.metadata.jobId;
        }

        const { data, error } = await this.client
            .from(this.tableName)
            .insert(eventEntity)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to persist event: ${error.message}`);
        }

        return data as EventEntity;
    }

    async getEventsByTenantId(tenantId: string): Promise<EventEntity[]> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('*')
            .eq('tenant_id', tenantId)
            .order('sequence_number', { ascending: true });

        if (error) {
            throw new Error(`Failed to get events for tenant ${tenantId}: ${error.message}`);
        }

        return data as EventEntity[];
    }

    async getEventsByType(eventType: string, limit = 100): Promise<EventEntity[]> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('*')
            .eq('event_type', eventType)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get events by type ${eventType}: ${error.message}`);
        }

        return data as EventEntity[];
    }

    async getEventsInTimeRange(startTime: Date, endTime: Date): Promise<EventEntity[]> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('*')
            .gte('timestamp', startTime.toISOString())
            .lte('timestamp', endTime.toISOString())
            .order('timestamp', { ascending: true });

        if (error) {
            throw new Error(`Failed to get events in time range: ${error.message}`);
        }

        return data as EventEntity[];
    }

    async getEventsByWorkflowId(workflowId: string): Promise<EventEntity[]> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('*')
            .eq('workflow_id', workflowId)
            .order('timestamp', { ascending: true });

        if (error) {
            throw new Error(`Failed to get events for workflow ${workflowId}: ${error.message}`);
        }

        return data as EventEntity[];
    }

    private getAggregateIdFromEvent(event: DomainEvent): string {
        switch (event.type) {
            case 'workflow.node.triggered':
                return (event.payload as any).workflowId;
            case 'webhook.received':
                return (event.payload as any).webhookId;
            case 'node.execution.completed':
            case 'node.execution.failed':
                return (event.payload as any).workflowExecutionId;
            case 'workflow.execution.completed':
                return (event.payload as any).workflowId;
            default:
                return event.id;
        }
    }

    private async getNextSequenceNumber(aggregateId: string): Promise<number> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('sequence_number')
            .eq('event_type', this.getEventTypeForAggregate(aggregateId))
            .order('sequence_number', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return 1;
            }
            throw new Error(`Failed to get next sequence number: ${error.message}`);
        }

        return (data.sequence_number as number) + 1;
    }

    private getEventTypeForAggregate(aggregateId: string): string {
        return '%';
    }

    private extractWorkflowId(event: DomainEvent): string | undefined {
        if (event.metadata?.workflowId) {
            return event.metadata.workflowId;
        }

        switch (event.type) {
            case 'workflow.node.triggered':
            case 'workflow.execution.completed':
                return (event.payload as any).workflowId;
            case 'node.execution.completed':
            case 'node.execution.failed':
                return (event.payload as any).workflowExecutionId?.split(':')[0];
            default:
                return undefined;
        }
    }
} 
