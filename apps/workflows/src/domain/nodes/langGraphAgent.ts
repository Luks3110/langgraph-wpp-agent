import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
    Annotation,
    END,
    MemorySaver,
    START,
    StateGraph
} from "@langchain/langgraph";
import { MonitoringService } from "../../infrastructure/monitoring/monitoring.js";
import { NodeExecutionResult } from "../../infrastructure/types/index.js";

/**
 * LangGraph agent configuration
 */
export interface LangGraphAgentConfig {
    /**
     * The LLM model to use
     */
    model: string;

    /**
     * Character configuration
     */
    character: {
        name: string;
        description: string;
        personality: string[];
        responseStyle: string;
        knowledge?: string[];
        avoid?: string[];
    };

    /**
     * Maximum tokens to generate
     */
    maxTokens?: number;

    /**
     * Temperature for generation
     */
    temperature?: number;
}

/**
 * LangGraph agent node input
 */
export interface LangGraphAgentInput {
    /**
     * The message to process
     */
    message: string;

    /**
     * The unique identifier for the conversation
     */
    conversationId: string;

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
 * LangGraph agent node output
 */
export interface LangGraphAgentOutput {
    /**
     * The generated response
     */
    response: string;

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
        intentType?: string;
    };
}

/**
 * Agent state type
 */
type AgentState = {
    input: string;
    conversationId: string;
    chatHistory: Array<{
        role: "human" | "ai" | "system";
        content: string;
    }>;
    response?: string;
    intent?: string;
    error?: Error;
};

// Cache for agent graphs
const agentGraphCache = new Map<string, any>();

/**
 * Get or create a LangGraph agent
 */
function getAgentGraph(apiKey: string, model: string, temperature: number, maxTokens: number): any {
    const cacheKey = `${model}-${temperature}-${maxTokens}`;

    if (!agentGraphCache.has(cacheKey)) {
        // Create Google Generative AI model
        const chatModel = new ChatGoogleGenerativeAI({
            apiKey: apiKey,
            modelName: model,
            maxOutputTokens: maxTokens,
            temperature: temperature
        });

        // Create state definition
        const AgentStateAnnotation = Annotation.Root({
            input: Annotation<string>(),
            conversationId: Annotation<string>(),
            chatHistory: Annotation<Array<{
                role: "human" | "ai" | "system";
                content: string;
            }>>({
                reducer: (x, y) => x.concat(y)
            }),
            response: Annotation<string | undefined>(),
            intent: Annotation<string | undefined>(),
            error: Annotation<Error | undefined>()
        });

        // Create prompt for intent classification
        const intentClassifierPrompt = ChatPromptTemplate.fromMessages([
            [
                "system",
                `You are an intent classifier. Your task is to analyze the user's message and determine their intent.
                
Identify the intent as one of the following:
- GREETING: Simple greetings like "hello", "hi", etc.
- QUESTION: User is asking for information
- INSTRUCTION: User is requesting you to do something
- CLARIFICATION: User is asking for clarification about something
- FEEDBACK: User is providing feedback
- CHITCHAT: User is making small talk
- FAREWELL: User is saying goodbye

Respond ONLY with the intent label, nothing else.`
            ],
            ["human", "{input}"]
        ]);

        // Create a function to classify intent
        const classifyIntent = async (state: AgentState): Promise<AgentState> => {
            try {
                const chain = RunnableSequence.from([
                    intentClassifierPrompt,
                    chatModel,
                    new StringOutputParser()
                ]);

                // Classify the intent
                const intent = await chain.invoke({
                    input: state.input
                });

                console.log(`Intent classification: "${intent}"`);

                return {
                    ...state,
                    intent: intent.trim()
                };
            } catch (error) {
                console.error("Error classifying intent:", error);
                return {
                    ...state,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        };

        // Create prompt for response generation
        const responseGeneratorPrompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(`You are a helpful assistant.
Intent: {intent}

Respond to the user appropriately based on their intent.`),
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"]
        ]);

        // Create a function to generate response
        const generateResponse = async (state: AgentState): Promise<AgentState> => {
            try {
                const chain = RunnableSequence.from([
                    responseGeneratorPrompt,
                    chatModel,
                    new StringOutputParser()
                ]);

                // Generate response
                const response = await chain.invoke({
                    chat_history: state.chatHistory,
                    input: state.input,
                    intent: state.intent || "UNKNOWN"
                });

                return {
                    ...state,
                    response
                };
            } catch (error) {
                console.error("Error generating response:", error);
                return {
                    ...state,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        };

        // Create a function to handle errors
        const handleError = (state: AgentState): AgentState => {
            console.error("Agent encountered an error:", state.error);

            return {
                ...state,
                response: "I'm sorry, I encountered an error while processing your message. Please try again later."
            };
        };

        // Create the state graph
        const workflow = new StateGraph(AgentStateAnnotation)
            // Add nodes
            .addNode("classify_intent", classifyIntent)
            .addNode("generate_response", generateResponse)
            .addNode("error_handler", handleError)

            // Start with intent classification
            .addEdge(START, "classify_intent")

            // Add conditional edges from intent classification
            .addConditionalEdges(
                "classify_intent",
                (state: typeof AgentStateAnnotation.State) => {
                    if (state.error) {
                        return "error_handler";
                    }
                    return "generate_response";
                },
                {
                    "error_handler": "error_handler",
                    "generate_response": "generate_response"
                }
            )

            // After generating response, go to end
            .addConditionalEdges(
                "generate_response",
                (state: typeof AgentStateAnnotation.State) => {
                    if (state.error) {
                        return "error_handler";
                    }
                    return END;
                },
                {
                    "error_handler": "error_handler",
                    [END]: END
                }
            )

            // From error handler to end
            .addEdge("error_handler", END);

        // Set up memory saver for state persistence
        const memory = new MemorySaver();

        // Compile the graph
        const compiledGraph = workflow.compile({ checkpointer: memory });
        agentGraphCache.set(cacheKey, compiledGraph);
    }

    return agentGraphCache.get(cacheKey)!;
}

/**
 * Execute a LangGraph agent node
 */
export async function executeLangGraphAgent(
    config: LangGraphAgentConfig,
    input: LangGraphAgentInput,
    metadata: Record<string, any> = {}
): Promise<NodeExecutionResult<LangGraphAgentOutput>> {
    const monitoringService = MonitoringService.getInstance();
    const startTime = Date.now();

    try {
        // Log node execution
        console.log(`Executing LangGraph agent node with input: ${JSON.stringify(input.message)}`);

        // Get API key from environment
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set");
        }

        // Get the agent graph
        const agentGraph = getAgentGraph(
            apiKey,
            config.model,
            config.temperature || 0.7,
            config.maxTokens || 1024
        );

        // Prepare chat history in the format expected by LangGraph
        const chatHistory = (input.history || []).map(msg => ({
            role: msg.role === "user" ? "human" : msg.role === "assistant" ? "ai" : "system",
            content: msg.content
        }));

        // Prepare input data for the agent
        const inputData = {
            input: input.message,
            conversationId: input.conversationId,
            chatHistory: chatHistory
        };

        // Run the agent
        const graphConfig = {
            configurable: {
                thread_id: input.conversationId
            }
        };

        // Execute the agent graph
        const result = await agentGraph.invoke(inputData, graphConfig);

        // Add user message to history
        const userMessage = { role: "human" as const, content: input.message };
        const assistantMessage = { role: "ai" as const, content: result.response };
        const updatedHistory = [...chatHistory, userMessage, assistantMessage];

        // Create output
        const output: LangGraphAgentOutput = {
            response: result.response,
            history: updatedHistory.map(msg => ({
                role: msg.role === "human" ? "user" : msg.role === "ai" ? "assistant" : "system",
                content: msg.content
            })),
            metadata: {
                model: config.model,
                processingTime: Date.now() - startTime,
                intentType: result.intent
            }
        };

        // Track successful execution
        monitoringService.trackApiRequest(
            'langgraph_agent_execution',
            config.model,
            200,
            Date.now() - startTime
        );

        return {
            success: true,
            output
        };
    } catch (error) {
        console.error("Error executing LangGraph agent node:", error);

        // Track failed execution
        monitoringService.trackApiRequest(
            'langgraph_agent_execution',
            config.model,
            500,
            Date.now() - startTime
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
} 
