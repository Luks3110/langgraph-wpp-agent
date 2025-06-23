import SubscriptionCheck from "@/components/subscription-check";
import { redirect } from "next/navigation";
import { createClient } from "../../../../../supabase/server";
import AgentFlowEditor from "@/components/flow/AgentFlowEditor";
import { WorkflowAPI } from "@/lib/workflow-api";
import { WorkflowConverter } from "@/lib/workflow-converter";
import "@xyflow/react/dist/style.css";

interface PageProps {
  searchParams: Promise<{ workflowId?: string }>;
}

export default async function CreateAgentFlowPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { workflowId } = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get the user's session for API authentication
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token;

  // Fetch workflow data on the server if workflowId is provided
  let initialWorkflowData = null;
  if (workflowId) {
    try {
      console.log("Server: Loading workflow", workflowId);
      const workflow = await WorkflowAPI.getWorkflow(workflowId, authToken);
      console.log("Server: Loaded workflow", workflow);
      
      // Convert workflow to flow format on the server
      initialWorkflowData = WorkflowConverter.convertWorkflowToFlow(workflow);
      console.log("Server: Converted to flow format", initialWorkflowData);
    } catch (error) {
      console.error("Server: Error loading workflow:", error);
      // Don't redirect, just show empty editor with error state
    }
  }

  return (
    <SubscriptionCheck>
      <AgentFlowEditor 
        initialWorkflowData={initialWorkflowData}
        workflowId={workflowId || null}
      />
    </SubscriptionCheck>
  );
}
