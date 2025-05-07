import { Bot } from "lucide-react";
import BaseNode from "./BaseNode";
import NodeProperty from "./NodeProperty";

export interface KnowledgeNodeData {
  domain?: string;
  sources?: string;
  [key: string]: any;
}

export default function KnowledgeNode({ data }: { data: KnowledgeNodeData }) {
  return (
    <BaseNode
      title="Knowledge Configuration"
      description="Define your agent's knowledge domain and expertise"
      icon={Bot}
      iconBgColor="bg-green-100"
      iconColor="text-green-600"
    >
      <NodeProperty label="Domain" value={data.domain} />
      <NodeProperty label="Sources" value={data.sources} />
    </BaseNode>
  );
}
