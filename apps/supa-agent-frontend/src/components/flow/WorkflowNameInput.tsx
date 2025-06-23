"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit3, FileText } from "lucide-react";
import { useState } from "react";

interface WorkflowNameInputProps {
  workflowName: string;
  workflowDescription?: string;
  onUpdateWorkflow: (name: string, description?: string) => void;
  isEditing?: boolean;
}

export default function WorkflowNameInput({
  workflowName,
  workflowDescription,
  onUpdateWorkflow,
  isEditing = false,
}: WorkflowNameInputProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workflowName);
  const [description, setDescription] = useState(workflowDescription || "");

  const handleSave = () => {
    if (name.trim()) {
      onUpdateWorkflow(name.trim(), description.trim() || undefined);
      setOpen(false);
    }
  };

  const handleCancel = () => {
    setName(workflowName);
    setDescription(workflowDescription || "");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-md p-2 transition-colors">
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {workflowName || "Untitled Workflow"}
            </h1>
            {workflowDescription && (
              <p className="text-sm text-gray-600 truncate">
                {workflowDescription}
              </p>
            )}
          </div>
          <Edit3 className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </div>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Workflow Details" : "Name Your Workflow"}
          </DialogTitle>
          <DialogDescription>
            Give your workflow a descriptive name and optional description.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Workflow Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter workflow name..."
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              className="w-full min-h-20"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {isEditing ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
