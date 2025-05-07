# Plan for First Working Flow Implementation

## Overview
This plan outlines the steps needed to create a complete workflow from a WhatsApp message to an agent response:
1. Create and save a workflow using the frontend editor
2. Process incoming WhatsApp webhooks 
3. Execute agent nodes
4. Send responses back to WhatsApp

## 1. Frontend Workflow Editor Enhancements
- [x] Implement basic flow canvas
- [x] Create node configuration dialog
- [ ] Add WhatsApp trigger node type
- [ ] Add Agent node type
- [ ] Add Response node type for sending messages back
- [ ] Implement save functionality to persist workflows to Supabase

## 2. Backend Workflow Processing
- [x] Implement scheduled event handling
- [x] Create webhook routes
- [ ] Update database schema to support WhatsApp-specific metadata
- [ ] Implement workflow execution with agent nodes

## 3. WhatsApp Integration
- [x] Set up WhatsApp API client in whatsapp-service
- [ ] Create WhatsApp client in workflows service
- [ ] Implement message sending functionality
- [ ] Connect webhook processing to workflow execution

## 4. Agent Node Implementation
- [ ] Create agent node type in workflow execution engine
- [ ] Implement connection to LLM (Gemini 2.0)
- [ ] Define agent prompts and response handling
- [ ] Set up context management for conversations

## 5. Implementation Steps

### Step 1: Create WhatsApp Client in Workflows Service
1. Create a new WhatsApp client class in workflows service similar to whatsapp-service
2. Implement message sending capabilities
3. Configure environment variables for WhatsApp API credentials

### Step 2: Update Frontend Node Types
1. Add WhatsApp trigger node with configuration options
2. Add Agent node with model selection and prompt configuration
3. Add Response node to handle sending messages back

### Step 3: Implement Workflow Persistence
1. Ensure workflows can be saved from frontend to Supabase
2. Add validation for required node configurations
3. Implement proper error handling for save operations

### Step 4: Connect Webhook Processing to Workflow Execution
1. Process incoming webhooks from WhatsApp
2. Match webhook to corresponding workflow trigger
3. Start workflow execution with message content

### Step 5: Implement Agent Node Execution
1. Create agent node execution logic
2. Connect to LLM API
3. Process agent results and pass to next nodes

### Step 6: Complete the Response Flow
1. Implement response node execution
2. Send processed agent responses back to WhatsApp
3. Handle any errors in the response process

## 6. Testing Plan
1. Test workflow creation and saving
2. Test webhook reception and processing
3. Test agent node execution
4. Test response delivery to WhatsApp
5. End-to-end test with actual WhatsApp messages

## 7. Required Components to Build

### WhatsApp Client for Workflows Service
```typescript
// Location: apps/workflows/src/infrastructure/clients/whatsapp.ts
import { WhatsAppAPI } from "whatsapp-api-js";
import { Text } from "whatsapp-api-js/messages";

export class WhatsAppClient {
  private client: WhatsAppAPI;
  private phoneNumberId: string;

  constructor(
    accessToken: string,
    appSecret: string,
    webhookVerifyToken: string,
    phoneNumberId: string
  ) {
    // Initialize WhatsApp API client
    this.client = new WhatsAppAPI({
      token: accessToken,
      appSecret: appSecret,
      webhookVerifyToken: webhookVerifyToken,
      v: "v22.0"
    });

    this.phoneNumberId = phoneNumberId;
  }

  /**
   * Send a text message to a WhatsApp user
   */
  public async sendMessage(to: string, text: string): Promise<void> {
    try {
      const message = new Text(text);
      await this.client.sendMessage(this.phoneNumberId, to, message);
      console.log(`Message sent to ${to}`);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      throw error;
    }
  }
}
```

### Node Types for Frontend
- WhatsApp Trigger Node
- Agent Node
- Response Node

### Database Schema Updates
- Add support for conversation context
- Store agent configurations
- Track message history
