import { Hono } from 'hono';
import { WorkflowExecutionEngine } from '../../domain/execution/executionEngine.js';
import { WebhookProviderAdapterFactory, WebhookProviderType } from '../../domain/webhooks/providerAdapters.js';
import { registerWebhookProviderAdapters } from '../../domain/webhooks/providers/index.js';
import { JobQueue } from '../../infrastructure/bullmq/jobQueue.js';
import { SupabaseConnection } from '../../infrastructure/database/supabase.js';
import { MonitoringService } from '../../infrastructure/monitoring/monitoring.js';
import { WebhookCommandService } from '../../services/command/webhookCommandService.js';
import { WorkflowCommandService } from '../../services/command/workflowCommandService.js';
import { getNextNodesFromWorkflow, getNodeType, getQueueNameForNodeType } from '../../utils/workflowProcessing.js';

/**
 * Map of node types to their corresponding queue names
 */
const NODE_TYPE_QUEUE_MAP: Record<string, string> = {
    'agent': 'agent-execution',
    'message': 'message-processing',
    'api': 'api-request',
    'decision': 'decision-processing',
    'transform': 'data-transformation',
    'delay': 'scheduled-delay',
    'email': 'email-sending',
    'webhook': 'webhook-trigger',
    // Add more mappings as needed
    'default': 'workflow-node-execution' // Fallback queue
};

/**
 * Create webhook routes for handling provider webhooks
 */
export function createWebhookRoutes(
    webhookCommandService: WebhookCommandService,
    workflowCommandService: WorkflowCommandService,
    workflowExecutionEngine: WorkflowExecutionEngine,
    jobQueue: JobQueue,
    supabaseConnection: SupabaseConnection
) {
    const app = new Hono();
    const adapterFactory = new WebhookProviderAdapterFactory();
    const monitoringService = MonitoringService.getInstance();

    // Register all webhook provider adapters
    registerWebhookProviderAdapters(adapterFactory);

    // Webhook verification endpoint (GET) - for provider challenge/verification requests
    app.get('/:clientId/:provider/:workflowId', async (c) => {
        const clientId = c.req.param('clientId');
        const provider = c.req.param('provider').toUpperCase();
        const workflowId = c.req.param('workflowId');
        const startTime = Date.now();
        const query = Object.fromEntries(new URL(c.req.url).searchParams);
        const headers = Object.fromEntries(c.req.raw.headers.entries());

        // Validate provider type
        if (!Object.values(WebhookProviderType).includes(provider as WebhookProviderType)) {
            monitoringService.trackApiRequest(
                `/webhooks/${clientId}/${provider}/${workflowId}`,
                'GET',
                400,
                Date.now() - startTime
            );
            return c.json({ error: 'Invalid provider type' }, 400);
        }

        // Get adapter for provider
        const adapter = adapterFactory.getAdapter(provider as WebhookProviderType);
        if (!adapter) {
            monitoringService.trackApiRequest(
                `/webhooks/${clientId}/${provider}/${workflowId}`,
                'GET',
                400,
                Date.now() - startTime
            );
            return c.json({ error: 'Provider adapter not found' }, 400);
        }

        try {
            // Handle challenge request
            const result = await adapter.handleChallenge(query, headers);

            if (result.isChallenge) {
                monitoringService.trackApiRequest(
                    `/webhooks/${clientId}/${provider}/${workflowId}`,
                    'GET',
                    200,
                    Date.now() - startTime
                );

                // Return challenge response in the format expected by the provider
                if (typeof result.response === 'string') {
                    return c.text(result.response);
                } else {
                    return c.json(result.response);
                }
            } else {
                monitoringService.trackApiRequest(
                    `/webhooks/${clientId}/${provider}/${workflowId}`,
                    'GET',
                    400,
                    Date.now() - startTime
                );
                return c.json({ error: 'Not a valid challenge request' }, 400);
            }
        } catch (error) {
            console.error(`Error handling webhook verification for ${provider}:`, error);
            monitoringService.trackApiRequest(
                `/webhooks/${clientId}/${provider}/${workflowId}`,
                'GET',
                500,
                Date.now() - startTime
            );
            return c.json({ error: 'Error processing verification request' }, 500);
        }
    });

    // Webhook event endpoint (POST) - for actual webhook events
    app.post('/:clientId/:provider/:workflowId', async (c) => {
        const clientId = c.req.param('clientId');
        const provider = c.req.param('provider').toUpperCase();
        const workflowId = c.req.param('workflowId');
        const startTime = Date.now();

        try {
            const payload = await c.req.json();
            const headers = Object.fromEntries(c.req.raw.headers.entries());

            // Validate provider type
            if (!Object.values(WebhookProviderType).includes(provider as WebhookProviderType)) {
                monitoringService.trackApiRequest(
                    `/webhooks/${clientId}/${provider}/${workflowId}`,
                    'POST',
                    400,
                    Date.now() - startTime
                );
                return c.json({ error: 'Invalid provider type' }, 400);
            }

            // Get adapter for provider
            const adapter = adapterFactory.getAdapter(provider as WebhookProviderType);
            if (!adapter) {
                monitoringService.trackApiRequest(
                    `/webhooks/${clientId}/${provider}/${workflowId}`,
                    'POST',
                    400,
                    Date.now() - startTime
                );
                return c.json({ error: 'Provider adapter not found' }, 400);
            }

            // Check if this is a challenge request first (some providers use POST for challenges too)
            const challengeResult = await adapter.handleChallenge(payload, headers);
            if (challengeResult.isChallenge) {
                monitoringService.trackApiRequest(
                    `/webhooks/${clientId}/${provider}/${workflowId}`,
                    'POST',
                    200,
                    Date.now() - startTime
                );

                if (typeof challengeResult.response === 'string') {
                    return c.text(challengeResult.response);
                } else {
                    return c.json(challengeResult.response);
                }
            }

            // Get webhook secret from environment variables
            const webhookSecret = process.env[`${provider}_WEBHOOK_SECRET`] || '';

            // Verify signature if secret is provided
            if (webhookSecret) {
                const isValid = await adapter.verifySignature(payload, headers, webhookSecret);
                if (!isValid) {
                    monitoringService.trackApiRequest(
                        `/webhooks/${clientId}/${provider}/${workflowId}`,
                        'POST',
                        401,
                        Date.now() - startTime
                    );
                    return c.json({ error: 'Invalid webhook signature' }, 401);
                }
            }

            // Process webhook asynchronously
            c.executionCtx.waitUntil(
                (async () => {
                    try {
                        // Normalize the payload
                        const normalizedPayload = await adapter.normalizePayload(payload, headers, clientId);

                        // Add workflowId to the metadata
                        if (normalizedPayload.metadata) {
                            normalizedPayload.metadata.workflowId = workflowId;
                        }

                        // Include workflowId in the webhookId to support multiple workflows
                        const webhookId = `${clientId}-${provider.toLowerCase()}-${workflowId}`;

                        // Get webhook record from database to know which workflow node to trigger
                        const webhook = await getWebhookDetails(webhookId, supabaseConnection);

                        if (!webhook) {
                            throw new Error(`Webhook not found: ${webhookId}`);
                        }

                        // Create trigger metadata for the workflow
                        const metadata = {
                            source: 'webhook',
                            sourceType: normalizedPayload.provider.toLowerCase(),
                            actionType: normalizedPayload.eventType,
                            customerId: normalizedPayload.customerId,
                            clientId: clientId,
                            workflowId: workflowId,
                            receivedAt: new Date().toISOString()
                        };

                        // Process webhook and get execution ID
                        const executionId = await webhookCommandService.processWebhookEvent(webhookId, normalizedPayload, headers);

                        // Update webhook last triggered timestamp
                        await updateWebhookLastTriggeredAt(webhookId, supabaseConnection);

                        // Get the current node ID from the webhook
                        const currentNodeId = webhook.node_id || 'start';

                        // Get the workflow definition to find and queue the next nodes
                        const workflow = await getWorkflowDefinition(workflowId, supabaseConnection);

                        if (workflow) {
                            // Get the next nodes based on the workflow edges
                            const nextNodes = getNextNodesFromWorkflow(workflow, currentNodeId);

                            // Schedule next nodes for execution if available
                            if (nextNodes && nextNodes.length > 0) {
                                for (const nextNode of nextNodes) {
                                    // Determine the appropriate queue based on node type
                                    const nodeType = getNodeType(nextNode);
                                    const queueName = getQueueNameForNodeType(nodeType);

                                    console.log(`Scheduling next node ${nextNode.id} (type: ${nodeType}) in workflow ${workflowId} to queue ${queueName}`);

                                    // Queue the next node execution to its specific queue
                                    await jobQueue.addJob(queueName, {
                                        nodeId: nextNode.id,
                                        nodeType: nodeType,
                                        workflowId: workflowId,
                                        executionId: executionId,
                                        input: normalizedPayload.data,
                                        metadata: metadata
                                    }, {
                                        attempts: 3,
                                        backoff: {
                                            type: 'exponential',
                                            delay: 5000
                                        },
                                        workflowId: workflowId,
                                        tenantId: clientId,
                                        eventType: `${nodeType}.execution`
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error processing webhook for ${provider}:`, error);
                    }
                })()
            );

            // Return immediate acknowledgment
            monitoringService.trackApiRequest(
                `/webhooks/${clientId}/${provider}/${workflowId}`,
                'POST',
                202,
                Date.now() - startTime
            );
            return c.json({ success: true, message: 'Webhook received and processing' }, 202);

        } catch (error) {
            console.error(`Error handling webhook for ${provider}:`, error);
            monitoringService.trackApiRequest(
                `/webhooks/${clientId}/${provider}/${workflowId}`,
                'POST',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error processing webhook',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    return app;
}

/**
 * Get webhook details from the database
 */
async function getWebhookDetails(webhookId: string, supabaseConnection: SupabaseConnection): Promise<any> {
    try {
        const { data, error } = await supabaseConnection.getClient()
            .from('webhooks')
            .select('*')
            .eq('id', webhookId)
            .single();

        if (error) {
            throw new Error(`Error retrieving webhook: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error retrieving webhook ${webhookId}:`, error);
        return null;
    }
}

/**
 * Update the webhook's last triggered timestamp
 */
async function updateWebhookLastTriggeredAt(webhookId: string, supabaseConnection: SupabaseConnection): Promise<void> {
    try {
        await supabaseConnection.getClient()
            .from('webhooks')
            .update({
                received_at: new Date().toISOString()
            })
            .eq('id', webhookId);
    } catch (error) {
        console.error(`Error updating webhook ${webhookId} last triggered timestamp:`, error);
        // Don't throw here, it's not critical
    }
}

/**
 * Get the workflow definition from the database
 */
async function getWorkflowDefinition(workflowId: string, supabaseConnection: SupabaseConnection): Promise<any> {
    try {
        const { data, error } = await supabaseConnection.getClient()
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .single();

        if (error) {
            throw new Error(`Error retrieving workflow: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error retrieving workflow ${workflowId}:`, error);
        return null;
    }
}
