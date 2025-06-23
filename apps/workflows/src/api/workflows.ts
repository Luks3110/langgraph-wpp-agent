import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  workflowSchema,
  workflowCreateSchema,
  workflowUpdateSchema
} from "../utils/validation.js";
import { WorkflowService } from "../database/workflows.js";
import { QueueManager } from "../engine/queue.js";
import { supabase } from "../database/client.js";

const app = new Hono();
const workflowService = new WorkflowService();
const queueManager = new QueueManager();

// Middleware to extract user ID from Authorization header
async function getUserId(c: any): Promise<string | null> {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);

    // Decode JWT token manually since we're using service role
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      console.log("🚀 ~ getUserId ~ payload:", payload);
      console.log("🔍 JWT payload:", payload);
      return payload.sub || null;
    } catch (decodeError) {
      console.error("Failed to decode JWT:", decodeError);

      // Fallback: try using supabase auth (might work with anon key)
      const {
        data: { user },
        error
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.error("Supabase auth.getUser failed:", error);
        return null;
      }

      return user.id;
    }
  } catch (error) {
    console.error("Error extracting user ID:", error);
    return null;
  }
}

// GET /api/workflows - List workflows
app.get("/", async (c) => {
  try {
    const userId = await getUserId(c);
    console.log("🚀 ~ app.get ~ userId:", userId);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    console.log("🚀 ~ app.get ~ authHeader:", authHeader);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const { status, limit, offset } = c.req.query();

    const workflows = await workflowService.listWorkflows({
      status: status as "active" | "inactive" | "archived",
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      userId,
      userToken
    });

    return c.json({
      data: workflows,
      meta: {
        total: workflows.length,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      }
    });
  } catch (error: any) {
    console.error("Error listing workflows:", error);
    return c.json(
      { error: "Failed to list workflows", message: error.message },
      500
    );
  }
});

// POST /api/workflows - Create workflow
app.post("/", async (c) => {
  try {
    const userId = await getUserId(c);

    console.log("🚀 ~ app.post ~ userId:", userId);

    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const rawPayload = await c.req.json();
    console.log(
      "🔍 Raw payload received:",
      JSON.stringify(rawPayload, null, 2)
    );

    // Validate with detailed error reporting
    const validation = workflowCreateSchema.safeParse(rawPayload);
    if (!validation.success) {
      console.log("❌ Validation failed:", validation.error.errors);
      return c.json(
        {
          error: "Validation failed",
          details: validation.error.errors
        },
        400
      );
    }

    const payload = validation.data;
    console.log("✅ Payload validated successfully");

    // Transform the payload to WorkflowDefinition format
    const workflowDefinition = {
      id: crypto.randomUUID(), // Generate ID for the workflow
      name: payload.definition.name,
      description: payload.definition.description,
      version: payload.definition.version,
      trigger: payload.definition.trigger,
      steps: payload.definition.steps
    };

    console.log(
      "🔧 Transformed workflow definition:",
      JSON.stringify(workflowDefinition, null, 2)
    );

    const created = await workflowService.createWorkflow(
      workflowDefinition,
      userId,
      userToken
    );

    // Register webhook trigger if present
    if (payload.definition.trigger.triggerType === "webhook") {
      await workflowService.registerWebhookTrigger(
        created.id,
        payload.definition.trigger.settings,
        userId,
        userToken
      );
    }

    return c.json(created, 201);
  } catch (error: any) {
    console.log("🚀 ~ app.post ~ error:", error);
    console.error("Error creating workflow:", error);
    return c.json(
      { error: "Failed to create workflow", message: error.message },
      500
    );
  }
});

// GET /api/workflows/:id - Get workflow
app.get("/:id", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const id = c.req.param("id");
    const workflow = await workflowService.getWorkflow(id, userId, userToken);

    if (!workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    return c.json(workflow);
  } catch (error) {
    console.error("Error getting workflow:", error);
    return c.json({ error: "Failed to get workflow" }, 500);
  }
});

// PUT /api/workflows/:id - Update workflow
app.put("/:id", zValidator("json", workflowUpdateSchema), async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const id = c.req.param("id");
    const updates = c.req.valid("json");

    const updated = await workflowService.updateWorkflow(
      id,
      updates,
      userId,
      userToken
    );

    // Update webhook trigger if changed
    if (updates.definition?.trigger?.triggerType === "webhook") {
      await workflowService.updateWebhookTrigger(
        id,
        updates.definition.trigger.settings,
        userId,
        userToken
      );
    }

    return c.json(updated);
  } catch (error: any) {
    console.error("Error updating workflow:", error);
    if (error.message && error.message.includes("access denied")) {
      return c.json({ error: "Workflow not found or access denied" }, 404);
    }
    return c.json({ error: "Failed to update workflow" }, 500);
  }
});

// DELETE /api/workflows/:id - Delete workflow
app.delete("/:id", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const id = c.req.param("id");
    await workflowService.deleteWorkflow(id, userId, userToken);
    return c.json({ message: "Workflow deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting workflow:", error);
    if (error.message && error.message.includes("access denied")) {
      return c.json({ error: "Workflow not found or access denied" }, 404);
    }
    return c.json({ error: "Failed to delete workflow" }, 500);
  }
});

// POST /api/workflows/:id/execute - Manual execution
app.post("/:id/execute", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const id = c.req.param("id");
    const payload = await c.req.json();

    const execution = await workflowService.executeWorkflow(
      id,
      payload,
      userId,
      userToken
    );
    return c.json(execution);
  } catch (error: any) {
    console.error("Error executing workflow:", error);
    if (error.message && error.message.includes("access denied")) {
      return c.json({ error: "Workflow not found or access denied" }, 404);
    }
    return c.json(
      { error: "Failed to execute workflow", message: error.message },
      500
    );
  }
});

// POST /api/workflows/:id/activate - Activate workflow
app.post("/:id/activate", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const id = c.req.param("id");
    const updated = await workflowService.updateWorkflow(
      id,
      {
        status: "active"
      },
      userId,
      userToken
    );

    // Enable triggers
    const workflow = await workflowService.getWorkflow(id, userId, userToken);
    if (
      workflow?.definition &&
      typeof workflow.definition === "object" &&
      "trigger" in workflow.definition
    ) {
      const definition = workflow.definition as any;
      if (definition.trigger?.triggerType === "schedule") {
        await queueManager.scheduleWorkflow(
          id,
          definition.trigger.settings.cron
        );
      }
    }

    return c.json(updated);
  } catch (error) {
    console.error("Error activating workflow:", error);
    return c.json({ error: "Failed to activate workflow" }, 500);
  }
});

// POST /api/workflows/:id/deactivate - Deactivate workflow
app.post("/:id/deactivate", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const userToken = authHeader.substring(7);

    const id = c.req.param("id");
    const updated = await workflowService.updateWorkflow(
      id,
      {
        status: "inactive"
      },
      userId,
      userToken
    );

    // Disable triggers
    await queueManager.cancelScheduledWorkflow(id);

    return c.json(updated);
  } catch (error) {
    console.error("Error deactivating workflow:", error);
    return c.json({ error: "Failed to deactivate workflow" }, 500);
  }
});

// GET /api/workflows/:id/executions - Get workflow executions
app.get("/:id/executions", async (c) => {
  try {
    const userId = await getUserId(c);
    const id = c.req.param("id");
    const { limit, offset, status } = c.req.query();

    let userToken: string | undefined;
    if (userId) {
      const authHeader = c.req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        userToken = authHeader.substring(7);
      }
    }

    const executions = await workflowService.getWorkflowExecutions(id, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      status: status as "pending" | "running" | "completed" | "failed",
      userId: userId || undefined,
      userToken
    });

    return c.json({
      data: executions,
      meta: {
        workflowId: id,
        total: executions.length,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      }
    });
  } catch (error) {
    console.error("Error getting workflow executions:", error);
    return c.json({ error: "Failed to get workflow executions" }, 500);
  }
});

export default app;
