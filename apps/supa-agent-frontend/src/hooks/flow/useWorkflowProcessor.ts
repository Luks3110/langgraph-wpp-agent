import { WorkflowGraph } from '@/lib/workflowGraph';
import { AgentWorkflow, FlowNode, NodeType, WorkflowEdge } from '@/utils/flow-types';
import { useCallback } from 'react';

export function useWorkflowProcessor() {
    // Process workflow for saving
    const processWorkflow = useCallback((nodes: FlowNode[], edges: WorkflowEdge[]): AgentWorkflow => {
        // Generate a workflow ID to use for nodes that don't have one
        const defaultWorkflowId = `workflow-${Date.now()}`;
        const defaultUserId = "default-user";

        // Use the WorkflowGraph class to process the workflow
        const workflowProcessor = new WorkflowGraph(
            nodes.map((node) => {
                // Get or create a workflowId
                const workflowId = (node as any).workflowId || defaultWorkflowId;
                const userId = (node as any).userId || defaultUserId;

                return {
                    id: node.id,
                    type: node.type as NodeType,
                    name: `${node.type || 'Unknown'} Node`,
                    position: node.position,
                    data: {
                        ...node.data,
                        // Make sure workflowId is in the data for certain node types
                        ...(node.type === "mercadolivreQa" && { workflowId, userId }),
                    },
                    // Include metadata for nodes
                    metadata: {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdBy: "system",
                        status: "draft",
                    },
                    // Include version
                    version: 1,
                    // Include workflowId
                    workflowId,
                };
            }),
            edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: typeof edge.label === "string" ? edge.label : undefined,
                type: "default",
                condition: edge.type === "default" ? undefined : edge.type,
            }))
        );

        // Process the workflow to generate the optimized data structure
        const processedWorkflow = workflowProcessor.processWorkflow();

        // Create the final workflow data structure
        return {
            id: crypto.randomUUID(),
            name: "New Agent Workflow",
            description: "Created via flowchart editor",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "draft",
            version: "1.0",
            workflow: processedWorkflow, // This should now be compatible
            metadata: {
                tags: [],
                author: "Agent Creator",
                runCount: 0,
                environment: "development",
            },
        };
    }, []);

    // Save workflow to API
    const saveWorkflow = useCallback(async (workflow: AgentWorkflow): Promise<void> => {
        // In a real implementation, this would call an API
        console.log("Saving agent configuration:", workflow);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Return the saved workflow or just complete
        return Promise.resolve();
    }, []);

    return {
        processWorkflow,
        saveWorkflow
    };
} 
