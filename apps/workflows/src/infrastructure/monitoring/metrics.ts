/**
 * MetricType enum represents the different types of metrics available
 */
enum MetricType {
    Counter = 'counter',
    Gauge = 'gauge',
    Histogram = 'histogram',
}

/**
 * MetricValue represents a single data point for a metric
 */
interface MetricValue {
    value: number;
    labels: Record<string, string>;
    timestamp: number;
}

/**
 * Metric represents a single metric with its values
 */
interface Metric {
    name: string;
    help: string;
    type: MetricType;
    values: MetricValue[];
}

/**
 * A registry that stores and manages metrics for the workflow engine
 */
export class MetricsService {
    private static instance: MetricsService;
    private metrics: Map<string, Metric>;
    private startTime: number;

    private constructor() {
        this.metrics = new Map<string, Metric>();
        this.startTime = Date.now();
        this.initializeMetrics();
    }

    /**
     * Get the singleton instance of MetricsService
     */
    public static getInstance(): MetricsService {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService();
        }
        return MetricsService.instance;
    }

    /**
     * Initialize default metrics
     */
    private initializeMetrics(): void {
        // Queue metrics
        this.createCounter('queue_jobs_total', 'Total number of jobs added to the queue');
        this.createCounter('queue_jobs_processed', 'Total number of jobs processed');
        this.createCounter('queue_jobs_failed', 'Total number of jobs that failed processing');
        this.createGauge('queue_size', 'Current number of jobs in the queue');
        this.createHistogram('queue_job_process_time', 'Time to process a job in milliseconds');

        // Event metrics
        this.createCounter('events_published_total', 'Total number of events published');
        this.createCounter('events_processed_total', 'Total number of events processed');
        this.createCounter('events_failed_total', 'Total number of events that failed processing');
        this.createHistogram('event_process_time', 'Time to process an event in milliseconds');

        // System metrics
        this.createGauge('memory_usage_bytes', 'Current memory usage in bytes');
        this.createGauge('uptime_seconds', 'Uptime in seconds');
        this.createGauge('connections_active', 'Number of active connections');

        // API metrics
        this.createCounter('api_requests_total', 'Total number of API requests');
        this.createCounter('api_errors_total', 'Total number of API errors');
        this.createHistogram('api_request_duration', 'Duration of API requests in milliseconds');
    }

    /**
     * Create a counter metric
     */
    public createCounter(name: string, help: string): void {
        this.metrics.set(name, {
            name,
            help,
            type: MetricType.Counter,
            values: [],
        });
    }

    /**
     * Create a gauge metric
     */
    public createGauge(name: string, help: string): void {
        this.metrics.set(name, {
            name,
            help,
            type: MetricType.Gauge,
            values: [],
        });
    }

    /**
     * Create a histogram metric
     */
    public createHistogram(name: string, help: string): void {
        this.metrics.set(name, {
            name,
            help,
            type: MetricType.Histogram,
            values: [],
        });
    }

    /**
     * Increment a counter metric
     */
    public incrementCounter(name: string, labels: Record<string, string> = {}): void {
        this.incrementCounterBy(name, 1, labels);
    }

    /**
     * Increment a counter metric by a specific value
     */
    public incrementCounterBy(name: string, value: number, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric) {
            throw new Error(`Metric ${name} does not exist`);
        }

        if (metric.type !== MetricType.Counter) {
            throw new Error(`Metric ${name} is not a counter`);
        }

        const existingValue = metric.values.find(
            (v) => Object.keys(labels).every((k) => v.labels[k] === labels[k])
        );

        if (existingValue) {
            existingValue.value += value;
            existingValue.timestamp = Date.now();
        } else {
            metric.values.push({
                value,
                labels,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Set a gauge metric value
     */
    public setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric) {
            throw new Error(`Metric ${name} does not exist`);
        }

        if (metric.type !== MetricType.Gauge) {
            throw new Error(`Metric ${name} is not a gauge`);
        }

        const existingValueIndex = metric.values.findIndex(
            (v) => Object.keys(labels).every((k) => v.labels[k] === labels[k])
        );

        if (existingValueIndex !== -1) {
            metric.values[existingValueIndex] = {
                value,
                labels,
                timestamp: Date.now(),
            };
        } else {
            metric.values.push({
                value,
                labels,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Observe a value for a histogram metric
     */
    public observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
        const metric = this.metrics.get(name);
        if (!metric) {
            throw new Error(`Metric ${name} does not exist`);
        }

        if (metric.type !== MetricType.Histogram) {
            throw new Error(`Metric ${name} is not a histogram`);
        }

        metric.values.push({
            value,
            labels,
            timestamp: Date.now(),
        });
    }

    /**
     * Update memory usage metrics
     */
    public updateMemoryMetrics(): void {
        if (process.memoryUsage) {
            const memoryUsage = process.memoryUsage();
            this.setGauge('memory_usage_bytes', memoryUsage.heapUsed, { type: 'heap_used' });
            this.setGauge('memory_usage_bytes', memoryUsage.heapTotal, { type: 'heap_total' });
            this.setGauge('memory_usage_bytes', memoryUsage.rss, { type: 'rss' });
        }
    }

    /**
     * Update uptime metrics
     */
    public updateUptimeMetrics(): void {
        const uptime = (Date.now() - this.startTime) / 1000;
        this.setGauge('uptime_seconds', uptime);
    }

    /**
     * Track queue job metrics
     */
    public trackQueueJob(queueName: string, status: 'added' | 'processed' | 'failed'): void {
        const labels = { queue: queueName };

        if (status === 'added') {
            this.incrementCounter('queue_jobs_total', labels);
            // Get current size and increment
            const sizeMetric = this.metrics.get('queue_size');
            const existingSize = sizeMetric?.values.find(
                (v) => v.labels.queue === queueName
            )?.value || 0;
            this.setGauge('queue_size', existingSize + 1, labels);
        } else if (status === 'processed') {
            this.incrementCounter('queue_jobs_processed', labels);
            // Get current size and decrement
            const sizeMetric = this.metrics.get('queue_size');
            const existingSize = sizeMetric?.values.find(
                (v) => v.labels.queue === queueName
            )?.value || 1;
            this.setGauge('queue_size', Math.max(0, existingSize - 1), labels);
        } else if (status === 'failed') {
            this.incrementCounter('queue_jobs_failed', labels);
            // Get current size and decrement
            const sizeMetric = this.metrics.get('queue_size');
            const existingSize = sizeMetric?.values.find(
                (v) => v.labels.queue === queueName
            )?.value || 1;
            this.setGauge('queue_size', Math.max(0, existingSize - 1), labels);
        }
    }

    /**
     * Track queue job processing time
     */
    public trackQueueJobProcessingTime(queueName: string, durationMs: number): void {
        this.observeHistogram('queue_job_process_time', durationMs, { queue: queueName });
    }

    /**
     * Track event metrics
     */
    public trackEvent(eventType: string, status: 'published' | 'processed' | 'failed'): void {
        const labels = { event_type: eventType };

        if (status === 'published') {
            this.incrementCounter('events_published_total', labels);
        } else if (status === 'processed') {
            this.incrementCounter('events_processed_total', labels);
        } else if (status === 'failed') {
            this.incrementCounter('events_failed_total', labels);
        }
    }

    /**
     * Track event processing time
     */
    public trackEventProcessingTime(eventType: string, durationMs: number): void {
        this.observeHistogram('event_process_time', durationMs, { event_type: eventType });
    }

    /**
     * Track API request
     */
    public trackApiRequest(
        path: string,
        method: string,
        statusCode: number,
        durationMs: number
    ): void {
        const labels = {
            path,
            method,
            status_code: statusCode.toString(),
        };

        this.incrementCounter('api_requests_total', labels);

        if (statusCode >= 400) {
            this.incrementCounter('api_errors_total', labels);
        }

        this.observeHistogram('api_request_duration', durationMs, labels);
    }

    /**
     * Reset all metrics
     */
    public resetMetrics(): void {
        this.metrics.clear();
        this.initializeMetrics();
        this.startTime = Date.now();
    }

    /**
     * Get all metrics in Prometheus-compatible format
     */
    public getMetricsAsPrometheus(): string {
        let output = '';

        for (const [name, metric] of this.metrics.entries()) {
            output += `# HELP ${name} ${metric.help}\n`;
            output += `# TYPE ${name} ${metric.type}\n`;

            if (metric.type === MetricType.Histogram) {
                // For histograms, calculate buckets and add sum/count
                const buckets = this.calculateHistogramBuckets(metric);

                // Add bucket entries
                for (const [bucket, count] of Object.entries(buckets)) {
                    const bucketLabels = { le: bucket };
                    output += this.formatPrometheusMetric(`${name}_bucket`, bucketLabels, count);
                }

                // Add sum
                const sum = metric.values.reduce((acc, val) => acc + val.value, 0);
                output += this.formatPrometheusMetric(`${name}_sum`, {}, sum);

                // Add count
                output += this.formatPrometheusMetric(`${name}_count`, {}, metric.values.length);
            } else {
                // For counters and gauges, simply output the values
                for (const value of metric.values) {
                    output += this.formatPrometheusMetric(name, value.labels, value.value);
                }
            }
        }

        return output;
    }

    /**
     * Get metrics - for backward compatibility
     */
    public getMetrics(): string {
        return this.getMetricsAsPrometheus();
    }

    /**
     * Calculate histogram buckets from values
     */
    private calculateHistogramBuckets(metric: Metric): Record<string, number> {
        const bucketLimits = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
        const buckets: Record<string, number> = {};

        // Initialize buckets
        for (const limit of bucketLimits) {
            buckets[limit.toString()] = 0;
        }
        buckets['+Inf'] = 0;

        // Count values in buckets
        for (const value of metric.values) {
            let counted = false;

            for (const limit of bucketLimits) {
                if (value.value <= limit) {
                    buckets[limit.toString()]++;
                    counted = true;
                    break;
                }
            }

            if (!counted) {
                buckets['+Inf']++;
            }
        }

        // Make buckets cumulative
        let cumulative = 0;
        for (const limit of [...bucketLimits, '+Inf']) {
            cumulative += buckets[limit.toString()];
            buckets[limit.toString()] = cumulative;
        }

        return buckets;
    }

    /**
     * Format a metric in Prometheus format
     */
    private formatPrometheusMetric(
        name: string,
        labels: Record<string, string>,
        value: number
    ): string {
        const labelStr = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');

        return `${name}${labelStr ? `{${labelStr}}` : ''} ${value}\n`;
    }

    /**
     * Get a JSON representation of all metrics
     */
    public getMetricsAsJson(): Record<string, any> {
        const result: Record<string, any> = {};

        for (const [name, metric] of this.metrics.entries()) {
            result[name] = {
                help: metric.help,
                type: metric.type,
                values: metric.values,
            };
        }

        return result;
    }
} 
