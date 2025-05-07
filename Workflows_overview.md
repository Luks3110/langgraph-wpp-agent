# Workflow Engine Overview

The @workflows package provides a scalable, event-driven workflow execution engine built on TypeScript and Node.js. This engine enables the creation, management, and execution of workflows across multiple channels including WhatsApp, Instagram, and other messaging platforms.

## Core Features

- **Multi-tenant execution** with isolation between different clients
- **Event-driven architecture** using BullMQ for reliable job processing
- **State machine-based workflow execution** with clear node transitions
- **Flexible node strategies** for different types of operations (messaging, API calls, LLM interactions)
- **Error recovery and retry mechanisms** for resilient workflow execution
- **Webhook integration** for triggering workflows from external services
- **Scheduled events** for time-based workflow execution

## Key Components

- **Workflow Execution Engine**: Orchestrates the execution of workflow nodes
- **State Machine**: Manages workflow state transitions
- **Node Execution Strategies**: Specialized handlers for different node types
- **Event Bus**: Facilitates communication between workflow components
- **Job Queue**: Manages asynchronous execution of workflow nodes
- **History Tracker**: Records execution details for monitoring and debugging

## Data Flow

1. **Trigger Reception**: External event (webhook, scheduled timer) is received
2. **Workflow Initiation**: Create execution context and start the workflow state machine
3. **Node Execution**: Process each node according to its type and configuration
4. **State Transitions**: Move through the workflow graph based on execution results
5. **Result Handling**: Process final output and trigger any follow-up actions

## Integration Points

- **WhatsApp/Instagram APIs**: For messaging channel integration
- **LangGraph**: For AI agent workflows
- **Supabase**: For persistent storage of workflow definitions and execution history
- **Redis/BullMQ**: For message queuing and job processing

## Use Cases

- **Conversational AI Workflows**: Process user messages through a series of AI interactions
- **Multi-step Form Processing**: Guide users through complex data collection workflows
- **Scheduled Notifications**: Send periodic updates or reminders to users
- **Data Enrichment Pipelines**: Process and enhance data through multiple steps
