import { redisClient } from "../clients/redis.js";

// Define the message type
type MessageRole = "user" | "assistant";

// Define the message interface
interface Message {
  role: MessageRole;
  content: string;
  timestamp: number;
}

// Maximum number of messages to keep in history
const MAX_HISTORY_LENGTH = 10;

// Redis key prefix for chat history
const CHAT_HISTORY_KEY_PREFIX = "chat_history:";

// TTL for chat history (default: 24 hours)
const CHAT_HISTORY_TTL = 24 * 60 * 60;

/**
 * Add a message to the chat history in Redis
 * @param userId User ID
 * @param role Message role (user or assistant)
 * @param content Message content
 */
export async function addMessageToHistory(
  userId: string,
  role: MessageRole,
  content: string
): Promise<void> {
  try {
    const key = `${CHAT_HISTORY_KEY_PREFIX}${userId}`;

    // Create a message object
    const message: Message = {
      role,
      content,
      timestamp: Date.now()
    };

    // Serialize the message to JSON
    const serializedMessage = JSON.stringify(message);

    // Push the message to the Redis list
    await redisClient.rpush(key, serializedMessage);

    // Trim the list to keep only the most recent messages
    await redisClient.ltrim(key, -MAX_HISTORY_LENGTH, -1);

    // Set expiration on the key
    await redisClient.expire(key, CHAT_HISTORY_TTL);

    console.log(`Added message to history for user ${userId}`);
  } catch (error) {
    console.error("Error adding message to history:", error);
  }
}

/**
 * Get chat history for a user from Redis
 * @param userId User ID
 * @param limit Maximum number of messages to return (default: 10)
 * @returns Array of messages
 */
export async function getChatHistory(
  userId: string,
  limit = MAX_HISTORY_LENGTH
): Promise<{ role: MessageRole | "system"; content: string }[]> {
  try {
    const key = `${CHAT_HISTORY_KEY_PREFIX}${userId}`;

    // Get all messages from the Redis list
    const messages = await redisClient.lrange(key, 0, -1);

    if (!messages || messages.length === 0) {
      return [];
    }

    // Parse the messages and sort by timestamp
    const parsedMessages = messages
      .map((msg: string) => JSON.parse(msg) as Message)
      .sort((a: Message, b: Message) => a.timestamp - b.timestamp)
      .slice(-limit);

    // Return messages in the format expected by the LLM
    return parsedMessages.map(({ role, content }: Message) => ({
      role,
      content
    }));
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
}

/**
 * Format chat history for display
 */
export async function formatChatHistoryForDisplay(
  userId: string
): Promise<string> {
  const history = await getChatHistory(userId);

  if (history.length === 0) {
    return "No chat history.";
  }

  return history
    .map((message) => {
      const role = message.role === "assistant" ? "Ana" : "User";
      return `${role}: ${message.content}`;
    })
    .join("\n\n");
}

/**
 * Clear chat history for a user
 * @param userId User ID
 */
export async function clearChatHistory(userId: string): Promise<void> {
  try {
    const key = `${CHAT_HISTORY_KEY_PREFIX}${userId}`;
    await redisClient.del(key);
    console.log(`Cleared chat history for user ${userId}`);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
}

/**
 * Clean up old chat histories
 * @param maxAgeMs Maximum age of messages to keep (default: 24 hours)
 */
export async function cleanupOldChatHistory(): Promise<void> {
  try {
    // No explicit cleanup needed - Redis TTL handles this automatically
    console.log("Chat history cleanup is managed by Redis TTL");
  } catch (error) {
    console.error("Error in chat history cleanup:", error);
  }
}

// No need for interval cleanup as Redis handles TTL automatically
