# LangGraph Agent Refactoring Plan

## Current Issues

1. **Tight Coupling**: The current agent implementation is tightly coupled to WhatsApp as a communication channel. This violates separation of concerns and limits reusability.

2. **Architecture Misalignment**: The implementation does not align with the workflow node architecture, where specialized nodes should communicate through queues.

3. **Responsibility Overlap**: The WhatsApp service is handling both communication and agent processing logic, which should be separate concerns.

## Refactoring Goals

1. **Decouple Agent from Channels**: Create a general-purpose agent node that can process messages regardless of their source.

2. **Follow Node Architecture**: Implement the agent as a standard workflow node that can be triggered by various events.

3. **Maintain Separation of Concerns**: Ensure each component has a single responsibility:
   - WhatsApp Service: Handle WhatsApp API interactions only
   - Agent Node: Process messages and generate responses
   - Workflow Engine: Orchestrate the flow between nodes

## Implementation Plan

### 1. Agent Node Implementation

1. Create a dedicated LangGraph agent node in the workflow engine:
   - `apps/workflows/src/nodes/agent/agentNode.ts`: Core agent processing logic
   - `apps/workflows/src/nodes/agent/prompts.ts`: Agent prompts and templates
   - `apps/workflows/src/nodes/agent/types.ts`: Type definitions for agent operations

2. Implement agent node worker using BullMQ:
   - `apps/workflows/src/infrastructure/bullmq/agentWorker.ts`: Worker to process agent tasks
   - Register the worker in the main application

### 2. WhatsApp Service Refactoring

1. Simplify WhatsApp service to focus on communication only:
   - Remove agent logic from WhatsApp service
   - Ensure WhatsApp service can queue messages to the workflow engine
   - Create a dedicated response handler for messages coming back from the agent

2. Implement proper queue integration:
   - Use BullMQ to send received messages to the workflow engine
   - Create a consumer for responses to be sent back to users

### 3. Workflow Definitions

1. Create workflow definitions for WhatsApp message processing:
   - Define node sequence (e.g., WhatsApp → Agent → WhatsApp)
   - Set up appropriate connections between nodes
   - Configure data transformations between nodes if needed

2. Set up webhook integration:
   - Ensure webhooks from WhatsApp trigger the appropriate workflow
   - Configure proper metadata and context passing

### 4. Data Flow Implementation

1. Standardize message format between nodes:
   - Define clear interfaces for messages
   - Ensure proper type safety throughout the pipeline

2. Implement proper context management:
   - Maintain conversation context across interactions
   - Support stateful conversations

### 5. Testing Strategy

1. Create unit tests for individual components:
   - Agent node logic
   - WhatsApp message handling
   - Queue operations

2. Implement integration tests:
   - End-to-end message flow
   - Error handling scenarios

## Execution Steps

1. Create the agent node implementation
2. Refactor WhatsApp service
3. Create workflow definitions
4. Set up proper queue connections
5. Test the entire flow
6. Deploy the changes

## Migration Strategy

1. Implement the changes in a non-breaking manner
2. Run both implementations in parallel temporarily
3. Gradually shift traffic to the new implementation
4. Monitor for issues and fix as needed
5. Decommission the old implementation

## Future Enhancements

1. Support for additional channels (Telegram, SMS, etc.)
2. Enhanced agent capabilities (more tools, better context handling)
3. Advanced workflow patterns (branching, conditional execution)
4. Improved monitoring and observability
