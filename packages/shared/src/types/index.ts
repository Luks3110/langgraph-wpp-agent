/**
 * WhatsApp message interface
 */
export interface WhatsAppMessage {
    from: string;
    text: string;
    timestamp: number;
    messageId: string;
}

/**
 * Agent message interface for processing
 */
export interface AgentRequestMessage {
    from: string;
    text: string;
    timestamp: number;
    messageId: string;
}

/**
 * Agent response interface
 */
export interface AgentResponseMessage {
    to: string;
    text: string;
    messageId: string;
    originalMessageId: string;
} 
