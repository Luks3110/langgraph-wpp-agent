import express, { Request, Response } from "express";
import readline from "readline";
import { v4 as uuidv4 } from "uuid";
import { queueClient } from "./clients/queue.js";
import { redisClient } from "./clients/redis.js";
import { PORT } from "./config/env.js";
import { agentController } from "./controllers/agent-controller.js";
import { QdrantAdapter } from "./database/qdrant.js";
import { runAgent } from "./agents/graph.js";
import { getChatHistory } from "./utils/chat-history.js";

// Check if interactive mode is enabled
const isInteractiveMode = process.argv.includes("--interactive");

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize Qdrant adapter
const qdrantAdapter = new QdrantAdapter();

async function initializeApp() {
  try {
    console.log("Initializing application...");

    // Test Redis connection
    await redisClient.ping();
    console.log("Redis connection successful");

    // Initialize QdrantAdapter
    console.log("Initializing Qdrant vector store...");
    await qdrantAdapter.initialize();

    if (await qdrantAdapter.isInitialized()) {
      console.log("Qdrant vector store initialized successfully");
    } else {
      console.error("Failed to initialize Qdrant vector store");
      process.exit(1);
    }

    if (isInteractiveMode) {
      // Start interactive mode
      startInteractiveMode();
    } else {
      // Set up routes
      setupRoutes();

      // Start the server
      app.listen(PORT, () => {
        console.log(`Products Agent Service running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("Error initializing application:", error);
    process.exit(1);
  }
}

/**
 * Set up routes
 */
function setupRoutes() {
  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  // API route to process messages from WhatsApp
  app.post(
    "/api/process-message",
    agentController.processMessage.bind(agentController)
  );
}

/**
 * Start interactive terminal mode
 */
async function startInteractiveMode() {
  console.log("\n🤖 Products Agent Interactive Mode 🤖");
  console.log("Type your questions about products and press Enter.");
  console.log("Type 'exit' or 'quit' to end the session.\n");

  const userId = uuidv4();
  console.log(`Session ID: ${userId}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: "
  });

  rl.prompt();

  rl.on("line", async (input) => {
    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("\nThank you for using Products Agent! Goodbye. 👋");
      await cleanupAndExit();
      return;
    }

    try {
      console.log("\nProcessing your query...");

      // Get chat history
      const chatHistory = await getChatHistory(userId);

      // Run the agent
      const response = await runAgent(
        userId,
        input,
        chatHistory.map((msg) => ({
          role: msg.role === "user" ? "human" : "ai",
          content: msg.content
        }))
      );

      // Display the response
      console.log(`\nAgent: ${response}\n`);
    } catch (error) {
      console.error("Error processing query:", error);
      console.log(
        "\nAgent: Sorry, I encountered an error processing your request. Please try again.\n"
      );
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    console.log("\nThank you for using Products Agent! Goodbye. 👋");
    await cleanupAndExit();
  });
}

/**
 * Clean up resources and exit
 */
async function cleanupAndExit() {
  try {
    await redisClient.disconnect();
    await queueClient.close();
    process.exit(0);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await cleanupAndExit();
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await cleanupAndExit();
});

// Initialize the application
initializeApp().catch((error) => {
  console.error("Unhandled error in initializeApp:", error);
  process.exit(1);
});
