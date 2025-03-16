import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

// Initialize Gemini for generating embeddings
const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY || "AIzaSyCuhAaYmJQKIj0lNhwAhiX4PwoNiN3Drx8"
);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Embeddings model dimension size
const VECTOR_SIZE = 768; // text-embedding-004 size

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333"
});

const COLLECTION_NAME = "ess-faq";
const TARGET_URL =
  "https://loja.essenciadovale.com/pagina/perguntas-frequentes-faq.html";

/**
 * Generates an embedding vector for the given text
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]|null>} - Embedding vector or null if error
 */
async function generateEmbedding(text) {
  try {
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

/**
 * Sets up the Qdrant collection for FAQ data
 * @returns {Promise<void>}
 */
async function setupQdrantCollection() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME
    );

    if (exists) {
      console.log(`Deleting existing collection '${COLLECTION_NAME}'...`);
      await qdrant.deleteCollection(COLLECTION_NAME);
    }

    console.log("Creating new collection...");
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine"
      }
    });
    console.log("Collection created successfully");
  } catch (error) {
    console.error("Error setting up collection:", error);
    throw error;
  }
}

/**
 * Scrapes FAQ data from the target website
 * @returns {Promise<Array<{question: string, answer: string}>>} - Array of FAQ items
 */
async function scrapeFAQData() {
  console.log(`Scraping FAQ data from ${TARGET_URL}...`);
  const browser = await puppeteer.launch({
    headless: "new"
  });

  try {
    const page = await browser.newPage();
    await page.goto(TARGET_URL, { waitUntil: "networkidle2" });

    // Extract FAQ data - adjust selectors based on the actual HTML structure
    const faqItems = await page.evaluate(() => {
      const items = [];

      // Look for common FAQ patterns
      const faqContainers = document.querySelectorAll(
        ".faq-item, .accordion, .faq-question, .pergunta, .duvida"
      );

      if (faqContainers.length > 0) {
        // Process containers if found by common class names
        faqContainers.forEach((container) => {
          const question = container
            .querySelector(".question, .pergunta, h3, h4, strong")
            ?.textContent?.trim();
          const answer = container
            .querySelector(".answer, .resposta, p")
            ?.textContent?.trim();

          if (question && answer) {
            items.push({ question, answer });
          }
        });
      } else {
        // Fallback: Try to identify question/answer pairs by HTML structure
        const headings = document.querySelectorAll("h2, h3, h4, h5");
        headings.forEach((heading) => {
          const question = heading.textContent?.trim();
          // Get the next sibling elements until we hit another heading
          let element = heading.nextElementSibling;
          let answerText = "";

          while (
            element &&
            !["H2", "H3", "H4", "H5"].includes(element.tagName)
          ) {
            if (element.textContent?.trim()) {
              answerText += element.textContent.trim() + " ";
            }
            element = element.nextElementSibling;
          }

          const answer = answerText.trim();
          if (question && answer) {
            items.push({ question, answer });
          }
        });
      }

      return items;
    });

    console.log(`Found ${faqItems.length} FAQ items`);
    return faqItems;
  } catch (error) {
    console.error("Error scraping FAQ data:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Uploads FAQ data to Qdrant
 * @param {Array<{question: string, answer: string}>} faqItems - FAQ items to upload
 * @returns {Promise<void>}
 */
async function uploadFAQToQdrant(faqItems) {
  console.log("Uploading FAQ items to Qdrant...");

  // Process in batches to avoid overwhelming the API
  const BATCH_SIZE = 10;
  for (let i = 0; i < faqItems.length; i += BATCH_SIZE) {
    const batch = faqItems.slice(i, i + BATCH_SIZE);
    const points = [];

    for (const [index, item] of batch.entries()) {
      // Create combined text for embedding
      const combinedText = `${item.question} ${item.answer}`;
      const embedding = await generateEmbedding(combinedText);

      if (embedding) {
        points.push({
          id: i + index + 1, // Generate sequential IDs
          vector: embedding,
          payload: {
            question: item.question,
            answer: item.answer,
            combined: combinedText
          }
        });
      }
    }

    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points: points
      });
      console.log(`Uploaded batch of ${points.length} FAQ items`);
    }
  }

  console.log("Upload completed successfully");
}

/**
 * Main function to orchestrate the scraping and uploading process
 */
async function main() {
  try {
    // Set up Qdrant collection
    await setupQdrantCollection();

    // Scrape FAQ data
    const faqItems = await scrapeFAQData();

    // Upload to Qdrant
    if (faqItems.length > 0) {
      await uploadFAQToQdrant(faqItems);
      console.log(
        `Successfully uploaded ${faqItems.length} FAQ items to collection '${COLLECTION_NAME}'`
      );
    } else {
      console.warn("No FAQ items found to upload");
    }
  } catch (error) {
    console.error("Error in main process:", error);
    process.exit(1);
  }
}

// Run the main function
main();
