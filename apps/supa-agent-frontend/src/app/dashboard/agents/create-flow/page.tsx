"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import AgentFlowEditor from "@/components/flow/AgentFlowEditor";
import "@xyflow/react/dist/style.css";

export default function CreateAgentFlowPage() {
  return (
    <>
      <DashboardNavbar />
      <AgentFlowEditor />
    </>
  );
}
