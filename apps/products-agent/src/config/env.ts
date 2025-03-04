import 'dotenv/config';
import { z } from 'zod';

// Define environment variables schema
const envSchema = z.object({
    // Google AI API
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),

    // Qdrant
    QDRANT_URL: z.string().url().default('http://localhost:6333'),
    QDRANT_API_KEY: z.string().optional(),

    // Server
    AGENT_SERVICE_PORT: z.string().default('3002'),

    // Redis Configuration
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Queue Names
    AGENT_REQUEST_QUEUE: z.string().default('agent-request-queue'),
    AGENT_RESPONSE_QUEUE: z.string().default('agent-response-queue'),

    // WhatsApp Service
    WHATSAPP_SERVICE_ENDPOINT: z.string().default('http://whatsapp-service:3001/api/agent-response'),

    // LangSmith (optional)
    LANGCHAIN_API_KEY: z.string().optional(),
    LANGCHAIN_PROJECT: z.string().optional(),
    LANGCHAIN_TRACING_V2: z.enum(['true', 'false']).optional(),
    LANGCHAIN_ENDPOINT: z.string().url().optional(),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Export individual environment variables
export const {
    GOOGLE_GENERATIVE_AI_API_KEY,
    QDRANT_URL,
    QDRANT_API_KEY,
    AGENT_SERVICE_PORT: PORT,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    AGENT_REQUEST_QUEUE,
    AGENT_RESPONSE_QUEUE,
    WHATSAPP_SERVICE_ENDPOINT,
    LANGCHAIN_API_KEY,
    LANGCHAIN_PROJECT,
    LANGCHAIN_TRACING_V2,
    LANGCHAIN_ENDPOINT,
} = env; 
