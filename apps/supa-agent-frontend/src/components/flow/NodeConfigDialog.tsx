"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NodeConfigContent from "./NodeConfigContent";

export default function NodeConfigDialog({
  open,
  onOpenChange,
  selectedNode,
  nodeConfigTitle,
  nodeConfigDescription,
  onUpdateNode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: any;
  nodeConfigTitle: string;
  nodeConfigDescription: string;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full min-h-[30rem] max-h-[30rem] overflow-y-auto p-0">
        {selectedNode && (
          <div className="flex flex-col h-full gap-5">
            <DialogHeader className="px-6 pt-6 flex-shrink-0">
              <DialogTitle>{nodeConfigTitle}</DialogTitle>
              <DialogDescription>{nodeConfigDescription}</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6 flex-1">
              <NodeConfigContent
                node={selectedNode}
                onUpdateNode={onUpdateNode}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
