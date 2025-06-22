import { supabase } from "./client.js";
import { WorkflowDefinition } from "../types/workflow.js";
import { Tables, TablesInsert, TablesUpdate } from "../types/supabase.js";
import { QueueManager } from "../engine/queue.js";
import { logger } from "../utils/logger.js";

type WorkflowRow = Tables<"workflows">;
type WorkflowInsert = TablesInsert<"workflows">;
type WorkflowUpdate = TablesUpdate<"workflows">;
type WorkflowExecutionRow = Tables<"workflow_executions">;
type WorkflowTriggerRow = Tables<"workflow_triggers">;

export class WorkflowService {
  private queueManager = new QueueManager();

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: WorkflowDefinition): Promise<WorkflowRow> {
    const workflowData: WorkflowInsert = {
      name: workflow.name,
      description: workflow.description,
      definition: workflow as any,
      version: workflow.version || 1,
      status: "active",
      // Set default values for required fields from existing schema
      edges: {},
      nodes: {},
      tenant_id: "00000000-0000-0000-0000-000000000000" // Default UUID, you may want to make this dynamic based on auth
    };

    const { data, error } = await supabase
      .from("workflows")
      .insert(workflowData)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create workflow", {
        error: error.message,
        workflow: workflow.name
      });
      throw new Error(`Failed to create workflow: ${error.message}`);
    }

    logger.info("Workflow created", {
      workflowId: data.id,
      name: workflow.name,
      version: workflow.version
    });

    return data;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: string): Promise<WorkflowRow | null> {
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to get workflow", {
        error: error.message,
        workflowId: id
      });
      throw new Error(`Failed to get workflow: ${error.message}`);
    }

    return data;
  }

  /**
   * List workflows with optional filtering
   */
  async listWorkflows(
    options: {
      status?: "active" | "inactive" | "archived";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<WorkflowRow[]> {
    let query = supabase
      .from("workflows")
      .select("*")
      .order("created_at", { ascending: false });

    if (options.status) {
      query = query.eq("status", options.status);
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
      logger.error("Failed to list workflows", {
        error: error.message,
        options
      });
      throw new Error(`Failed to list workflows: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    id: string,
    updates: Partial<WorkflowDefinition> & {
      status?: "active" | "inactive" | "archived";
    }
  ): Promise<WorkflowRow> {
    const updateData: WorkflowUpdate = {
      updated_at: new Date().toISOString()
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.status) updateData.status = updates.status;
    if (updates.version) updateData.version = updates.version;

    // Update definition if provided
    if (updates.name || updates.trigger || updates.steps) {
      const existing = await this.getWorkflow(id);
      if (!existing) {
        throw new Error("Workflow not found");
      }

      const currentDefinition =
        existing.definition as unknown as WorkflowDefinition;
      updateData.definition = {
        ...currentDefinition,
        ...updates
      } as any;
    }

    const { data, error } = await supabase
      .from("workflows")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update workflow", {
        error: error.message,
        workflowId: id
      });
      throw new Error(`Failed to update workflow: ${error.message}`);
    }

    logger.info("Workflow updated", {
      workflowId: id,
      updates: Object.keys(updates)
    });

    return data;
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    // First check if workflow exists
    const workflow = await this.getWorkflow(id);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    // Cancel any scheduled executions
    await this.queueManager.cancelScheduledWorkflow(id);

    // Delete the workflow (cascade will handle related records)
    const { error } = await supabase.from("workflows").delete().eq("id", id);

    if (error) {
      logger.error("Failed to delete workflow", {
        error: error.message,
        workflowId: id
      });
      throw new Error(`Failed to delete workflow: ${error.message}`);
    }

    logger.info("Workflow deleted", { workflowId: id, name: workflow.name });
  }

  /**
   * Execute workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    triggerPayload: any
  ): Promise<WorkflowExecutionRow> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "active") {
      throw new Error("Workflow is not active");
    }

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create execution record
    const { data: execution, error } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        execution_id: executionId,
        status: "pending",
        trigger_payload: triggerPayload,
        step_results: {}
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create execution", {
        error: error.message,
        workflowId,
        executionId
      });
      throw new Error(`Failed to create execution: ${error.message}`);
    }

    // Add to queue for processing
    await this.queueManager.addWorkflowExecution(
      workflowId,
      executionId,
      triggerPayload
    );

    logger.info("Workflow execution started", {
      workflowId,
      executionId,
      payloadSize: JSON.stringify(triggerPayload).length
    });

    return execution;
  }

  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(
    workflowId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: "pending" | "running" | "completed" | "failed" | "cancelled";
    } = {}
  ): Promise<WorkflowExecutionRow[]> {
    let query = supabase
      .from("workflow_executions")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false });

    if (options.status) {
      query = query.eq("status", options.status);
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
      logger.error("Failed to get workflow executions", {
        error: error.message,
        workflowId,
        options
      });
      throw new Error(`Failed to get workflow executions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Register webhook trigger
   */
  async registerWebhookTrigger(
    workflowId: string,
    settings: any
  ): Promise<WorkflowTriggerRow> {
    const webhookUrl = `/webhooks/${workflowId}`;
    const webhookSecret = Math.random().toString(36).substr(2, 32);

    const { data, error } = await supabase
      .from("workflow_triggers")
      .insert({
        workflow_id: workflowId,
        trigger_type: "webhook",
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        settings: settings,
        status: "active"
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to register webhook trigger", {
        error: error.message,
        workflowId
      });
      throw new Error(`Failed to register webhook trigger: ${error.message}`);
    }

    logger.info("Webhook trigger registered", {
      workflowId,
      webhookUrl,
      triggerId: data.id
    });

    return data;
  }

  /**
   * Update webhook trigger
   */
  async updateWebhookTrigger(workflowId: string, settings: any): Promise<void> {
    const { error } = await supabase
      .from("workflow_triggers")
      .update({ settings })
      .eq("workflow_id", workflowId)
      .eq("trigger_type", "webhook");

    if (error) {
      logger.error("Failed to update webhook trigger", {
        error: error.message,
        workflowId
      });
      throw new Error(`Failed to update webhook trigger: ${error.message}`);
    }

    logger.info("Webhook trigger updated", { workflowId });
  }
}

export class WebhookService {
  private workflowService = new WorkflowService();

  /**
   * Handle incoming webhook
   */
  async handleWebhook(
    webhookId: string,
    requestData: {
      payload: any;
      headers: Record<string, string>;
      method: string;
      url: string;
      timestamp: string;
      isTest?: boolean;
    }
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      // Find workflow by webhook URL pattern
      const workflowId = webhookId; // Assuming webhookId is the workflowId for simplicity

      const workflow = await this.workflowService.getWorkflow(workflowId);
      if (!workflow) {
        return { success: false, error: "Webhook not found" };
      }

      if (workflow.status !== "active") {
        return { success: false, error: "Workflow is not active" };
      }

      // Create webhook event record
      await this.recordWebhookEvent(webhookId, requestData);

      // Execute workflow
      const execution = await this.workflowService.executeWorkflow(workflowId, {
        webhook: requestData.payload,
        headers: requestData.headers,
        method: requestData.method,
        url: requestData.url,
        timestamp: requestData.timestamp
      });

      return { success: true, executionId: execution.execution_id };
    } catch (error) {
      logger.error("Webhook processing error", {
        webhookId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(webhookId: string): Promise<WorkflowTriggerRow | null> {
    const { data, error } = await supabase
      .from("workflow_triggers")
      .select("*")
      .eq("workflow_id", webhookId)
      .eq("trigger_type", "webhook")
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to get webhook info: ${error.message}`);
    }

    return data;
  }

  /**
   * Get webhook events
   */
  async getWebhookEvents(
    webhookId: string,
    options: {
      limit?: number;
    } = {}
  ): Promise<any[]> {
    // This would typically query webhook_events table
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Record webhook event
   */
  private async recordWebhookEvent(
    webhookId: string,
    requestData: any
  ): Promise<void> {
    // This would typically insert into webhook_events table
    // For now, just log the event
    logger.info("Webhook event recorded", {
      webhookId,
      method: requestData.method,
      timestamp: requestData.timestamp
    });
  }
}
