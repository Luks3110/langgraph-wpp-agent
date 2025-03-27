# Workflow Engine V2

## Overview

The Workflow Engine V2 is a distributed, event-driven system designed to execute workflows defined by the existing `WorkflowGraph` implementation. It enables the execution of both local functions and remote code, ensures reliable workflow processing, and leverages industry-standard messaging patterns for scalability and resilience.

## Integration with WorkflowGraph

This engine architecture is specifically designed to leverage the robust graph processing capabilities provided by the existing `WorkflowGraph` class. Key integrations include:

### Graph Processing and Analysis

The `WorkflowGraph` class already provides powerful functionality that our engine leverages:

- **Path Detection**: The `generateAllPaths()` method identifies all possible execution paths through the workflow, which the Orchestrator uses to plan execution
- **Branch Point Identification**: The `findBranchPoints()` method identifies decision points where workflow execution can fork
- **Convergence Point Detection**: The `findConvergencePoints()` method identifies nodes where multiple execution paths converge, which is critical for synchronization
- **Parallel Execution Groups**: The `identifyParallelExecutionGroups()` method finds node groups that can be executed concurrently, enabling efficient task scheduling

### Runtime Execution Mapping

The engine maps the `ProcessedWorkflow` structure directly to runtime execution:

```typescript
// Example of how ProcessedWorkflow maps to execution
interface ProcessedWorkflow {
  forest: {
    roots: string[];            // Entry points for workflow execution
    adjacencyList: Record<string, GraphNodeRelationship>; // Relationships for navigation
  };
  nodes: Record<string, WorkflowNode>;  // Node definitions with task details
  paths: WorkflowPath[];        // Possible execution paths
  edges: Record<string, WorkflowEdge>;  // Transitions with conditions
  execution: {
    branchPoints: string[];     // Decision points in workflow
    leafNodes: string[];        // Terminal nodes that complete workflow
    convergencePoints: string[]; // Synchronization points waiting for multiple tasks
    parallelExecutionGroups: string[][]; // Tasks that can execute in parallel
  };
}
```

## Core Components

### 1. Workflow Definition Service

- **Purpose**: Manages workflow definitions and their metadata
- **Responsibilities**:
  - CRUD operations for workflow definitions
  - Validation of workflow structure
  - Version management for workflows
  - Storage of workflows in a persistent database
- **Implementation Considerations**:
  - Uses `WorkflowGraph` class for processing and validating graph structure
  - Processes workflows using `WorkflowGraph.processWorkflow()` to identify execution paths, branch points, and convergence points
  - Stores both the raw workflow definition and the processed graph analysis
  - Exposes REST APIs for workflow management
  - Supports import/export of workflow definitions

### 2. Workflow Orchestrator

- **Purpose**: Central component that manages workflow execution
- **Responsibilities**:
  - Loads workflow definitions from the database
  - Creates and manages workflow executions
  - Tracks execution state and progress
  - Makes decisions at branch points based on conditions
  - Coordinates parallel execution paths
  - Handles error conditions and retries
- **Implementation Considerations**:
  - Directly utilizes the `ProcessedWorkflow` structure to drive execution
  - Uses `rootNodes` to identify starting points
  - Uses `adjacencyList` for traversing the workflow graph
  - Uses `branchPoints` to make decisions based on conditions
  - Uses `convergencePoints` to synchronize parallel paths
  - Uses `parallelExecutionGroups` to optimize task scheduling
  - Stateless design for horizontal scaling
  - Uses the State Manager for persistence
  - Leverages the Event Bus for asynchronous coordination

### 3. Execution Queue (BullMQ)

- **Purpose**: Manages the scheduling and execution of tasks
- **Responsibilities**:
  - Queues tasks for execution
  - Handles task prioritization
  - Manages retries and failure handling
  - Distributes tasks to available workers
- **Implementation Considerations**:
  - Organizes queues based on `parallelExecutionGroups` from WorkflowGraph
  - Creates separate queues for different task categories
  - Implements priority based on node depth and criticality
  - Built on BullMQ for robust queue management
  - Provides dead-letter queues for failed tasks
  - Enables monitoring and introspection of queues

### 4. Task Workers

- **Purpose**: Execute individual workflow tasks
- **Responsibilities**:
  - Poll the Execution Queue for tasks
  - Execute task logic based on node type
  - Handle execution timeouts
  - Report execution results back to the Orchestrator
- **Types of Workers**:
  - **Function Workers**: Execute TypeScript/JavaScript functions
  - **HTTP Workers**: Make API calls to external systems
  - **Custom Workers**: Execute specialized task types
- **Implementation Considerations**:
  - Horizontally scalable
  - Support for worker-specific configuration
  - Resource isolation between tasks

### 5. State Manager (Redis)

- **Purpose**: Maintains the state of workflow executions
- **Responsibilities**:
  - Stores workflow execution contexts
  - Caches task results
  - Provides locking mechanisms for distributed coordination
  - Enables workflow resumability after failures
- **Implementation Considerations**:
  - Stores the full `ProcessedWorkflow` structure for active workflows
  - Maintains path traversal state using `paths` from WorkflowGraph
  - Tracks completion status for each node in the `adjacencyList`
  - Uses Redis for high-performance state storage
  - TTL policies for cleaning up completed workflows
  - Optimized data structures for frequent access patterns

### 6. Event Bus (RabbitMQ)

- **Purpose**: Enables asynchronous event-driven communication
- **Responsibilities**:
  - Publishes workflow lifecycle events
  - Enables external triggering of workflows
  - Supports event-based communication between components
- **Implementation Considerations**:
  - Uses RabbitMQ for reliable message delivery
  - Supports different exchange types for different event patterns
  - Enables event filtering and routing

### 7. Monitoring & Logging Service

- **Purpose**: Provides visibility into workflow execution
- **Responsibilities**:
  - Captures execution metrics
  - Logs workflow and task events
  - Generates alerts on failures
  - Provides dashboards for operational visibility
- **Implementation Considerations**:
  - Visualizes workflow execution using the graph structure from `WorkflowGraph`
  - Provides path-based execution views using `paths` from WorkflowGraph
  - Identifies bottlenecks using node execution time metrics
  - Structured logging format
  - Integration with monitoring systems (Prometheus, etc.)
  - Support for distributed tracing

## Data Models

### Workflow Definition

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];  // From WorkflowGraph.ts
  edges: WorkflowEdge[];  // From WorkflowGraph.ts
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
  };
  // The processed graph structure
  processedGraph?: ProcessedWorkflow;  // From WorkflowGraph.processWorkflow()
}
```

### Node Structure and Types

```typescript
interface Node {
  id: string;                   // Unique identifier (UUID)
  type: NodeType;               // Type of node (function, decision, webhook, etc.)
  name: string;                 // Human-readable name
  description?: string;         // Optional description
  workflowId: string;           // ID of the workflow this node belongs to
  version: number;              // Node version
  position: NodePosition;       // Visual position in the workflow editor
  data: NodeData;               // Node-specific configuration data
  metadata: NodeMetadata;       // Additional metadata
}

type NodeType = 'function' | 'http' | 'decision' | 'webhook' | 'trigger' | 'delay' | 'transformation' | 'custom';

interface NodePosition {
  x: number;
  y: number;
}

interface NodeMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
  category?: string;
  isPublic?: boolean;           // Whether this node definition can be reused across workflows
}
```

### Node Data Specializations

```typescript
// Base interface for all node-specific data
interface NodeData {
  [key: string]: any;
}

// Function node that executes a JavaScript/TypeScript function
interface FunctionNodeData extends NodeData {
  functionName: string;         // Name of the function to execute
  functionCode?: string;        // Optional inline code
  handlerId?: string;           // Reference to a pre-defined handler
  inputSchema?: Record<string, any>; // Expected input schema
  outputSchema?: Record<string, any>; // Expected output schema
  timeout?: number;             // Execution timeout in milliseconds
  retryPolicy?: RetryPolicy;    // How to handle retries
}

// HTTP node that makes API calls
interface HttpNodeData extends NodeData {
  url: string;                  // URL to call
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  authentication?: {
    type: 'basic' | 'bearer' | 'oauth2' | 'apiKey';
    config: Record<string, any>;
  };
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

// Decision node for branching workflows
interface DecisionNodeData extends NodeData {
  conditions: Array<{
    id: string;
    expression: string;        // JavaScript expression or JSON path condition
    description?: string;
  }>;
  defaultPath?: string;        // Default edge to follow if no conditions match
}

// Webhook receiver node
interface WebhookNodeData extends NodeData {
  provider?: WebhookProviderType;
  payloadSchema?: Record<string, any>; // Expected payload schema
  transformationTemplate?: string;     // How to transform incoming data
  webhookId?: string;                  // Reference to a configured webhook (if already set up)
}

// Trigger node that starts a workflow
interface TriggerNodeData extends NodeData {
  triggerType: 'scheduled' | 'event' | 'manual' | 'api';
  config: Record<string, any>;  // Type-specific configuration
}

// Transformation node for data mapping
interface TransformationNodeData extends NodeData {
  transformationType: 'map' | 'filter' | 'reduce' | 'enrichment';
  transformationConfig: Record<string, any>;
  template?: string;            // Optional template for complex transformations
}

// Delay/timer node
interface DelayNodeData extends NodeData {
  delayType: 'fixed' | 'until' | 'expression';
  delayValue: string | number;  // Duration in ms, timestamp, or expression
}
```

### Node Execution Data

```typescript
interface NodeExecution {
  id: string;
  nodeId: string;
  workflowExecutionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  attempts: NodeExecutionAttempt[];
  metadata: Record<string, any>;
}

interface NodeExecutionAttempt {
  attemptNumber: number;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  output?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}
```

### Workflow Execution Context

```typescript
interface WorkflowContext {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  startTime: Date;
  endTime?: Date;
  // The complete processed workflow structure
  processedWorkflow: ProcessedWorkflow;
  // Execution state tracking
  variables: Record<string, any>; // Shared data between tasks
  nodeResults: Record<string, NodeResult>;
  currentNodes: string[]; // Currently active nodes
  completedNodes: string[]; // Completed nodes
  failedNodes: string[]; // Failed nodes
  // Track which execution paths are active
  activePaths: number[]; // Indices of paths that are currently being executed
  metadata: Record<string, any>; // Custom metadata
}

interface NodeResult {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  retryCount: number;
  attempts: NodeAttempt[];
}

interface NodeAttempt {
  startTime: Date;
  endTime?: Date;
  status: 'completed' | 'failed';
  output?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}
```

## Execution Flow

### 1. Workflow Initialization

1. Client requests workflow execution via API
2. Orchestrator loads workflow definition from database
3. If not already processed, `WorkflowGraph` processor is applied:
   ```typescript
   const workflowGraph = new WorkflowGraph(definition.nodes, definition.edges);
   const processedWorkflow = workflowGraph.processWorkflow();
   ```
4. Orchestrator creates a new workflow context with the processed structure
5. Initial state is stored in State Manager
6. Workflow execution event is published to Event Bus

### 2. Task Dispatching

1. Orchestrator identifies nodes ready for execution (starting with the nodes in `processedWorkflow.forest.roots`)
2. For each ready node:
   - Task is created with relevant context and parameters
   - Task is queued in Execution Queue with appropriate priority
   - Node status is updated to 'running' in workflow context
3. For nodes in the same `parallelExecutionGroups`, the Orchestrator queues them for parallel execution
4. State Manager is updated with current workflow state

### 3. Task Execution

1. Task Worker picks up task from Execution Queue
2. Worker prepares execution environment
3. Task logic is executed (function call, API request, etc.)
4. Execution result is captured (success or failure)
5. Result is sent back to Orchestrator via completion event

### 4. Task Completion Processing

1. Orchestrator receives task completion event
2. Updates workflow context with task result
3. Uses `processedWorkflow.adjacencyList` to find next nodes
4. For branch points (in `processedWorkflow.execution.branchPoints`):
   - Evaluates conditions on outgoing edges
   - Selects appropriate paths for continuation
5. For convergence points (in `processedWorkflow.execution.convergencePoints`):
   - Checks if all required parent nodes have completed
   - Only proceeds when synchronization requirements are met
6. Marks current node as completed
7. Updates workflow state in State Manager
8. Publishes node completion event to Event Bus

### 5. Branching and Joining

1. **Branching Logic**:
   - At branch points (identified by `processedWorkflow.execution.branchPoints`), evaluate conditions on outgoing edges
   - Queue tasks for nodes on branches that satisfy conditions
   - For parallel branches, queue all downstream tasks simultaneously

2. **Joining Logic**:
   - For convergence points (identified by `processedWorkflow.execution.convergencePoints`), track completion of all parent nodes
   - Only execute convergence node when all required parent nodes complete
   - Handle partial completion scenarios based on configuration

### 6. Error Handling

1. When a task fails, Orchestrator evaluates retry policy
2. If retries are available, task is requeued with backoff
3. If retries are exhausted, node is marked as failed
4. Workflow-level error handling is triggered:
   - Execution of error paths if defined
   - Workflow cancellation if configured
   - Notification sent to monitoring system

### 7. Workflow Completion

1. When all leaf nodes (identified by `processedWorkflow.execution.leafNodes`) complete or terminal condition is reached:
   - Final workflow state is updated
   - Completion event is published
   - Cleanup tasks are scheduled

## Integration Points

### External Triggers

1. **API Trigger**:
   - REST endpoint for starting workflows
   - Support for parameters and context initialization

2. **Event Trigger**:
   - Event Bus listens for specific events
   - Matching events can initiate workflows

3. **Scheduled Trigger**:
   - Time-based workflow initiation
   - Supports cron expressions

### External Systems Integration

1. **API Integration**:
   - HTTP task type for calling external APIs
   - Configurable authentication and retry logic

2. **Event Publishing**:
   - Workflow events can be published to external systems
   - Customizable event payloads

3. **Database Integration**:
   - Tasks can interact with external databases
   - Support for common database operations

## Scalability & Resilience

### Scalability Features

1. **Horizontal Scaling**:
   - Stateless components (Orchestrator, Workers)
   - Partition-based scaling for State Manager and Event Bus
   - Queue sharding for high throughput

2. **Performance Optimization**:
   - Batching for high-volume operations
   - Caching for frequently accessed data
   - Efficient state serialization
   - Parallel execution of tasks in `parallelExecutionGroups` 

### Resilience Features

1. **Fault Tolerance**:
   - Automatic retry mechanism for failed tasks
   - Graceful handling of component failures
   - Workflow resumability after system restart

2. **Visibility & Debugging**:
   - Comprehensive logging of all operations
   - Execution visualization tools
   - Audit trail for all workflow changes

3. **Operational Controls**:
   - Manual intervention capabilities
   - Workflow pause/resume functionality
   - Emergency circuit breaker patterns

## Implementation Roadmap

### Phase 1: Core Engine

1. Implement Workflow Definition Service with WorkflowGraph integration
2. Develop basic Orchestrator functionality
3. Create Function Worker for local execution
4. Set up Redis-based State Manager
5. Implement basic monitoring

### Phase 2: Distribution & Scaling

1. Integrate BullMQ for task queuing
2. Implement HTTP Worker for API calls
3. Add RabbitMQ-based Event Bus
4. Enhance monitoring and logging capabilities

### Phase 3: Advanced Features

1. Implement advanced branching and joining logic
2. Add support for custom worker types
3. Develop workflow visualization tools using the graph structure
4. Create administrative dashboard

## Deployment Considerations

1. **Infrastructure Requirements**:
   - Redis for State Manager
   - RabbitMQ for Event Bus
   - Node.js runtime for TypeScript components
   - MongoDB/PostgreSQL for workflow definitions

2. **Containerization**:
   - Docker containers for each component
   - Kubernetes for orchestration
   - Helm charts for deployment configuration

3. **Security**:
   - API authentication and authorization
   - Secret management for sensitive configuration
   - Network security between components
