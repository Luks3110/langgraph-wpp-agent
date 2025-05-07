
/**
 * Enumeration of agent nodes
 */
export enum AgentNode {
    PROCESS_MESSAGE = "process_message",
    GENERATE_RESPONSE = "generate_response",
    FORWARD_TO_PRODUCTS = "forward_to_products",
    ERROR_HANDLER = "error_handler"
}

/**
 * Type definition for chat messages
 */
export type ChatMessage = {
    role: "human" | "ai";
    content: string;
};

/**
 * Type definition for agent state
 */
export type AgentState = {
    userId: string;
    input: string;
    chatHistory?: ChatMessage[];
    response?: string;
    error?: Error;
    shouldForwardToProducts?: boolean;
    actionType?: string;
    messageId?: string;
};

/**
 * Type definition for WhatsApp message processing result
 */
export type WhatsAppProcessingResult = {
    success: boolean;
    message?: string;
    error?: Error;
}; 
