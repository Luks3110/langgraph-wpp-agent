import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a webhook URL for node integrations
 * @param nodeType The type of node (e.g., 'mercadolivreQa')
 * @param userId User ID associated with the webhook
 * @param workflowId Workflow ID for the webhook
 * @returns Formatted webhook URL
 */
export function generateWebhookUrl(nodeType: string, userId: string, workflowId: string) {
  return `${window.location.origin}/api/webhooks/${nodeType}/${userId}/${workflowId}`;
}
