"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import CharacterNode from "@/components/nodes/character";
import MercadoLivreQAConfig from "@/components/nodes/configs/mercado-livre-qa-config";
import KnowledgeNode from "@/components/nodes/knowledge";
import MercadoLivreQANode, { IMercadoLivreQANode } from "@/components/nodes/mercado-livre-qa";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useFlowHistory } from "@/hooks/useFlowHistory";
import { NodeType, WorkflowGraph } from "@/lib/workflowGraph";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionLineType,
  Controls,
  Edge,
  EdgeChange,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Bot, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

// Update node type definitions
interface CharacterData {
  name: string;
  personality: string;
  [key: string]: unknown;
}

interface KnowledgeData {
    domain: string;
    sources: string;
  [key: string]: unknown;
}

interface TestingData {
    testCases: string;
    status: string;
  [key: string]: unknown;
}

interface DeploymentData {
    environment: string;
    status: string;
  [key: string]: unknown;
}

type CharacterNode = Node<CharacterData, 'character'>;
type KnowledgeNode = Node<KnowledgeData, 'knowledge'>;
type TestingNode = Node<TestingData, 'testing'>;
type DeploymentNode = Node<DeploymentData, 'deployment'>;

// Update FlowNode type to include all possible node types
export type FlowNode = CharacterNode | KnowledgeNode | TestingNode | DeploymentNode | IMercadoLivreQANode;

// Update node components with proper typing
const TestingNodeComponent = ({ data, ...rest }: NodeProps<TestingNode>) => {
  console.log("🚀 ~ TestingNodeComponent ~ data:", data, rest)
  return (
  <div className="bg-white p-4 rounded-lg border shadow-sm w-64 relative group">
    <Handle
      type="target"
      position={Position.Top}
      id="target-top"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      id="source-bottom"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <Handle
      type="target"
      position={Position.Left}
      id="target-left"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <Handle
      type="source"
      position={Position.Right}
      id="source-right"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <div className="flex items-center gap-2 mb-2">
      <div className="bg-yellow-100 p-1 rounded-full">
        <Bot className="h-4 w-4 text-yellow-600" />
      </div>
      <h3 className="text-sm font-medium">Testing Configuration</h3>
    </div>
    <div className="text-xs text-gray-500 mb-2">
      Test your agent's responses and behavior
    </div>
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex justify-between">
        <span>Test Cases:</span>
        <span className="font-medium">{data.testCases || "Not set"}</span>
      </div>
      <div className="flex justify-between">
        <span>Status:</span>
        <span className="font-medium">{data.status || "Not tested"}</span>
      </div>
    </div>
  </div>
);
}

const DeploymentNodeComponent = ({ data }: { data: any }) => (
  <div className="bg-white p-4 rounded-lg border shadow-sm w-64 relative group">
    <Handle
      type="target"
      position={Position.Top}
      id="target-top"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      id="source-bottom"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <Handle
      type="target"
      position={Position.Left}
      id="target-left"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <Handle
      type="source"
      position={Position.Right}
      id="source-right"
      style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
    <div className="flex items-center gap-2 mb-2">
      <div className="bg-purple-100 p-1 rounded-full">
        <Bot className="h-4 w-4 text-purple-600" />
      </div>
      <h3 className="text-sm font-medium">Deployment Configuration</h3>
    </div>
    <div className="text-xs text-gray-500 mb-2">
      Configure deployment settings for your agent
    </div>
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex justify-between">
        <span>Environment:</span>
        <span className="font-medium">{data.environment || "Not set"}</span>
      </div>
      <div className="flex justify-between">
        <span>Status:</span>
        <span className="font-medium">{data.status || "Not deployed"}</span>
      </div>
    </div>
  </div>
);

// Define a type for nodeTypes
const nodeTypes: any = {
  character: CharacterNode,
  knowledge: KnowledgeNode,
  testing: TestingNodeComponent,
  deployment: DeploymentNodeComponent,
  mercadolivreQa: MercadoLivreQANode,
};

// Update initialNodes type
const initialNodes: FlowNode[] = [];

// Update initialEdges type
const initialEdges: Edge[] = [];

// Update the AgentWorkflow interface to align with our Node Architecture
interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'archived';
  version: string;
  workflow: {
    // Forest representation - collection of trees
    forest: {
      // Each tree has an entry node as its root
      roots: string[];
      // Directed adjacency list representation for efficient traversal
      adjacencyList: Record<string, {
        children: string[];
        parents: string[];
        depth: number; // Depth in the tree for efficient sorting
        pathIndices: number[]; // Which paths this node belongs to
      }>;
    };
    // Nodes data store
    nodes: Record<string, {
      id: string;
      type: NodeType; // Use the NodeType from workflowGraph.ts
      name: string;
      position: { x: number; y: number };
      data: Record<string, any>;
      metadata?: {
        createdAt?: Date;
        updatedAt?: Date;
        createdBy?: string;
        tags?: string[];
        status?: 'draft' | 'published' | 'deprecated';
      };
      version?: number;
      workflowId?: string;
    }>;
    // Execution paths through the workflow
    paths: Array<{
      id: string;
      name: string;
      rootId: string; // The entry point for this path
      nodeSequence: string[]; // Pre-computed optimal traversal
    }>;
    // Visual representation for the UI
    edges: Record<string, {
      id: string;
      source: string;
      target: string;
      label?: string;
      type?: 'success' | 'failure' | 'default';
      condition?: string;
    }>;
    execution: {
      branchPoints: string[];
      leafNodes: string[];
      convergencePoints: string[];
      parallelExecutionGroups: string[][];
      metadata?: any;
    };
  };
  metadata: {
    tags: string[];
    author: string;
    lastRun?: string;
    runCount: number;
    avgExecutionTime?: number;
    environment: 'development' | 'staging' | 'production';
  };
}

export default function CreateAgentFlowPage() {
  const router = useRouter();
  const { nodes, edges, setNodes, setEdges } = useFlowHistory<FlowNode, Edge>(initialNodes, initialEdges);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [configSheetOpen, setConfigSheetOpen] = useState(false);

  const nodeTemplates = useMemo(() => ({
    character: {
      type: "character",
      data: { name: "New Character", personality: "Default" },
    },
    knowledge: {
      type: "knowledge",
      data: { domain: "General", sources: "None" },
    },
    testing: {
      type: "testing",
      data: { testCases: "0", status: "Not started" },
    },
    deployment: {
      type: "deployment",
      data: { environment: "Development", status: "Not deployed" },
    },
    mercadolivreQa: {
      type: "mercadolivreQa",
      data: { 
        apiConfigured: false, 
        rulesCount: 0, 
        defaultResponseSet: false,
        responseDelay: 'Immediate'
      },
    },
  }), []);

  // Handle node changes
  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) =>
      setNodes((nds: FlowNode[]) => applyNodeChanges(changes, nds)),
    [],
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds: Edge[]) => applyEdgeChanges(changes, eds)),
    [],
  );

  // Update onConnect type
  const onConnect = useCallback(
    (params: any) => {
      const edgeId = `e${params.source}-${params.target}`;
      
      setEdges((eds: Edge[]) => {
        const connectionExists = eds.some(
          (edge: Edge) => edge.source === params.source && edge.target === params.target
        );
        
        if (connectionExists) {
          return eds;
        }
        
        if (typeof addEdge === "function") {
          return addEdge(
            {
              ...params,
              id: edgeId,
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
              deletable: true,
            },
            eds,
          );
        }
        
        return [
          ...eds,
          {
            id: edgeId,
            source: params.source,
            target: params.target,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            deletable: true,
          },
        ];
      });
    },
    [],
  );

  // Edge deletion handler
  const onEdgeDelete = useCallback((edges: Edge[]) => {
    setEdges((eds) => eds.filter(e => !edges.some(edge => edge.id === e.id)));
  }, []);

  // Update addNode function type
  const addNode = (type: 'character' | 'knowledge' | 'testing' | 'deployment' | 'mercadolivreQa') => {
    const template = nodeTemplates[type];
    const nodeId = `node-${Date.now()}`;
    const workflowId = `workflow-${Date.now()}`;
    const userId = 'default-user'; // In a real app, this would come from auth
    
    const nodeCount = nodes.length;
    const column = Math.floor(nodeCount / 3);
    const row = nodeCount % 3;
    const xPosition = 250 + column * 300;
    const yPosition = 100 + row * 200;

    const getNewNode = (): FlowNode => {
      const baseConfig = {
        id: nodeId,
        type,
        position: { x: xPosition, y: yPosition },
        data: { 
          ...template.data,
          // Add workflowId to the node data for webhook URLs
          workflowId: type === 'mercadolivreQa' ? workflowId : undefined
        },
        // Add these properties at the top level too for consistency
        workflowId: workflowId,
        userId: userId
      }
      const configComponents = {
        mercadolivreQa: <MercadoLivreQAConfig 
          node={{
            ...baseConfig,
            data: {
              ...baseConfig.data,
              workflowId,
              userId
            }
          } as IMercadoLivreQANode} 
          updateNode={(data) => handleUpdateNode(baseConfig.id, data)} 
        />
      }

      return {
        ...baseConfig,
        configComponent: configComponents[type as keyof typeof configComponents]
      } as FlowNode;
    }

    const newNode = getNewNode();
    
    setNodes([...nodes, newNode]);
  };

  // Update onNodeDoubleClick type
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node);
    setConfigSheetOpen(true);
  }, []);

  // Handle sheet close
  const handleSheetClose = useCallback(() => {
    setConfigSheetOpen(false);
  }, []);

  // Update handleUpdateNode type
  const handleUpdateNode = useCallback((nodeId: string, data: Partial<IMercadoLivreQANode['data']>) => {
    setNodes(prevNodes => 
      prevNodes.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ) as FlowNode[]);
  }, []);

  // Define default connection line style and other flow settings
  const defaultConnectionLineStyle = useMemo(() => ({ stroke: '#4299e1', strokeWidth: 2 }), []);
  const defaultEdgeOptions = useMemo(() => ({ 
    animated: true, 
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#4299e1', strokeWidth: 2 },
    deletable: true,
  }), []);

  // Update the handleSave function
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Generate a workflow ID to use for nodes that don't have one
      const defaultWorkflowId = `workflow-${Date.now()}`;
      const defaultUserId = 'default-user';
      
      // Use the WorkflowGraph class to process the workflow
      const workflowProcessor = new WorkflowGraph(
        nodes.map(node => {
          // Get or create a workflowId
          const workflowId = (node as any).workflowId || defaultWorkflowId;
          const userId = (node as any).userId || defaultUserId;
          
          return {
            id: node.id,
            type: node.type as NodeType, // Cast to our NodeType
            name: `${node.type} Node`,
            position: node.position,
            data: {
              ...node.data,
              // Make sure workflowId is in the data for MercadoLivreQA nodes
              ...(node.type === 'mercadolivreQa' && { workflowId, userId })
            },
            // Include metadata for nodes
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: 'system',
              status: 'draft'
            },
            // Include version
            version: 1,
            // Include workflowId
            workflowId
          };
        }),
        edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: typeof edge.label === 'string' ? edge.label : undefined,
          type: 'default',
          condition: edge.type === 'default' ? undefined : edge.type
        }))
      );

      // Process the workflow to generate the optimized data structure
      const processedWorkflow = workflowProcessor.processWorkflow();
      
      // Create the final workflow data structure
      const workflowData: AgentWorkflow = {
        id: crypto.randomUUID(),
        name: "New Agent Workflow",
        description: "Created via flowchart editor",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        version: "1.0",
        workflow: processedWorkflow, // This should now be compatible
        metadata: {
          tags: [],
          author: 'Agent Creator',
          runCount: 0,
          environment: 'development'
        }
      };

      // Save to API/database
      console.log("Saving agent configuration:", workflowData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error("Error saving agent configuration:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Get node configuration title based on node type
  const getNodeConfigTitle = useCallback((nodeType: string) => {

    const nodeConfigTitle = {
      character: 'Character Configuration',
      knowledge: 'Knowledge Configuration',
      testing: 'Testing Configuration',
      deployment: 'Deployment Configuration',
      'mercadolivre-qa': 'Mercado Livre Q&A Configuration',
    }

    return nodeConfigTitle[nodeType as keyof typeof nodeConfigTitle] || 'Node Configuration';
  }, []);

  // Get node configuration description based on node type
  const getNodeConfigDescription = useCallback((nodeType: string) => {
    const nodeConfigDescription = {
      'mercadolivre-qa': 'Configure automated responses to customer questions',
    }

    return nodeConfigDescription[nodeType as keyof typeof nodeConfigDescription] || 'Configure node settings';
  }, []);


  return (
    <ReactFlowProvider>
      <div className="min-h-screen bg-background">
        <DashboardNavbar />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-2 rounded-full">
                <Bot className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold">
                Create Agent with Flowchart
              </h1>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Agent Creation Process</CardTitle>
                <CardDescription>
                  Create your AI agent by connecting different configuration
                  nodes in a flowchart. Click and drag between node handles to create connections.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addNode("character")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Character Node
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addNode("knowledge")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Knowledge Node
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addNode("testing")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Testing Node
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addNode("deployment")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Deployment Node
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addNode("mercadolivreQa")}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Mercado Livre Q&A
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  <p>• Double-click nodes to configure them</p>
                  <p>• Hover over nodes to reveal connection handles</p>
                  <p>• Drag from any handle to connect nodes</p>
                  <p>• Click on an edge to delete it</p>
                  <p>• Press Ctrl+Z to undo the last action</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full width ReactFlow container */}
          <div className="w-full h-[700px] border rounded-lg bg-gray-50 mb-6">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgesDelete={onEdgeDelete}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              fitView
              defaultEdgeOptions={defaultEdgeOptions}
              connectionLineStyle={defaultConnectionLineStyle}
              connectionLineType={ConnectionLineType.Bezier}
              snapToGrid={true}
              snapGrid={[15, 15]}
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="px-6">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Agent Configuration"}
            </Button>
          </div>

          {/* Configuration Sheet */}
          <Sheet open={configSheetOpen} onOpenChange={setConfigSheetOpen}>
            <SheetContent className="overflow-y-auto">
              {selectedNode && (
                <>
                  <SheetHeader>
                    <SheetTitle>{getNodeConfigTitle(selectedNode.type!)}</SheetTitle>
                    <SheetDescription>
                      {getNodeConfigDescription(selectedNode.type!)}
                    </SheetDescription>
                  </SheetHeader>
                  
                  {(selectedNode as any).configComponent}
                  
                  {/* Add configuration components for other node types as needed */}
                </>
              )}
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </ReactFlowProvider>
  );
}
