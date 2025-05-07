import { WhatsAppAPI } from "whatsapp-api-js";
import { Text } from "whatsapp-api-js/messages";
import { MonitoringService } from "../monitoring/monitoring.js";

/**
 * WhatsApp client options
 */
export interface WhatsAppClientOptions {
    accessToken: string;
    appSecret: string;
    webhookVerifyToken: string;
    phoneNumberId: string;
}

/**
 * WhatsApp client for sending messages from workflows
 */
export class WhatsAppClient {
    private client: WhatsAppAPI;
    private phoneNumberId: string;
    private monitoringService: MonitoringService;

    /**
     * Create a new WhatsApp client
     */
    constructor(options: WhatsAppClientOptions) {
        this.monitoringService = MonitoringService.getInstance();

        // Initialize WhatsApp API client
        this.client = new WhatsAppAPI({
            token: options.accessToken,
            appSecret: options.appSecret,
            webhookVerifyToken: options.webhookVerifyToken,
            v: "v22.0"
        });

        this.phoneNumberId = options.phoneNumberId;
    }

    /**
     * Send a text message to a WhatsApp user
     */
    public async sendMessage(to: string, text: string): Promise<string> {
        const startTime = Date.now();

        try {
            // Create text message
            const message = new Text(text);

            // Send message using WhatsApp API
            const result = await this.client.sendMessage(this.phoneNumberId, to, message);

            // Track successful message send
            this.monitoringService.trackApiRequest(
                'whatsapp_send_message',
                'POST',
                200,
                Date.now() - startTime
            );

            console.log(`WhatsApp message sent to ${to}`);

            // Return message ID
            return result.messages?.[0]?.id || '';
        } catch (error) {
            // Track failed message send
            this.monitoringService.trackApiRequest(
                'whatsapp_send_message',
                'POST',
                500,
                Date.now() - startTime
            );

            console.error("Error sending WhatsApp message:", error);
            throw error;
        }
    }
}

/**
 * Create a WhatsApp client from environment variables
 */
export function createWhatsAppClient(): WhatsAppClient {
    // Get configuration from environment variables
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    const appSecret = process.env.WHATSAPP_APP_SECRET || '';
    const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    // Validate configuration
    if (!accessToken || !appSecret || !webhookVerifyToken || !phoneNumberId) {
        throw new Error('Missing WhatsApp API configuration in environment variables');
    }

    // Create and return client
    return new WhatsAppClient({
        accessToken,
        appSecret,
        webhookVerifyToken,
        phoneNumberId
    });
}

// Create singleton instance
let whatsappClientInstance: WhatsAppClient | null = null;

/**
 * Get the WhatsApp client instance
 */
export function getWhatsAppClient(): WhatsAppClient {
    if (!whatsappClientInstance) {
        whatsappClientInstance = createWhatsAppClient();
    }
    return whatsappClientInstance;
} 
