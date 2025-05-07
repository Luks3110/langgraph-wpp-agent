# Workflow Engine Monitoring System

This directory contains the implementation of the monitoring, metrics, logging, and alerting system for the workflow engine.

## Components

### 1. Metrics Service (`metrics.ts`)

The `MetricsService` provides a comprehensive set of Prometheus-compatible metrics for monitoring the workflow engine's performance:

- Event metrics: tracks event publishing, processing, errors, and timing
- Queue metrics: monitors queue size, latency, and job processing
- System metrics: records memory usage and connection status
- API metrics: measures endpoint latency and response codes

### 2. Logger Service (`logger.ts`)

The `LoggerService` provides structured logging using Winston:

- Consistent log format with timestamps and metadata
- Multiple log levels (error, warn, info, debug, etc.)
- Support for console and file output
- Structured JSON logging for machine readability

### 3. Alerting Service (`alerting.ts`)

The `AlertingService` sends notifications when thresholds are exceeded:

- Multiple alert channels (console, email, webhook)
- Severity levels (critical, high, medium, low)
- Alert types for different monitoring scenarios
- Flexible messaging system

### 4. Monitoring Service (`monitoring.ts`)

The `MonitoringService` brings everything together:

- BullMQ queue and worker instrumentation
- API request tracking
- Error categorization and handling
- Configurable alert thresholds
- Memory usage monitoring

## Integration Points

The monitoring system integrates with:

1. The BullMQ event bus for tracking event processing
2. API endpoints for tracking request/response metrics
3. The Hono web framework through middleware
4. System metrics for resource monitoring

## Metrics Endpoint

The system exposes a `/metrics` endpoint that returns Prometheus-compatible metrics:

```
GET /metrics           - Returns all metrics
GET /metrics/memory    - Updates and returns memory metrics
POST /metrics/reset    - Resets metrics (for testing)
```

## Usage Example

```typescript
// Initialize monitoring service
const monitoringService = MonitoringService.getInstance();

// Instrument a BullMQ queue
monitoringService.instrumentQueue(queue, 'workflow-events');

// Instrument a worker
monitoringService.instrumentWorker(worker, 'workflow-events');

// Start monitoring
monitoringService.start();

// Track API requests
monitoringService.trackApiRequest('/api/workflows', 'GET', 200, 50);

// Track events
monitoringService.trackEvent(event, 'published');
monitoringService.trackEvent(event, 'processed');

// Track errors
monitoringService.trackEventError(event, error);

// Stop monitoring
monitoringService.stop();
```

## Alert Configuration

Alerts are triggered when configured thresholds are exceeded:

- Queue size: When the queue grows too large
- Error rate: When too many errors occur in a short period
- Processing time: When event processing takes too long
- Memory usage: When memory consumption reaches critical levels

## Setting up Alert Channels

```typescript
const alertingService = AlertingService.getInstance();

// Add email alerts
alertingService.addChannel(
  new EmailAlertChannel(['admin@example.com', 'alerts@example.com'])
);

// Add webhook alerts (e.g., for Slack)
alertingService.addChannel(
  new WebhookAlertChannel('https://hooks.slack.com/services/XXX/YYY/ZZZ')
);
``` 
