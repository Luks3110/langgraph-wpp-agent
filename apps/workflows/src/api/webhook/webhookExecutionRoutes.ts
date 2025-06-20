import { Hono } from 'hono';
import { SupabaseConnection } from '../../infrastructure/database/supabase.js';
import { SupabaseWorkflowExecutionRepository } from '../../infrastructure/repositories/workflowExecutionRepository.js';
import { SupabaseWebhookTriggerRepository } from '../../infrastructure/repositories/webhookTriggerRepository.js';
import { WorkflowRepository } from '../../infrastructure/repositories/workflowRepository.js';
import { BullMQAdapter } from '../../infrastructure/bullmq/jobQueue.js';
import { BullMQEventBus } from '../../infrastructure/eventBus/bullmqEventBus.js';
import { RedisConnection } from '../../infrastructure/database/redis.js';

export function createWebhookExecutionRoutes(
    supabase: SupabaseConnection,
    redis: RedisConnection
): Hono {
    const app = new Hono();

    // Initialize repositories and services
    const executionRepository = new SupabaseWorkflowExecutionRepository(supabase);
    const webhookTriggerRepository = new SupabaseWebhookTriggerRepository(supabase);
    const workflowRepository = new WorkflowRepository(supabase);
    const jobQueue = new BullMQAdapter(redis);
    
    // Use a simpler approach for event bus initialization
    // The calling code should handle Redis connection configuration
    const eventBus = new BullMQEventBus({
        connection: redis,
        queueName: 'workflow-events'
    });

    /**
     * Handle webhook trigger
     * POST /webhook/:webhookPath
     */
    app.post('/webhook/:webhookPath', async (c) => {
        try {
            const webhookPath = `/${c.req.param('webhookPath')}`;
            const payload = await c.req.json();
            const headers = Object.fromEntries(
                Object.entries(c.req.header()).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
            );

            // Find webhook trigger
            const trigger = await webhookTriggerRepository.getTriggerByPath(webhookPath);
            if (!trigger) {
                return c.json({ error: 'Webhook trigger not found' }, 404);
            }

            // Get workflow definition
            const workflow = await workflowRepository.findById(trigger.workflow_id);
            if (!workflow) {
                return c.json({ error: 'Workflow not found' }, 404);
            }

            // Prepare webhook input data
            const webhookInput = {
                payload,
                headers,
                webhookPath,
                timestamp: new Date().toISOString()
            };

            // Create workflow execution record
            const execution = await executionRepository.createExecution({
                workflow_id: trigger.workflow_id,
                tenant_id: trigger.tenant_id,
                status: 'running',
                variables: webhookInput,
                context: {
                    trigger: {
                        type: 'webhook',
                        data: webhookInput,
                        source: webhookPath
                    }
                },
                current_nodes: [], // Will be populated after processing workflow
                completed_nodes: [],
                failed_nodes: []
            });

            // Queue initial workflow processing job
            await jobQueue.addJob('workflow-execution-start', {
                workflowExecutionId: execution.id,
                workflowId: trigger.workflow_id,
                tenantId: trigger.tenant_id,
                triggerData: webhookInput
            });

            // Publish webhook received event
            await eventBus.publish('webhook.received', {
                webhookPath,
                workflowExecutionId: execution.id,
                workflowId: trigger.workflow_id,
                tenantId: trigger.tenant_id,
                payload
            });

            return c.json({
                success: true,
                workflowExecutionId: execution.id,
                message: 'Webhook processed and workflow execution started'
            });

        } catch (error) {
            console.error('Webhook trigger error:', error);
            return c.json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    /**
     * Get webhook execution status
     * GET /webhook/execution/:executionId
     */
    app.get('/webhook/execution/:executionId', async (c) => {
        try {
            const executionId = c.req.param('executionId');

            const execution = await executionRepository.getExecution(executionId);
            if (!execution) {
                return c.json({ error: 'Workflow execution not found' }, 404);
            }

            const nodeExecutions = await executionRepository.listNodeExecutions(executionId);

            return c.json({
                execution: {
                    id: execution.id,
                    workflowId: execution.workflow_id,
                    status: execution.status,
                    startedAt: execution.started_at,
                    completedAt: execution.completed_at,
                    currentNodes: execution.current_nodes,
                    completedNodes: execution.completed_nodes,
                    failedNodes: execution.failed_nodes,
                    variables: execution.variables
                },
                nodeExecutions: nodeExecutions.map(ne => ({
                    id: ne.id,
                    nodeId: ne.node_id,
                    status: ne.status,
                    startedAt: ne.started_at,
                    completedAt: ne.completed_at,
                    input: ne.input_data,
                    output: ne.output_data,
                    error: ne.error_message,
                    retryCount: ne.retry_count
                }))
            });

        } catch (error) {
            console.error('Get execution status error:', error);
            return c.json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    /**
     * List webhook triggers for a workflow
     * GET /webhook/triggers/:workflowId
     */
    app.get('/webhook/triggers/:workflowId', async (c) => {
        try {
            const workflowId = c.req.param('workflowId');
            const triggers = await webhookTriggerRepository.getTriggersByWorkflow(workflowId);

            return c.json({
                triggers: triggers.map(trigger => ({
                    id: trigger.id,
                    workflowId: trigger.workflow_id,
                    nodeId: trigger.node_id,
                    webhookPath: trigger.webhook_path,
                    isActive: trigger.is_active,
                    webhookUrl: `${c.req.header('host') || 'localhost'}${trigger.webhook_path}`,
                    createdAt: trigger.created_at
                }))
            });

        } catch (error) {
            console.error('List webhook triggers error:', error);
            return c.json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    /**
     * Create webhook trigger for a workflow node
     * POST /webhook/triggers
     */
    app.post('/webhook/triggers', async (c) => {
        try {
            const body = await c.req.json();
            const { workflowId, nodeId, webhookPath, tenantId, webhookSecret } = body;

            // Validate required fields
            if (!workflowId || !nodeId || !webhookPath || !tenantId) {
                return c.json({
                    error: 'Missing required fields: workflowId, nodeId, webhookPath, tenantId'
                }, 400);
            }

            // Create webhook trigger
            const trigger = await webhookTriggerRepository.createTrigger({
                workflow_id: workflowId,
                node_id: nodeId,
                webhook_path: webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`,
                tenant_id: tenantId,
                webhook_secret: webhookSecret,
                is_active: true
            });

            return c.json({
                success: true,
                trigger: {
                    id: trigger.id,
                    workflowId: trigger.workflow_id,
                    nodeId: trigger.node_id,
                    webhookPath: trigger.webhook_path,
                    webhookUrl: `${c.req.header('host') || 'localhost'}${trigger.webhook_path}`,
                    isActive: trigger.is_active,
                    createdAt: trigger.created_at
                }
            });

        } catch (error) {
            console.error('Create webhook trigger error:', error);
            return c.json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    return app;
}