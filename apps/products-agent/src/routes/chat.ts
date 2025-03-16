import express, { Router } from "express";
import { logMessage } from "../utils/logger.js";
import { runAgent } from "../agents/graph.js";
import { QdrantAdapter } from "../database/qdrant.js";

// Initialize router
const router: Router = express.Router();

// Chat endpoint
router.post("/", async (req, res) => {
  try {
    const { userId, message, history = [] } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        error: "Missing required fields: userId and message are required"
      });
    }

    // Log incoming message
    logMessage("user", userId, message);

    // Run agent
    const response = await runAgent(
      userId,
      message,
      history.map((msg: any) => ({
        role: msg.role === "user" ? "human" : "ai",
        content: msg.content
      }))
    );

    // Log agent response
    logMessage("agent", userId, response);

    return res.json({
      response
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    return res.status(500).json({
      error: "An error occurred while processing your request"
    });
  }
});

// Debug FAQ functionality
router.post("/debug-faq", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Missing required field: query is required"
      });
    }

    // Initialize Qdrant
    const qdrantAdapter = new QdrantAdapter();
    await qdrantAdapter.initialize();

    // Check if FAQ data exists
    const hasFAQ = await qdrantAdapter.hasFAQData();
    if (!hasFAQ) {
      return res.status(404).json({
        error: "FAQ data not found. Please run the FAQ scraper first."
      });
    }

    // Search for FAQ results
    const faqResults = await qdrantAdapter.searchFAQ(query);

    return res.json({
      faqCount: faqResults.length,
      faqResults,
      query
    });
  } catch (error) {
    console.error("Error in debug-faq endpoint:", error);
    return res.status(500).json({
      error: "An error occurred while processing your request"
    });
  }
});

export default router;
