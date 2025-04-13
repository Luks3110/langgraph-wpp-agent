import { randomUUID } from 'crypto';
import winston from 'winston';

/**
 * Log level enum
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
    VERBOSE = 'verbose',
    HTTP = 'http'
}

/**
 * Log level type
 */
export type LogLevelString = 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'http';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
    level?: LogLevelString;
    service?: string;
}

/**
 * Log metadata type with additional context information
 */
export interface LogMetadata {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
    eventType?: string;
    queueName?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
    error?: Error | unknown;
    [key: string]: any;
}

/**
 * Service for structured logging in the workflow engine
 */
export class LoggerService {
    private static instance: LoggerService;
    private logger: winston.Logger = winston.createLogger(); // Initialize with empty logger

    private constructor(options?: LoggerOptions) {
        this.configureLogger(options);
    }

    /**
     * Get singleton instance of LoggerService
     */
    public static getInstance(options?: LoggerOptions): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService(options);
        }
        return LoggerService.instance;
    }

    /**
     * Configure the Winston logger
     */
    private configureLogger(options?: LoggerOptions): void {
        const { combine, timestamp, printf, colorize, json } = winston.format;

        // Custom format for development - fix the TypeScript error by properly typing
        const devFormat = printf((info) => {
            // Extract fields we need
            const { level, message, timestamp, ...metadata } = info;

            const metaString = Object.keys(metadata).length > 0
                ? `\n${JSON.stringify(metadata, null, 2)}`
                : '';

            return `${timestamp} [${level}]: ${message}${metaString}`;
        });

        // Use different formats based on environment
        const isProd = process.env.NODE_ENV === 'production';
        const format = isProd
            ? combine(timestamp(), json())
            : combine(timestamp(), colorize(), devFormat);

        this.logger = winston.createLogger({
            level: options?.level || process.env.LOG_LEVEL || 'info',
            format,
            defaultMeta: {
                service: options?.service || 'workflow-engine',
            },
            transports: [
                new winston.transports.Console(),
            ],
        });

        // Add file transport in production
        if (isProd) {
            this.logger.add(
                new winston.transports.File({
                    filename: 'logs/workflow-error.log',
                    level: 'error'
                })
            );

            this.logger.add(
                new winston.transports.File({
                    filename: 'logs/workflow-combined.log'
                })
            );
        }
    }

    /**
     * Log a message with the specified level
     */
    private log(level: LogLevelString, message: string, metadata: LogMetadata = {}): void {
        // Ensure every log has a correlation ID for tracing
        if (!metadata.correlationId) {
            metadata.correlationId = randomUUID();
        }

        // Extract and format error if present
        if (metadata.error) {
            const error = metadata.error as Error;
            metadata.errorMessage = error.message;
            metadata.stack = error.stack;
            // Delete the original error to avoid circular references
            delete metadata.error;
        }

        this.logger.log(level, message, metadata);
    }

    /**
     * Log an error message
     */
    public error(message: string, metadata: LogMetadata = {}): void {
        this.log('error', message, metadata);
    }

    /**
     * Log a warning message
     */
    public warn(message: string, metadata: LogMetadata = {}): void {
        this.log('warn', message, metadata);
    }

    /**
     * Log an info message
     */
    public info(message: string, metadata: LogMetadata = {}): void {
        this.log('info', message, metadata);
    }

    /**
     * Log a debug message
     */
    public debug(message: string, metadata: LogMetadata = {}): void {
        this.log('debug', message, metadata);
    }

    /**
     * Log a verbose message
     */
    public verbose(message: string, metadata: LogMetadata = {}): void {
        this.log('verbose', message, metadata);
    }

    /**
     * Log an HTTP message
     */
    public http(message: string, metadata: LogMetadata = {}): void {
        this.log('http', message, metadata);
    }

    /**
     * Log event publishing
     */
    public logEventPublished(eventType: string, metadata: LogMetadata = {}): void {
        this.info(`Event published: ${eventType}`, {
            ...metadata,
            eventType,
            action: 'event_published',
        });
    }

    /**
     * Generic event logging method for backward compatibility
     */
    public logEvent(eventType: string, action: string, metadata: LogMetadata = {}): void {
        this.info(`Event ${action}: ${eventType}`, {
            ...metadata,
            eventType,
            action: `event_${action}`,
        });
    }

    /**
     * Log event processing
     */
    public logEventProcessed(
        eventType: string,
        duration: number,
        metadata: LogMetadata = {}
    ): void {
        this.info(`Event processed: ${eventType}`, {
            ...metadata,
            eventType,
            duration,
            action: 'event_processed',
        });
    }

    /**
     * Log event processing failure
     */
    public logEventFailed(
        eventType: string,
        error: Error | unknown,
        metadata: LogMetadata = {}
    ): void {
        this.error(`Event processing failed: ${eventType}`, {
            ...metadata,
            eventType,
            error,
            action: 'event_failed',
        });
    }

    /**
     * Log queue job processing
     */
    public logQueueJob(
        queueName: string,
        status: 'added' | 'processed' | 'failed',
        metadata: LogMetadata = {}
    ): void {
        const action = `queue_job_${status}`;
        const message = `Queue job ${status}: ${queueName}`;

        if (status === 'failed') {
            this.error(message, {
                ...metadata,
                queueName,
                action,
            });
        } else {
            this.info(message, {
                ...metadata,
                queueName,
                action,
            });
        }
    }

    /**
     * Log API request
     */
    public logApiRequest(
        path: string,
        method: string,
        statusCode: number,
        duration: number,
        metadata: LogMetadata = {}
    ): void {
        const action = 'api_request';
        const message = `${method} ${path} ${statusCode} ${duration}ms`;
        const level: LogLevelString = statusCode >= 500
            ? 'error'
            : statusCode >= 400
                ? 'warn'
                : 'info';

        this.log(level, message, {
            ...metadata,
            path,
            method,
            statusCode,
            duration,
            action,
        });
    }

    /**
     * Log system startup
     */
    public logSystemStartup(metadata: LogMetadata = {}): void {
        this.info('Workflow engine starting', {
            ...metadata,
            action: 'system_startup',
        });
    }

    /**
     * Log system shutdown
     */
    public logSystemShutdown(metadata: LogMetadata = {}): void {
        this.info('Workflow engine shutting down', {
            ...metadata,
            action: 'system_shutdown',
        });
    }
} 
