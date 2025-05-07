import { v4 as uuidv4 } from 'uuid';
import { EventBus } from '../../infrastructure/eventBus/bullmqEventBus';
import { NodeExecutionCompletedEvent, NodeExecutionFailedEvent, WorkflowExecutionCompletedEvent, WorkflowExecutionFailedEvent, WorkflowExecutionStartedEvent } from '../events';
import { ExecutionResult, NodeAttempt, NodeState, ProcessedWorkflow, WorkflowContext, WorkflowEvent, WorkflowState } from './models';
import { NodeExecutionFactory } from './nodeStrategy';

/**
 * Implementation of the workflow state machine
 */
export class WorkflowStateMachine {
    constructor(
        private eventBus: EventBus,
        private nodeExecutionFactory: NodeExecutionFactory
    ) { }

    /**
     * Create a new workflow context
     */
    createContext(
        workflowId: string,
        tenantId: string,
        processedWorkflow: ProcessedWorkflow,
        initialVariables: Record<string, any> = {}
    ): WorkflowContext {
        const id = uuidv4();
        const now = new Date();

        return {
            id,
            workflowId,
            tenantId,
            state: WorkflowState.CREATED,
            startTime: now,
            variables: { ...initialVariables },
            nodeResults: {},
            currentNodes: [],
            completedNodes: [],
            failedNodes: [],
            metadata: {
                processedWorkflow
            },
            history: [
                {
                    timestamp: now,
                    type: 'workflow',
                    action: 'created',
                    entityId: id
                }
            ]
        };
    }

    /**
     * Start the workflow execution
     */
    async start(context: WorkflowContext): Promise<WorkflowContext> {
        // Transition to RUNNING state
        const updatedContext = await this.transition(context, {
            type: 'workflow.start',
            payload: {}
        });

        // Get entry nodes from the processed workflow
        const entryNodes = updatedContext.metadata.processedWorkflow?.entryNodes || [];

        // Schedule entry nodes for execution
        for (const nodeId of entryNodes) {
            await this.scheduleNode(updatedContext, nodeId);
        }

        return updatedContext;
    }

    /**
     * Transition the workflow state based on an event
     */
    async transition(context: WorkflowContext, event: WorkflowEvent): Promise<WorkflowContext> {
        // Create a copy of the context to update
        const updatedContext: WorkflowContext = { ...context };

        switch (event.type) {
            case 'workflow.start':
                // Only allow starting from CREATED state
                if (context.state !== WorkflowState.CREATED) {
                    throw new Error(`Cannot start workflow in state ${context.state}`);
                }

                // Update state and add history entry
                updatedContext.state = WorkflowState.RUNNING;
                updatedContext.history.push({
                    timestamp: new Date(),
                    type: 'workflow',
                    action: 'started',
                    entityId: context.id
                });

                // Publish workflow started event
                await this.eventBus.publish({
                    id: uuidv4(),
                    type: 'workflow.execution.started',
                    timestamp: new Date().toISOString(),
                    tenantId: context.tenantId,
                    payload: {
                        workflowId: context.workflowId,
                        executionId: context.id
                    }
                } as WorkflowExecutionStartedEvent);

                break;

            case 'workflow.pause':
                // Only allow pausing from RUNNING state
                if (context.state !== WorkflowState.RUNNING) {
                    throw new Error(`Cannot pause workflow in state ${context.state}`);
                }

                // Update state and add history entry
                updatedContext.state = WorkflowState.PAUSED;
                updatedContext.history.push({
                    timestamp: new Date(),
                    type: 'workflow',
                    action: 'paused',
                    entityId: context.id
                });

                break;

            case 'workflow.resume':
                // Only allow resuming from PAUSED state
                if (context.state !== WorkflowState.PAUSED) {
                    throw new Error(`Cannot resume workflow in state ${context.state}`);
                }

                // Update state and add history entry
                updatedContext.state = WorkflowState.RUNNING;
                updatedContext.history.push({
                    timestamp: new Date(),
                    type: 'workflow',
                    action: 'resumed',
                    entityId: context.id
                });

                break;

            case 'workflow.complete':
                // Only allow completing from RUNNING state
                if (context.state !== WorkflowState.RUNNING) {
                    throw new Error(`Cannot complete workflow in state ${context.state}`);
                }

                // Update state and add history entry
                updatedContext.state = WorkflowState.COMPLETED;
                updatedContext.endTime = new Date();
                updatedContext.history.push({
                    timestamp: updatedContext.endTime,
                    type: 'workflow',
                    action: 'completed',
                    entityId: context.id,
                    details: event.payload
                });

                // Publish workflow completed event
                await this.eventBus.publish({
                    id: uuidv4(),
                    type: 'workflow.execution.completed',
                    timestamp: updatedContext.endTime.toISOString(),
                    tenantId: context.tenantId,
                    payload: {
                        workflowId: context.workflowId,
                        executionId: context.id,
                        duration: updatedContext.endTime.getTime() - context.startTime.getTime()
                    }
                } as WorkflowExecutionCompletedEvent);

                break;

            case 'workflow.fail':
                // Can fail from any active state
                if (context.state !== WorkflowState.RUNNING && context.state !== WorkflowState.PAUSED) {
                    throw new Error(`Cannot fail workflow in state ${context.state}`);
                }

                // Update state and add history entry
                updatedContext.state = WorkflowState.FAILED;
                updatedContext.endTime = new Date();
                updatedContext.error = event.payload.error;
                updatedContext.history.push({
                    timestamp: updatedContext.endTime,
                    type: 'workflow',
                    action: 'failed',
                    entityId: context.id,
                    details: {
                        error: event.payload.error?.message
                    }
                });

                // Publish workflow failed event
                await this.eventBus.publish({
                    id: uuidv4(),
                    type: 'workflow.execution.failed',
                    timestamp: updatedContext.endTime.toISOString(),
                    tenantId: context.tenantId,
                    payload: {
                        workflowId: context.workflowId,
                        executionId: context.id,
                        error: event.payload.error?.message || 'Unknown error',
                        duration: updatedContext.endTime.getTime() - context.startTime.getTime()
                    }
                } as WorkflowExecutionFailedEvent);

                break;

            case 'workflow.cancel':
                // Can cancel from any active state
                if (context.state !== WorkflowState.RUNNING && context.state !== WorkflowState.PAUSED) {
                    throw new Error(`Cannot cancel workflow in state ${context.state}`);
                }

                // Update state and add history entry
                updatedContext.state = WorkflowState.CANCELED;
                updatedContext.endTime = new Date();
                updatedContext.history.push({
                    timestamp: updatedContext.endTime,
                    type: 'workflow',
                    action: 'canceled',
                    entityId: context.id,
                    details: event.payload
                });

                break;

            case 'node.schedule':
                // Can only schedule nodes in RUNNING state
                if (context.state !== WorkflowState.RUNNING) {
                    throw new Error(`Cannot schedule node in workflow state ${context.state}`);
                }

                // Add node to current nodes
                const nodeId = event.payload.nodeId;
                if (!updatedContext.currentNodes.includes(nodeId)) {
                    updatedContext.currentNodes.push(nodeId);
                }

                // Initialize node result if not exists
                if (!updatedContext.nodeResults[nodeId]) {
                    updatedContext.nodeResults[nodeId] = {
                        nodeId,
                        state: NodeState.PENDING,
                        retryCount: 0,
                        attempts: []
                    };
                }

                // Add history entry
                updatedContext.history.push({
                    timestamp: new Date(),
                    type: 'node',
                    action: 'scheduled',
                    entityId: nodeId
                });

                break;

            case 'node.start':
                // Can only start nodes in RUNNING state
                if (context.state !== WorkflowState.RUNNING) {
                    throw new Error(`Cannot start node in workflow state ${context.state}`);
                }

                // Update node state
                const startNodeId = event.payload.nodeId;
                const startTime = new Date();

                // Update node result
                const nodeResult = updatedContext.nodeResults[startNodeId] || {
                    nodeId: startNodeId,
                    state: NodeState.PENDING,
                    retryCount: 0,
                    attempts: []
                };

                nodeResult.state = NodeState.RUNNING;
                nodeResult.startTime = startTime;

                // Create a new attempt
                const attempt: NodeAttempt = {
                    attemptNumber: nodeResult.attempts.length + 1,
                    startTime,
                    state: NodeState.RUNNING
                };

                nodeResult.attempts.push(attempt);
                updatedContext.nodeResults[startNodeId] = nodeResult;

                // Add history entry
                updatedContext.history.push({
                    timestamp: startTime,
                    type: 'node',
                    action: 'started',
                    entityId: startNodeId
                });

                break;

            case 'node.complete':
                // Can only complete nodes in RUNNING state
                if (context.state !== WorkflowState.RUNNING) {
                    throw new Error(`Cannot complete node in workflow state ${context.state}`);
                }

                // Update node state
                const completeNodeId = event.payload.nodeId;
                const completeTime = new Date();

                // Get node result (should exist)
                const completeNodeResult = updatedContext.nodeResults[completeNodeId];
                if (!completeNodeResult) {
                    throw new Error(`Node ${completeNodeId} has no result record`);
                }

                // Update node result
                completeNodeResult.state = NodeState.COMPLETED;
                completeNodeResult.endTime = completeTime;
                completeNodeResult.output = event.payload.output;

                // Update the current attempt
                const currentAttempt = completeNodeResult.attempts[completeNodeResult.attempts.length - 1];
                if (currentAttempt) {
                    currentAttempt.state = NodeState.COMPLETED;
                    currentAttempt.endTime = completeTime;
                    currentAttempt.output = event.payload.output;
                }

                // Update the lists of current and completed nodes
                updatedContext.currentNodes = updatedContext.currentNodes.filter(id => id !== completeNodeId);
                updatedContext.completedNodes.push(completeNodeId);

                // Add history entry
                updatedContext.history.push({
                    timestamp: completeTime,
                    type: 'node',
                    action: 'completed',
                    entityId: completeNodeId,
                    details: {
                        duration: completeTime.getTime() - (completeNodeResult.startTime?.getTime() || completeTime.getTime())
                    }
                });

                // Publish node completed event
                await this.eventBus.publish({
                    id: uuidv4(),
                    type: 'node.execution.completed',
                    timestamp: completeTime.toISOString(),
                    tenantId: context.tenantId,
                    payload: {
                        nodeId: completeNodeId,
                        workflowExecutionId: context.id,
                        executionId: currentAttempt?.attemptNumber.toString() || '1',
                        output: event.payload.output,
                        duration: completeTime.getTime() - (completeNodeResult.startTime?.getTime() || completeTime.getTime())
                    }
                } as NodeExecutionCompletedEvent);

                // Schedule next nodes
                await this.scheduleNextNodes(updatedContext, completeNodeId);

                // Check if workflow is complete
                await this.checkWorkflowCompletion(updatedContext);

                break;

            case 'node.fail':
                // Can only fail nodes in RUNNING state
                if (context.state !== WorkflowState.RUNNING) {
                    throw new Error(`Cannot fail node in workflow state ${context.state}`);
                }

                // Update node state
                const failNodeId = event.payload.nodeId;
                const failTime = new Date();
                const error = event.payload.error;

                // Get node result (should exist)
                const failNodeResult = updatedContext.nodeResults[failNodeId];
                if (!failNodeResult) {
                    throw new Error(`Node ${failNodeId} has no result record`);
                }

                // Update node result
                failNodeResult.state = NodeState.FAILED;
                failNodeResult.endTime = failTime;
                failNodeResult.error = {
                    message: error.message,
                    stack: error.stack,
                    code: error.code
                };

                // Update the current attempt
                const failedAttempt = failNodeResult.attempts[failNodeResult.attempts.length - 1];
                if (failedAttempt) {
                    failedAttempt.state = NodeState.FAILED;
                    failedAttempt.endTime = failTime;
                    failedAttempt.error = {
                        message: error.message,
                        stack: error.stack,
                        code: error.code
                    };
                }

                // Update the lists of current and failed nodes
                updatedContext.currentNodes = updatedContext.currentNodes.filter(id => id !== failNodeId);
                updatedContext.failedNodes.push(failNodeId);

                // Add history entry
                updatedContext.history.push({
                    timestamp: failTime,
                    type: 'node',
                    action: 'failed',
                    entityId: failNodeId,
                    details: {
                        error: error.message,
                        duration: failTime.getTime() - (failNodeResult.startTime?.getTime() || failTime.getTime())
                    }
                });

                // Publish node failed event
                await this.eventBus.publish({
                    id: uuidv4(),
                    type: 'node.execution.failed',
                    timestamp: failTime.toISOString(),
                    tenantId: context.tenantId,
                    payload: {
                        nodeId: failNodeId,
                        workflowExecutionId: context.id,
                        executionId: failedAttempt?.attemptNumber.toString() || '1',
                        error: error.message,
                        duration: failTime.getTime() - (failNodeResult.startTime?.getTime() || failTime.getTime())
                    }
                } as NodeExecutionFailedEvent);

                // Check if we should retry the node
                if (this.shouldRetryNode(updatedContext, failNodeId)) {
                    // Schedule the node for retry
                    await this.scheduleNode(updatedContext, failNodeId);
                } else {
                    // Handle the node failure
                    await this.handleNodeFailure(updatedContext, failNodeId);
                }

                break;

            default:
                throw new Error(`Unknown event type: ${event.type}`);
        }

        return updatedContext;
    }

    /**
     * Execute a node in the workflow
     */
    async executeNode(context: WorkflowContext, nodeId: string): Promise<ExecutionResult> {
        // Check if workflow is in RUNNING state
        if (context.state !== WorkflowState.RUNNING) {
            throw new Error(`Cannot execute node in workflow state ${context.state}`);
        }

        // Get the node definition
        const processedWorkflow = context.metadata.processedWorkflow;
        if (!processedWorkflow) {
            throw new Error('Workflow context missing processedWorkflow');
        }

        const node = processedWorkflow.nodes[nodeId];
        if (!node) {
            throw new Error(`Node ${nodeId} not found in workflow definition`);
        }

        // Start node execution
        await this.transition(context, {
            type: 'node.start',
            payload: { nodeId }
        });

        try {
            // Get the execution strategy for the node type
            const strategy = this.nodeExecutionFactory.createStrategy(node.type);

            // Validate the node
            const validationResult = await strategy.validate(node);
            if (!validationResult.isValid) {
                throw new Error(`Node validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Execute the node
            const result = await strategy.execute(context, node);

            // Complete the node
            if (result.success) {
                await this.transition(context, {
                    type: 'node.complete',
                    payload: {
                        nodeId,
                        output: result.output
                    }
                });
            } else {
                await this.transition(context, {
                    type: 'node.fail',
                    payload: {
                        nodeId,
                        error: result.error || new Error('Node execution failed with unknown error')
                    }
                });
            }

            return result;
        } catch (error) {
            // Handle execution error
            const errorObj = error instanceof Error ? error : new Error(String(error));

            await this.transition(context, {
                type: 'node.fail',
                payload: {
                    nodeId,
                    error: errorObj
                }
            });

            return {
                success: false,
                error: errorObj
            };
        } finally {
            // Clean up resources
            try {
                const strategy = this.nodeExecutionFactory.createStrategy(node.type);
                await strategy.cleanup(context, node);
            } catch (error) {
                console.error(`Error cleaning up node ${nodeId}:`, error);
            }
        }
    }

    /**
     * Handle an error during workflow execution
     */
    async handleError(context: WorkflowContext, error: Error): Promise<WorkflowContext> {
        return this.transition(context, {
            type: 'workflow.fail',
            payload: { error }
        });
    }

    /**
     * Schedule a node for execution
     */
    private async scheduleNode(context: WorkflowContext, nodeId: string): Promise<void> {
        await this.transition(context, {
            type: 'node.schedule',
            payload: { nodeId }
        });
    }

    /**
     * Schedule the next nodes in the workflow
     */
    private async scheduleNextNodes(context: WorkflowContext, nodeId: string): Promise<void> {
        const processedWorkflow = context.metadata.processedWorkflow;
        if (!processedWorkflow) {
            return;
        }

        // Get the adjacency list
        const adjacencyList = processedWorkflow.adjacencyList || {};

        // Get the next nodes
        const nextNodes = adjacencyList[nodeId] || [];

        // Check if any of the next nodes are convergence points
        const convergencePoints = processedWorkflow.convergencePoints || {};

        for (const nextNodeId of nextNodes) {
            const requiredPredecessors = convergencePoints[nextNodeId];

            // If this is a convergence point, check if all required predecessors have completed
            if (requiredPredecessors && requiredPredecessors.length > 0) {
                const allPredecessorsCompleted = requiredPredecessors.every((id: string) =>
                    context.completedNodes.includes(id)
                );

                if (allPredecessorsCompleted) {
                    // All required predecessors have completed, schedule the node
                    await this.scheduleNode(context, nextNodeId);
                }
            } else {
                // Not a convergence point, schedule immediately
                await this.scheduleNode(context, nextNodeId);
            }
        }
    }

    /**
     * Check if the workflow has completed
     */
    private async checkWorkflowCompletion(context: WorkflowContext): Promise<void> {
        // If there are still nodes being executed, the workflow is not complete
        if (context.currentNodes.length > 0) {
            return;
        }

        const processedWorkflow = context.metadata.processedWorkflow;
        if (!processedWorkflow) {
            return;
        }

        // Get the exit nodes
        const exitNodes = processedWorkflow.exitNodes || [];

        // Check if all exit nodes have completed
        const allExitNodesCompleted = exitNodes.every((id: string) =>
            context.completedNodes.includes(id)
        );

        if (allExitNodesCompleted) {
            // All exit nodes have completed, workflow is complete
            await this.transition(context, {
                type: 'workflow.complete',
                payload: {}
            });
        }
    }

    /**
     * Check if a node should be retried
     */
    private shouldRetryNode(context: WorkflowContext, nodeId: string): boolean {
        const nodeResult = context.nodeResults[nodeId];
        if (!nodeResult) {
            return false;
        }

        // Get max retries from metadata
        const maxRetries = context.metadata.maxRetries || 3;

        // Check if we've reached the max retries
        return nodeResult.retryCount < maxRetries;
    }

    /**
     * Handle a node failure that won't be retried
     */
    private async handleNodeFailure(context: WorkflowContext, nodeId: string): Promise<void> {
        // If error handling is not configured, fail the workflow
        await this.transition(context, {
            type: 'workflow.fail',
            payload: {
                error: new Error(`Node ${nodeId} failed and exceeded retry limit`)
            }
        });
    }
} 
