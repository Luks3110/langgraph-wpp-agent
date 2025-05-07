import {
    Annotation,
    END,
    MemorySaver,
    START,
    StateGraph
} from "@langchain/langgraph";
import { whatsappClient } from "../clients/whatsapp.js";
import {
    forwardToProductsAgent,
    generateResponse,
    handleError,
    processMessage
} from "./nodes.js";
import { AgentNode, AgentState, ChatMessage, WhatsAppProcessingResult } from "./types.js";

/**
 * Create the WhatsApp agent graph
 */
export function createAgentGraph() {
    const AgentStateAnnotation = Annotation.Root({
        userId: Annotation<string>(),
        input: Annotation<string>(),
        chatHistory: Annotation<ChatMessage[]>({
            reducer: (x, y) => x.concat(y)
        }),
        response: Annotation<string | undefined>(),
        shouldForwardToProducts: Annotation<boolean | undefined>(),
        actionType: Annotation<string | undefined>(),
        messageId: Annotation<string | undefined>(),
        error: Annotation<Error | undefined>()
    });

    const workflow = new StateGraph(AgentStateAnnotation)
        // Add nodes
        .addNode(AgentNode.PROCESS_MESSAGE, processMessage)
        .addNode(AgentNode.GENERATE_RESPONSE, generateResponse)
        .addNode(AgentNode.FORWARD_TO_PRODUCTS, forwardToProductsAgent)
        .addNode(AgentNode.ERROR_HANDLER, handleError)

        // Start with message processing
        .addEdge(START, AgentNode.PROCESS_MESSAGE)

        // Add conditional edges from message processing
        .addConditionalEdges(
            AgentNode.PROCESS_MESSAGE,
            (state: typeof AgentStateAnnotation.State) => {
                if (state.error) {
                    return AgentNode.ERROR_HANDLER;
                }

                // If should forward to products agent
                if (state.shouldForwardToProducts) {
                    return AgentNode.FORWARD_TO_PRODUCTS;
                }

                // If it's a greeting or customer service query
                if (state.actionType === "GREETING" || state.actionType === "CUSTOMER_SERVICE") {
                    return AgentNode.GENERATE_RESPONSE;
                }

                // Default fallback
                return AgentNode.GENERATE_RESPONSE;
            },
            {
                [AgentNode.ERROR_HANDLER]: AgentNode.ERROR_HANDLER,
                [AgentNode.FORWARD_TO_PRODUCTS]: AgentNode.FORWARD_TO_PRODUCTS,
                [AgentNode.GENERATE_RESPONSE]: AgentNode.GENERATE_RESPONSE
            }
        )

        // After forwarding to products agent, go to end
        .addConditionalEdges(
            AgentNode.FORWARD_TO_PRODUCTS,
            (state: typeof AgentStateAnnotation.State) => {
                if (state.error) {
                    return AgentNode.ERROR_HANDLER;
                }
                return END;
            },
            {
                [AgentNode.ERROR_HANDLER]: AgentNode.ERROR_HANDLER,
                [END]: END
            }
        )

        // After generating response, go to end
        .addConditionalEdges(
            AgentNode.GENERATE_RESPONSE,
            (state: typeof AgentStateAnnotation.State) => {
                if (state.error) {
                    return AgentNode.ERROR_HANDLER;
                }
                return END;
            },
            {
                [AgentNode.ERROR_HANDLER]: AgentNode.ERROR_HANDLER,
                [END]: END
            }
        )

        // From error handler to end
        .addEdge(AgentNode.ERROR_HANDLER, END);

    // Set up memory saver for state persistence
    const memory = new MemorySaver();

    // Compile the graph
    return workflow.compile({ checkpointer: memory });
}

/**
 * Run the WhatsApp agent with the given input
 */
export async function runAgent(
    userId: string,
    input: string,
    messageId: string,
    chatHistory: AgentState["chatHistory"] = []
): Promise<WhatsAppProcessingResult> {
    try {
        // Create the agent graph
        const agentGraph = createAgentGraph();

        // Create a config with thread_id based on the userId
        // This ensures persistence per user conversation
        const config = {
            configurable: {
                thread_id: userId // Use userId as the thread_id for persistence
            }
        };

        // Run the agent with the config
        const result = await agentGraph.invoke(
            {
                userId,
                input,
                messageId,
                chatHistory
            },
            config
        );

        // If there's a response, send it back through WhatsApp
        if (result.response) {
            await whatsappClient.sendMessage(userId, result.response);
            return {
                success: true,
                message: result.response
            };
        }

        // If no response (shouldn't happen with this agent design)
        return {
            success: false,
            message: "No response generated",
            error: new Error("No response was generated by the agent")
        };
    } catch (error) {
        console.error("Error running WhatsApp agent:", error);

        // Send error message through WhatsApp
        const errorMessage = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.";
        try {
            await whatsappClient.sendMessage(userId, errorMessage);
        } catch (sendError) {
            console.error("Error sending error message:", sendError);
        }

        return {
            success: false,
            message: errorMessage,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
} 
