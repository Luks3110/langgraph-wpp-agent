# Workflow Engine

This service handles workflow definition, execution, and webhook integration using a CQRS architecture with Supabase for persistence.

## Features

- Create, update, and execute workflows
- Register and manage webhooks
- Process incoming webhook events
- Event-sourced architecture for audit and replay
- BullMQ integration for job processing

## Setup

### Prerequisites

- Node.js 16+
- PNPM
- Redis
- Supabase project

### Environment Variables

The following environment variables are required:

```
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# Server Configuration
PORT=3000
```

### Database Schema

Create the following tables in your Supabase project:

#### Workflows Table

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  tenant_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflows_status ON workflows(status);
```

#### Webhooks Table

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  secret TEXT
);

CREATE INDEX idx_webhooks_workflow ON webhooks(workflow_id);
CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_provider ON webhooks(provider);
```

#### Event Store Table

```sql
CREATE TABLE event_store (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sequence_number BIGINT NOT NULL
);

CREATE INDEX idx_event_store_type ON event_store(event_type);
CREATE INDEX idx_event_store_tenant ON event_store(tenant_id);
CREATE INDEX idx_event_store_timestamp ON event_store(timestamp);
```

## Development

```sh
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

## API Endpoints

- `GET /health` - Check the health of the service
- `GET /api/workflows` - Get all workflows
- `POST /api/workflows` - Create a new workflow
- `GET /api/workflows/:id` - Get a workflow by ID
- `PUT /api/workflows/:id` - Update a workflow
- `POST /api/workflows/:id/publish` - Publish a workflow
- `POST /webhooks/:webhookId/:provider` - Webhook endpoint

## Architecture

The service follows a CQRS (Command Query Responsibility Segregation) pattern:

- **Commands**: Write operations that modify state
- **Queries**: Read operations that retrieve data
- **Events**: Domain events that are dispatched when state changes

Supabase is used for data persistence with the following repositories:
- `WorkflowRepository`: Manages workflow definitions
- `WebhookRepository`: Manages webhook registrations
- `EventStoreRepository`: Stores domain events

Redis and BullMQ are used for message queuing and event processing. 
