# Workflow Engine Implementation Plan

## Project Overview

Implementation of a generic workflow engine inspired by ActivePieces, built with:

- **Hono** - Modern web framework for the API server
- **BullMQ** - Queue system for workflow execution and events
- **Supabase** - Database for workflow definitions, executions, and state management
- **TypeScript** - Type-safe development
- **pnpm** - Package manager for monorepo workspace

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Hono API      │    │   BullMQ        │    │   Supabase      │
│   Server        │────│   Queues        │    │   Database      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Workflow      │    │   Execution     │    │   Node Types    │
│   Manager       │    │   Engine        │    │   Registry      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Phase 1: Project Setup & Core Infrastructure

### 1.1 Package Configuration

Create proper `package.json` with dependencies:

- Hono and Node.js adapter
- BullMQ and Redis client
- Supabase client
- TypeScript and build tools
- Zod for validation

### 1.2 Database Schema (Supabase)

```sql
-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL, -- Workflow JSON definition
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active, inactive, archived
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL UNIQUE, -- Generated execution ID
  status TEXT NOT NULL, -- pending, running, completed, failed
  trigger_payload JSONB,
  step_results JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow triggers (for webhook registration)
CREATE TABLE workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- webhook, schedule, manual
  webhook_url TEXT UNIQUE, -- For webhook triggers
  webhook_secret TEXT, -- For webhook validation
  schedule_cron TEXT, -- For scheduled triggers
  settings JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Execution steps (for detailed tracking)
CREATE TABLE execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL, -- trigger, action
  status TEXT NOT NULL, -- pending, running, completed, failed
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_triggers_webhook_url ON workflow_triggers(webhook_url);
CREATE INDEX idx_execution_steps_execution_id ON execution_steps(execution_id);
```

### 1.3 Project Structure

```
apps/workflows/
├── src/
│   ├── api/              # Hono API routes
│   │   ├── index.ts      # Main API server
│   │   ├── workflows.ts  # Workflow CRUD operations
│   │   ├── executions.ts # Execution management
│   │   └── webhooks.ts   # Webhook endpoints
│   ├── engine/           # Core workflow engine
│   │   ├── executor.ts   # Workflow execution engine
│   │   ├── registry.ts   # Node registry
│   │   ├── context.ts    # Execution context
│   │   └── queue.ts      # BullMQ integration
│   ├── nodes/            # Node implementations
│   │   ├── triggers/     # Trigger nodes
│   │   │   ├── webhook.ts
│   │   │   ├── schedule.ts
│   │   │   └── manual.ts
│   │   └── actions/      # Action nodes
│   │       ├── http.ts
│   │       ├── transform.ts
│   │       ├── condition.ts
│   │       └── delay.ts
│   ├── database/         # Supabase integration
│   │   ├── client.ts     # Supabase client
│   │   ├── workflows.ts  # Workflow DB operations
│   │   └── executions.ts # Execution DB operations
│   ├── types/            # TypeScript definitions
│   │   ├── workflow.ts   # Workflow types
│   │   ├── execution.ts  # Execution types
│   │   └── nodes.ts      # Node types
│   └── utils/            # Utilities
│       ├── validation.ts # Zod schemas
│       ├── logger.ts     # Logging
│       └── config.ts     # Configuration
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Phase 2: Core Engine Development

### 2.1 Type Definitions

```typescript
// src/types/workflow.ts
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  trigger: TriggerStep;
  steps: Record<string, ActionStep>;
}

export interface BaseStep {
  name: string;
  displayName: string;
  nextAction?: string;
  settings: Record<string, any>;
}

export interface TriggerStep extends BaseStep {
  type: "TRIGGER";
  triggerType: string;
}

export interface ActionStep extends BaseStep {
  type: "ACTION";
  actionType: string;
}

// src/types/execution.ts
export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  triggerPayload: any;
  stepResults: Map<string, StepResult>;
}

export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}
```

### 2.2 Workflow Executor

Implement the core execution engine with BullMQ integration:

```typescript
// src/engine/executor.ts
export class WorkflowExecutor {
  private nodeRegistry: NodeRegistry;
  private queue: Queue;

  async execute(
    workflow: WorkflowDefinition,
    triggerPayload: any
  ): Promise<void> {
    // Add execution job to BullMQ queue
    await this.queue.add("execute-workflow", {
      workflowId: workflow.id,
      triggerPayload,
      workflow
    });
  }

  async processExecution(job: Job): Promise<void> {
    const { workflow, triggerPayload } = job.data;
    const context = this.createExecutionContext(workflow, triggerPayload);

    try {
      // Execute workflow steps
      await this.executeWorkflow(workflow, context);
    } catch (error) {
      // Handle execution error
      await this.handleExecutionError(context, error);
    }
  }
}
```

### 2.3 Node Registry System

Create extensible node registry for triggers and actions:

```typescript
// src/engine/registry.ts
export class NodeRegistry {
  private triggers = new Map<string, TriggerNode>();
  private actions = new Map<string, ActionNode>();

  registerTrigger(type: string, node: TriggerNode): void;
  registerAction(type: string, node: ActionNode): void;
  getTrigger(type: string): TriggerNode | undefined;
  getAction(type: string): ActionNode | undefined;
}
```

## Phase 3: Hono API Server

### 3.1 Main API Server

```typescript
// src/api/index.ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { validator } from "hono/validator";

import workflowRoutes from "./workflows.js";
import executionRoutes from "./executions.js";
import webhookRoutes from "./webhooks.js";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Routes
app.route("/api/workflows", workflowRoutes);
app.route("/api/executions", executionRoutes);
app.route("/webhooks", webhookRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default app;

// Start server
const port = Number(process.env.PORT) || 3000;
serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`Workflow engine running on http://localhost:${info.port}`);
  }
);
```

### 3.2 Workflow Management API

```typescript
// src/api/workflows.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { workflowSchema } from "../utils/validation.js";
import { WorkflowService } from "../database/workflows.js";

const app = new Hono();
const workflowService = new WorkflowService();

// GET /api/workflows - List workflows
app.get("/", async (c) => {
  const workflows = await workflowService.listWorkflows();
  return c.json(workflows);
});

// POST /api/workflows - Create workflow
app.post("/", zValidator("json", workflowSchema), async (c) => {
  const workflow = c.req.valid("json");
  const created = await workflowService.createWorkflow(workflow);
  return c.json(created, 201);
});

// GET /api/workflows/:id - Get workflow
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const workflow = await workflowService.getWorkflow(id);
  if (!workflow) {
    return c.json({ error: "Workflow not found" }, 404);
  }
  return c.json(workflow);
});

// PUT /api/workflows/:id - Update workflow
app.put("/:id", zValidator("json", workflowSchema), async (c) => {
  const id = c.req.param("id");
  const updates = c.req.valid("json");
  const updated = await workflowService.updateWorkflow(id, updates);
  return c.json(updated);
});

// POST /api/workflows/:id/execute - Manual execution
app.post("/:id/execute", async (c) => {
  const id = c.req.param("id");
  const payload = await c.req.json();

  const execution = await workflowService.executeWorkflow(id, payload);
  return c.json(execution);
});

export default app;
```

### 3.3 Webhook Handler

```typescript
// src/api/webhooks.ts
import { Hono } from "hono";
import { WebhookService } from "../database/workflows.js";

const app = new Hono();
const webhookService = new WebhookService();

// POST /webhooks/:webhookId - Webhook endpoint
app.post("/:webhookId", async (c) => {
  const webhookId = c.req.param("webhookId");
  const payload = await c.req.json();
  const headers = Object.fromEntries(c.req.raw.headers.entries());

  try {
    const execution = await webhookService.handleWebhook(
      webhookId,
      payload,
      headers
    );
    return c.json({ executionId: execution.id });
  } catch (error) {
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

export default app;
```

## Phase 4: BullMQ Integration

### 4.1 Queue Configuration

```typescript
// src/engine/queue.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { WorkflowExecutor } from "./executor.js";

const redis = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379
});

export const workflowQueue = new Queue("workflow-execution", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    }
  }
});

// Worker for processing workflow executions
export const workflowWorker = new Worker(
  "workflow-execution",
  async (job) => {
    const executor = new WorkflowExecutor();
    await executor.processExecution(job);
  },
  {
    connection: redis,
    concurrency: 5
  }
);

// Event listeners
workflowWorker.on("completed", (job) => {
  console.log(`Workflow execution ${job.id} completed`);
});

workflowWorker.on("failed", (job, err) => {
  console.error(`Workflow execution ${job?.id} failed:`, err);
});
```

### 4.2 Queue Management

```typescript
// src/engine/queue-manager.ts
export class QueueManager {
  async addWorkflowExecution(
    workflowId: string,
    triggerPayload: any,
    options?: JobOptions
  ): Promise<Job> {
    return await workflowQueue.add(
      "execute-workflow",
      {
        workflowId,
        triggerPayload,
        timestamp: new Date().toISOString()
      },
      options
    );
  }

  async scheduleWorkflow(
    workflowId: string,
    cronExpression: string
  ): Promise<void> {
    await workflowQueue.add(
      "execute-workflow",
      {
        workflowId,
        triggerPayload: { trigger: "schedule" }
      },
      {
        repeat: { cron: cronExpression },
        jobId: `scheduled-${workflowId}`
      }
    );
  }

  async cancelScheduledWorkflow(workflowId: string): Promise<void> {
    await workflowQueue.removeRepeatable("execute-workflow", {
      jobId: `scheduled-${workflowId}`
    });
  }
}
```

## Phase 5: Supabase Integration

### 5.1 Database Client

```typescript
// src/database/client.ts
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

### 5.2 Workflow Database Operations

```typescript
// src/database/workflows.ts
import { supabase } from "./client.js";
import { WorkflowDefinition } from "../types/workflow.js";

export class WorkflowService {
  async createWorkflow(workflow: WorkflowDefinition) {
    const { data, error } = await supabase
      .from("workflows")
      .insert({
        name: workflow.name,
        description: workflow.description,
        definition: workflow,
        version: workflow.version
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getWorkflow(id: string) {
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  async listWorkflows() {
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  async executeWorkflow(workflowId: string, triggerPayload: any) {
    // Create execution record
    const { data: execution, error } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        execution_id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: "pending",
        trigger_payload: triggerPayload
      })
      .select()
      .single();

    if (error) throw error;

    // Add to queue for processing
    const queueManager = new QueueManager();
    await queueManager.addWorkflowExecution(workflowId, triggerPayload);

    return execution;
  }
}
```

## Phase 6: Node Implementations

### 6.1 Base Node Classes

```typescript
// src/nodes/base.ts
export abstract class BaseTriggerNode implements TriggerNode {
  abstract name: string;
  abstract displayName: string;
  abstract description: string;
  abstract version: string;

  abstract execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult>;

  async onEnable?(settings: Record<string, any>): Promise<void>;
  async onDisable?(settings: Record<string, any>): Promise<void>;
}

export abstract class BaseActionNode implements ActionNode {
  abstract name: string;
  abstract displayName: string;
  abstract description: string;
  abstract version: string;

  abstract execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult>;

  async test?(settings: Record<string, any>): Promise<StepResult>;
}
```

### 6.2 Essential Nodes

#### Webhook Trigger

```typescript
// src/nodes/triggers/webhook.ts
export class WebhookTrigger extends BaseTriggerNode {
  name = "webhook";
  displayName = "Webhook Trigger";
  description = "Triggers when a webhook is called";
  version = "1.0.0";

  async execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult> {
    return {
      success: true,
      output: context.triggerPayload,
      metadata: {
        timestamp: new Date().toISOString(),
        webhookUrl: settings.webhookUrl
      }
    };
  }
}
```

#### HTTP Request Action

```typescript
// src/nodes/actions/http.ts
export class HttpRequestAction extends BaseActionNode {
  name = "http-request";
  displayName = "HTTP Request";
  description = "Makes an HTTP request";
  version = "1.0.0";

  async execute(
    settings: Record<string, any>,
    context: ExecutionContext
  ): Promise<StepResult> {
    try {
      const url = context.resolveValue(settings.url);
      const method = settings.method || "GET";
      const headers = settings.headers || {};
      const body = settings.body
        ? context.resolveValue(settings.body)
        : undefined;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : undefined
      });

      const responseData = await response.json();

      return {
        success: response.ok,
        output: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData
        },
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: null
      };
    }
  }
}
```

## Phase 7: Configuration & Deployment

### 7.1 Environment Configuration

```typescript
// src/utils/config.ts
import { z } from "zod";

const configSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().default("6379"),
  WEBHOOK_BASE_URL: z.string()
});

export const config = configSchema.parse(process.env);
```

### 7.2 Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/api/index.ts",
    "build": "tsc",
    "start": "node dist/api/index.js",
    "worker": "tsx src/engine/worker.ts",
    "test": "vitest",
    "lint": "eslint src --ext .ts",
    "db:migrate": "supabase db push"
  }
}
```

### 7.3 Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/api/index.js"]
```

## Phase 8: Testing Strategy

### 8.1 Unit Tests

- Node execution tests
- Workflow validation tests
- Database operation tests

### 8.2 Integration Tests

- API endpoint tests
- Queue processing tests
- End-to-end workflow execution tests

### 8.3 Load Testing

- Concurrent workflow execution
- Queue performance under load
- Database performance optimization

## Implementation Timeline

### Week 1-2: Foundation

- [x] Project setup and configuration
- [x] Database schema creation
- [x] Basic TypeScript project structure
- [x] Hono API server setup

### Week 3-4: Core Engine

- [ ] Workflow executor implementation
- [ ] Node registry system
- [ ] Execution context management
- [ ] BullMQ integration

### Week 5-6: API & Database

- [ ] Workflow CRUD operations
- [ ] Execution management APIs
- [ ] Webhook handling
- [ ] Supabase integration

### Week 7-8: Nodes & Testing

- [ ] Essential node implementations
- [ ] Comprehensive testing suite
- [ ] Documentation and examples
- [ ] Performance optimization

## Success Metrics

1. **Functionality**: Successfully execute workflows with multiple steps
2. **Performance**: Handle 1000+ concurrent workflow executions
3. **Reliability**: 99.9% uptime with proper error handling
4. **Scalability**: Easy addition of new node types
5. **Usability**: Clear API documentation and examples

## Future Enhancements

1. **Visual Workflow Builder**: Web-based drag-and-drop interface
2. **Advanced Scheduling**: Complex cron expressions and timezone support
3. **Conditional Logic**: If/else branching and loops
4. **Error Handling**: Retry mechanisms and error recovery
5. **Monitoring**: Execution metrics and alerting
6. **Templates**: Pre-built workflow templates
7. **Multi-tenant**: Workspace and user management
8. **API Gateway Integration**: Rate limiting and authentication

This implementation plan provides a comprehensive roadmap for building a production-ready workflow engine using modern technologies while maintaining flexibility for future enhancements.
