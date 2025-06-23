import SubscriptionCheck from "@/components/subscription-check";
import { redirect } from "next/navigation";
import { createClient } from "../../../../supabase/server";
import WorkflowsClient from "./workflows-client";

export default async function WorkflowsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <SubscriptionCheck>
      <WorkflowsClient />
    </SubscriptionCheck>
  );
} 
