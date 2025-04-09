"use client";

import { Button } from "@/components/ui/button";
import { useFlowContext } from "@/contexts/FlowContext";
import { FlowNode } from "@/utils/flow-types";
import {
  Background,
  Connection,
  ConnectionLineType,
  Controls,
  Edge,
  EdgeChange,
  MarkerType,
  MiniMap,
  NodeChange,
  NodeMouseHandler,
  Panel,
  ReactFlow,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useKeyPress,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import nodeTypes from "./nodes";

export default function FlowCanvas() {
  const { nodes, edges, setNodes, setEdges, onNodeDoubleClick } =
    useFlowContext();

  // Selection state
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const deleteKeyPressed = useKeyPress("Delete");
  const backspaceKeyPressed = useKeyPress("Backspace");

  // Handle node changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Store selection state
      const selectionChanges = changes.filter(
        (change) => change.type === "select" && change.selected !== undefined
      );

      if (selectionChanges.length > 0) {
        const newSelectedNodes = [...selectedNodes];

        selectionChanges.forEach((change) => {
          if (change.type === "select" && change.id) {
            if (change.selected) {
              if (!newSelectedNodes.includes(change.id)) {
                newSelectedNodes.push(change.id);
              }
            } else {
              const index = newSelectedNodes.indexOf(change.id);
              if (index !== -1) {
                newSelectedNodes.splice(index, 1);
              }
            }
          }
        });

        setSelectedNodes(newSelectedNodes);
      }

      setNodes((nodes) => applyNodeChanges(changes, nodes) as FlowNode[]);
    },
    [setNodes, selectedNodes]
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Store selection state for edges
      const selectionChanges = changes.filter(
        (change) => change.type === "select" && change.selected !== undefined
      );

      if (selectionChanges.length > 0) {
        const newSelectedEdges = [...selectedEdges];

        selectionChanges.forEach((change) => {
          if (change.type === "select" && change.id) {
            if (change.selected) {
              if (!newSelectedEdges.includes(change.id)) {
                newSelectedEdges.push(change.id);
              }
            } else {
              const index = newSelectedEdges.indexOf(change.id);
              if (index !== -1) {
                newSelectedEdges.splice(index, 1);
              }
            }
          }
        });

        setSelectedEdges(newSelectedEdges);
      }

      setEdges((edges) => applyEdgeChanges(changes, edges));
    },
    [setEdges, selectedEdges]
  );

  // Handle edge connection
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((edges) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          edges
        )
      );
    },
    [setEdges]
  );

  // Handle edge deletion
  const onEdgeDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      setEdges((edges) =>
        edges.filter(
          (e) => !edgesToDelete.some((edge: Edge) => edge.id === e.id)
        )
      );
    },
    [setEdges]
  );

  // Handle node double click to adapt to expected ReactFlow signature
  const handleNodeDoubleClick: NodeMouseHandler<FlowNode> = useCallback(
    (event, node) => {
      onNodeDoubleClick(node.id);
    },
    [onNodeDoubleClick]
  );

  // Handle deletion with keyboard or button
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      // Delete selected nodes
      if (selectedNodes.length > 0) {
        setNodes((nodes) =>
          nodes.filter((node) => !selectedNodes.includes(node.id))
        );
      }

      // Delete selected edges
      if (selectedEdges.length > 0) {
        setEdges((edges) =>
          edges.filter((edge) => !selectedEdges.includes(edge.id))
        );
      }

      // Clear selections
      setSelectedNodes([]);
      setSelectedEdges([]);
    }
  }, [selectedNodes, selectedEdges, setNodes, setEdges]);

  // Define default connection line style
  const defaultConnectionLineStyle = useMemo(
    () => ({ stroke: "#4299e1", strokeWidth: 2 }),
    []
  );

  // Define default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#4299e1", strokeWidth: 2 },
      deletable: true,
    }),
    []
  );

  // Respond to keyboard delete keys
  useMemo(() => {
    if (
      (deleteKeyPressed || backspaceKeyPressed) &&
      (selectedNodes.length > 0 || selectedEdges.length > 0)
    ) {
      handleDeleteSelected();
    }
  }, [
    deleteKeyPressed,
    backspaceKeyPressed,
    handleDeleteSelected,
    selectedNodes.length,
    selectedEdges.length,
  ]);

  return (
    <div className="w-full h-full border rounded-lg bg-gray-50 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgeDelete}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={defaultConnectionLineStyle}
        connectionLineType={ConnectionLineType.Bezier}
        snapToGrid={true}
        snapGrid={[15, 15]}
        deleteKeyCode={["Backspace", "Delete"]}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={true}
        multiSelectionKeyCode="Shift"
      >
        <Panel position="top-right" className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className={`flex items-center gap-1 ${selectedNodes.length === 0 && selectedEdges.length === 0 ? "opacity-50" : ""}`}
            onClick={handleDeleteSelected}
            disabled={selectedNodes.length === 0 && selectedEdges.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected{" "}
            {selectedNodes.length + selectedEdges.length > 0
              ? `(${selectedNodes.length + selectedEdges.length})`
              : ""}
          </Button>
        </Panel>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
