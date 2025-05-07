# Event Bus and Event Store

This directory contains the implementation of the event bus and persistent event store for the workflow engine.

## Components

### 1. Event Bus (`bullmqEventBus.ts`)

The `BullMQEventBus` implements the `EventBus` interface and provides a robust messaging system using BullMQ and Redis. It supports:

- Event publishing and subscription
- Persistent event storage
- Event replay capabilities
- Error handling and retries
- Workflow tracking with workflow_id
- BullMQ job tracking with job_id

### 2. Persistent Event Store (`persistentEventStore.ts`)

The `PersistentEventStore` provides permanent storage for events and implements the `EventStore` interface. It supports:

- Saving events to a database
- Retrieving events by type, tenant, or time range
- Querying events by workflow ID
- Replaying events in chronological order
- Tracking job status and BullMQ integration

### 3. Subscription Manager (`subscriptionManager.ts`)

The `SubscriptionManager` handles event subscriptions and routing. It supports:

- Event handler registration and management
- Wildcard subscriptions (using `*`)
- Retry policies with customizable backoff strategies
- Error handling

## Usage Example

```typescript
import { BullMQEventBus, EventBusOptions } from './infrastructure/eventBus/bullmqEventBus.js';
import { PersistentEventStore } from './infrastructure/eventBus/persistentEventStore.js';
import { EventStoreRepository } from './infrastructure/repositories/eventStoreRepository.js';

// Create event store
const repository = new EventStoreRepository();
const eventStore = new PersistentEventStore(repository);

// Configure event bus
const options: EventBusOptions = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
    },
    queueName: 'workflow-events',
    eventStore
};

// Create event bus
const eventBus = new BullMQEventBus(options);

// Initialize the event bus
await eventBus.initialize();

// Subscribe to events
await eventBus.subscribe('workflow.node.triggered', async (event) => {
    console.log(`Node ${event.payload.nodeId} triggered in workflow ${event.payload.workflowId}`);
});

// Publish an event with workflow ID
await eventBus.publish({
    id: 'event-id',
    type: 'workflow.node.triggered',
    timestamp: new Date().toISOString(),
    tenantId: 'tenant-id',
    payload: {
        workflowId: 'workflow-id',
        nodeId: 'node-id'
    },
    metadata: {
        workflowId: 'workflow-id'
    }
});

// Get events for a specific workflow
const workflowEvents = await eventBus.getEventsByWorkflowId('workflow-id');
console.log(`Found ${workflowEvents.length} events for this workflow`);

// Replay events from a specific time
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
await eventBus.replayEvents(oneHourAgo);

// Clean up
await eventBus.close();
```

## Event Schema

Events follow the `DomainEvent` interface:

```typescript
interface DomainEvent {
    id: string;
    type: string;
    timestamp: string;
    tenantId: string;
    payload: any;
    metadata?: {
        jobId?: string;
        workflowId?: string;
        [key: string]: any;
    };
}
```

## Database Schema

The event store uses a SQL table with the following schema:

```sql
CREATE TABLE event_store (
  id UUID PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  sequence_number BIGINT NOT NULL,
  job_id VARCHAR,
  workflow_id VARCHAR,
  status VARCHAR DEFAULT 'processed'
);
```

The schema includes:
- **job_id**: References the BullMQ job ID for integrating with the message queue
- **workflow_id**: Groups events related to the same workflow execution
- **status**: Tracks the processing status of the event

See the migration files in `supabase/migrations` for the complete schema with indexes. 
