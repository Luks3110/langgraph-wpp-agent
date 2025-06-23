#!/usr/bin/env node
/**
 * Real Webhook Test Script
 * Use this to test your actual webhook endpoint: /webhooks/4dd63d23-379b-4e09-a071-b276d988334a
 */

const WEBHOOK_ID = "webhook-1750649342451-s4ghpb";
const WEBHOOK_URL = `http://localhost:3005/webhooks/${WEBHOOK_ID}`;

// Sample webhook data to send
const WEBHOOK_DATA = {
  message: "Teste outro teste",
  user: {
    id: "user123",
    name: "Test User",
    email: "test@example.com"
  },
  event: "test_event",
  timestamp: new Date().toISOString(),
  data: {
    action: "created",
    resource: "user",
    metadata: {
      source: "test-script",
      version: "1.0"
    }
  }
};

/**
 * Send test webhook
 */
async function sendWebhook() {
  console.log("🚀 Testing webhook endpoint:", WEBHOOK_URL);
  console.log("📤 Sending data:", JSON.stringify(WEBHOOK_DATA, null, 2));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "WebhookTester/1.0",
        "X-Test-Header": "test-value"
      },
      body: JSON.stringify(WEBHOOK_DATA)
    });

    const responseData = await response.json();

    console.log("\n📥 Response:");
    console.log("Status:", response.status, response.statusText);
    console.log("Data:", JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log("\n✅ Webhook sent successfully!");
      console.log("Execution ID:", responseData.executionId);
    } else {
      console.log("\n❌ Webhook failed:");
      console.log("Error:", responseData.error);
    }
  } catch (error) {
    console.log("🚀 ~ sendWebhook ~ error:", error);
    console.error(
      "\n💥 Request failed:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Generate curl command
 */
function showCurlCommand() {
  console.log("\n📋 Equivalent curl command:");
  console.log(`curl -X POST '${WEBHOOK_URL}' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H 'User-Agent: WebhookTester/1.0' \\`);
  console.log(`  -d '${JSON.stringify(WEBHOOK_DATA, null, 2)}'`);
}

/**
 * Show how to fix the workflow configuration
 */
function showWorkflowFix() {
  console.log(
    "\n💡 To fix the 'undefined' log message, ensure your workflow log action is configured like this:"
  );

  const correctLogConfig = {
    type: "log",
    settings: {
      message: "{{trigger.webhook.message}}",
      level: "warn",
      data: "{{trigger.webhook}}"
    }
  };

  console.log("Correct log action configuration:");
  console.log(JSON.stringify(correctLogConfig, null, 2));

  console.log("\n🔧 Key points:");
  console.log("- Use {{trigger.webhook}} to access the webhook payload");
  console.log("- Use {{trigger.webhook.field}} to access specific fields");
  console.log(
    "- You can mix text and expressions: 'Hello {{trigger.webhook.user.name}}'"
  );
  console.log(
    "- The 'data' field can also use expressions for structured logging"
  );
}

// Run the test
async function main() {
  console.log("🧪 Webhook Test Script");
  console.log("======================\n");

  showWorkflowFix();
  showCurlCommand();

  console.log("\n🔄 Sending test webhook...");
  await sendWebhook();
}

main().catch(console.error);
