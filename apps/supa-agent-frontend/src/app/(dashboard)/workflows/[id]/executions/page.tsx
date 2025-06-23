import SubscriptionCheck from "@/components/subscription-check";
import { redirect } from "next/navigation";
import { createClient } from "../../../../../../supabase/server";
import WorkflowExecutionsClient from "./executions-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowExecutionsPage({ params }: PageProps) {
  const supabase = await createClient();
  const { id: workflowId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <SubscriptionCheck>
      <WorkflowExecutionsClient workflowId={workflowId} />
    </SubscriptionCheck>
  );
} 
