import { z } from 'zod';

// ========== Workflow Core Types ==========

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  config?: Record<string, any>;
  position?: {
    x: number;
    y: number;
  };
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  tenantId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  tags?: string[];
  status?: 'draft' | 'active' | 'inactive';
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ========== Workflow Execution Types ==========

export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  tenantId: string;
  status: WorkflowExecutionStatus;
  variables: Record<string, any>;
  context: Record<string, any>;
  currentNodes: string[];
  completedNodes: string[];
  failedNodes: string[];
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface NodeExecution {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  status: NodeExecutionStatus;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  errorMessage?: string;
  errorStack?: string;
  retryCount: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ========== Agent Configuration Types ==========

export interface AgentCharacter {
  name: string;
  description: string;
  personality: string[];
  responseStyle: string;
}

export interface AgentConfig {
  id?: string;
  name: string;
  model: string;
  character: AgentCharacter;
  maxTokens: number;
  temperature: number;
  createdAt?: string;
  updatedAt?: string;
}

// ========== Webhook Types ==========

export interface WebhookTrigger {
  id: string;
  workflowId: string;
  nodeId: string;
  webhookPath: string;
  webhookSecret?: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  channelId?: string;
  eventType: string;
  payload: Record<string, any>;
  receivedAt?: string;
}

// ========== Knowledge Collection Types ==========

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  companyId?: string;
  qdrantCollectionName: string;
  metadata: Record<string, any>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ========== Event Store Types ==========

export interface EventStoreEntry {
  id: string;
  workflowId?: string;
  tenantId: string;
  eventType: string;
  status?: string;
  payload: Record<string, any>;
  timestamp: string;
  sequenceNumber: number;
  jobId?: string;
  createdAt?: string;
}

// ========== Scheduled Event Types ==========

export interface ScheduledEvent {
  id: string;
  workflowId: string;
  nodeId: string;
  clientId: string;
  schedule?: Record<string, any>;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  status?: string;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

// ========== API Response Types ==========

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ========== Validation Schemas ==========

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1).max(100),
  config: z.record(z.any()).optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional()
});

export const workflowEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  condition: z.string().optional()
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tenantId: z.string().uuid(),
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema),
  tags: z.array(z.string()).optional()
});

export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  id: z.string().uuid().optional()
});

export const triggerNodeSchema = z.object({
  nodeId: z.string().min(1),
  input: z.record(z.any()),
  metadata: z.object({
    source: z.string(),
    sourceType: z.string(),
    actionType: z.string().optional(),
    customerId: z.string().optional(),
    clientId: z.string().optional(),
    receivedAt: z.string().datetime()
  })
});

export const webhookRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  workflowId: z.string().uuid(),
  nodeId: z.string().min(1),
  provider: z.enum(['instagram', 'facebook', 'twitter', 'whatsapp', 'custom']),
  config: z.record(z.any()).optional(),
  tenantId: z.string().uuid()
});

export const processWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  payload: z.record(z.any()),
  headers: z.record(z.string()).optional()
});

// ========== Type Guards ==========

export function isWorkflowNode(obj: any): obj is WorkflowNode {
  return obj && typeof obj.id === 'string' && typeof obj.type === 'string' && typeof obj.name === 'string';
}

export function isWorkflowEdge(obj: any): obj is WorkflowEdge {
  return obj && typeof obj.source === 'string' && typeof obj.target === 'string';
}

export function isWorkflowDefinition(obj: any): obj is WorkflowDefinition {
  return obj && 
    typeof obj.name === 'string' && 
    typeof obj.tenantId === 'string' &&
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.edges);
}

// Types are exported via interface and type declarations above