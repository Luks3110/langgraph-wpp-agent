/**
 * Result of a node execution
 */
export interface NodeExecutionResult<T = any> {
    /**
     * Whether the execution was successful
     */
    success: boolean;

    /**
     * The output of the node execution
     */
    output?: T;

    /**
     * Error message if the execution failed
     */
    error?: string;

    /**
     * Metadata about the execution
     */
    metadata?: Record<string, any>;
}

/**
 * Node type in a workflow
 */
export enum NodeType {
    TRIGGER = 'trigger',
    AGENT = 'agent',
    RESPONSE = 'response',
    CONDITION = 'condition',
    TRANSFORM = 'transform',
    API = 'api',
    DELAY = 'delay'
}

/**
 * Node execution status
 */
export enum NodeExecutionStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    SKIPPED = 'skipped'
} 
