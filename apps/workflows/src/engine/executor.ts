/**
 * Main workflow execution engine
 */

import type {
  WorkflowDefinition,
  ExecutionResult,
  StepResult,
  TriggerStep,
  ActionStep
} from "../types/index.js";
import { ExecutionContext } from "./context.js";
import { NodeRegistry } from "./registry.js";
import type { Job } from "bullmq";
import { ExecutionService } from "../database/executions.js";

export class WorkflowExecutor {
  private nodeRegistry: NodeRegistry;
  private executionService: ExecutionService;

  constructor(nodeRegistry?: NodeRegistry) {
    this.nodeRegistry = nodeRegistry || new NodeRegistry();
    this.executionService = new ExecutionService();
  }

  /**
   * Process a workflow execution job from BullMQ
   */
  async processExecution(job: Job): Promise<void> {
    const { workflowId, executionId, triggerPayload, userContext } = job.data;

    try {
      // Update execution status to running
      await this.executionService.updateExecutionByExecutionId(
        executionId,
        {
          status: "running"
        },
        userContext?.userToken
      );

      // Fetch workflow definition from database
      const workflowService = new (
        await import("../database/workflows.js")
      ).WorkflowService();

      let workflowRow;
      if (userContext?.userId && userContext?.userToken) {
        // Use authenticated access for user workflows
        workflowRow = await workflowService.getWorkflow(
          workflowId,
          userContext.userId,
          userContext.userToken
        );
      } else {
        // For system operations (webhooks), we need a different approach
        // This will fail with current RLS policies - need to handle system access
        const { supabase } = await import("../database/client.js");
        const { data } = await supabase
          .from("workflows")
          .select("*")
          .eq("id", workflowId)
          .single();
        workflowRow = data;
      }

      if (!workflowRow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Extract workflow definition from database row
      const workflow = workflowRow.definition as unknown as WorkflowDefinition;
      // Add the id from the database row to the workflow definition
      workflow.id = workflowRow.id;

      // Execute the workflow
      const result = await this.execute(workflow, triggerPayload);

      // Update execution with results
      await this.executionService.updateExecutionByExecutionId(
        executionId,
        {
          status: result.success ? "completed" : "failed",
          stepResults: result.results,
          errorMessage: result.error,
          completedAt: new Date().toISOString()
        },
        userContext?.userToken
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await this.executionService.updateExecutionByExecutionId(
        executionId,
        {
          status: "failed",
          errorMessage: errorMessage,
          completedAt: new Date().toISOString()
        },
        userContext?.userToken
      );

      throw error;
    }
  }

  /**
   * Process a step execution job from BullMQ
   */
  async processStep(job: Job): Promise<void> {
    const { executionId, stepName, stepData } = job.data;

    try {
      // Create step record
      const step = await this.executionService.createExecutionStep({
        executionId: executionId,
        stepName: stepName,
        stepType: stepData.type,
        status: "running",
        inputData: stepData.settings
      });

      // Execute the step based on type
      let result: StepResult;
      if (stepData.type === "TRIGGER") {
        result = await this.executeTrigger(stepData, stepData.context);
      } else {
        result = await this.executeStep(stepData, stepData.context);
      }

      // Update step with results
      await this.executionService.updateExecutionStep(step.id, {
        status: result.success ? "completed" : "failed",
        outputData: result.output,
        errorMessage: result.error
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Try to update step if we have stepId
      // This might fail if step creation failed, but that's ok
      try {
        await this.executionService.updateExecutionStep(job.data.stepId, {
          status: "failed",
          errorMessage: errorMessage
        });
      } catch (updateError) {
        // Ignore update errors
      }

      throw error;
    }
  }

  /**
   * Execute a workflow synchronously (for testing and simple workflows)
   */
  async execute(
    workflow: WorkflowDefinition,
    triggerPayload: any = {}
  ): Promise<ExecutionResult> {
    const context = this.createExecutionContext(workflow, triggerPayload);

    try {
      console.log(
        `Starting workflow execution: ${workflow.id} (${workflow.name})`
      );

      // Validate workflow before execution
      const validation = this.nodeRegistry.validateWorkflow(workflow);
      if (!validation.valid) {
        throw new Error(
          `Workflow validation failed: ${validation.errors.join(", ")}`
        );
      }

      // Execute trigger
      const triggerResult = await this.executeTrigger(
        workflow.trigger,
        context
      );
      context.addStepResult(workflow.trigger.name, triggerResult);

      if (!triggerResult.success) {
        throw new Error(`Trigger execution failed: ${triggerResult.error}`);
      }

      // Execute steps in sequence
      let currentStepName = workflow.trigger.nextAction;
      let completedSteps = 1; // Count trigger as first step
      const totalSteps = Object.keys(workflow.steps).length + 1;

      while (currentStepName) {
        const step = workflow.steps[currentStepName];
        if (!step) {
          console.warn(
            `Step "${currentStepName}" not found in workflow definition`
          );
          break;
        }

        console.log(`Executing step: ${currentStepName} (${step.actionType})`);
        const stepResult = await this.executeStep(step, context);
        context.addStepResult(step.name, stepResult);
        completedSteps++;

        if (!stepResult.success) {
          // Check if we should continue on error
          const continueOnError = step.settings?.continueOnError === true;
          if (!continueOnError) {
            throw new Error(
              `Step "${currentStepName}" failed: ${stepResult.error}`
            );
          }
          console.warn(
            `Step "${currentStepName}" failed but continuing: ${stepResult.error}`
          );
        }

        // Determine next step
        currentStepName = this.getNextStep(step, stepResult, context);
      }

      const duration = context.getDuration();
      console.log(`Workflow execution completed in ${duration}ms`);

      return {
        success: true,
        executionId: context.executionId,
        results: context.getResults(),
        duration,
        completedSteps,
        totalSteps
      };
    } catch (error) {
      const duration = context.getDuration();
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        `Workflow execution failed after ${duration}ms:`,
        errorMessage
      );

      return {
        success: false,
        executionId: context.executionId,
        results: context.getResults(),
        error: errorMessage,
        duration,
        completedSteps: Object.keys(context.getResults()).length,
        totalSteps: Object.keys(workflow.steps).length + 1
      };
    }
  }

  /**
   * Execute a trigger step
   */
  private async executeTrigger(
    trigger: TriggerStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const triggerNode = this.nodeRegistry.getTrigger(trigger.triggerType);
    if (!triggerNode) {
      throw new Error(`Trigger type "${trigger.triggerType}" not found`);
    }

    const startTime = Date.now();

    try {
      // Resolve settings with context
      const resolvedSettings = context.resolveValue(trigger.settings);

      const result = await triggerNode.execute(resolvedSettings, context);
      const duration = Date.now() - startTime;

      return {
        ...result,
        duration,
        metadata: {
          ...result.metadata,
          triggerType: trigger.triggerType,
          stepType: "trigger"
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        error: `Trigger execution failed: ${errorMessage}`,
        duration,
        metadata: {
          triggerType: trigger.triggerType,
          stepType: "trigger"
        }
      };
    }
  }

  /**
   * Execute an action step
   */
  private async executeStep(
    step: ActionStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const actionNode = this.nodeRegistry.getAction(step.actionType);
    if (!actionNode) {
      throw new Error(`Action type "${step.actionType}" not found`);
    }

    const startTime = Date.now();

    try {
      // Resolve settings with context (supports expressions like {{trigger.data}})
      const resolvedSettings = context.resolveValue(step.settings);

      const result = await actionNode.execute(resolvedSettings, context);
      const duration = Date.now() - startTime;

      return {
        ...result,
        duration,
        metadata: {
          ...result.metadata,
          actionType: step.actionType,
          stepType: "action"
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        error: `Action execution failed: ${errorMessage}`,
        duration,
        metadata: {
          actionType: step.actionType,
          stepType: "action"
        }
      };
    }
  }

  /**
   * Determine the next step based on the current step and its result
   */
  private getNextStep(
    step: ActionStep,
    result: StepResult,
    context: ExecutionContext
  ): string | undefined {
    // Handle conditional branching
    if (step.actionType === "condition") {
      // Check if condition was met
      const conditionMet = result.output?.conditionMet === true;

      if (conditionMet && step.settings?.trueAction) {
        return context.resolveValue(step.settings.trueAction);
      } else if (!conditionMet && step.settings?.falseAction) {
        return context.resolveValue(step.settings.falseAction);
      }
    }

    // Default behavior: follow nextAction if step succeeded
    if (result.success && step.nextAction) {
      return context.resolveValue(step.nextAction);
    }

    // No next step
    return undefined;
  }

  /**
   * Create execution context for a workflow
   */
  private createExecutionContext(
    workflow: WorkflowDefinition,
    triggerPayload: any
  ): ExecutionContext {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new ExecutionContext({
      executionId,
      workflowId: workflow.id,
      triggerPayload,
      variables: {}
    });
  }

  /**
   * Test a single step in isolation
   */
  async testStep(
    stepType: "trigger" | "action",
    nodeType: string,
    settings: Record<string, any>,
    mockContext?: Partial<ExecutionContext>
  ): Promise<StepResult> {
    // Create mock context for testing
    const testContext = new ExecutionContext({
      executionId: "test_execution",
      workflowId: "test_workflow",
      triggerPayload: mockContext?.triggerPayload || {},
      variables: mockContext?.variables || {}
    });

    if (mockContext?.stepResults) {
      for (const [stepName, result] of mockContext.stepResults) {
        testContext.addStepResult(stepName, result);
      }
    }

    if (stepType === "trigger") {
      const triggerNode = this.nodeRegistry.getTrigger(nodeType);
      if (!triggerNode) {
        throw new Error(`Trigger type "${nodeType}" not found`);
      }
      return await triggerNode.execute(settings, testContext);
    } else {
      const actionNode = this.nodeRegistry.getAction(nodeType);
      if (!actionNode) {
        throw new Error(`Action type "${nodeType}" not found`);
      }
      return await actionNode.execute(settings, testContext);
    }
  }

  /**
   * Validate a workflow definition
   */
  validateWorkflow(workflow: WorkflowDefinition): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate with node registry
    const registryValidation = this.nodeRegistry.validateWorkflow(workflow);
    errors.push(...registryValidation.errors);

    // Validate workflow structure
    if (!workflow.trigger) {
      errors.push("Workflow must have a trigger");
    }

    if (!workflow.steps || Object.keys(workflow.steps).length === 0) {
      warnings.push("Workflow has no action steps");
    }

    // Validate step connections
    const stepNames = Object.keys(workflow.steps);
    const validateStepReference = (stepRef: string, context: string) => {
      if (stepRef && !stepNames.includes(stepRef)) {
        errors.push(`Invalid step reference "${stepRef}" in ${context}`);
      }
    };

    // Check trigger nextAction
    if (workflow.trigger.nextAction) {
      validateStepReference(workflow.trigger.nextAction, "trigger nextAction");
    }

    // Check each step's nextAction
    for (const [stepName, step] of Object.entries(workflow.steps)) {
      if (step.nextAction) {
        validateStepReference(step.nextAction, `step "${stepName}" nextAction`);
      }

      // Check conditional actions
      if (step.settings?.trueAction) {
        validateStepReference(
          step.settings.trueAction,
          `step "${stepName}" trueAction`
        );
      }
      if (step.settings?.falseAction) {
        validateStepReference(
          step.settings.falseAction,
          `step "${stepName}" falseAction`
        );
      }
    }

    // Check for unreachable steps
    const reachableSteps = new Set<string>();
    const collectReachableSteps = (stepName?: string) => {
      if (!stepName || reachableSteps.has(stepName)) return;
      reachableSteps.add(stepName);

      const step = workflow.steps[stepName];
      if (step) {
        collectReachableSteps(step.nextAction);
        collectReachableSteps(step.settings?.trueAction);
        collectReachableSteps(step.settings?.falseAction);
      }
    };

    collectReachableSteps(workflow.trigger.nextAction);

    for (const stepName of stepNames) {
      if (!reachableSteps.has(stepName)) {
        warnings.push(`Step "${stepName}" is unreachable`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
