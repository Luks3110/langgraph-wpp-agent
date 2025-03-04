import { Document } from '@langchain/core/documents';

// State interface for the agent
export interface AgentState {
    // Input from the user
    input: string;

    // User information
    userId: string;

    // Chat history
    chatHistory: ChatMessage[];

    // Retrieved documents from vector store
    documents?: Document[];

    // Agent's response
    response?: string;

    // Error information
    error?: Error;
}

// Chat message interface
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Agent action types
export enum AgentAction {
    RETRIEVE_INFORMATION = 'retrieve_information',
    GENERATE_RESPONSE = 'generate_response',
    HANDLE_ERROR = 'handle_error',
}

// Node names for the agent graph
export enum AgentNode {
    START = 'start',
    RETRIEVE = 'retrieve',
    GENERATE = 'generate',
    ERROR = 'error',
    END = 'end',
} 
