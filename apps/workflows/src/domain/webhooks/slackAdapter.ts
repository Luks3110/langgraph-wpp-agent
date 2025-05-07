import crypto from 'crypto';
import {
    BaseWebhookProviderAdapterImpl,
    ChallengeResponse,
    NormalizedWebhookPayload,
    WebhookProviderType
} from './providerAdapters.js';

/**
 * Slack webhook provider adapter
 */
export class SlackWebhookAdapter extends BaseWebhookProviderAdapterImpl {
    /**
     * Normalize Slack webhook payload
     */
    async normalizePayload(
        payload: any,
        headers: Record<string, string>,
        clientId: string
    ): Promise<NormalizedWebhookPayload> {
        if (!payload) {
            throw new Error('Invalid Slack webhook payload');
        }

        let eventType = '';
        let eventData: any = {};

        // Determine event type
        if (payload.type === 'url_verification') {
            eventType = 'verification';
            eventData = payload;
        } else if (payload.event) {
            eventType = payload.event.type || 'event';
            eventData = payload.event;
        } else if (payload.command) {
            eventType = 'command';
            eventData = payload;
        } else if (payload.payload && typeof payload.payload === 'string') {
            // Interactive components payload comes as a JSON string
            try {
                const parsedPayload = JSON.parse(payload.payload);
                eventType = parsedPayload.type || 'interactive';
                eventData = parsedPayload;
            } catch (e) {
                eventType = 'unknown';
                eventData = payload;
            }
        } else {
            eventType = payload.type || 'unknown';
            eventData = payload;
        }

        // Create normalized data structure
        const data: Record<string, any> = {
            teamId: payload.team_id || eventData.team_id || eventData.team?.id || '',
            timestamp: eventData.ts ? Number(eventData.ts) * 1000 : Date.now(), // Convert to milliseconds
        };

        // Handle specific event types
        if (eventType === 'message') {
            data.channelId = eventData.channel || eventData.channel_id || '';
            data.userId = eventData.user || '';
            data.text = eventData.text || '';
            data.messageType = 'text';

            // Check if message has attachments or files
            if (eventData.attachments?.length > 0) {
                data.attachments = eventData.attachments;

                // Determine if it's a rich message with blocks
                if (eventData.attachments[0].blocks) {
                    data.messageType = 'rich';
                }
            }

            if (eventData.files?.length > 0) {
                data.files = eventData.files;
                data.messageType = 'file';

                // Add the first file's details
                data.fileUrl = eventData.files[0].url_private || eventData.files[0].permalink;
                data.fileName = eventData.files[0].name;
                data.fileType = eventData.files[0].filetype;
            }

        } else if (eventType === 'command') {
            data.channelId = payload.channel_id || '';
            data.userId = payload.user_id || '';
            data.command = payload.command || '';
            data.text = payload.text || '';
            data.responseUrl = payload.response_url || '';

        } else if (eventType.includes('interactive')) {
            // For button clicks, block actions, etc.
            data.userId = eventData.user?.id || '';
            data.channelId = eventData.channel?.id || '';
            data.interactionType = eventData.type || '';

            if (eventData.actions?.length > 0) {
                data.actions = eventData.actions;
                data.actionId = eventData.actions[0].action_id || '';
                data.actionValue = eventData.actions[0].value || '';
            }

            if (eventData.view) {
                data.viewId = eventData.view.id || '';
            }

            data.responseUrl = eventData.response_url || '';
        }

        // Extract enterprise and team info
        if (eventData.enterprise) {
            data.enterpriseId = eventData.enterprise.id || '';
            data.enterpriseName = eventData.enterprise.name || '';
        }

        // Create metadata from headers
        const metadata = this.extractMetadataFromHeaders(headers);

        return {
            eventType,
            customerId: clientId,
            timestamp: data.timestamp,
            provider: WebhookProviderType.SLACK,
            data,
            rawPayload: payload,
            metadata
        };
    }

    /**
     * Verify Slack webhook signature
     */
    async verifySignature(
        payload: any,
        headers: Record<string, string>,
        secret: string
    ): Promise<boolean> {
        const slackSignature = headers['x-slack-signature'];
        const slackTimestamp = headers['x-slack-request-timestamp'];

        if (!slackSignature || !slackTimestamp) {
            return false;
        }

        // Check for replay attacks - reject requests older than 5 minutes
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - Number(slackTimestamp)) > 300) {
            return false;
        }

        // Get the raw body as a string
        const body = typeof payload === 'string'
            ? payload
            : JSON.stringify(payload);

        // Create the signature base string
        const baseString = `v0:${slackTimestamp}:${body}`;

        // Compute the expected signature
        const expectedSignature = 'v0=' + crypto
            .createHmac('sha256', secret)
            .update(baseString)
            .digest('hex');

        // Compare signatures using timing-safe compare
        return crypto.timingSafeEqual(
            Buffer.from(slackSignature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Handle Slack verification challenge
     */
    async handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<ChallengeResponse> {
        // Slack sends a url_verification challenge
        if (
            payload &&
            typeof payload === 'object' &&
            payload.type === 'url_verification' &&
            payload.challenge
        ) {
            return {
                isChallenge: true,
                response: payload.challenge
            };
        }

        // Not a challenge request
        return { isChallenge: false };
    }
} 
