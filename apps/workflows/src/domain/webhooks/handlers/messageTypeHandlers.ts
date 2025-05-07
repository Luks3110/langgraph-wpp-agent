/**
 * Interface for message type handlers
 */
export interface MessageTypeHandler {
    canHandle(eventData: any): boolean;
    extractData(eventData: any): Record<string, any>;
}

/**
 * Base class for message type handlers
 */
export abstract class BaseMessageTypeHandler implements MessageTypeHandler {
    abstract canHandle(eventData: any): boolean;
    abstract extractData(eventData: any): Record<string, any>;
}

/**
 * Handler for text messages
 */
export class TextMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.text;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'text',
            text: eventData.text.body
        };
    }
}

/**
 * Handler for image messages
 */
export class ImageMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.image;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'image',
            mediaUrl: eventData.image.url || eventData.image.id,
            mediaId: eventData.image.id,
            caption: eventData.image.caption
        };
    }
}

/**
 * Handler for video messages
 */
export class VideoMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.video;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'video',
            mediaUrl: eventData.video.url || eventData.video.id,
            mediaId: eventData.video.id,
            caption: eventData.video.caption
        };
    }
}

/**
 * Handler for document messages
 */
export class DocumentMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.document;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'document',
            mediaUrl: eventData.document.url || eventData.document.id,
            mediaId: eventData.document.id,
            fileName: eventData.document.filename
        };
    }
}

/**
 * Handler for location messages
 */
export class LocationMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.location;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'location',
            latitude: eventData.location.latitude,
            longitude: eventData.location.longitude
        };
    }
}

/**
 * Handler for button messages
 */
export class ButtonMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.button;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'button',
            buttonText: eventData.button.text,
            buttonPayload: eventData.button.payload
        };
    }
}

/**
 * Handler for interactive messages
 */
export class InteractiveMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.interactive;
    }

    extractData(eventData: any): Record<string, any> {
        const data: Record<string, any> = {
            messageType: 'interactive',
            interactiveType: eventData.interactive.type
        };

        if (eventData.interactive.button_reply) {
            data.buttonId = eventData.interactive.button_reply.id;
            data.buttonText = eventData.interactive.button_reply.title;
        } else if (eventData.interactive.list_reply) {
            data.listItemId = eventData.interactive.list_reply.id;
            data.listItemTitle = eventData.interactive.list_reply.title;
        }

        return data;
    }
}

/**
 * Handler for status updates
 */
export class StatusUpdateHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return eventData.status !== undefined;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'status',
            status: eventData.status,
            conversationId: eventData.conversation?.id
        };
    }
}

/**
 * Handler for reaction messages
 */
export class ReactionMessageHandler extends BaseMessageTypeHandler {
    canHandle(eventData: any): boolean {
        return !!eventData.emoji;
    }

    extractData(eventData: any): Record<string, any> {
        return {
            messageType: 'reaction',
            senderId: eventData.sender_id,
            messageId: eventData.message_id,
            emoji: eventData.emoji,
            timestamp: eventData.timestamp
        };
    }
}

/**
 * Registry for message type handlers
 */
export class MessageTypeHandlerRegistry {
    private handlers: MessageTypeHandler[] = [];

    constructor() {
        // Register default handlers
        this.registerHandler(new TextMessageHandler());
        this.registerHandler(new ImageMessageHandler());
        this.registerHandler(new VideoMessageHandler());
        this.registerHandler(new DocumentMessageHandler());
        this.registerHandler(new LocationMessageHandler());
        this.registerHandler(new ButtonMessageHandler());
        this.registerHandler(new InteractiveMessageHandler());
        this.registerHandler(new StatusUpdateHandler());
        this.registerHandler(new ReactionMessageHandler());
    }

    /**
     * Register a new handler
     */
    registerHandler(handler: MessageTypeHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Get the first handler that can handle the event data
     */
    getHandler(eventData: any): MessageTypeHandler | null {
        for (const handler of this.handlers) {
            if (handler.canHandle(eventData)) {
                return handler;
            }
        }
        return null;
    }

    /**
     * Process event data using the appropriate handler
     */
    processEventData(eventType: string, eventData: any): Record<string, any> {
        const data: Record<string, any> = {};

        if (eventType === 'message') {
            const handler = this.getHandler(eventData);
            if (handler) {
                Object.assign(data, handler.extractData(eventData));
            } else {
                // Default fallback if no handler is found
                data.messageType = 'unknown';
            }
        } else if (eventType === 'status_update') {
            const statusHandler = new StatusUpdateHandler();
            Object.assign(data, statusHandler.extractData(eventData));
        } else if (eventType === 'reaction') {
            const reactionHandler = new ReactionMessageHandler();
            Object.assign(data, reactionHandler.extractData(eventData));
        }

        return data;
    }
} 
