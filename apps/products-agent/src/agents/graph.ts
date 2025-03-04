import { Document } from '@langchain/core/documents';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { generateResponse, handleError, retrieveInformation } from './nodes.js';
import { AgentNode, AgentState, ChatMessage } from './types.js';

/**
 * Create the agent graph
 */
export function createAgentGraph() {
    const AgentStateAnnotation = Annotation.Root({
        input: Annotation<string>(),
        userId: Annotation<string>(),
        chatHistory: Annotation<ChatMessage[]>({
            reducer: (x, y) => x.concat(y),
        }),
        documents: Annotation<Document<Record<string, any>>[] | undefined>(),
        response: Annotation<string | undefined>(),
        error: Annotation<Error | undefined>(),
    });

    const workflow = new StateGraph(AgentStateAnnotation)
        .addNode(AgentNode.RETRIEVE, retrieveInformation)
        .addNode(AgentNode.GENERATE, generateResponse)
        .addNode(AgentNode.ERROR, handleError)
        .addEdge(START, AgentNode.RETRIEVE)
        .addConditionalEdges(
            AgentNode.RETRIEVE,
            (state: typeof AgentStateAnnotation.State) => {
                if (state.error) {
                    return AgentNode.ERROR;
                }
                return AgentNode.GENERATE;
            },
            {
                [AgentNode.ERROR]: AgentNode.ERROR,
                [AgentNode.GENERATE]: AgentNode.GENERATE,
            }
        )
        .addConditionalEdges(
            AgentNode.GENERATE,
            (state: typeof AgentStateAnnotation.State) => {
                if (state.error) {
                    return AgentNode.ERROR;
                }
                return END;
            },
            {
                [AgentNode.ERROR]: AgentNode.ERROR,
                [END]: END,
            }
        )
        .addEdge(AgentNode.ERROR, END);

    // Set up memory saver for state persistence
    const memory = new MemorySaver();

    // Compile the graph
    return workflow.compile({ checkpointer: memory });
}

/**
 * Run the agent with the given input
 */
export async function runAgent(
    userId: string,
    input: string,
    chatHistory: AgentState['chatHistory'] = []
): Promise<string> {
    try {
        // Create the agent graph
        const agentGraph = createAgentGraph();

        // Run the agent
        const result = await agentGraph.invoke({
            input,
            userId,
            chatHistory,
        });

        // Return the response
        return result.response || 'Desculpe, não consegui processar sua solicitação.';
    } catch (error) {
        console.error('Error running agent:', error);
        return 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.';
    }
} 
