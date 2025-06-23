"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WorkflowAPI } from "@/lib/workflow-api";
import { Workflow, WorkflowStatus } from "@/types/workflow";
import {
  Calendar,
  Edit,
  GitBranch,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { createClient } from "../../../../supabase/client";

export default function WorkflowsClient() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | WorkflowStatus>("all");
  const [sortBy, setSortBy] = useState<"name" | "updated" | "created">("name");
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          setAuthToken(session.access_token);
          console.log("Auth token obtained, loading workflows...");
          await loadWorkflows(session.access_token);
        } else {
          console.error("No session or access token available");
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const loadWorkflows = async (token?: string) => {
    try {
      setLoading(true);
      console.log("Loading workflows with token:", !!token);
      const response = await WorkflowAPI.listWorkflows({ authToken: token || authToken || undefined });
      console.log("Workflows loaded:", response);
      setWorkflows(response.data);
    } catch (error) {
      console.error("Failed to load workflows:", error);
      toast({
        title: "Error",
        description: "Failed to load workflows. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort workflows
  const filteredWorkflows = workflows.filter((workflow) => {
    if (filter === "all") return true;
    return workflow.status === filter;
  });

  const sortedWorkflows = [...filteredWorkflows].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "updated")
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sortBy === "created")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const handleStatusToggle = async (workflowId: string, currentStatus: WorkflowStatus) => {
    try {
      if (currentStatus === "active") {
        await WorkflowAPI.deactivateWorkflow(workflowId, authToken || undefined);
      } else {
        await WorkflowAPI.activateWorkflow(workflowId, authToken || undefined);
      }
      await loadWorkflows();
      toast({
        title: "Success",
        description: `Workflow ${currentStatus === "active" ? "deactivated" : "activated"} successfully`,
      });
    } catch (error) {
      console.error("Failed to toggle workflow status:", error);
      toast({
        title: "Error",
        description: "Failed to update workflow status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      await WorkflowAPI.deleteWorkflow(workflowId, authToken || undefined);
      await loadWorkflows();
      toast({
        title: "Success",
        description: "Workflow deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast({
        title: "Error",
        description: "Failed to delete workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExecute = async (workflowId: string) => {
    try {
      await WorkflowAPI.executeWorkflow(workflowId, {}, authToken || undefined);
      toast({
        title: "Success",
        description: "Workflow execution started",
      });
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      toast({
        title: "Error",
        description: "Failed to execute workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="w-full bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600">Create and manage your automated workflows</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadWorkflows()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/agents/create-flow">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Workflow Overview</CardTitle>
                <CardDescription>
                  Manage and monitor your automated workflows
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Sort:{" "}
                    {sortBy === "name"
                      ? "Name"
                      : sortBy === "updated"
                        ? "Recently Updated"
                        : "Recently Created"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("name")}>
                    Name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("updated")}>
                    Recently Updated
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("created")}>
                    Recently Created
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setFilter(value as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Workflows</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <WorkflowGrid
                  workflows={sortedWorkflows}
                  loading={loading}
                  onStatusToggle={handleStatusToggle}
                  onDelete={handleDelete}
                  onExecute={handleExecute}
                />
              </TabsContent>

              <TabsContent value="active" className="mt-0">
                <WorkflowGrid
                  workflows={sortedWorkflows}
                  loading={loading}
                  onStatusToggle={handleStatusToggle}
                  onDelete={handleDelete}
                  onExecute={handleExecute}
                />
              </TabsContent>

              <TabsContent value="inactive" className="mt-0">
                <WorkflowGrid
                  workflows={sortedWorkflows}
                  loading={loading}
                  onStatusToggle={handleStatusToggle}
                  onDelete={handleDelete}
                  onExecute={handleExecute}
                />
              </TabsContent>

              <TabsContent value="archived" className="mt-0">
                <WorkflowGrid
                  workflows={sortedWorkflows}
                  loading={loading}
                  onStatusToggle={handleStatusToggle}
                  onDelete={handleDelete}
                  onExecute={handleExecute}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

interface WorkflowGridProps {
  workflows: Workflow[];
  loading: boolean;
  onStatusToggle: (id: string, status: WorkflowStatus) => void;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
}

function WorkflowGrid({
  workflows,
  loading,
  onStatusToggle,
  onDelete,
  onExecute,
}: WorkflowGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-12">
        <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No workflows found
        </h3>
        <p className="text-gray-600 mb-4">
          Get started by creating your first workflow
        </p>
        <Link href="/agents/create-flow">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onStatusToggle={onStatusToggle}
          onDelete={onDelete}
          onExecute={onExecute}
        />
      ))}
    </div>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
  onStatusToggle: (id: string, status: WorkflowStatus) => void;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
}

function WorkflowCard({
  workflow,
  onStatusToggle,
  onDelete,
  onExecute,
}: WorkflowCardProps) {
  const StatusBadge = ({ status }: { status: WorkflowStatus }) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive" },
      archived: { color: "bg-yellow-100 text-yellow-800", label: "Archived" },
    };

    const config = statusConfig[status] || statusConfig.inactive;

    return (
      <Badge variant="secondary" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case "webhook":
        return <Zap className="h-4 w-4" />;
      case "schedule":
        return <Calendar className="h-4 w-4" />;
      default:
        return <GitBranch className="h-4 w-4" />;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getTriggerIcon(workflow.definition.trigger.triggerType)}
              <CardTitle className="text-lg">{workflow.name}</CardTitle>
            </div>
            {workflow.description && (
              <CardDescription className="text-sm">
                {workflow.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onExecute(workflow.id)}
                disabled={workflow.status !== "active"}
              >
                <Play className="h-4 w-4 mr-2" />
                Execute
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusToggle(workflow.id, workflow.status)}
              >
                {workflow.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <Link href={`/agents/create-flow?workflowId=${workflow.id}`}>
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                onClick={() => onDelete(workflow.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <StatusBadge status={workflow.status} />
            <span className="text-xs text-gray-500">
              v{workflow.version}
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            <div className="flex items-center gap-1 mb-1">
              <span className="font-medium">Trigger:</span>
              <span className="capitalize">
                {workflow.definition.trigger.triggerType}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Steps:</span>
              <span>{Object.keys(workflow.definition.steps).length}</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 border-t pt-2">
            <div>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</div>
            <div>Created: {new Date(workflow.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
