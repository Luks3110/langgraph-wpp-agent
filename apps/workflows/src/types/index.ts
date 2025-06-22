/**
 * Main types export file for the workflow engine
 */

// Workflow types
export type {
  WorkflowDefinition,
  BaseStep,
  TriggerStep,
  ActionStep,
  WorkflowStatus,
  WorkflowMetadata,
  Workflow,
  WorkflowValidationResult,
  WorkflowCreatePayload,
  WorkflowUpdatePayload
} from "./workflow.js";

// Execution types
export type {
  StepResult,
  ExecutionContext,
  ExecutionStatus,
  StepStatus,
  ExecutionMetadata,
  StepExecution,
  ExecutionResult,
  ExecutionStats,
  ExecutionEvent
} from "./execution.js";

// Node types
export type {
  BaseNode,
  NodeSchema,
  NodeProperty,
  TriggerNode,
  ActionNode,
  RegisteredNode,
  NodeExecutionOptions,
  NodeTestResult,
  NodeType,
  NodeCategory
} from "./nodes.js";

export { NODE_CATEGORIES } from "./nodes.js";
