/**
 * Log a message from the user or agent
 * @param type - The type of message ("user" or "agent")
 * @param userId - The user ID
 * @param message - The message content
 */
export function logMessage(
  type: "user" | "agent",
  userId: string,
  message: string
): void {
  const timestamp = new Date().toISOString();
  const prefix = type === "user" ? "👤" : "🤖";

  console.log(
    `${timestamp} | ${prefix} [${type.toUpperCase()}][${userId}]: ${message}`
  );
}
