# Webhook Trigger Testing Guide

## Overview

The webhook trigger node has been updated to be compatible with the workflow engine running on `http://localhost:3005`. This guide shows you how to create and test a simple workflow.

## Quick Test Setup

### 1. Create a Simple Workflow

1. Go to the workflow editor in your frontend
2. Add a **Webhook Trigger** node (find it in the trigger nodes section)
3. Configure the webhook trigger:

   - **Name**: "Test Webhook"
   - **Webhook ID**: Click "Generate" to create a unique ID (e.g., `webhook-1234567890-abc123`)
   - **Description**: "Simple test webhook"
   - **Secret Key**: (optional) "my-secret-key"

4. Add an **HTTP Request** node and connect it to the webhook trigger
5. Configure the HTTP request:

   - **Name**: "Log to webhook.site"
   - **URL**: `https://webhook.site/your-unique-url` (get from webhook.site)
   - **Method**: POST
   - **Body**: `{"received": "{{trigger.data}}", "timestamp": "{{timestamp}}"}`

6. Save the workflow

### 2. Test the Webhook

Once your workflow is created and saved, you can test it:

#### Using curl:

```bash
curl -X POST http://localhost:3005/webhooks/webhook-1234567890-abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "event": "test",
    "data": {
      "message": "Hello from webhook test!",
      "user": "test-user"
    }
  }'
```

#### Using Postman:

- **Method**: POST
- **URL**: `http://localhost:3005/webhooks/webhook-1234567890-abc123`
- **Headers**:
  - `Content-Type: application/json`
- **Body** (raw JSON):

```json
{
  "event": "test",
  "data": {
    "message": "Hello from webhook test!",
    "user": "test-user"
  }
}
```

### 3. Check Results

1. **Workflow Execution**: Check your workflow engine logs at `http://localhost:3005` to see if the execution started
2. **HTTP Request Result**: Check webhook.site to see if the HTTP request was made successfully
3. **Execution History**: View the workflow execution history in the frontend

## API Endpoints

The workflow engine provides these endpoints:

- **Webhook Trigger**: `POST http://localhost:3005/webhooks/{webhookId}`
- **List Workflows**: `GET http://localhost:3005/api/workflows`
- **Get Workflow**: `GET http://localhost:3005/api/workflows/{workflowId}`
- **List Executions**: `GET http://localhost:3005/api/workflows/{workflowId}/executions`

## Expected Response

When you trigger the webhook successfully, you should get a response like:

```json
{
  "success": true,
  "executionId": "exec-1234567890-abc123",
  "message": "Workflow execution started"
}
```

## Troubleshooting

1. **Webhook Not Found**: Make sure the webhook ID matches exactly
2. **Workflow Engine Not Running**: Check that `localhost:3005` is accessible
3. **Invalid JSON**: Ensure your request body is valid JSON
4. **Missing Content-Type**: Always include `Content-Type: application/json`

## Example Simple Workflow Structure

```json
{
  "name": "Simple Webhook Test",
  "description": "Test webhook trigger with HTTP request",
  "trigger": {
    "type": "webhook",
    "webhookId": "webhook-1234567890-abc123"
  },
  "steps": {
    "log-request": {
      "type": "http-request",
      "url": "https://webhook.site/your-url",
      "method": "POST",
      "body": "{\"received\": \"{{trigger.data}}\"}"
    }
  }
}
```
