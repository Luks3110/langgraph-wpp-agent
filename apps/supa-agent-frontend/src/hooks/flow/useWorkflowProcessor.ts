import { WorkflowConverter } from "@/lib/workflow-converter";
import { WorkflowAPI, WorkflowAPIError } from "@/lib/workflow-api";
import { FlowWorkflow } from "@/types/workflow";
import { useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { createWorkflowAction, updateWorkflowAction } from "@/app/actions";

export function useWorkflowProcessor() {
  // Process workflow for saving
  const processWorkflow = useCallback(
    (nodes: any[], edges: any[]): FlowWorkflow => {
      // Convert the old flow format to the new format
      const flowWorkflow: FlowWorkflow = {
        name: "New Workflow",
        description: "Created via flow editor",
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type || "unknown",
          position: node.position || { x: 0, y: 0 },
          data: node.data || {}
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type,
          animated: edge.animated
        })),
        version: 1
      };

      return flowWorkflow;
    },
    []
  );

  // Save workflow using server actions for proper authentication
  const saveWorkflow = useCallback(
    async (
      workflow: FlowWorkflow,
      onWorkflowSaved?: (savedWorkflow: any) => void
    ): Promise<void> => {
      try {
        // Validate the workflow before saving
        const validation = WorkflowConverter.validateFlow(workflow);
        if (!validation.valid) {
          toast({
            title: "Validation Error",
            description: validation.errors.join(", "),
            variant: "destructive"
          });
          throw new Error(
            `Workflow validation failed: ${validation.errors.join(", ")}`
          );
        }

        // Convert flow to workflow engine format
        const workflowPayload =
          WorkflowConverter.convertFlowToWorkflow(workflow);

        console.log(
          "Workflow payload being sent:",
          JSON.stringify(workflowPayload, null, 2)
        );

        let result;

        // Check if this is an update (workflow has an ID) or a new workflow
        if (workflow.id) {
          // Update existing workflow using server action
          console.log("Updating existing workflow:", workflow.id);
          result = await updateWorkflowAction(workflow.id, {
            name: workflowPayload.name,
            description: workflowPayload.description,
            definition: workflowPayload.definition
          });

          if (!result.success || !result.workflow) {
            throw new Error(result.error || "Failed to update workflow");
          }

          toast({
            title: "Success",
            description: `Workflow "${result.workflow.name}" updated successfully`
          });
        } else {
          // Create new workflow using server action
          console.log("Creating new workflow");
          result = await createWorkflowAction(workflowPayload);

          if (!result.success || !result.workflow) {
            throw new Error(result.error || "Failed to create workflow");
          }

          toast({
            title: "Success",
            description: `Workflow "${result.workflow.name}" created successfully`
          });
        }

        console.log("Workflow saved:", result.workflow);

        // Call the callback with the saved workflow data
        if (onWorkflowSaved && result.workflow) {
          onWorkflowSaved(result.workflow);
        }
      } catch (error) {
        console.error("Error saving workflow:", error);

        toast({
          title: "Save Error",
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive"
        });

        throw error;
      }
    },
    []
  );

  // Load workflow from the workflow engine API
  const loadWorkflow = useCallback(
    async (workflowId: string): Promise<FlowWorkflow> => {
      try {
        const workflow = await WorkflowAPI.getWorkflow(workflowId);
        return WorkflowConverter.convertWorkflowToFlow(workflow);
      } catch (error) {
        console.error("Error loading workflow:", error);

        if (error instanceof WorkflowAPIError) {
          toast({
            title: "Load Error",
            description: error.message,
            variant: "destructive"
          });
        }

        throw error;
      }
    },
    []
  );

  // Execute workflow
  const executeWorkflow = useCallback(
    async (workflowId: string, triggerPayload: any = {}): Promise<void> => {
      try {
        const execution = await WorkflowAPI.executeWorkflow(
          workflowId,
          triggerPayload
        );

        toast({
          title: "Execution Started",
          description: `Workflow execution ${execution.execution_id} started`
        });

        console.log("Workflow execution started:", execution);
      } catch (error) {
        console.error("Error executing workflow:", error);

        if (error instanceof WorkflowAPIError) {
          toast({
            title: "Execution Error",
            description: error.message,
            variant: "destructive"
          });
        }

        throw error;
      }
    },
    []
  );

  return {
    processWorkflow,
    saveWorkflow,
    loadWorkflow,
    executeWorkflow
  };
}
