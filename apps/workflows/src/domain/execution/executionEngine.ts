import { JobQueue } from '../../infrastructure/bullmq/jobQueue';
import { EventBus } from '../../infrastructure/eventBus/bullmqEventBus';
import { WorkflowDefinitionQuery } from '../queries';
import { ErrorRecoveryManager } from './errorRecovery';
import { ExecutionHistoryTracker } from './historyTracker';
import { ExecutionResult, ProcessedWorkflow, ValidationResult, WorkflowContext, WorkflowExecutionConfig, WorkflowState } from './models';
import { NodeExecutionFactory } from './nodeStrategy';
import { WorkflowStateMachine } from './stateMachine';

/**
 * Service that orchestrates workflow execution
 */
export class WorkflowExecutionEngine {
    private stateMachine: WorkflowStateMachine;
    private historyTracker: ExecutionHistoryTracker;
    private errorRecovery: ErrorRecoveryManager;

    constructor(
        private eventBus: EventBus,
        private jobQueue: JobQueue,
        private nodeExecutionFactory: NodeExecutionFactory
    ) {
        this.stateMachine = new WorkflowStateMachine(eventBus, nodeExecutionFactory);
        this.historyTracker = new ExecutionHistoryTracker();
        this.errorRecovery = new ErrorRecoveryManager();

        // Set up event subscribers
        this.setupEventSubscribers();
    }

    /**
     * Process a workflow and prepare it for execution
     */
    processWorkflow(definition: WorkflowDefinitionQuery): ProcessedWorkflow {
        // Extract nodes and build adjacency list
        const nodes: Record<string, WorkflowDefinitionQuery['nodes'][0]> = {};
        const adjacencyList: Record<string, string[]> = {};
        const entryNodes: string[] = [];
        const exitNodes: string[] = [];

        // Process nodes
        definition.nodes.forEach(node => {
            nodes[node.id] = node;
            adjacencyList[node.id] = [];
        });

        // Process edges and build adjacency list
        if (definition.edges) {
            definition.edges.forEach(edge => {
                if (adjacencyList[edge.source]) {
                    adjacencyList[edge.source].push(edge.target);
                }
            });
        }

        // Identify entry and exit nodes
        for (const nodeId in nodes) {
            // Check if this node has no incoming edges
            const hasIncoming = Object.entries(adjacencyList).some(([sourceId, targets]) =>
                sourceId !== nodeId && targets.includes(nodeId)
            );

            if (!hasIncoming) {
                entryNodes.push(nodeId);
            }

            // Check if this node has no outgoing edges
            const hasOutgoing = adjacencyList[nodeId].length > 0;

            if (!hasOutgoing) {
                exitNodes.push(nodeId);
            }
        }

        // Identify branch points (nodes with multiple outgoing edges)
        const branchPoints = Object.entries(adjacencyList)
            .filter(([, targets]) => targets.length > 1)
            .map(([nodeId]) => nodeId);

        // Identify convergence points (nodes with multiple incoming edges)
        const convergencePoints: Record<string, string[]> = {};

        for (const nodeId in nodes) {
            const incomingEdges = Object.entries(adjacencyList)
                .filter(([sourceId, targets]) => targets.includes(nodeId))
                .map(([sourceId]) => sourceId);

            if (incomingEdges.length > 1) {
                convergencePoints[nodeId] = incomingEdges;
            }
        }

        // Identify parallel execution groups
        const parallelGroups: string[][] = [];

        // A simple approach: nodes that don't depend on each other can be executed in parallel
        const nodeDependencies: Record<string, Set<string>> = {};

        // Build node dependencies
        for (const nodeId in nodes) {
            nodeDependencies[nodeId] = new Set<string>();

            // Add direct dependencies (incoming edges)
            Object.entries(adjacencyList).forEach(([sourceId, targets]) => {
                if (targets.includes(nodeId)) {
                    nodeDependencies[nodeId].add(sourceId);
                }
            });
        }

        // Group nodes that can be executed in parallel
        const remainingNodes = new Set(Object.keys(nodes));

        while (remainingNodes.size > 0) {
            const parallelGroup: string[] = [];

            // Find nodes that don't depend on any remaining nodes
            remainingNodes.forEach(nodeId => {
                const dependencies = nodeDependencies[nodeId];
                const hasDependency = Array.from(dependencies).some(depId => remainingNodes.has(depId));

                if (!hasDependency) {
                    parallelGroup.push(nodeId);
                }
            });

            // If no nodes can be added to the parallel group, we have a circular dependency
            if (parallelGroup.length === 0) {
                console.warn('Circular dependency detected in workflow');
                break;
            }

            // Add the parallel group and remove the nodes from remaining
            parallelGroups.push(parallelGroup);
            parallelGroup.forEach(nodeId => remainingNodes.delete(nodeId));
        }

        return {
            nodes,
            adjacencyList,
            entryNodes,
            exitNodes,
            branchPoints,
            convergencePoints,
            parallelGroups
        };
    }

    /**
     * Validate a workflow definition
     */
    async validateWorkflow(definition: WorkflowDefinitionQuery): Promise<ValidationResult> {
        // Process the workflow to get the graph structure
        const processedWorkflow = this.processWorkflow(definition);
        const errors: string[] = [];

        // Check for entry nodes
        if (processedWorkflow.entryNodes.length === 0) {
            errors.push('Workflow has no entry nodes');
        }

        // Check for exit nodes
        if (processedWorkflow.exitNodes.length === 0) {
            errors.push('Workflow has no exit nodes');
        }

        // Check for isolated nodes (not connected to any other nodes)
        const connectedNodes = new Set<string>();

        // Add all nodes that appear in the adjacency list
        Object.keys(processedWorkflow.adjacencyList).forEach(nodeId => {
            connectedNodes.add(nodeId);
        });

        // Add all target nodes from the adjacency list
        Object.values(processedWorkflow.adjacencyList).forEach(targets => {
            targets.forEach(targetId => connectedNodes.add(targetId));
        });

        // Find isolated nodes
        const allNodes = Object.keys(processedWorkflow.nodes);
        const isolatedNodes = allNodes.filter(nodeId => !connectedNodes.has(nodeId));

        if (isolatedNodes.length > 0) {
            errors.push(`Workflow has isolated nodes: ${isolatedNodes.join(', ')}`);
        }

        // Validate each node
        for (const nodeId in processedWorkflow.nodes) {
            const node = processedWorkflow.nodes[nodeId];

            // Check if we have a strategy for this node type
            if (!this.nodeExecutionFactory.hasStrategy(node.type)) {
                errors.push(`No execution strategy found for node type: ${node.type}`);
                continue;
            }

            // Get the node strategy and validate the node
            const strategy = this.nodeExecutionFactory.createStrategy(node.type);
            const nodeValidation = await strategy.validate(node);

            if (!nodeValidation.isValid) {
                errors.push(`Node ${node.id} (${node.name}) validation failed: ${nodeValidation.errors.join(', ')}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Start a new workflow execution
     */
    async startExecution(
        workflowId: string,
        tenantId: string,
        definition: WorkflowDefinitionQuery,
        config: Partial<WorkflowExecutionConfig> = {}
    ): Promise<string> {
        // Process the workflow
        const processedWorkflow = this.processWorkflow(definition);

        // Apply default config
        const fullConfig: WorkflowExecutionConfig = {
            maxRetries: config.maxRetries ?? 3,
            retryDelay: config.retryDelay ?? 1000,
            timeout: config.timeout ?? 60000,
            variables: config.variables ?? {}
        };

        // Create a workflow context
        const context = this.stateMachine.createContext(
            workflowId,
            tenantId,
            processedWorkflow,
            fullConfig.variables
        );

        // Add config to metadata
        context.metadata.maxRetries = fullConfig.maxRetries;
        context.metadata.retryDelay = fullConfig.retryDelay;
        context.metadata.timeout = fullConfig.timeout;

        // Track the execution context
        this.historyTracker.trackExecution(context.id, context);

        // Start the workflow
        const updatedContext = await this.stateMachine.start(context);

        // Update the tracked context
        this.historyTracker.updateExecution(updatedContext.id, updatedContext);

        // Queue jobs for the entry nodes
        for (const nodeId of updatedContext.currentNodes) {
            await this.queueNodeExecution(updatedContext.id, nodeId);
        }

        return updatedContext.id;
    }

    /**
     * Get the current state of a workflow execution
     */
    getExecutionState(executionId: string): WorkflowContext | null {
        return this.historyTracker.getExecution(executionId);
    }

    /**
     * Execute a single node in a workflow
     */
    async executeNode(executionId: string, nodeId: string): Promise<ExecutionResult> {
        // Get the workflow context
        const context = this.historyTracker.getExecution(executionId);

        if (!context) {
            throw new Error(`Workflow execution ${executionId} not found`);
        }

        // Check if the workflow is in a state where nodes can be executed
        if (context.state !== WorkflowState.RUNNING) {
            throw new Error(`Cannot execute node in workflow state ${context.state}`);
        }

        // Execute the node
        const result = await this.stateMachine.executeNode(context, nodeId);

        // Update the tracked context
        this.historyTracker.updateExecution(executionId, context);

        return result;
    }

    /**
     * Pause a workflow execution
     */
    async pauseExecution(executionId: string): Promise<void> {
        const context = this.historyTracker.getExecution(executionId);

        if (!context) {
            throw new Error(`Workflow execution ${executionId} not found`);
        }

        // Transition to PAUSED state
        const updatedContext = await this.stateMachine.transition(context, {
            type: 'workflow.pause',
            payload: {}
        });

        // Update the tracked context
        this.historyTracker.updateExecution(executionId, updatedContext);
    }

    /**
     * Resume a paused workflow execution
     */
    async resumeExecution(executionId: string): Promise<void> {
        const context = this.historyTracker.getExecution(executionId);

        if (!context) {
            throw new Error(`Workflow execution ${executionId} not found`);
        }

        // Transition to RUNNING state
        const updatedContext = await this.stateMachine.transition(context, {
            type: 'workflow.resume',
            payload: {}
        });

        // Update the tracked context
        this.historyTracker.updateExecution(executionId, updatedContext);

        // Re-queue any current nodes
        for (const nodeId of updatedContext.currentNodes) {
            await this.queueNodeExecution(executionId, nodeId);
        }
    }

    /**
     * Cancel a workflow execution
     */
    async cancelExecution(executionId: string): Promise<void> {
        const context = this.historyTracker.getExecution(executionId);

        if (!context) {
            throw new Error(`Workflow execution ${executionId} not found`);
        }

        // Transition to CANCELED state
        const updatedContext = await this.stateMachine.transition(context, {
            type: 'workflow.cancel',
            payload: {}
        });

        // Update the tracked context
        this.historyTracker.updateExecution(executionId, updatedContext);
    }

    /**
     * Handle a node execution job
     */
    async handleNodeExecutionJob(jobData: {
        executionId: string;
        nodeId: string;
    }): Promise<ExecutionResult> {
        const { executionId, nodeId } = jobData;

        try {
            return await this.executeNode(executionId, nodeId);
        } catch (error) {
            console.error(`Error executing node ${nodeId} in workflow ${executionId}:`, error);

            // Try to recover from the error
            const context = this.historyTracker.getExecution(executionId);

            if (context) {
                await this.errorRecovery.recoverFromError(context, nodeId, error);
            }

            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * Queue a node for execution
     */
    private async queueNodeExecution(executionId: string, nodeId: string): Promise<void> {
        // Add the job to the queue
        await this.jobQueue.addJob('workflow-node-execution', {
            executionId,
            nodeId
        }, {
            attempts: 1, // We handle retries at the application level
            removeOnComplete: false
        });
    }

    /**
     * Set up event subscribers for workflow events
     */
    private setupEventSubscribers(): void {
        // Subscribe to node execution completed events
        this.eventBus.subscribe('node.execution.completed', async (event: any) => {
            const { workflowExecutionId, nodeId } = event.payload;

            // Get the workflow context
            const context = this.historyTracker.getExecution(workflowExecutionId);

            if (!context) {
                return;
            }

            // Queue jobs for any nodes that are ready to execute
            const readyNodes = context.currentNodes;

            for (const readyNodeId of readyNodes) {
                await this.queueNodeExecution(workflowExecutionId, readyNodeId);
            }
        });

        // Subscribe to workflow execution completed events
        this.eventBus.subscribe('workflow.execution.completed', async (event: any) => {
            const { executionId } = event.payload;

            // Get the workflow context
            const context = this.historyTracker.getExecution(executionId);

            if (!context) {
                return;
            }

            // The workflow is complete, so we can clean up any resources
            // In a real implementation, you might persist the final state to a database
            console.log(`Workflow ${executionId} completed successfully`);
        });

        // Subscribe to workflow execution failed events
        this.eventBus.subscribe('workflow.execution.failed', async (event: any) => {
            const { executionId, error } = event.payload;

            // Get the workflow context
            const context = this.historyTracker.getExecution(executionId);

            if (!context) {
                return;
            }

            // The workflow failed, so we can clean up any resources
            // In a real implementation, you might persist the final state to a database
            console.error(`Workflow ${executionId} failed:`, error);
        });
    }
}
