import crypto from 'crypto';
import { BaseWebhookProviderAdapterImpl, NormalizedWebhookPayload, WebhookProviderType } from '../providerAdapters.js';

/**
 * Slack webhook event types
 */
export enum SlackEventType {
    MESSAGE = 'message',
    APP_MENTION = 'app_mention',
    CHANNEL_CREATED = 'channel_created',
    CHANNEL_ARCHIVE = 'channel_archive',
    CHANNEL_UNARCHIVE = 'channel_unarchive',
    REACTION_ADDED = 'reaction_added',
    REACTION_REMOVED = 'reaction_removed',
    MEMBER_JOINED_CHANNEL = 'member_joined_channel',
    MEMBER_LEFT_CHANNEL = 'member_left_channel'
}

/**
 * Slack webhook message types
 */
export enum SlackMessageType {
    TEXT = 'text',
    FILE = 'file',
    IMAGE = 'image',
    AUDIO = 'audio',
    VIDEO = 'video',
    RICH_TEXT = 'rich_text',
    BLOCK = 'block'
}

/**
 * Slack webhook provider adapter
 */
export class SlackWebhookAdapter extends BaseWebhookProviderAdapterImpl {
    constructor() {
        super();
    }

    /**
     * Transform Slack-specific webhook payload to standardized format
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
            provider: WebhookProviderType.SLACK,
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

        metadata.source = 'slack';
        metadata.sourceType = 'webhook';
        metadata.actionType = eventType;
        metadata.clientId = clientId;
        metadata.receivedAt = new Date().toISOString();
        metadata.headers = headers;

        return metadata;
    }

    /**
     * Verify Slack webhook signature
     */
    async verifySignature(
        payload: any,
        headers: Record<string, string>,
        webhookSecret: string
    ): Promise<boolean> {
        // Slack uses x-slack-signature and x-slack-request-timestamp headers for verification
        const signature = headers['x-slack-signature'];
        const timestamp = headers['x-slack-request-timestamp'];

        if (!signature || !timestamp) {
            return false;
        }

        // Check for replay attacks
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
            return false; // Request is older than 5 minutes
        }

        try {
            // Convert payload to string if it's not already
            const payloadStr = typeof payload === 'string'
                ? payload
                : JSON.stringify(payload);

            // Create the signature base string
            const baseString = `v0:${timestamp}:${payloadStr}`;

            // Compute hash
            const hmac = crypto.createHmac('sha256', webhookSecret);
            hmac.update(baseString);
            const computedSignature = `v0=${hmac.digest('hex')}`;

            return crypto.timingSafeEqual(
                Buffer.from(computedSignature),
                Buffer.from(signature)
            );
        } catch (error) {
            console.error('Error verifying Slack webhook signature:', error);
            return false;
        }
    }

    /**
     * Handle Slack webhook verification challenge
     */
    async handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<{ isChallenge: boolean; response?: any }> {
        // Slack sends a challenge token in the payload when setting up event subscriptions
        if (payload && payload.type === 'url_verification' && payload.challenge) {
            return {
                isChallenge: true,
                response: {
                    challenge: payload.challenge
                }
            };
        }

        return { isChallenge: false };
    }

    /**
     * Determine the event type from the Slack payload
     */
    private determineEventType(payload: any): string {
        if (!payload) {
            return 'unknown';
        }

        try {
            // Event API payloads have a type field
            if (payload.type === 'event_callback' && payload.event) {
                return payload.event.type || 'unknown';
            }

            // Interactive messages have a type field
            if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
                return payload.type;
            }

            // Command payloads have a command field
            if (payload.command) {
                return `command.${payload.command.replace('/', '')}`;
            }

            return payload.type || 'unknown';
        } catch (error) {
            console.error('Error determining Slack event type:', error);
            return 'unknown';
        }
    }

    /**
     * Extract customer ID from the Slack payload
     */
    private extractCustomerId(payload: any): string | undefined {
        if (!payload) {
            return undefined;
        }

        try {
            // For event API payloads
            if (payload.event) {
                // For messages, the user ID is in the event
                if (payload.event.user) {
                    return payload.event.user;
                }

                // For channel events, the user might be elsewhere
                if (payload.event.item && payload.event.item.user) {
                    return payload.event.item.user;
                }
            }

            // For interactive messages
            if (payload.user && payload.user.id) {
                return payload.user.id;
            }

            // For slash commands
            if (payload.user_id) {
                return payload.user_id;
            }

            return undefined;
        } catch (error) {
            console.error('Error extracting Slack customer ID:', error);
            return undefined;
        }
    }

    /**
     * Extract normalized data from the Slack payload
     */
    private extractNormalizedData(payload: any, eventType: string): Record<string, any> {
        if (!payload) {
            return {};
        }

        try {
            const normalizedData: Record<string, any> = {};

            // Add basic payload info
            if (payload.team_id) {
                normalizedData.teamId = payload.team_id;
            }

            // For message events
            if (eventType === SlackEventType.MESSAGE && payload.event) {
                const message = payload.event;

                normalizedData.userId = message.user;
                normalizedData.channelId = message.channel;
                normalizedData.timestamp = message.ts;
                normalizedData.threadTs = message.thread_ts;

                // Message text
                if (message.text) {
                    normalizedData.messageType = SlackMessageType.TEXT;
                    normalizedData.text = message.text;
                }

                // File attachments
                if (message.files && message.files.length > 0) {
                    const file = message.files[0];
                    normalizedData.fileId = file.id;
                    normalizedData.fileName = file.name;
                    normalizedData.fileType = file.filetype;
                    normalizedData.fileUrl = file.url_private;

                    // Determine message type based on file type
                    if (file.filetype.startsWith('image')) {
                        normalizedData.messageType = SlackMessageType.IMAGE;
                        normalizedData.imageUrl = file.url_private;
                        normalizedData.thumbUrl = file.thumb_360;
                    } else if (file.filetype.startsWith('audio')) {
                        normalizedData.messageType = SlackMessageType.AUDIO;
                        normalizedData.audioUrl = file.url_private;
                    } else if (file.filetype.startsWith('video')) {
                        normalizedData.messageType = SlackMessageType.VIDEO;
                        normalizedData.videoUrl = file.url_private;
                        normalizedData.thumbUrl = file.thumb_video;
                    } else {
                        normalizedData.messageType = SlackMessageType.FILE;
                    }
                }

                // Rich text or blocks
                if (message.blocks && message.blocks.length > 0) {
                    normalizedData.messageType = SlackMessageType.BLOCK;
                    normalizedData.blocks = message.blocks;
                }
            }

            // For app mentions
            else if (eventType === SlackEventType.APP_MENTION && payload.event) {
                const mention = payload.event;

                normalizedData.userId = mention.user;
                normalizedData.channelId = mention.channel;
                normalizedData.timestamp = mention.ts;
                normalizedData.text = mention.text;
            }

            // For reactions
            else if (
                (eventType === SlackEventType.REACTION_ADDED || eventType === SlackEventType.REACTION_REMOVED)
                && payload.event
            ) {
                const reaction = payload.event;

                normalizedData.userId = reaction.user;
                normalizedData.reaction = reaction.reaction;
                normalizedData.timestamp = reaction.event_ts;

                if (reaction.item) {
                    normalizedData.itemType = reaction.item.type;
                    normalizedData.itemChannel = reaction.item.channel;
                    normalizedData.itemTimestamp = reaction.item.ts;
                }
            }

            // For channel events
            else if (
                (eventType === SlackEventType.CHANNEL_CREATED ||
                    eventType === SlackEventType.CHANNEL_ARCHIVE ||
                    eventType === SlackEventType.CHANNEL_UNARCHIVE) &&
                payload.event
            ) {
                const channelEvent = payload.event;

                normalizedData.channelId = channelEvent.channel?.id || channelEvent.channel;
                normalizedData.channelName = channelEvent.channel?.name;
                normalizedData.userId = channelEvent.user;
                normalizedData.timestamp = channelEvent.event_ts;
            }

            // For member joined/left channel
            else if (
                (eventType === SlackEventType.MEMBER_JOINED_CHANNEL ||
                    eventType === SlackEventType.MEMBER_LEFT_CHANNEL) &&
                payload.event
            ) {
                const memberEvent = payload.event;

                normalizedData.userId = memberEvent.user;
                normalizedData.channelId = memberEvent.channel;
                normalizedData.timestamp = memberEvent.event_ts;

                if (memberEvent.inviter) {
                    normalizedData.inviterId = memberEvent.inviter;
                }
            }

            // For interactive messages and block actions
            else if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
                normalizedData.userId = payload.user.id;
                normalizedData.username = payload.user.name;
                normalizedData.channelId = payload.channel.id;
                normalizedData.responseUrl = payload.response_url;
                normalizedData.timestamp = payload.trigger_id;

                if (payload.actions && payload.actions.length > 0) {
                    const action = payload.actions[0];
                    normalizedData.actionId = action.action_id || action.name;
                    normalizedData.actionValue = action.value;
                    normalizedData.actionType = action.type;
                }
            }

            // For slash commands
            else if (payload.command) {
                normalizedData.command = payload.command;
                normalizedData.text = payload.text;
                normalizedData.userId = payload.user_id;
                normalizedData.username = payload.user_name;
                normalizedData.channelId = payload.channel_id;
                normalizedData.teamId = payload.team_id;
                normalizedData.responseUrl = payload.response_url;
                normalizedData.triggerId = payload.trigger_id;
            }

            return normalizedData;
        } catch (error) {
            console.error('Error extracting normalized Slack data:', error);
            return {};
        }
    }
} 
