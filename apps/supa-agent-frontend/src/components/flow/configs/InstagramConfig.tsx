"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FlowNode } from "@/utils/flow-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const instagramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  apiConfigured: z.boolean().default(false),
  accessToken: z.string().optional(),
  igBusinessId: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  webhookSecret: z.string().optional(),
  messageEvents: z.array(z.string()).default([]),
  reactionEvents: z.boolean().default(false),
  postbackEvents: z.boolean().default(false),
  seenEvents: z.boolean().default(false),
  referralEvents: z.boolean().default(false),
});

type InstagramFormValues = z.infer<typeof instagramSchema>;

const messageEventOptions = [
  { id: "text", label: "Text Messages" },
  { id: "media", label: "Media (Images/Videos)" },
  { id: "share", label: "Shared Content" },
  { id: "story_mention", label: "Story Mentions" },
  { id: "story_reply", label: "Story Replies" },
  { id: "quick_reply", label: "Quick Replies" },
];

export default function InstagramConfig({
  node,
  onUpdateNode,
}: {
  node: FlowNode;
  onUpdateNode?: (data: Record<string, any>) => void;
}) {
  const data = node.data || {};

  const defaultValues: InstagramFormValues = {
    name: (data.name as string) || "Instagram Integration",
    apiConfigured: (data.apiConfigured as boolean) || false,
    accessToken: (data.accessToken as string) || "",
    igBusinessId: (data.igBusinessId as string) || "",
    webhookVerifyToken: (data.webhookVerifyToken as string) || "",
    webhookSecret: (data.webhookSecret as string) || "",
    messageEvents: (data.messageEvents as string[]) || [],
    reactionEvents: (data.reactionEvents as boolean) || false,
    postbackEvents: (data.postbackEvents as boolean) || false,
    seenEvents: (data.seenEvents as boolean) || false,
    referralEvents: (data.referralEvents as boolean) || false,
  };

  const form = useForm<InstagramFormValues>({
    resolver: zodResolver(instagramSchema),
    defaultValues,
  });

  function onSubmit(values: InstagramFormValues) {
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
                <Input placeholder="Instagram Integration" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="igBusinessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instagram Business ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Instagram Business ID" {...field} />
                </FormControl>
                <FormDescription className="text-xs">
                  The ID of your Instagram Professional account
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accessToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Access Token</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter access token"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Requires instagram_basic, instagram_manage_messages
                  permissions
                </FormDescription>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="webhookVerifyToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Webhook Verify Token</FormLabel>
                <FormControl>
                  <Input placeholder="Enter verify token" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="webhookSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Webhook Secret</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter webhook secret"
                    type="password"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="apiConfigured"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">API Configured</FormLabel>
                <div className="text-sm text-gray-500">
                  Mark as configured when your Instagram API is set up
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

        <div className="space-y-4">
          <FormLabel>Event Subscriptions</FormLabel>
          <div className="border rounded-md p-4 space-y-4">
            <FormField
              control={form.control}
              name="messageEvents"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel>Message Events</FormLabel>
                    <FormDescription className="text-xs">
                      Subscribe to different types of messages
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {messageEventOptions.map((option) => (
                      <FormField
                        key={option.id}
                        control={form.control}
                        name="messageEvents"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={option.id}
                              className="flex flex-row items-start space-x-2"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(option.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([
                                          ...field.value,
                                          option.id,
                                        ])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== option.id
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-xs font-normal">
                                {option.label}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="reactionEvents"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-xs font-normal">
                      Message Reactions
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postbackEvents"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-xs font-normal">
                      Postback Events
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seenEvents"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-xs font-normal">
                      Seen Events
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralEvents"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-xs font-normal">
                      Referral Events
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Button type="submit">Save Configuration</Button>
      </form>
    </Form>
  );
}
