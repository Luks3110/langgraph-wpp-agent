import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

import workflowRoutes from "./workflows.js";
import executionRoutes from "./executions.js";
import webhookRoutes from "./webhooks.js";

const app = new Hono();

// Middleware
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use("*", logger());
app.use("*", prettyJSON());

// Error handling middleware
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
      timestamp: new Date().toISOString()
    },
    500
  );
});

// Routes
app.route("/api/workflows", workflowRoutes);
app.route("/api/executions", executionRoutes);
app.route("/webhooks", webhookRoutes);

// Health check
app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  })
);

// API info
app.get("/api", (c) =>
  c.json({
    name: "Workflow Engine API",
    version: "1.0.0",
    endpoints: {
      workflows: "/api/workflows",
      executions: "/api/executions",
      webhooks: "/webhooks",
      health: "/health"
    }
  })
);

export default app;

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;

  serve(
    {
      fetch: app.fetch,
      port
    },
    (info) => {
      console.log(
        `🚀 Workflow Engine API running on http://localhost:${info.port}`
      );
      console.log(`📋 Health check: http://localhost:${info.port}/health`);
      console.log(`📖 API info: http://localhost:${info.port}/api`);
    }
  );
}
