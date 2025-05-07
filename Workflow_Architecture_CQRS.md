# CQRS Architecture for Workflow Engine

## 1. Overview

This document defines the architecture for a workflow engine in a low-code platform using Command Query Responsibility Segregation (CQRS). The architecture supports multi-tenant execution of workflows triggered by webhooks, with BullMQ for event-based orchestration.

## 2. CQRS Principles Applied

### 2.1 Command/Query Separation

- **Commands**: Operations that change state (create workflow, trigger workflow, update workflow)
- **Queries**: Operations that retrieve data without side effects (get workflow status, list workflows)

### 2.2 Data Storage Separation

- **Command Database**: Optimized for write operations, stores workflow definitions and execution state
- **Query Database**: Optimized for read operations, contains denormalized views for reporting and monitoring

## 3. Core Components

### 3.1 Command Side

#### WorkflowCommandService
Handles all operations that modify workflow state:
```typescript
interface WorkflowCommandService {
  createWorkflow(definition: WorkflowDefinitionCommand): Promise<string>;
  updateWorkflow(id: string, updates: Partial<WorkflowDefinitionCommand>): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;
  publishWorkflow(id: string): Promise<void>;
  triggerWorkflowNode(nodeId: string, input: any, metadata: TriggerMetadata): Promise<string>;
}
```

#### WebhookCommandService
Manages webhook registration and processing:
```typescript
interface WebhookCommandService {
  registerWebhook(definition: WebhookRegistrationCommand): Promise<WebhookRegistrationResult>;
  processWebhookEvent(webhookId: string, payload: any, headers: Record<string, string>): Promise<string>;
  deactivateWebhook(webhookId: string): Promise<void>;
}
```

#### Command Handlers
Process specific domain commands:
```typescript
class TriggerNodeCommandHandler {
  constructor(
    private workflowRepository: WorkflowRepository,
    private eventBus: EventBus,
    private jobQueue: JobQueue
  ) {}

  async handle(command: TriggerNodeCommand): Promise<void> {
    // Validate command
    // Create execution context
    // Publish domain events
    // Queue execution job
  }
}
```

### 3.2 Query Side

#### WorkflowQueryService
Provides read-only access to workflow data:
```typescript
interface WorkflowQueryService {
  getWorkflowById(id: string): Promise<WorkflowDefinitionQuery | null>;
  listWorkflowsByTenant(tenantId: string, filters: WorkflowFilters): Promise<WorkflowDefinitionQuery[]>;
  getWorkflowExecutions(workflowId: string): Promise<WorkflowExecutionQuery[]>;
  getNodeExecutionHistory(nodeId: string): Promise<NodeExecutionQuery[]>;
}
```

#### WebhookQueryService
Provides read-only access to webhook data:
```typescript
interface WebhookQueryService {
  getWebhookById(id: string): Promise<WebhookDefinitionQuery | null>;
  listWebhooksByWorkflow(workflowId: string): Promise<WebhookDefinitionQuery[]>;
  getWebhookEventHistory(webhookId: string): Promise<WebhookEventQuery[]>;
}
```

### 3.3 Event Bus

Facilitates communication between command and query sides:
```typescript
interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void;
}
```

### 3.4 Job Processing

#### JobQueue
Manages asynchronous task execution:
```typescript
interface JobQueue {
  addJob(queueName: string, data: any, options?: JobOptions): Promise<string>;
  getJobStatus(jobId: string): Promise<JobStatus>;
}
```

#### WorkflowExecutionProcessor
Processes workflow execution jobs:
```typescript
class WorkflowExecutionProcessor {
  constructor(
    private workflowRepository: WorkflowRepository,
    private eventBus: EventBus
  ) {}

  async process(job: Job): Promise<void> {
    // Execute workflow logic
    // Update execution state
    // Publish execution events
  }
}
```

## 4. Instagram Webhook Trigger Implementation

### 4.1 Webhook URL Structure

```
https://api.example.com/webhooks/{clientUuid}/{triggerType}/{actionType}
```

Example:
```
https://api.example.com/webhooks/550e8400-e29b-41d4-a716-446655440000/instagram/message
```

### 4.2 Webhook Handler

```typescript
class InstagramWebhookHandler {
  constructor(
    private supabaseClient: SupabaseClient,
    private jobQueue: BullMQAdapter
  ) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const { clientUuid, triggerType, actionType } = req.params;
    const payload = req.body;
    
    try {
      // Validate webhook request
      // This ensures the request is legitimate before proceeding
      this.validateWebhookRequest(req);
      
      // Log webhook receipt
      await this.logWebhookEvent(clientUuid, triggerType, actionType, payload);
      
      // Send 200 response immediately to acknowledge receipt
      res.status(200).send({ status: 'received' });
      
      // Process webhook data asynchronously
      this.processWebhookAsync(clientUuid, triggerType, actionType, payload);
    } catch (error) {
      console.error('Instagram webhook error:', error);
      res.status(400).send({ error: 'Invalid webhook request' });
    }
  }
  
  private async processWebhookAsync(
    clientUuid: string, 
    triggerType: string,
    actionType: string,
    payload: any
  ): Promise<void> {
    try {
      // 1. Retrieve client credentials from Supabase
      const credentials = await this.getClientCredentials(clientUuid);
      
      if (!credentials) {
        throw new Error(`No credentials found for client ${clientUuid}`);
      }
      
      // 2. Extract customer ID from the webhook payload
      const customerId = this.extractCustomerId(payload);
      
      // 3. Create the execution task in BullMQ
      await this.createExecutionTask(clientUuid, triggerType, actionType, payload, customerId, credentials);
    } catch (error) {
      console.error('Async webhook processing error:', error);
      // Log the error to monitoring system
      // Could also add to a dead-letter queue for retry
    }
  }
  
  private async getClientCredentials(clientUuid: string): Promise<any> {
    // Query Supabase for client credentials
    const { data, error } = await this.supabaseClient
      .from('channels')
      .select('credentials, id')
      .eq('id', clientUuid)
      .single();
      
    if (error) {
      throw new Error(`Error retrieving credentials: ${error.message}`);
    }
    
    return data;
  }
  
  private extractCustomerId(payload: any): string {
    // Extract the customer ID based on Instagram webhook format
    // This will depend on the exact format of Instagram webhooks
    // Example: If it's a message, might be something like:
    return payload.entry?.[0]?.messaging?.[0]?.sender?.id || 'unknown';
  }
  
  private async createExecutionTask(
    clientUuid: string,
    triggerType: string,
    actionType: string,
    payload: any,
    customerId: string,
    credentials: any
  ): Promise<void> {
    // Create a task in BullMQ for workflow node execution
    await this.jobQueue.addJob('workflow-node-execution', {
      // Core execution data
      nodeId: `${clientUuid}-${triggerType}-${actionType}`, // Identifier for the triggering node
      payload: payload,
      
      // Metadata for workflow context
      metadata: {
        source: 'instagram',
        sourceType: triggerType,
        actionType: actionType,
        customerId: customerId,
        clientId: clientUuid,
        receivedAt: new Date().toISOString(),
      },
      
      // Credentials needed for processing (tokenized/secure)
      credentials: credentials
    }, {
      // Job options
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: false, // Keep job history
      timeout: 30000 // 30 second timeout
    });
  }
  
  private validateWebhookRequest(req: Request): void {
    // Implement Instagram-specific validation
    // For example, verifying signatures or challenge responses
  }
  
  private async logWebhookEvent(
    clientUuid: string,
    triggerType: string,
    actionType: string,
    payload: any
  ): Promise<void> {
    // Log the received webhook to Supabase
    await this.supabaseClient
      .from('webhooks')
      .insert({
        channel_id: clientUuid,
        event_type: `${triggerType}.${actionType}`,
        payload: payload,
        received_at: new Date().toISOString()
      });
  }
}
```

### 4.3 BullMQ Implementation

```typescript
class BullMQAdapter implements JobQueue {
  private queues: Map<string, Queue>;
  
  constructor(private redisConnection: RedisConnectionOptions) {
    this.queues = new Map();
  }
  
  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, new Queue(queueName, {
        connection: this.redisConnection,
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500      // Keep last 500 failed jobs
        }
      }));
    }
    return this.queues.get(queueName)!;
  }
  
  async addJob(queueName: string, data: any, options?: JobOptions): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add('process', data, options);
    return job.id.toString();
  }
  
  async getJobStatus(jobId: string): Promise<JobStatus> {
    // Implementation to check job status across queues
    // This would require knowing which queue the job belongs to
    // Could be implemented by storing job metadata in a separate store
  }
}
```

## 5. Data Models

### 5.1 Command Models

```typescript
interface WorkflowDefinitionCommand {
  name: string;
  description?: string;
  tenantId: string;
  nodes: WorkflowNodeCommand[];
  edges: WorkflowEdgeCommand[];
  tags?: string[];
}

interface WebhookRegistrationCommand {
  name: string;
  workflowId: string;
  nodeId: string;
  tenantId: string;
  provider: WebhookProviderType;
  config?: WebhookConfigCommand;
}

interface TriggerNodeCommand {
  nodeId: string;
  input: any;
  metadata: TriggerMetadata;
}
```

### 5.2 Query Models

```typescript
interface WorkflowDefinitionQuery {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  status: WorkflowStatus;
  nodes: WorkflowNodeQuery[];
  edges: WorkflowEdgeQuery[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    tags: string[];
    executionCount: number;
    lastExecuted?: string;
  };
}

interface WebhookDefinitionQuery {
  id: string;
  name: string;
  workflowId: string;
  nodeId: string;
  tenantId: string;
  provider: WebhookProviderType;
  endpoint: string;
  status: WebhookStatus;
  stats: {
    totalCalls: number;
    successfulCalls: number;
    lastCalledAt?: string;
  };
}
```

### 5.3 Event Models

```typescript
interface DomainEvent {
  id: string;
  type: string;
  timestamp: string;
  tenantId: string;
  payload: any;
}

interface WorkflowNodeTriggeredEvent extends DomainEvent {
  type: 'workflow.node.triggered';
  payload: {
    workflowId: string;
    nodeId: string;
    triggerId: string;
    input: any;
    metadata: TriggerMetadata;
  };
}

interface WebhookReceivedEvent extends DomainEvent {
  type: 'webhook.received';
  payload: {
    webhookId: string;
    rawPayload: any;
    headers: Record<string, string>;
    receivedAt: string;
  };
}
```

## 6. Database Schema Updates

### 6.1 Command Database (PostgreSQL)

Additional tables needed:

```sql
-- Workflow executions table
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  tenant_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Node executions table
CREATE TABLE node_executions (
  id UUID PRIMARY KEY,
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id),
  node_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE domain_events (
  id UUID PRIMARY KEY,
  type VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 6.2 Query Database (Supabase Extensions)

```sql
-- Workflow summary view for quick queries
CREATE VIEW workflow_summary AS
SELECT 
  w.id,
  w.name,
  w.tenant_id,
  w.status,
  (SELECT COUNT(*) FROM workflow_executions we WHERE we.workflow_id = w.id) as execution_count,
  (SELECT MAX(started_at) FROM workflow_executions we WHERE we.workflow_id = w.id) as last_executed,
  w.created_at,
  w.updated_at
FROM workflows w;

-- Node performance view
CREATE VIEW node_performance AS
SELECT
  ne.node_id,
  COUNT(*) as execution_count,
  AVG(EXTRACT(EPOCH FROM (ne.completed_at - ne.started_at))) as avg_execution_time,
  MAX(EXTRACT(EPOCH FROM (ne.completed_at - ne.started_at))) as max_execution_time,
  COUNT(CASE WHEN ne.status = 'error' THEN 1 END) as error_count
FROM node_executions ne
GROUP BY ne.node_id;

-- Webhook analytics view
CREATE VIEW webhook_analytics AS
SELECT
  w.id as webhook_id,
  w.name,
  w.tenant_id,
  w.provider,
  COUNT(we.id) as event_count,
  COUNT(CASE WHEN we.status = 'processed' THEN 1 END) as successful_count,
  MAX(we.received_at) as last_received
FROM webhooks w
LEFT JOIN webhook_events we ON we.webhook_id = w.id
GROUP BY w.id, w.name, w.tenant_id, w.provider;
```

## 7. API Endpoints

### 7.1 Command APIs

```
POST /api/workflows
- Create a new workflow
- Body: WorkflowDefinitionCommand

PUT /api/workflows/:id
- Update an existing workflow
- Body: Partial<WorkflowDefinitionCommand>

POST /api/workflows/:id/publish
- Publish a workflow
- No body required

POST /api/webhooks
- Register a new webhook
- Body: WebhookRegistrationCommand

DELETE /api/webhooks/:id
- Deactivate a webhook
- No body required

POST /webhooks/:clientUuid/:triggerType/:actionType
- Webhook endpoint for external services
- Body: Provider-specific payload
```

### 7.2 Query APIs

```
GET /api/workflows
- List workflows
- Query params: tenantId, status, tag, page, limit

GET /api/workflows/:id
- Get workflow by ID

GET /api/workflows/:id/executions
- Get execution history for a workflow
- Query params: status, dateFrom, dateTo, page, limit

GET /api/webhooks
- List webhooks
- Query params: tenantId, workflowId, provider, page, limit

GET /api/webhooks/:id/events
- Get webhook event history
- Query params: status, dateFrom, dateTo, page, limit

GET /api/analytics/workflows
- Get workflow performance analytics
- Query params: tenantId, dateFrom, dateTo

GET /api/analytics/webhooks
- Get webhook performance analytics
- Query params: tenantId, provider, dateFrom, dateTo
```

## 8. Event Flow for Instagram Webhook

1. **Webhook Received**:
   - Instagram sends POST to `/webhooks/{clientUuid}/instagram/message`
   - `InstagramWebhookHandler` validates and acknowledges request

2. **Command Processing**:
   - Client credentials retrieved from Supabase
   - `WebhookReceivedEvent` published to event bus
   - Execution job created in BullMQ

3. **Workflow Execution**:
   - BullMQ worker picks up the job
   - `WorkflowNodeTriggeredEvent` published to event bus
   - Node execution begins with Instagram message data

4. **Event Handling**:
   - Event subscribers update query database
   - Execution status and metrics updated

5. **Next Node Triggering**:
   - When node completes, next nodes in workflow are triggered
   - Additional BullMQ jobs created for subsequent nodes

## 9. Scaling Considerations

### 9.1 Multi-Tenant Isolation

- Tenant-specific job queues for critical workflows
- Resource quotas per tenant
- Database partitioning by tenant ID

### 9.2 Performance Optimization

- Read replicas for query database
- Caching layer for frequently accessed workflows
- Separate queues for different workflow types

### 9.3 Horizontal Scaling

- Stateless API nodes behind load balancer
- Multiple BullMQ workers consuming from same queues
- Redis cluster for BullMQ persistence

## 10. Monitoring and Observability

### 10.1 Key Metrics

- Webhook reception rate by provider
- Queue lengths and processing times
- Workflow completion rates and duration
- Error rates by node type and tenant

### 10.2 Logging Strategy

- Structured logging with correlation IDs
- Tenant-aware log filtering
- Log aggregation in centralized service

### 10.3 Alerting

- Queue backup alerts
- Error rate thresholds
- Tenant-specific SLA monitoring
- Credential expiration warnings

## 11. Implementation Roadmap

### Phase 1: Core CQRS Infrastructure
- Set up command and query databases
- Implement event bus
- Create basic workflow execution engine

### Phase 2: Instagram Webhook Integration
- Implement webhook handlers
- Build credential management
- Deploy BullMQ infrastructure

### Phase 3: Scaling and Monitoring
- Add multi-tenant isolation
- Implement analytics dashboards
- Set up alerting and monitoring

### Phase 4: Additional Channel Integrations
- Extend to other social platforms
- Implement additional trigger types
- Build channel-specific adapters
