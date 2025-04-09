import { defaultNodes } from '@/lib/defaultNodes';
import { FlowNode, NodeTypeOptions } from '@/utils/flow-types';
import React, { useCallback, useState } from 'react';

export function useNodeOperations(
    nodes: FlowNode[],
    setNodes: (nodes: FlowNode[] | ((prev: FlowNode[]) => FlowNode[])) => void
) {
    const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);

    // Add a new node to the flow
    const addNode = useCallback((type: NodeTypeOptions, position?: { x: number; y: number }) => {
        const template = defaultNodes[type];
        const nodeId = `node-${Date.now()}`;
        const workflowId = `workflow-${Date.now()}`;
        const userId = "default-user"; // In a real app, this would come from auth

        // Node dimensions - adjusted based on inspection of actual rendered nodes
        const nodeWidth = 220;  // Increased from original estimate
        const nodeHeight = 140; // Increased from original estimate
        const nodeMargin = 80;  // Increased for more spacing

        // Calculate position if not provided
        let xPosition = 250;
        let yPosition = 100;

        if (position) {
            // Use provided position
            xPosition = position.x;
            yPosition = position.y;
        } else if (nodes.length === 0) {
            // First node - place in top left with margin
            xPosition = 100;
            yPosition = 100;
        } else {
            // Try to find a position using a simpler, more reliable algorithm

            // First attempt - grid positioning with larger spacing
            const columns = 3;
            const gridSpacingX = nodeWidth + nodeMargin;
            const gridSpacingY = nodeHeight + nodeMargin;

            // Try positions in a grid pattern
            let found = false;

            // Try up to 6 rows and 3 columns of positions
            for (let row = 0; row < 6 && !found; row++) {
                for (let col = 0; col < columns && !found; col++) {
                    const testX = 100 + col * gridSpacingX;
                    const testY = 100 + row * gridSpacingY;

                    // Check if this position collides with any existing node
                    const hasCollision = nodes.some(node => {
                        const dx = Math.abs(node.position.x - testX);
                        const dy = Math.abs(node.position.y - testY);
                        return dx < nodeWidth && dy < nodeHeight;
                    });

                    if (!hasCollision) {
                        xPosition = testX;
                        yPosition = testY;
                        found = true;
                        break;
                    }
                }
            }

            // If grid approach didn't work, place to the right of all nodes
            if (!found) {
                // Find rightmost position
                const rightmostNode = nodes.reduce((rightmost, node) => {
                    return node.position.x > rightmost.position.x ? node : rightmost;
                }, nodes[0]);

                xPosition = rightmostNode.position.x + nodeWidth + nodeMargin;
                yPosition = rightmostNode.position.y;
            }
        }

        // Node type configurations
        const nodeConfigs: Record<string, {
            data: Record<string, any>,
            configComponentType?: string
        }> = {
            mercadolivreQa: {
                data: {
                    apiConfigured: false,
                    rulesCount: 0,
                    defaultResponseSet: false,
                    responseDelay: "Immediate",
                    workflowId,
                    userId,
                },
                configComponentType: 'mercadolivreQa'
            },
            whatsapp: {
                data: {
                    apiConfigured: false,
                    phoneNumberConfigured: false,
                    messageTemplatesCount: 0,
                    autoReplyEnabled: false,
                    responseDelay: "Immediate",
                    workflowId,
                    userId,
                },
                configComponentType: 'whatsapp'
            }
        };

        // Create node using the appropriate config or fallback to default
        const config = nodeConfigs[type];
        const nodeBase = {
            id: nodeId,
            type,
            position: { x: xPosition, y: yPosition },
        };

        const newNode = config
            ? {
                ...nodeBase,
                data: config.data,
                workflowId,
                userId,
                configComponentType: config.configComponentType
            }
            : {
                ...nodeBase,
                data: { ...(template?.data || {}) }
            };

        setNodes((prevNodes) => [...prevNodes, newNode as FlowNode]);
    }, [nodes, setNodes]);

    // Update an existing node
    const updateNode = useCallback((nodeId: string, data: Partial<Record<string, unknown>>) => {
        setNodes((prevNodes) =>
            prevNodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ) as FlowNode[]
        );
    }, [setNodes]);

    // Handle node double-click to open config
    const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
        setSelectedNode(node);
        setConfigDialogOpen(true);
    }, []);

    // Get node configuration title
    const getNodeConfigTitle = useCallback((nodeType: string) => {
        const nodeConfigTitle: Record<string, string> = {
            character: "Character Configuration",
            knowledge: "Knowledge Configuration",
            testing: "Testing Configuration",
            deployment: "Deployment Configuration",
            mercadolivreQa: "Mercado Livre Q&A Configuration",
            whatsapp: "WhatsApp Integration Configuration",
        };

        return nodeConfigTitle[nodeType] || "Node Configuration";
    }, []);

    // Get node configuration description
    const getNodeConfigDescription = useCallback((nodeType: string) => {
        const nodeConfigDescription: Record<string, string> = {
            mercadolivreQa: "Configure automated responses to customer questions",
            whatsapp: "Configure WhatsApp Business API integration and automation",
            character: "Configure the agent's personality and character",
            knowledge: "Configure the agent's knowledge sources",
            testing: "Configure testing scenarios for the agent",
            deployment: "Configure deployment settings for the agent",
        };

        return nodeConfigDescription[nodeType] || "Configure node settings";
    }, []);

    return {
        selectedNode,
        setSelectedNode,
        configDialogOpen,
        setConfigDialogOpen,
        addNode,
        updateNode,
        onNodeDoubleClick,
        getNodeConfigTitle,
        getNodeConfigDescription
    };
} 
