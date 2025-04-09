import { FlowNode } from '@/utils/flow-types';
import { Edge } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Custom hook for managing flow chart history with undo functionality
 * @param initialNodes - Initial array of nodes
 * @param initialEdges - Initial array of edges
 * @returns Object containing nodes, edges, setNodes, setEdges, and undo function
 */
export function useFlowHistory(
    initialNodes: FlowNode[] = [],
    initialEdges: Edge[] = [],
) {
    const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [history, setHistory] = useState<Array<{ nodes: FlowNode[], edges: Edge[] }>>([{ nodes: [], edges: [] }]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

    // Save current state to history when nodes or edges change
    useEffect(() => {
        // Create a serializable representation of the current state
        const newHistoryState = {
            nodes: nodes.map(node => ({
                id: node.id,
                type: node.type,
                position: { ...node.position },
                data: { ...node.data }
            })) as FlowNode[],
            edges: [...edges]
        };

        // Don't add duplicate states
        const currentState = history[currentHistoryIndex];

        // Skip if history isn't initialized yet
        if (!currentState) return;

        const isDuplicate =
            nodes.length === currentState.nodes.length &&
            edges.length === currentState.edges.length &&
            JSON.stringify(currentState.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }))) ===
            JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }))) &&
            JSON.stringify(currentState.edges) === JSON.stringify(edges);

        if (!isDuplicate) {
            // Remove any future history if we're not at the latest point
            const newHistory = history.slice(0, currentHistoryIndex + 1);
            setHistory([...newHistory, newHistoryState]);
            setCurrentHistoryIndex(newHistory.length);
        }
    }, [nodes, edges, history, currentHistoryIndex]);

    // Undo function to restore previous state
    const undo = useCallback(() => {
        if (currentHistoryIndex > 0) {
            const previousState = history[currentHistoryIndex - 1];
            setCurrentHistoryIndex(currentHistoryIndex - 1);

            // Restore previous state without triggering the history save effect
            setNodes(prevNodes => {
                // Handle empty state case
                if (previousState.nodes.length === 0) {
                    return [];
                }

                // Create new node instances with the same data to avoid React render issues
                return previousState.nodes.map(historyNode => {
                    // Find matching React component for the node if it exists
                    const existingNode = prevNodes.find(n => n.id === historyNode.id);
                    const configComponent = existingNode ? (existingNode as any).configComponent : undefined;

                    // Return the restored node with its config component
                    return {
                        ...historyNode,
                        configComponent
                    };
                });
            });
            setEdges(previousState.edges);
        }
    }, [history, currentHistoryIndex]);

    // Handle undo - Ctrl+Z keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Ctrl+Z (Windows/Linux) or Command+Z (Mac)
            if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
                event.preventDefault();
                undo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [undo]);

    return { nodes, edges, setNodes, setEdges, undo };
}
