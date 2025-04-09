"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import InstagramConfig from "./configs/InstagramConfig";
import MercadoLivreQAConfig from "./configs/MercadoLivreQAConfig";
import WebhookConfig from "./configs/WebhookConfig";
import WhatsAppConfig from "./configs/WhatsAppConfig";

// Default schema for basic nodes
const defaultNodeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type DefaultNodeFormValues = z.infer<typeof defaultNodeSchema>;

// Interface for nodes that use the default config
interface DefaultNodeData {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

function DefaultNodeConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const data = node.data as DefaultNodeData;

  const defaultValues: DefaultNodeFormValues = {
    name: data.name || "",
    description: data.description || "",
  };

  const form = useForm<DefaultNodeFormValues>({
    resolver: zodResolver(defaultNodeSchema),
    defaultValues,
  });

  function onSubmit(values: DefaultNodeFormValues) {
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Node Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter node name" {...field} />
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
                  placeholder="Enter node description..."
                  className="min-h-24"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit">Save Configuration</Button>
      </form>
    </Form>
  );
}

export default function NodeConfigContent({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  if (!node) return null;

  // Get configComponentType from node data
  const configType = node.data?.configComponentType || node.type;

  switch (configType) {
    case "mercadolivreQa":
      return <MercadoLivreQAConfig node={node} onUpdateNode={onUpdateNode} />;
    case "whatsapp":
      return <WhatsAppConfig node={node} onUpdateNode={onUpdateNode} />;
    case "instagram":
      return <InstagramConfig node={node} onUpdateNode={onUpdateNode} />;
    case "webhook":
      return <WebhookConfig node={node} onUpdateNode={onUpdateNode} />;
    default:
      return <DefaultNodeConfig node={node} onUpdateNode={onUpdateNode} />;
  }
}
