import { supabase } from "./client.js";
import { WorkflowDefinition } from "../types/workflow.js";
import { Tables, TablesInsert, TablesUpdate } from "../types/supabase.js";
import { QueueManager } from "../engine/queue.js";
import { logger } from "../utils/logger.js";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase.js";

type WorkflowRow = Tables<"workflows">;
type WorkflowInsert = TablesInsert<"workflows">;
type WorkflowUpdate = TablesUpdate<"workflows">;
type WorkflowExecutionRow = Tables<"workflow_executions">;
type WorkflowTriggerRow = Tables<"workflow_triggers">;

export class WorkflowService {
  private queueManager = new QueueManager();

  /**
   * Get authenticated Supabase client for user operations
   */
  private getAuthenticatedClient(userToken?: string) {
    if (!userToken) {
      throw new Error("Authentication required - user token must be provided");
    }

    // Create a new client with the user's token for RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const userClient = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-Client-Info": "workflow-engine@1.0.0"
        }
      }
    });

    return userClient;
  }

  /**
   * Create a new workflow - requires authentication
   */
  async createWorkflow(
    workflow: WorkflowDefinition,
    userId: string,
    userToken: string
  ): Promise<WorkflowRow> {
    if (!userId || !userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(userToken);

    const workflowData: WorkflowInsert = {
      name: workflow.name,
      description: workflow.description,
      definition: workflow as any,
      version: workflow.version || 1,
      status: "active",
      created_by: userId,
      // Set default values for required fields from existing schema
      edges: {},
      nodes: {},
      tenant_id: "00000000-0000-0000-0000-000000000000" // Default UUID, you may want to make this dynamic based on auth
    };

    const { data, error } = await client
      .from("workflows")
      .insert(workflowData)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create workflow", {
        error: error.message,
        workflow: workflow.name,
        userId
      });
      throw new Error(`Failed to create workflow: ${error.message}`);
    }

    logger.info("Workflow created", {
      workflowId: data.id,
      name: workflow.name,
      version: workflow.version,
      userId
    });

    return data;
  }

  /**
   * Get workflow by ID without authentication (for internal/webhook use)
   */
  async getWorkflowById(id: string): Promise<WorkflowRow | null> {
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
   * Get workflow by ID with user authorization - requires authentication
   */
  async getWorkflow(
    id: string,
    userId: string,
    userToken: string
  ): Promise<WorkflowRow | null> {
    if (!userId || !userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(userToken);

    const { data, error } = await client
      .from("workflows")
      .select("*")
      .eq("id", id)
      .eq("created_by", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to get workflow", {
        error: error.message,
        workflowId: id,
        userId
      });
      throw new Error(`Failed to get workflow: ${error.message}`);
    }

    return data;
  }

  /**
   * List workflows with user authorization - requires authentication
   */
  async listWorkflows(options: {
    status?: "active" | "inactive" | "archived";
    limit?: number;
    offset?: number;
    userId: string;
    userToken: string;
  }): Promise<WorkflowRow[]> {
    if (!options.userId || !options.userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(options.userToken);

    let query = client
      .from("workflows")
      .select("*")
      .eq("created_by", options.userId)
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
   * Update workflow with user authorization - requires authentication
   */
  async updateWorkflow(
    id: string,
    updates: Partial<WorkflowDefinition> & {
      status?: "active" | "inactive" | "archived";
    },
    userId: string,
    userToken: string
  ): Promise<WorkflowRow> {
    if (!userId || !userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(userToken);

    // First check if the workflow exists and user owns it
    const existing = await this.getWorkflow(id, userId, userToken);
    if (!existing) {
      throw new Error("Workflow not found or access denied");
    }

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
      const currentDefinition =
        existing.definition as unknown as WorkflowDefinition;
      updateData.definition = {
        ...currentDefinition,
        ...updates
      } as any;
    }

    const { data, error } = await client
      .from("workflows")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", userId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update workflow", {
        error: error.message,
        workflowId: id,
        userId
      });
      throw new Error(`Failed to update workflow: ${error.message}`);
    }

    logger.info("Workflow updated", {
      workflowId: id,
      updates: Object.keys(updates),
      userId
    });

    return data;
  }

  /**
   * Delete workflow with user authorization - requires authentication
   */
  async deleteWorkflow(
    id: string,
    userId: string,
    userToken: string
  ): Promise<void> {
    if (!userId || !userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(userToken);

    // First check if workflow exists and user owns it
    const workflow = await this.getWorkflow(id, userId, userToken);
    if (!workflow) {
      throw new Error("Workflow not found or access denied");
    }

    // Cancel any scheduled executions
    await this.queueManager.cancelScheduledWorkflow(id);

    // Delete the workflow (cascade will handle related records)
    const { error } = await client
      .from("workflows")
      .delete()
      .eq("id", id)
      .eq("created_by", userId);

    if (error) {
      logger.error("Failed to delete workflow", {
        error: error.message,
        workflowId: id,
        userId
      });
      throw new Error(`Failed to delete workflow: ${error.message}`);
    }

    logger.info("Workflow deleted", {
      workflowId: id,
      name: workflow.name,
      userId
    });
  }

  /**
   * Execute a workflow (can be called by system for webhooks or by users for manual execution)
   */
  async executeWorkflow(
    workflowId: string,
    triggerPayload: any,
    userId?: string,
    userToken?: string
  ): Promise<WorkflowExecutionRow> {
    let workflow: WorkflowRow | null = null;

    if (userId && userToken) {
      // User-authenticated execution - use authenticated client
      workflow = await this.getWorkflow(workflowId, userId, userToken);
    } else {
      // System operation (webhook triggers) - use system client
      const { data, error: workflowError } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", workflowId)
        .single();

      if (workflowError) {
        throw new Error("Workflow not found");
      }
      workflow = data;
    }

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "active") {
      throw new Error("Workflow is not active");
    }

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create execution record - use appropriate client based on authentication
    const client =
      userId && userToken ? this.getAuthenticatedClient(userToken) : supabase;

    const { data: execution, error: executionError } = await client
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

    if (executionError) {
      logger.error("Failed to create execution", {
        error: executionError.message,
        workflowId,
        executionId,
        userId
      });
      throw new Error(`Failed to create execution: ${executionError.message}`);
    }

    if (!execution) {
      throw new Error("Failed to create execution - no data returned");
    }

    // Add to queue for processing
    await this.queueManager.addWorkflowExecution(
      workflowId,
      executionId,
      triggerPayload,
      undefined, // options
      userId && userToken ? { userId, userToken } : undefined
    );

    logger.info("Workflow execution started", {
      workflowId,
      executionId,
      payloadSize: JSON.stringify(triggerPayload).length,
      userId
    });

    return execution;
  }

  /**
   * Get workflow executions with user authorization
   */
  async getWorkflowExecutions(
    workflowId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: "pending" | "running" | "completed" | "failed" | "cancelled";
      userId?: string;
      userToken?: string;
    } = {}
  ): Promise<WorkflowExecutionRow[]> {
    // First check if workflow exists and user owns it
    if (options.userId && options.userToken) {
      const workflow = await this.getWorkflow(
        workflowId,
        options.userId,
        options.userToken
      );
      if (!workflow) {
        throw new Error("Workflow not found or access denied");
      }
    }

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
   * Register webhook trigger - requires authentication
   */
  async registerWebhookTrigger(
    workflowId: string,
    settings: any,
    userId: string,
    userToken: string
  ): Promise<WorkflowTriggerRow> {
    if (!userId || !userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(userToken);

    // Use the webhook URL from settings, or generate one based on workflow ID
    const webhookUrl = settings.webhookUrl || `/webhooks/${workflowId}`;
    const webhookSecret = Math.random().toString(36).substr(2, 32);

    const { data, error } = await client
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
        workflowId,
        userId
      });
      throw new Error(`Failed to register webhook trigger: ${error.message}`);
    }

    logger.info("Webhook trigger registered", {
      workflowId,
      webhookUrl,
      triggerId: data.id,
      userId
    });

    return data;
  }

  /**
   * Update webhook trigger - requires authentication
   */
  async updateWebhookTrigger(
    workflowId: string,
    settings: any,
    userId: string,
    userToken: string
  ): Promise<void> {
    if (!userId || !userToken) {
      throw new Error(
        "Authentication required - userId and userToken must be provided"
      );
    }

    const client = this.getAuthenticatedClient(userToken);

    const { error } = await client
      .from("workflow_triggers")
      .update({ settings })
      .eq("workflow_id", workflowId)
      .eq("trigger_type", "webhook");

    if (error) {
      logger.error("Failed to update webhook trigger", {
        error: error.message,
        workflowId,
        userId
      });
      throw new Error(`Failed to update webhook trigger: ${error.message}`);
    }

    logger.info("Webhook trigger updated", { workflowId, userId });
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
      const webhookUrl = `/webhooks/${webhookId}`;

      console.log("🚀 ~ WebhookService ~ webhookUrl:", webhookUrl);
      // Look up the workflow trigger by webhook URL
      const { data: trigger, error: triggerError } = await supabase
        .from("workflow_triggers")
        .select("workflow_id")
        .eq("webhook_url", webhookUrl.trim())
        .eq("trigger_type", "webhook")
        .eq("status", "active")
        .single();

      console.log("🚀 ~ WebhookService ~ trigger:", trigger);
      console.log("🚀 ~ WebhookService ~ triggerError:", triggerError);

      if (triggerError || !trigger) {
        return { success: false, error: "Webhook not found or inactive" };
      }

      const workflowId = trigger.workflow_id;
      if (!workflowId) {
        return { success: false, error: "Invalid workflow ID" };
      }

      const workflow = await this.workflowService.getWorkflowById(workflowId);

      console.log("🚀 ~ WebhookService ~ workflow:", workflow);
      if (!workflow) {
        return { success: false, error: "Associated workflow not found" };
      }

      if (workflow.status !== "active") {
        return { success: false, error: "Workflow is not active" };
      }

      // Create webhook event record
      await this.recordWebhookEvent(webhookId, requestData);

      // Execute workflow without authentication (webhook execution)
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
    console.log("🚀 ~ WebhookService ~ getWebhookInfo ~ supabase:", supabase);
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
