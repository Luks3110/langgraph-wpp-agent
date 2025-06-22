/**
 * Execution context and result types
 */

export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
  duration?: number; // Execution time in milliseconds
}

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  triggerPayload: any;
  stepResults: Map<string, StepResult>;
  startTime: Date;
  variables?: Record<string, any>; // Global variables for the execution
}

/**
 * Execution status types
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Step execution status
 */
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/**
 * Execution metadata for database storage
 */
export interface ExecutionMetadata {
  id: string;
  workflowId: string;
  executionId: string;
  status: ExecutionStatus;
  triggerPayload?: any;
  stepResults?: Record<string, StepResult>;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

/**
 * Step execution details
 */
export interface StepExecution {
  id: string;
  executionId: string;
  stepName: string;
  stepType: "trigger" | "action";
  status: StepStatus;
  inputData?: any;
  outputData?: any;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  executionId: string;
  results: Record<string, StepResult>;
  error?: string;
  duration: number;
  completedSteps: number;
  totalSteps: number;
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  successRate: number;
}

/**
 * Real-time execution event
 */
export interface ExecutionEvent {
  executionId: string;
  stepName?: string;
  type:
    | "started"
    | "step_started"
    | "step_completed"
    | "step_failed"
    | "completed"
    | "failed";
  timestamp: Date;
  data?: any;
}
