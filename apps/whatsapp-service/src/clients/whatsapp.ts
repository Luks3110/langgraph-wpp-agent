import { WhatsAppMessage } from "@products-monorepo/shared";
import { EventEmitter } from "events";
import { WhatsAppAPI } from "whatsapp-api-js";
import { Text } from "whatsapp-api-js/messages";
import {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_APP_SECRET,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN
} from "../config/env.js";

/**
 * WhatsApp client for sending messages and handling webhooks
 */
export class WhatsAppClient extends EventEmitter {
  private client: WhatsAppAPI;
  private phoneNumberId: string;

  constructor() {
    super();
    // Initialize WhatsApp API client
    this.client = new WhatsAppAPI({
      token: WHATSAPP_ACCESS_TOKEN,
      appSecret: WHATSAPP_APP_SECRET,
      webhookVerifyToken: WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      v: "v22.0"
    });

    this.phoneNumberId = WHATSAPP_PHONE_NUMBER_ID;

    // Set up message handler
    this.client.on.message = this.handleIncomingMessage.bind(this);
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

  /**
   * Handle incoming WhatsApp messages
   */
  private handleIncomingMessage({ from, message, name }: any): void {
    if (message.type === "text") {
      const whatsappMessage: WhatsAppMessage = {
        from,
        text: message.text.body,
        timestamp: new Date(message.timestamp).getTime(),
        messageId: message.id
      };

      // Emit message event
      this.emit("message", whatsappMessage);
    }
  }

  /**
   * Handle webhook verification request
   */
  public handleWebhookVerification(query: any): string {
    return this.client.get(query);
  }

  /**
   * Process webhook post data
   */
  public async processWebhook(
    body: any,
    rawBody: string,
    signature: string
  ): Promise<boolean> {
    try {
      await this.client.post(body, rawBody, signature);
      return true;
    } catch (error) {
      console.error("Error processing webhook:", error);
      return false;
    }
  }
}

// Export a singleton instance
export const whatsappClient = new WhatsAppClient();
