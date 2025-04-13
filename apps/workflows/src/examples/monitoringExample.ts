import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { RedisConnection } from '../infrastructure/database/redis.js';
import { AlertingService, EmailAlertChannel, WebhookAlertChannel } from '../infrastructure/monitoring/alerting.js';
import { LoggerService, LogLevel } from '../infrastructure/monitoring/logger.js';
import { MetricsService } from '../infrastructure/monitoring/metrics.js';
import { MonitoringService } from '../infrastructure/monitoring/monitoring.js';

/**
 * Example demonstrating the monitoring system
 */
async function runMonitoringExample() {
    console.log('Starting monitoring example...');

    // Initialize services
    const monitoringService = MonitoringService.getInstance();
    const metricsService = MetricsService.getInstance();
    const logger = LoggerService.getInstance({
        level: LogLevel.DEBUG,
        service: 'monitoring-example'
    });
    const alertingService = AlertingService.getInstance();

    // Add additional alert channels
    alertingService.addChannel(new EmailAlertChannel(['admin@example.com']));
    alertingService.addChannel(new WebhookAlertChannel('https://hooks.slack.com/example'));

    // Initialize Redis connection
    const redisConnection = RedisConnection.getInstance({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
    });

    // Create a test queue and worker
    const queueName = 'monitoring-example';
    const queue = new Queue(queueName, {
        connection: redisConnection.getConnection().options
    });

    // Instrument the queue for monitoring
    monitoringService.instrumentQueue(queue, queueName);

    // Create a worker
    const worker = new Worker(queueName, async (job) => {
        logger.info(`Processing job ${job.id}`, { jobId: job.id, data: job.data });

        // Simulate some work
        const workTime = Math.random() * 500 + 100;
        await new Promise(resolve => setTimeout(resolve, workTime));

        // Sometimes fail
        if (Math.random() < 0.2) {
            throw new Error('Simulated random failure');
        }

        return { processed: true, time: workTime };
    }, {
        connection: redisConnection.getConnection().options
    });

    // Instrument the worker for monitoring
    monitoringService.instrumentWorker(worker, queueName);

    // Start monitoring service
    monitoringService.start();

    // Add some jobs
    logger.info('Adding jobs to the queue');
    const jobPromises = [];

    for (let i = 0; i < 10; i++) {
        const jobData = {
            id: randomUUID(),
            task: `Task ${i + 1}`,
            timestamp: new Date().toISOString()
        };

        jobPromises.push(queue.add(`job-${i}`, jobData));

        // Simulate API request being tracked
        monitoringService.trackApiRequest(
            '/api/tasks',
            'POST',
            201,
            Math.floor(Math.random() * 100 + 50)
        );
    }

    await Promise.all(jobPromises);
    logger.info('All jobs added to the queue');

    // Simulate a slow API request
    const slowRequestTime = 2500;
    monitoringService.trackApiRequest(
        '/api/reports/generate',
        'GET',
        200,
        slowRequestTime
    );

    // This should trigger an alert for high latency
    logger.info(`Tracked slow API request with ${slowRequestTime}ms response time`);

    // Wait for all jobs to be processed
    logger.info('Waiting for jobs to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get metrics
    const metrics = await metricsService.getMetricsAsPrometheus();
    logger.info('Current metrics:');
    console.log(metrics.substring(0, 500) + '... (truncated)');

    // Clean up
    logger.info('Cleaning up...');
    await worker.close();
    await queue.close();
    monitoringService.stop();

    logger.info('Monitoring example completed');
}

// Run the example when executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runMonitoringExample().catch(error => {
        console.error('Error running example:', error);
        process.exit(1);
    });
}

export { runMonitoringExample };
