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
import { Textarea } from "@/components/ui/textarea";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const mercadoLivreQASchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  storeId: z.string().min(1, "Store ID is required"),
  promptTemplate: z.string().optional(),
});

type MercadoLivreQAFormValues = z.infer<typeof mercadoLivreQASchema>;

export default function MercadoLivreQAConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const defaultValues: MercadoLivreQAFormValues = {
    name: (node.data?.name as string) || "",
    category: (node.data?.category as string) || "",
    storeId: (node.data?.storeId as string) || "",
    promptTemplate: (node.data?.promptTemplate as string) || "",
  };

  const form = useForm<MercadoLivreQAFormValues>({
    resolver: zodResolver(mercadoLivreQASchema),
    defaultValues,
  });

  function onSubmit(values: MercadoLivreQAFormValues) {
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
                <Input placeholder="Mercado Livre Q&A Node" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="home">Home & Garden</SelectItem>
                  <SelectItem value="toys">Toys & Games</SelectItem>
                  <SelectItem value="sports">Sports & Outdoors</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="storeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter store ID" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="promptTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Prompt Template (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter a custom prompt template..."
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
