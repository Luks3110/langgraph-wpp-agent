"use client";

import {
  DeploymentNode,
  InstagramNode,
  TestingNode,
  WebhookNode,
} from "@/utils/flow-types";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Bot } from "lucide-react";

export function TestingNodeComponent({ data }: NodeProps<TestingNode>) {
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
        <div className="bg-yellow-100 p-1 rounded-full">
          <Bot className="h-4 w-4 text-yellow-600" />
        </div>
        <h3 className="text-sm font-medium">Testing Configuration</h3>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Test your agent's responses and behavior
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span>Test Cases:</span>
          <span className="font-medium">{data.testCases || "Not set"}</span>
        </div>
        <div className="flex justify-between">
          <span>Status:</span>
          <span className="font-medium">{data.status || "Not tested"}</span>
        </div>
      </div>
    </div>
  );
}

export function DeploymentNodeComponent({ data }: NodeProps<DeploymentNode>) {
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
        <div className="bg-purple-100 p-1 rounded-full">
          <Bot className="h-4 w-4 text-purple-600" />
        </div>
        <h3 className="text-sm font-medium">Deployment Configuration</h3>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Configure deployment settings for your agent
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span>Environment:</span>
          <span className="font-medium">{data.environment || "Not set"}</span>
        </div>
        <div className="flex justify-between">
          <span>Status:</span>
          <span className="font-medium">{data.status || "Not deployed"}</span>
        </div>
      </div>
    </div>
  );
}

export function InstagramNodeComponent({ data }: NodeProps<InstagramNode>) {
  return (
    <div className="node instagram-node rounded-lg shadow-md px-4 py-3 border-2 bg-purple-50 border-purple-300">
      <div className="flex items-center">
        <div className="p-2 rounded-full bg-purple-100 mr-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-purple-600"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
          </svg>
        </div>
        <div>
          <div className="font-medium text-gray-800">
            {data.name || "Instagram"}
          </div>
          <div className="text-xs text-gray-500">
            {data.apiConfigured ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>
      <Handle
        id="instagram-input"
        type="target"
        position={Position.Left}
        className="w-3 h-3 rounded-full bg-purple-400 border-2 border-white"
      />
      <Handle
        id="instagram-output"
        type="source"
        position={Position.Right}
        className="w-3 h-3 rounded-full bg-purple-400 border-2 border-white"
      />
    </div>
  );
}

export function WebhookNodeComponent({ data }: NodeProps<WebhookNode>) {
  return (
    <div className="node webhook-node rounded-lg shadow-md px-4 py-3 border-2 bg-blue-50 border-blue-300">
      <div className="flex items-center">
        <div className="p-2 rounded-full bg-blue-100 mr-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-600"
          >
            <path d="m8 6 4-4 4 4"></path>
            <path d="M12 2v10.3"></path>
            <path d="M4 10c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-4.3"></path>
          </svg>
        </div>
        <div>
          <div className="font-medium text-gray-800">
            {data.name || "Webhook"}
          </div>
          <div className="text-xs text-gray-500">
            {data.method}{" "}
            {data.url ? data.url.substring(0, 15) + "..." : "Not configured"}
          </div>
        </div>
      </div>
      <Handle
        id="webhook-input"
        type="target"
        position={Position.Left}
        className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white"
      />
      <Handle
        id="webhook-output"
        type="source"
        position={Position.Right}
        className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white"
      />
    </div>
  );
}
