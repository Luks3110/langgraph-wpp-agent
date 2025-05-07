/**
 * Message in a conversation
 */
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

/**
 * Options for generation
 */
export interface GenerationOptions {
    model: string;
    temperature: number;
    maxTokens: number;
}

/**
 * Agent response
 */
export interface AgentResponse {
    content: string;
    tokensUsed: number;
    model: string;
}

/**
 * Mock responses for different types of queries
 */
const MOCK_RESPONSES: Record<string, string[]> = {
    greeting: [
        "Hello! How can I assist you today?",
        "Hi there! I'm your AI assistant. What can I help you with?",
        "Greetings! I'm here to help. What would you like to know?"
    ],
    product: [
        "Based on your preferences, I'd recommend our premium product which has all the features you're looking for.",
        "I've found several products that match your criteria. The top recommendation is our latest model with enhanced performance.",
        "For your specific needs, I suggest trying our economy package first. It offers great value while meeting your requirements."
    ],
    help: [
        "I can help with product recommendations, answer questions about our services, or assist with troubleshooting. What do you need help with?",
        "I'm here to assist with any questions you have about our products, services, or support needs. Just let me know what you're looking for.",
        "My capabilities include providing product information, helping with purchases, and answering frequently asked questions. How can I help you today?"
    ],
    fallback: [
        "I understand your question. Let me provide you with the information you need.",
        "Thank you for your query. Here's what I can tell you about that.",
        "I appreciate your question. Here's my response based on the information I have."
    ]
};

/**
 * Get a random response from the provided array
 */
function getRandomResponse(responses: string[]): string {
    const index = Math.floor(Math.random() * responses.length);
    return responses[index];
}

/**
 * Determine the category of the user's message
 */
function determineCategory(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
        return "greeting";
    }

    if (lowerMessage.includes("product") || lowerMessage.includes("recommend") || lowerMessage.includes("buy")) {
        return "product";
    }

    if (lowerMessage.includes("help") || lowerMessage.includes("assist") || lowerMessage.includes("support")) {
        return "help";
    }

    return "fallback";
}

/**
 * Generate a mock agent response based on the conversation history
 */
export async function mockAgentResponse(
    messages: Message[],
    options: GenerationOptions
): Promise<AgentResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Get the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");

    if (!lastUserMessage) {
        // No user message found, return default response
        return {
            content: "I'm not sure what you're asking. Could you please provide more information?",
            tokensUsed: 15,
            model: options.model
        };
    }

    // Determine the category of the message
    const category = determineCategory(lastUserMessage.content);

    // Get a response for the category
    const responses = MOCK_RESPONSES[category] || MOCK_RESPONSES.fallback;
    const content = getRandomResponse(responses);

    // Calculate mock token usage (approximately 1 token per 4 chars)
    const tokensUsed = Math.ceil(content.length / 4);

    return {
        content,
        tokensUsed,
        model: options.model
    };
} 
