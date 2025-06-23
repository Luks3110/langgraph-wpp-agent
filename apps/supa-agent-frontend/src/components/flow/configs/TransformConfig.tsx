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
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const transformSchema = z.object({
  name: z.string().min(1, "Name is required"),
  inputData: z.string().min(1, "Input data is required"),
  transformScript: z.string().min(1, "Transform script is required"),
});

type TransformFormValues = z.infer<typeof transformSchema>;

export default function TransformConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const defaultValues: TransformFormValues = {
    name: (node.data?.name as string) || "Transform Data",
    inputData: (node.data?.inputData as string) || "{{trigger.output}}",
    transformScript: (node.data?.transformScript as string) || "return data;",
  };

  const form = useForm<TransformFormValues>({
    resolver: zodResolver(transformSchema),
    defaultValues,
  });

  function onSubmit(values: TransformFormValues) {
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
        <h3 className="text-lg font-medium">Transform Configuration</h3>
        <p className="text-sm text-gray-600">
          Configure data transformation logic using JavaScript.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transform Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter transform name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="inputData"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Input Data</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Data to transform (e.g., {{trigger.output}})"
                    className="min-h-20"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-xs text-gray-500 mt-2">
                  Specify the data source using expressions:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li><code>{"{{trigger.output}}"}</code> - Data from trigger</li>
                    <li><code>{"{{trigger.webhook}}"}</code> - Webhook payload</li>
                    <li><code>{"{{stepName.output}}"}</code> - Output from previous steps</li>
                  </ul>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="transformScript"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transform Script</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="JavaScript code to transform the data"
                    className="min-h-32 font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-xs text-gray-500 mt-2">
                  Write JavaScript code to transform the input data:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Access input data via the <code>data</code> variable</li>
                    <li>Return the transformed result</li>
                    <li>Example: <code>return {"{ message: data.text, timestamp: Date.now() }"}</code></li>
                    <li>Example: <code>{'return data.items.map(item => item.name)'}</code></li>
                  </ul>
                </div>
              </FormItem>
            )}
          />

          <Button type="submit">Save Configuration</Button>
        </form>
      </Form>
    </div>
  );
} 
