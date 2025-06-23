"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { WorkflowAPI, WorkflowAPIError } from "@/lib/workflow-api";
import { WorkflowExecution } from "@/types/workflow";
import { 
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

interface WorkflowExecutionsClientProps {
  workflowId: string;
}

export default function WorkflowExecutionsClient({ workflowId }: WorkflowExecutionsClientProps) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load executions on component mount
  useEffect(() => {
    if (workflowId) {
      loadExecutions();
    }
  }, [workflowId]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await WorkflowAPI.getWorkflowExecutions(workflowId);
      setExecutions(response.data);
    } catch (error) {
      console.error("Error loading executions:", error);
      if (error instanceof WorkflowAPIError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadExecutions();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "running":
        return <Badge variant="default" className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${Math.round(duration / 1000)}s`;
    } else {
      return `${Math.round(duration / 60000)}m`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/workflows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workflows
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Workflow Executions</h1>
          <p className="text-gray-600">Execution history for workflow {workflowId}</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {executions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Play className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No executions yet</h3>
            <p className="text-gray-600 text-center mb-4">
              This workflow hasn't been executed yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {executions.map((execution) => (
            <Card key={execution.execution_id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">Execution {execution.execution_id}</CardTitle>
                      {getStatusBadge(execution.status)}
                    </div>
                    <CardDescription>
                      Started: {execution.started_at ? formatDate(execution.started_at) : 'N/A'}
                      {execution.completed_at && (
                        <span> • Duration: {formatDuration(execution.started_at!, execution.completed_at)}</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Trigger Information */}
                  {execution.trigger_payload && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-1">Trigger Payload:</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(execution.trigger_payload, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* Error Information */}
                  {execution.status === "failed" && execution.error_message && (
                    <div>
                      <h4 className="font-medium text-sm text-red-700 mb-1">Error:</h4>
                      <div className="bg-red-50 p-2 rounded text-xs text-red-800">
                        {execution.error_message}
                      </div>
                    </div>
                  )}
                  
                  {/* Result Information */}
                  {execution.step_results && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-1">Step Results:</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(execution.step_results, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 
