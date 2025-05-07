import { getWhatsAppClient } from "../../infrastructure/clients/whatsapp.js";
import { MonitoringService } from "../../infrastructure/monitoring/monitoring.js";
import { NodeExecutionResult } from "../../infrastructure/types/index.js";
import { CharacterAgent, CharacterConfig } from "../agents/characterAgent.js";

/**
 * Agent node configuration
 */
export interface AgentNodeConfig {
    /**
     * The type of agent to use
     */
    agentType: "chat" | "products" | "custom";

    /**
     * The LLM model to use
     */
    model: string;

    /**
     * Character configuration
     */
    character: CharacterConfig;

    /**
     * Maximum tokens to generate
     */
    maxTokens?: number;

    /**
     * Temperature for generation
     */
    temperature?: number;

    /**
     * Whether to auto-send responses to WhatsApp
     */
    autoSendResponse?: boolean;
}

/**
 * Agent node input
 */
export interface AgentNodeInput {
    /**
     * The message to process
     */
    message: string;

    /**
     * The sender's ID (e.g., WhatsApp number)
     */
    senderId: string;

    /**
     * Optional conversation history
     */
    history?: Array<{
        role: "user" | "assistant" | "system";
        content: string;
    }>;

    /**
     * Additional context for the agent
     */
    context?: Record<string, any>;
}

/**
 * Agent node output
 */
export interface AgentNodeOutput {
    /**
     * The generated response
     */
    response: string;

    /**
     * The message ID if sent to WhatsApp
     */
    messageId?: string;

    /**
     * Whether the message was sent successfully
     */
    sent?: boolean;

    /**
     * Updated conversation history
     */
    history: Array<{
        role: "user" | "assistant" | "system";
        content: string;
    }>;

    /**
     * Metadata about the generation
     */
    metadata?: {
        model: string;
        tokensUsed?: number;
        processingTime?: number;
    };
}

// Cache for character agents
const agentCache = new Map<string, CharacterAgent>();

/**
 * Get or create a character agent
 */
function getCharacterAgent(model: string, temperature: number, maxTokens: number): CharacterAgent {
    const cacheKey = `${model}-${temperature}-${maxTokens}`;

    if (!agentCache.has(cacheKey)) {
        // Get API key from environment
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is not set");
        }

        // Create a new agent and cache it
        const agent = new CharacterAgent(apiKey, model, temperature, maxTokens);
        agentCache.set(cacheKey, agent);
    }

    return agentCache.get(cacheKey)!;
}

/**
 * Execute an agent node
 */
export async function executeAgentNode(
    config: AgentNodeConfig,
    input: AgentNodeInput,
    metadata: Record<string, any> = {}
): Promise<NodeExecutionResult<AgentNodeOutput>> {
    const monitoringService = MonitoringService.getInstance();
    const startTime = Date.now();

    try {
        // Log node execution
        console.log(`Executing agent node with input: ${JSON.stringify(input.message)}`);

        // Get the character agent
        const agent = getCharacterAgent(
            config.model,
            config.temperature || 0.7,
            config.maxTokens || 1024
        );

        // Process the message
        const result = await agent.processMessage({
            message: input.message,
            history: input.history || [],
            character: config.character,
            metadata: {
                source: metadata.source || "agent_node",
                sourceType: metadata.sourceType || config.agentType,
                actionType: metadata.actionType || "generate",
                customerId: input.senderId,
                clientId: metadata.clientId || "default",
                receivedAt: metadata.receivedAt || new Date().toISOString()
            }
        });

        // Create output
        const output: AgentNodeOutput = {
            response: result.response,
            history: result.enhancedHistory,
            metadata: {
                model: config.model,
                processingTime: Date.now() - startTime
            }
        };

        // Auto-send response if configured
        if (config.autoSendResponse && input.senderId) {
            try {
                const whatsappClient = getWhatsAppClient();
                output.messageId = await whatsappClient.sendMessage(
                    input.senderId,
                    output.response
                );
                output.sent = true;
            } catch (error) {
                console.error("Error sending WhatsApp response:", error);
                output.sent = false;
            }
        }

        // Track successful execution
        monitoringService.trackApiRequest(
            'agent_node_execution',
            config.agentType,
            200,
            Date.now() - startTime
        );

        return {
            success: true,
            output
        };
    } catch (error) {
        console.error("Error executing agent node:", error);

        // Track failed execution
        monitoringService.trackApiRequest(
            'agent_node_execution',
            config.agentType,
            500,
            Date.now() - startTime
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
} 
