"use client";

import { Button } from "@/components/ui/button";
import { FlowProvider, useFlowContext } from "@/contexts/FlowContext";
import { ReactFlowProvider } from "@xyflow/react";
import { ArrowLeft, Bot, Undo2 } from "lucide-react";
import Link from "next/link";
import FlowCanvas from "./FlowCanvas";
import NodeConfigDialog from "./NodeConfigDialog";
import NodesSidebar from "./NodesSidebar";
import SaveControls from "./SaveControls";

function AgentFlowEditorContent() {
  const {
    configDialogOpen,
    setConfigDialogOpen,
    selectedNode,
    getNodeConfigTitle,
    getNodeConfigDescription,
    updateNodeData,
    setNodes,
    undo,
  } = useFlowContext();

  // Get the title and description for the selected node
  const nodeConfigTitle = selectedNode
    ? getNodeConfigTitle(selectedNode.type || "")
    : "";

  const nodeConfigDescription = selectedNode
    ? getNodeConfigDescription(selectedNode.type || "")
    : "";

  // Handle node updates
  const handleUpdateNode = (newData: Record<string, any>) => {
    if (!selectedNode?.id) return;

    // Update the node data
    updateNodeData(selectedNode.id, newData);

    // Close the dialog
    setConfigDialogOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/agents">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold">Create Agent Flow</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button variant="outline" onClick={undo} title="Undo (Ctrl+Z)">
                <Undo2 className="h-4 w-4 mr-1" />
                Undo
              </Button>
            </div>
            <SaveControls />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r bg-white p-4 overflow-y-auto">
          <NodesSidebar />
        </div>

        <div className="flex-1 overflow-hidden">
          <FlowCanvas />
        </div>
      </div>

      <NodeConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        selectedNode={selectedNode}
        nodeConfigTitle={nodeConfigTitle}
        nodeConfigDescription={nodeConfigDescription}
        onUpdateNode={handleUpdateNode}
      />
    </div>
  );
}

export default function AgentFlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowProvider>
        <AgentFlowEditorContent />
      </FlowProvider>
    </ReactFlowProvider>
  );
}
