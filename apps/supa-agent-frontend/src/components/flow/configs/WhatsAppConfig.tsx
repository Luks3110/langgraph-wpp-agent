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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const whatsAppSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().optional(),
  templateId: z.string().optional(),
  webhookUrl: z.string().optional(),
  enableAutoReply: z.boolean().default(false),
  welcomeMessage: z.string().optional(),
});

type WhatsAppFormValues = z.infer<typeof whatsAppSchema>;

export default function WhatsAppConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const defaultValues: WhatsAppFormValues = {
    name: (node.data?.name as string) || "",
    phoneNumber: (node.data?.phoneNumber as string) || "",
    templateId: (node.data?.templateId as string) || "",
    webhookUrl: (node.data?.webhookUrl as string) || "",
    enableAutoReply: (node.data?.enableAutoReply as boolean) || false,
    welcomeMessage: (node.data?.welcomeMessage as string) || "",
  };

  const form = useForm<WhatsAppFormValues>({
    resolver: zodResolver(whatsAppSchema),
    defaultValues,
  });

  function onSubmit(values: WhatsAppFormValues) {
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
                <Input placeholder="WhatsApp Integration" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="+5511999999999" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message Template ID</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome Message</SelectItem>
                    <SelectItem value="product_inquiry">
                      Product Inquiry
                    </SelectItem>
                    <SelectItem value="order_confirmation">
                      Order Confirmation
                    </SelectItem>
                    <SelectItem value="shipping_update">
                      Shipping Update
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="webhookUrl"
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
        </div>

        <FormField
          control={form.control}
          name="enableAutoReply"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Enable Auto Reply</FormLabel>
                <div className="text-sm text-gray-500">
                  Automatically respond to incoming messages
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="welcomeMessage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Welcome Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter a welcome message for new conversations..."
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
