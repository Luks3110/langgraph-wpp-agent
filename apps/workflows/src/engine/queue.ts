import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { WorkflowExecutor } from "./executor.js";
import { createNodeRegistry } from "./node-setup.js";
import { logger } from "../utils/logger.js";

// Redis connection configuration
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
});

// Workflow execution queue
export const workflowQueue = new Queue("workflow-execution", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    }
  }
});

// Step execution queue (for parallel processing)
export const stepQueue = new Queue("step-execution", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 1000
    }
  }
});

// Worker for processing workflow executions
export const workflowWorker = new Worker(
  "workflow-execution",
  async (job: Job) => {
    const registry = createNodeRegistry();
    const executor = new WorkflowExecutor(registry);
    await executor.processExecution(job);
  },
  {
    connection: redis,
    concurrency: Number(process.env.WORKFLOW_CONCURRENCY) || 5
  }
);

// Worker for processing individual steps
export const stepWorker = new Worker(
  "step-execution",
  async (job: Job) => {
    const registry = createNodeRegistry();
    const executor = new WorkflowExecutor(registry);
    await executor.processStep(job);
  },
  {
    connection: redis,
    concurrency: Number(process.env.STEP_CONCURRENCY) || 10
  }
);

// Event listeners for workflow worker
workflowWorker.on("completed", (job) => {
  logger.info("Workflow execution completed", {
    jobId: job.id,
    workflowId: job.data.workflowId,
    executionId: job.data.executionId,
    duration: job.processedOn ? Date.now() - job.processedOn : undefined
  });
});

workflowWorker.on("failed", (job, err) => {
  logger.error("Workflow execution failed", {
    jobId: job?.id,
    workflowId: job?.data?.workflowId,
    executionId: job?.data?.executionId,
    error: err.message,
    stack: err.stack
  });
});

workflowWorker.on("progress", (job, progress) => {
  logger.debug("Workflow execution progress", {
    jobId: job.id,
    workflowId: job.data.workflowId,
    executionId: job.data.executionId,
    progress
  });
});

// Event listeners for step worker
stepWorker.on("completed", (job) => {
  logger.debug("Step execution completed", {
    jobId: job.id,
    stepName: job.data.stepName,
    executionId: job.data.executionId
  });
});

stepWorker.on("failed", (job, err) => {
  logger.error("Step execution failed", {
    jobId: job?.id,
    stepName: job?.data?.stepName,
    executionId: job?.data?.executionId,
    error: err.message
  });
});

export class QueueManager {
  /**
   * Add a workflow execution job to the queue
   */
  async addWorkflowExecution(
    workflowId: string,
    executionId: string,
    triggerPayload: any,
    options?: JobsOptions
  ): Promise<Job> {
    const jobData = {
      workflowId,
      executionId,
      triggerPayload,
      timestamp: new Date().toISOString()
    };

    logger.info("Adding workflow execution to queue", {
      workflowId,
      executionId,
      payloadSize: JSON.stringify(triggerPayload).length
    });

    return await workflowQueue.add("execute-workflow", jobData, {
      jobId: `workflow-${executionId}`,
      ...options
    });
  }

  /**
   * Add a step execution job to the queue
   */
  async addStepExecution(
    executionId: string,
    stepName: string,
    stepData: any,
    options?: JobsOptions
  ): Promise<Job> {
    const jobData = {
      executionId,
      stepName,
      stepData,
      timestamp: new Date().toISOString()
    };

    return await stepQueue.add("execute-step", jobData, {
      jobId: `step-${executionId}-${stepName}`,
      ...options
    });
  }

  /**
   * Schedule a workflow to run on a cron schedule
   */
  async scheduleWorkflow(
    workflowId: string,
    cronExpression: string,
    triggerPayload: any = {}
  ): Promise<void> {
    const jobData = {
      workflowId,
      triggerPayload: { ...triggerPayload, trigger: "schedule" },
      timestamp: new Date().toISOString()
    };

    logger.info("Scheduling workflow", {
      workflowId,
      cronExpression
    });

    await workflowQueue.add("execute-workflow", jobData, {
      repeat: { pattern: cronExpression },
      jobId: `scheduled-${workflowId}`
    });
  }

  /**
   * Cancel a scheduled workflow
   */
  async cancelScheduledWorkflow(workflowId: string): Promise<void> {
    logger.info("Cancelling scheduled workflow", { workflowId });

    await workflowQueue.removeRepeatable("execute-workflow", {
      jobId: `scheduled-${workflowId}`
    });
  }

  /**
   * Get job status and details
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    const job = await workflowQueue.getJob(jobId);
    return job || null;
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await workflowQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info("Job cancelled", { jobId });
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await workflowQueue.getJob(jobId);
    if (job && job.failedReason) {
      await job.retry();
      logger.info("Job retried", { jobId });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      workflowQueue.getWaiting(),
      workflowQueue.getActive(),
      workflowQueue.getCompleted(),
      workflowQueue.getFailed(),
      workflowQueue.getDelayed()
    ]);

    return {
      workflow: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length
      },
      step: {
        waiting: (await stepQueue.getWaiting()).length,
        active: (await stepQueue.getActive()).length,
        completed: (await stepQueue.getCompleted()).length,
        failed: (await stepQueue.getFailed()).length,
        delayed: (await stepQueue.getDelayed()).length
      }
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const grace = 5000; // 5 seconds grace period

    await Promise.all([
      workflowQueue.clean(maxAge, 100, "completed"),
      workflowQueue.clean(maxAge, 50, "failed"),
      stepQueue.clean(maxAge, 50, "completed"),
      stepQueue.clean(maxAge, 25, "failed")
    ]);

    logger.info("Queue cleanup completed", { maxAge });
  }

  /**
   * Pause queue processing
   */
  async pauseQueue(): Promise<void> {
    await Promise.all([workflowQueue.pause(), stepQueue.pause()]);
    logger.info("Queues paused");
  }

  /**
   * Resume queue processing
   */
  async resumeQueue(): Promise<void> {
    await Promise.all([workflowQueue.resume(), stepQueue.resume()]);
    logger.info("Queues resumed");
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down queue manager");

    await Promise.all([
      workflowWorker.close(),
      stepWorker.close(),
      workflowQueue.close(),
      stepQueue.close(),
      redis.disconnect()
    ]);

    logger.info("Queue manager shutdown complete");
  }
}

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  const queueManager = new QueueManager();
  await queueManager.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  const queueManager = new QueueManager();
  await queueManager.shutdown();
  process.exit(0);
});
