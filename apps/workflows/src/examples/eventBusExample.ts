import { randomUUID } from 'crypto';
import { NodeExecutionCompletedEvent, WorkflowNodeTriggeredEvent } from '../domain/events/index';
import { BullMQEventBus, EventBus, EventBusOptions } from '../infrastructure/eventBus/bullmqEventBus';
import { EventStore, PersistentEventStore } from '../infrastructure/eventBus/persistentEventStore';
import { EventStoreRepository } from '../infrastructure/repositories/eventStoreRepository';

/**
 * EventBus usage example with persistent event store
 */
async function runExample() {
    console.log('Starting EventBus example...');

    // Create event bus with persistent event store
    const eventBus = createEventBus();

    // Subscribe to events
    await setupSubscriptions(eventBus);

    // Publish some events
    const workflowId = await publishSampleEvents(eventBus);

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get events by workflow ID
    const workflowEvents = await eventBus.getEventsByWorkflowId(workflowId);
    console.log(`Retrieved ${workflowEvents.length} events for workflow ${workflowId}`);

    for (const event of workflowEvents) {
        console.log(`Event: ${event.type}, Job ID: ${event.metadata?.jobId || 'N/A'}`);
    }

    // Replay events from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await eventBus.replayEvents(oneHourAgo);

    // Close connections
    await eventBus.close();

    console.log('EventBus example completed');
}

function createEventBus(): EventBus {
    // Create event store repository
    const repository = new EventStoreRepository();

    // Create persistent event store
    const eventStore: EventStore = new PersistentEventStore(repository);

    // Configure EventBus
    const options: EventBusOptions = {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD
        },
        queueName: 'workflow-events',
        jobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            },
            removeOnComplete: 1000,
            removeOnFail: 5000
        },
        eventStore
    };

    return new BullMQEventBus(options);
}

async function setupSubscriptions(eventBus: EventBus): Promise<void> {
    // Subscribe to workflow node triggered events
    const workflowSubscriptionId = await eventBus.subscribe<WorkflowNodeTriggeredEvent>(
        'workflow.node.triggered',
        async (event) => {
            console.log(`Processing workflow node triggered event: ${event.id}`);
            console.log(`Node ${event.payload.nodeId} in workflow ${event.payload.workflowId}`);
        }
    );

    console.log(`Subscribed to workflow events with ID: ${workflowSubscriptionId}`);

    // Subscribe to all events (for logging)
    const logSubscriptionId = await eventBus.subscribe(
        '*',
        async (event) => {
            console.log(`[Log] Event received: ${event.type} (${event.id})`);
        }
    );

    console.log(`Subscribed logger with ID: ${logSubscriptionId}`);
}

async function publishSampleEvents(eventBus: EventBus): Promise<string> {
    // Create a unique workflow ID for this run
    const workflowId = randomUUID();

    // Create a sample workflow node triggered event
    const event: WorkflowNodeTriggeredEvent = {
        id: randomUUID(),
        type: 'workflow.node.triggered',
        timestamp: new Date().toISOString(),
        tenantId: '00000000-0000-0000-0000-000000000000',
        payload: {
            workflowId: workflowId,
            nodeId: randomUUID(),
            triggerId: randomUUID(),
            input: { message: 'Hello, world!' },
            metadata: {
                source: 'example',
                sourceType: 'test',
                actionType: 'example',
                clientId: 'test-client',
                receivedAt: new Date().toISOString()
            }
        },
        metadata: {
            workflowId: workflowId
        }
    };

    console.log(`Publishing event for workflow: ${workflowId}`);
    await eventBus.publish(event);
    console.log('Event published');

    // Publish a second event for the same workflow
    const secondEvent: NodeExecutionCompletedEvent = {
        id: randomUUID(),
        type: 'node.execution.completed',
        timestamp: new Date().toISOString(),
        tenantId: '00000000-0000-0000-0000-000000000000',
        payload: {
            nodeId: randomUUID(),
            workflowExecutionId: `${workflowId}:execution1`,
            executionId: 'execution1',
            output: { result: 'Success!' },
            duration: 150
        },
        metadata: {
            workflowId: workflowId
        }
    };

    await eventBus.publish(secondEvent);
    console.log('Second event published');

    return workflowId;
}

// Run the example when executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runExample().catch(error => {
        console.error('Error running example:', error);
        process.exit(1);
    });
}

export { createEventBus, runExample };
