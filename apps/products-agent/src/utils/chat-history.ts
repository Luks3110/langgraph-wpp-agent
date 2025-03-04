
// Define the message type
type MessageRole = 'user' | 'assistant';

// Define the message interface
interface Message {
    role: MessageRole;
    content: string;
    timestamp: number;
}

// Maximum number of messages to keep in history
const MAX_HISTORY_LENGTH = 10;

// Map to store chat history by user ID
const chatHistoryMap = new Map<string, Message[]>();

/**
 * Clear chat history older than the specified time window
 * @param maxAgeMs Maximum age of messages to keep (default: 1 hour)
 */
export function cleanupOldChatHistory(maxAgeMs = 60 * 60 * 1000): void {
    const now = Date.now();

    chatHistoryMap.forEach((messages, userId) => {
        // Filter out messages older than maxAgeMs
        const recentMessages = messages.filter(
            (message) => now - message.timestamp < maxAgeMs
        );

        if (recentMessages.length === 0) {
            // Remove user from map if no recent messages
            chatHistoryMap.delete(userId);
        } else if (recentMessages.length < messages.length) {
            // Update with only recent messages
            chatHistoryMap.set(userId, recentMessages);
        }
    });
}

/**
 * Add a message to the chat history
 * @param userId User ID
 * @param role Message role (user or assistant)
 * @param content Message content
 */
export function addMessageToHistory(
    userId: string,
    role: MessageRole,
    content: string
): void {
    if (!chatHistoryMap.has(userId)) {
        chatHistoryMap.set(userId, []);
    }

    const message: Message = {
        role,
        content,
        timestamp: Date.now(),
    };

    chatHistoryMap.get(userId)?.push(message);
}

/**
 * Get chat history for a user
 * @param userId User ID
 * @param limit Maximum number of messages to return (default: 10)
 * @returns Array of messages
 */
export function getChatHistory(
    userId: string,
    limit = 10
): { role: MessageRole | "system"; content: string }[] {
    if (!chatHistoryMap.has(userId)) {
        return [];
    }

    // Get messages and take the last 'limit' messages
    const messages = chatHistoryMap.get(userId) || [];
    const limitedMessages = messages.slice(-limit);

    // Return messages in a format suitable for LLM (without timestamps)
    return limitedMessages.map(({ role, content }) => ({
        role,
        content,
    }));
}

/**
 * Format chat history for display
 */
export function formatChatHistoryForDisplay(userId: string): string {
    const history = getChatHistory(userId);

    if (history.length === 0) {
        return 'No chat history.';
    }

    return history
        .map((message) => {
            const role = message.role === 'assistant' ? 'Ana' : 'User';
            return `${role}: ${message.content}`;
        })
        .join('\n\n');
}

// Set up a periodic cleanup task (every 30 minutes)
setInterval(() => {
    cleanupOldChatHistory();
}, 30 * 60 * 1000); 
