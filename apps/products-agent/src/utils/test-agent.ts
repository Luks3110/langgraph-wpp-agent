import dotenv from "dotenv";
import { runAgent } from "../agents/graph.js";
import { QdrantAdapter } from "../database/qdrant.js";
import { addMessageToHistory, getChatHistory } from "./chat-history.js";
import { seedVectorStore } from "./seed-data.js";

// Load environment variables
dotenv.config();

// Test user ID
const TEST_USER_ID = "test-user-123";

// Test questions
const testQuestions = [
  "Olá, bom dia! Estou procurando um smartphone novo.",
  "Qual é o melhor notebook que vocês têm?",
  "Esse smartphone tem garantia?",
  "Vocês têm algum produto com desconto?",
  "Qual é o prazo de entrega para o Tablet Premium?"
];

/**
 * Initialize Qdrant Vector Store
 */
async function initializeQdrantVectorStore() {
  const qdrantAdapter = new QdrantAdapter();
  await qdrantAdapter.initialize();
  return qdrantAdapter;
}

/**
 * Run a test conversation with the agent
 */
async function testAgent() {
  try {
    console.log("Initializing Qdrant vector store...");
    await initializeQdrantVectorStore();

    console.log("Seeding vector store with product data...");
    await seedVectorStore();

    console.log("\n=== Starting Test Conversation ===\n");

    // Process each test question
    for (const question of testQuestions) {
      console.log(`\nUser: ${question}`);

      // Add user message to chat history
      addMessageToHistory(TEST_USER_ID, "user", question);

      // Get chat history
      const chatHistory = getChatHistory(TEST_USER_ID);

      // Run the agent with the current question and chat history
      const response = await runAgent(
        TEST_USER_ID,
        question,
        (await chatHistory).map((msg) => ({
          role: msg.role === "user" ? "human" : "ai",
          content: msg.content
        }))
      );
      console.log(`\nAgent: ${response}`);

      // Add agent response to chat history
      addMessageToHistory(TEST_USER_ID, "assistant", response);
    }

    console.log("\n=== Test Conversation Completed ===\n");
  } catch (error) {
    console.error("Error testing agent:", error);
  }
}

// Run the test
testAgent().catch(console.error);
