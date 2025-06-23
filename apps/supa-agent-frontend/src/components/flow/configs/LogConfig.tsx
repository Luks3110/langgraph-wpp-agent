"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const logSchema = z.object({
  name: z.string().min(1, "Name is required"),
  message: z.string().min(1, "Message is required"),
  level: z.enum(["debug", "info", "warn", "error"]),
});

type LogFormValues = z.infer<typeof logSchema>;

export default function LogConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const defaultValues: LogFormValues = {
    name: (node.data?.name as string) || "Log",
    message: (node.data?.message as string) || "{{trigger.output}}",
    level: (node.data?.level as "debug" | "info" | "warn" | "error") || "info",
  };

  const form = useForm<LogFormValues>({
    resolver: zodResolver(logSchema),
    defaultValues,
  });

  function onSubmit(values: LogFormValues) {
    if (!node.id || !onUpdateNode) {
      console.log("Would update node with:", values);
      return;
    }

    onUpdateNode({
      ...node.data,
      ...values,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Log Configuration</h3>
        <p className="text-sm text-gray-600">
          Configure what message to log and at what level.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Log Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter log name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Log Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter message to log (e.g., {{trigger.output}})"
                    className="min-h-24"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-xs text-gray-500 mt-2">
                  You can use expressions like:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li><code>{"{{trigger.webhook}}"}</code> - Webhook payload data</li>
                    <li><code>{"{{trigger.webhook.message}}"}</code> - Specific webhook field</li>
                    <li><code>{"{{stepName.output}}"}</code> - Output from previous steps</li>
                    <li><code>Hello {"{{"} trigger.webhook.user.name {"}}"}</code> - Mixed text + expressions</li>
                  </ul>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Log Level</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select log level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">Save Configuration</Button>
        </form>
      </Form>
    </div>
  );
} 
