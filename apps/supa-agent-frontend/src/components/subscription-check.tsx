import { redirect } from "next/navigation";
import { createClient } from "../../supabase/server";

interface SubscriptionCheckProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default async function SubscriptionCheck({ 
  children, 
  redirectTo = "/pricing" 
}: SubscriptionCheckProps) {
  const supabase = await createClient();
  
  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log("No authenticated user, redirecting to sign-in");
    redirect("/sign-in");
  }

  // Check subscription status using service role to bypass RLS
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (subError && subError.code !== 'PGRST116') {
    console.error("Error checking subscription:", subError);
  }

  // If no active subscription, redirect to pricing
  if (!subscription) {
    console.log("No active subscription found, redirecting to pricing");
    redirect(redirectTo);
  }

  // Check if subscription is expired
  if (subscription.current_period_end && subscription.current_period_end < Math.floor(Date.now() / 1000)) {
    console.log("Subscription expired, redirecting to pricing");
    redirect(redirectTo);
  }

  return <>{children}</>;
}
