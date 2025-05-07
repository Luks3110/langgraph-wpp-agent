export interface WorkflowDefinitionCommand {
    name: string;
    description?: string;
    tenantId: string;
    nodes: WorkflowNodeCommand[];
    edges: WorkflowEdgeCommand[];
    tags?: string[];
}

export interface WorkflowNodeCommand {
    id: string;
    type: string;
    name: string;
    config?: Record<string, any>;
    position?: { x: number; y: number };
}

export interface WorkflowEdgeCommand {
    source: string;
    target: string;
    condition?: string;
}

export interface WebhookRegistrationCommand {
    name: string;
    workflowId: string;
    nodeId: string;
    tenantId: string;
    provider: string;
    config?: Record<string, any>;
}

export interface TriggerNodeCommand {
    nodeId: string;
    input: any;
    metadata: TriggerMetadata;
}

export interface TriggerMetadata {
    source: string;
    sourceType: string;
    actionType: string;
    customerId?: string;
    clientId: string;
    receivedAt: string;
} 
