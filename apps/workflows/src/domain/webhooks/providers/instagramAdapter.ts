import crypto from 'crypto';
import { BaseWebhookProviderAdapterImpl, NormalizedWebhookPayload, WebhookProviderType } from '../providerAdapters.js';

/**
 * Instagram webhook message types
 */
export enum InstagramMessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    STORY = 'story',
    CAROUSEL = 'carousel',
    REEL = 'reel'
}

/**
 * Instagram webhook event types
 */
export enum InstagramEventType {
    MESSAGE = 'message',
    COMMENT = 'comment',
    MENTION = 'mention',
    DIRECT = 'direct',
    STORY_MENTION = 'story_mention'
}

/**
 * Instagram webhook provider adapter
 */
export class InstagramWebhookAdapter extends BaseWebhookProviderAdapterImpl {
    constructor() {
        super();
    }

    /**
     * Transform Instagram-specific webhook payload to standardized format
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
            provider: WebhookProviderType.INSTAGRAM,
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

        metadata.source = 'instagram';
        metadata.sourceType = 'webhook';
        metadata.actionType = eventType;
        metadata.clientId = clientId;
        metadata.receivedAt = new Date().toISOString();
        metadata.headers = headers;

        return metadata;
    }

    /**
     * Verify Instagram webhook signature
     * Instagram uses the same signature mechanism as WhatsApp (Meta platform)
     */
    async verifySignature(
        payload: any,
        headers: Record<string, string>,
        webhookSecret: string
    ): Promise<boolean> {
        // Instagram uses x-hub-signature-256 header for verification (same as WhatsApp/Facebook)
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
            console.error('Error verifying Instagram webhook signature:', error);
            return false;
        }
    }

    /**
     * Handle Instagram webhook verification challenge
     */
    async handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<{ isChallenge: boolean; response?: any }> {
        // Check if this is a challenge request from Instagram
        // Instagram uses the same challenge mechanism as WhatsApp/Facebook
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
     * Determine the event type from the Instagram payload
     */
    private determineEventType(payload: any): string {
        if (!payload || !payload.entry || !payload.entry.length) {
            return 'unknown';
        }

        try {
            const entry = payload.entry[0];

            // Check for different Instagram webhook objects
            // Instagram can send various objects like: comments, mentions, messages, etc.

            // Check for direct messages
            if (entry.messaging && entry.messaging.length > 0) {
                return InstagramEventType.DIRECT;
            }

            // Check for comments
            if (entry.changes && entry.changes.length > 0) {
                const change = entry.changes[0];

                if (change.field === 'comments') {
                    return InstagramEventType.COMMENT;
                }

                if (change.field === 'mentions') {
                    return InstagramEventType.MENTION;
                }

                if (change.field === 'story_mentions') {
                    return InstagramEventType.STORY_MENTION;
                }
            }

            return 'unknown';
        } catch (error) {
            console.error('Error determining Instagram event type:', error);
            return 'unknown';
        }
    }

    /**
     * Extract customer ID from the Instagram payload
     */
    private extractCustomerId(payload: any): string | undefined {
        if (!payload || !payload.entry || !payload.entry.length) {
            return undefined;
        }

        try {
            const entry = payload.entry[0];

            // Extract sender ID from direct messages
            if (entry.messaging && entry.messaging.length > 0) {
                return entry.messaging[0].sender.id;
            }

            // Extract user ID from comments
            if (entry.changes && entry.changes.length > 0) {
                const change = entry.changes[0];

                if (change.value && change.value.from) {
                    return change.value.from.id;
                }
            }

            return undefined;
        } catch (error) {
            console.error('Error extracting Instagram customer ID:', error);
            return undefined;
        }
    }

    /**
     * Extract normalized data from the Instagram payload
     */
    private extractNormalizedData(payload: any, eventType: string): Record<string, any> {
        if (!payload || !payload.entry || !payload.entry.length) {
            return {};
        }

        try {
            const normalizedData: Record<string, any> = {};
            const entry = payload.entry[0];

            // Handle direct messages
            if (eventType === InstagramEventType.DIRECT && entry.messaging && entry.messaging.length > 0) {
                const message = entry.messaging[0];

                normalizedData.senderId = message.sender.id;
                normalizedData.recipientId = message.recipient.id;
                normalizedData.timestamp = message.timestamp;

                if (message.message) {
                    normalizedData.messageId = message.message.mid;

                    if (message.message.text) {
                        normalizedData.messageType = 'text';
                        normalizedData.text = message.message.text;
                    } else if (message.message.attachments && message.message.attachments.length > 0) {
                        const attachment = message.message.attachments[0];
                        normalizedData.messageType = attachment.type;
                        normalizedData.mediaUrl = attachment.payload?.url;
                    }
                }
            }

            // Handle comments
            else if (eventType === InstagramEventType.COMMENT && entry.changes && entry.changes.length > 0) {
                const change = entry.changes[0];
                const comment = change.value;

                normalizedData.commentId = comment.id;
                normalizedData.userId = comment.from?.id;
                normalizedData.username = comment.from?.username;
                normalizedData.text = comment.text;
                normalizedData.mediaId = comment.media?.id;
                normalizedData.timestamp = comment.created_time;
            }

            // Handle mentions
            else if (eventType === InstagramEventType.MENTION && entry.changes && entry.changes.length > 0) {
                const change = entry.changes[0];
                const mention = change.value;

                normalizedData.mediaId = mention.media_id;
                normalizedData.userId = mention.user_id;
                normalizedData.username = mention.username;
                normalizedData.text = mention.text;
                normalizedData.timestamp = mention.created_time;
            }

            // Handle story mentions
            else if (eventType === InstagramEventType.STORY_MENTION && entry.changes && entry.changes.length > 0) {
                const change = entry.changes[0];
                const storyMention = change.value;

                normalizedData.storyId = storyMention.story_id;
                normalizedData.userId = storyMention.mentioned_user.id;
                normalizedData.username = storyMention.mentioned_user.username;
                normalizedData.timestamp = storyMention.created_time;
            }

            return normalizedData;
        } catch (error) {
            console.error('Error extracting normalized Instagram data:', error);
            return {};
        }
    }
} 
