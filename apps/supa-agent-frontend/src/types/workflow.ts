/**
 * Workflow types aligned with the workflow engine architecture
 */

// Base workflow engine types
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  trigger: TriggerStep;
  steps: Record<string, ActionStep>;
}

export interface BaseStep {
  name: string;
  displayName: string;
  nextAction?: string;
  settings: Record<string, any>;
}

export interface TriggerStep extends BaseStep {
  type: "TRIGGER";
  triggerType: string;
}

export interface ActionStep extends BaseStep {
  type: "ACTION";
  actionType: string;
}

// Workflow status types
export type WorkflowStatus = "active" | "inactive" | "archived";

// Workflow metadata for database storage
export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Complete workflow with metadata
export interface Workflow extends WorkflowMetadata {
  definition: WorkflowDefinition;
}

// Workflow execution types
export interface WorkflowExecution {
  id: string;
  execution_id: string;
  workflow_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  trigger_payload?: any;
  step_results?: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// API response types
export interface WorkflowListResponse {
  data: Workflow[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface WorkflowExecutionListResponse {
  data: WorkflowExecution[];
  meta: {
    workflowId: string;
    total: number;
    limit: number;
    offset: number;
  };
}

// Frontend-specific types for the flow editor
export interface FlowWorkflow {
  id?: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  status?: WorkflowStatus;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  selected?: boolean;
  dragging?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
  animated?: boolean;
  selected?: boolean;
}

// Node type mappings for the workflow engine
export const NODE_TYPE_MAPPINGS = {
  // Triggers
  webhook: { engineType: "webhook", category: "trigger" },
  "webhook-trigger": { engineType: "webhook", category: "trigger" },
  schedule: { engineType: "schedule", category: "trigger" },
  manual: { engineType: "manual", category: "trigger" },

  // Actions
  http: { engineType: "http-request", category: "action" },
  transform: { engineType: "data-transformer", category: "action" },
  delay: { engineType: "delay", category: "action" },
  log: { engineType: "log", category: "action" },
  condition: { engineType: "condition", category: "action" },

  // Legacy node types (to be converted)
  character: { engineType: "data-transformer", category: "action" },
  knowledge: { engineType: "data-transformer", category: "action" },
  whatsapp: { engineType: "http-request", category: "action" },
  instagram: { engineType: "http-request", category: "action" },
  mercadolivreQa: { engineType: "http-request", category: "action" }
} as const;

export type NodeTypeKey = keyof typeof NODE_TYPE_MAPPINGS;

// Workflow creation/update payloads
export interface WorkflowCreatePayload {
  name: string;
  description?: string;
  definition: Omit<WorkflowDefinition, "id">;
}

export interface WorkflowUpdatePayload extends Partial<WorkflowCreatePayload> {
  status?: WorkflowStatus;
}
