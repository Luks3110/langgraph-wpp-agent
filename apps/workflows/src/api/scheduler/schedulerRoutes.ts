import { Hono } from 'hono';
import { WorkflowExecutionEngine } from '../../domain/execution/executionEngine.js';
import { JobQueue } from '../../infrastructure/bullmq/jobQueue.js';
import { SupabaseConnection } from '../../infrastructure/database/supabase.js';
import { MonitoringService } from '../../infrastructure/monitoring/monitoring.js';
import { ScheduledEvent, ScheduledEventService } from '../../infrastructure/scheduler/scheduledEvents.js';
import { WorkflowCommandService } from '../../services/command/workflowCommandService.js';

/**
 * Create scheduler routes for handling scheduled events
 */
export function createSchedulerRoutes(
    workflowCommandService: WorkflowCommandService,
    workflowExecutionEngine: WorkflowExecutionEngine,
    jobQueue: JobQueue,
    supabaseConnection: SupabaseConnection
) {
    const app = new Hono();
    const monitoringService = MonitoringService.getInstance();
    const scheduledEventService = new ScheduledEventService(
        workflowCommandService,
        workflowExecutionEngine,
        jobQueue,
        supabaseConnection
    );

    // Create or update scheduled event
    app.post('/:clientId/events', async (c) => {
        const clientId = c.req.param('clientId');
        const startTime = Date.now();

        try {
            const payload = await c.req.json();

            // Validate the event payload
            if (!payload.workflowId || !payload.nodeId) {
                monitoringService.trackApiRequest(
                    `/scheduler/${clientId}/events`,
                    'POST',
                    400,
                    Date.now() - startTime
                );
                return c.json({ error: 'Missing required fields: workflowId and nodeId are required' }, 400);
            }

            // Create or update the scheduled event
            const event = await scheduledEventService.createOrUpdateScheduledEvent({
                id: payload.id,
                workflowId: payload.workflowId,
                nodeId: payload.nodeId,
                clientId: clientId,
                data: payload.data || {},
                schedule: payload.schedule,
                status: payload.status || 'active',
                metadata: payload.metadata
            });

            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events`,
                'POST',
                201,
                Date.now() - startTime
            );
            return c.json({ success: true, event }, 201);
        } catch (error) {
            console.error(`Error creating scheduled event:`, error);
            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events`,
                'POST',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error creating scheduled event',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    // Get all scheduled events for a client
    app.get('/:clientId/events', async (c) => {
        const clientId = c.req.param('clientId');
        const status = c.req.query('status') as 'active' | 'paused' | 'completed' | undefined;
        const startTime = Date.now();

        try {
            const events = await scheduledEventService.getScheduledEvents(clientId, status);

            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events`,
                'GET',
                200,
                Date.now() - startTime
            );
            return c.json({ events });
        } catch (error) {
            console.error(`Error retrieving scheduled events:`, error);
            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events`,
                'GET',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error retrieving scheduled events',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    // Get a specific scheduled event
    app.get('/:clientId/events/:eventId', async (c) => {
        const clientId = c.req.param('clientId');
        const eventId = c.req.param('eventId');
        const startTime = Date.now();

        try {
            // Use type assertion to avoid TypeScript errors with dynamic table names
            const { data, error } = await supabaseConnection.getClient()
                .from('scheduled_events' as any)
                .select('*')
                .eq('id', eventId)
                .eq('clientId', clientId)
                .single();

            if (error) {
                monitoringService.trackApiRequest(
                    `/scheduler/${clientId}/events/${eventId}`,
                    'GET',
                    404,
                    Date.now() - startTime
                );
                return c.json({ error: 'Scheduled event not found' }, 404);
            }

            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}`,
                'GET',
                200,
                Date.now() - startTime
            );
            return c.json({ event: data });
        } catch (error) {
            console.error(`Error retrieving scheduled event:`, error);
            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}`,
                'GET',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error retrieving scheduled event',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    // Trigger a scheduled event immediately
    app.post('/:clientId/events/:eventId/trigger', async (c) => {
        const clientId = c.req.param('clientId');
        const eventId = c.req.param('eventId');
        const startTime = Date.now();

        try {
            // Get event details
            // Use type assertion to avoid TypeScript errors with dynamic table names
            const { data: eventData, error } = await supabaseConnection.getClient()
                .from('scheduled_events' as any)
                .select('*')
                .eq('id', eventId)
                .eq('clientId', clientId)
                .single();

            if (error || !eventData) {
                monitoringService.trackApiRequest(
                    `/scheduler/${clientId}/events/${eventId}/trigger`,
                    'POST',
                    404,
                    Date.now() - startTime
                );
                return c.json({ error: 'Scheduled event not found' }, 404);
            }

            // Process the event
            // Cast the data to ScheduledEvent type for type safety
            const event = eventData as unknown as ScheduledEvent;
            const executionId = await scheduledEventService.handleScheduledEvent(event);

            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}/trigger`,
                'POST',
                200,
                Date.now() - startTime
            );
            return c.json({ success: true, executionId });
        } catch (error) {
            console.error(`Error triggering scheduled event:`, error);
            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}/trigger`,
                'POST',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error triggering scheduled event',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    // Update a scheduled event status (activate, pause, complete)
    app.patch('/:clientId/events/:eventId/status', async (c) => {
        const clientId = c.req.param('clientId');
        const eventId = c.req.param('eventId');
        const startTime = Date.now();

        try {
            const payload = await c.req.json();

            if (!payload.status || !['active', 'paused', 'completed'].includes(payload.status)) {
                monitoringService.trackApiRequest(
                    `/scheduler/${clientId}/events/${eventId}/status`,
                    'PATCH',
                    400,
                    Date.now() - startTime
                );
                return c.json({ error: 'Invalid status. Must be one of: active, paused, completed' }, 400);
            }

            // Update event status
            // Use type assertion to avoid TypeScript errors with dynamic table names
            const { data, error } = await supabaseConnection.getClient()
                .from('scheduled_events' as any)
                .update({
                    status: payload.status,
                    updatedAt: new Date().toISOString()
                })
                .eq('id', eventId)
                .eq('clientId', clientId)
                .select()
                .single();

            if (error) {
                monitoringService.trackApiRequest(
                    `/scheduler/${clientId}/events/${eventId}/status`,
                    'PATCH',
                    404,
                    Date.now() - startTime
                );
                return c.json({ error: 'Scheduled event not found or could not be updated' }, 404);
            }

            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}/status`,
                'PATCH',
                200,
                Date.now() - startTime
            );
            return c.json({ success: true, event: data });
        } catch (error) {
            console.error(`Error updating scheduled event status:`, error);
            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}/status`,
                'PATCH',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error updating scheduled event status',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    // Delete a scheduled event
    app.delete('/:clientId/events/:eventId', async (c) => {
        const clientId = c.req.param('clientId');
        const eventId = c.req.param('eventId');
        const startTime = Date.now();

        try {
            // Use type assertion to avoid TypeScript errors with dynamic table names
            const { error } = await supabaseConnection.getClient()
                .from('scheduled_events' as any)
                .delete()
                .eq('id', eventId)
                .eq('clientId', clientId);

            if (error) {
                monitoringService.trackApiRequest(
                    `/scheduler/${clientId}/events/${eventId}`,
                    'DELETE',
                    404,
                    Date.now() - startTime
                );
                return c.json({ error: 'Scheduled event not found or could not be deleted' }, 404);
            }

            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}`,
                'DELETE',
                200,
                Date.now() - startTime
            );
            return c.json({ success: true });
        } catch (error) {
            console.error(`Error deleting scheduled event:`, error);
            monitoringService.trackApiRequest(
                `/scheduler/${clientId}/events/${eventId}`,
                'DELETE',
                500,
                Date.now() - startTime
            );
            return c.json({
                error: 'Error deleting scheduled event',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, 500);
        }
    });

    return app;
} 
