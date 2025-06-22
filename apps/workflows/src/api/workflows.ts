import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { workflowSchema, workflowUpdateSchema } from "../utils/validation.js";
import { WorkflowService } from "../database/workflows.js";
import { QueueManager } from "../engine/queue.js";

const app = new Hono();
const workflowService = new WorkflowService();
const queueManager = new QueueManager();

// GET /api/workflows - List workflows
app.get("/", async (c) => {
  try {
    const { status, limit, offset } = c.req.query();
    const workflows = await workflowService.listWorkflows({
      status: status as "active" | "inactive" | "archived",
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    return c.json({
      data: workflows,
      meta: {
        total: workflows.length,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      }
    });
  } catch (error) {
    console.error("Error listing workflows:", error);
    return c.json({ error: "Failed to list workflows" }, 500);
  }
});

// POST /api/workflows - Create workflow
app.post("/", zValidator("json", workflowSchema), async (c) => {
  try {
    const workflow = c.req.valid("json");
    const created = await workflowService.createWorkflow(workflow);

    // Register webhook trigger if present
    if (workflow.trigger.triggerType === "webhook") {
      await workflowService.registerWebhookTrigger(
        created.id,
        workflow.trigger.settings
      );
    }

    return c.json(created, 201);
  } catch (error) {
    console.error("Error creating workflow:", error);
    return c.json({ error: "Failed to create workflow" }, 500);
  }
});

// GET /api/workflows/:id - Get workflow
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const workflow = await workflowService.getWorkflow(id);

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
    const id = c.req.param("id");
    const updates = c.req.valid("json");

    const existing = await workflowService.getWorkflow(id);
    if (!existing) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    const updated = await workflowService.updateWorkflow(id, updates);

    // Update webhook trigger if changed
    if (updates.definition?.trigger?.triggerType === "webhook") {
      await workflowService.updateWebhookTrigger(
        id,
        updates.definition.trigger.settings
      );
    }

    return c.json(updated);
  } catch (error) {
    console.error("Error updating workflow:", error);
    return c.json({ error: "Failed to update workflow" }, 500);
  }
});

// DELETE /api/workflows/:id - Delete workflow
app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const existing = await workflowService.getWorkflow(id);
    if (!existing) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    await workflowService.deleteWorkflow(id);
    return c.json({ message: "Workflow deleted successfully" });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return c.json({ error: "Failed to delete workflow" }, 500);
  }
});

// POST /api/workflows/:id/execute - Manual execution
app.post("/:id/execute", async (c) => {
  try {
    const id = c.req.param("id");
    const payload = await c.req.json();

    const workflow = await workflowService.getWorkflow(id);
    if (!workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    if (workflow.status !== "active") {
      return c.json({ error: "Workflow is not active" }, 400);
    }

    const execution = await workflowService.executeWorkflow(id, payload);
    return c.json(execution);
  } catch (error) {
    console.error("Error executing workflow:", error);
    return c.json({ error: "Failed to execute workflow" }, 500);
  }
});

// POST /api/workflows/:id/activate - Activate workflow
app.post("/:id/activate", async (c) => {
  try {
    const id = c.req.param("id");
    const updated = await workflowService.updateWorkflow(id, {
      status: "active"
    });

    // Enable triggers
    const workflow = await workflowService.getWorkflow(id);
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
    const id = c.req.param("id");
    const updated = await workflowService.updateWorkflow(id, {
      status: "inactive"
    });

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
    const id = c.req.param("id");
    const { limit, offset, status } = c.req.query();

    const executions = await workflowService.getWorkflowExecutions(id, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      status: status as "pending" | "running" | "completed" | "failed"
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
