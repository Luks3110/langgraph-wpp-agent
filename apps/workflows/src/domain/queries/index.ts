export type WorkflowStatus = 'draft' | 'published' | 'archived';
export type WebhookStatus = 'active' | 'inactive' | 'error';

export interface WorkflowDefinitionQuery {
    id: string;
    name: string;
    description?: string;
    tenantId: string;
    status: WorkflowStatus;
    nodes: WorkflowNodeQuery[];
    edges: WorkflowEdgeQuery[];
    metadata: {
        createdAt: string;
        updatedAt: string;
        createdBy: string;
        tags: string[];
        executionCount: number;
        lastExecuted?: string;
    };
}

export interface WorkflowNodeQuery {
    id: string;
    type: string;
    name: string;
    config?: Record<string, any>;
    position?: { x: number; y: number };
    executionStats?: {
        totalExecutions: number;
        successRate: number;
        averageDuration: number;
    };
}

export interface WorkflowEdgeQuery {
    source: string;
    target: string;
    condition?: string;
    executionCount?: number;
}

export interface WebhookDefinitionQuery {
    id: string;
    name: string;
    workflowId: string;
    nodeId: string;
    tenantId: string;
    provider: string;
    endpoint: string;
    status: WebhookStatus;
    stats: {
        totalCalls: number;
        successfulCalls: number;
        lastCalledAt?: string;
    };
}

export interface WorkflowExecutionQuery {
    id: string;
    workflowId: string;
    status: 'running' | 'completed' | 'failed';
    startedAt: string;
    completedAt?: string;
    duration?: number;
    nodes: {
        id: string;
        status: 'pending' | 'running' | 'completed' | 'failed';
        startedAt?: string;
        completedAt?: string;
    }[];
}

export interface NodeExecutionQuery {
    id: string;
    nodeId: string;
    workflowExecutionId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: string;
    completedAt?: string;
    input: any;
    output?: any;
    error?: string;
}

export interface WebhookEventQuery {
    id: string;
    webhookId: string;
    receivedAt: string;
    payload: any;
    status: 'received' | 'processed' | 'failed';
    processingTime?: number;
    error?: string;
} 
