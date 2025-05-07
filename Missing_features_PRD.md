# Product Requirements Document: Workflow Execution Integration

## Overview

This document outlines the missing components needed to integrate the existing workflow definition system with the BullMQ infrastructure to create a fully functional workflow execution engine. The system already has several key components in place, including workflow definitions, BullMQ workers, and database schema, but requires additional development to orchestrate workflow execution according to the CQRS architecture pattern.

## Objective

Enable end-to-end execution of workflows where:
1. A workflow is triggered for a specific tenant
2. Tasks are executed in order by nodes using BullMQ workers
3. After each node execution, the next node is called until there are no more nodes
4. Execution uses the existing workflows table for definitions
5. The implementation follows the CQRS architecture pattern

## Current State

We currently have:
- A workflow editor UI that generates workflow definitions stored in the 'workflows' table
- BullMQ infrastructure with multiple workers (agentWorker, webhookWorker, responseWorker, schedulerWorker)
- JobQueue implementation for task management
- Database schema with workflows, channels, webhooks tables
- State machine implementation and execution engine foundations
- Node execution infrastructure

## Missing Components

1. **Workflow Execution Coordinator**
   - A service to coordinate the execution flow between nodes
   - Logic to determine which nodes should execute next based on the workflow graph
   - Integration with existing BullMQ workers

2. **Execution State Persistence**
   - Integration with the existing database to track workflow execution state
   - State tracking for individual node executions

3. **Trigger System Integration**
   - Connection between webhook/schedule triggers and workflow execution
   - Tenant-specific workflow selection

4. **Command/Query Integration**
   - Implementation of CQRS pattern specifically for workflow execution
   - Command handlers for workflow operations

## Detailed Requirements

### 1. Workflow Execution Coordinator

**Functionality:**
- Use the existing WorkflowExecutionEngine to manage execution flow
- Process workflow graph to identify node sequence
- Coordinate execution between different node types (webhook, agent, etc.)
- Handle branching and decision logic in workflows

**Technical Requirements:**
- Create connections between the WorkflowExecutionEngine and existing BullMQ workers
- Implement node sequencing logic using the existing adjacency list
- Support different node execution strategies based on node type
- Track workflow state transitions

### 2. Execution State Persistence

**Functionality:**
- Use existing database structure to store execution state
- Track input and output of each node execution
- Maintain execution history for auditing and debugging

**Technical Requirements:**
- Create methods to persist execution state to the database
- Implement querying for workflow execution status
- Support transaction-based state updates
- Ensure proper error state handling

### 3. Trigger System Integration

**Functionality:**
- Connect existing webhook and scheduler workers to the workflow execution system
- Filter workflows by tenant and trigger criteria
- Map trigger data to workflow input variables

**Technical Requirements:**
- Implement webhook URL routing with tenant/trigger parameters
- Create logic to match incoming webhooks to appropriate workflows
- Enhance scheduler to trigger workflows based on time events
- Support multiple workflows triggering from the same event

### 4. Command/Query Integration

**Functionality:**
- Implement CQRS pattern for workflow operations
- Support commands for starting, pausing, and canceling workflows
- Provide queries for workflow status and execution history

**Technical Requirements:**
- Create command handlers for workflow execution
- Implement query services for execution status and history
- Ensure proper separation between command and query paths
- Implement validation and authorization for commands

## Success Criteria

1. A workflow can be triggered through a webhook and execute completely
2. Nodes are executed in the correct order according to the workflow graph
3. Execution state is properly tracked and can be queried
4. The system follows CQRS principles with separate command and query paths
5. Multiple workflows for different tenants can execute concurrently
6. The system handles errors gracefully with proper retry mechanisms

## Implementation Constraints

1. Use the existing database schema
2. Integrate with, rather than replace, the existing BullMQ workers
3. Maintain compatibility with the current workflow graph representation
4. Follow the CQRS architecture as defined in the architectural documentation

## Out of Scope

1. User interface for monitoring workflow executions (future enhancement)
2. Advanced workflow analytics and reporting
3. Workflow versioning and migration
4. Complex authorization and permission models for workflow execution
