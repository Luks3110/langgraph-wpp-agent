import { Handle, Position } from "@xyflow/react";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export interface BaseNodeProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  children: ReactNode;
}

export default function BaseNode({
  title,
  description,
  icon: Icon,
  iconBgColor,
  iconColor,
  children,
}: BaseNodeProps) {
  return (
    <div className="bg-white p-4 rounded-lg border shadow-sm w-64 relative group">
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{
          background: "#4299e1",
          width: 16,
          height: 16,
          border: "2px solid white",
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{
          background: "#4299e1",
          width: 16,
          height: 16,
          border: "2px solid white",
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{
          background: "#4299e1",
          width: 16,
          height: 16,
          border: "2px solid white",
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{
          background: "#4299e1",
          width: 16,
          height: 16,
          border: "2px solid white",
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Node header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`${iconBgColor} p-1 rounded-full`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>

      {/* Node description */}
      <div className="text-xs text-gray-500 mb-2">{description}</div>

      {/* Node content - passed as children */}
      <div className="flex flex-col gap-1 text-xs">{children}</div>
    </div>
  );
}
