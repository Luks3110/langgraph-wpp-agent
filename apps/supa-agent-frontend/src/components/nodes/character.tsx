import { Bot } from "lucide-react";
import BaseNode from "./BaseNode";
import NodeProperty from "./NodeProperty";

export interface CharacterNodeData {
  name?: string;
  personality?: string;
  [key: string]: any;
}

export default function CharacterNode({ data }: { data: CharacterNodeData }) {
  return (
    <BaseNode
      title="Character Configuration"
      description="Define your agent's personality and character traits"
      icon={Bot}
      iconBgColor="bg-blue-100"
      iconColor="text-blue-600"
    >
      <NodeProperty label="Name" value={data.name} />
      <NodeProperty label="Personality" value={data.personality} />
    </BaseNode>
  );
}
