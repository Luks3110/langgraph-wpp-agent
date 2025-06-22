import { Hono } from "hono";
import { WebhookService } from "../database/workflows.js";
import { logger } from "../utils/logger.js";

const app = new Hono();
const webhookService = new WebhookService();

// POST /webhooks/:webhookId - Handle webhook
app.post("/:webhookId", async (c) => {
  const webhookId = c.req.param("webhookId");
  const startTime = Date.now();

  try {
    // Get request data
    const payload = await c.req.json().catch(() => ({}));
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const method = c.req.method;
    const url = c.req.url;

    // Log webhook received
    logger.info("Webhook received", {
      webhookId,
      method,
      url,
      headers: {
        "content-type": headers["content-type"],
        "user-agent": headers["user-agent"],
        "x-forwarded-for": headers["x-forwarded-for"]
      },
      payloadSize: JSON.stringify(payload).length
    });

    // Process webhook
    const result = await webhookService.handleWebhook(webhookId, {
      payload,
      headers,
      method,
      url,
      timestamp: new Date().toISOString()
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info("Webhook processed successfully", {
        webhookId,
        executionId: result.executionId,
        duration
      });

      return c.json({
        success: true,
        executionId: result.executionId,
        message: "Webhook processed successfully",
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn("Webhook processing failed", {
        webhookId,
        error: result.error,
        duration
      });

      return c.json(
        {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString()
        },
        400
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error("Webhook processing error", {
      webhookId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration
    });

    return c.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString()
      },
      500
    );
  }
});

// GET /webhooks/:webhookId - Get webhook info (for debugging)
app.get("/:webhookId", async (c) => {
  try {
    const webhookId = c.req.param("webhookId");
    const webhook = await webhookService.getWebhookInfo(webhookId);

    if (!webhook) {
      return c.json({ error: "Webhook not found" }, 404);
    }

    return c.json({
      id: webhook.id,
      workflowId: webhook.workflow_id,
      status: webhook.status,
      triggerType: webhook.trigger_type,
      createdAt: webhook.created_at,
      // Don't expose sensitive settings
      settings: {
        webhookUrl: (webhook.settings as any)?.webhookUrl
      }
    });
  } catch (error) {
    logger.error("Error getting webhook info", {
      webhookId: c.req.param("webhookId"),
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json({ error: "Failed to get webhook info" }, 500);
  }
});

// POST /webhooks/:webhookId/test - Test webhook (for development)
app.post("/:webhookId/test", async (c) => {
  try {
    const webhookId = c.req.param("webhookId");
    const testPayload = await c.req.json().catch(() => ({ test: true }));

    const result = await webhookService.handleWebhook(webhookId, {
      payload: testPayload,
      headers: { "content-type": "application/json" },
      method: "POST",
      url: c.req.url,
      timestamp: new Date().toISOString(),
      isTest: true
    });

    return c.json({
      success: result.success,
      executionId: result.executionId,
      error: result.error,
      testMode: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Webhook test error", {
      webhookId: c.req.param("webhookId"),
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json(
      {
        success: false,
        error: "Test failed",
        timestamp: new Date().toISOString()
      },
      500
    );
  }
});

// GET /webhooks/:webhookId/events - Get recent webhook events
app.get("/:webhookId/events", async (c) => {
  try {
    const webhookId = c.req.param("webhookId");
    const { limit } = c.req.query();

    const events = await webhookService.getWebhookEvents(webhookId, {
      limit: limit ? parseInt(limit) : 50
    });

    return c.json({
      data: events,
      meta: {
        webhookId,
        total: events.length,
        limit: limit ? parseInt(limit) : 50
      }
    });
  } catch (error) {
    logger.error("Error getting webhook events", {
      webhookId: c.req.param("webhookId"),
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json({ error: "Failed to get webhook events" }, 500);
  }
});

export default app;
