/**
 * Node registry setup for the workflow engine
 * This module provides a centralized way to register all available nodes
 */

import { NodeRegistry } from "./registry.js";
import type { TriggerNode, ActionNode } from "../types/index.js";
import { ExecutionContext } from "./context.js";

// Webhook Trigger Implementation
class WebhookTrigger implements TriggerNode {
  name = "webhook";
  displayName = "Webhook Trigger";
  description = "Triggered by incoming webhook";
  version = "1.0.0";
  category = "triggers";

  async execute(settings: Record<string, any>, context: ExecutionContext) {
    return {
      success: true,
      output: {
        webhookData: context.triggerPayload,
        receivedAt: new Date().toISOString(),
        webhookUrl: settings.webhookUrl
      },
      metadata: {
        triggerType: "webhook"
      }
    };
  }
}

// Manual Trigger Implementation
class ManualTrigger implements TriggerNode {
  name = "manual";
  displayName = "Manual Trigger";
  description = "Manually triggered workflow";
  version = "1.0.0";
  category = "triggers";

  async execute(settings: Record<string, any>, context: ExecutionContext) {
    return {
      success: true,
      output: {
        manualData: context.triggerPayload,
        triggeredAt: new Date().toISOString(),
        triggeredBy: settings.triggeredBy || "system"
      },
      metadata: {
        triggerType: "manual"
      }
    };
  }
}

// HTTP Request Action Implementation
class HttpRequestAction implements ActionNode {
  name = "http-request";
  displayName = "HTTP Request";
  description = "Makes an HTTP request";
  version = "1.0.0";
  category = "actions";

  async execute(settings: Record<string, any>, context: ExecutionContext) {
    const url = context.resolveValue(settings.url);
    const method = settings.method || "GET";
    const headers = settings.headers || {};
    const body = settings.body
      ? context.resolveValue(settings.body)
      : undefined;

    try {
      console.log(`[HTTP REQUEST]: ${method} ${url}`);

      // In a real implementation, you would make the actual HTTP request
      // For now, we'll simulate it
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          message: "Mock HTTP response",
          receivedData: body,
          timestamp: new Date().toISOString()
        }
      };

      return {
        success: true,
        output: mockResponse,
        metadata: {
          actionType: "http-request",
          url,
          method
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "HTTP request failed",
        output: null
      };
    }
  }
}

// Data Transformer Action Implementation
class DataTransformerAction implements ActionNode {
  name = "data-transformer";
  displayName = "Data Transformer";
  description = "Transforms data using JavaScript";
  version = "1.0.0";
  category = "utilities";

  async execute(settings: Record<string, any>, context: ExecutionContext) {
    const inputData = context.resolveValue(settings.inputData);
    const transformScript = settings.transformScript;

    try {
      console.log(`[DATA TRANSFORMER]: Processing data`);

      let result;
      if (transformScript) {
        // In a real implementation, use a safer sandbox like vm2
        const transformFunction = new Function(
          "data",
          "context",
          transformScript
        );
        result = transformFunction(inputData, {
          trigger: context.triggerPayload,
          steps: context.getResults()
        });
      } else {
        // Default transformation
        result = {
          transformed: true,
          originalData: inputData,
          processedAt: new Date().toISOString()
        };
      }

      return {
        success: true,
        output: result,
        metadata: {
          actionType: "data-transformer",
          inputType: typeof inputData,
          outputType: typeof result
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Transformation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        output: null
      };
    }
  }
}

// Log Action Implementation
class LogAction implements ActionNode {
  name = "log";
  displayName = "Log Action";
  description = "Logs data to console or external logging service";
  version = "1.0.0";
  category = "utilities";

  async execute(settings: Record<string, any>, context: ExecutionContext) {
    const message = context.resolveValue(settings.message);
    const level = settings.level || "info";
    const data = settings.data
      ? context.resolveValue(settings.data)
      : undefined;

    try {
      console.log(`[LOG ${level.toUpperCase()}]:`, message);
      if (data) {
        console.log(`[LOG DATA]:`, JSON.stringify(data, null, 2));
      }

      return {
        success: true,
        output: {
          logged: true,
          message,
          level,
          data,
          timestamp: new Date().toISOString()
        },
        metadata: {
          actionType: "log",
          level
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Log action failed",
        output: null
      };
    }
  }
}

// Delay Action Implementation
class DelayAction implements ActionNode {
  name = "delay";
  displayName = "Delay Action";
  description = "Waits for a specified amount of time";
  version = "1.0.0";
  category = "utilities";

  async execute(settings: Record<string, any>, context: ExecutionContext) {
    const delayMs = Number(context.resolveValue(settings.delayMs)) || 1000;
    const maxDelay = 60000; // 1 minute max delay for safety

    try {
      const actualDelay = Math.min(delayMs, maxDelay);
      console.log(`[DELAY]: Waiting ${actualDelay}ms`);

      await new Promise((resolve) => setTimeout(resolve, actualDelay));

      return {
        success: true,
        output: {
          delayed: true,
          delayMs: actualDelay,
          completedAt: new Date().toISOString()
        },
        metadata: {
          actionType: "delay",
          delayMs: actualDelay
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Delay action failed",
        output: null
      };
    }
  }
}

/**
 * Create and setup a node registry with all essential nodes
 */
export function createNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();

  // Register trigger nodes
  registry.registerTrigger("webhook", new WebhookTrigger());
  registry.registerTrigger("manual", new ManualTrigger());

  // Register action nodes
  registry.registerAction("http-request", new HttpRequestAction());
  registry.registerAction("data-transformer", new DataTransformerAction());
  registry.registerAction("log", new LogAction());
  registry.registerAction("delay", new DelayAction());

  return registry;
}

/**
 * Get the list of all available node types
 */
export function getAvailableNodes() {
  const registry = createNodeRegistry();
  return {
    triggers: registry.listTriggers(),
    actions: registry.listActions()
  };
}
