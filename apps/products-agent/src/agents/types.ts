import { Document } from "@langchain/core/documents";

/**
 * Enumeration of agent nodes
 */
export enum AgentNode {
  IMPROVE_QUERY = "improve_query",
  CLASSIFY_FAQ = "classify_faq",
  RETRIEVE_FAQ = "retrieve_faq",
  GENERATE_FAQ = "generate_faq",
  RETRIEVE = "retrieve",
  GENERATE = "generate",
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
 * Type definition for FAQ result
 */
export type FAQResult = {
  id: string | number;
  question: string;
  answer: string;
  similarity: number;
};

/**
 * Type definition for agent state
 */
export type AgentState = {
  userId: string;
  input: string;
  originalInput?: string;
  chatHistory?: ChatMessage[];
  documents?: Document<Record<string, any>>[];
  response?: string;
  cachedResponse?: string;
  error?: Error;
  isFAQQuery?: boolean;
  faqResults?: FAQResult[];
};

// Agent action types
export enum AgentAction {
  RETRIEVE_INFORMATION = "retrieve_information",
  GENERATE_RESPONSE = "generate_response",
  HANDLE_ERROR = "handle_error",
  IMPROVE_QUERY = "improve_query"
}
