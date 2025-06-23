import { NodeCategory } from "@/utils/flow-types";
import { useMemo } from "react";

export function useNodeCategories() {
  const nodeCategories: NodeCategory[] = useMemo(
    () => [
      {
        title: "Triggers",
        nodes: [
          {
            type: "webhook-trigger",
            label: "Webhook",
            description: "Trigger workflow when webhook is called",
            icon: "🔗",
            color: "blue"
          },
          {
            type: "schedule",
            label: "Schedule",
            description: "Trigger workflow on a schedule",
            icon: "⏰",
            color: "blue"
          },
          {
            type: "manual",
            label: "Manual",
            description: "Manually trigger workflow",
            icon: "👆",
            color: "blue"
          }
        ]
      },
      {
        title: "Actions",
        nodes: [
          {
            type: "http",
            label: "HTTP Request",
            description: "Make HTTP requests to external APIs",
            icon: "🌐",
            color: "green"
          },
          {
            type: "transform",
            label: "Data Transform",
            description: "Transform data using JavaScript",
            icon: "🔄",
            color: "purple"
          },
          {
            type: "condition",
            label: "Condition",
            description: "Conditional branching logic",
            icon: "🔀",
            color: "amber"
          },
          {
            type: "delay",
            label: "Delay",
            description: "Wait for a specified time",
            icon: "⏱️",
            color: "amber"
          },
          {
            type: "log",
            label: "Log",
            description: "Log messages and data",
            icon: "📝",
            color: "green"
          }
        ]
      },
      {
        title: "Integrations",
        nodes: [
          {
            type: "whatsapp",
            label: "WhatsApp",
            description: "Send WhatsApp messages",
            icon: "💬",
            color: "green"
          },
          {
            type: "instagram",
            label: "Instagram",
            description: "Instagram integration",
            icon: "📷",
            color: "purple"
          },
          {
            type: "mercadolivreQa",
            label: "MercadoLivre Q&A",
            description: "MercadoLivre Q&A automation",
            icon: "🛒",
            color: "amber"
          }
        ]
      },
      {
        title: "Legacy",
        nodes: [
          {
            type: "character",
            label: "Character",
            description: "Define agent character (legacy)",
            icon: "🤖",
            color: "blue"
          },
          {
            type: "knowledge",
            label: "Knowledge",
            description: "Knowledge base integration (legacy)",
            icon: "📚",
            color: "purple"
          },
          {
            type: "testing",
            label: "Testing",
            description: "Test configuration (legacy)",
            icon: "🧪",
            color: "green"
          },
          {
            type: "deployment",
            label: "Deployment",
            description: "Deployment settings (legacy)",
            icon: "🚀",
            color: "amber"
          }
        ]
      }
    ],
    []
  );

  return { nodeCategories };
}
