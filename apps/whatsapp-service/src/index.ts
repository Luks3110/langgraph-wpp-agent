import express, { Request, Response } from 'express';
import { queueClient } from './clients/queue.js';
import { redisClient } from './clients/redis.js';
import { whatsappClient } from './clients/whatsapp.js';
import { AGENT_RESPONSE_WEBHOOK_PATH, PORT } from './config/env.js';
import { webhookController } from './controllers/webhook-controller.js';

// Initialize Express app
const app = express();
app.use(express.json({
    verify: (req: any, res: any, buf: any) => {
        // Save raw body for webhook signature verification
        req.rawBody = buf.toString();
    }
}));

async function initializeApp() {
    try {
        // Test Redis connection
        await redisClient.ping();
        console.log('Redis connection successful');

        // Set up WhatsApp webhook routes
        setupRoutes();


        // Register message handler
        whatsappClient.on('message', (message) => {
            console.log('Received message:', message);
            webhookController.handleWhatsAppMessage(message);
        });

        // Start the server
        app.listen(PORT, () => {
            console.log(`WhatsApp Service running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Error initializing WhatsApp Service:', error);
        process.exit(1);
    }
}

/**
 * Set up routes
 */
function setupRoutes() {
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({ status: 'ok' });
    });

    // Verify webhook (GET request handler)
    app.get('/webhook', webhookController.handleVerification.bind(webhookController));

    // Handle incoming messages (POST request handler)
    app.post('/webhook', webhookController.processWebhook.bind(webhookController));

    // Handle agent responses to be sent back to WhatsApp
    app.post(AGENT_RESPONSE_WEBHOOK_PATH, webhookController.handleAgentResponse.bind(webhookController));
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await redisClient.disconnect();
    await queueClient.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await redisClient.disconnect();
    await queueClient.close();
    process.exit(0);
});

// Initialize the application
initializeApp().catch((error) => {
    console.error('Unhandled error in initializeApp:', error);
    process.exit(1);
}); 
