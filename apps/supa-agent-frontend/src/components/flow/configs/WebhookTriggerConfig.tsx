"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "@/components/ui/use-toast";

const webhookTriggerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  webhookId: z.string().min(1, "Webhook ID is required"),
  description: z.string().optional(),
  secretKey: z.string().optional(),
});

type WebhookTriggerFormValues = z.infer<typeof webhookTriggerSchema>;

export default function WebhookTriggerConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const data = node.data || {};
  const [isGeneratingId, setIsGeneratingId] = useState(false);

  // Handle legacy webhook data conversion
  const isLegacyWebhook = Boolean(data.url && !data.webhookId);
  
  const defaultValues: WebhookTriggerFormValues = {
    name: (data.name as string) || (isLegacyWebhook ? "Webhook Integration" : "Webhook Trigger"),
    webhookId: (data.webhookId as string) || "",
    description: (data.description as string) || (isLegacyWebhook ? "Converted from legacy webhook" : ""),
    secretKey: (data.secretKey as string) || "",
  };

  const form = useForm<WebhookTriggerFormValues>({
    resolver: zodResolver(webhookTriggerSchema),
    defaultValues,
  });

  const watchedWebhookId = form.watch("webhookId");
  
  // Get the actual webhook URL from node data if it exists (after workflow is saved)
  const actualWebhookUrl = data.actualWebhookUrl as string;
  const previewWebhookUrl = `http://localhost:3005/webhooks/${watchedWebhookId}`;
  
  // Show actual URL if available, otherwise show preview
  const displayWebhookUrl = actualWebhookUrl || previewWebhookUrl;
  const isActualUrl = Boolean(actualWebhookUrl);

  function generateWebhookId() {
    setIsGeneratingId(true);
    // Generate a simple webhook ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const newId = `webhook-${timestamp}-${random}`;
    
    form.setValue("webhookId", newId);
    setTimeout(() => setIsGeneratingId(false), 500);
  }

  function copyWebhookUrl() {
    if (displayWebhookUrl) {
      navigator.clipboard.writeText(displayWebhookUrl);
      toast({
        title: "Copied!",
        description: `${isActualUrl ? 'Webhook URL' : 'Preview URL'} copied to clipboard`,
      });
    }
  }

  function onSubmit(values: WebhookTriggerFormValues) {
    if (!node.id || !onUpdateNode) {
      console.log("Would update node with:", values);
      return;
    }

    onUpdateNode({
      ...node.data,
      ...values,
      type: "webhook-trigger",
      category: "trigger",
      // Settings compatible with workflow engine
      settings: {
        webhookUrl: `/webhooks/${values.webhookId}`,
        secretKey: values.secretKey,
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {isLegacyWebhook && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Legacy Webhook Detected:</strong> This node has been converted to use the new webhook trigger format. 
              Please configure a webhook ID below to receive webhook calls.
            </p>
          </div>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trigger Name</FormLabel>
              <FormControl>
                <Input placeholder="Webhook Trigger" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what this webhook trigger does..."
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="webhookId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webhook ID</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Input
                    placeholder="webhook-id"
                    {...field}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateWebhookId}
                    disabled={isGeneratingId}
                  >
                    {isGeneratingId ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      "Generate"
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Unique identifier for this webhook endpoint
              </FormDescription>
            </FormItem>
          )}
        />

        {watchedWebhookId && (
          <div className="space-y-2">
            <FormLabel>
              {isActualUrl ? "Webhook URL" : "Preview URL"}
              {!isActualUrl && (
                <span className="text-xs text-orange-600 ml-2">
                  (Save workflow to get actual URL)
                </span>
              )}
            </FormLabel>
            <div className={`flex items-center gap-2 p-3 rounded-md ${
              isActualUrl ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
            }`}>
              <code className={`flex-1 text-sm font-mono ${
                isActualUrl ? 'text-green-700' : 'text-gray-700'
              }`}>
                {displayWebhookUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyWebhookUrl}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <FormDescription className="text-xs">
              {isActualUrl 
                ? "Send POST requests to this URL to trigger the workflow"
                : "This is a preview URL. Save the workflow to get the actual webhook URL."
              }
            </FormDescription>
          </div>
        )}

        <FormField
          control={form.control}
          name="secretKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secret Key (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="your-secret-key"
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional secret key for webhook authentication
              </FormDescription>
            </FormItem>
          )}
        />

        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900">
            Test Your Webhook
          </h4>
          <p className="text-xs text-blue-700">
            Use curl or any HTTP client to test your webhook:
          </p>
          <div className="bg-white p-3 rounded border">
            <code className="text-xs font-mono">
              curl -X POST {displayWebhookUrl} \<br />
              &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
              &nbsp;&nbsp;-d '{JSON.stringify({ event: "test", data: "hello" }, null, 2)}'
            </code>
          </div>
          {watchedWebhookId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(`http://localhost:3005/webhooks/${watchedWebhookId}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Webhook Info
            </Button>
          )}
        </div>

        <Button type="submit">Save Trigger Configuration</Button>
      </form>
    </Form>
  );
} 
