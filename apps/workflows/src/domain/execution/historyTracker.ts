import { ExecutionHistoryEntry, NodeState, WorkflowContext } from './models.js';

/**
 * State of workflow execution
 */
export interface ExecutionState {
    completedNodes: Set<string>;
    failedNodes: Set<string>;
    nodeResults: Record<string, any>;
}

/**
 * Class for tracking execution history of workflows
 */
export class ExecutionHistoryTracker {
    private executions: Map<string, WorkflowContext> = new Map();

    /**
     * Track a new workflow execution
     */
    trackExecution(executionId: string, context: WorkflowContext): void {
        this.executions.set(executionId, context);
    }

    /**
     * Update an existing workflow execution
     */
    updateExecution(executionId: string, context: WorkflowContext): void {
        this.executions.set(executionId, context);
    }

    /**
     * Get a workflow execution by ID
     */
    getExecution(executionId: string): WorkflowContext | null {
        return this.executions.get(executionId) || null;
    }

    /**
     * Remove a workflow execution
     */
    removeExecution(executionId: string): void {
        this.executions.delete(executionId);
    }

    /**
     * Get all tracked workflow executions
     */
    getAllExecutions(): WorkflowContext[] {
        return Array.from(this.executions.values());
    }

    /**
     * Track a node execution
     */
    trackNodeExecution(
        context: WorkflowContext,
        nodeId: string,
        status: NodeState,
        result?: any,
        error?: Error
    ): void {
        // Initialize execution state if it doesn't exist
        if (!context.metadata.executionState) {
            context.metadata.executionState = {
                completedNodes: new Set<string>(),
                failedNodes: new Set<string>(),
                nodeResults: {}
            } as ExecutionState;
        }

        const executionState = context.metadata.executionState as ExecutionState;

        // Create a history entry
        const historyEntry: ExecutionHistoryEntry = {
            timestamp: new Date(),
            type: 'node',
            action: status,
            entityId: nodeId,
            details: {
                result: result,
                error: error ? {
                    message: error.message,
                    stack: error.stack
                } : undefined
            }
        };

        // Add to history
        context.history.push(historyEntry);

        // Update execution state based on status
        if (status === NodeState.COMPLETED) {
            executionState.completedNodes.add(nodeId);
            executionState.nodeResults[nodeId] = result;
        } else if (status === NodeState.FAILED) {
            executionState.failedNodes.add(nodeId);
        }

        // Store the result in the node results
        if (result) {
            context.nodeResults[nodeId] = {
                ...context.nodeResults[nodeId],
                output: result,
                state: status
            };
        }

        // Store error information if provided
        if (error) {
            if (!context.nodeResults[nodeId]) {
                context.nodeResults[nodeId] = {
                    nodeId,
                    state: status,
                    retryCount: 0,
                    attempts: []
                };
            }

            context.nodeResults[nodeId].error = {
                message: error.message,
                stack: error.stack
            };
        }
    }
} 
