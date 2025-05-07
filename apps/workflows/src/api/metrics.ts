import { Hono } from 'hono';
import { MetricsService } from '../infrastructure/monitoring/metrics.js';
import { MonitoringService } from '../infrastructure/monitoring/monitoring.js';
import { loggingMiddleware } from './middleware/logging.js';
import { responseTimeMiddleware } from './middleware/responseTime.js';

// Create Hono app instance
const app = new Hono();

// Initialize services
const metricsService = MetricsService.getInstance();
const monitoringService = MonitoringService.getInstance();

// Add middleware
app.use('*', responseTimeMiddleware());
app.use('*', loggingMiddleware());

/**
 * GET /metrics
 * 
 * Expose Prometheus metrics for scraping
 */
app.get('/', async (c) => {
    try {
        // Get metrics in Prometheus format
        const metrics = await metricsService.getMetrics();

        // Set content type for Prometheus
        c.header('Content-Type', 'text/plain');

        // Track API request
        const responseTime = c.res.headers.get('X-Response-Time')
            ? parseInt(c.res.headers.get('X-Response-Time')!.replace('ms', ''), 10)
            : 0;

        monitoringService.trackApiRequest(
            '/metrics',
            c.req.method,
            200,
            responseTime
        );

        // Send metrics
        return c.body(metrics);
    } catch (error) {
        console.error('Error generating metrics:', error);

        // Track error
        monitoringService.trackApiRequest(
            '/metrics',
            c.req.method,
            500,
            0
        );

        return c.text('Error generating metrics', 500);
    }
});

/**
 * GET /memory
 * 
 * Update and return memory metrics
 */
app.get('/memory', async (c) => {
    try {
        // Update memory metrics
        metricsService.updateMemoryMetrics();

        // Get metrics in Prometheus format
        const metrics = await metricsService.getMetrics();

        // Set content type for Prometheus
        c.header('Content-Type', 'text/plain');

        // Track API request
        const responseTime = c.res.headers.get('X-Response-Time')
            ? parseInt(c.res.headers.get('X-Response-Time')!.replace('ms', ''), 10)
            : 0;

        monitoringService.trackApiRequest(
            '/metrics/memory',
            c.req.method,
            200,
            responseTime
        );

        // Send metrics
        return c.body(metrics);
    } catch (error) {
        console.error('Error generating memory metrics:', error);

        // Track error
        monitoringService.trackApiRequest(
            '/metrics/memory',
            c.req.method,
            500,
            0
        );

        return c.text('Error generating memory metrics', 500);
    }
});

/**
 * POST /reset
 * 
 * Reset all metrics (useful for testing)
 */
app.post('/reset', async (c) => {
    try {
        // Reset metrics
        metricsService.resetMetrics();

        // Track API request
        const responseTime = c.res.headers.get('X-Response-Time')
            ? parseInt(c.res.headers.get('X-Response-Time')!.replace('ms', ''), 10)
            : 0;

        monitoringService.trackApiRequest(
            '/metrics/reset',
            c.req.method,
            200,
            responseTime
        );

        // Send success response
        return c.json({ success: true, message: 'Metrics reset successfully' });
    } catch (error) {
        console.error('Error resetting metrics:', error);

        // Track error
        monitoringService.trackApiRequest(
            '/metrics/reset',
            c.req.method,
            500,
            0
        );

        return c.json({ success: false, message: 'Error resetting metrics' }, 500);
    }
});

export default app; 
