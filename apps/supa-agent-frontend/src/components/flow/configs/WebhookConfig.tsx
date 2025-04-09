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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const webhookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL").min(1, "URL is required"),
  method: z.string().min(1, "Method is required"),
  payload: z.string().optional(),
  timeout: z.number().int().min(1).max(60).default(30),
  retryCount: z.number().int().min(0).max(5).default(3),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

export default function WebhookConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const data = node.data || {};
  const [headers, setHeaders] = useState<Record<string, string>>(
    (data.headers as Record<string, string>) || {}
  );
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");

  const defaultValues: WebhookFormValues = {
    name: (data.name as string) || "Webhook Integration",
    url: (data.url as string) || "",
    method: (data.method as string) || "POST",
    payload: (data.payload as string) || "",
    timeout: (data.timeout as number) || 30,
    retryCount: (data.retryCount as number) || 3,
  };

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues,
  });

  function addHeader() {
    if (headerKey.trim() && headerValue.trim()) {
      setHeaders({
        ...headers,
        [headerKey]: headerValue,
      });
      setHeaderKey("");
      setHeaderValue("");
    }
  }

  function removeHeader(key: string) {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    setHeaders(newHeaders);
  }

  function onSubmit(values: WebhookFormValues) {
    if (!node.id || !onUpdateNode) {
      console.log("Would update node with:", values);
      return;
    }

    onUpdateNode({
      ...node.data,
      ...values,
      headers,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Node Name</FormLabel>
              <FormControl>
                <Input placeholder="Webhook Integration" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Webhook URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://api.example.com/webhook"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HTTP Method</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select HTTP method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div>
            <FormLabel>HTTP Headers</FormLabel>
            <FormDescription className="text-xs">
              Add custom HTTP headers for the webhook request
            </FormDescription>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5"
                placeholder="Header name"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
              />
              <Input
                className="col-span-5"
                placeholder="Header value"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
              />
              <Button
                type="button"
                className="col-span-2"
                variant="outline"
                onClick={addHeader}
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(headers).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="px-2 py-1">
                  <span className="font-medium mr-1">{key}:</span>
                  <span className="opacity-75">{value}</span>
                  <button
                    type="button"
                    onClick={() => removeHeader(key)}
                    className="ml-1 opacity-70 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <FormField
          control={form.control}
          name="payload"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payload Template (JSON)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='{\n  "event": "{{event}}",\n  "data": {{data}}\n}'
                  className="font-mono min-h-24"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Use {`{variable}`} for dynamic values
              </FormDescription>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="timeout"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timeout (seconds)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="retryCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retry Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit">Save Configuration</Button>
      </form>
    </Form>
  );
}
