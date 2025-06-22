/**
 * Core workflow definition types
 */

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

/**
 * Workflow status types
 */
export type WorkflowStatus = "active" | "inactive" | "archived";

/**
 * Workflow metadata for database storage
 */
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

/**
 * Complete workflow with metadata
 */
export interface Workflow extends WorkflowMetadata {
  definition: WorkflowDefinition;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Workflow creation/update payload
 */
export interface WorkflowCreatePayload {
  name: string;
  description?: string;
  definition: Omit<WorkflowDefinition, "id">;
}

export interface WorkflowUpdatePayload extends Partial<WorkflowCreatePayload> {
  status?: WorkflowStatus;
}
