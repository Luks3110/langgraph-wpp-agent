import { Edge, Node } from '@xyflow/react';

// Define the valid node types
export type NodeTypeOptions =
    | "character"
    | "knowledge"
    | "testing"
    | "deployment"
    | "mercadolivreQa"
    | "whatsapp"
    | "instagram"
    | "webhook";

// Node data type definitions
export interface CharacterData {
    name: string;
    personality: string;
    [key: string]: unknown;
}

export interface KnowledgeData {
    domain: string;
    sources: string;
    [key: string]: unknown;
}

export interface TestingData {
    testCases: string;
    status: string;
    [key: string]: unknown;
}

export interface DeploymentData {
    environment: string;
    status: string;
    [key: string]: unknown;
}

export interface MercadoLivreQAData {
    apiConfigured: boolean;
    rulesCount: number;
    defaultResponseSet: boolean;
    responseDelay: string;
    workflowId: string;
    userId: string;
    [key: string]: unknown;
}

export interface WhatsAppData {
    apiConfigured: boolean;
    phoneNumberConfigured: boolean;
    messageTemplatesCount: number;
    autoReplyEnabled: boolean;
    responseDelay: string;
    workflowId: string;
    userId: string;
    [key: string]: unknown;
}

export interface InstagramData {
    name: string;
    apiConfigured: boolean;
    accessToken: string;
    igBusinessId: string;
    webhookVerifyToken: string;
    webhookSecret: string;
    messageEvents: string[];
    reactionEvents: boolean;
    postbackEvents: boolean;
    seenEvents: boolean;
    referralEvents: boolean;
    [key: string]: unknown;
}

export interface WebhookData {
    name: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    payload: string;
    timeout: number;
    retryCount: number;
    [key: string]: unknown;
}

// Node type definitions
export type CharacterNode = Node<CharacterData, "character">;
export type KnowledgeNode = Node<KnowledgeData, "knowledge">;
export type TestingNode = Node<TestingData, "testing">;
export type DeploymentNode = Node<DeploymentData, "deployment">;
export type MercadoLivreQANode = Node<MercadoLivreQAData, "mercadolivreQa"> & {
    configComponent?: React.ReactNode;
};
export type WhatsAppNode = Node<WhatsAppData, "whatsapp"> & {
    configComponent?: React.ReactNode;
};
export type InstagramNode = Node<InstagramData, "instagram"> & {
    configComponent?: React.ReactNode;
};
export type WebhookNode = Node<WebhookData, "webhook"> & {
    configComponent?: React.ReactNode;
};

// Combined Flow Node type
export type FlowNode =
    | CharacterNode
    | KnowledgeNode
    | TestingNode
    | DeploymentNode
    | MercadoLivreQANode
    | WhatsAppNode
    | InstagramNode
    | WebhookNode;

// Workflow processing types
export type NodeType = NodeTypeOptions;

export interface NodeMetadata {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    status: string;
    [key: string]: unknown;
}

export interface WorkflowNode {
    id: string;
    type: NodeType;
    name: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
    metadata: NodeMetadata;
    version: number;
    workflowId: string;
}

// Edge type
export interface WorkflowEdge extends Edge {
    condition?: string;
}

// Node category item definition
export interface NodeCategoryItem {
    type: NodeTypeOptions;
    label: string;
    description: string;
    icon: string;
    color: "blue" | "purple" | "green" | "amber";
}

// Node category definition
export interface NodeCategory {
    title: string;
    nodes: NodeCategoryItem[];
}

// Agent workflow types
export interface WorkflowMetadata {
    tags: string[];
    author: string;
    runCount: number;
    environment: string;
    [key: string]: unknown;
}

export interface AgentWorkflow {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    status: string;
    version: string;
    workflow: any; // This would ideally be a more specific type
    metadata: WorkflowMetadata;
} 
