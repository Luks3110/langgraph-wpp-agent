import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { redisClient } from "../clients/redis.js";
import { GOOGLE_GENERATIVE_AI_API_KEY, QDRANT_URL } from "../config/env.js";
import { v4 as uuidv4 } from "uuid";

// Collection name for products
const COLLECTION_NAME = "flipkart-fashion";
// Collection name for FAQs
const FAQ_COLLECTION_NAME = "ess-faq";
// Redis key for tracking Qdrant initialization
const QDRANT_INITIALIZED_KEY = "qdrant:initialized";

// Add at the top with other constants
const CACHE_COLLECTION_NAME = "embeddings_cache";
const CACHE_SIMILARITY_THRESHOLD = 0.92; // Threshold for considering queries similar

/**
 * Adapter for the Qdrant vector database
 */
export class QdrantAdapter {
  private client: QdrantClient;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private vectorStore: QdrantVectorStore | null = null;
  private faqVectorStore: QdrantVectorStore | null = null;
  private collectionName: string = COLLECTION_NAME;
  private faqCollectionName: string = FAQ_COLLECTION_NAME;
  private cacheCollectionName: string = CACHE_COLLECTION_NAME;
  // Add cache for search results
  private searchCache: Map<string, string> = new Map<string, string>();

  constructor() {
    // Initialize Qdrant client
    this.client = new QdrantClient({
      url: QDRANT_URL
    });

    // Initialize embeddings with Google Generative AI
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
      modelName: "text-embedding-004"
    });
  }

  /**
   * Initialize the vector store
   */
  public async initialize(): Promise<void> {
    try {
      // List collections to check if collections exist
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (collection: any) => collection.name === this.collectionName
      );
      const faqCollectionExists = collections.collections.some(
        (collection: any) => collection.name === this.faqCollectionName
      );
      const cacheCollectionExists = collections.collections.some(
        (collection: any) => collection.name === this.cacheCollectionName
      );

      if (!collectionExists) {
        console.log(
          `Collection '${this.collectionName}' does not exist. Creating...`
        );
        await this.createCollection(this.collectionName);
      }

      if (!faqCollectionExists) {
        console.log(
          `FAQ collection '${this.faqCollectionName}' does not exist. Please run the FAQ scraper first.`
        );
      }

      if (!cacheCollectionExists) {
        console.log(
          `Cache collection '${this.cacheCollectionName}' does not exist. Creating...`
        );
        await this.createCollection(this.cacheCollectionName);
      }

      // Create vector store instance
      this.vectorStore = await QdrantVectorStore.fromExistingCollection(
        this.embeddings,
        {
          client: this.client,
          collectionName: this.collectionName
        }
      );

      // Create FAQ vector store instance if the collection exists
      if (faqCollectionExists) {
        try {
          this.faqVectorStore = await QdrantVectorStore.fromExistingCollection(
            this.embeddings,
            {
              client: this.client,
              collectionName: this.faqCollectionName
            }
          );
          console.log("FAQ vector store initialized successfully");
        } catch (error) {
          console.error("Error initializing FAQ vector store:", error);
          // Continue even if FAQ store fails to initialize
        }
      }

      // Mark as initialized in Redis for other workers
      await redisClient.set(QDRANT_INITIALIZED_KEY, "true");
      console.log("Vector store initialized successfully");
    } catch (error) {
      console.error("Error initializing vector store:", error);
      throw error;
    }
  }

  /**
   * Create a new collection
   */
  private async createCollection(name: string): Promise<void> {
    try {
      await this.client.createCollection(name, {
        vectors: {
          size: 768, // Dimension size for Google's embedding model
          distance: "Cosine"
        }
      });
      console.log(`Collection '${name}' created successfully`);
    } catch (error) {
      console.error(`Error creating collection '${name}':`, error);
      throw error;
    }
  }

  /**
   * Search for products by similarity
   */
  public async similaritySearch(query: string, k = 5): Promise<any[]> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      console.error("Error performing similarity search:", error);
      throw error;
    }
  }

  /**
   * Search for FAQ data by similarity
   * @param query The search query
   * @param k Number of results to return
   * @returns Array of search results with FAQ data
   */
  public async searchFAQ(query: string, k = 3): Promise<any[]> {
    // Check if FAQ vector store is initialized
    if (!this.faqVectorStore) {
      console.log("Initializing FAQ vector store...");
      try {
        this.faqVectorStore = await QdrantVectorStore.fromExistingCollection(
          this.embeddings,
          {
            client: this.client,
            collectionName: this.faqCollectionName
          }
        );
      } catch (error) {
        console.error("Error initializing FAQ vector store:", error);
        return []; // Return empty array if FAQ store can't be initialized
      }
    }

    try {
      // Generate cache key for FAQ search
      const cacheKey = `faq:${query}:${k}`;

      // Check cache first
      const cachedResults = await this.getFromCache(cacheKey);
      if (cachedResults) {
        console.log("🔍 Returning cached FAQ search results for:", query);
        return JSON.parse(cachedResults);
      }

      // Generate embeddings for the query
      console.log(`🔍 Generating embeddings for FAQ query: "${query}"`);
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Perform the vector search
      const results = await this.client.search(this.faqCollectionName, {
        vector: queryEmbedding,
        limit: k,
        with_payload: true
      });

      // Process and format results
      const formattedResults = results.map((result) => ({
        id: result.id,
        question: result.payload?.question || "",
        answer: result.payload?.answer || "",
        similarity: result.score || 0
      }));

      // Log number of results found
      console.log(
        `✅ Found ${formattedResults.length} FAQ results for query: "${query}"`
      );

      // Cache results
      await this.saveToCache(cacheKey, JSON.stringify(formattedResults));

      return formattedResults;
    } catch (error) {
      console.error(`❌ Error in searchFAQ for query "${query}":`, error);
      return []; // Return empty array on error
    }
  }

  /**
   * Check if FAQ collection exists and has data
   */
  public async hasFAQData(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      const faqCollectionExists = collections.collections.some(
        (collection: any) => collection.name === this.faqCollectionName
      );
      console.log(
        "🚀 ~ QdrantAdapter ~ hasFAQData ~ faqCollectionExists:",
        faqCollectionExists
      );

      if (!faqCollectionExists) return false;

      // Check if there's data in the collection
      const collectionInfo = await this.client.getCollection(
        this.faqCollectionName
      );
      console.log(
        "🚀 ~ QdrantAdapter ~ hasFAQData ~ collectionInfo:",
        collectionInfo
      );
      return (collectionInfo.points_count || 0) > 0;
    } catch (error) {
      console.error("Error checking for FAQ data:", error);
      return false;
    }
  }

  /**
   * Search for similar documents in the vector store with enhanced features
   * @param options Search options
   * @returns Array of search results with similarity scores
   */
  public async searchKnowledge(options: {
    query: string;
    k?: number;
    matchThreshold?: number;
    includeVector?: boolean;
    filter?: Record<string, any>;
    useCache?: boolean;
  }): Promise<any[]> {
    const {
      query,
      k = 5,
      matchThreshold = 0.7,
      includeVector = false,
      filter = {},
      useCache = true
    } = options;

    // Generate a cache key based on query parameters
    const cacheKey = `search:${query}:${k}:${JSON.stringify(filter)}`;

    // Check cache first if enabled
    if (useCache) {
      const cachedResults = await this.getFromCache(cacheKey);
      if (cachedResults) {
        console.log("🔍 Returning cached search results for:", query);
        return JSON.parse(cachedResults);
      }
    }

    // Ensure vector store is initialized
    if (!this.vectorStore) {
      console.log("⚠️ Vector store not initialized, creating instance...");
      try {
        this.vectorStore = await QdrantVectorStore.fromExistingCollection(
          this.embeddings,
          {
            client: this.client,
            collectionName: this.collectionName
          }
        );
      } catch (error) {
        console.error("❌ Failed to initialize vector store:", error);
        throw new Error("Failed to initialize vector store");
      }
    }

    try {
      // Generate embeddings for the query
      console.log(`🔍 Generating embeddings for query: "${query}"`);
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Fix the filter format to match Qdrant's expected structure
      // Perform the vector search
      const results = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        with_vector: true
      });

      // Process and format results
      const formattedResults = results.map((result) => ({
        id: result.id,
        metadata: result.payload || {},
        embedding: includeVector ? queryEmbedding : undefined,
        similarity: result.score
      }));

      // Log number of results found
      console.log(
        `✅ Found ${formattedResults.length} results for query: "${query}"`
      );

      // Cache results if caching is enabled
      if (useCache) {
        await this.saveToCache(cacheKey, JSON.stringify(formattedResults));
      }

      return formattedResults;
    } catch (error) {
      console.error(`❌ Error in searchKnowledge for query "${query}":`, error);
      throw error;
    }
  }

  /**
   * Get item from cache
   * @param key Cache key
   * @returns Cached value or undefined
   */
  private async getFromCache(key: string): Promise<string | undefined> {
    // Try in-memory cache first
    if (this.searchCache.has(key)) {
      return this.searchCache.get(key);
    }

    // Try Redis cache
    try {
      const cachedValue = await redisClient.get(`qdrant:${key}`);
      return cachedValue || undefined;
    } catch (error) {
      console.error("Error retrieving from cache:", error);
      return undefined;
    }
  }

  /**
   * Save item to cache
   * @param key Cache key
   * @param value Value to cache
   */
  private async saveToCache(key: string, value: string): Promise<void> {
    // Update in-memory cache
    this.searchCache.set(key, value);

    // Update Redis cache with 30-minute expiration
    try {
      await redisClient.set(`qdrant:${key}`, value, "EX", 1800);
    } catch (error) {
      console.error("Error saving to cache:", error);
    }
  }

  /**
   * Search for similar documents in the vector store
   * @param query The search query
   * @param k Number of results to return (default: 5)
   */
  public async search(query: string, k = 5): Promise<any[]> {
    try {
      const results = await this.searchKnowledge({
        query,
        k,
        useCache: true
      });
      return results.map((result) => ({
        ...result,
        pageContent: result.pageContent
      }));
    } catch (error) {
      console.error("Error searching vector store:", error);
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
      console.error("Error clearing vector store:", error);
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
    const defaultTemplate = `You are a helpful assistant with access to a knowledge base about products.
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
          return documents.map((doc) => doc.pageContent).join("\n\n");
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
    const productSearchTemplate = `You are a product search assistant. Focus on finding specific products
             based on the user's criteria. Use the retrieved information to provide
             product details, prices, and availability.
             
             Context from database:
             {context}
             
             User query: {query}`;

    const productComparisonTemplate = `You are a comparison assistant. Help the user compare different products
             based on their features, prices, and reviews. Provide a balanced assessment.
             
             Context from database:
             {context}
             
             User query: {query}`;

    const generalTemplate = `You are a helpful assistant. Answer the user's question based on the
             retrieved information. Provide accurate and relevant information.
             
             Context from database:
             {context}
             
             User query: {query}`;

    // Router function that selects the appropriate prompt
    const promptRouter = async ({
      queryType,
      query,
      context
    }: {
      queryType: string;
      query: string;
      context: string;
    }) => {
      let promptTemplate: ChatPromptTemplate;

      if (queryType.includes("PRODUCT_SEARCH")) {
        promptTemplate = ChatPromptTemplate.fromTemplate(productSearchTemplate);
      } else if (queryType.includes("PRODUCT_COMPARISON")) {
        promptTemplate = ChatPromptTemplate.fromTemplate(
          productComparisonTemplate
        );
      } else {
        promptTemplate = ChatPromptTemplate.fromTemplate(generalTemplate);
      }

      return promptTemplate.format({ query, context });
    };

    // Full chain with routing
    return async (input: { query: string; k?: number }) => {
      const queryType = await classifierChain.invoke({ query: input.query });
      const documents = await this.search(input.query, input.k || 5);
      const context = documents.map((doc) => doc.pageContent).join("\n\n");

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

    if (initialized === "true") {
      // If another worker initialized it, create our local instance too
      try {
        console.log(
          `Creating local vector store instance from existing collection ${this.collectionName}`
        );
        this.vectorStore = await QdrantVectorStore.fromExistingCollection(
          this.embeddings,
          {
            client: this.client,
            collectionName: this.collectionName
          }
        );
        console.log(
          `✅ Local vector store instance created successfully. Status: ${this.vectorStore !== null}`
        );
        return true;
      } catch (error) {
        console.error(
          "❌ Error creating vector store from existing collection:",
          error
        );
        return false;
      }
    }

    console.log("⏳ Waiting for Qdrant initialization in Redis...");
    return false;
  }

  /**
   * Find similar cached query
   * @param query The query to find in cache
   * @param cacheType The type of cache to search (default: "response")
   * @returns The cached response or null if not found
   */
  public async findSimilarCachedQuery(
    query: string,
    cacheType: "response" | "query_improvement" = "response"
  ): Promise<{
    response: string;
    originalQuery: string;
    similarity: number;
  } | null> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Search for similar cached queries
      const results = await this.client.search(this.cacheCollectionName, {
        vector: queryEmbedding,
        limit: 1,
        score_threshold: CACHE_SIMILARITY_THRESHOLD,
        filter: {
          must: [
            {
              key: "type",
              match: { value: cacheType }
            }
          ]
        },
        with_payload: true
      });

      // If we found a similar query with high enough similarity
      if (
        results.length > 0 &&
        results[0].score &&
        results[0].score >= CACHE_SIMILARITY_THRESHOLD
      ) {
        const result = results[0];
        console.log(
          `🎯 Found similar cached ${cacheType} with score: ${result.score}`
        );

        return {
          response: result.payload?.response as string,
          originalQuery: result.payload?.query as string,
          similarity: result.score
        };
      }

      console.log(`❌ No similar cached ${cacheType} found`);
      return null;
    } catch (error) {
      console.error(`Error finding similar cached ${cacheType}:`, error);
      return null;
    }
  }

  /**
   * Cache a query-response pair
   * @param query The user query
   * @param response The generated response
   * @param cacheType The type of cache to store (default: "response")
   */
  public async cacheQueryResponse(
    query: string,
    response: string,
    cacheType: "response" | "query_improvement" = "response"
  ): Promise<void> {
    try {
      // Don't cache very short queries
      if (query.length < 5) {
        console.log("Query too short, not caching");
        return;
      }

      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Store in cache collection
      await this.client.upsert(this.cacheCollectionName, {
        points: [
          {
            id: uuidv4(),
            vector: queryEmbedding,
            payload: {
              query,
              response,
              type: cacheType,
              cached_at: Date.now()
            }
          }
        ]
      });

      console.log(
        `✅ Cached ${cacheType} for query: "${query.substring(0, 50)}..."`
      );
    } catch (error) {
      console.error(`Error caching ${cacheType}:`, error);
    }
  }
}
