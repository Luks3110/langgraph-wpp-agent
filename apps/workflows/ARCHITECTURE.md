# Workflow Engine Architecture

## Overview

This document outlines the architecture of our workflow engine, inspired by [ActivePieces](https://github.com/activepieces/activepieces) but simplified for our specific use case. The engine provides a generic, extensible system for creating and executing workflows with custom nodes.

## Architecture Components

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Workflow      │    │     Engine      │    │     Nodes       │
│   Definition    │────│   Executor      │────│   Registry      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flow State    │    │   Execution     │    │   Node Types    │
│   Manager       │    │   Context       │    │   (Triggers,    │
│                 │    │                 │    │   Actions)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1. Workflow Definition

The workflow definition is a JSON structure that describes the flow of execution, similar to ActivePieces' flow format.

```typescript
// types/workflow.ts
export interface WorkflowDefinition {
  id: string;
  name: string;
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
  triggerType: string; // 'webhook', 'schedule', 'manual'
}

export interface ActionStep extends BaseStep {
  type: "ACTION";
  actionType: string; // 'http', 'transform', 'condition'
}
```

### 2. Engine Executor

The core execution engine processes workflows step by step, managing state and context.

```typescript
// engine/executor.ts
import { WorkflowDefinition, ExecutionContext, StepResult } from "../types";
import { NodeRegistry } from "./node-registry";

export class WorkflowExecutor {
  private nodeRegistry: NodeRegistry;

  constructor(nodeRegistry: NodeRegistry) {
    this.nodeRegistry = nodeRegistry;
  }

  async execute(
    workflow: WorkflowDefinition,
    triggerPayload: any = {}
  ): Promise<ExecutionResult> {
    const context = this.createExecutionContext(workflow, triggerPayload);

    try {
      // Execute trigger
      const triggerResult = await this.executeTrigger(
        workflow.trigger,
        context
      );
      context.addStepResult(workflow.trigger.name, triggerResult);

      // Execute steps in sequence
      let currentStep = workflow.trigger.nextAction;
      while (currentStep) {
        const step = workflow.steps[currentStep];
        if (!step) break;

        const stepResult = await this.executeStep(step, context);
        context.addStepResult(step.name, stepResult);

        // Handle conditional flow
        currentStep = this.getNextStep(step, stepResult);
      }

      return {
        success: true,
        executionId: context.executionId,
        results: context.getResults()
      };
    } catch (error) {
      return {
        success: false,
        executionId: context.executionId,
        error: error.message,
        results: context.getResults()
      };
    }
  }

  private async executeTrigger(
    trigger: TriggerStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const triggerNode = this.nodeRegistry.getTrigger(trigger.triggerType);
    if (!triggerNode) {
      throw new Error(`Trigger type ${trigger.triggerType} not found`);
    }

    return await triggerNode.execute(trigger.settings, context);
  }

  private async executeStep(
    step: ActionStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const actionNode = this.nodeRegistry.getAction(step.actionType);
    if (!actionNode) {
      throw new Error(`Action type ${step.actionType} not found`);
    }

    return await actionNode.execute(step.settings, context);
  }

  private getNextStep(
    step: ActionStep,
    result: StepResult
  ): string | undefined {
    // Handle conditional branching based on step result
    if (result.success && step.nextAction) {
      return step.nextAction;
    }
    return undefined;
  }

  private createExecutionContext(
    workflow: WorkflowDefinition,
    triggerPayload: any
  ): ExecutionContext {
    return new ExecutionContext({
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: workflow.id,
      triggerPayload,
      stepResults: new Map()
    });
  }
}
```

### 3. Node Registry

A registry system for managing different types of nodes (triggers and actions).

```typescript
// engine/node-registry.ts
import { TriggerNode, ActionNode } from "../types";

export class NodeRegistry {
  private triggers = new Map<string, TriggerNode>();
  private actions = new Map<string, ActionNode>();

  registerTrigger(type: string, node: TriggerNode): void {
    this.triggers.set(type, node);
  }

  registerAction(type: string, node: ActionNode): void {
    this.actions.set(type, node);
  }

  getTrigger(type: string): TriggerNode | undefined {
    return this.triggers.get(type);
  }

  getAction(type: string): ActionNode | undefined {
    return this.actions.get(type);
  }

  listTriggers(): string[] {
    return Array.from(this.triggers.keys());
  }

  listActions(): string[] {
    return Array.from(this.actions.keys());
  }
}
```

### 4. Execution Context

Manages the state and data flow throughout workflow execution.

```typescript
// engine/execution-context.ts
export class ExecutionContext {
  public readonly executionId: string;
  public readonly workflowId: string;
  public readonly triggerPayload: any;
  private stepResults: Map<string, StepResult>;

  constructor(params: {
    executionId: string;
    workflowId: string;
    triggerPayload: any;
    stepResults: Map<string, StepResult>;
  }) {
    this.executionId = params.executionId;
    this.workflowId = params.workflowId;
    this.triggerPayload = params.triggerPayload;
    this.stepResults = params.stepResults;
  }

  addStepResult(stepName: string, result: StepResult): void {
    this.stepResults.set(stepName, result);
  }

  getStepResult(stepName: string): StepResult | undefined {
    return this.stepResults.get(stepName);
  }

  getResults(): Record<string, StepResult> {
    return Object.fromEntries(this.stepResults);
  }

  // Helper method to resolve dynamic values in step settings
  resolveValue(value: any): any {
    if (
      typeof value === "string" &&
      value.startsWith("{{") &&
      value.endsWith("}}")
    ) {
      const expression = value.slice(2, -2).trim();
      return this.evaluateExpression(expression);
    }
    return value;
  }

  private evaluateExpression(expression: string): any {
    // Simple expression evaluation - can be extended
    if (expression.startsWith("trigger.")) {
      const path = expression.replace("trigger.", "");
      return this.getNestedValue(this.triggerPayload, path);
    }

    if (expression.includes(".output")) {
      const [stepName, ...pathParts] = expression.split(".");
      const stepResult = this.getStepResult(stepName);
      if (stepResult && pathParts.length > 1) {
        return this.getNestedValue(
          stepResult.output,
          pathParts.slice(1).join(".")
        );
      }
      return stepResult?.output;
    }

    return expression;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
}
```

### 5. Node Types and Interfaces

Base interfaces for creating custom nodes.

```typescript
// types/nodes.ts
export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  results: Record<string, StepResult>;
  error?: string;
}

export interface BaseNode {
  name: string;
  displayName: string;
  description: string;
  version: string;
}

export interface TriggerNode extends BaseNode {
  execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult>;
  onEnable?(settings: Record<string, any>): Promise<void>;
  onDisable?(settings: Record<string, any>): Promise<void>;
}

export interface ActionNode extends BaseNode {
  execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult>;
  test?(settings: Record<string, any>): Promise<StepResult>;
}
```

## Node Implementation Examples

### Example Trigger: Webhook Trigger

```typescript
// nodes/triggers/webhook-trigger.ts
import { TriggerNode, ExecutionContext, StepResult } from "../../types";

export class WebhookTrigger implements TriggerNode {
  name = "webhook";
  displayName = "Webhook Trigger";
  description = "Triggers when a webhook is called";
  version = "1.0.0";

  async execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult> {
    // In a real implementation, this would be handled by a webhook server
    return {
      success: true,
      output: context.triggerPayload,
      metadata: {
        timestamp: new Date().toISOString(),
        webhookUrl: settings.webhookUrl
      }
    };
  }

  async onEnable(settings: Record<string, any>): Promise<void> {
    // Register webhook endpoint
    console.log(`Webhook enabled: ${settings.webhookUrl}`);
  }

  async onDisable(settings: Record<string, any>): Promise<void> {
    // Unregister webhook endpoint
    console.log(`Webhook disabled: ${settings.webhookUrl}`);
  }
}
```

### Example Action: HTTP Request

```typescript
// nodes/actions/http-request.ts
import { ActionNode, ExecutionContext, StepResult } from "../../types";

export class HttpRequestAction implements ActionNode {
  name = "http-request";
  displayName = "HTTP Request";
  description = "Makes an HTTP request to a specified URL";
  version = "1.0.0";

  async execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult> {
    try {
      const url = context.resolveValue(settings.url);
      const method = settings.method || "GET";
      const headers = settings.headers || {};
      const body = settings.body
        ? context.resolveValue(settings.body)
        : undefined;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const responseData = await response.json();

      return {
        success: response.ok,
        output: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData
        },
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: null
      };
    }
  }

  async test(settings: Record<string, any>): Promise<StepResult> {
    // Test the HTTP request with sample data
    return this.execute(settings, {
      resolveValue: (value) => value // Simple resolver for testing
    } as ExecutionContext);
  }
}
```

### Example Action: Data Transformer

```typescript
// nodes/actions/data-transformer.ts
import { ActionNode, ExecutionContext, StepResult } from "../../types";

export class DataTransformerAction implements ActionNode {
  name = "data-transformer";
  displayName = "Data Transformer";
  description = "Transforms data using JavaScript expressions";
  version = "1.0.0";

  async execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult> {
    try {
      const inputData = context.resolveValue(settings.inputData);
      const transformScript = settings.transformScript;

      // Simple transformation using Function constructor
      // In production, consider using a safer sandbox like vm2
      const transformFunction = new Function(
        "data",
        "context",
        transformScript
      );
      const result = transformFunction(inputData, {
        trigger: context.triggerPayload,
        steps: context.getResults()
      });

      return {
        success: true,
        output: result,
        metadata: {
          inputType: typeof inputData,
          outputType: typeof result
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Transformation error: ${error.message}`,
        output: null
      };
    }
  }
}
```

## Usage Example

### Setting up the Workflow Engine

```typescript
// main.ts
import { WorkflowExecutor } from "./engine/executor";
import { NodeRegistry } from "./engine/node-registry";
import { WebhookTrigger } from "./nodes/triggers/webhook-trigger";
import { HttpRequestAction } from "./nodes/actions/http-request";
import { DataTransformerAction } from "./nodes/actions/data-transformer";

// Initialize the engine
const nodeRegistry = new NodeRegistry();
const executor = new WorkflowExecutor(nodeRegistry);

// Register nodes
nodeRegistry.registerTrigger("webhook", new WebhookTrigger());
nodeRegistry.registerAction("http-request", new HttpRequestAction());
nodeRegistry.registerAction("data-transformer", new DataTransformerAction());

// Example workflow definition
const sampleWorkflow = {
  id: "sample-workflow",
  name: "Sample API Integration",
  version: 1,
  trigger: {
    name: "webhook-trigger",
    displayName: "Webhook Trigger",
    type: "TRIGGER" as const,
    triggerType: "webhook",
    nextAction: "transform-data",
    settings: {
      webhookUrl: "/webhook/sample"
    }
  },
  steps: {
    "transform-data": {
      name: "transform-data",
      displayName: "Transform Data",
      type: "ACTION" as const,
      actionType: "data-transformer",
      nextAction: "send-request",
      settings: {
        inputData: "{{trigger.body}}",
        transformScript:
          "return { processedData: data.rawData.toUpperCase(), timestamp: new Date().toISOString() };"
      }
    },
    "send-request": {
      name: "send-request",
      displayName: "Send HTTP Request",
      type: "ACTION" as const,
      actionType: "http-request",
      settings: {
        url: "https://api.example.com/data",
        method: "POST",
        body: "{{transform-data.output}}"
      }
    }
  }
};

// Execute workflow
async function runWorkflow() {
  const triggerPayload = {
    body: { rawData: "hello world" },
    headers: { "content-type": "application/json" }
  };

  const result = await executor.execute(sampleWorkflow, triggerPayload);
  console.log("Execution Result:", JSON.stringify(result, null, 2));
}

runWorkflow().catch(console.error);
```

## Key Features

### 1. **Generic & Extensible**

- Simple interface for creating new node types
- Plugin-based architecture for easy extension
- Type-safe implementation with TypeScript

### 2. **Easy Node Creation**

- Minimal boilerplate required for new nodes
- Clear separation between triggers and actions
- Built-in context and data resolution

### 3. **Dynamic Data Flow**

- Expression-based data binding (`{{step.output.field}}`)
- Context-aware execution with step result access
- Flexible parameter resolution

### 4. **Error Handling**

- Comprehensive error capture and reporting
- Step-level error isolation
- Execution context preservation

### 5. **Testing Support**

- Built-in test methods for nodes
- Isolated execution context for testing
- Easy mocking and validation

## Extending the Engine

### Adding a New Action Node

```typescript
// nodes/actions/my-custom-action.ts
import { ActionNode, ExecutionContext, StepResult } from "../../types";

export class MyCustomAction implements ActionNode {
  name = "my-custom-action";
  displayName = "My Custom Action";
  description = "Does something custom";
  version = "1.0.0";

  async execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult> {
    // Your custom logic here
    const input = context.resolveValue(settings.input);

    try {
      // Process the input
      const result = await this.processData(input);

      return {
        success: true,
        output: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: null
      };
    }
  }

  private async processData(input: any): Promise<any> {
    // Your processing logic
    return { processed: input };
  }
}

// Register the new action
nodeRegistry.registerAction("my-custom-action", new MyCustomAction());
```

## Future Enhancements

1. **Conditional Branching**: Add support for if/else logic in workflows
2. **Loops**: Implement for-each and while loop constructs
3. **Error Handling**: Add try/catch blocks and retry mechanisms
4. **Parallel Execution**: Support for concurrent step execution
5. **Workflow Templates**: Pre-built workflow templates for common use cases
6. **Visual Editor**: Web-based drag-and-drop workflow designer
7. **Monitoring**: Execution logging, metrics, and debugging tools

This architecture provides a solid foundation for a workflow engine that's both powerful and easy to extend, taking inspiration from [ActivePieces](https://github.com/activepieces/activepieces) while remaining focused on your specific needs.

```

This architecture document provides:

1. **Complete architecture overview** with diagrams and component descriptions
2. **Real code examples** adapted from ActivePieces patterns but simplified for your use case
3. **Generic, extensible design** that makes it easy to add new nodes
4. **TypeScript implementation** with proper type safety
5. **Practical examples** showing how to create triggers, actions, and workflows
6. **Clear separation of concerns** between different components
7. **Usage examples** demonstrating how to set up and run the engine

The design is inspired by ActivePieces' architecture but streamlined to focus on the core workflow execution capabilities you need, making it easy to iterate and add new node types as your requirements evolve.
```
