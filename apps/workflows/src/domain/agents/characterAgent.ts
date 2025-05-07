import { Content, GenerativeModel, GoogleGenerativeAI, Part } from "@google/generative-ai";
import { RunnableLambda } from "@langchain/core/runnables";
import { StateGraph } from "@langchain/langgraph";

/**
 * Character configuration
 */
export interface CharacterConfig {
    /**
     * The name of the character
     */
    name: string;

    /**
     * The character's description
     */
    description: string;

    /**
     * The character's personality traits
     */
    personality: string[];

    /**
     * The character's response style
     */
    responseStyle: string;

    /**
     * Knowledge the character has
     */
    knowledge?: string[];

    /**
     * Things the character should avoid
     */
    avoid?: string[];
}

/**
 * Message interface for conversation history
 */
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

/**
 * Input for the character agent
 */
export interface CharacterAgentInput {
    /**
     * The message to process
     */
    message: string;

    /**
     * Conversation history
     */
    history: Message[];

    /**
     * Character configuration
     */
    character: CharacterConfig;

    /**
     * Additional metadata
     */
    metadata?: Record<string, any>;
}

/**
 * Output from the character agent
 */
export interface CharacterAgentOutput {
    /**
     * The generated response
     */
    response: string;

    /**
     * Enhanced conversation history
     */
    enhancedHistory: Message[];

    /**
     * Metadata about the generation
     */
    metadata?: Record<string, any>;
}

/**
 * Convert message history to Gemini format
 */
function convertHistoryToGeminiFormat(history: Message[]): Content[] {
    return history.map(message => {
        const role = message.role === "assistant" ? "model" : message.role;
        return {
            role,
            parts: [{ text: message.content }] as Part[]
        };
    });
}

/**
 * Create a system prompt based on character configuration
 */
function createSystemPrompt(character: CharacterConfig): string {
    const { name, description, personality, responseStyle, knowledge, avoid } = character;

    let prompt = `You are ${name}, ${description}. `;

    if (personality.length > 0) {
        prompt += `Your personality traits include: ${personality.join(", ")}. `;
    }

    prompt += `You respond in a ${responseStyle} style. `;

    if (knowledge && knowledge.length > 0) {
        prompt += `You have knowledge about: ${knowledge.join(", ")}. `;
    }

    if (avoid && avoid.length > 0) {
        prompt += `You always avoid: ${avoid.join(", ")}. `;
    }

    prompt += "You always stay in character and respond directly to the user's messages.";

    return prompt;
}

/**
 * Character Agent using LangGraph and Google Gemini
 */
export class CharacterAgent {
    private model: GenerativeModel;
    private temperature: number;
    private maxTokens: number;
    private graph: StateGraph;

    /**
     * Create a new character agent
     */
    constructor(apiKey: string, modelName: string, temperature = 0.7, maxTokens = 1024) {
        // Initialize Gemini API
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: modelName });
        this.temperature = temperature;
        this.maxTokens = maxTokens;

        // Create LangGraph state machine
        this.graph = new StateGraph({
            channels: {
                message: { value: "" },
                history: { value: [] as Message[] },
                character: { value: {} as CharacterConfig },
                response: { value: "" },
                metadata: { value: {} as Record<string, any> }
            }
        });

        // Add nodes to the graph
        this.graph.addNode("process_input", new RunnableLambda({ func: this.processInput.bind(this) }));
        this.graph.addNode("generate_response", new RunnableLambda({ func: this.generateResponse.bind(this) }));
        this.graph.addNode("update_history", new RunnableLambda({ func: this.updateHistory.bind(this) }));

        // Define edges
        this.graph.addEdge("process_input", "generate_response");
        this.graph.addEdge("generate_response", "update_history");

        // Set entry and exit points
        this.graph.setEntryPoint("process_input");
        this.graph.setExitPoint("update_history");

        // Compile the graph
        this.graph.compile();
    }

    /**
     * Process the input message
     */
    private async processInput(state: any) {
        const message = state.message;
        const history = state.history;
        const character = state.character;

        // Ensure there's a system message with character info
        const systemMessage: Message = {
            role: "system",
            content: createSystemPrompt(character)
        };

        // Check if we already have a system message
        const hasSystemMessage = history.some(msg => msg.role === "system");

        // Return updated state
        return {
            ...state,
            history: hasSystemMessage ? history : [systemMessage, ...history]
        };
    }

    /**
     * Generate a response using Gemini
     */
    private async generateResponse(state: any) {
        const history = state.history;
        const message = state.message;
        const metadata = state.metadata || {};

        // Add the user message to history
        const updatedHistory = [...history, { role: "user", content: message }];

        // Convert history to Gemini format
        const geminiHistory = convertHistoryToGeminiFormat(updatedHistory);

        try {
            // Generate content with Gemini
            const result = await this.model.generateContent({
                contents: geminiHistory,
                generationConfig: {
                    temperature: this.temperature,
                    maxOutputTokens: this.maxTokens
                }
            });

            // Extract the response text
            const response = result.response.text();

            // Return updated state
            return {
                ...state,
                response,
                history: updatedHistory
            };
        } catch (error) {
            console.error("Error generating response:", error);
            return {
                ...state,
                response: "I'm sorry, I encountered an error while processing your message.",
                history: updatedHistory
            };
        }
    }

    /**
     * Update the conversation history
     */
    private async updateHistory(state: any) {
        const history = state.history;
        const response = state.response;

        // Add the assistant response to history
        const updatedHistory = [...history, { role: "assistant", content: response }];

        // Return updated state
        return {
            ...state,
            enhancedHistory: updatedHistory
        };
    }

    /**
     * Process a message using the character agent
     */
    public async processMessage(input: CharacterAgentInput): Promise<CharacterAgentOutput> {
        // Run the graph
        const result = await this.graph.invoke({
            message: input.message,
            history: input.history || [],
            character: input.character,
            metadata: input.metadata || {}
        });

        // Return the output
        return {
            response: result.response,
            enhancedHistory: result.enhancedHistory,
            metadata: {
                ...input.metadata,
                model: this.model.model
            }
        };
    }
} 
