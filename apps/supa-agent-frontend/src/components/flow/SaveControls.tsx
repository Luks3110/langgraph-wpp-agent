"use client";

import { Button } from "@/components/ui/button";
import { useFlowContext } from "@/contexts/FlowContext";
import { Save } from "lucide-react";

export default function SaveControls() {
  const { saveWorkflow, isSaving } = useFlowContext();

  return (
    <div className="flex items-center">
      <Button onClick={saveWorkflow} disabled={isSaving} className="px-6">
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? "Saving..." : "Save Agent Configuration"}
      </Button>
    </div>
  );
}
