import { BaseMessageTypeHandler, MessageTypeHandler } from './messageTypeHandlers.js';

/**
 * Facebook message types (from providerAdapters.ts)
 */
enum FacebookMessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    FILE = 'file',
    TEMPLATE = 'template',
    FALLBACK = 'fallback'
}

/**
 * Handler for Facebook text messages
 */
export class FacebookTextMessageHandler extends BaseMessageTypeHandler {
    canHandle(message: any): boolean {
        return !!message.text;
    }

    extractData(message: any): Record<string, any> {
        return {
            messageType: FacebookMessageType.TEXT,
            text: message.text
        };
    }
}

/**
 * Handler for Facebook attachment messages
 */
export class FacebookAttachmentMessageHandler extends BaseMessageTypeHandler {
    canHandle(message: any): boolean {
        return message.attachments && message.attachments.length > 0;
    }

    extractData(message: any): Record<string, any> {
        const attachment = message.attachments[0];
        const data: Record<string, any> = {
            messageType: attachment.type
        };

        switch (attachment.type) {
            case 'image':
                data.messageType = FacebookMessageType.IMAGE;
                data.url = attachment.payload?.url;
                break;
            case 'video':
                data.messageType = FacebookMessageType.VIDEO;
                data.url = attachment.payload?.url;
                break;
            case 'audio':
                data.messageType = FacebookMessageType.AUDIO;
                data.url = attachment.payload?.url;
                break;
            case 'file':
                data.messageType = FacebookMessageType.FILE;
                data.url = attachment.payload?.url;
                break;
            case 'template':
                data.messageType = FacebookMessageType.TEMPLATE;
                data.templateType = attachment.payload?.template_type;
                data.templateData = attachment.payload;
                break;
            default:
                data.messageType = FacebookMessageType.FALLBACK;
                data.fallbackUrl = attachment.payload?.url;
                break;
        }

        return data;
    }
}

/**
 * Handler for Facebook quick reply messages
 */
export class FacebookQuickReplyMessageHandler extends BaseMessageTypeHandler {
    canHandle(message: any): boolean {
        return !!message.quick_reply;
    }

    extractData(message: any): Record<string, any> {
        return {
            messageType: 'quick_reply',
            quickReplyPayload: message.quick_reply.payload
        };
    }
}

/**
 * Handler for Facebook postback messages
 */
export class FacebookPostbackHandler extends BaseMessageTypeHandler {
    canHandle(messaging: any): boolean {
        return !!messaging.postback;
    }

    extractData(messaging: any): Record<string, any> {
        const postback = messaging.postback;
        const data: Record<string, any> = {
            messageType: 'postback',
            payload: postback.payload,
            title: postback.title
        };

        if (postback.referral) {
            data.referralSource = postback.referral.source;
            data.referralType = postback.referral.type;
            data.referralRef = postback.referral.ref;
        }

        return data;
    }
}

/**
 * Handler for Facebook message delivery events
 */
export class FacebookDeliveryHandler extends BaseMessageTypeHandler {
    canHandle(messaging: any): boolean {
        return !!messaging.delivery;
    }

    extractData(messaging: any): Record<string, any> {
        const delivery = messaging.delivery;
        return {
            messageType: 'delivery',
            watermark: delivery.watermark,
            deliveredMessageIds: delivery.mids
        };
    }
}

/**
 * Handler for Facebook message read events
 */
export class FacebookReadHandler extends BaseMessageTypeHandler {
    canHandle(messaging: any): boolean {
        return !!messaging.read;
    }

    extractData(messaging: any): Record<string, any> {
        const read = messaging.read;
        return {
            messageType: 'read',
            watermark: read.watermark
        };
    }
}

/**
 * Registry for Facebook message type handlers
 */
export class FacebookMessageHandlerRegistry {
    private messageHandlers: MessageTypeHandler[] = [];
    private eventHandlers: Map<string, MessageTypeHandler> = new Map();

    constructor() {
        // Register message handlers
        this.messageHandlers.push(new FacebookTextMessageHandler());
        this.messageHandlers.push(new FacebookAttachmentMessageHandler());
        this.messageHandlers.push(new FacebookQuickReplyMessageHandler());

        // Register event handlers
        this.eventHandlers.set('postback', new FacebookPostbackHandler());
        this.eventHandlers.set('delivery', new FacebookDeliveryHandler());
        this.eventHandlers.set('read', new FacebookReadHandler());
    }

    /**
     * Process a Facebook message
     */
    processMessage(message: any): Record<string, any> {
        for (const handler of this.messageHandlers) {
            if (handler.canHandle(message)) {
                return handler.extractData(message);
            }
        }
        return { messageType: 'unknown' };
    }

    /**
     * Process a specific Facebook event type
     */
    processEvent(eventType: string, messaging: any): Record<string, any> {
        // For message events, process the message
        if (eventType === 'message' && messaging.message) {
            return this.processMessage(messaging.message);
        }

        // For other event types, use the appropriate handler
        let handlerKey = eventType.toLowerCase();
        if (handlerKey.startsWith('messaging_')) {
            handlerKey = handlerKey.substring('messaging_'.length);
        } else if (handlerKey.startsWith('message_')) {
            handlerKey = handlerKey.substring('message_'.length);
        }

        const handler = this.eventHandlers.get(handlerKey);
        if (handler && handler.canHandle(messaging)) {
            return handler.extractData(messaging);
        }

        return { messageType: eventType };
    }
} 
