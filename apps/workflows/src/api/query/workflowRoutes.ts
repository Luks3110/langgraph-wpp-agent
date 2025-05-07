import { Hono } from 'hono';
import { WorkflowQueryService } from '../../services/query/workflowQueryService';

export function createWorkflowQueryRoutes(workflowQueryService: WorkflowQueryService) {
    const app = new Hono();

    // Get a specific workflow by ID
    app.get('/:id', async (c) => {
        const workflowId = c.req.param('id');

        try {
            const workflow = await workflowQueryService.getWorkflowById(workflowId);

            if (!workflow) {
                return con({ error: 'Workflow not found' }, 404);
            }

            return con(workflow);
        } catch (error) {
            console.error(`Error fetching workflow ${workflowId}:`, error);
            return con({ error: 'Failed to fetch workflow', details: (error as Error).message }, 500);
        }
    });

    // List workflows by tenant
    app.get('/', async (c) => {
        const tenantId = c.req.query('tenantId');

        if (!tenantId) {
            return con({ error: 'tenantId is required' }, 400);
        }

        const status = c.req.query('status');
        const tag = c.req.query('tag');
        const after = c.req.query('after');
        const before = c.req.query('before');
        const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
        const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

        const filters = {
            status,
            tag,
            after,
            before,
            limit,
            offset
        };

        try {
            const workflows = await workflowQueryService.listWorkflowsByTenant(tenantId, filters);
            return con(workflows);
        } catch (error) {
            console.error(`Error listing workflows for tenant ${tenantId}:`, error);
            return con({ error: 'Failed to list workflows', details: (error as Error).message }, 500);
        }
    });

    // Get workflow executions
    app.get('/:id/executions', async (c) => {
        const workflowId = c.req.param('id');

        try {
            const executions = await workflowQueryService.getWorkflowExecutions(workflowId);
            return con(executions);
        } catch (error) {
            console.error(`Error fetching executions for workflow ${workflowId}:`, error);
            return con({ error: 'Failed to fetch workflow executions', details: (error as Error).message }, 500);
        }
    });

    // Get node execution history
    app.get('/nodes/:nodeId/executions', async (c) => {
        const nodeId = c.req.param('nodeId');

        try {
            const nodeExecutions = await workflowQueryService.getNodeExecutionHistory(nodeId);
            return con(nodeExecutions);
        } catch (error) {
            console.error(`Error fetching execution history for node ${nodeId}:`, error);
            return con({ error: 'Failed to fetch node execution history', details: (error as Error).message }, 500);
        }
    });

    return app;
}
