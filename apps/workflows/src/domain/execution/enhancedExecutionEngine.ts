import { WorkflowGraph, ProcessedWorkflow } from '../../../apps/supa-agent-frontend/src/lib/workflowGraph.js';
import { JobQueue } from '../../infrastructure/bullmq/jobQueue.js';
import { SupabaseWorkflowExecutionRepository, WorkflowExecution, NodeExecution } from '../../infrastructure/repositories/workflowExecutionRepository.js';
import { WebhookTriggerRepository } from '../../infrastructure/repositories/webhookTriggerRepository.js';
import { WorkflowRepository } from '../../infrastructure/repositories/workflowRepository.js';
import { BullMQEventBus } from '../../infrastructure/eventBus/bullmqEventBus.js';
import { NodeExecutionFactory } from './nodeStrategy.js';
import { WorkflowDefinitionQuery, WorkflowNodeQuery } from '../queries/index.js';

export interface WorkflowExecutionRequest {
    workflowId: string;
    tenantId: string;
    trigger: {
        type: 'webhook' | 'manual' | 'scheduled';
        data: Record<string, any>;
        source?: string;
    };
    context?: Record<string, any>;
}

export interface NodeExecutionJob {
    workflowExecutionId: string;
    nodeId: string;
    input: Record<string, any>;
    context: Record<string, any>;
    attemptNumber: number;
}

export class EnhancedWorkflowExecutionEngine {
    constructor(
        private workflowRepository: WorkflowRepository,
        private executionRepository: SupabaseWorkflowExecutionRepository,
        private webhookTriggerRepository: WebhookTriggerRepository,
        private jobQueue: JobQueue,
        private eventBus: BullMQEventBus,
        private nodeExecutionFactory: NodeExecutionFactory
    ) {
        this.setupEventHandlers();
    }

    /**
     * Start a new workflow execution
     */
    async startWorkflowExecution(request: WorkflowExecutionRequest): Promise<string> {
        try {
            // Get workflow definition
            const workflow = await this.workflowRepository.findById(request.workflowId);
            if (!workflow) {
                throw new Error(`Workflow not found: ${request.workflowId}`);
            }

            // Process workflow to get execution structure
            const processedWorkflow = this.processWorkflow(workflow);

            // Create workflow execution record
            const execution = await this.executionRepository.createExecution({
                workflow_id: request.workflowId,
                tenant_id: request.tenantId,
                status: 'running',
                variables: request.trigger.data,
                context: {
                    processedWorkflow,
                    trigger: request.trigger,
                    ...request.context
                },
                current_nodes: processedWorkflow.forest.roots,
                completed_nodes: [],
                failed_nodes: []
            });

            // Queue initial nodes for execution
            for (const nodeId of processedWorkflow.forest.roots) {
                await this.queueNodeExecution(execution.id, nodeId, request.trigger.data, {
                    processedWorkflow,
                    execution
                });
            }

            // Publish workflow started event
            await this.eventBus.publish('workflow.execution.started', {
                workflowExecutionId: execution.id,
                workflowId: request.workflowId,
                tenantId: request.tenantId,
                trigger: request.trigger
            });

            return execution.id;
        } catch (error) {
            console.error('Failed to start workflow execution:', error);
            throw error;
        }
    }

    /**
     * Handle webhook trigger for workflow execution
     */
    async handleWebhookTrigger(webhookPath: string, payload: Record<string, any>, headers: Record<string, string>): Promise<string> {
        try {
            // Find webhook trigger
            const trigger = await this.webhookTriggerRepository.getTriggerByPath(webhookPath);
            if (!trigger) {
                throw new Error(`No active webhook trigger found for path: ${webhookPath}`);
            }

            // Prepare webhook input data
            const webhookInput = {
                payload,
                headers,
                webhookPath,
                timestamp: new Date().toISOString()
            };

            // Start workflow execution
            return await this.startWorkflowExecution({
                workflowId: trigger.workflow_id,
                tenantId: trigger.tenant_id,
                trigger: {
                    type: 'webhook',
                    data: webhookInput,
                    source: webhookPath
                }
            });
        } catch (error) {
            console.error('Failed to handle webhook trigger:', error);
            throw error;
        }
    }

    /**
     * Execute a specific node in a workflow
     */
    async executeNode(job: NodeExecutionJob): Promise<void> {
        let nodeExecution: NodeExecution | null = null;

        try {
            // Get workflow execution
            const execution = await this.executionRepository.getExecution(job.workflowExecutionId);
            if (!execution) {
                throw new Error(`Workflow execution not found: ${job.workflowExecutionId}`);
            }

            if (execution.status !== 'running') {
                console.log(`Skipping node execution for non-running workflow: ${execution.status}`);
                return;
            }

            // Get workflow definition
            const workflow = await this.workflowRepository.findById(execution.workflow_id);
            if (!workflow) {
                throw new Error(`Workflow not found: ${execution.workflow_id}`);
            }

            // Find the node in the workflow
            const node = workflow.nodes.find((n: any) => n.id === job.nodeId);
            if (!node) {
                throw new Error(`Node not found: ${job.nodeId}`);
            }

            // Create node execution record
            nodeExecution = await this.executionRepository.createNodeExecution({
                workflow_execution_id: job.workflowExecutionId,
                node_id: job.nodeId,
                status: 'running',
                input_data: job.input,
                retry_count: job.attemptNumber - 1
            });

            // Get node execution strategy
            const strategy = this.nodeExecutionFactory.createStrategy(node.type);

            // Prepare execution context
            const context = {
                id: job.workflowExecutionId,
                workflowId: execution.workflow_id,
                tenantId: execution.tenant_id,
                variables: execution.variables,
                nodeResults: await this.getNodeResults(job.workflowExecutionId),
                currentNodes: execution.current_nodes,
                metadata: execution.context,
                state: 'running' as const
            };

            // Execute the node
            const result = await strategy.execute(context, node);

            if (result.success) {
                // Update node execution as completed
                await this.executionRepository.updateNodeExecution(nodeExecution.id, {
                    status: 'completed',
                    output_data: result.output,
                    completed_at: new Date().toISOString()
                });

                // Process next nodes
                await this.processNodeCompletion(job.workflowExecutionId, job.nodeId, result.output || {});

                // Publish node completion event
                await this.eventBus.publish('node.execution.completed', {
                    workflowExecutionId: job.workflowExecutionId,
                    nodeId: job.nodeId,
                    output: result.output
                });
            } else {
                // Handle node execution failure
                await this.handleNodeExecutionFailure(nodeExecution, result.error);
            }

        } catch (error) {
            console.error(`Node execution failed: ${job.nodeId}`, error);
            
            if (nodeExecution) {
                await this.handleNodeExecutionFailure(nodeExecution, error);
            }
        }
    }

    /**
     * Process workflow to get execution structure
     */
    private processWorkflow(workflow: WorkflowDefinitionQuery): ProcessedWorkflow {
        const workflowGraph = new WorkflowGraph(
            workflow.nodes.map(node => ({
                id: node.id,
                type: node.type as any,
                name: node.name,
                position: node.position || { x: 0, y: 0 },
                data: node.config || {}
            })),
            workflow.edges.map(edge => ({
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                condition: edge.condition
            }))
        );

        return workflowGraph.processWorkflow();
    }

    /**
     * Queue a node for execution
     */
    private async queueNodeExecution(
        workflowExecutionId: string,
        nodeId: string,
        input: Record<string, any>,
        context: Record<string, any>
    ): Promise<void> {
        const job: NodeExecutionJob = {
            workflowExecutionId,
            nodeId,
            input,
            context,
            attemptNumber: 1
        };

        await this.jobQueue.addJob('workflow-node-execution', job, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: 10,
            removeOnFail: 50
        });
    }

    /**
     * Process node completion and determine next nodes
     */
    private async processNodeCompletion(
        workflowExecutionId: string,
        completedNodeId: string,
        output: Record<string, any>
    ): Promise<void> {
        const execution = await this.executionRepository.getExecution(workflowExecutionId);
        if (!execution) return;

        const processedWorkflow = execution.context.processedWorkflow as ProcessedWorkflow;
        const adjacencyList = processedWorkflow.forest.adjacencyList;

        // Get next nodes
        const nextNodeIds = adjacencyList[completedNodeId]?.children || [];

        // Update workflow execution state
        const updatedCurrentNodes = execution.current_nodes.filter(id => id !== completedNodeId);
        const updatedCompletedNodes = [...execution.completed_nodes, completedNodeId];

        // Check if nodes are ready to execute
        const readyNodes: string[] = [];
        
        for (const nextNodeId of nextNodeIds) {
            const nodeRelation = adjacencyList[nextNodeId];
            if (nodeRelation) {
                // Check if all parent nodes are completed
                const allParentsCompleted = nodeRelation.parents.every(parentId => 
                    updatedCompletedNodes.includes(parentId)
                );

                if (allParentsCompleted && !updatedCurrentNodes.includes(nextNodeId)) {
                    readyNodes.push(nextNodeId);
                    updatedCurrentNodes.push(nextNodeId);
                }
            }
        }

        // Update workflow execution
        await this.executionRepository.updateExecution(workflowExecutionId, {
            current_nodes: updatedCurrentNodes,
            completed_nodes: updatedCompletedNodes
        });

        // Queue ready nodes for execution
        for (const nodeId of readyNodes) {
            // Get combined input from all predecessor outputs
            const nodeInput = await this.prepareNodeInput(workflowExecutionId, nodeId, processedWorkflow);
            
            await this.queueNodeExecution(workflowExecutionId, nodeId, nodeInput, {
                processedWorkflow,
                execution
            });
        }

        // Check if workflow is complete
        if (updatedCurrentNodes.length === 0) {
            await this.completeWorkflowExecution(workflowExecutionId);
        }
    }

    /**
     * Prepare input for a node based on its predecessors
     */
    private async prepareNodeInput(
        workflowExecutionId: string,
        nodeId: string,
        processedWorkflow: ProcessedWorkflow
    ): Promise<Record<string, any>> {
        const nodeRelation = processedWorkflow.forest.adjacencyList[nodeId];
        if (!nodeRelation || nodeRelation.parents.length === 0) {
            // If no parents, use workflow variables
            const execution = await this.executionRepository.getExecution(workflowExecutionId);
            return execution?.variables || {};
        }

        // Get outputs from all parent nodes
        const nodeExecutions = await this.executionRepository.listNodeExecutions(workflowExecutionId);
        const parentOutputs: Record<string, any> = {};

        for (const parentId of nodeRelation.parents) {
            const parentExecution = nodeExecutions.find(ne => ne.node_id === parentId && ne.status === 'completed');
            if (parentExecution && parentExecution.output_data) {
                parentOutputs[parentId] = parentExecution.output_data;
            }
        }

        // If only one parent, return its output directly
        if (nodeRelation.parents.length === 1) {
            const parentId = nodeRelation.parents[0];
            return parentOutputs[parentId] || {};
        }

        // Multiple parents, return combined output
        return parentOutputs;
    }

    /**
     * Get node execution results for building context
     */
    private async getNodeResults(workflowExecutionId: string): Promise<Record<string, any>> {
        const nodeExecutions = await this.executionRepository.listNodeExecutions(workflowExecutionId);
        const results: Record<string, any> = {};

        for (const execution of nodeExecutions) {
            if (execution.status === 'completed') {
                results[execution.node_id] = {
                    status: execution.status,
                    output: execution.output_data,
                    startedAt: execution.started_at,
                    completedAt: execution.completed_at
                };
            }
        }

        return results;
    }

    /**
     * Handle node execution failure
     */
    private async handleNodeExecutionFailure(nodeExecution: NodeExecution, error: any): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        await this.executionRepository.updateNodeExecution(nodeExecution.id, {
            status: 'failed',
            error_message: errorMessage,
            error_stack: errorStack,
            completed_at: new Date().toISOString()
        });

        // Update workflow execution if needed
        const execution = await this.executionRepository.getExecution(nodeExecution.workflow_execution_id);
        if (execution) {
            const updatedFailedNodes = [...execution.failed_nodes, nodeExecution.node_id];
            const updatedCurrentNodes = execution.current_nodes.filter(id => id !== nodeExecution.node_id);

            await this.executionRepository.updateExecution(nodeExecution.workflow_execution_id, {
                current_nodes: updatedCurrentNodes,
                failed_nodes: updatedFailedNodes
            });

            // If no more current nodes, mark workflow as failed
            if (updatedCurrentNodes.length === 0) {
                await this.executionRepository.updateExecution(nodeExecution.workflow_execution_id, {
                    status: 'failed',
                    error_message: `Node execution failed: ${nodeExecution.node_id}`,
                    completed_at: new Date().toISOString()
                });

                await this.eventBus.publish('workflow.execution.failed', {
                    workflowExecutionId: nodeExecution.workflow_execution_id,
                    error: errorMessage
                });
            }
        }

        // Publish node failure event
        await this.eventBus.publish('node.execution.failed', {
            workflowExecutionId: nodeExecution.workflow_execution_id,
            nodeId: nodeExecution.node_id,
            error: errorMessage
        });
    }

    /**
     * Complete workflow execution
     */
    private async completeWorkflowExecution(workflowExecutionId: string): Promise<void> {
        await this.executionRepository.updateExecution(workflowExecutionId, {
            status: 'completed',
            completed_at: new Date().toISOString()
        });

        await this.eventBus.publish('workflow.execution.completed', {
            workflowExecutionId
        });
    }

    /**
     * Setup event handlers for job processing
     */
    private setupEventHandlers(): void {
        // Register job processor for node executions
        this.jobQueue.process('workflow-node-execution', async (job) => {
            await this.executeNode(job.data as NodeExecutionJob);
        });
    }

    /**
     * Get workflow execution status
     */
    async getExecutionStatus(workflowExecutionId: string): Promise<{
        execution: WorkflowExecution;
        nodeExecutions: NodeExecution[];
    } | null> {
        const execution = await this.executionRepository.getExecution(workflowExecutionId);
        if (!execution) {
            return null;
        }

        const nodeExecutions = await this.executionRepository.listNodeExecutions(workflowExecutionId);

        return {
            execution,
            nodeExecutions
        };
    }

    /**
     * Pause workflow execution
     */
    async pauseExecution(workflowExecutionId: string): Promise<void> {
        await this.executionRepository.updateExecution(workflowExecutionId, {
            status: 'paused'
        });

        await this.eventBus.publish('workflow.execution.paused', {
            workflowExecutionId
        });
    }

    /**
     * Resume workflow execution
     */
    async resumeExecution(workflowExecutionId: string): Promise<void> {
        const execution = await this.executionRepository.getExecution(workflowExecutionId);
        if (!execution) {
            throw new Error(`Workflow execution not found: ${workflowExecutionId}`);
        }

        await this.executionRepository.updateExecution(workflowExecutionId, {
            status: 'running'
        });

        // Re-queue current nodes
        const processedWorkflow = execution.context.processedWorkflow as ProcessedWorkflow;
        for (const nodeId of execution.current_nodes) {
            const nodeInput = await this.prepareNodeInput(workflowExecutionId, nodeId, processedWorkflow);
            await this.queueNodeExecution(workflowExecutionId, nodeId, nodeInput, {
                processedWorkflow,
                execution
            });
        }

        await this.eventBus.publish('workflow.execution.resumed', {
            workflowExecutionId
        });
    }
}