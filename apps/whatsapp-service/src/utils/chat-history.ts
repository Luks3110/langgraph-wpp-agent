import { redisClient } from "../clients/redis.js";

/**
 * Role type for messages
 */
type MessageRole = "user" | "assistant";

/**
 * Chat message type
 */
interface StoredChatMessage {
    role: MessageRole;
    content: string;
    timestamp: number;
}

/**
 * Get Redis key for chat history
 */
function getChatHistoryKey(userId: string): string {
    return `whatsapp:chat_history:${userId}`;
}

/**
 * Add a message to the user's chat history
 */
export async function addMessageToHistory(
    userId: string,
    role: MessageRole,
    content: string
): Promise<void> {
    try {
        const key = getChatHistoryKey(userId);

        // Create a chat message object
        const message: StoredChatMessage = {
            role,
            content,
            timestamp: Date.now()
        };

        // Store in Redis
        await redisClient.rpush(key, JSON.stringify(message));

        // Set expiration if not set (keep history for 24 hours)
        await redisClient.expire(key, 60 * 60 * 24);

        console.log(`Added ${role} message to history for ${userId}`);
    } catch (error) {
        console.error("Error adding message to chat history:", error);
        // Don't throw - we want to gracefully handle history failures
    }
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(
    userId: string,
    limit: number = 10
): Promise<StoredChatMessage[]> {
    try {
        const key = getChatHistoryKey(userId);

        // Get messages from Redis
        const messages = await redisClient.lrange(key, -limit, -1);

        // Parse messages from JSON
        return messages.map((msg) => JSON.parse(msg));
    } catch (error) {
        console.error("Error getting chat history:", error);
        return []; // Return empty array on error
    }
}

/**
 * Convert Redis chat history to the format expected by the agent
 */
export function convertChatHistoryForAgent(
    chatHistory: StoredChatMessage[]
): { role: "human" | "ai"; content: string }[] {
    return chatHistory.map((msg) => ({
        role: msg.role === "user" ? "human" : "ai",
        content: msg.content
    }));
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userId: string): Promise<void> {
    try {
        const key = getChatHistoryKey(userId);
        await redisClient.del(key);
        console.log(`Cleared chat history for ${userId}`);
    } catch (error) {
        console.error("Error clearing chat history:", error);
    }
} 
