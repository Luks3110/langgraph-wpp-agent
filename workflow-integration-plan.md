# Workflow Integration Plan

## Overview

This document outlines the steps needed to integrate the workflow execution engine with the existing codebase and make it operational for handling the first workflows. The plan addresses how to connect the workflow engine to triggers like webhooks and scheduled events, and how to process workflow nodes using BullMQ.

## 1. Database Schema Updates

### 1.1 Create Missing Tables

We need to create additional tables in Supabase:

```sql
-- Agent configurations table
CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  character JSONB NOT NULL,
  max_tokens INTEGER NOT NULL,
  temperature FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation history table
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution table
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  tenant_id VARCHAR(255) NOT NULL,
  state VARCHAR(50) NOT NULL,
  result JSONB,
  error TEXT,
  metadata JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Node execution table
CREATE TABLE node_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id),
  node_id VARCHAR(255) NOT NULL,
  state VARCHAR(50) NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.2 Update Supabase Types

Update the supabase.types.ts file to include the new tables in the Database interface.

## 2. Workflow Engine Integration

### 2.1 Create Database Adapters

Create adapters to persist workflow execution state in Supabase:

- WorkflowRepository: For storing and retrieving workflow definitions
- ExecutionRepository: For tracking workflow and node execution states

### 2.2 Implement Event Persistence

Modify the EventBus implementation to store events in the event_store table for auditing and recovery.

### 2.3 Connect to BullMQ

Create a dedicated queue for workflow execution:

```typescript
// src/infrastructure/bullmq/setupQueues.ts
import { Queue } from 'bullmq';
import { RedisConnection } from '../database/redis.js';

export function setupWorkflowQueues(redisConnection: RedisConnection) {
  const workflowNodeQueue = new Queue('workflow-node-execution', {
    connection: redisConnection.getConnection()
  });
  
  const workflowTriggerQueue = new Queue('workflow-trigger', {
    connection: redisConnection.getConnection()
  });
  
  return {
    workflowNodeQueue,
    workflowTriggerQueue
  };
}
```

## 3. Workflow Workers

### 3.1 Create Node Execution Worker

```typescript
// src/infrastructure/bullmq/workflowNodeWorker.ts
import { Job, Worker } from 'bullmq';
import { WorkflowExecutionEngine } from '../../domain/execution/executionEngine.js';
import { RedisConnection } from '../database/redis.js';

export class WorkflowNodeWorker {
  private worker: Worker;
  
  constructor(
    private redisConnection: RedisConnection,
    private executionEngine: WorkflowExecutionEngine
  ) {
    this.worker = new Worker(
      'workflow-node-execution',
      this.processNodeJob.bind(this),
      { connection: redisConnection.getConnection() }
    );
    
    this.setupEventHandlers();
  }
  
  private async processNodeJob(job: Job): Promise<any> {
    const { executionId, nodeId } = job.data;
    
    console.log(`Processing workflow node execution: ${nodeId} in workflow ${executionId}`);
    
    try {
      const result = await this.executionEngine.handleNodeExecutionJob({ executionId, nodeId });
      return result;
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error);
      throw error;
    }
  }
  
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Node execution completed: ${job.id}`);
    });
    
    this.worker.on('failed', (job, error) => {
      console.error(`Node execution failed: ${job?.id}`, error);
    });
  }
  
  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

### 3.2 Create Workflow Trigger Worker

```typescript
// src/infrastructure/bullmq/workflowTriggerWorker.ts
import { Job, Worker } from 'bullmq';
import { WorkflowExecutionEngine } from '../../domain/execution/executionEngine.js';
import { SupabaseConnection } from '../database/supabase.js';
import { RedisConnection } from '../database/redis.js';

export class WorkflowTriggerWorker {
  private worker: Worker;
  
  constructor(
    private redisConnection: RedisConnection,
    private supabaseConnection: SupabaseConnection,
    private executionEngine: WorkflowExecutionEngine
  ) {
    this.worker = new Worker(
      'workflow-trigger',
      this.processTriggerJob.bind(this),
      { connection: redisConnection.getConnection() }
    );
    
    this.setupEventHandlers();
  }
  
  private async processTriggerJob(job: Job): Promise<any> {
    const { workflowId, tenantId, triggerType, triggerData } = job.data;
    
    console.log(`Processing workflow trigger: ${triggerType} for workflow ${workflowId}`);
    
    try {
      // Fetch workflow definition
      const { data: workflow, error } = await this.supabaseConnection.getClient()
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();
      
      if (error || !workflow) {
        throw new Error(`Workflow not found: ${error?.message || 'Unknown error'}`);
      }
      
      // Start workflow execution
      const executionId = await this.executionEngine.startExecution(
        workflowId,
        tenantId,
        workflow,
        {
          variables: {
            trigger: {
              type: triggerType,
              data: triggerData
            }
          }
        }
      );
      
      return { executionId };
    } catch (error) {
      console.error(`Error triggering workflow ${workflowId}:`, error);
      throw error;
    }
  }
  
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Workflow trigger completed: ${job.id}`);
    });
    
    this.worker.on('failed', (job, error) => {
      console.error(`Workflow trigger failed: ${job?.id}`, error);
    });
  }
  
  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

## 4. Webhook Trigger Integration

### 4.1 Create Webhook Handler

```typescript
// src/api/webhooks/webhookHandler.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseConnection } from '../../infrastructure/database/supabase.js';
import { JobQueue } from '../../infrastructure/bullmq/jobQueue.js';

export class WebhookHandler {
  constructor(
    private supabaseConnection: SupabaseConnection,
    private jobQueue: JobQueue
  ) {}
  
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const { clientId, triggerType, actionType } = req.params;
    const payload = req.body;
    
    try {
      // Log webhook receipt
      const webhookId = await this.logWebhookEvent(clientId, triggerType, actionType, payload);
      
      // Send 200 response immediately to acknowledge receipt
      res.status(200).send({ status: 'received', webhookId });
      
      // Process webhook asynchronously
      this.processWebhookAsync(clientId, triggerType, actionType, payload, webhookId);
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).send({ error: 'Error processing webhook' });
    }
  }
  
  private async processWebhookAsync(
    clientId: string,
    triggerType: string,
    actionType: string,
    payload: any,
    webhookId: string
  ): Promise<void> {
    try {
      // Find matching workflows for this webhook trigger
      const { data: workflows, error } = await this.supabaseConnection.getClient()
        .from('workflows')
        .select('*')
        .eq('tenant_id', clientId)
        .eq('status', 'active');
      
      if (error || !workflows || workflows.length === 0) {
        console.log(`No active workflows found for client ${clientId}`);
        return;
      }
      
      // Filter workflows that have a matching trigger node
      const matchingWorkflows = workflows.filter(workflow => {
        const nodes = workflow.nodes as any[];
        return nodes.some(node => 
          node.type === 'trigger' && 
          node.config?.triggerType === triggerType &&
          node.config?.actionType === actionType
        );
      });
      
      // Queue workflow executions
      for (const workflow of matchingWorkflows) {
        await this.jobQueue.addJob('workflow-trigger', {
          workflowId: workflow.id,
          tenantId: clientId,
          triggerType: `${triggerType}.${actionType}`,
          triggerData: payload,
          webhookId
        });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  }
  
  private async logWebhookEvent(
    clientId: string,
    triggerType: string,
    actionType: string,
    payload: any
  ): Promise<string> {
    const webhookId = uuidv4();
    
    // Store webhook event in database
    await this.supabaseConnection.getClient()
      .from('webhooks')
      .insert({
        id: webhookId,
        channel_id: clientId,
        event_type: `${triggerType}.${actionType}`,
        payload,
        received_at: new Date().toISOString()
      });
      
    return webhookId;
  }
}
```

## 5. Scheduled Events Integration

### 5.1 Create Scheduler Service

```typescript
// src/infrastructure/scheduler/schedulerService.ts
import { CronJob } from 'cron';
import { SupabaseConnection } from '../database/supabase.js';
import { JobQueue } from '../bullmq/jobQueue.js';

export class SchedulerService {
  private cronJobs: Map<string, CronJob> = new Map();
  
  constructor(
    private supabaseConnection: SupabaseConnection,
    private jobQueue: JobQueue
  ) {}
  
  async initialize(): Promise<void> {
    // Load all active scheduled events
    const { data: scheduledEvents, error } = await this.supabaseConnection.getClient()
      .from('scheduled_events')
      .select('*')
      .eq('status', 'active');
      
    if (error || !scheduledEvents) {
      console.error('Error loading scheduled events:', error);
      return;
    }
    
    // Create cron jobs for each scheduled event
    for (const event of scheduledEvents) {
      this.createCronJob(event);
    }
    
    console.log(`Initialized ${this.cronJobs.size} scheduled events`);
  }
  
  private createCronJob(event: any): void {
    if (!event.schedule || !event.schedule.cron) {
      console.warn(`Scheduled event ${event.id} missing cron schedule`);
      return;
    }
    
    try {
      const job = new CronJob(
        event.schedule.cron,
        () => this.triggerScheduledEvent(event),
        null,
        true
      );
      
      this.cronJobs.set(event.id, job);
      console.log(`Scheduled event created: ${event.id} with cron ${event.schedule.cron}`);
    } catch (error) {
      console.error(`Error creating cron job for event ${event.id}:`, error);
    }
  }
  
  private async triggerScheduledEvent(event: any): Promise<void> {
    console.log(`Triggering scheduled event: ${event.id}`);
    
    try {
      // Update last run time
      const now = new Date().toISOString();
      await this.supabaseConnection.getClient()
        .from('scheduled_events')
        .update({ lastrun: now })
        .eq('id', event.id);
      
      // Queue workflow trigger
      await this.jobQueue.addJob('workflow-trigger', {
        workflowId: event.workflowid,
        tenantId: event.clientid,
        triggerType: 'schedule',
        triggerData: {
          eventId: event.id,
          data: event.data,
          triggeredAt: now
        }
      });
    } catch (error) {
      console.error(`Error processing scheduled event ${event.id}:`, error);
    }
  }
  
  async stop(): Promise<void> {
    // Stop all cron jobs
    for (const [id, job] of this.cronJobs.entries()) {
      job.stop();
      console.log(`Stopped scheduled event: ${id}`);
    }
    
    this.cronJobs.clear();
  }
}
```

## 6. Application Setup

### 6.1 Create Entry Point

```typescript
// src/index.ts
import express from 'express';
import { RedisConnection } from './infrastructure/database/redis.js';
import { SupabaseConnection } from './infrastructure/database/supabase.js';
import { setupWorkflowQueues } from './infrastructure/bullmq/setupQueues.js';
import { WorkflowNodeWorker } from './infrastructure/bullmq/workflowNodeWorker.js';
import { WorkflowTriggerWorker } from './infrastructure/bullmq/workflowTriggerWorker.js';
import { WorkflowExecutionEngine } from './domain/execution/executionEngine.js';
import { BullMqEventBus } from './infrastructure/eventBus/bullmqEventBus.js';
import { JobQueue } from './infrastructure/bullmq/jobQueue.js';
import { NodeExecutionFactory } from './domain/execution/nodeStrategy.js';
import { WebhookHandler } from './api/webhooks/webhookHandler.js';
import { SchedulerService } from './infrastructure/scheduler/schedulerService.js';

async function bootstrap() {
  // Initialize connections
  const redisConnection = new RedisConnection({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD
  });
  
  const supabaseConnection = new SupabaseConnection(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || ''
  );
  
  // Initialize queues
  const { workflowNodeQueue, workflowTriggerQueue } = setupWorkflowQueues(redisConnection);
  
  // Initialize job queue
  const jobQueue = new JobQueue(redisConnection);
  
  // Initialize event bus
  const eventBus = new BullMqEventBus(redisConnection);
  
  // Initialize node execution factory
  const nodeFactory = new NodeExecutionFactory();
  
  // Initialize workflow execution engine
  const executionEngine = new WorkflowExecutionEngine(
    eventBus,
    jobQueue,
    nodeFactory
  );
  
  // Initialize workers
  const nodeWorker = new WorkflowNodeWorker(
    redisConnection,
    executionEngine
  );
  
  const triggerWorker = new WorkflowTriggerWorker(
    redisConnection,
    supabaseConnection,
    executionEngine
  );
  
  // Initialize webhook handler
  const webhookHandler = new WebhookHandler(
    supabaseConnection,
    jobQueue
  );
  
  // Initialize scheduler service
  const schedulerService = new SchedulerService(
    supabaseConnection,
    jobQueue
  );
  
  // Start scheduler
  await schedulerService.initialize();
  
  // Set up Express app
  const app = express();
  app.use(express.json());
  
  // Webhook endpoint
  app.post('/webhooks/:clientId/:triggerType/:actionType', webhookHandler.handleWebhook.bind(webhookHandler));
  
  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Workflow service running on port ${port}`);
  });
  
  // Handle shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    
    await schedulerService.stop();
    await nodeWorker.close();
    await triggerWorker.close();
    await redisConnection.disconnect();
    
    process.exit(0);
  });
}

bootstrap().catch(error => {
  console.error('Error starting workflow service:', error);
  process.exit(1);
});
```

## 7. Testing Plan

### 7.1 Create Sample Workflow

Create a simple workflow with a webhook trigger and a few nodes to test the execution flow:

```typescript
// Example workflow creation
const workflow = {
  name: 'Test Workflow',
  description: 'A simple test workflow',
  tenant_id: 'test-client',
  status: 'active',
  nodes: [
    {
      id: 'trigger-1',
      name: 'Webhook Trigger',
      type: 'trigger',
      config: {
        triggerType: 'webhook',
        actionType: 'test'
      }
    },
    {
      id: 'process-1',
      name: 'Process Data',
      type: 'function',
      config: {
        code: 'return { result: input.data.message + " processed" };'
      }
    },
    {
      id: 'response-1',
      name: 'Send Response',
      type: 'response',
      config: {
        template: 'The processed result is: {{result}}'
      }
    }
  ],
  edges: [
    {
      source: 'trigger-1',
      target: 'process-1'
    },
    {
      source: 'process-1',
      target: 'response-1'
    }
  ],
  tags: ['test']
};
```

### 7.2 Test Procedure

1. Create the workflow in Supabase
2. Send a test webhook to trigger the workflow
3. Monitor the workflow execution in the logs
4. Verify the workflow completes successfully
5. Check the workflow_executions and node_executions tables for results

## 8. Implementation Order

1. Database schema updates
2. Core workflow engine adaptations
3. BullMQ integration
4. Webhook handler implementation
5. Worker implementation
6. Application setup
7. Testing and debugging
8. Scheduled events integration 
