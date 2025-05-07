import { StringOutputParser } from "@langchain/core/output_parsers";
import {
    ChatPromptTemplate,
    MessagesPlaceholder
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentRequestMessage } from "@products-monorepo/shared";
import { queueClient } from "../clients/queue.js";
import { GOOGLE_GENERATIVE_AI_API_KEY } from "../config/env.js";
import { AgentState } from "./types.js";

// Initialize Google Generative AI model
const model = new ChatGoogleGenerativeAI({
    apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
    modelName: "gemini-2.0-flash"
});

/**
 * Create message classification prompt template
 */
function createMessageClassifierPrompt() {
    return ChatPromptTemplate.fromMessages([
        [
            "system",
            `Você é um classificador de mensagens do WhatsApp para o serviço "Essência do Vale".

Sua tarefa é analisar a mensagem recebida e determinar qual ação deve ser tomada:

1. Se a mensagem for uma saudação simples como "Olá", "Oi", "Bom dia", responda com uma saudação amigável.
2. Se a mensagem for uma pergunta sobre produtos, catálogo ou compras, classifique para ser enviada ao agente de produtos.
3. Se for uma pergunta sobre atendimento, horários, política de entrega, etc., forneça informações básicas de atendimento.

Responda APENAS com uma das seguintes categorias:
- GREETING: Se for apenas uma saudação
- PRODUCT_QUERY: Se for sobre produtos, preços, catálogo ou compras
- CUSTOMER_SERVICE: Se for sobre atendimento, horários, localização, entrega, etc.`
        ],
        ["human", "{input}"]
    ]);
}

/**
 * Create a prompt template for greeting responses
 */
function createGreetingPrompt() {
    return ChatPromptTemplate.fromMessages([
        [
            "system",
            `Você é um assistente virtual da Essência do Vale, uma loja de produtos artesanais.

Sua tarefa é responder a saudações com mensagens amigáveis e acolhedoras, incentivando o cliente a conhecer os produtos.

Diretrizes:
1. Mantenha a resposta breve e amigável
2. Mencione que você é um assistente virtual da Essência do Vale
3. Pergunte como pode ajudar o cliente, sugerindo que ele pode perguntar sobre produtos
4. Use emojis relevantes para tornar a mensagem mais acolhedora

Exemplo de resposta:
"Olá! 👋 Sou o assistente virtual da Essência do Vale. Como posso ajudar você hoje? Você pode me perguntar sobre nossos produtos artesanais! 🌿"

Personalize a resposta com base na saudação do cliente (bom dia, boa tarde, etc.).`
        ],
        ["human", "{input}"]
    ]);
}

/**
 * Create a prompt template for customer service responses
 */
function createCustomerServicePrompt() {
    return ChatPromptTemplate.fromMessages([
        [
            "system",
            `Você é um assistente virtual da Essência do Vale, focado em atendimento ao cliente.

Responda a perguntas sobre horários, localização, política de entrega, formas de pagamento, etc.

Informações disponíveis:
- Horário de atendimento: Segunda a Sexta, 9h às 18h; Sábado, 9h às 13h
- Endereço: Rua das Flores, 123, Centro, São Paulo - SP
- Tempo de entrega: 3-5 dias úteis para capitais, 5-10 dias para interior
- Formas de pagamento: Cartão de crédito, PIX, boleto bancário
- Trocas e devoluções: Até 7 dias após recebimento

Diretrizes:
1. Seja sempre cordial e respeitoso
2. Forneça informações precisas usando os dados acima
3. Use emojis ocasionalmente para tornar a mensagem mais amigável
4. Se não souber alguma informação específica, oriente a enviar um email para contato@essenciadovale.com.br
5. Termine oferecendo ajuda adicional

Mantenha suas respostas concisas mas completas, não ultrapassando 3-4 linhas de texto.`
        ],
        // Chat history comes after the system message
        new MessagesPlaceholder("chat_history"),
        // User input is last
        ["human", "{input}"]
    ]);
}

/**
 * Process the incoming message and determine the action type
 */
export async function processMessage(state: AgentState): Promise<AgentState> {
    try {
        // Create the message classifier prompt
        const classifierPrompt = createMessageClassifierPrompt();

        // Create the chain
        const chain = RunnableSequence.from([
            classifierPrompt,
            model,
            new StringOutputParser()
        ]);

        // Classify the message
        const classification = await chain.invoke({
            input: state.input
        });

        console.log(`Message classification: "${classification}"`);

        // Determine if we should forward this to the products agent
        const shouldForwardToProducts = classification.trim() === "PRODUCT_QUERY";
        const actionType = classification.trim();

        // Return state with classification
        return {
            ...state,
            shouldForwardToProducts,
            actionType
        };
    } catch (error) {
        console.error("Error processing message:", error);
        return {
            ...state,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Generate a direct response for greetings and customer service inquiries
 */
export async function generateResponse(state: AgentState): Promise<AgentState> {
    try {
        if (state.actionType === "GREETING") {
            // Create the greeting prompt
            const greetingPrompt = createGreetingPrompt();

            // Create the chain
            const chain = RunnableSequence.from([
                greetingPrompt,
                model,
                new StringOutputParser()
            ]);

            // Generate greeting response
            const response = await chain.invoke({
                input: state.input
            });

            return {
                ...state,
                response
            };
        } else if (state.actionType === "CUSTOMER_SERVICE") {
            // Format chat history
            const chatHistory = state.chatHistory || [];

            // Create the customer service prompt
            const customerServicePrompt = createCustomerServicePrompt();

            // Create the chain
            const chain = RunnableSequence.from([
                customerServicePrompt,
                model,
                new StringOutputParser()
            ]);

            // Generate customer service response
            const response = await chain.invoke({
                chat_history: chatHistory,
                input: state.input
            });

            return {
                ...state,
                response
            };
        }

        // If none of the conditions match, return the state unchanged
        return state;
    } catch (error) {
        console.error("Error generating response:", error);
        return {
            ...state,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Forward message to the products agent
 */
export async function forwardToProductsAgent(state: AgentState): Promise<AgentState> {
    try {
        console.log(`Forwarding message from ${state.userId} to products agent`);

        // Prepare message for the products agent
        const message: AgentRequestMessage = {
            from: state.userId,
            text: state.input,
            timestamp: Date.now(),
            messageId: state.messageId || `whatsapp-${Date.now()}`
        };

        // Forward message to products agent via queue
        await queueClient.sendMessageToAgent(message);

        // Set response to indicate successful forwarding
        return {
            ...state,
            response: "Sua pergunta sobre produtos está sendo processada. Aguarde um momento, por favor."
        };
    } catch (error) {
        console.error("Error forwarding to products agent:", error);
        return {
            ...state,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Handle errors in the agent workflow
 */
export function handleError(state: AgentState): AgentState {
    console.error("WhatsApp agent encountered an error:", state.error);

    return {
        ...state,
        response:
            "Desculpe, estou enfrentando algumas dificuldades técnicas no momento. Poderia tentar novamente mais tarde?"
    };
} 
