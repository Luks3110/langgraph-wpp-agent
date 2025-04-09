import { FlowNode } from '@/utils/flow-types';
import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Connection,
    Edge,
    EdgeChange,
    MarkerType,
    NodeChange
} from '@xyflow/react';
import { useCallback, useState } from 'react';

export function useFlowState(initialNodes: FlowNode[] = [], initialEdges: Edge[] = []) {
    const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    // Handle node changes
    const onNodesChange = useCallback(
        (changes: NodeChange[]) =>
            setNodes((nds) => applyNodeChanges(changes, nds) as FlowNode[]),
        []
    );

    // Handle edge changes
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) =>
            setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    // Handle edge connection
    const onConnect = useCallback((params: Connection) => {
        const edgeId = `e${params.source}-${params.target}`;

        setEdges((eds) => {
            // Check if connection already exists
            const connectionExists = eds.some(
                (edge) =>
                    edge.source === params.source && edge.target === params.target
            );

            if (connectionExists) {
                return eds;
            }

            // Add new edge with default settings
            return addEdge(
                {
                    ...params,
                    id: edgeId,
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    deletable: true,
                },
                eds
            );
        });
    }, []);

    // Handle edge deletion
    const onEdgeDelete = useCallback((edgesToDelete: Edge[]) => {
        setEdges((eds) =>
            eds.filter((e) => !edgesToDelete.some((edge) => edge.id === e.id))
        );
    }, []);

    return {
        nodes,
        edges,
        setNodes,
        setEdges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onEdgeDelete
    };
} 
