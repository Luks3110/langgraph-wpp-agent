import { WorkflowNodeQuery } from '../queries';

/**
 * Possible states of a workflow execution
 */
export enum WorkflowState {
    CREATED = 'CREATED',
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELED = 'CANCELED'
}

/**
 * Possible states of a node execution
 */
export enum NodeState {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    SKIPPED = 'SKIPPED',
    CANCELED = 'CANCELED'
}

/**
 * Workflow execution context that tracks the state of the execution
 */
export interface WorkflowContext {
    id: string;
    workflowId: string;
    tenantId: string;
    state: WorkflowState;
    startTime: Date;
    endTime?: Date;
    variables: Record<string, any>; // Shared data between nodes
    nodeResults: Record<string, NodeResult>;
    currentNodes: string[]; // Currently active nodes
    completedNodes: string[]; // Completed nodes
    failedNodes: string[]; // Failed nodes
    metadata: Record<string, any>; // Custom metadata
    error?: Error;
    history: ExecutionHistoryEntry[];
}

/**
 * Result of a node execution
 */
export interface NodeResult {
    nodeId: string;
    state: NodeState;
    startTime?: Date;
    endTime?: Date;
    input?: any;
    output?: any;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
    retryCount: number;
    attempts: NodeAttempt[];
}

/**
 * Information about a single attempt at executing a node
 */
export interface NodeAttempt {
    attemptNumber: number;
    startTime: Date;
    endTime?: Date;
    state: NodeState;
    output?: any;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
}

/**
 * Entry in the execution history log
 */
export interface ExecutionHistoryEntry {
    timestamp: Date;
    type: 'workflow' | 'node';
    action: string;
    entityId: string;
    details?: Record<string, any>;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Result of a node execution
 */
export interface ExecutionResult {
    success: boolean;
    output?: any;
    error?: Error;
}

/**
 * Event that can trigger workflow state transitions
 */
export interface WorkflowEvent {
    type: string;
    payload: Record<string, any>;
}

/**
 * Configuration for a workflow execution
 */
export interface WorkflowExecutionConfig {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    variables?: Record<string, any>;
}

/**
 * Structure containing information needed for workflow execution
 */
export interface ProcessedWorkflow {
    nodes: Record<string, WorkflowNodeQuery>;
    adjacencyList: Record<string, string[]>;
    entryNodes: string[];
    exitNodes: string[];
    branchPoints: string[];
    convergencePoints: Record<string, string[]>;
    parallelGroups: string[][];
} 
