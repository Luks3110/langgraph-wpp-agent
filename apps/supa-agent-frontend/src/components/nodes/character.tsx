import { Handle, Position } from "@xyflow/react";
import { Bot } from "lucide-react";

export default function CharacterNode({ data }: { data: any }) {
  console.log("🚀 ~ CharacterNode ~ data:", data)
  
    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm w-64 relative group">
            <Handle
                type="target"
        position={Position.Top}
        id="target-top"
        style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ background: '#4299e1', width: 16, height: 16, border: '2px solid white' }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-blue-100 p-1 rounded-full">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
        <h3 className="text-sm font-medium">Character Configuration</h3>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Define your agent's personality and character traits
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span>Name:</span>
          <span className="font-medium">{data.name || "Not set"}</span>
        </div>
        <div className="flex justify-between">
          <span>Personality:</span>
          <span className="font-medium">{data.personality || "Not set"}</span>
        </div>
      </div>
    </div>
  );
}
