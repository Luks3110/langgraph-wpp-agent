import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowExecutionEngine } from '../../../src/domain/execution/executionEngine';
import { ExecutionResult, WorkflowState } from '../../../src/domain/execution/models';
import { HttpRequestNodeStrategy, NodeExecutionFactory, TransformNodeStrategy, WebhookNodeStrategy } from '../../../src/domain/execution/nodeStrategy';
import { WorkflowDefinitionQuery } from '../../../src/domain/queries';

// Mock dependencies
vi.mock('../../../src/infrastructure/eventBus/bullmqEventBus', () => {
    return {
        EventBus: vi.fn().mockImplementation(() => ({
            publish: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn()
        }))
    };
});

vi.mock('../../../src/infrastructure/bullmq/jobQueue', () => {
    return {
        JobQueue: vi.fn().mockImplementation(() => ({
            addJob: vi.fn().mockResolvedValue('job-1')
        }))
    };
});

// Mock fetch for HTTP node tests
global.fetch = vi.fn();

describe('WorkflowExecutionEngine', () => {
    let engine: WorkflowExecutionEngine;
    let eventBus: any;
    let jobQueue: any;
    let nodeExecutionFactory: NodeExecutionFactory;

    const mockWorkflow: WorkflowDefinitionQuery = {
        id: 'workflow-1',
        name: 'Test Workflow',
        status: 'published',
        nodes: [
            {
                id: 'node-1',
                type: 'webhook',
                name: 'Webhook Trigger',
                position: { x: 100, y: 100 }
            },
            {
                id: 'node-2',
                type: 'transform',
                name: 'Data Transformation',
                position: { x: 300, y: 100 },
                config: {
                    transformationType: 'map',
                    template: 'data.value * 2'
                }
            },
            {
                id: 'node-3',
                type: 'http',
                name: 'API Call',
                position: { x: 500, y: 100 },
                config: {
                    url: 'https://api.example.com/data',
                    method: 'POST'
                }
            }
        ],
        edges: [
            {
                source: 'node-1',
                target: 'node-2'
            },
            {
                source: 'node-2',
                target: 'node-3'
            }
        ],
        metadata: {
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            createdBy: 'user-1',
            tags: ['test'],
            executionCount: 0
        }
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Set up mock fetch response
        (global.fetch as any).mockResolvedValue({
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ success: true }),
            text: () => Promise.resolve('OK')
        });

        // Create dependencies
        eventBus = { publish: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn() };
        jobQueue = { addJob: vi.fn().mockResolvedValue('job-1') };

        // Create node execution factory with strategies
        nodeExecutionFactory = new NodeExecutionFactory();
        nodeExecutionFactory.registerStrategy('webhook', new WebhookNodeStrategy());
        nodeExecutionFactory.registerStrategy('transform', new TransformNodeStrategy());
        nodeExecutionFactory.registerStrategy('http', new HttpRequestNodeStrategy());

        // Create the execution engine
        engine = new WorkflowExecutionEngine(
            eventBus,
            jobQueue,
            nodeExecutionFactory
        );
    });

    describe('processWorkflow', () => {
        it('should process a workflow and identify nodes and relationships', () => {
            const processedWorkflow = engine.processWorkflow(mockWorkflow);

            expect(processedWorkflow.nodes).toBeDefined();
            expect(Object.keys(processedWorkflow.nodes).length).toBe(3);

            expect(processedWorkflow.adjacencyList).toBeDefined();
            expect(processedWorkflow.adjacencyList['node-1']).toContain('node-2');
            expect(processedWorkflow.adjacencyList['node-2']).toContain('node-3');

            expect(processedWorkflow.entryNodes).toContain('node-1');
            expect(processedWorkflow.exitNodes).toContain('node-3');

            expect(processedWorkflow.branchPoints).toHaveLength(0); // No branch points in this workflow
            expect(Object.keys(processedWorkflow.convergencePoints)).toHaveLength(0); // No convergence points
        });

        it('should identify branch points and convergence points', () => {
            // Create a workflow with branch and convergence points
            const branchWorkflow: WorkflowDefinitionQuery = {
                ...mockWorkflow,
                nodes: [
                    ...mockWorkflow.nodes,
                    {
                        id: 'node-4',
                        type: 'transform',
                        name: 'Alternate Transform',
                        position: { x: 300, y: 200 }
                    },
                    {
                        id: 'node-5',
                        type: 'http',
                        name: 'Final API Call',
                        position: { x: 700, y: 150 }
                    }
                ],
                edges: [
                    ...mockWorkflow.edges,
                    {
                        source: 'node-1',
                        target: 'node-4'
                    },
                    {
                        source: 'node-2',
                        target: 'node-5'
                    },
                    {
                        source: 'node-3',
                        target: 'node-5'
                    },
                    {
                        source: 'node-4',
                        target: 'node-5'
                    }
                ]
            };

            const processedWorkflow = engine.processWorkflow(branchWorkflow);

            // node-1 should be a branch point (to node-2 and node-4)
            expect(processedWorkflow.branchPoints).toContain('node-1');

            // node-5 should be a convergence point (from node-2, node-3, node-4)
            expect(Object.keys(processedWorkflow.convergencePoints)).toContain('node-5');
            expect(processedWorkflow.convergencePoints['node-5']).toContain('node-2');
            expect(processedWorkflow.convergencePoints['node-5']).toContain('node-3');
            expect(processedWorkflow.convergencePoints['node-5']).toContain('node-4');
        });
    });

    describe('validateWorkflow', () => {
        it('should validate a valid workflow', async () => {
            const result = await engine.validateWorkflow(mockWorkflow);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate node configurations', async () => {
            // Create a workflow with an invalid node
            const invalidWorkflow: WorkflowDefinitionQuery = {
                ...mockWorkflow,
                nodes: [
                    ...mockWorkflow.nodes.slice(0, 2),
                    {
                        id: 'node-3',
                        type: 'http',
                        name: 'Invalid API Call',
                        position: { x: 500, y: 100 },
                        config: {
                            // Missing required URL
                            method: 'POST'
                        }
                    }
                ]
            };

            const result = await engine.validateWorkflow(invalidWorkflow);

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('HTTP request node is missing required URL');
        });
    });

    describe('startExecution', () => {
        it('should start a workflow execution', async () => {
            const executionId = await engine.startExecution('workflow-1', 'tenant-1', mockWorkflow);

            expect(executionId).toBeDefined();

            // Get the execution state
            const state = engine.getExecutionState(executionId);

            expect(state).not.toBeNull();
            expect(state?.workflowId).toBe('workflow-1');
            expect(state?.tenantId).toBe('tenant-1');
            expect(state?.state).toBe(WorkflowState.RUNNING);

            // Should have published a workflow started event
            expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
                type: 'workflow.execution.started',
                payload: expect.objectContaining({
                    workflowId: 'workflow-1',
                    executionId
                })
            }));

            // Should have queued jobs for the entry nodes
            expect(jobQueue.addJob).toHaveBeenCalledWith(
                'workflow-node-execution',
                expect.objectContaining({
                    executionId,
                    nodeId: 'node-1'
                }),
                expect.anything()
            );
        });
    });

    describe('executeNode', () => {
        it('should execute a node in the workflow', async () => {
            // Start a workflow
            const executionId = await engine.startExecution('workflow-1', 'tenant-1', mockWorkflow);

            // Mock the node execution result
            const mockNodeResult: ExecutionResult = {
                success: true,
                output: { value: 42 }
            };

            // Spy on the executeNode method on the state machine
            const executeNodeSpy = vi.spyOn(engine['stateMachine'], 'executeNode');
            executeNodeSpy.mockResolvedValue(mockNodeResult);

            // Execute the node
            const result = await engine.executeNode(executionId, 'node-1');

            expect(result).toEqual(mockNodeResult);

            // Should have called the state machine's executeNode method
            expect(executeNodeSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: executionId }),
                'node-1'
            );
        });
    });

    describe('pauseExecution and resumeExecution', () => {
        it('should pause and resume a workflow execution', async () => {
            // Start a workflow
            const executionId = await engine.startExecution('workflow-1', 'tenant-1', mockWorkflow);

            // Pause the workflow
            await engine.pauseExecution(executionId);

            // Get the execution state
            let state = engine.getExecutionState(executionId);
            expect(state?.state).toBe(WorkflowState.PAUSED);

            // Resume the workflow
            await engine.resumeExecution(executionId);

            // Get the updated execution state
            state = engine.getExecutionState(executionId);
            expect(state?.state).toBe(WorkflowState.RUNNING);

            // Should have queued jobs for current nodes
            expect(jobQueue.addJob).toHaveBeenCalledWith(
                'workflow-node-execution',
                expect.objectContaining({
                    executionId,
                    nodeId: expect.any(String)
                }),
                expect.anything()
            );
        });
    });

    describe('cancelExecution', () => {
        it('should cancel a workflow execution', async () => {
            // Start a workflow
            const executionId = await engine.startExecution('workflow-1', 'tenant-1', mockWorkflow);

            // Cancel the workflow
            await engine.cancelExecution(executionId);

            // Get the execution state
            const state = engine.getExecutionState(executionId);
            expect(state?.state).toBe(WorkflowState.CANCELED);
        });
    });
}); 
