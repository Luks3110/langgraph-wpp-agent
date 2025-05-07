import { LoggerService, LogLevel } from './logger';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low',
    INFO = 'info'
}

/**
 * Alert types
 */
export enum AlertType {
    QUEUE_OVERFLOW = 'queue_overflow',
    JOB_FAILURE = 'job_failure',
    HIGH_LATENCY = 'high_latency',
    ERROR_RATE = 'error_rate',
    SYSTEM_RESOURCE = 'system_resource',
    WORKFLOW_ERROR = 'workflow_error',
    DATABASE_ERROR = 'database_error'
}

/**
 * Alert notification data
 */
export interface AlertData {
    title: string;
    message: string;
    type: AlertType;
    severity: AlertSeverity;
    timestamp: Date;
    source: string;
    tags?: string[];
    metadata?: Record<string, any>;
}

/**
 * Alert channel interface
 */
export interface AlertChannel {
    sendAlert(alert: AlertData): Promise<boolean>;
    isEnabled(): boolean;
    getName(): string;
}

/**
 * Console alert channel (default)
 */
export class ConsoleAlertChannel implements AlertChannel {
    private logger = LoggerService.getInstance();

    async sendAlert(alert: AlertData): Promise<boolean> {
        const logLevel = this.getSeverityLogLevel(alert.severity);

        this.logger.logEvent(
            logLevel,
            `ALERT: ${alert.type}`,
            {
                title: alert.title,
                message: alert.message,
                severity: alert.severity,
                source: alert.source,
                tags: alert.tags,
                metadata: alert.metadata
            }
        );

        return true;
    }

    isEnabled(): boolean {
        return true;
    }

    getName(): string {
        return 'console';
    }

    private getSeverityLogLevel(severity: AlertSeverity): LogLevel {
        switch (severity) {
            case AlertSeverity.CRITICAL:
            case AlertSeverity.HIGH:
                return LogLevel.ERROR;
            case AlertSeverity.MEDIUM:
                return LogLevel.WARN;
            case AlertSeverity.LOW:
                return LogLevel.INFO;
            case AlertSeverity.INFO:
                return LogLevel.DEBUG;
            default:
                return LogLevel.INFO;
        }
    }
}

/**
 * Email alert channel
 */
export class EmailAlertChannel implements AlertChannel {
    private enabled: boolean;
    private recipients: string[];
    private logger = LoggerService.getInstance();

    constructor(recipients: string[] = [], enabled = true) {
        this.recipients = recipients;
        this.enabled = enabled;
    }

    async sendAlert(alert: AlertData): Promise<boolean> {
        if (!this.enabled || this.recipients.length === 0) {
            return false;
        }

        // In a real implementation, this would send an email
        // For now, we'll just log it
        this.logger.info(`[EMAIL ALERT] Would send email to ${this.recipients.join(', ')}`, {
            alert_type: alert.type,
            alert_severity: alert.severity,
            alert_title: alert.title,
            alert_message: alert.message
        });

        return true;
    }

    isEnabled(): boolean {
        return this.enabled && this.recipients.length > 0;
    }

    getName(): string {
        return 'email';
    }
}

/**
 * Webhook alert channel
 */
export class WebhookAlertChannel implements AlertChannel {
    private webhookUrl: string;
    private enabled: boolean;
    private logger = LoggerService.getInstance();

    constructor(webhookUrl: string, enabled = true) {
        this.webhookUrl = webhookUrl;
        this.enabled = enabled;
    }

    async sendAlert(alert: AlertData): Promise<boolean> {
        if (!this.enabled || !this.webhookUrl) {
            return false;
        }

        try {
            // In a real implementation, this would make an HTTP request
            // For now, we'll just log it
            this.logger.info(`[WEBHOOK ALERT] Would send webhook to ${this.webhookUrl}`, {
                alert_type: alert.type,
                alert_severity: alert.severity,
                alert_title: alert.title,
                alert_message: alert.message
            });

            return true;
        } catch (error) {
            this.logger.error(`Failed to send webhook alert: ${error}`);
            return false;
        }
    }

    isEnabled(): boolean {
        return this.enabled && !!this.webhookUrl;
    }

    getName(): string {
        return 'webhook';
    }
}

/**
 * Alerting service for sending notifications
 */
export class AlertingService {
    private static instance: AlertingService;
    private channels: AlertChannel[] = [];
    private logger = LoggerService.getInstance();

    private constructor() {
        // Add default console channel
        this.channels.push(new ConsoleAlertChannel());
    }

    /**
     * Get singleton instance of the alerting service
     */
    public static getInstance(): AlertingService {
        if (!AlertingService.instance) {
            AlertingService.instance = new AlertingService();
        }
        return AlertingService.instance;
    }

    /**
     * Add an alert channel
     */
    public addChannel(channel: AlertChannel): void {
        if (!this.channels.some(c => c.getName() === channel.getName())) {
            this.channels.push(channel);
        }
    }

    /**
     * Send an alert to all enabled channels
     */
    public async sendAlert(alertData: Omit<AlertData, 'timestamp'>): Promise<void> {
        const timestamp = new Date();
        const alert: AlertData = {
            ...alertData,
            timestamp
        };

        for (const channel of this.channels) {
            if (channel.isEnabled()) {
                try {
                    await channel.sendAlert(alert);
                } catch (error) {
                    this.logger.error(`Failed to send alert through channel ${channel.getName()}: ${error}`);
                }
            }
        }
    }

    /**
     * Create and send a critical alert
     */
    public async sendCriticalAlert(
        title: string,
        message: string,
        type: AlertType,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.sendAlert({
            title,
            message,
            type,
            severity: AlertSeverity.CRITICAL,
            source: 'workflow-engine',
            metadata
        });
    }

    /**
     * Create and send a high severity alert
     */
    public async sendHighAlert(
        title: string,
        message: string,
        type: AlertType,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.sendAlert({
            title,
            message,
            type,
            severity: AlertSeverity.HIGH,
            source: 'workflow-engine',
            metadata
        });
    }

    /**
     * Create and send a medium severity alert
     */
    public async sendMediumAlert(
        title: string,
        message: string,
        type: AlertType,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.sendAlert({
            title,
            message,
            type,
            severity: AlertSeverity.MEDIUM,
            source: 'workflow-engine',
            metadata
        });
    }

    /**
     * Create and send a low severity alert
     */
    public async sendLowAlert(
        title: string,
        message: string,
        type: AlertType,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.sendAlert({
            title,
            message,
            type,
            severity: AlertSeverity.LOW,
            source: 'workflow-engine',
            metadata
        });
    }
} 
