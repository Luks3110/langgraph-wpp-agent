/**
 * Execution context implementation with expression evaluation
 */

import type {
  ExecutionContext as IExecutionContext,
  StepResult
} from "../types/execution.js";

export class ExecutionContext implements IExecutionContext {
  public readonly executionId: string;
  public readonly workflowId: string;
  public readonly triggerPayload: any;
  public readonly startTime: Date;
  public readonly stepResults: Map<string, StepResult>;
  public readonly variables: Record<string, any>;

  constructor(params: {
    executionId: string;
    workflowId: string;
    triggerPayload: any;
    variables?: Record<string, any>;
  }) {
    this.executionId = params.executionId;
    this.workflowId = params.workflowId;
    this.triggerPayload = params.triggerPayload;
    this.startTime = new Date();
    this.stepResults = new Map();
    this.variables = params.variables || {};
  }

  /**
   * Add a step result to the context
   */
  addStepResult(stepName: string, result: StepResult): void {
    this.stepResults.set(stepName, result);
  }

  /**
   * Get a step result by name
   */
  getStepResult(stepName: string): StepResult | undefined {
    return this.stepResults.get(stepName);
  }

  /**
   * Get all step results as a plain object
   */
  getResults(): Record<string, StepResult> {
    return Object.fromEntries(this.stepResults);
  }

  /**
   * Set a global variable
   */
  setVariable(key: string, value: any): void {
    this.variables[key] = value;
  }

  /**
   * Get a global variable
   */
  getVariable(key: string): any {
    return this.variables[key];
  }

  /**
   * Resolve dynamic values in step settings
   * Supports expressions like {{trigger.data}} or {{step1.output.result}}
   * Also supports mixed expressions like "Hello {{trigger.name}}"
   */
  resolveValue(value: any): any {
    if (typeof value === "string") {
      // Handle mixed expressions (text with embedded expressions)
      if (value.includes("{{") && value.includes("}}")) {
        let resolved = value;
        const expressionRegex = /\{\{([^}]+)\}\}/g;
        let match;

        while ((match = expressionRegex.exec(value)) !== null) {
          const fullExpression = match[0];
          const expressionContent = match[1].trim();
          const resolvedValue =
            this.evaluateExpressionFromContent(expressionContent);

          // Convert to string for replacement
          const stringValue =
            typeof resolvedValue === "object"
              ? JSON.stringify(resolvedValue)
              : String(resolvedValue);

          resolved = resolved.replace(fullExpression, stringValue);
        }

        return resolved;
      }

      // Handle pure expressions
      if (this.isExpression(value)) {
        return this.evaluateExpression(value);
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item));
    }

    if (value && typeof value === "object") {
      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveValue(val);
      }
      return resolved;
    }

    return value;
  }

  /**
   * Check if a string is an expression (wrapped in double curly braces)
   */
  private isExpression(value: string): boolean {
    return value.trim().startsWith("{{") && value.trim().endsWith("}}");
  }

  /**
   * Evaluate expression content (without the wrapping braces)
   */
  private evaluateExpressionFromContent(expressionContent: string): any {
    try {
      // Handle trigger references
      if (expressionContent.startsWith("trigger.")) {
        const path = expressionContent.replace("trigger.", "");
        return this.getNestedValue(this.triggerPayload, path);
      }

      // Handle variables references
      if (expressionContent.startsWith("vars.")) {
        const path = expressionContent.replace("vars.", "");
        return this.getNestedValue(this.variables, path);
      }

      // Handle step output references
      if (expressionContent.includes(".output")) {
        const [stepName, ...pathParts] = expressionContent.split(".");
        const stepResult = this.getStepResult(stepName);

        if (!stepResult) {
          console.warn(`Step result not found for: ${stepName}`);
          return undefined;
        }

        // If just accessing .output
        if (pathParts.length === 1 && pathParts[0] === "output") {
          return stepResult.output;
        }

        // If accessing nested path like step1.output.data.field
        if (pathParts.length > 1 && pathParts[0] === "output") {
          const outputPath = pathParts.slice(1).join(".");
          return this.getNestedValue(stepResult.output, outputPath);
        }
      }

      // Handle step metadata references
      if (expressionContent.includes(".metadata")) {
        const [stepName, ...pathParts] = expressionContent.split(".");
        const stepResult = this.getStepResult(stepName);

        if (!stepResult || !stepResult.metadata) {
          return undefined;
        }

        if (pathParts.length === 1 && pathParts[0] === "metadata") {
          return stepResult.metadata;
        }

        if (pathParts.length > 1 && pathParts[0] === "metadata") {
          const metadataPath = pathParts.slice(1).join(".");
          return this.getNestedValue(stepResult.metadata, metadataPath);
        }
      }

      // Handle simple step reference (returns entire step result)
      const stepResult = this.getStepResult(expressionContent);
      if (stepResult) {
        return stepResult;
      }

      // If no matches, return undefined
      console.warn(`Unable to resolve expression: ${expressionContent}`);
      return undefined;
    } catch (error) {
      console.error(
        `Error evaluating expression "${expressionContent}":`,
        error
      );
      return undefined;
    }
  }

  /**
   * Evaluate an expression and return the result
   */
  private evaluateExpression(expression: string): any {
    const cleanExpression = expression.trim().slice(2, -2).trim();

    try {
      // Handle trigger references
      if (cleanExpression.startsWith("trigger.")) {
        const path = cleanExpression.replace("trigger.", "");
        return this.getNestedValue(this.triggerPayload, path);
      }

      // Handle variables references
      if (cleanExpression.startsWith("vars.")) {
        const path = cleanExpression.replace("vars.", "");
        return this.getNestedValue(this.variables, path);
      }

      // Handle step output references
      if (cleanExpression.includes(".output")) {
        const [stepName, ...pathParts] = cleanExpression.split(".");
        const stepResult = this.getStepResult(stepName);

        if (!stepResult) {
          console.warn(`Step result not found for: ${stepName}`);
          return undefined;
        }

        // If just accessing .output
        if (pathParts.length === 1 && pathParts[0] === "output") {
          return stepResult.output;
        }

        // If accessing nested path like step1.output.data.field
        if (pathParts.length > 1 && pathParts[0] === "output") {
          const outputPath = pathParts.slice(1).join(".");
          return this.getNestedValue(stepResult.output, outputPath);
        }
      }

      // Handle step metadata references
      if (cleanExpression.includes(".metadata")) {
        const [stepName, ...pathParts] = cleanExpression.split(".");
        const stepResult = this.getStepResult(stepName);

        if (!stepResult || !stepResult.metadata) {
          return undefined;
        }

        if (pathParts.length === 1 && pathParts[0] === "metadata") {
          return stepResult.metadata;
        }

        if (pathParts.length > 1 && pathParts[0] === "metadata") {
          const metadataPath = pathParts.slice(1).join(".");
          return this.getNestedValue(stepResult.metadata, metadataPath);
        }
      }

      // Handle simple step reference (returns entire step result)
      const stepResult = this.getStepResult(cleanExpression);
      if (stepResult) {
        return stepResult;
      }

      // If no matches, return the original expression
      console.warn(`Unable to resolve expression: ${expression}`);
      return expression;
    } catch (error) {
      console.error(`Error evaluating expression "${expression}":`, error);
      return expression;
    }
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) {
      return obj;
    }

    return path.split(".").reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indices
      if (Array.isArray(current) && /^\d+$/.test(key)) {
        const index = parseInt(key, 10);
        return current[index];
      }

      return current[key];
    }, obj);
  }

  /**
   * Get execution duration in milliseconds
   */
  getDuration(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Create a snapshot of the current context state
   */
  getSnapshot(): {
    executionId: string;
    workflowId: string;
    triggerPayload: any;
    stepResults: Record<string, StepResult>;
    variables: Record<string, any>;
    duration: number;
  } {
    return {
      executionId: this.executionId,
      workflowId: this.workflowId,
      triggerPayload: this.triggerPayload,
      stepResults: this.getResults(),
      variables: { ...this.variables },
      duration: this.getDuration()
    };
  }

  /**
   * Clone the context for parallel execution or testing
   */
  clone(): ExecutionContext {
    const cloned = new ExecutionContext({
      executionId: this.executionId,
      workflowId: this.workflowId,
      triggerPayload: this.triggerPayload,
      variables: { ...this.variables }
    });

    // Copy step results
    for (const [stepName, result] of this.stepResults) {
      cloned.addStepResult(stepName, { ...result });
    }

    return cloned;
  }
}
