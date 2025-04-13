import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { DomainEvent } from '../../domain/events/index.js';
import { AlertingService, AlertType } from './alerting.js';
import { LoggerService } from './logger.js';
import { MetricsService } from './metrics.js';

/**
 * Threshold configurations for alerts
 */
export interface AlertThresholds {
    queueSize: number;
    errorRate: number;
    processingTime: number;
    jobFailureRate: number;
    memoryUsage: number;
}

/**
 * Default alert thresholds
 */
export const DEFAULT_THRESHOLDS: AlertThresholds = {
    queueSize: 1000,
    errorRate: 0.1, // 10% error rate
    processingTime: 30000, // 30 seconds
    jobFailureRate: 0.05, // 5% failure rate
    memoryUsage: 0.9 // 90% of max memory
};

/**
 * Monitoring service for tracking and recording metrics
 */
export class MonitoringService {
    private static instance: MonitoringService;
    private metrics: MetricsService;
    private logger: LoggerService;
    private alerting: AlertingService;
    private thresholds: AlertThresholds;
    private intervalId?: NodeJS.Timeout;
    private memoryCheckIntervalId?: NodeJS.Timeout;

    private constructor(thresholds: AlertThresholds = DEFAULT_THRESHOLDS) {
        this.metrics = MetricsService.getInstance();
        this.logger = LoggerService.getInstance();
        this.alerting = AlertingService.getInstance();
        this.thresholds = thresholds;
    }

    /**
     * Get singleton instance
     */
    public static getInstance(thresholds?: AlertThresholds): MonitoringService {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService(thresholds);
        }
        return MonitoringService.instance;
    }

    /**
     * Start monitoring
     */
    public start(): void {
        if (this.intervalId) {
            return; // Already started
        }

        // Update memory metrics every 30 seconds
        this.memoryCheckIntervalId = setInterval(() => {
            this.metrics.updateMemoryMetrics();
            this.checkMemoryUsage();
        }, 30000);

        this.logger.info('Monitoring service started');
    }

    /**
     * Stop monitoring
     */
    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }

        if (this.memoryCheckIntervalId) {
            clearInterval(this.memoryCheckIntervalId);
            this.memoryCheckIntervalId = undefined;
        }

        this.logger.info('Monitoring service stopped');
    }

    /**
     * Instrument a BullMQ queue for monitoring
     */
    public instrumentQueue(queue: Queue, queueName: string): void {
        const queueEvents = new QueueEvents(queue.name, {
            connection: queue.opts.connection
        });

        // Monitor queue events
        queueEvents.on('completed', ({ jobId }) => {
            this.metrics.incrementCounter('queue_jobs_processed', { queue_name: queueName, status: 'completed' });
        });

        queueEvents.on('failed', ({ jobId, failedReason }) => {
            const errorType = this.categorizeError(failedReason || 'unknown');
            this.metrics.incrementCounter('queue_jobs_processed', { queue_name: queueName, status: 'failed' });

            // Categorize and record the error
            this.metrics.incrementCounter('queue_jobs_failed', {
                queue_name: queueName,
                event_type: 'unknown', // Would need to extract from the job data
                error_type: errorType
            });

            // Log the failure
            this.logger.error(`Job ${jobId} failed: ${failedReason}`, {
                queue: queueName,
                jobId
            });

            // Alert on job failure if necessary
            this.alertOnJobFailure(queueName, jobId, failedReason);
        });

        queueEvents.on('stalled', ({ jobId }) => {
            this.metrics.incrementCounter('queue_jobs_processed', { queue_name: queueName, status: 'stalled' });

            this.logger.warn(`Job ${jobId} stalled`, {
                queue: queueName,
                jobId
            });
        });

        // Monitor queue size at intervals
        setInterval(async () => {
            try {
                const count = await queue.count();
                this.metrics.setGauge('queue_size', count, { queue_name: queueName });

                // Alert if queue size exceeds threshold
                if (count > this.thresholds.queueSize) {
                    await this.alerting.sendHighAlert(
                        'Queue size threshold exceeded',
                        `Queue ${queueName} has ${count} jobs which exceeds the threshold of ${this.thresholds.queueSize}`,
                        AlertType.QUEUE_OVERFLOW,
                        { queue: queueName, count, threshold: this.thresholds.queueSize }
                    );
                }
            } catch (error) {
                this.logger.error(`Failed to get queue count for ${queueName}: ${error}`);
            }
        }, 60000); // Check queue size every minute

        this.logger.info(`Queue ${queueName} instrumented for monitoring`);
    }

    /**
     * Instrument a BullMQ worker for monitoring
     */
    public instrumentWorker(worker: Worker, queueName: string): void {
        worker.on('completed', (job: Job) => {
            const processingTime = Date.now() - new Date(job.processedOn || Date.now()).getTime();
            const eventType = job.name || 'unknown';

            // Record processing time
            this.metrics.trackEventProcessingTime(
                eventType,
                processingTime
            );

            // Check for high latency
            if (processingTime > this.thresholds.processingTime) {
                this.logger.warn(`Job processing time exceeds threshold: ${processingTime}ms`, {
                    queue: queueName,
                    jobId: job.id,
                    eventType
                });

                // Alert on high latency
                this.alerting.sendMediumAlert(
                    'High job processing time',
                    `Job ${job.id} of type ${eventType} took ${processingTime}ms to process, which exceeds the threshold of ${this.thresholds.processingTime}ms`,
                    AlertType.HIGH_LATENCY,
                    { queue: queueName, jobId: job.id, eventType, processingTime }
                );
            }

            this.logger.debug(`Job ${job.id} completed in ${processingTime}ms`, {
                queue: queueName,
                jobId: job.id,
                eventType,
                processingTime
            });
        });

        worker.on('failed', (job: Job | undefined, error: Error) => {
            const eventType = job?.name || 'unknown';

            this.logger.error(`Worker failed to process job: ${error.message}`, {
                queue: queueName,
                jobId: job?.id,
                eventType,
                error: error.stack
            });
        });

        worker.on('error', (error: Error) => {
            this.logger.error(`Worker error: ${error.message}`, {
                queue: queueName,
                error: error.stack
            });

            // Alert on worker error
            this.alerting.sendCriticalAlert(
                'Worker error',
                `Worker for queue ${queueName} encountered an error: ${error.message}`,
                AlertType.WORKFLOW_ERROR,
                { queue: queueName, error: error.stack }
            );
        });

        this.logger.info(`Worker for queue ${queueName} instrumented for monitoring`);
    }

    /**
     * Track event processing
     */
    public trackEvent(event: DomainEvent, status: 'published' | 'processed' | 'failed'): void {
        // Record the event
        if (status === 'published') {
            this.metrics.incrementCounter('events_published_total', {
                event_type: event.type,
                tenant_id: event.tenantId
            });

            this.metrics.incrementCounter('events_by_type', {
                event_type: event.type,
                tenant_id: event.tenantId
            });

            this.logger.debug(`Event published: ${event.type}`, {
                eventId: event.id,
                eventType: event.type,
                tenantId: event.tenantId
            });
        } else if (status === 'processed') {
            this.metrics.incrementCounter('events_processed_total', {
                event_type: event.type,
                tenant_id: event.tenantId,
                status: 'success'
            });

            this.logger.debug(`Event processed: ${event.type}`, {
                eventId: event.id,
                eventType: event.type,
                tenantId: event.tenantId
            });
        } else if (status === 'failed') {
            this.metrics.incrementCounter('events_processed_total', {
                event_type: event.type,
                tenant_id: event.tenantId,
                status: 'failed'
            });

            this.logger.error(`Event processing failed: ${event.type}`, {
                eventId: event.id,
                eventType: event.type,
                tenantId: event.tenantId
            });
        }
    }

    /**
     * Track event processing error
     */
    public trackEventError(event: DomainEvent, error: Error): void {
        const errorType = this.categorizeError(error.message);

        this.metrics.incrementCounter('events_failed_total', {
            event_type: event.type,
            error_type: errorType
        });

        this.logger.error(`Event processing error for ${event.type}: ${error.message}`, {
            eventId: event.id,
            eventType: event.type,
            tenantId: event.tenantId,
            error: error.stack
        });

        // Alert on event processing error
        this.alerting.sendMediumAlert(
            'Event processing error',
            `Error processing event ${event.id} of type ${event.type}: ${error.message}`,
            AlertType.WORKFLOW_ERROR,
            { eventId: event.id, eventType: event.type, tenantId: event.tenantId, error: error.stack }
        );
    }

    /**
     * Track API request
     */
    public trackApiRequest(
        endpoint: string,
        method: string,
        statusCode: number,
        duration: number
    ): void {
        this.metrics.trackApiRequest(
            endpoint,
            method,
            statusCode,
            duration
        );

        this.logger.http(`${method} ${endpoint} - ${statusCode} (${duration}ms)`, {
            endpoint,
            method,
            statusCode,
            duration
        });
    }

    /**
     * Categorize error message
     */
    private categorizeError(errorMessage: string): string {
        const lowerMessage = errorMessage.toLowerCase();

        if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
            return 'timeout';
        } else if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) {
            return 'connection';
        } else if (lowerMessage.includes('database') || lowerMessage.includes('sql') || lowerMessage.includes('query')) {
            return 'database';
        } else if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
            return 'validation';
        } else if (lowerMessage.includes('permission') || lowerMessage.includes('access') || lowerMessage.includes('unauthorized')) {
            return 'authorization';
        } else {
            return 'unknown';
        }
    }

    /**
     * Alert on job failure if necessary
     */
    private async alertOnJobFailure(queueName: string, jobId: string, reason: string): Promise<void> {
        const errorType = this.categorizeError(reason);

        // Determine severity based on error type
        if (errorType === 'connection' || errorType === 'database') {
            await this.alerting.sendHighAlert(
                'Critical job failure',
                `Job ${jobId} in queue ${queueName} failed with a ${errorType} error: ${reason}`,
                AlertType.JOB_FAILURE,
                { queue: queueName, jobId, reason, errorType }
            );
        } else {
            await this.alerting.sendMediumAlert(
                'Job failure',
                `Job ${jobId} in queue ${queueName} failed: ${reason}`,
                AlertType.JOB_FAILURE,
                { queue: queueName, jobId, reason, errorType }
            );
        }
    }

    /**
     * Check memory usage and alert if necessary
     */
    private checkMemoryUsage(): void {
        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed;
        const heapTotal = memoryUsage.heapTotal;
        const usageRatio = heapUsed / heapTotal;

        if (usageRatio > this.thresholds.memoryUsage) {
            this.logger.warn(`Memory usage threshold exceeded: ${Math.round(usageRatio * 100)}%`, {
                heapUsed,
                heapTotal,
                usageRatio
            });

            this.alerting.sendHighAlert(
                'High memory usage',
                `Memory usage is at ${Math.round(usageRatio * 100)}% which exceeds the threshold of ${Math.round(this.thresholds.memoryUsage * 100)}%`,
                AlertType.SYSTEM_RESOURCE,
                { heapUsed, heapTotal, usageRatio, threshold: this.thresholds.memoryUsage }
            );
        }
    }
} 
