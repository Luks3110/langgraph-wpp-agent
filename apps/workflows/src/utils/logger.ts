/**
 * Logger utility for workflow engine
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  message: string;
  context?: string;
  data?: any;
  executionId?: string;
  workflowId?: string;
}

export class Logger {
  private minLevel: LogLevel;
  private context?: string;

  constructor(context?: string, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext, this.minLevel);
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Debug level logging
   */
  debug(
    message: string,
    data?: any,
    executionId?: string,
    workflowId?: string
  ): void {
    this.log(LogLevel.DEBUG, message, data, executionId, workflowId);
  }

  /**
   * Info level logging
   */
  info(
    message: string,
    data?: any,
    executionId?: string,
    workflowId?: string
  ): void {
    this.log(LogLevel.INFO, message, data, executionId, workflowId);
  }

  /**
   * Warning level logging
   */
  warn(
    message: string,
    data?: any,
    executionId?: string,
    workflowId?: string
  ): void {
    this.log(LogLevel.WARN, message, data, executionId, workflowId);
  }

  /**
   * Error level logging
   */
  error(
    message: string,
    data?: any,
    executionId?: string,
    workflowId?: string
  ): void {
    this.log(LogLevel.ERROR, message, data, executionId, workflowId);
  }

  /**
   * Log execution start
   */
  executionStart(
    executionId: string,
    workflowId: string,
    workflowName: string
  ): void {
    this.info(
      `Starting workflow execution`,
      {
        workflowName,
        action: "execution_start"
      },
      executionId,
      workflowId
    );
  }

  /**
   * Log execution completion
   */
  executionComplete(
    executionId: string,
    workflowId: string,
    duration: number,
    success: boolean
  ): void {
    this.info(
      `Workflow execution ${success ? "completed" : "failed"}`,
      {
        duration,
        success,
        action: "execution_complete"
      },
      executionId,
      workflowId
    );
  }

  /**
   * Log step execution
   */
  stepExecution(
    executionId: string,
    workflowId: string,
    stepName: string,
    stepType: string,
    duration?: number
  ): void {
    this.debug(
      `Executing step: ${stepName}`,
      {
        stepType,
        duration,
        action: "step_execution"
      },
      executionId,
      workflowId
    );
  }

  /**
   * Log step completion
   */
  stepComplete(
    executionId: string,
    workflowId: string,
    stepName: string,
    success: boolean,
    duration?: number
  ): void {
    this.debug(
      `Step ${success ? "completed" : "failed"}: ${stepName}`,
      {
        success,
        duration,
        action: "step_complete"
      },
      executionId,
      workflowId
    );
  }

  /**
   * Main logging method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    executionId?: string,
    workflowId?: string
  ): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      message: this.context ? `[${this.context}] ${message}` : message,
      context: this.context,
      data,
      executionId,
      workflowId
    };

    // Output to console with appropriate method
    const output = this.formatLogEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }

  /**
   * Format log entry for console output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);

    let formatted = `${timestamp} ${level} ${entry.message}`;

    if (entry.executionId) {
      formatted += ` [exec:${entry.executionId}]`;
    }

    if (entry.workflowId) {
      formatted += ` [workflow:${entry.workflowId}]`;
    }

    if (entry.data) {
      formatted += ` ${JSON.stringify(entry.data)}`;
    }

    return formatted;
  }
}

// Default logger instance
export const logger = new Logger("workflow-engine");

// Execution-specific logger factory
export function createExecutionLogger(
  executionId: string,
  workflowId: string
): Logger {
  const execLogger = logger.child(`exec:${executionId.slice(-8)}`);
  return execLogger;
}
