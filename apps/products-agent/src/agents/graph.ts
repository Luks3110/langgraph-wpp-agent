import { Document } from "@langchain/core/documents";
import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph
} from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import {
  classifyFAQQuery,
  generateFAQResponse,
  generateResponse,
  handleError,
  improveQuery,
  retrieveFAQInformation,
  retrieveInformation
} from "./nodes.js";
import { AgentNode, AgentState, ChatMessage, FAQResult } from "./types.js";

/**
 * Create the agent graph
 */
export function createAgentGraph() {
  const AgentStateAnnotation = Annotation.Root({
    input: Annotation<string>(),
    originalInput: Annotation<string | undefined>(),
    userId: Annotation<string>(),
    chatHistory: Annotation<ChatMessage[]>({
      reducer: (x, y) => x.concat(y)
    }),
    documents: Annotation<Document<Record<string, any>>[] | undefined>(),
    faqResults: Annotation<FAQResult[] | undefined>(),
    isFAQQuery: Annotation<boolean | undefined>(),
    response: Annotation<string | undefined>(),
    cachedResponse: Annotation<string | undefined>(),
    error: Annotation<Error | undefined>()
  });

  const workflow = new StateGraph(AgentStateAnnotation)
    // Add nodes
    .addNode(AgentNode.IMPROVE_QUERY, improveQuery)
    .addNode(AgentNode.CLASSIFY_FAQ, classifyFAQQuery)
    .addNode(AgentNode.RETRIEVE_FAQ, retrieveFAQInformation)
    .addNode(AgentNode.GENERATE_FAQ, generateFAQResponse)
    .addNode(AgentNode.RETRIEVE, retrieveInformation)
    .addNode(AgentNode.GENERATE, generateResponse)
    .addNode(AgentNode.ERROR_HANDLER, handleError)

    // Start with FAQ classification
    .addEdge(START, AgentNode.CLASSIFY_FAQ)

    // Add conditional edge from FAQ classifier
    .addConditionalEdges(
      AgentNode.CLASSIFY_FAQ,
      (state: typeof AgentStateAnnotation.State) => {
        if (state.error) {
          return AgentNode.ERROR_HANDLER;
        }

        // If classified as FAQ, go to FAQ retrieval path
        if (state.isFAQQuery) {
          return AgentNode.RETRIEVE_FAQ;
        }

        // If product query, improve it first
        return AgentNode.IMPROVE_QUERY;
      },
      {
        [AgentNode.ERROR_HANDLER]: AgentNode.ERROR_HANDLER,
        [AgentNode.RETRIEVE_FAQ]: AgentNode.RETRIEVE_FAQ,
        [AgentNode.IMPROVE_QUERY]: AgentNode.IMPROVE_QUERY
      }
    )

    // After improving product query, go to retrieval
    .addEdge(AgentNode.IMPROVE_QUERY, AgentNode.RETRIEVE)

    // Handle FAQ retrieval outcomes
    .addConditionalEdges(
      AgentNode.RETRIEVE_FAQ,
      (state: typeof AgentStateAnnotation.State) => {
        if (state.error) {
          return AgentNode.ERROR_HANDLER;
        }
        return AgentNode.GENERATE_FAQ;
      },
      {
        [AgentNode.ERROR_HANDLER]: AgentNode.ERROR_HANDLER,
        [AgentNode.GENERATE_FAQ]: AgentNode.GENERATE_FAQ
      }
    )

    // After FAQ generation, go to end
    .addConditionalEdges(
      AgentNode.GENERATE_FAQ,
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

    // Handle product retrieval outcomes
    .addConditionalEdges(
      AgentNode.RETRIEVE,
      (state: typeof AgentStateAnnotation.State) => {
        if (state.error) {
          return AgentNode.ERROR_HANDLER;
        }
        return AgentNode.GENERATE;
      },
      {
        [AgentNode.ERROR_HANDLER]: AgentNode.ERROR_HANDLER,
        [AgentNode.GENERATE]: AgentNode.GENERATE
      }
    )

    // After product response generation, go to end
    .addConditionalEdges(
      AgentNode.GENERATE,
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
 * Run the agent with the given input
 */
export async function runAgent(
  userId: string,
  input: string,
  chatHistory: AgentState["chatHistory"] = []
): Promise<string> {
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
        input,
        userId,
        chatHistory
      },
      config
    );

    // Return the response
    return (
      result.response || "Desculpe, não consegui processar sua solicitação."
    );
  } catch (error) {
    console.error("Error running agent:", error);
    return "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.";
  }
}
