import crypto from 'crypto';
import { FacebookMessageHandlerRegistry } from '../handlers/facebookMessageHandlers.js';
import { BaseWebhookProviderAdapterImpl, NormalizedWebhookPayload, WebhookProviderType } from '../providerAdapters.js';

/**
 * Facebook webhook message types
 */
export enum FacebookMessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    FILE = 'file',
    TEMPLATE = 'template',
    FALLBACK = 'fallback'
}

/**
 * Facebook webhook event types
 */
export enum FacebookEventType {
    MESSAGE = 'message',
    MESSAGING_POSTBACK = 'messaging_postback',
    MESSAGE_DELIVERIES = 'message_deliveries',
    MESSAGE_READS = 'message_reads',
    MESSAGING_ACCOUNT_LINKING = 'messaging_account_linking',
    MESSAGING_REFERRALS = 'messaging_referrals',
    MESSAGING_HANDOVERS = 'messaging_handovers',
    MESSAGING_POLICY_ENFORCEMENT = 'messaging_policy_enforcement',
    MESSAGING_FEEDBACK = 'messaging_feedback'
}

/**
 * Facebook webhook provider adapter
 */
export class FacebookWebhookAdapter extends BaseWebhookProviderAdapterImpl {
    private messageHandlerRegistry: FacebookMessageHandlerRegistry;

    constructor() {
        super();
        this.messageHandlerRegistry = new FacebookMessageHandlerRegistry();
    }

    /**
     * Transform Facebook-specific webhook payload to standardized format
     */
    async normalizePayload(
        rawPayload: any,
        headers: Record<string, string>,
        clientId: string
    ): Promise<NormalizedWebhookPayload> {
        // Determine event type
        const eventType = this.determineEventType(rawPayload);

        // Extract customer ID
        const customerId = this.extractCustomerId(rawPayload) || '';

        // Create metadata
        const metadata = this.createMetadata(eventType, headers, clientId);

        return {
            eventType,
            customerId,
            timestamp: Date.now(),
            provider: WebhookProviderType.FACEBOOK,
            data: this.extractNormalizedData(rawPayload, eventType),
            rawPayload,
            metadata
        };
    }

    /**
     * Create metadata object with event information
     */
    private createMetadata(
        eventType: string,
        headers: Record<string, string>,
        clientId: string
    ): Record<string, any> {
        const metadata = this.extractMetadataFromHeaders(headers);

        metadata.source = 'facebook';
        metadata.sourceType = 'webhook';
        metadata.actionType = eventType;
        metadata.clientId = clientId;
        metadata.receivedAt = new Date().toISOString();
        metadata.headers = headers;

        return metadata;
    }

    /**
     * Verify Facebook webhook signature
     * Facebook uses the same signature mechanism as WhatsApp and Instagram (all Meta platforms)
     */
    async verifySignature(
        payload: any,
        headers: Record<string, string>,
        webhookSecret: string
    ): Promise<boolean> {
        // Facebook uses x-hub-signature-256 header for verification
        const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

        if (!signature) {
            return false;
        }

        try {
            // The signature has format "sha256=hash"
            const expectedSignature = signature.startsWith('sha256=')
                ? signature.substring(7)
                : signature;

            // Convert payload to string if it's not already
            const payloadStr = typeof payload === 'string'
                ? payload
                : JSON.stringify(payload);

            // Compute hash
            const hmac = crypto.createHmac('sha256', webhookSecret);
            hmac.update(payloadStr);
            const computedSignature = hmac.digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(computedSignature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            console.error('Error verifying Facebook webhook signature:', error);
            return false;
        }
    }

    /**
     * Handle Facebook webhook verification challenge
     */
    async handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<{ isChallenge: boolean; response?: any }> {
        // Check if this is a challenge request from Facebook
        // Facebook uses the same challenge mechanism as WhatsApp and Instagram
        if (
            payload &&
            payload['hub.mode'] === 'subscribe' &&
            payload['hub.challenge'] &&
            payload['hub.verify_token']
        ) {
            return {
                isChallenge: true,
                response: payload['hub.challenge']
            };
        }

        return { isChallenge: false };
    }

    /**
     * Determine the event type from the Facebook payload
     */
    private determineEventType(payload: any): string {
        if (!payload || !payload.entry || !payload.entry.length) {
            return 'unknown';
        }

        try {
            const entry = payload.entry[0];

            // Check for messaging events
            if (entry.messaging && entry.messaging.length > 0) {
                const messaging = entry.messaging[0];

                // Check specific messaging event types
                if (messaging.message) {
                    return FacebookEventType.MESSAGE;
                }

                if (messaging.postback) {
                    return FacebookEventType.MESSAGING_POSTBACK;
                }

                if (messaging.delivery) {
                    return FacebookEventType.MESSAGE_DELIVERIES;
                }

                if (messaging.read) {
                    return FacebookEventType.MESSAGE_READS;
                }

                if (messaging.account_linking) {
                    return FacebookEventType.MESSAGING_ACCOUNT_LINKING;
                }

                if (messaging.referral) {
                    return FacebookEventType.MESSAGING_REFERRALS;
                }

                if (messaging.handover) {
                    return FacebookEventType.MESSAGING_HANDOVERS;
                }

                if (messaging.policy_enforcement) {
                    return FacebookEventType.MESSAGING_POLICY_ENFORCEMENT;
                }

                if (messaging.feedback) {
                    return FacebookEventType.MESSAGING_FEEDBACK;
                }
            }

            return 'unknown';
        } catch (error) {
            console.error('Error determining Facebook event type:', error);
            return 'unknown';
        }
    }

    /**
     * Extract customer ID from the Facebook payload
     */
    private extractCustomerId(payload: any): string | undefined {
        if (!payload || !payload.entry || !payload.entry.length) {
            return undefined;
        }

        try {
            const entry = payload.entry[0];

            // Extract sender ID from messaging events
            if (entry.messaging && entry.messaging.length > 0) {
                return entry.messaging[0].sender?.id;
            }

            return undefined;
        } catch (error) {
            console.error('Error extracting Facebook customer ID:', error);
            return undefined;
        }
    }

    /**
     * Extract normalized data from the Facebook payload
     */
    private extractNormalizedData(payload: any, eventType: string): Record<string, any> {
        if (!payload || !payload.entry || !payload.entry.length) {
            return {};
        }

        try {
            const normalizedData: Record<string, any> = {};
            const entry = payload.entry[0];

            // Add common data
            if (entry.messaging && entry.messaging.length > 0) {
                const messaging = entry.messaging[0];
                normalizedData.senderId = messaging.sender?.id;
                normalizedData.recipientId = messaging.recipient?.id;
                normalizedData.timestamp = messaging.timestamp;

                // Process the event using the handler registry
                const eventData = this.messageHandlerRegistry.processEvent(eventType, messaging);

                // Merge the processed event data
                Object.assign(normalizedData, eventData);
            }

            return normalizedData;
        } catch (error) {
            console.error('Error extracting normalized Facebook data:', error);
            return {};
        }
    }
} 
