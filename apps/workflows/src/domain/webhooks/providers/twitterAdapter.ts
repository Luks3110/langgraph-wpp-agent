import crypto from 'crypto';
import { BaseWebhookProviderAdapterImpl, NormalizedWebhookPayload, WebhookProviderType } from '../providerAdapters.js';

/**
 * Twitter webhook event types
 */
export enum TwitterEventType {
    TWEET_CREATE = 'tweet_create_events',
    FAVORITE_CREATE = 'favorite_events',
    FOLLOW = 'follow_events',
    UNFOLLOW = 'unfollow_events',
    BLOCK = 'block_events',
    UNBLOCK = 'unblock_events',
    MUTE = 'mute_events',
    UNMUTE = 'unmute_events',
    TWEET_DELETE = 'tweet_delete_events',
    DIRECT_MESSAGE = 'direct_message_events',
    DIRECT_MESSAGE_MARK_READ = 'direct_message_mark_read_events',
    DIRECT_MESSAGE_INDICATE_TYPING = 'direct_message_indicate_typing_events',
    USER_EVENT = 'user_event',
    REVOKE = 'revoke'
}

/**
 * Twitter webhook message types
 */
export enum TwitterMessageType {
    TEXT = 'text',
    MEDIA = 'media',
    POLL = 'poll',
    ANIMATED_GIF = 'animated_gif',
    STICKER = 'sticker',
    LOCATION = 'location'
}

/**
 * Twitter webhook provider adapter
 */
export class TwitterWebhookAdapter extends BaseWebhookProviderAdapterImpl {
    constructor() {
        super();
    }

    /**
     * Transform Twitter-specific webhook payload to standardized format
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
            provider: WebhookProviderType.TWITTER,
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

        metadata.source = 'twitter';
        metadata.sourceType = 'webhook';
        metadata.actionType = eventType;
        metadata.clientId = clientId;
        metadata.receivedAt = new Date().toISOString();
        metadata.headers = headers;

        return metadata;
    }

    /**
     * Verify Twitter webhook signature
     */
    async verifySignature(
        payload: any,
        headers: Record<string, string>,
        webhookSecret: string
    ): Promise<boolean> {
        // Twitter uses x-twitter-webhooks-signature header for verification
        const signature = headers['x-twitter-webhooks-signature'] || headers['X-Twitter-Webhooks-Signature'];

        if (!signature) {
            return false;
        }

        try {
            // Twitter signature format: "sha256=..."
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
            console.error('Error verifying Twitter webhook signature:', error);
            return false;
        }
    }

    /**
     * Handle Twitter webhook challenge (CRC - Consumer Registration Challenge)
     */
    async handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<{ isChallenge: boolean; response?: any }> {
        // Twitter uses a CRC (crc_token) for webhook verification
        if (payload && payload.crc_token) {
            // In a real implementation, we would need the consumer secret to respond
            // to the challenge with a valid signature
            const responseToken = crypto.createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET || 'webhook-secret')
                .update(payload.crc_token)
                .digest('base64');

            return {
                isChallenge: true,
                response: {
                    response_token: `sha256=${responseToken}`
                }
            };
        }

        return { isChallenge: false };
    }

    /**
     * Determine the event type from the Twitter payload
     */
    private determineEventType(payload: any): string {
        if (!payload) {
            return 'unknown';
        }

        try {
            // Twitter Account Activity API sends events in specific fields
            // Check for each event type
            for (const eventType of Object.values(TwitterEventType)) {
                if (payload[eventType] && Array.isArray(payload[eventType]) && payload[eventType].length > 0) {
                    return eventType;
                }
            }

            // Check for special case: user_event has a different structure
            if (payload.user_event) {
                return TwitterEventType.USER_EVENT;
            }

            // Check for revoke event
            if (payload.revoke) {
                return TwitterEventType.REVOKE;
            }

            return 'unknown';
        } catch (error) {
            console.error('Error determining Twitter event type:', error);
            return 'unknown';
        }
    }

    /**
     * Extract customer ID from the Twitter payload
     */
    private extractCustomerId(payload: any): string | undefined {
        if (!payload) {
            return undefined;
        }

        try {
            // Different event types have the user ID in different places

            // Tweet events
            if (payload[TwitterEventType.TWEET_CREATE] && payload[TwitterEventType.TWEET_CREATE].length > 0) {
                return payload[TwitterEventType.TWEET_CREATE][0].user.id_str;
            }

            // Favorite events
            if (payload[TwitterEventType.FAVORITE_CREATE] && payload[TwitterEventType.FAVORITE_CREATE].length > 0) {
                return payload[TwitterEventType.FAVORITE_CREATE][0].user.id_str;
            }

            // Follow/unfollow events
            if (payload[TwitterEventType.FOLLOW] && payload[TwitterEventType.FOLLOW].length > 0) {
                return payload[TwitterEventType.FOLLOW][0].source.id_str;
            }

            if (payload[TwitterEventType.UNFOLLOW] && payload[TwitterEventType.UNFOLLOW].length > 0) {
                return payload[TwitterEventType.UNFOLLOW][0].source.id_str;
            }

            // Block/unblock events
            if (payload[TwitterEventType.BLOCK] && payload[TwitterEventType.BLOCK].length > 0) {
                return payload[TwitterEventType.BLOCK][0].source.id_str;
            }

            if (payload[TwitterEventType.UNBLOCK] && payload[TwitterEventType.UNBLOCK].length > 0) {
                return payload[TwitterEventType.UNBLOCK][0].source.id_str;
            }

            // Direct message events
            if (payload[TwitterEventType.DIRECT_MESSAGE] && payload[TwitterEventType.DIRECT_MESSAGE].length > 0) {
                return payload[TwitterEventType.DIRECT_MESSAGE][0].sender_id;
            }

            // For other events, try to find a user ID in the users object
            if (payload.for_user_id) {
                return payload.for_user_id;
            }

            return undefined;
        } catch (error) {
            console.error('Error extracting Twitter customer ID:', error);
            return undefined;
        }
    }

    /**
     * Extract normalized data from the Twitter payload
     */
    private extractNormalizedData(payload: any, eventType: string): Record<string, any> {
        if (!payload) {
            return {};
        }

        try {
            const normalizedData: Record<string, any> = {};

            // Add for_user_id if present (account that registered the webhook)
            if (payload.for_user_id) {
                normalizedData.forUserId = payload.for_user_id;
            }

            // Extract event-specific data
            switch (eventType) {
                case TwitterEventType.TWEET_CREATE: {
                    const tweet = payload[TwitterEventType.TWEET_CREATE][0];

                    normalizedData.tweetId = tweet.id_str;
                    normalizedData.userId = tweet.user.id_str;
                    normalizedData.screenName = tweet.user.screen_name;
                    normalizedData.text = tweet.text || tweet.full_text;
                    normalizedData.timestamp = new Date(tweet.created_at).getTime();
                    normalizedData.tweetType = 'tweet';

                    // Handle retweets
                    if (tweet.retweeted_status) {
                        normalizedData.tweetType = 'retweet';
                        normalizedData.originalTweetId = tweet.retweeted_status.id_str;
                        normalizedData.originalUserId = tweet.retweeted_status.user.id_str;
                        normalizedData.originalScreenName = tweet.retweeted_status.user.screen_name;
                    }

                    // Handle quoted tweets
                    if (tweet.quoted_status) {
                        normalizedData.tweetType = 'quote';
                        normalizedData.quotedTweetId = tweet.quoted_status.id_str;
                        normalizedData.quotedUserId = tweet.quoted_status.user.id_str;
                        normalizedData.quotedScreenName = tweet.quoted_status.user.screen_name;
                    }

                    // Handle reply
                    if (tweet.in_reply_to_status_id_str) {
                        normalizedData.tweetType = 'reply';
                        normalizedData.inReplyToTweetId = tweet.in_reply_to_status_id_str;
                        normalizedData.inReplyToUserId = tweet.in_reply_to_user_id_str;
                        normalizedData.inReplyToScreenName = tweet.in_reply_to_screen_name;
                    }

                    // Media content
                    if (tweet.entities && tweet.entities.media && tweet.entities.media.length > 0) {
                        normalizedData.hasMedia = true;
                        normalizedData.mediaUrls = tweet.entities.media.map((m: any) => m.media_url_https);
                        normalizedData.mediaTypes = tweet.entities.media.map((m: any) => m.type);
                    }

                    // Extended entities (videos, multiple images)
                    if (tweet.extended_entities && tweet.extended_entities.media) {
                        normalizedData.hasExtendedMedia = true;
                        normalizedData.extendedMediaUrls = tweet.extended_entities.media.map((m: any) => m.media_url_https);
                        normalizedData.extendedMediaTypes = tweet.extended_entities.media.map((m: any) => m.type);
                    }
                    break;
                }

                case TwitterEventType.DIRECT_MESSAGE: {
                    const dm = payload[TwitterEventType.DIRECT_MESSAGE][0];

                    normalizedData.messageId = dm.id;
                    normalizedData.senderId = dm.sender_id;
                    normalizedData.recipientId = dm.recipient_id;
                    normalizedData.timestamp = dm.created_timestamp;

                    // Message content
                    if (dm.message_data) {
                        const messageData = dm.message_data;

                        normalizedData.text = messageData.text;

                        // Handle quick replies
                        if (messageData.quick_reply_response) {
                            normalizedData.quickReplyResponse = messageData.quick_reply_response.metadata;
                        }

                        // Handle media
                        if (messageData.attachment) {
                            normalizedData.hasAttachment = true;
                            normalizedData.attachmentType = messageData.attachment.type;

                            if (messageData.attachment.media) {
                                normalizedData.mediaId = messageData.attachment.media.id;
                                normalizedData.mediaType = messageData.attachment.media.type;
                                normalizedData.mediaUrl = messageData.attachment.media.media_url_https;
                            }
                        }
                    }
                    break;
                }

                case TwitterEventType.FOLLOW:
                case TwitterEventType.UNFOLLOW: {
                    const event = payload[eventType][0];

                    normalizedData.sourceUserId = event.source.id_str;
                    normalizedData.sourceScreenName = event.source.screen_name;
                    normalizedData.targetUserId = event.target.id_str;
                    normalizedData.targetScreenName = event.target.screen_name;
                    normalizedData.timestamp = new Date(event.created_at).getTime();
                    break;
                }

                case TwitterEventType.FAVORITE_CREATE: {
                    const favorite = payload[eventType][0];

                    normalizedData.userId = favorite.user.id_str;
                    normalizedData.screenName = favorite.user.screen_name;
                    normalizedData.tweetId = favorite.favorited_status.id_str;
                    normalizedData.tweetUserId = favorite.favorited_status.user.id_str;
                    normalizedData.tweetScreenName = favorite.favorited_status.user.screen_name;
                    normalizedData.timestamp = new Date(favorite.created_at).getTime();
                    break;
                }

                case TwitterEventType.TWEET_DELETE: {
                    const deletion = payload[eventType][0];

                    normalizedData.userId = deletion.user_id_str;
                    normalizedData.tweetId = deletion.status_id_str;
                    normalizedData.timestamp = deletion.timestamp_ms;
                    break;
                }

                case TwitterEventType.REVOKE: {
                    normalizedData.userId = payload.revoke.source.user_id;
                    normalizedData.timestamp = new Date().getTime();
                    break;
                }

                default:
                    // For other event types, just include basic event info
                    normalizedData.eventType = eventType;
                    normalizedData.timestamp = new Date().getTime();
                    break;
            }

            return normalizedData;
        } catch (error) {
            console.error('Error extracting normalized Twitter data:', error);
            return {};
        }
    }
} 
