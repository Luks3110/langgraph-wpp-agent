import { MercadoLivreQANodeData } from "@/lib/workflowGraph";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Bot } from "lucide-react";

export interface IMercadoLivreQANode {
  type: 'mercadolivreQa';
  data: MercadoLivreQANodeData;
  id: string;
  position: { x: number; y: number };
  workflowId?: string;
  userId?: string;
  [key: string]: unknown;
}

const MercadoLivreQANode = ({ id, data }: NodeProps) => {
  const typedData = data as MercadoLivreQANodeData;
  const node = data as IMercadoLivreQANode;
  
  // Get the userId and workflowId from the node
  const nodeType = node.type || 'mercadolivreQa'; // Use actual node type instead of hardcoding
  const userId = node.userId || 'default-user';
  const workflowId = node.workflowId || 'default-workflow';
  
  // Generate webhook URL based on the required pattern
  const webhookUrl = typedData.webhookUrl || 
    `${window.location.origin}/api/webhooks/${nodeType}/${userId}/${workflowId}`;
  
  const webhookActive = typedData.webhookId !== undefined;

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
        <div className="bg-orange-100 p-1 rounded-full">
          <Bot className="h-4 w-4 text-orange-600" />
        </div>
        <h3 className="text-sm font-medium">MercadoLivre Q&A</h3>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Automate responses to Mercado Livre customer questions
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span>API Status:</span>
          <span className={`font-medium ${typedData.apiConfigured ? 'text-green-600' : 'text-red-600'}`}>
            {typedData.apiConfigured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Response Rules:</span>
          <span className="font-medium">{typedData.rulesCount || 0} rules</span>
        </div>
        <div className="flex justify-between">
          <span>Default Response:</span>
          <span className={`font-medium ${typedData.defaultResponseSet ? 'text-green-600' : 'text-yellow-600'}`}>
            {typedData.defaultResponseSet ? 'Set' : 'Not Set'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Response Delay:</span>
          <span className="font-medium">{typedData.responseDelay || 'Immediate'}</span>
        </div>
        <div className="flex justify-between">
          <span>Webhook Status:</span>
          <span className={`font-medium ${webhookActive ? 'text-green-600' : 'text-yellow-600'}`}>
            {webhookActive ? 'Active' : 'Not Configured'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MercadoLivreQANode;
