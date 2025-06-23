/**
 * Workflow Engine Node Components
 */

import { Handle, Position } from "@xyflow/react";
import BaseNode from "../../nodes/BaseNode";
import { 
  Clock, 
  Hand, 
  Globe, 
  RotateCw, 
  GitBranch, 
  Timer, 
  FileText,
  Webhook
} from "lucide-react";
import { 
  ScheduleNode, 
  ManualNode, 
  HttpNode, 
  TransformNode, 
  ConditionNode as ConditionNodeType, 
  DelayNode, 
  LogNode,
  WebhookTriggerNode as WebhookTriggerNodeType
} from "@/utils/flow-types";

// Webhook Trigger Node
export function WebhookTriggerNode({ data, selected }: { data: WebhookTriggerNodeType['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Webhook Trigger"}
      description={data.webhookId ? `ID: ${data.webhookId}` : "Configure webhook ID"}
      icon={Webhook}
      iconBgColor="bg-blue-100"
      iconColor="text-blue-600"
    >
      <Handle type="source" position={Position.Right} />
      <div className="text-xs text-gray-600 mt-1">
        {data.webhookId && (
          <div className="truncate">URL: /webhooks/{data.webhookId}</div>
        )}
        {data.description && (
          <div className="truncate">{data.description}</div>
        )}
      </div>
    </BaseNode>
  );
}

// Schedule Trigger Node
export function ScheduleTriggerNode({ data, selected }: { data: ScheduleNode['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Schedule Trigger"}
      description={`Cron: ${data.cronExpression}`}
      icon={Clock}
      iconBgColor="bg-blue-100"
      iconColor="text-blue-600"
    >
      <Handle type="source" position={Position.Right} />
      <div className="text-xs text-gray-600 mt-1">
        <div>Timezone: {data.timezone}</div>
        <div>Status: {data.enabled ? "Enabled" : "Disabled"}</div>
      </div>
    </BaseNode>
  );
}

// Manual Trigger Node
export function ManualTriggerNode({ data, selected }: { data: ManualNode['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Manual Trigger"}
      description={data.description || "Manually triggered"}
      icon={Hand}
      iconBgColor="bg-blue-100"
      iconColor="text-blue-600"
    >
      <Handle type="source" position={Position.Right} />
    </BaseNode>
  );
}

// HTTP Request Action Node
export function HttpRequestNode({ data, selected }: { data: HttpNode['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "HTTP Request"}
      description={`${data.method} ${data.url || "Not configured"}`}
      icon={Globe}
      iconBgColor="bg-green-100"
      iconColor="text-green-600"
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="text-xs text-gray-600 mt-1">
        <div>Timeout: {data.timeout}s</div>
      </div>
    </BaseNode>
  );
}

// Data Transform Action Node
export function DataTransformNode({ data, selected }: { data: TransformNode['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Data Transform"}
      description="Transform data with JavaScript"
      icon={RotateCw}
      iconBgColor="bg-purple-100"
      iconColor="text-purple-600"
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="text-xs text-gray-600 mt-1">
        <div>Input: {data.inputData}</div>
      </div>
    </BaseNode>
  );
}

// Condition Action Node
export function ConditionNode({ data, selected }: { data: ConditionNodeType['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Condition"}
      description="Conditional branching"
      icon={GitBranch}
      iconBgColor="bg-amber-100"
      iconColor="text-amber-600"
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} id="true" style={{ top: '40%' }} />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '60%' }} />
      <div className="text-xs text-gray-600 mt-1">
        <div>Condition: {data.condition}</div>
      </div>
    </BaseNode>
  );
}

// Delay Action Node
export function DelayActionNode({ data, selected }: { data: DelayNode['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Delay"}
      description={`Wait ${data.duration} ${data.unit}`}
      icon={Timer}
      iconBgColor="bg-amber-100"
      iconColor="text-amber-600"
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </BaseNode>
  );
}

// Log Action Node
export function LogActionNode({ data, selected }: { data: LogNode['data']; selected?: boolean }) {
  return (
    <BaseNode
      title={data.name || "Log"}
      description={`Log ${data.level} message`}
      icon={FileText}
      iconBgColor="bg-green-100"
      iconColor="text-green-600"
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="text-xs text-gray-600 mt-1">
        <div>Level: {data.level}</div>
      </div>
    </BaseNode>
  );
} 
