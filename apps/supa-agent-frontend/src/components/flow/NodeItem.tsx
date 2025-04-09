"use client";

import { NodeCategoryItem } from "@/utils/flow-types";
import {
  Bot,
  Clock,
  Database,
  Filter,
  GitMerge,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";

interface NodeItemProps {
  node: NodeCategoryItem;
  onAdd: () => void;
}

export default function NodeItem({ node, onAdd }: NodeItemProps) {
  // Dynamically determine the icon based on the node's icon property
  let IconComponent;
  switch (node.icon) {
    case "code":
      IconComponent = <code>{"</>"}</code>;
      break;
    case "messageSquare":
      IconComponent = <MessageSquare className="h-4 w-4" />;
      break;
    case "clock":
      IconComponent = <Clock className="h-4 w-4" />;
      break;
    case "gitMerge":
      IconComponent = <GitMerge className="h-4 w-4" />;
      break;
    case "filter":
      IconComponent = <Filter className="h-4 w-4" />;
      break;
    case "database":
      IconComponent = <Database className="h-4 w-4" />;
      break;
    case "sparkles":
      IconComponent = <Sparkles className="h-4 w-4" />;
      break;
    case "send":
      IconComponent = <Send className="h-4 w-4" />;
      break;
    default:
      IconComponent = <Bot className="h-4 w-4" />;
  }

  // Determine background and text colors based on the node's color property
  const bgColorClass =
    {
      blue: "bg-blue-100",
      purple: "bg-purple-100",
      green: "bg-green-100",
      amber: "bg-amber-100",
    }[node.color] || "bg-gray-100";

  const textColorClass =
    {
      blue: "text-blue-600",
      purple: "text-purple-600",
      green: "text-green-600",
      amber: "text-amber-600",
    }[node.color] || "text-gray-600";

  return (
    <div
      className="bg-white p-3 rounded-md border hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all"
      onClick={onAdd}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`${bgColorClass} p-1 rounded-full`}>
          <div className={textColorClass}>{IconComponent}</div>
        </div>
        <h3 className="text-sm font-medium">{node.label}</h3>
      </div>
      <div className="text-xs text-gray-500">{node.description}</div>
    </div>
  );
}
