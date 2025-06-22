/**
 * Workflow Engine Entry Point
 */

// Core engine exports
export * from "./types/index.js";
export { WorkflowExecutor } from "./engine/index.js";
export * from "./utils/validation.js";
export * from "./utils/logger.js";

// Import main classes for function
import {
  WorkflowExecutor,
  NodeRegistry,
  ExecutionContext
} from "./engine/index.js";

/**
 * Create a basic workflow engine instance
 */
export function createWorkflowEngine() {
  const nodeRegistry = new NodeRegistry();
  const executor = new WorkflowExecutor(nodeRegistry);

  return {
    registry: nodeRegistry,
    executor,

    // Convenience methods
    registerTrigger: nodeRegistry.registerTrigger.bind(nodeRegistry),
    registerAction: nodeRegistry.registerAction.bind(nodeRegistry),
    execute: executor.execute.bind(executor),
    validateWorkflow: executor.validateWorkflow.bind(executor),
    testStep: executor.testStep.bind(executor)
  };
}

console.log("Workflow Engine initialized");
