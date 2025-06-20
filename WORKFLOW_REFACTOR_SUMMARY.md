# Workflow System Refactor Summary

## Overview

The `@workflows` package has been refactored to enable workflow execution with Supabase state storage and BullMQ-based task execution. The system now supports event-driven workflow execution with persistent state management.

## Key Components Implemented

### 1. Database Schema (`supabase/migrations/00003_workflow_execution_tables.sql`)

#### New Tables:
- **`workflow_executions`**: Stores workflow execution state
  - Tracks current/completed/failed nodes
  - Stores execution variables and context
  - Manages execution status and metadata

- **`node_executions`**: Stores individual node execution results
  - Input/output data for each node
  - Error handling and retry tracking
  - Execution timing and status

- **`knowledge_collections`**: Manages RAG knowledge bases
  - Links to Qdrant collections
  - Tenant and company-specific collections
  - Metadata and access control

- **`webhook_triggers`**: Manages webhook endpoints
  - Maps webhook paths to workflows
  - Tenant isolation and security
  - Activation control

### 2. Repository Layer

#### WorkflowExecutionRepository (`infrastructure/repositories/workflowExecutionRepository.ts`)
- CRUD operations for workflow executions
- Node execution management
- Supabase integration with proper typing

#### WebhookTriggerRepository (`infrastructure/repositories/webhookTriggerRepository.ts`)
- Webhook trigger management
- Path-based lookup for incoming webhooks
- Tenant-based filtering

### 3. Node Strategies

#### WebhookTriggerNode (`domain/nodes/webhookTriggerNode.ts`)
- Processes incoming webhook data
- Applies filters and transformations
- Validates webhook signatures
- Maps input data to workflow variables

#### WhatsAppNode (`domain/nodes/whatsappNode.ts`)
- Sends WhatsApp messages via Graph API
- Supports text, template, media, and interactive messages
- Dynamic message content with template variables
- Recipient mapping from workflow data

#### RAGNode (`domain/nodes/ragNode.ts`)
- Queries Qdrant vector database for knowledge retrieval
- Supports OpenAI embeddings
- Tenant-specific filtering
- Configurable output formatting

### 4. Enhanced Execution Engine (`domain/execution/enhancedExecutionEngine.ts`)
- Event-driven workflow execution
- Supabase state persistence
- BullMQ job queuing
- Node dependency resolution
- Error handling and recovery

### 5. API Routes (`api/webhook/webhookExecutionRoutes.ts`)
- Webhook trigger handling
- Execution status monitoring
- Webhook trigger management
- RESTful API design

## Implementation Flow

### Webhook Trigger Flow:
```
1. POST /webhook/{path} → Webhook received
2. Find webhook trigger in DB
3. Create workflow execution record
4. Queue initial nodes for execution
5. Process nodes sequentially based on dependencies
6. Update execution state in Supabase
7. Trigger next nodes when dependencies complete
```

### Node Execution Flow:
```
1. BullMQ picks up node execution job
2. Load workflow execution context from Supabase
3. Execute node strategy (webhook/whatsapp/rag)
4. Store node execution result in DB
5. Update workflow execution state
6. Queue dependent nodes if ready
7. Complete workflow if all nodes finished
```

## Essential Node Types Implementation

### 1. Webhook Trigger Node
- **Purpose**: Entry point for webhook-triggered workflows
- **Configuration**:
  ```typescript
  {
    webhookPath: string;
    webhookSecret?: string;
    validateSignature?: boolean;
    inputMapping?: Record<string, string>;
    filters?: Array<FilterCondition>;
  }
  ```
- **Functionality**: Processes incoming webhook data, applies filters, maps to workflow variables

### 2. WhatsApp Node
- **Purpose**: Send WhatsApp messages through Meta's Graph API
- **Configuration**:
  ```typescript
  {
    accessToken: string;
    phoneNumberId: string;
    messageType: 'text' | 'template' | 'media' | 'interactive';
    messageConfig: MessageConfiguration;
    recipientMapping: RecipientMapping;
  }
  ```
- **Functionality**: Sends messages with dynamic content, supports all WhatsApp message types

### 3. RAG Node
- **Purpose**: Query knowledge base using vector similarity search
- **Configuration**:
  ```typescript
  {
    knowledgeCollectionId: string;
    qdrantConfig: QdrantConfiguration;
    queryConfig: QueryConfiguration;
    filterConfig?: FilterConfiguration;
    outputConfig: OutputConfiguration;
    embeddingConfig?: EmbeddingConfiguration;
  }
  ```
- **Functionality**: Queries Qdrant with tenant filtering, formats results, supports OpenAI embeddings

## Integration Points

### With Existing Services:

1. **WhatsApp Service** (`apps/whatsapp-service`):
   - Can trigger workflows via webhook nodes
   - Receives responses from WhatsApp workflow nodes
   - Shares message processing logic

2. **Products Agent** (`apps/products-agent`):
   - Uses RAG nodes for product knowledge retrieval
   - Can be triggered by workflow webhooks
   - Integrates with Qdrant database

3. **Frontend** (`apps/supa-agent-frontend`):
   - Workflow definition and editing
   - Execution monitoring and debugging
   - Webhook trigger configuration

### External Integrations:

1. **Qdrant Vector Database**:
   - Stores knowledge embeddings
   - Tenant-specific collections
   - Vector similarity search

2. **WhatsApp Graph API**:
   - Message sending
   - Media handling
   - Template management

3. **OpenAI API**:
   - Text embeddings for RAG
   - Optional AI-powered content generation

## Configuration Examples

### Simple WhatsApp Workflow:
```json
{
  "nodes": [
    {
      "id": "webhook-trigger",
      "type": "webhookTrigger",
      "config": {
        "webhookPath": "/customer-message",
        "inputMapping": {
          "customerPhone": "payload.from",
          "message": "payload.text.body"
        }
      }
    },
    {
      "id": "rag-search",
      "type": "rag",
      "config": {
        "knowledgeCollectionId": "customer-support",
        "qdrantConfig": {
          "url": "http://qdrant:6333",
          "collectionName": "support-docs"
        },
        "queryConfig": {
          "inputTextField": "message",
          "similarityThreshold": 0.7,
          "maxResults": 3
        }
      }
    },
    {
      "id": "whatsapp-response",
      "type": "whatsapp",
      "config": {
        "accessToken": "${WHATSAPP_TOKEN}",
        "phoneNumberId": "${PHONE_NUMBER_ID}",
        "messageType": "text",
        "messageConfig": {
          "text": "Based on your query: {{combinedContent}}"
        },
        "recipientMapping": {
          "phoneNumberField": "customerPhone"
        }
      }
    }
  ],
  "edges": [
    { "source": "webhook-trigger", "target": "rag-search" },
    { "source": "rag-search", "target": "whatsapp-response" }
  ]
}
```

## Deployment Requirements

### Environment Variables:
```
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key

# Redis/BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-password

# WhatsApp
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=optional-api-key

# OpenAI (for embeddings)
OPENAI_API_KEY=your-openai-key
```

### Dependencies to Install:
```bash
# Core dependencies
npm install @supabase/supabase-js
npm install bullmq ioredis
npm install hono

# Node.js types (for crypto functions)
npm install --save-dev @types/node
```

## Next Steps for Complete Implementation

1. **Fix Import Dependencies**:
   - Install missing packages (hono, @types/node)
   - Fix relative import paths
   - Resolve interface mismatches

2. **Register New Node Strategies**:
   ```typescript
   // In NodeExecutionFactory
   this.registerStrategy('webhookTrigger', new WebhookTriggerNodeStrategy());
   this.registerStrategy('whatsapp', new WhatsAppNodeStrategy());
   this.registerStrategy('rag', new RAGNodeStrategy());
   ```

3. **Setup BullMQ Workers**:
   - Create workers for workflow-execution-start jobs
   - Create workers for workflow-node-execution jobs
   - Handle job failures and retries

4. **Update Main Application**:
   - Integrate new repositories
   - Add webhook execution routes
   - Setup enhanced execution engine

5. **Database Migration**:
   - Run the migration to create new tables
   - Update Supabase types if needed
   - Setup proper indexes and constraints

6. **Testing**:
   - Unit tests for node strategies
   - Integration tests for workflow execution
   - End-to-end tests for webhook triggers

## Benefits of This Architecture

1. **Scalability**: Event-driven execution with BullMQ queuing
2. **Reliability**: Persistent state in Supabase with retry mechanisms
3. **Observability**: Complete execution tracking and monitoring
4. **Extensibility**: Easy to add new node types and strategies
5. **Multi-tenancy**: Built-in tenant isolation and security
6. **Integration**: Seamless integration with existing services

The refactored system provides a robust foundation for building complex, multi-step workflows that can be triggered by webhooks, process data through various nodes (including AI-powered RAG searches), and output results through multiple channels like WhatsApp.