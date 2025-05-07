import { generateWebhookUrl } from "@/lib/utils";
import { MercadoLivreQANodeData } from "@/lib/workflowGraph";
import { Bot } from "lucide-react";
import { useMemo } from "react";
import BaseNode from "./BaseNode";
import NodeProperty from "./NodeProperty";

export interface IMercadoLivreQANode {
  type: "mercadolivreQa";
  data: MercadoLivreQANodeData;
  id: string;
  position: { x: number; y: number };
  workflowId?: string;
  userId?: string;
  responseDelay?: string;
  rulesCount?: number;
  defaultResponseSet?: boolean;
  apiConfigured?: boolean;
  webhookId?: string;
  webhookUrl?: string;
  [key: string]: unknown;
}

export default function MercadoLivreQANode({
  id,
  data,
}: {
  id: string;
  data: MercadoLivreQANodeData & IMercadoLivreQANode;
}) {
  const node = data as IMercadoLivreQANode;

  // Get the userId and workflowId from the node
  const nodeType = node.type || "mercadolivreQa";
  const userId = node.userId || "default-user";
  const workflowId = node.workflowId || "default-workflow";

  // Generate webhook URL using the utility function
  const webhookUrl = useMemo(
    () => data.webhookUrl || generateWebhookUrl(nodeType, userId, workflowId),
    [data.webhookUrl, nodeType, userId, workflowId]
  );

  const webhookActive = data.webhookId !== undefined;

  return (
    <BaseNode
      title="MercadoLivre Q&A"
      description="Automate responses to Mercado Livre customer questions"
      icon={Bot}
      iconBgColor="bg-orange-100"
      iconColor="text-orange-600"
    >
      <NodeProperty
        label="API Status"
        value={data.apiConfigured ? "Configured" : "Not Configured"}
        status={data.apiConfigured ? "success" : "error"}
      />
      <NodeProperty
        label="Response Rules"
        value={`${data.rulesCount || 0} rules`}
      />
      <NodeProperty
        label="Default Response"
        value={data.defaultResponseSet ? "Set" : "Not Set"}
        status={data.defaultResponseSet ? "success" : "warning"}
      />
      <NodeProperty
        label="Response Delay"
        value={data.responseDelay || "Immediate"}
      />
      <NodeProperty
        label="Webhook Status"
        value={webhookActive ? "Active" : "Not Configured"}
        status={webhookActive ? "success" : "warning"}
      />
    </BaseNode>
  );
}
