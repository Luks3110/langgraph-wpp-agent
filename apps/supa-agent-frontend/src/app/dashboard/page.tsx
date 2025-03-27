import DashboardNavbar from "@/components/dashboard-navbar";
import AgentOverviewPanel from "@/components/dashboard/agent-overview-panel";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import PerformanceMetrics from "@/components/dashboard/performance-metrics";
import QuickActionPanel from "@/components/dashboard/quick-action-panel";
import RecentActivityFeed from "@/components/dashboard/recent-activity-feed";
import { SubscriptionCheck } from "@/components/subscription-check";
import { Button } from "@/components/ui/button";
import { Bot, Share2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <SubscriptionCheck>
      <DashboardNavbar />
      <main className="w-full bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col justify-between gap-3">
            <DashboardHeader user={user} />

            <div className="flex gap-4 justify-end">
              <div className="flex gap-3">
                <Link href="/dashboard/agents/create">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Bot className="h-4 w-4" /> Create Agent
                  </Button>
                </Link>
                <Link href="/dashboard/agents/create-flow">
                  <Button className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" /> Create with Flowchart
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Main content - 2/3 width on large screens */}
            <div className="lg:col-span-2 space-y-6">
              <AgentOverviewPanel />
              <PerformanceMetrics />
            </div>

            {/* Sidebar - 1/3 width on large screens */}
            <div className="space-y-6">
              <QuickActionPanel />
              <RecentActivityFeed />
            </div>
          </div>
        </div>
      </main>
    </SubscriptionCheck>
  );
}
