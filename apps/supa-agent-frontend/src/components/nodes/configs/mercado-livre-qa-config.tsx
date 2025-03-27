import { Button } from "@/components/ui/button";
import { Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { IMercadoLivreQANode } from "../mercado-livre-qa";

interface MercadoLivreQAConfigProps {
    node: IMercadoLivreQANode;
    updateNode: (data: Partial<IMercadoLivreQANode['data']>) => void;
  }

export default function MercadoLivreQAConfig({ node, updateNode }: MercadoLivreQAConfigProps) {
    const [activeTab, setActiveTab] = useState('authentication');
    const [rules, setRules] = useState<Array<{ id: string; condition: string; response: string; priority: number }>>([]);
    
    // Generate the webhook URL using the specified format
    const generateWebhookUrl = () => {
      const nodeType = node.type;
      const userId = node.userId || 'default-user';
      const workflowId = node.data.workflowId || `workflow-${Date.now()}`;
      return `${window.location.origin}/api/webhooks/${nodeType}/${userId}/${workflowId}`;
    };
    
    const [webhookData, setWebhookData] = useState({
      provider: node.data.provider || 'mercadolivre',
      webhookId: node.data.webhookId || '',
      webhookUrl: node.data.webhookUrl || generateWebhookUrl(),
      validateSignature: node.data.validateSignature || false,
      signatureHeader: node.data.signatureHeader || 'x-signature',
      secretKey: node.data.secretKey || ''
    });
    
    // Update rules count when rules change, but omit updateNode from dependencies
    useEffect(() => {
      updateNode({ rulesCount: rules.length });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rules]);
    
    // Initialize rules from node data on mount
    useEffect(() => {
      // Only set rules if they haven't been initialized and node has rulesCount > 0
      if (rules.length === 0 && node.data.rulesCount > 0) {
        const initialRules = Array.from({ length: node.data.rulesCount }, (_, idx) => ({
          id: `rule-${idx + 1}`,
          condition: '',
          response: '',
          priority: idx + 1
        }));
        setRules(initialRules);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    // Update webhook data in node
    useEffect(() => {
      updateNode(webhookData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webhookData]);

    const updateWebhookData = (data: Partial<typeof webhookData>) => {
      setWebhookData(prevData => ({ ...prevData, ...data }));
    };

    const handleCopyWebhookUrl = () => {
      navigator.clipboard.writeText(generateWebhookUrl());
      // Could add toast notification here
    };

    const addRule = () => {
      const newRule = {
        id: `rule-${Date.now()}`, // Use timestamp for more reliable unique IDs
        condition: '',
        response: '',
        priority: rules.length + 1
      };
      setRules([...rules, newRule]);
    };
  
    const removeRule = (id: string) => {
      setRules(rules.filter(rule => rule.id !== id));
    };
  
    const updateRule = (id: string, data: Partial<typeof rules[0]>) => {
      setRules(rules.map(rule => rule.id === id ? { ...rule, ...data } : rule));
    };

    return (
      <div className="space-y-6 max-h-[60vh] overflow-y-auto py-2">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'authentication' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('authentication')}
          >
            Authentication
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'webhook' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('webhook')}
          >
            Webhook
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'rules' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('rules')}
          >
            Response Rules
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'default' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('default')}
          >
            Default Response
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'advanced' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>
  
        {activeTab === 'authentication' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">API Client ID</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="Enter your Mercado Livre API Client ID"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">API Client Secret</label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="Enter your API Client Secret"
              />
            </div>
  
            <div className="pt-2">
              <Button onClick={() => updateNode({ apiConfigured: true })}>
                Connect to Mercado Livre
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'webhook' && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-md border text-xs">
              <p className="font-medium mb-2">Webhook URL</p>
              <div className="flex items-center">
                <code className="bg-gray-100 p-1 rounded flex-1 overflow-x-auto">
                  {generateWebhookUrl()}
                </code>
                <Button size="sm" variant="ghost" className="ml-2 h-6" onClick={handleCopyWebhookUrl}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Configure this URL in your Mercado Livre developer settings</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Webhook ID</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="Enter your Mercado Livre webhook ID"
                value={webhookData.webhookId}
                onChange={(e) => updateWebhookData({ webhookId: e.target.value })}
              />
              <p className="text-xs text-gray-500">This is provided by Mercado Livre after webhook registration</p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="validate-signature" 
                className="rounded"
                checked={webhookData.validateSignature}
                onChange={(e) => updateWebhookData({ validateSignature: e.target.checked })}
              />
              <label htmlFor="validate-signature" className="text-sm">Validate webhook signature</label>
            </div>

            {webhookData.validateSignature && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Signature Header Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="e.g. x-signature"
                    value={webhookData.signatureHeader}
                    onChange={(e) => updateWebhookData({ signatureHeader: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Key</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="Enter your webhook secret key"
                    value={webhookData.secretKey}
                    onChange={(e) => updateWebhookData({ secretKey: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Transformation Template</label>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                rows={4}
                placeholder="// JSON template to transform webhook payload..."
                value={node.data.transformationTemplate || ''}
                onChange={(e) => updateNode({ transformationTemplate: e.target.value })}
              />
              <p className="text-xs text-gray-500">Template to transform webhook payload into a standardized format</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Response Template</label>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                rows={4}
                placeholder="// JSON template for webhook response..."
                value={node.data.responseTemplate || ''}
                onChange={(e) => updateNode({ responseTemplate: e.target.value })}
              />
              <p className="text-xs text-gray-500">Template for webhook response structure</p>
            </div>
          </div>
        )}
  
        {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Response Rules ({rules.length})</h3>
              <Button size="sm" onClick={addRule}>
                <Plus className="h-3 w-3 mr-1" /> Add Rule
              </Button>
            </div>
  
            {rules.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-md border border-dashed">
                <p className="text-sm text-gray-500">No rules configured yet.</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Rule" to create your first automated response rule.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div key={rule.id} className="bg-gray-50 p-3 rounded-md border">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Rule #{index + 1}</h4>
                      <Button size="sm" variant="ghost" className="h-6 text-red-600 hover:text-red-700" onClick={() => removeRule(rule.id)}>
                        Remove
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Condition</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1 border rounded-md text-xs"
                          placeholder="e.g. Question contains 'shipping'"
                          value={rule.condition}
                          onChange={(e) => updateRule(rule.id, { condition: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Response Template</label>
                        <textarea
                          className="w-full px-2 py-1 border rounded-md text-xs"
                          rows={3}
                          placeholder="Enter your automated response..."
                          value={rule.response}
                          onChange={(e) => updateRule(rule.id, { response: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Priority (lower = higher priority)</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full px-2 py-1 border rounded-md text-xs"
                          value={rule.priority}
                          onChange={(e) => updateRule(rule.id, { priority: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
  
        {activeTab === 'default' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Response</label>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm"
                rows={5}
                placeholder="Enter a default response for questions that don't match any rules..."
                onChange={(e) => updateNode({ defaultResponseSet: e.target.value.trim().length > 0 })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Response Tone</label>
              <select className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="formal">Formal</option>
                <option value="informal">Informal</option>
                <option value="friendly">Friendly</option>
                <option value="technical">Technical</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <input type="checkbox" id="flag-unmatched" className="rounded" />
              <label htmlFor="flag-unmatched" className="text-sm">Flag unmatched questions for manual review</label>
            </div>
          </div>
        )}
  
        {activeTab === 'advanced' && (
          <div className="space-y-4">
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
                  <input type="time" className="w-full px-3 py-2 border rounded-md text-sm" value="09:00" />
                </div>
                <div>
                  <label className="text-xs">End Time</label>
                  <input type="time" className="w-full px-3 py-2 border rounded-md text-sm" value="18:00" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Blacklist</label>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm"
                rows={3}
                placeholder="Add terms to blacklist, one per line..."
              />
              <p className="text-xs text-gray-500">Questions containing these terms will be skipped</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Character Limit</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="Max characters in response"
                value="500"
              />
              <p className="text-xs text-gray-500">Mercado Livre recommends keeping responses under 500 characters</p>
            </div>
          </div>
        )}
      </div>
    );
  }
  