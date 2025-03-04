import express, { Request, Response } from 'express';
import { queueClient } from './clients/queue.js';
import { redisClient } from './clients/redis.js';
import { PORT } from './config/env.js';
import { agentController } from './controllers/agent-controller.js';
import { QdrantAdapter } from './database/qdrant.js';

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize Qdrant adapter
const qdrantAdapter = new QdrantAdapter();

// Get worker ID for logging
const workerId = process.env.pm_id || '0';

async function initializeApp() {
    try {
        console.log(`[Worker ${workerId}] Initializing application...`);

        // Test Redis connection
        await redisClient.ping();
        console.log(`[Worker ${workerId}] Redis connection successful`);

        // Initialize QdrantAdapter - only in primary worker to avoid conflicts
        if (workerId === '0' || !process.env.pm_id) {
            console.log(`[Worker ${workerId}] Initializing Qdrant vector store...`);
            await qdrantAdapter.initialize();
            console.log(`[Worker ${workerId}] Qdrant vector store initialized successfully`);
        } else {
            // For other workers, just wait until Qdrant is initialized
            let initialized = false;
            while (!initialized) {
                initialized = await qdrantAdapter.isInitialized();
                if (!initialized) {
                    console.log(`[Worker ${workerId}] Waiting for Qdrant initialization...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            console.log(`[Worker ${workerId}] Qdrant vector store successfully initialized by another worker`);
        }

        // Set up routes
        setupRoutes();

        // Start the server
        const server = app.listen(PORT, () => {
            console.log(`[Worker ${workerId}] Products Agent Service running on port ${PORT}`);

            // Signal to PM2 that we're ready to accept connections
            if (process.send) {
                process.send('ready');
            }
        });

        // Graceful shutdown for HTTP server
        server.on('close', () => {
            console.log(`[Worker ${workerId}] HTTP server closed`);
        });

    } catch (error) {
        console.error(`[Worker ${workerId}] Error initializing application:`, error);
        process.exit(1);
    }
}

/**
 * Set up routes
 */
function setupRoutes() {
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'ok',
            workerId,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    });

    // API route to process messages from WhatsApp
    app.post('/api/process-message', agentController.processMessage.bind(agentController));
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log(`[Worker ${workerId}] SIGTERM received, shutting down gracefully`);
    await redisClient.disconnect();
    await queueClient.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log(`[Worker ${workerId}] SIGINT received, shutting down gracefully`);
    await redisClient.disconnect();
    await queueClient.close();
    process.exit(0);
});

// Handle PM2 shutdown signal
process.on('message', async (msg) => {
    if (msg === 'shutdown') {
        console.log(`[Worker ${workerId}] PM2 shutdown message received, cleaning up`);
        await redisClient.disconnect();
        await queueClient.close();
        process.exit(0);
    }
});

// Initialize the application
initializeApp().catch((error) => {
    console.error(`[Worker ${workerId}] Unhandled error in initializeApp:`, error);
    process.exit(1);
}); 
