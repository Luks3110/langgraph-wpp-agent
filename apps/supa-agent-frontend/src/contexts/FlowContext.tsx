"use client";

import { useNodeCategories } from "@/hooks/flow/useNodeCategories";
import { useNodeOperations } from "@/hooks/flow/useNodeOperations";
import { useWorkflowProcessor } from "@/hooks/flow/useWorkflowProcessor";
import { useFlowHistory } from "@/hooks/useFlowHistory";
import { FlowNode } from "@/utils/flow-types";
import { Edge, OnConnectStartParams } from "@xyflow/react";
import { createContext, useContext, useState } from "react";

interface FlowContextType {
  // Flow state
  nodes: FlowNode[];
  edges: Edge[];
  setNodes: (nodes: FlowNode[] | ((prev: FlowNode[]) => FlowNode[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;

  // History
  undo: () => void;

  // Node operations
  addNode: (type: string, position?: { x: number; y: number }) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  getNodeConfigTitle: (nodeType: string) => string;
  getNodeConfigDescription: (nodeType: string) => string;
  updateNodeData: (nodeId: string, newData: Record<string, any>) => void;

  // Categories
  categories: { id: string; name: string; nodeTypes: string[] }[];

  // Dialog state
  configDialogOpen: boolean;
  setConfigDialogOpen: (open: boolean) => void;
  selectedNode: FlowNode | null;
  setSelectedNode: (node: FlowNode | null) => void;

  // Connect state
  connectingNodeId: string | null;
  setConnectingNodeId: (nodeId: string | null) => void;
  onConnectStart: (
    event: React.MouseEvent,
    params: OnConnectStartParams
  ) => void;
  onConnectEnd: (event: React.MouseEvent) => void;

  // Workflow operations
  isSaving: boolean;
  saveWorkflow: () => Promise<void>;
}

export const FlowContext = createContext<FlowContextType | undefined>(
  undefined
);

export function FlowProvider({ children }: { children: React.ReactNode }) {
  // Use flow history for undo/redo
  const { nodes, edges, setNodes, setEdges, undo } = useFlowHistory();

  // Dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

  // Connection state
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);

  // Initialize node operations
  const nodeOps = useNodeOperations(nodes, setNodes);

  // Get categories
  const { nodeCategories } = useNodeCategories();

  // Normalize categories to match expected format
  const categories = nodeCategories.map((category) => ({
    id: category.title.toLowerCase().replace(/\s+/g, "-"),
    name: category.title,
    nodeTypes: category.nodes.map((node) => node.type),
  }));

  // Workflow operations
  const { processWorkflow, saveWorkflow: saveWorkflowToAPI } =
    useWorkflowProcessor();
  const [isSaving, setIsSaving] = useState(false);

  // Combined save workflow function
  const saveWorkflow = async () => {
    setIsSaving(true);
    try {
      // Process the workflow data
      const workflowData = processWorkflow(nodes, edges);

      // Save to API
      await saveWorkflowToAPI(workflowData);
    } catch (error) {
      console.error("Error saving workflow:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Connection handlers
  const onConnectStart = (
    event: React.MouseEvent,
    params: OnConnectStartParams
  ) => {
    if (params.handleId) {
      setConnectingNodeId(params.nodeId);
    }
  };

  const onConnectEnd = (event: React.MouseEvent) => {
    setConnectingNodeId(null);
  };

  // Update node data
  const updateNodeData = (nodeId: string, newData: Record<string, any>) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId
          ? ({ ...node, data: { ...node.data, ...newData } } as FlowNode)
          : node
      )
    );

    setConfigDialogOpen(false);
  };

  // Create context value
  const contextValue: FlowContextType = {
    // Flow state
    nodes,
    edges,
    setNodes,
    setEdges,

    // History
    undo,

    // Node operations
    addNode: nodeOps.addNode as (
      type: string,
      position?: { x: number; y: number }
    ) => void,
    onNodeDoubleClick: (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        setConfigDialogOpen(true);
      }
    },
    getNodeConfigTitle: nodeOps.getNodeConfigTitle,
    getNodeConfigDescription: nodeOps.getNodeConfigDescription,
    updateNodeData,

    // Categories
    categories,

    // Dialog state
    configDialogOpen,
    setConfigDialogOpen,
    selectedNode,
    setSelectedNode,

    // Connect state
    connectingNodeId,
    setConnectingNodeId,
    onConnectStart,
    onConnectEnd,

    // Workflow operations
    isSaving,
    saveWorkflow,
  };

  return (
    <FlowContext.Provider value={contextValue}>{children}</FlowContext.Provider>
  );
}

export function useFlowContext() {
  const context = useContext(FlowContext);
  if (context === undefined) {
    throw new Error("useFlowContext must be used within a FlowProvider");
  }
  return context;
}
