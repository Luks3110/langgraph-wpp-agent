/**
 * Node types and interfaces for workflow triggers and actions
 */

import type { ExecutionContext, StepResult } from "./execution.js";

/**
 * Base node interface
 */
export interface BaseNode {
  name: string;
  displayName: string;
  description: string;
  version: string;
  category?: string;
  tags?: string[];
  icon?: string;
}

/**
 * Node configuration schema
 */
export interface NodeSchema {
  properties: Record<string, NodeProperty>;
  required?: string[];
}

export interface NodeProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  title: string;
  description?: string;
  default?: any;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  items?: NodeProperty;
  properties?: Record<string, NodeProperty>;
}

/**
 * Trigger node interface
 */
export interface TriggerNode extends BaseNode {
  execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult>;

  onEnable?(settings: Record<string, any>): Promise<void>;
  onDisable?(settings: Record<string, any>): Promise<void>;

  getSchema?(): NodeSchema;

  // For webhook triggers
  generateWebhookUrl?(settings: Record<string, any>): string;
}

/**
 * Action node interface
 */
export interface ActionNode extends BaseNode {
  execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult>;

  test?(settings: Record<string, any>): Promise<StepResult>;

  getSchema?(): NodeSchema;

  // For conditional nodes
  evaluateCondition?(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<boolean>;
}

/**
 * Node registry entry
 */
export interface RegisteredNode {
  node: TriggerNode | ActionNode;
  type: "trigger" | "action";
  registeredAt: Date;
}

/**
 * Node execution configuration
 */
export interface NodeExecutionOptions {
  timeout?: number; // Execution timeout in milliseconds
  retries?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in milliseconds
  continueOnError?: boolean; // Whether to continue execution if this node fails
}

/**
 * Node test result
 */
export interface NodeTestResult extends StepResult {
  testData?: any;
  validationErrors?: string[];
}

/**
 * Common node types
 */
export type NodeType =
  | "webhook"
  | "schedule"
  | "manual"
  | "http-request"
  | "data-transform"
  | "condition"
  | "delay"
  | "log"
  | "email"
  | "database"
  | "file"
  | "notification";

/**
 * Node category groupings
 */
export const NODE_CATEGORIES = {
  TRIGGERS: "triggers",
  ACTIONS: "actions",
  TRANSFORMATIONS: "transformations",
  CONDITIONS: "conditions",
  INTEGRATIONS: "integrations",
  UTILITIES: "utilities"
} as const;

export type NodeCategory =
  (typeof NODE_CATEGORIES)[keyof typeof NODE_CATEGORIES];
