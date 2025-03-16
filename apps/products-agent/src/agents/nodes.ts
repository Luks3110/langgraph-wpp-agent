import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { character } from "../config/character.js";
import { GOOGLE_GENERATIVE_AI_API_KEY } from "../config/env.js";
import { QdrantAdapter } from "../database/qdrant.js";
import { AgentState, ChatMessage } from "./types.js";
import {
  DynamicRetrievalMode,
  GoogleSearchRetrievalTool
} from "@google/generative-ai";

const searchRetrievalTool: GoogleSearchRetrievalTool = {
  googleSearchRetrieval: {
    dynamicRetrievalConfig: {
      mode: DynamicRetrievalMode.MODE_DYNAMIC,
      dynamicThreshold: 0.7
    }
  }
};
const model = new ChatGoogleGenerativeAI({
  apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
  modelName: "gemini-2.0-flash"
});

const searchRetrievalModel = new ChatGoogleGenerativeAI({
  apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
  modelName: "gemini-2.0-flash"
}).bindTools([searchRetrievalTool]);

const qdrantAdapter = new QdrantAdapter();

/**
 * Create system prompt from character configuration
 */
function createSystemPrompt(): string {
  const { system, bio, style, topics, adjectives, lore } = character;

  return `
${system}

## Biografia
${bio.join("\n")}

## Estilo de Comunicação
${style.all.map((s) => `- ${s}`).join("\n")}

## Estilo de Chat
${style.chat.map((s) => `- ${s}`).join("\n")}

## Tópicos de Especialidade
${topics.map((t) => `- ${t}`).join("\n")}

## Características
${adjectives.map((a) => `- ${a}`).join("\n")}

## Informações Adicionais
${lore.map((l) => `- ${l}`).join("\n")}
`;
}

/**
 * Create the character-based prompt template
 */
function createPromptTemplate() {
  // Get base system prompt from character
  const basePrompt = createSystemPrompt();

  // Create the chat prompt template with system message first
  return ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`${basePrompt}

Informações relevantes do banco de dados:
{context}

Instruções específicas:
1. Você deve oferecer informações precisas e completas sobre os produtos mostrados acima.
2. Destaque características como preço, disponibilidade, desconto e detalhes específicos dos produtos.
3. Se o usuário fizer perguntas sobre produtos específicos, responda diretamente com informações desses produtos.
4. Se houver vários produtos semelhantes, compare-os para ajudar o cliente a escolher.
5. Inclua detalhes de preço, desconto e qualidade nas suas recomendações.
6. Se um produto estiver fora de estoque, informe claramente e sugira alternativas.
7. Na formatação, para negrito use por exemplo: *negrito*
8. Use sempre emojis junto ao nome do produto, por exemplo: *💻 Notebook Gamer Acer Nitro 5*

O tópico atual da conversa é: {topic}
Pergunta atual do usuário: {input}

Lembre-se de usar essas informações para responder à pergunta do usuário, mas mantenha seu estilo de comunicação consistente com as instruções acima.`),
    // Chat history comes after the system message
    new MessagesPlaceholder("chat_history"),
    // User input is last
    ["human", "{input}"]
  ]);
}

/**
 * Create a prompt template for FAQ responses
 */
function createFAQPromptTemplate() {
  // Get base system prompt from character
  const basePrompt = createSystemPrompt();

  // Create the chat prompt template with system message first
  return ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`${basePrompt}

Informações relevantes do banco de dados FAQ:
{faq_context}

Instruções específicas:
1. Você deve responder perguntas relacionadas à empresa Essência do Vale com base nas informações de FAQ acima.
2. Mantenha suas respostas amigáveis, claras e diretas.
3. Use emojis relevantes para tornar a resposta mais acolhedora.
4. Se a pergunta do usuário não estiver completamente respondida com as informações do FAQ, mencione isso e ofereça ajuda adicional.
5. Na formatação, para negrito use por exemplo: *negrito*

Pergunta atual do usuário: {input}

Lembre-se de usar essas informações para responder à pergunta do usuário, mas mantenha seu estilo de comunicação consistente com as instruções acima.`),
    // Chat history comes after the system message
    new MessagesPlaceholder("chat_history"),
    // User input is last
    ["human", "{input}"]
  ]);
}

/**
 * Create a prompt template for query improvement
 */
function createQueryImprovementPrompt() {
  return ChatPromptTemplate.fromMessages([
    [
      "system",
      `Você é um especialista em melhorar consultas de pesquisa para um sistema de busca de produtos.

Sua tarefa é transformar uma consulta de usuário comum em uma consulta estruturada que retornará melhores resultados em uma pesquisa vetorial.

Diretrizes:
1. Identifique os tipos de produtos mencionados ou implícitos na consulta
2. Adicione termos de produto específicos (como marca, tipo, categoria)
3. Adicione atributos relevantes (como tamanho, cor, faixa de preço)
4. Remova palavras desnecessárias como "me mostre", "eu quero", etc.
5. Mantenha a consulta concisa e focada (máximo 10 palavras)
6. Concentre-se em termos que provavelmente estão no banco de dados de produtos

Exemplos:
- "Quero ver celulares baratos" → "smartphones preço baixo econômicos"
- "Preciso de uma blusa para o trabalho" → "camisa social formal escritório"
- "Algo para dar de presente para minha namorada" → "presentes femininos acessórios joias"

Sempre retorne apenas a consulta melhorada, sem explicações ou texto adicional.`
    ],
    ["human", "{input}"]
  ]);
}

/**
 * Create a prompt template for FAQ classification
 */
function createFAQClassifierPrompt() {
  return ChatPromptTemplate.fromMessages([
    [
      "system",
      `Você é um classificador especializado em determinar se uma pergunta está relacionada a informações gerais da empresa Essência do Vale ou se é uma consulta de produto.

Sua tarefa é analisar a pergunta do usuário e determinar se ela está perguntando sobre:
1. Informações gerais da empresa (como histórico, políticas, contato, entregas, pagamentos)
2. Perguntas frequentes (FAQ) sobre a empresa
3. Ou se está buscando informações sobre produtos específicos
4. TUDO QUE TIVER ESSENCIA DO VALE É FAQ
5. Perguntas sobre o que é Essência do Vale, sua história, sua missão, seus valores, etc, são FAQ.

Exemplos de perguntas sobre informações da empresa ou FAQ:
- "Como posso acompanhar meu pedido?"
- "Quais são as formas de pagamento?"
- "Vocês entregam em todo o Brasil?"
- "Como posso cancelar meu pedido?"
- "Quem fundou a Essência do Vale?"
- "Qual é o prazo de entrega?"
- "Os produtos têm garantia?"
- "É seguro comprar no site de vocês?"
- "O que é a Essência do Vale e por que preciso me cadastrar?"
- "Quem são as pessoas que trabalham na Essência do Vale?"
- "Qual é a missão da Essência do Vale?"
- "Como a Essência do Vale contribui para a comunidade?"
- "Quais são os valores da Essência do Vale?"
- "Como a Essência do Vale é diferente das outras marcas de produtos de beleza?"
- "Quais são os diferenciais da Essência do Vale?"
- "O que é a Essência do Vale?"
- "Quais são os produtos da Essência do Vale?"
- "Quais são os serviços da Essência do Vale?"
- "Quais são as políticas da Essência do Vale?"
- "Quais são as formas de contato da Essência do Vale?"
- "Quais são as redes sociais da Essência do Vale?"



Exemplos de perguntas sobre produtos:
- "Vocês têm doce de leite sem açúcar?"
- "Quanto custa a geleia de morango?"
- "Quais são os ingredientes da geleia?"
- "Tem produtos sem açúcar?"
- "Vocês vendem compotas?"
- "Qual patê é mais vendido?"

Responda APENAS com "FAQ" se for uma pergunta relacionada a informações da empresa ou FAQ, ou "PRODUTO" se for uma pergunta sobre produtos.`
    ],
    ["human", "{input}"]
  ]);
}

/**
 * Improve the user query for better product search
 */
export async function improveQuery(state: AgentState): Promise<AgentState> {
  try {
    // Use the original query if short queries
    if (state.input.length < 5) {
      console.log("Query too short, using original:", state.input);
      return state;
    }

    // Check cache for similar query improvements first
    try {
      const cachedImprovement = await qdrantAdapter.findSimilarCachedQuery(
        state.input,
        "query_improvement"
      );

      if (cachedImprovement) {
        console.log(
          `🔍 [Improve] Using cached query improvement (similarity: ${cachedImprovement.similarity.toFixed(2)})`
        );
        console.log(
          `Original: "${state.input}" → Improved: "${cachedImprovement.response}"`
        );

        return {
          ...state,
          originalInput: state.input,
          input: cachedImprovement.response
        };
      }
    } catch (cacheError) {
      // If cache check fails, continue with normal improvement
      console.log("Cache check failed, falling back to LLM query improvement");
    }

    // Create the query improvement prompt
    const queryPrompt = createQueryImprovementPrompt();

    // Create the chain
    const chain = RunnableSequence.from([
      queryPrompt,
      model,
      new StringOutputParser()
    ]);

    // Generate improved query
    const improvedQuery = await chain.invoke({
      input: state.input
    });

    console.log(`Original query: "${state.input}"`);
    console.log(`Improved query: "${improvedQuery}"`);

    // Cache the query improvement
    await qdrantAdapter.cacheQueryResponse(
      state.input,
      improvedQuery,
      "query_improvement"
    );

    // Return state with improved query
    return {
      ...state,
      originalInput: state.input,
      input: improvedQuery
    };
  } catch (error) {
    console.error("Error improving query:", error);
    // If improvement fails, continue with original query
    return state;
  }
}

/**
 * Classify if the query is related to FAQ or products
 */
export async function classifyFAQQuery(state: AgentState): Promise<AgentState> {
  try {
    // Check if FAQ collection exists and has data
    const hasFAQData = await qdrantAdapter.hasFAQData();
    console.log("🚀 ~ classifyFAQQuery ~ hasFAQData:", hasFAQData);
    if (!hasFAQData) {
      console.log("No FAQ data available, skipping FAQ classification");
      return {
        ...state,
        isFAQQuery: false
      };
    }

    // Create the FAQ classifier prompt
    const classifierPrompt = createFAQClassifierPrompt();

    // Create the chain
    const chain = RunnableSequence.from([
      classifierPrompt,
      model,
      new StringOutputParser()
    ]);

    // Classify the query
    const classification = await chain.invoke({
      input: state.input
    });
    console.log("🚀 ~ classifyFAQQuery ~ classification:", classification);

    const isFAQQuery = classification.trim().toUpperCase() === "FAQ";
    console.log(`Query classification: "${classification}"`);
    console.log(`Is FAQ query: ${isFAQQuery}`);

    // Return state with classification
    return {
      ...state,
      isFAQQuery
    };
  } catch (error) {
    console.error("Error classifying query:", error);
    // If classification fails, assume it's not a FAQ query
    return {
      ...state,
      isFAQQuery: false
    };
  }
}

/**
 * Retrieve FAQ information for a query
 */
export async function retrieveFAQInformation(
  state: AgentState
): Promise<AgentState> {
  try {
    // Initialize Qdrant if needed
    if (!qdrantAdapter.isInitialized()) {
      await qdrantAdapter.initialize();
    }

    // Search for FAQ information
    const faqResults = await qdrantAdapter.searchFAQ(state.input);

    console.log(`Found ${faqResults.length} FAQ results`);

    return {
      ...state,
      faqResults
    };
  } catch (error) {
    console.error("Error retrieving FAQ information:", error);
    return {
      ...state,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Generate response for FAQ queries
 */
export async function generateFAQResponse(
  state: AgentState
): Promise<AgentState> {
  try {
    // Format chat history
    const chatHistory: ChatMessage[] = state.chatHistory || [];

    // Format the FAQ context
    const faqContext =
      state.faqResults
        ?.map((result) => {
          return `
Pergunta: ${result.question}
Resposta: ${result.answer}
(Relevância: ${(result.similarity * 100).toFixed(1)}%)
`;
        })
        .join("\n\n") || "Nenhuma informação de FAQ encontrada.";

    // Create the prompt template
    const promptTemplate = createFAQPromptTemplate();

    // Create the chain
    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser()
    ]);

    // Generate the response
    const response = await chain.invoke({
      chat_history: chatHistory,
      faq_context: faqContext,
      input: state.input
    });

    // Cache the response
    const originalQuery = state.originalInput || state.input;
    await qdrantAdapter.cacheQueryResponse(originalQuery, response);

    return {
      ...state,
      response
    };
  } catch (error) {
    console.error("Error generating FAQ response:", error);
    return {
      ...state,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Create the retrieval node
 */
export async function retrieveInformation(
  state: AgentState
): Promise<AgentState> {
  try {
    // Initialize Qdrant if needed
    if (!qdrantAdapter.isInitialized()) {
      await qdrantAdapter.initialize();
    }

    // Try to find a cached response for a similar query BEFORE doing search
    const originalQuery = state.originalInput || state.input;
    const cachedResult =
      await qdrantAdapter.findSimilarCachedQuery(originalQuery);

    if (cachedResult) {
      console.log(
        `🎯 [Retrieval] Using cached response (similarity: ${cachedResult.similarity.toFixed(2)}) for query: "${cachedResult.originalQuery}"`
      );
      return {
        ...state,
        documents: [], // No need to retrieve documents
        cachedResponse: cachedResult.response // Store cached response
      };
    }

    // Only search if no cache hit
    console.log("💫 No cache hit, searching for relevant documents...");
    const documents = await qdrantAdapter.searchKnowledge({
      query: state.input,
      k: 5
    });

    return {
      ...state,
      documents
    };
  } catch (error) {
    console.error("Error retrieving information:", error);
    return {
      ...state,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Create the generation node
 */
export async function generateResponse(state: AgentState): Promise<AgentState> {
  try {
    // Initialize Qdrant if needed
    if (!(await qdrantAdapter.isInitialized())) {
      await qdrantAdapter.initialize();
    }

    // If we already have a cached response from retrieval, use it
    if (state.cachedResponse) {
      console.log("🎯 Using cached response from retrieval stage");
      return {
        ...state,
        response: state.cachedResponse
      };
    }

    // Format chat history
    const chatHistory: ChatMessage[] = state.chatHistory || [];

    // Format context from documents
    const context =
      state.documents
        ?.map((doc) => {
          // Extract product info from metadata
          const product = doc.metadata;
          if (!product) return "";

          // Format product details as readable text
          return `
Produto: ${product.title || ""}
Marca: ${product.brand || ""}
Categoria: ${product.category || ""} > ${product.sub_category || ""}
Preço original: R$ ${product.actual_price || "N/A"}
Preço promocional: R$ ${product.selling_price || "N/A"}
Desconto: ${product.discount || "Sem desconto"}
Avaliação: ${product.average_rating || "Sem avaliação"} estrelas
Disponibilidade: ${product.out_of_stock ? "Fora de estoque" : "Em estoque"}
${product.product_details ? `Detalhes: ${JSON.stringify(product.product_details)}` : ""}
ID: ${product.product_id || doc.id}
`;
        })
        .join("\n\n") || "Nenhuma informação relevante encontrada.";

    // Create prompt template
    const promptTemplate = createPromptTemplate();

    // Create the chain
    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser()
    ]);

    // Generate response
    const response = await chain.invoke({
      chat_history: chatHistory,
      context,
      input: state.input,
      topic: "produtos"
    });

    // Cache the original query with the generated response
    const originalQuery = state.originalInput || state.input;
    await qdrantAdapter.cacheQueryResponse(originalQuery, response);

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
}

/**
 * Create the error handling node
 */
export function handleError(state: AgentState): AgentState {
  console.error("Agent encountered an error:", state.error);

  return {
    ...state,
    response:
      "Desculpe, estou enfrentando algumas dificuldades técnicas no momento. Poderia tentar novamente mais tarde?"
  };
}
