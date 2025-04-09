import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateWebhookUrl } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IWhatsAppNode } from "../whatsapp";

interface WhatsAppConfigProps {
  node: IWhatsAppNode;
  updateNode: (data: Partial<IWhatsAppNode["data"]>) => void;
}

export default function WhatsAppConfig({
  node,
  updateNode,
}: WhatsAppConfigProps) {
  const [activeTab, setActiveTab] = useState<
    "api" | "webhook" | "templates" | "autoreply" | "advanced"
  >("api");

  const webhookUrl = useMemo(() => {
    const nodeType = node.type;
    const userId = node.userId || "default-user";
    const workflowId = node.workflowId || `workflow-${Date.now()}`;
    return generateWebhookUrl(nodeType, userId, workflowId);
  }, [node]);

  const [webhookData, setWebhookData] = useState({
    provider: node.data.provider || "whatsapp",
    webhookId: node.data.webhookId || "",
    webhookUrl: node.data.webhookUrl || webhookUrl,
    validateSignature: node.data.validateSignature || false,
    signatureHeader: node.data.signatureHeader || "x-hub-signature",
    secretKey: node.data.secretKey || "",
  });

  // Update webhook data in node
  useEffect(() => {
    updateNode(webhookData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhookData]);

  const updateWebhookData = (data: Partial<typeof webhookData>) => {
    setWebhookData((prevData) => ({ ...prevData, ...data }));
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    // Could add toast notification here
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">
        WhatsApp Integration Configuration
      </h2>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
      >
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="autoreply">Auto-Reply</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">WhatsApp Access Token</label>
            <input
              type="password"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="Enter your WhatsApp access token"
              value={node.data.accessToken || ""}
              onChange={(e) => updateNode({ accessToken: e.target.value })}
            />
            <p className="text-xs text-gray-500">
              Your Facebook WhatsApp API access token
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number ID</label>
            <p className="text-xs text-gray-500 mb-2">
              As an app provider, you'll use your own phone number ID for all
              your clients
            </p>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="Enter WhatsApp phone number ID"
              value={node.data.phoneNumberId || ""}
              onChange={(e) =>
                updateNode({
                  phoneNumberId: e.target.value,
                  phoneNumberConfigured: e.target.value !== "",
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">WhatsApp App Secret</label>
            <input
              type="password"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="Enter your WhatsApp app secret"
              value={node.data.appSecret || ""}
              onChange={(e) => updateNode({ appSecret: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook Verify Token</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="Enter webhook verification token"
              value={node.data.webhookVerifyToken || ""}
              onChange={(e) =>
                updateNode({ webhookVerifyToken: e.target.value })
              }
            />
          </div>

          <Button
            className="w-full"
            onClick={() =>
              updateNode({
                apiConfigured: true,
                phoneNumberConfigured: !!node.data.phoneNumberId,
              })
            }
          >
            Verify Configuration
          </Button>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex">
              <input
                type="text"
                className="flex-1 px-3 py-2 border rounded-l-md text-sm bg-gray-50"
                value={webhookUrl}
                readOnly
              />
              <Button
                variant="outline"
                className="rounded-l-none border-l-0"
                onClick={handleCopyWebhookUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Configure this URL in your WhatsApp Business API settings
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook ID</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="Enter webhook ID once configured"
              value={webhookData.webhookId}
              onChange={(e) => updateWebhookData({ webhookId: e.target.value })}
            />
            <p className="text-xs text-gray-500">
              Enter your webhook ID after configuring in WhatsApp
            </p>
          </div>

          <div className="flex items-center space-x-2 mb-2">
            <input
              type="checkbox"
              id="validate-signature"
              checked={webhookData.validateSignature}
              onChange={(e) =>
                updateWebhookData({ validateSignature: e.target.checked })
              }
            />
            <label htmlFor="validate-signature" className="text-sm">
              Validate webhook signatures
            </label>
          </div>

          {webhookData.validateSignature && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Signature Header Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="e.g. x-hub-signature"
                  value={webhookData.signatureHeader}
                  onChange={(e) =>
                    updateWebhookData({ signatureHeader: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Secret Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="Enter your webhook secret key"
                  value={webhookData.secretKey}
                  onChange={(e) =>
                    updateWebhookData({ secretKey: e.target.value })
                  }
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Message Templates</label>
            <p className="text-xs text-gray-500 mb-2">
              Configure approved WhatsApp message templates
            </p>

            <div className="border rounded-md p-4">
              <p className="text-sm text-center text-gray-500">
                No templates configured yet
              </p>
              <Button variant="outline" className="w-full mt-4">
                Add Template
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="autoreply" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id="enable-autoreply"
              checked={node.data.autoReplyEnabled || false}
              onChange={(e) =>
                updateNode({ autoReplyEnabled: e.target.checked })
              }
            />
            <label htmlFor="enable-autoreply" className="text-sm font-medium">
              Enable automatic replies
            </label>
          </div>

          {node.data.autoReplyEnabled && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Auto-Reply Message
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={4}
                  placeholder="Enter your automatic reply message..."
                  value={node.data.autoReplyMessage || ""}
                  onChange={(e) =>
                    updateNode({ autoReplyMessage: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Keywords to Trigger Auto-Reply
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="hello, info, help (comma separated)"
                  value={node.data.autoReplyKeywords || ""}
                  onChange={(e) =>
                    updateNode({ autoReplyKeywords: e.target.value })
                  }
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Response Delay</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={node.data.responseDelay}
              onChange={(e) => updateNode({ responseDelay: e.target.value })}
            >
              <option value="Immediate">Immediate</option>
              <option value="30 seconds">30 seconds</option>
              <option value="1 minute">1 minute</option>
              <option value="5 minutes">5 minutes</option>
              <option value="Random (1-5 min)">Random (1-5 min)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Working Hours</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs">Start Time</label>
                <input
                  type="time"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value="09:00"
                />
              </div>
              <div>
                <label className="text-xs">End Time</label>
                <input
                  type="time"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value="18:00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message Processing</label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enable-agent"
                checked={node.data.agentEnabled || false}
                onChange={(e) => updateNode({ agentEnabled: e.target.checked })}
              />
              <label htmlFor="enable-agent" className="text-sm">
                Process messages with LLM agent
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
