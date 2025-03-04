import 'dotenv/config';
import { z } from 'zod';

// Define environment variables schema
const envSchema = z.object({
    // WhatsApp API Configuration
    WHATSAPP_ACCESS_TOKEN: z.string().min(1),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
    WHATSAPP_APP_SECRET: z.string().min(1),

    // Server Configuration
    WHATSAPP_SERVICE_PORT: z.string().default('3001'),

    // Redis Configuration
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Queue Names
    AGENT_REQUEST_QUEUE: z.string().default('agent-request-queue'),
    AGENT_RESPONSE_QUEUE: z.string().default('agent-response-queue'),

    // Agent Service Configuration
    AGENT_SERVICE_ENDPOINT: z.string().default('http://localhost:3002/api/process-message'),
    AGENT_RESPONSE_WEBHOOK_PATH: z.string().default('/api/agent-response'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Export individual environment variables
export const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET,
    WHATSAPP_SERVICE_PORT: PORT,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    AGENT_REQUEST_QUEUE,
    AGENT_RESPONSE_QUEUE,
    AGENT_SERVICE_ENDPOINT,
    AGENT_RESPONSE_WEBHOOK_PATH,
} = env; 
