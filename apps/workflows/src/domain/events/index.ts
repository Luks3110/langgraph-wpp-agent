import { TriggerMetadata } from '../commands/index';

export interface DomainEvent {
    id: string;
    type: string;
    timestamp: string;
    tenantId: string;
    payload: any;
    metadata?: {
        jobId?: string;
        workflowId?: string;
        [key: string]: any;
    };
}

export interface WorkflowNodeTriggeredEvent extends DomainEvent {
    type: 'workflow.node.triggered';
    payload: {
        workflowId: string;
        nodeId: string;
        triggerId: string;
        input: any;
        metadata: TriggerMetadata;
    };
}

export interface WebhookReceivedEvent extends DomainEvent {
    type: 'webhook.received';
    payload: {
        webhookId: string;
        rawPayload: any;
        headers: Record<string, string>;
        receivedAt: string;
    };
}

export interface NodeExecutionCompletedEvent extends DomainEvent {
    type: 'node.execution.completed';
    payload: {
        nodeId: string;
        workflowExecutionId: string;
        executionId: string;
        output: any;
        duration: number;
    };
}

export interface NodeExecutionFailedEvent extends DomainEvent {
    type: 'node.execution.failed';
    payload: {
        nodeId: string;
        workflowExecutionId: string;
        executionId: string;
        error: string;
        duration: number;
    };
}

export interface WorkflowExecutionStartedEvent extends DomainEvent {
    type: 'workflow.execution.started';
    payload: {
        workflowId: string;
        executionId: string;
    };
}

export interface WorkflowExecutionCompletedEvent extends DomainEvent {
    type: 'workflow.execution.completed';
    payload: {
        workflowId: string;
        executionId: string;
        duration: number;
        output?: any;
    };
}

export interface WorkflowExecutionFailedEvent extends DomainEvent {
    type: 'workflow.execution.failed';
    payload: {
        workflowId: string;
        executionId: string;
        error: string;
        duration: number;
    };
} 
