import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createWorkflowCommandRoutes } from './api/command/workflowRoutes.js';
import metricsRoutes from './api/metrics.js';
import { loggingMiddleware } from './api/middleware/logging.js';
import { responseTimeMiddleware } from './api/middleware/responseTime.js';
import { createWorkflowQueryRoutes } from './api/query/workflowRoutes.js';
import { createSchedulerRoutes } from './api/scheduler/schedulerRoutes.js';
import { createWebhookRoutes } from './api/webhook/webhookRoutes.js';
import { WorkflowExecutionEngine } from './domain/execution/executionEngine.js';
import { AgentWorker } from './infrastructure/bullmq/agentWorker.js';
import { BullMQAdapter } from './infrastructure/bullmq/jobQueue.js';
import { ResponseWorker } from './infrastructure/bullmq/responseWorker.js';
import { SchedulerWorker } from './infrastructure/bullmq/schedulerWorker.js';
import { WebhookWorker } from './infrastructure/bullmq/webhookWorker.js';
import { RedisConnection } from './infrastructure/database/redis.js';
import { SupabaseConnection } from './infrastructure/database/supabase.js';
import { BullMQEventBus } from './infrastructure/eventBus/index.js';
import { MonitoringService } from './infrastructure/monitoring/monitoring.js';
import { EventStoreRepository } from './infrastructure/repositories/eventStoreRepository.js';
import { WebhookRepository } from './infrastructure/repositories/webhookRepository.js';
import { WorkflowRepository } from './infrastructure/repositories/workflowRepository.js';
import { WebhookCommandServiceImpl } from './services/command/webhookCommandService.js';
import { WorkflowCommandServiceImpl } from './services/command/workflowCommandService.js';
import { WebhookQueryServiceImpl } from './services/query/webhookQueryService.js';
import { WorkflowQueryServiceImpl } from './services/query/workflowQueryService.js';

// Initialize monitoring service
const monitoringService = MonitoringService.getInstance();

// Initialize infrastructure
const redisConnection = RedisConnection.getInstance({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
});

const supabaseConnection = SupabaseConnection.getInstance({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || ''
});

// Initialize repositories
const workflowRepository = new WorkflowRepository(supabaseConnection);
const webhookRepository = new WebhookRepository(supabaseConnection);
const eventStoreRepository = new EventStoreRepository(supabaseConnection);

const eventBus = new BullMQEventBus(redisConnection);
const jobQueue = new BullMQAdapter(redisConnection);

// Initialize services
const workflowCommandService = new WorkflowCommandServiceImpl(
    eventBus,
    jobQueue,
    workflowRepository
);

const webhookCommandService = new WebhookCommandServiceImpl(
    eventBus,
    workflowCommandService,
    webhookRepository
);

const workflowQueryService = new WorkflowQueryServiceImpl(
    workflowRepository
);

const webhookQueryService = new WebhookQueryServiceImpl(
    webhookRepository
);

// Initialize execution engine
const workflowExecutionEngine = new WorkflowExecutionEngine(
    workflowRepository,
    jobQueue
);

// Initialize workers
const webhookWorker = new WebhookWorker(
    {
        connection: redisConnection.getConnectionOptions(),
        queueName: 'webhook-queue',
        concurrency: 5
    },
    redisConnection,
    supabaseConnection,
    workflowCommandService,
    jobQueue
);

const agentWorker = new AgentWorker(
    {
        connection: redisConnection.getConnectionOptions(),
        queueName: 'agent-execution',
        responseQueueName: 'response-queue',
        concurrency: 5
    },
    redisConnection,
    supabaseConnection,
    jobQueue
);

const responseWorker = new ResponseWorker(
    {
        connection: redisConnection.getConnectionOptions(),
        queueName: 'response-queue',
        concurrency: 10
    },
    redisConnection
);

const schedulerWorker = new SchedulerWorker(
    {
        connection: redisConnection.getConnectionOptions(),
        queueName: 'scheduler-queue',
        cronCheckInterval: 60000 // Check every minute
    },
    redisConnection,
    supabaseConnection,
    workflowCommandService,
    workflowExecutionEngine,
    jobQueue
);

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', responseTimeMiddleware()); // Add response time middleware
app.use('*', loggingMiddleware());      // Add logging middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/', (c) => c.text('Workflow Engine API is running'));

// Database health check
app.get('/health', async (c) => {
    const redisOk = await redisConnection.ping();
    const supabaseOk = await supabaseConnection.healthCheck();

    // Track metrics for health check
    const responseTime = c.res.headers.get('X-Response-Time')
        ? parseInt(c.res.headers.get('X-Response-Time')!.replace('ms', ''), 10)
        : 0;

    monitoringService.trackApiRequest(
        '/health',
        c.req.method,
        redisOk && supabaseOk ? 200 : 500,
        responseTime
    );

    return c.json({
        status: redisOk && supabaseOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
        supabase: supabaseOk ? 'ok' : 'error'
    });
});

// Metrics routes
app.route('/metrics', metricsRoutes);

// API routes
app.route('/api/workflows', createWorkflowCommandRoutes(workflowCommandService));
app.route('/api/query/workflows', createWorkflowQueryRoutes(workflowQueryService));

// Webhook routes
app.route('/webhooks', createWebhookRoutes(
    webhookCommandService,
    workflowCommandService,
    workflowExecutionEngine,
    jobQueue,
    supabaseConnection
));

// Scheduler routes
app.route('/scheduler', createSchedulerRoutes(
    workflowCommandService,
    workflowExecutionEngine,
    jobQueue,
    supabaseConnection
));

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('Shutting down server...');

    try {
        // Stop monitoring
        monitoringService.stop();

        // Close workers
        await webhookWorker.close();
        await agentWorker.close();
        await responseWorker.close();
        await schedulerWorker.close();

        await jobQueue.close();
        await redisConnection.disconnect();
        console.log('All connections closed successfully');
    } catch (error) {
        console.error('Error during shutdown:', error);
    }

    process.exit(0);
};

// Handle termination signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start monitoring service
monitoringService.start();

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`Starting server on port ${port}...`);

// Export for environments like Cloudflare Workers
export default {
    port,
    fetch: app.fetch
};

