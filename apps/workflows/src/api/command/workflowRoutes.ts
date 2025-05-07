import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { WorkflowCommandService } from '../../services/command/workflowCommandService';

// Define request schemas using Zod
const createWorkflowSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    tenantId: z.string().uuid(),
    nodes: z.array(z.object({
        id: z.string().min(1),
        type: z.string().min(1),
        name: z.string().min(1).max(100),
        config: z.record(z.any()).optional(),
        position: z.object({
            x: z.number(),
            y: z.number()
        }).optional()
    })),
    edges: z.array(z.object({
        source: z.string().min(1),
        target: z.string().min(1),
        condition: z.string().optional()
    })),
    tags: z.array(z.string()).optional()
});

const updateWorkflowSchema = createWorkflowSchema.partial();

export function createWorkflowCommandRoutes(workflowCommandService: WorkflowCommandService) {
    const app = new Hono();

    // Create a new workflow
    app.post('/', zValidator('json', createWorkflowSchema), async (c) => {
        const workflowDefinition = c.req.valid('json');

        try {
            const workflowId = await workflowCommandService.createWorkflow(workflowDefinition);
            return c.json({ id: workflowId, success: true }, 201);
        } catch (error) {
            console.error('Error creating workflow:', error);
            return c.json({ error: 'Failed to create workflow', details: (error as Error).message }, 500);
        }
    });

    // Update an existing workflow
    app.put('/:id', zValidator('json', updateWorkflowSchema), async (c) => {
        const workflowId = c.req.param('id');
        const updates = c.req.valid('json');

        try {
            await workflowCommandService.updateWorkflow(workflowId, updates);
            return c.json({ success: true });
        } catch (error) {
            console.error(`Error updating workflow ${workflowId}:`, error);
            return c.json({ error: 'Failed to update workflow', details: (error as Error).message }, 500);
        }
    });

    // Delete a workflow
    app.delete('/:id', async (c) => {
        const workflowId = c.req.param('id');

        try {
            await workflowCommandService.deleteWorkflow(workflowId);
            return c.json({ success: true });
        } catch (error) {
            console.error(`Error deleting workflow ${workflowId}:`, error);
            return c.json({ error: 'Failed to delete workflow', details: (error as Error).message }, 500);
        }
    });

    // Publish a workflow
    app.post('/:id/publish', async (c) => {
        const workflowId = c.req.param('id');

        try {
            await workflowCommandService.publishWorkflow(workflowId);
            return c.json({ success: true });
        } catch (error) {
            console.error(`Error publishing workflow ${workflowId}:`, error);
            return c.json({ error: 'Failed to publish workflow', details: (error as Error).message }, 500);
        }
    });

    // Trigger a workflow node
    app.post('/nodes/:nodeId/trigger', async (c) => {
        const nodeId = c.req.param('nodeId');
        const body = await c.req.json();
        const { input, metadata } = body;

        try {
            const triggerId = await workflowCommandService.triggerWorkflowNode(nodeId, input, metadata);
            return c.json({ triggerId, success: true });
        } catch (error) {
            console.error(`Error triggering node ${nodeId}:`, error);
            return c.json({ error: 'Failed to trigger node', details: (error as Error).message }, 500);
        }
    });

    return app;
} 
