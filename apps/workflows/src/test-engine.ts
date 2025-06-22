/**
 * Real-world test to verify workflow engine with BullMQ and Supabase integration
 */

import {
  NodeRegistry,
  WorkflowExecutor,
  ExecutionContext
} from "./engine/index.js";
import { createNodeRegistry, getAvailableNodes } from "./engine/node-setup.js";
import { WorkflowService, WebhookService } from "./database/workflows.js";
import { ExecutionService } from "./database/executions.js";
import { QueueManager, workflowWorker, stepWorker } from "./engine/queue.js";
import type {
  WorkflowDefinition,
  TriggerNode,
  ActionNode
} from "./types/index.js";
import { logger } from "./utils/logger.js";

// Test function with real-world integration
export async function testWorkflowEngineIntegration() {
  console.log(
    "🧪 Testing Workflow Engine with BullMQ & Supabase Integration...\n"
  );

  try {
    // 1. Initialize node registry and services
    const registry = createNodeRegistry();
    const availableNodes = getAvailableNodes();

    console.log("✅ Node registry initialized with nodes:", availableNodes);

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const webhookService = new WebhookService();
    const queueManager = new QueueManager();

    console.log("✅ Services initialized");

    // 2. Create a real-world workflow definition
    const testWorkflow: WorkflowDefinition = {
      id: "integration-test-workflow",
      name: "E-commerce Order Processing",
      description: "Process incoming e-commerce orders via webhook",
      version: 1,
      trigger: {
        name: "order-webhook",
        displayName: "Order Webhook",
        type: "TRIGGER",
        triggerType: "webhook",
        nextAction: "transform-order",
        settings: {
          webhookUrl: "/webhooks/order-processing"
        }
      },
      steps: {
        "transform-order": {
          name: "transform-order",
          displayName: "Transform Order Data",
          type: "ACTION",
          actionType: "data-transformer",
          settings: {
            inputData: "{{order-webhook.output.webhookData}}",
            transformScript: `
              // Extract webhook data from the input
              const webhookData = data.webhook;
              if (!webhookData) {
                throw new Error("No webhook data found in input");
              }
              
              return {
                orderId: webhookData.order_id,
                customerEmail: webhookData.customer.email,
                totalAmount: webhookData.total_amount,
                currency: webhookData.currency,
                items: webhookData.items.map(item => ({
                  sku: item.sku,
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price
                })),
                shippingAddress: webhookData.shipping_address,
                processedAt: new Date().toISOString()
              };
            `
          },
          nextAction: "log-order"
        },
        "log-order": {
          name: "log-order",
          displayName: "Log Order Processing",
          type: "ACTION",
          actionType: "log",
          settings: {
            message: "Order processed successfully",
            level: "info",
            data: "{{transform-order.output}}"
          },
          nextAction: "notify-fulfillment"
        },
        "notify-fulfillment": {
          name: "notify-fulfillment",
          displayName: "Notify Fulfillment Service",
          type: "ACTION",
          actionType: "http-request",
          settings: {
            url: "https://api.fulfillment.example.com/orders",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer {{env.FULFILLMENT_API_KEY}}"
            },
            body: "{{transform-order.output}}"
          }
        }
      }
    };

    // 3. Create workflow in database
    console.log("📋 Creating workflow in database...");
    const createdWorkflow = await workflowService.createWorkflow(testWorkflow);
    console.log(`✅ Workflow created with ID: ${createdWorkflow.id}`);

    // 4. Register webhook trigger
    console.log("🔗 Registering webhook trigger...");
    await workflowService.registerWebhookTrigger(createdWorkflow.id, {
      webhookUrl: "/webhooks/order-processing"
    });
    console.log("✅ Webhook trigger registered");

    // 5. Simulate webhook payload
    const webhookPayload = {
      webhook: {
        order_id: "ORD-2024-001",
        customer: {
          email: "customer@example.com",
          name: "John Doe"
        },
        total_amount: 99.99,
        currency: "USD",
        items: [
          {
            sku: "WIDGET-001",
            name: "Super Widget",
            quantity: 2,
            price: 29.99
          },
          {
            sku: "GADGET-002",
            name: "Magic Gadget",
            quantity: 1,
            price: 39.99
          }
        ],
        shipping_address: {
          street: "123 Main St",
          city: "Anytown",
          state: "CA",
          zip: "12345"
        }
      },
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "sha256=abc123"
      },
      method: "POST",
      timestamp: new Date().toISOString()
    };

    // 6. Process webhook (this will create execution and add to queue)
    console.log("📨 Processing incoming webhook...");
    const webhookResult = await webhookService.handleWebhook(
      createdWorkflow.id,
      {
        payload: webhookPayload.webhook,
        headers: webhookPayload.headers,
        method: webhookPayload.method,
        url: "/webhooks/order-processing",
        timestamp: webhookPayload.timestamp
      }
    );

    if (webhookResult.success) {
      console.log(
        `✅ Webhook processed successfully. Execution ID: ${webhookResult.executionId}`
      );
    } else {
      console.error(`❌ Webhook processing failed: ${webhookResult.error}`);
      return;
    }

    // 7. Wait for queue processing
    console.log("⏳ Waiting for queue processing...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 8. Check execution status
    console.log("📊 Checking execution results...");
    const executions = await executionService.listExecutions({
      workflowId: createdWorkflow.id,
      limit: 1
    });

    if (executions.length > 0) {
      const execution = executions[0];
      console.log(`Execution Status: ${execution.status}`);
      console.log(`Started: ${execution.started_at}`);
      console.log(`Completed: ${execution.completed_at}`);

      if (execution.step_results) {
        console.log("\n📄 Step Results:");
        const stepResults = execution.step_results as any;
        Object.entries(stepResults).forEach(
          ([stepName, result]: [string, any]) => {
            console.log(`  ${stepName}:`, {
              success: result.success,
              output: result.output
                ? JSON.stringify(result.output, null, 2)
                : "No output",
              error: result.error
            });
          }
        );
      }

      // Get detailed execution steps
      const steps = await executionService.getExecutionSteps(execution.id);
      if (steps.length > 0) {
        console.log("\n🔍 Detailed Step Information:");
        steps.forEach((step) => {
          console.log(`  Step: ${step.step_name} (${step.step_type})`);
          console.log(`    Status: ${step.status}`);
          console.log(
            `    Duration: ${step.started_at} - ${step.completed_at}`
          );
          if (step.error_message) {
            console.log(`    Error: ${step.error_message}`);
          }
        });
      }
    }

    // 9. Test queue statistics
    console.log("\n📈 Queue Statistics:");
    const queueStats = await queueManager.getQueueStats();
    console.log("Workflow Queue:", queueStats.workflow);
    console.log("Step Queue:", queueStats.step);

    // 10. Test workflow listing
    console.log("\n📋 Workflow Listing:");
    const workflows = await workflowService.listWorkflows({ limit: 5 });
    workflows.forEach((wf) => {
      console.log(`  ${wf.name} (${wf.id}) - Status: ${wf.status}`);
    });

    // 11. Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await workflowService.deleteWorkflow(createdWorkflow.id);
    console.log("✅ Test workflow deleted");

    console.log("\n🎉 Integration test completed successfully!");
  } catch (error) {
    console.error("❌ Integration test failed:", error);
    logger.error("Integration test error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  } finally {
    // Ensure workers are closed
    await workflowWorker.close();
    await stepWorker.close();
    process.exit(0);
  }
}

// Test function for manual execution (without queue)
export async function testDirectExecution() {
  console.log("🧪 Testing Direct Workflow Execution...\n");

  const registry = createNodeRegistry();
  const executor = new WorkflowExecutor(registry);

  const simpleWorkflow: WorkflowDefinition = {
    id: "direct-test-workflow",
    name: "Direct Test Workflow",
    description: "Simple workflow for direct execution testing",
    version: 1,
    trigger: {
      name: "webhook-trigger",
      displayName: "Webhook Start",
      type: "TRIGGER",
      triggerType: "webhook",
      nextAction: "transform-data",
      settings: {}
    },
    steps: {
      "transform-data": {
        name: "transform-data",
        displayName: "Transform Data",
        type: "ACTION",
        actionType: "data-transformer",
        settings: {
          inputData: "{{trigger.output.webhookData}}",
          transformScript:
            "return { processed: true, data: data, timestamp: new Date().toISOString() };"
        },
        nextAction: "log-result"
      },
      "log-result": {
        name: "log-result",
        displayName: "Log Result",
        type: "ACTION",
        actionType: "log",
        settings: {
          message: "Direct execution completed",
          level: "info",
          data: "{{transform-data.output}}"
        }
      }
    }
  };

  const result = await executor.execute(simpleWorkflow, {
    webhook: { message: "Hello from direct execution!" },
    source: "test"
  });

  console.log("Direct Execution Result:", {
    success: result.success,
    duration: result.duration,
    steps: result.completedSteps + "/" + result.totalSteps,
    error: result.error
  });

  console.log("\n✅ Direct execution test completed!");
}

// Run appropriate test based on arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  const testType = process.argv[2] || "integration";

  if (testType === "direct") {
    testDirectExecution().catch(console.error);
  } else {
    testWorkflowEngineIntegration().catch(console.error);
  }
}
