import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { redisClient } from '../clients/redis.js';
import { GOOGLE_GENERATIVE_AI_API_KEY, QDRANT_URL } from '../config/env.js';

// Collection name for products
const COLLECTION_NAME = 'flipkart-fashion';
// Redis key for tracking Qdrant initialization
const QDRANT_INITIALIZED_KEY = 'qdrant:initialized';

/**
 * Adapter for the Qdrant vector database
 */
export class QdrantAdapter {
    private client: QdrantClient;
    private embeddings: GoogleGenerativeAIEmbeddings;
    private vectorStore: QdrantVectorStore | null = null;
    private collectionName: string = COLLECTION_NAME;

    constructor() {
        // Initialize Qdrant client
        this.client = new QdrantClient({
            url: QDRANT_URL,
        });

        // Initialize embeddings with Google Generative AI
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
            modelName: 'text-embedding-004',
        });
    }

    /**
     * Initialize the vector store
     */
    public async initialize(): Promise<void> {
        try {
            // List collections to check if products collection exists
            const collections = await this.client.getCollections();
            const collectionExists = collections.collections.some(
                (collection: any) => collection.name === this.collectionName
            );

            if (!collectionExists) {
                console.log(`Collection '${this.collectionName}' does not exist. Creating...`);
                await this.createCollection();
            }

            // Create vector store instance
            this.vectorStore = await QdrantVectorStore.fromExistingCollection(
                this.embeddings,
                {
                    client: this.client,
                    collectionName: this.collectionName,
                }
            );

            // Mark as initialized in Redis for other workers
            await redisClient.set(QDRANT_INITIALIZED_KEY, 'true');
            console.log('Vector store initialized successfully');
        } catch (error) {
            console.error('Error initializing vector store:', error);
            throw error;
        }
    }

    /**
     * Create a new collection for products
     */
    private async createCollection(): Promise<void> {
        try {
            await this.client.createCollection(this.collectionName, {
                vectors: {
                    size: 768, // Dimension size for Google's embedding model
                    distance: 'Cosine',
                },
            });
            console.log(`Collection '${this.collectionName}' created successfully`);
        } catch (error) {
            console.error(`Error creating collection '${this.collectionName}':`, error);
            throw error;
        }
    }

    /**
     * Search for products by similarity
     */
    public async similaritySearch(query: string, k = 5): Promise<any[]> {
        if (!this.vectorStore) {
            throw new Error('Vector store not initialized');
        }

        try {
            const results = await this.vectorStore.similaritySearch(query, k);
            return results;
        } catch (error) {
            console.error('Error performing similarity search:', error);
            throw error;
        }
    }

    /**
     * Search for similar documents in the vector store
     * @param query The search query
     * @param k Number of results to return (default: 5)
     */
    public async search(query: string, k = 5): Promise<any[]> {
        if (!this.vectorStore) {
            throw new Error('Vector store not initialized');
        }

        try {
            return await this.vectorStore.similaritySearch(query, k);
        } catch (error) {
            console.error('Error searching vector store:', error);
            throw error;
        }
    }

    /**
     * Delete all documents from the vector store
     */
    public async clear(): Promise<void> {
        try {
            await this.client.deleteCollection(this.collectionName);
            console.log(`Deleted collection: ${this.collectionName}`);
            this.vectorStore = null;
            await this.initialize();
        } catch (error) {
            console.error('Error clearing vector store:', error);
            throw error;
        }
    }

    /**
     * Create a custom prompt for semantic search with context
     * @param llm The language model to use
     * @param systemMessageTemplate The system message template
     * @returns A runnable sequence that can be invoked with a query
     */
    public createSearchPrompt(llm: any, systemMessageTemplate?: string) {
        // Default system template if none provided
        const defaultTemplate =
            `You are a helpful assistant with access to a knowledge base about products.
            Use the following retrieved documents to answer the user's question.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            
            Retrieved documents:
            {context}
            
            User question: {query}`;

        // Create the chat prompt template
        const promptTemplate = ChatPromptTemplate.fromTemplate(
            systemMessageTemplate || defaultTemplate
        );

        // Create a runnable sequence that:
        // 1. Performs a similarity search
        // 2. Creates a prompt with the results
        // 3. Sends the prompt to the model
        return RunnableSequence.from([
            {
                query: (input: { query: string }) => input.query,
                context: async (input: { query: string; k?: number }) => {
                    const documents = await this.search(input.query, input.k || 5);
                    return documents.map(doc => doc.pageContent).join('\n\n');
                }
            },
            promptTemplate,
            llm,
            new StringOutputParser()
        ]);
    }

    /**
     * Create a routing prompt based on query type
     * @param llm The language model to use
     * @returns A function that routes to different prompts based on query classification
     */
    public createRoutingPrompt(llm: any) {
        // Classifier prompt
        const classifierPrompt = ChatPromptTemplate.fromTemplate(
            `Classify the following user query as either a PRODUCT_SEARCH, PRODUCT_COMPARISON, 
             GENERAL_QUESTION, or OTHER.
             
             Only respond with one of these categories, nothing else.
             
             User query: {query}`
        );

        // Create classifier chain
        const classifierChain = RunnableSequence.from([
            classifierPrompt,
            llm,
            new StringOutputParser()
        ]);

        // Different prompt templates for different query types
        const productSearchTemplate =
            `You are a product search assistant. Focus on finding specific products
             based on the user's criteria. Use the retrieved information to provide
             product details, prices, and availability.
             
             Context from database:
             {context}
             
             User query: {query}`;

        const productComparisonTemplate =
            `You are a comparison assistant. Help the user compare different products
             based on their features, prices, and reviews. Provide a balanced assessment.
             
             Context from database:
             {context}
             
             User query: {query}`;

        const generalTemplate =
            `You are a helpful assistant. Answer the user's question based on the
             retrieved information. Provide accurate and relevant information.
             
             Context from database:
             {context}
             
             User query: {query}`;

        // Router function that selects the appropriate prompt
        const promptRouter = async ({ queryType, query, context }:
            { queryType: string; query: string; context: string }) => {

            let promptTemplate: ChatPromptTemplate;

            if (queryType.includes('PRODUCT_SEARCH')) {
                promptTemplate = ChatPromptTemplate.fromTemplate(productSearchTemplate);
            } else if (queryType.includes('PRODUCT_COMPARISON')) {
                promptTemplate = ChatPromptTemplate.fromTemplate(productComparisonTemplate);
            } else {
                promptTemplate = ChatPromptTemplate.fromTemplate(generalTemplate);
            }

            return promptTemplate.format({ query, context });
        };

        // Full chain with routing
        return async (input: { query: string; k?: number }) => {
            const queryType = await classifierChain.invoke({ query: input.query });
            const documents = await this.search(input.query, input.k || 5);
            const context = documents.map(doc => doc.pageContent).join('\n\n');

            const prompt = await promptRouter({
                queryType,
                query: input.query,
                context
            });

            return llm.invoke(prompt);
        };
    }

    /**
     * Check if vector store is initialized
     * @returns Boolean indicating if vector store is initialized
     */
    public async isInitialized(): Promise<boolean> {
        // Check if already initialized in this process
        if (this.vectorStore !== null) {
            return true;
        }

        // Check if initialized in Redis (by another worker)
        const initialized = await redisClient.get(QDRANT_INITIALIZED_KEY);
        console.log(`🔍 Redis Qdrant initialization status: ${initialized}`);

        if (initialized === 'true') {
            // If another worker initialized it, create our local instance too
            try {
                console.log(`Creating local vector store instance from existing collection ${this.collectionName}`);
                this.vectorStore = await QdrantVectorStore.fromExistingCollection(
                    this.embeddings,
                    {
                        client: this.client,
                        collectionName: this.collectionName,
                    }
                );
                console.log(`✅ Local vector store instance created successfully. Status: ${this.vectorStore !== null}`);
                return true;
            } catch (error) {
                console.error('❌ Error creating vector store from existing collection:', error);
                return false;
            }
        }

        console.log('⏳ Waiting for Qdrant initialization in Redis...');
        return false;
    }
} 
