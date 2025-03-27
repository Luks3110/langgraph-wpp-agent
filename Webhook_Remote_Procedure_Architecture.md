# Webhook and Remote Procedure Architecture

## 1. Overview

This architecture extends the Workflow Engine V2 to support the persistence of workflows in a database and the creation of webhook endpoints associated with specific workflow nodes. The design follows SOLID principles to ensure maintainability, flexibility, and scalability.

## 2. Core Components

### 2.1 Workflow Storage Services

#### WorkflowRepository
```typescript
interface WorkflowRepository {
  save(workflow: WorkflowDefinition): Promise<string>;
  findById(id: string): Promise<WorkflowDefinition | null>;
  findByTenantId(tenantId: string): Promise<WorkflowDefinition[]>;
  update(id: string, workflow: Partial<WorkflowDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}

// Implementation could use MongoDB, PostgreSQL, etc.
class MongoWorkflowRepository implements WorkflowRepository {
  // Implementation details...
}
```

#### WorkflowVersioningService
```typescript
interface WorkflowVersioningService {
  createVersion(workflowId: string): Promise<string>;
  getVersion(workflowId: string, version: string): Promise<WorkflowDefinition>;
  listVersions(workflowId: string): Promise<VersionInfo[]>;
  revertToVersion(workflowId: string, version: string): Promise<void>;
}
```

### 2.2 Webhook Management

#### WebhookDefinition
```typescript
interface WebhookDefinition {
  id: string;
  name: string;
  workflowId: string;
  nodeId: string;
  tenantId: string;
  provider: WebhookProviderType;
  authToken: string;
  secretKey?: string;  // For webhook validation
  config: WebhookConfig;
  createdAt: Date;
  updatedAt: Date;
}

type WebhookProviderType = 'whatsapp' | 'mercadolibre' | 'zapier' | 'generic';

interface WebhookConfig {
  headers?: Record<string, string>;
  expectedPayloadSchema?: Record<string, any>;
  transformationTemplate?: string;
  retryPolicy?: RetryPolicy;
}
```

#### WebhookRepository
```typescript
interface WebhookRepository {
  save(webhook: WebhookDefinition): Promise<string>;
  findById(id: string): Promise<WebhookDefinition | null>;
  findByNodeId(nodeId: string): Promise<WebhookDefinition[]>;
  findByTenantId(tenantId: string): Promise<WebhookDefinition[]>;
  findByWorkflowId(workflowId: string): Promise<WebhookDefinition[]>;
  update(id: string, webhook: Partial<WebhookDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
```

#### WebhookService
```typescript
interface WebhookService {
  createWebhook(definition: Omit<WebhookDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookDefinition>;
  getWebhookUrl(webhookId: string): string;
  validateWebhook(webhookId: string, payload: any, headers: Record<string, string>): Promise<boolean>;
  processWebhookEvent(webhookId: string, payload: any): Promise<void>;
  regenerateAuthToken(webhookId: string): Promise<string>;
}
```

### 2.3 Provider-Specific Adapters

```typescript
interface WebhookProviderAdapter {
  validatePayload(webhook: WebhookDefinition, payload: any, headers: Record<string, string>): Promise<boolean>;
  transformPayload(webhook: WebhookDefinition, payload: any): Promise<any>;
  generateWebhookConfig(webhook: WebhookDefinition): WebhookProviderConfig;
}

// Provider-specific implementations
class WhatsAppWebhookAdapter implements WebhookProviderAdapter {
  // Implementation for WhatsApp webhooks
}

class MercadoLibreWebhookAdapter implements WebhookProviderAdapter {
  // Implementation for MercadoLibre webhooks
}

// Factory to get the right adapter
class WebhookAdapterFactory {
  static getAdapter(providerType: WebhookProviderType): WebhookProviderAdapter {
    // Return appropriate adapter based on provider type
  }
}
```

### 2.4 Webhook Router and API

```typescript
class WebhookRouter {
  constructor(
    private webhookRepository: WebhookRepository,
    private webhookService: WebhookService,
    private workflowOrchestratorClient: WorkflowOrchestratorClient
  ) {}

  async handleWebhookRequest(webhookId: string, payload: any, headers: Record<string, string>): Promise<void> {
    // 1. Validate the webhook exists
    // 2. Authenticate the request
    // 3. Validate payload format
    // 4. Transform payload if needed
    // 5. Trigger workflow execution
  }
}
```

### 2.5 Workflow Orchestrator Integration

```typescript
interface WorkflowOrchestratorClient {
  triggerNodeExecution(workflowId: string, nodeId: string, input: any): Promise<void>;
  getNodeExecutionStatus(workflowId: string, nodeId: string, executionId: string): Promise<NodeExecutionStatus>;
}
```

## 3. API Endpoints

### 3.1 Workflow Management API

```
POST /api/workflows
- Create a new workflow
- Body: WorkflowDefinition without id

GET /api/workflows
- List all workflows for the authenticated tenant
- Query params: page, limit, status

GET /api/workflows/:id
- Get workflow by ID

PUT /api/workflows/:id
- Update a workflow
- Body: WorkflowDefinition

DELETE /api/workflows/:id
- Delete a workflow
```

### 3.2 Webhook Management API

```
POST /api/webhooks
- Create a new webhook
- Body: WebhookDefinition without id, authToken

GET /api/webhooks
- List all webhooks for the authenticated tenant
- Query params: workflowId, nodeId

GET /api/webhooks/:id
- Get webhook by ID

PUT /api/webhooks/:id
- Update a webhook
- Body: WebhookDefinition

DELETE /api/webhooks/:id
- Delete a webhook

POST /api/webhooks/:id/regenerate-token
- Regenerate the auth token for a webhook
```

### 3.3 Webhook Endpoints

```
POST /webhooks/:webhookId
- Public endpoint that receives webhook events
- Headers must include the auth token
- Body: Payload from the provider

GET /webhooks/:webhookId/status
- Public endpoint to check webhook status
- Used by providers for verification
```

## 4. Database Schema

### 4.1 Workflows Collection

```typescript
interface WorkflowDocument {
  _id: string;
  name: string;
  description: string;
  tenantId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  processedGraph: ProcessedWorkflow;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
  };
}
```

### 4.2 Webhook Collection

```typescript
interface WebhookDocument {
  _id: string;
  name: string;
  workflowId: string;
  nodeId: string;
  tenantId: string;
  provider: WebhookProviderType;
  authToken: string;
  secretKey?: string;
  config: WebhookConfig;
  status: 'active' | 'inactive';
  stats: {
    totalCalls: number;
    successfulCalls: number;
    lastCalledAt?: Date;
    lastErrorAt?: Date;
    lastError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 Webhook Events Collection

```typescript
interface WebhookEventDocument {
  _id: string;
  webhookId: string;
  receivedAt: Date;
  rawPayload: any;
  transformedPayload: any;
  headers: Record<string, string>;
  status: 'received' | 'processed' | 'failed';
  error?: string;
  processingTime?: number;
  workflowExecutionId?: string;
}
```

## 5. Security Considerations

### 5.1 Authentication

1. **Webhook Registration Protection**
   - All webhook management APIs require authenticated users with appropriate permissions
   - JWT-based authentication for tenant identification

2. **Webhook Endpoint Authentication**
   - Each webhook has a unique authToken that must be included in the headers
   - Option for HMAC signature validation for providers that support it

```typescript
interface WebhookAuthenticationService {
  validateAuthToken(webhookId: string, token: string): Promise<boolean>;
  validateHmacSignature(webhookId: string, payload: any, signature: string): Promise<boolean>;
  generateAuthToken(): string;
  generateSecretKey(): string;
}
```

### 5.2 Rate Limiting and Abuse Prevention

```typescript
interface RateLimiter {
  checkLimit(webhookId: string, ipAddress: string): Promise<boolean>;
  recordRequest(webhookId: string, ipAddress: string): Promise<void>;
}
```

## 6. Implementation Approach

### 6.1 Storage Implementation

Use MongoDB for flexible schema support, with the following collections:
- workflows
- workflow_versions
- webhooks
- webhook_events

### 6.2 API Implementation

1. Use Express.js for the API layer
2. Implement middleware for authentication, validation, and error handling
3. Create separate routers for workflow management and webhook handling

### 6.3 Webhook Processing Flow

1. Receive webhook request at `/webhooks/:webhookId`
2. Validate authentication token in headers
3. Store raw webhook event in database
4. Use provider-specific adapter to validate and transform payload
5. Trigger node execution in the Workflow Orchestrator
6. Update webhook event with processing status
7. Return appropriate response to webhook provider

```typescript
// Example implementation flow
async function processWebhook(req: Request, res: Response) {
  const { webhookId } = req.params;
  const payload = req.body;
  const headers = req.headers;
  
  try {
    // Record the webhook event
    const eventId = await webhookEventRepository.save({
      webhookId,
      receivedAt: new Date(),
      rawPayload: payload,
      headers,
      status: 'received'
    });
    
    // Quick acknowledgment to the webhook provider
    res.status(202).send({ status: 'accepted', eventId });
    
    // Process asynchronously
    processWebhookEventAsync(webhookId, eventId, payload, headers);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
}
```

## 7. Extension Points

### 7.1 Custom Provider Support

The architecture supports adding new webhook providers by:
1. Adding a new provider type to `WebhookProviderType`
2. Implementing a new adapter class that implements `WebhookProviderAdapter`
3. Updating the `WebhookAdapterFactory` to return the new adapter

### 7.2 Custom Transformations

Support for custom transformations between webhook payloads and workflow inputs:
1. JSON Path transformations
2. Template-based transformations
3. Custom JavaScript transformation functions

## 8. Deployment Considerations

### 8.1 Webhook Service Scaling

1. Deploy webhook endpoints on serverless functions for auto-scaling
2. Use a load balancer for distributing webhook traffic
3. Consider geographic distribution for low-latency webhook handling

### 8.2 Database Scaling

1. Implement sharding strategy for the webhooks collection based on tenantId
2. Set up appropriate indexes for common query patterns:
   ```
   db.webhooks.createIndex({ tenantId: 1, workflowId: 1 })
   db.webhooks.createIndex({ nodeId: 1 })
   db.webhook_events.createIndex({ webhookId: 1, receivedAt: -1 })
   ```

## 9. Monitoring and Observability

### 9.1 Webhook Health Metrics

Track and expose the following metrics:
- Webhook request count by provider
- Success/failure rates
- Processing time distribution
- Error types and frequencies

### 9.2 Alerting

Setup alerts for:
- High webhook failure rates
- Slow webhook processing
- Authentication failures indicating potential security issues
- Database or queue processing bottlenecks
