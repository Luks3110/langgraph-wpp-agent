import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { JobQueue } from '../../../infrastructure/bullmq/jobQueue.js';
import {
    BaseWebhookProviderAdapterImpl,
    ChallengeResponse,
    NormalizedWebhookPayload,
    WebhookProviderType
} from '../providerAdapters.js';

/**
 * WhatsApp webhook message types
 */
export enum WhatsAppMessageType {
    TEXT = 'text',
    IMAGE = 'image',
    AUDIO = 'audio',
    VIDEO = 'video',
    DOCUMENT = 'document',
    LOCATION = 'location',
    BUTTON = 'button',
    TEMPLATE = 'template'
}

/**
 * WhatsApp webhook event types
 */
export enum WhatsAppEventType {
    MESSAGE = 'message',
    STATUS = 'status',
    REACTION = 'reaction'
}

/**
 * WhatsApp webhook provider adapter
 */
export class WhatsAppWebhookAdapter extends BaseWebhookProviderAdapterImpl {
    private jobQueue?: JobQueue;

    /**
     * Set the job queue for asynchronous processing
     */
    setJobQueue(jobQueue: JobQueue): void {
        this.jobQueue = jobQueue;
    }

    /**
     * Normalize WhatsApp webhook payload
     */
    async normalizePayload(
        payload: any,
        headers: Record<string, string>,
        clientId: string
    ): Promise<NormalizedWebhookPayload> {
        if (!payload || !payload.entry) {
            throw new Error('Invalid WhatsApp webhook payload');
        }

        // Extract the first relevant event
        let eventData: any = null;
        let eventType = '';

        // WhatsApp event structure: entry[0].changes[0].value
        if (payload.entry?.[0]?.changes?.[0]?.value) {
            const value = payload.entry[0].changes[0].value;

            // Determine event type
            if (value.messages?.length > 0) {
                eventType = 'message';
                eventData = value.messages[0];
            } else if (value.statuses?.length > 0) {
                eventType = 'status_update';
                eventData = value.statuses[0];
            } else {
                eventType = 'other';
                eventData = value;
            }
        }

        if (!eventData) {
            eventType = 'unknown';
            eventData = payload;
        }

        // Extract business/customer phone number
        const fromId = eventData.from || 'unknown';

        // Create normalized data structure
        const data: Record<string, any> = {
            senderId: fromId,
            recipientId: eventData.to || 'unknown',
            timestamp: eventData.timestamp || Date.now(),
            messageId: eventData.id || '',
        };

        // Handle message content if present
        if (eventType === 'message') {
            if (eventData.text) {
                data.messageType = 'text';
                data.text = eventData.text.body;
            } else if (eventData.image) {
                data.messageType = 'image';
                data.mediaUrl = eventData.image.url || eventData.image.id;
                data.mediaId = eventData.image.id;
            } else if (eventData.video) {
                data.messageType = 'video';
                data.mediaUrl = eventData.video.url || eventData.video.id;
                data.mediaId = eventData.video.id;
            } else if (eventData.document) {
                data.messageType = 'document';
                data.mediaUrl = eventData.document.url || eventData.document.id;
                data.mediaId = eventData.document.id;
                data.fileName = eventData.document.filename;
            } else if (eventData.location) {
                data.messageType = 'location';
                data.latitude = eventData.location.latitude;
                data.longitude = eventData.location.longitude;
            } else if (eventData.button) {
                data.messageType = 'button';
                data.buttonText = eventData.button.text;
                data.buttonPayload = eventData.button.payload;
            } else if (eventData.interactive) {
                data.messageType = 'interactive';
                data.interactiveType = eventData.interactive.type;

                if (eventData.interactive.button_reply) {
                    data.buttonId = eventData.interactive.button_reply.id;
                    data.buttonText = eventData.interactive.button_reply.title;
                } else if (eventData.interactive.list_reply) {
                    data.listItemId = eventData.interactive.list_reply.id;
                    data.listItemTitle = eventData.interactive.list_reply.title;
                }
            }

            // Queue the message for agent processing if it's a text message
            if (this.jobQueue && data.messageType === 'text') {
                try {
                    await this.jobQueue.addJob('agent-execution', {
                        messageId: data.messageId || uuidv4(),
                        conversationId: data.senderId, // Use sender ID as conversation ID
                        message: data.text,
                        senderId: data.senderId,
                        recipientId: data.recipientId,
                        clientId: clientId,
                        channelType: 'whatsapp',
                        timestamp: data.timestamp,
                        metadata: {
                            provider: WebhookProviderType.WHATSAPP,
                            eventType: eventType
                        }
                    }, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000
                        }
                    });

                    console.log(`Queued WhatsApp message from ${data.senderId} for agent processing`);
                } catch (error) {
                    console.error('Error queuing message for agent processing:', error);
                }
            }
        } else if (eventType === 'status_update') {
            data.status = eventData.status;
            data.conversationId = eventData.conversation?.id;
        }

        // Create metadata from headers
        const metadata = this.extractMetadataFromHeaders(headers);

        return {
            eventType,
            customerId: clientId,
            timestamp: eventData.timestamp || Date.now(),
            provider: WebhookProviderType.WHATSAPP,
            data,
            rawPayload: payload,
            metadata
        };
    }

    /**
     * Verify WhatsApp webhook signature
     */
    async verifySignature(
        payload: any,
        headers: Record<string, string>,
        secret: string
    ): Promise<boolean> {
        const signature = headers['x-hub-signature-256'] || headers['x-hub-signature'];

        if (!signature) {
            return false;
        }

        // Get the raw body as a string
        const body = typeof payload === 'string'
            ? payload
            : JSON.stringify(payload);

        // Compute the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');

        // Compare signatures
        // The header has format "sha256=signature"
        const providedSignature = signature.startsWith('sha256=')
            ? signature.substring(7)
            : signature;

        return crypto.timingSafeEqual(
            Buffer.from(providedSignature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Handle WhatsApp verification challenge
     */
    async handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<ChallengeResponse> {
        // WhatsApp/Meta uses a hub.challenge verification
        if (
            payload &&
            typeof payload === 'object' &&
            'hub.mode' in payload &&
            'hub.challenge' in payload &&
            'hub.verify_token' in payload
        ) {
            // The request is a challenge
            return {
                isChallenge: true,
                response: payload['hub.challenge']
            };
        }

        // Not a challenge request
        return { isChallenge: false };
    }
} 
