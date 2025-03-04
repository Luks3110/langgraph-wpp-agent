import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { character } from '../config/character.js';
import { GOOGLE_GENERATIVE_AI_API_KEY } from '../config/env.js';
import { QdrantAdapter } from '../database/qdrant.js';
import { AgentState, ChatMessage } from './types.js';

// Initialize Google Generative AI model
const model = new ChatGoogleGenerativeAI({
    apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
    modelName: 'gemini-2.0-flash',
});

const qdrantAdapter = new QdrantAdapter();

/**
 * Create system prompt from character configuration
 */
function createSystemPrompt(): string {
    const { system, bio, style, topics, adjectives, lore } = character;

    return `
${system}

## Biografia
${bio.join('\n')}

## Estilo de Comunicação
${style.all.map(s => `- ${s}`).join('\n')}

## Estilo de Chat
${style.chat.map(s => `- ${s}`).join('\n')}

## Tópicos de Especialidade
${topics.map(t => `- ${t}`).join('\n')}

## Características
${adjectives.map(a => `- ${a}`).join('\n')}

## Informações Adicionais
${lore.map(l => `- ${l}`).join('\n')}
`;
}

/**
 * Create the character-based prompt template
 */
function createPromptTemplate() {
    // Get base system prompt from character
    const basePrompt = createSystemPrompt();

    // Create the chat prompt template with structured messaging
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(basePrompt),
        new MessagesPlaceholder('chat_history'),
        SystemMessagePromptTemplate.fromTemplate(`
Informações relevantes do banco de dados:
{context}

Lembre-se de usar essas informações para responder à pergunta do usuário, mas mantenha seu estilo de comunicação consistente com as instruções acima.`),
        ['human', '{input}'],
    ]);
}

/**
 * Create the retrieval node
 */
export async function retrieveInformation(state: AgentState): Promise<AgentState> {
    try {
        // Initialize Qdrant if needed
        if (!qdrantAdapter.isInitialized()) {
            await qdrantAdapter.initialize();
        }

        // Search for relevant documents
        const documents = await qdrantAdapter.search(state.input);

        return {
            ...state,
            documents,
        };
    } catch (error) {
        console.error('Error retrieving information:', error);
        return {
            ...state,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

/**
 * Create the generation node
 */
export async function generateResponse(state: AgentState): Promise<AgentState> {
    try {
        // Format chat history
        const chatHistory: ChatMessage[] = state.chatHistory || [];

        // Format context from documents
        const context = state.documents?.map(doc => doc.pageContent).join('\n\n') ||
            'Nenhuma informação relevante encontrada.';

        // Create prompt template
        const promptTemplate = createPromptTemplate();

        // Create the chain
        const chain = RunnableSequence.from([
            promptTemplate,
            model,
            new StringOutputParser(),
        ]);

        // Generate response
        const response = await chain.invoke({
            chat_history: chatHistory,
            context,
            input: state.input,
        });

        return {
            ...state,
            response,
        };
    } catch (error) {
        console.error('Error generating response:', error);
        return {
            ...state,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

/**
 * Create the error handling node
 */
export function handleError(state: AgentState): AgentState {
    console.error('Agent encountered an error:', state.error);

    return {
        ...state,
        response: 'Desculpe, estou enfrentando algumas dificuldades técnicas no momento. Poderia tentar novamente mais tarde?',
    };
} 
