import { Hono } from "hono";
import { ExecutionService } from "../database/executions.js";

const app = new Hono();
const executionService = new ExecutionService();

// GET /api/executions - List all executions
app.get("/", async (c) => {
  try {
    const { limit, offset, status, workflowId } = c.req.query();

    const executions = await executionService.listExecutions({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      status: status as "pending" | "running" | "completed" | "failed",
      workflowId
    });

    return c.json({
      data: executions,
      meta: {
        total: executions.length,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
        filters: { status, workflowId }
      }
    });
  } catch (error) {
    console.error("Error listing executions:", error);
    return c.json({ error: "Failed to list executions" }, 500);
  }
});

// GET /api/executions/:id - Get execution details
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const execution = await executionService.getExecution(id);

    if (!execution) {
      return c.json({ error: "Execution not found" }, 404);
    }

    return c.json(execution);
  } catch (error) {
    console.error("Error getting execution:", error);
    return c.json({ error: "Failed to get execution" }, 500);
  }
});

// GET /api/executions/:id/steps - Get execution steps
app.get("/:id/steps", async (c) => {
  try {
    const id = c.req.param("id");
    const steps = await executionService.getExecutionSteps(id);

    return c.json({
      data: steps,
      meta: {
        executionId: id,
        total: steps.length
      }
    });
  } catch (error) {
    console.error("Error getting execution steps:", error);
    return c.json({ error: "Failed to get execution steps" }, 500);
  }
});

// POST /api/executions/:id/cancel - Cancel execution
app.post("/:id/cancel", async (c) => {
  try {
    const id = c.req.param("id");

    const execution = await executionService.getExecution(id);
    if (!execution) {
      return c.json({ error: "Execution not found" }, 404);
    }

    if (execution.status === "completed" || execution.status === "failed") {
      return c.json({ error: "Cannot cancel completed execution" }, 400);
    }

    const cancelled = await executionService.cancelExecution(id);
    return c.json(cancelled);
  } catch (error) {
    console.error("Error cancelling execution:", error);
    return c.json({ error: "Failed to cancel execution" }, 500);
  }
});

// POST /api/executions/:id/retry - Retry failed execution
app.post("/:id/retry", async (c) => {
  try {
    const id = c.req.param("id");

    const execution = await executionService.getExecution(id);
    if (!execution) {
      return c.json({ error: "Execution not found" }, 404);
    }

    if (execution.status !== "failed") {
      return c.json({ error: "Can only retry failed executions" }, 400);
    }

    const retried = await executionService.retryExecution(id);
    return c.json(retried);
  } catch (error) {
    console.error("Error retrying execution:", error);
    return c.json({ error: "Failed to retry execution" }, 500);
  }
});

// GET /api/executions/stats - Get execution statistics
app.get("/stats", async (c) => {
  try {
    const { timeframe, workflowId } = c.req.query();

    const stats = await executionService.getExecutionStats({
      timeframe: timeframe as "hour" | "day" | "week" | "month",
      workflowId
    });

    return c.json(stats);
  } catch (error) {
    console.error("Error getting execution stats:", error);
    return c.json({ error: "Failed to get execution stats" }, 500);
  }
});

// GET /api/executions/:id/logs - Get execution logs
app.get("/:id/logs", async (c) => {
  try {
    const id = c.req.param("id");
    const { level, limit } = c.req.query();

    const logs = await executionService.getExecutionLogs(id, {
      level: level as "info" | "warn" | "error" | "debug",
      limit: limit ? parseInt(limit) : 100
    });

    return c.json({
      data: logs,
      meta: {
        executionId: id,
        total: logs.length,
        level,
        limit: limit ? parseInt(limit) : 100
      }
    });
  } catch (error) {
    console.error("Error getting execution logs:", error);
    return c.json({ error: "Failed to get execution logs" }, 500);
  }
});

export default app;
