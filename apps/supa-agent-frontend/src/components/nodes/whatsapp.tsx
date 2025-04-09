import { generateWebhookUrl } from "@/lib/utils";
import { WhatsAppNodeData } from "@/lib/workflowGraph";
import { Handle, Node, NodeProps, Position } from "@xyflow/react";
import { MessageSquareMore } from "lucide-react";
import { useMemo } from "react";

export interface IWhatsAppNode {
  type: "whatsapp";
  data: WhatsAppNodeData;
  id: string;
  position: { x: number; y: number };
  workflowId?: string;
  userId?: string;
  messageTemplatesCount?: number;
  webhookId?: string;
  webhookUrl?: string;
  apiConfigured?: boolean;
  phoneNumberConfigured?: boolean;
  autoReplyEnabled?: boolean;
  responseDelay?: string;
  accessToken?: string;
  phoneNumberId?: string;
  appSecret?: string;
  [key: string]: unknown;
}

type WhatsAppNodeProps = NodeProps<Node<IWhatsAppNode>>;

const WhatsAppNode = ({ id, data }: WhatsAppNodeProps) => {
  const node = data as IWhatsAppNode;

  // Get the userId and workflowId from the node
  const nodeType = node.type || "whatsapp";
  const userId = node.userId || "default-user";
  const workflowId = node.workflowId || "default-workflow";

  // Generate webhook URL using the utility function
  const webhookUrl = useMemo(
    () => data.webhookUrl || generateWebhookUrl(nodeType, userId, workflowId),
    [data.webhookUrl, nodeType, userId, workflowId]
  );

  const webhookActive = data.webhookId !== undefined;

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
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-green-100 p-1 rounded-full">
          <MessageSquareMore className="h-4 w-4 text-green-600" />
        </div>
        <h3 className="text-sm font-medium">WhatsApp Integration</h3>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Automate conversations via WhatsApp Business API
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span>API Status:</span>
          <span
            className={`font-medium ${
              data.apiConfigured ? "text-green-600" : "text-red-600"
            }`}
          >
            {data.apiConfigured ? "Configured" : "Not Configured"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Phone Number:</span>
          <span
            className={`font-medium ${
              data.phoneNumberConfigured ? "text-green-600" : "text-red-600"
            }`}
          >
            {data.phoneNumberConfigured ? "Configured" : "Not Configured"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Templates:</span>
          <span className="font-medium">
            {data.messageTemplatesCount || 0} templates
          </span>
        </div>
        <div className="flex justify-between">
          <span>Auto-Reply:</span>
          <span
            className={`font-medium ${
              data.autoReplyEnabled ? "text-green-600" : "text-gray-600"
            }`}
          >
            {data.autoReplyEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Webhook Status:</span>
          <span
            className={`font-medium ${
              webhookActive ? "text-green-600" : "text-yellow-600"
            }`}
          >
            {webhookActive ? "Active" : "Not Configured"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppNode;
