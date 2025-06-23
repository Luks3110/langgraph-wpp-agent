import { Edge, Node } from "@xyflow/react";

// Define the valid node types (updated for workflow engine)
export type NodeTypeOptions =
  | "character"
  | "knowledge"
  | "testing"
  | "deployment"
  | "mercadolivreQa"
  | "whatsapp"
  | "instagram"
  | "webhook"
  | "webhook-trigger"
  // New workflow engine node types
  | "schedule"
  | "manual"
  | "http"
  | "transform"
  | "condition"
  | "delay"
  | "log";

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

export interface WebhookTriggerData {
  name: string;
  webhookId: string;
  description?: string;
  secretKey?: string;
  [key: string]: unknown;
}

// New workflow engine node data types
export interface ScheduleData {
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  [key: string]: unknown;
}

export interface ManualData {
  name: string;
  description: string;
  [key: string]: unknown;
}

export interface HttpData {
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timeout: number;
  [key: string]: unknown;
}

export interface TransformData {
  name: string;
  inputData: string;
  transformScript: string;
  [key: string]: unknown;
}

export interface ConditionData {
  name: string;
  condition: string;
  onTrue: string;
  onFalse: string;
  [key: string]: unknown;
}

export interface DelayData {
  name: string;
  duration: number;
  unit: "milliseconds" | "seconds" | "minutes" | "hours";
  [key: string]: unknown;
}

export interface LogData {
  name: string;
  message: string;
  level: "debug" | "info" | "warn" | "error";
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
export type WebhookTriggerNode = Node<WebhookTriggerData, "webhook-trigger"> & {
  configComponent?: React.ReactNode;
};

// New workflow engine node type definitions
export type ScheduleNode = Node<ScheduleData, "schedule"> & {
  configComponent?: React.ReactNode;
};
export type ManualNode = Node<ManualData, "manual"> & {
  configComponent?: React.ReactNode;
};
export type HttpNode = Node<HttpData, "http"> & {
  configComponent?: React.ReactNode;
};
export type TransformNode = Node<TransformData, "transform"> & {
  configComponent?: React.ReactNode;
};
export type ConditionNode = Node<ConditionData, "condition"> & {
  configComponent?: React.ReactNode;
};
export type DelayNode = Node<DelayData, "delay"> & {
  configComponent?: React.ReactNode;
};
export type LogNode = Node<LogData, "log"> & {
  configComponent?: React.ReactNode;
};

// Combined Flow Node type (updated)
export type FlowNode =
  | CharacterNode
  | KnowledgeNode
  | TestingNode
  | DeploymentNode
  | MercadoLivreQANode
  | WhatsAppNode
  | InstagramNode
  | WebhookNode
  | WebhookTriggerNode
  | ScheduleNode
  | ManualNode
  | HttpNode
  | TransformNode
  | ConditionNode
  | DelayNode
  | LogNode;

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
