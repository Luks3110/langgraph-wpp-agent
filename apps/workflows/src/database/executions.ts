import { supabase } from "./client.js";
import { Tables, TablesInsert, TablesUpdate } from "../types/supabase.js";
import { logger } from "../utils/logger.js";

type ExecutionRow = Tables<"workflow_executions">;
type ExecutionInsert = TablesInsert<"workflow_executions">;
type ExecutionUpdate = TablesUpdate<"workflow_executions">;
type ExecutionStepRow = Tables<"execution_steps">;
type ExecutionStepInsert = TablesInsert<"execution_steps">;

export class ExecutionService {
  /**
   * List executions with filtering
   */
  async listExecutions(
    options: {
      limit?: number;
      offset?: number;
      status?: "pending" | "running" | "completed" | "failed" | "cancelled";
      workflowId?: string;
    } = {}
  ): Promise<ExecutionRow[]> {
    let query = supabase
      .from("workflow_executions")
      .select(
        `
        *,
        workflows:workflow_id (
          name,
          description
        )
      `
      )
      .order("created_at", { ascending: false });

    if (options.status) {
      query = query.eq("status", options.status);
    }

    if (options.workflowId) {
      query = query.eq("workflow_id", options.workflowId);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to list executions", {
        error: error.message,
        options
      });
      throw new Error(`Failed to list executions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<ExecutionRow | null> {
    const { data, error } = await supabase
      .from("workflow_executions")
      .select(
        `
        *,
        workflows:workflow_id (
          name,
          description,
          definition
        )
      `
      )
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to get execution", {
        error: error.message,
        executionId: id
      });
      throw new Error(`Failed to get execution: ${error.message}`);
    }

    return data;
  }

  /**
   * Get execution by execution_id (string identifier)
   */
  async getExecutionByExecutionId(
    executionId: string
  ): Promise<ExecutionRow | null> {
    const { data, error } = await supabase
      .from("workflow_executions")
      .select("*")
      .eq("execution_id", executionId)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to get execution by execution_id", {
        error: error.message,
        executionId
      });
      throw new Error(`Failed to get execution: ${error.message}`);
    }

    return data;
  }

  /**
   * Update execution status and results
   */
  async updateExecution(
    id: string,
    updates: {
      status?: "pending" | "running" | "completed" | "failed" | "cancelled";
      stepResults?: any;
      errorMessage?: string;
      completedAt?: string;
    }
  ): Promise<ExecutionRow> {
    const updateData: ExecutionUpdate = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.stepResults) updateData.step_results = updates.stepResults;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.completedAt) updateData.completed_at = updates.completedAt;

    const { data, error } = await supabase
      .from("workflow_executions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update execution", {
        error: error.message,
        executionId: id
      });
      throw new Error(`Failed to update execution: ${error.message}`);
    }

    return data;
  }

  /**
   * Update execution by execution_id (string identifier)
   */
  async updateExecutionByExecutionId(
    executionId: string,
    updates: {
      status?: "pending" | "running" | "completed" | "failed" | "cancelled";
      stepResults?: any;
      errorMessage?: string;
      completedAt?: string;
    }
  ): Promise<ExecutionRow> {
    const updateData: ExecutionUpdate = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.stepResults) updateData.step_results = updates.stepResults;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.completedAt) updateData.completed_at = updates.completedAt;

    const { data, error } = await supabase
      .from("workflow_executions")
      .update(updateData)
      .eq("execution_id", executionId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update execution by execution_id", {
        error: error.message,
        executionId
      });
      throw new Error(`Failed to update execution: ${error.message}`);
    }

    return data;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(id: string): Promise<ExecutionRow> {
    return await this.updateExecution(id, {
      status: "cancelled",
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Retry failed execution
   */
  async retryExecution(id: string): Promise<ExecutionRow> {
    const execution = await this.getExecution(id);
    if (!execution) {
      throw new Error("Execution not found");
    }

    // Create new execution with same parameters
    const newExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: execution.workflow_id,
        execution_id: newExecutionId,
        status: "pending",
        trigger_payload: execution.trigger_payload,
        step_results: {}
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to retry execution", {
        error: error.message,
        originalExecutionId: id
      });
      throw new Error(`Failed to retry execution: ${error.message}`);
    }

    logger.info("Execution retried", {
      originalExecutionId: id,
      newExecutionId: data.execution_id
    });

    return data;
  }

  /**
   * Get execution steps
   */
  async getExecutionSteps(executionId: string): Promise<ExecutionStepRow[]> {
    const { data, error } = await supabase
      .from("execution_steps")
      .select("*")
      .eq("execution_id", executionId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to get execution steps", {
        error: error.message,
        executionId
      });
      throw new Error(`Failed to get execution steps: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create execution step
   */
  async createExecutionStep(stepData: {
    executionId: string;
    stepName: string;
    stepType: "trigger" | "action";
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    inputData?: any;
    outputData?: any;
    errorMessage?: string;
  }): Promise<ExecutionStepRow> {
    // Get the database UUID for the execution
    const execution = await this.getExecutionByExecutionId(
      stepData.executionId
    );
    if (!execution) {
      throw new Error(`Execution not found: ${stepData.executionId}`);
    }

    const insertData: ExecutionStepInsert = {
      execution_id: execution.id,
      step_name: stepData.stepName,
      step_type: stepData.stepType,
      status: stepData.status,
      input_data: stepData.inputData || null,
      output_data: stepData.outputData || null,
      error_message: stepData.errorMessage || null,
      started_at: new Date().toISOString()
    };

    if (stepData.status === "completed" || stepData.status === "failed") {
      insertData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("execution_steps")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create execution step", {
        error: error.message,
        stepData
      });
      throw new Error(`Failed to create execution step: ${error.message}`);
    }

    return data;
  }

  /**
   * Update execution step
   */
  async updateExecutionStep(
    stepId: string,
    updates: {
      status?: "pending" | "running" | "completed" | "failed" | "skipped";
      outputData?: any;
      errorMessage?: string;
    }
  ): Promise<ExecutionStepRow> {
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === "completed" || updates.status === "failed") {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (updates.outputData !== undefined)
      updateData.output_data = updates.outputData;
    if (updates.errorMessage !== undefined)
      updateData.error_message = updates.errorMessage;

    const { data, error } = await supabase
      .from("execution_steps")
      .update(updateData)
      .eq("id", stepId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update execution step", {
        error: error.message,
        stepId,
        updates
      });
      throw new Error(`Failed to update execution step: ${error.message}`);
    }

    return data;
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(
    options: {
      timeframe?: "hour" | "day" | "week" | "month";
      workflowId?: string;
    } = {}
  ): Promise<any> {
    const timeframe = options.timeframe || "day";
    const timeframeSql = {
      hour: "1 hour",
      day: "1 day",
      week: "7 days",
      month: "30 days"
    }[timeframe];

    let query = supabase
      .from("workflow_executions")
      .select("status, created_at")
      .gte("created_at", `now() - interval '${timeframeSql}'`);

    if (options.workflowId) {
      query = query.eq("workflow_id", options.workflowId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to get execution stats", {
        error: error.message,
        options
      });
      throw new Error(`Failed to get execution stats: ${error.message}`);
    }

    // Process stats
    const stats = {
      total: data?.length || 0,
      completed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      cancelled: 0,
      timeframe,
      workflowId: options.workflowId
    };

    data?.forEach((execution) => {
      stats[execution.status as keyof typeof stats]++;
    });

    return stats;
  }

  /**
   * Get execution logs (placeholder)
   */
  async getExecutionLogs(
    executionId: string,
    options: {
      level?: "info" | "warn" | "error" | "debug";
      limit?: number;
    } = {}
  ): Promise<any[]> {
    // This would typically query a logs table
    // For now, return execution steps as logs
    const steps = await this.getExecutionSteps(executionId);

    return steps.map((step) => ({
      id: step.id,
      timestamp: step.created_at,
      level: step.status === "failed" ? "error" : "info",
      message: step.error_message || `Step ${step.step_name} ${step.status}`,
      step: step.step_name,
      data: {
        input: step.input_data,
        output: step.output_data,
        error: step.error_message
      }
    }));
  }

  /**
   * Delete old executions
   */
  async cleanupOldExecutions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from("workflow_executions")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      logger.error("Failed to cleanup old executions", {
        error: error.message,
        olderThanDays
      });
      throw new Error(`Failed to cleanup old executions: ${error.message}`);
    }

    const deletedCount = data?.length || 0;
    logger.info("Old executions cleaned up", {
      deletedCount,
      olderThanDays
    });

    return deletedCount;
  }
}
