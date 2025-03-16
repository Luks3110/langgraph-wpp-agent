import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Initialize Gemini for generating embeddings
const genAI = new GoogleGenerativeAI("AIzaSyCuhAaYmJQKIj0lNhwAhiX4PwoNiN3Drx8");
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
 * Represents an FAQ item with a question and answer.
 */
type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Generates an embedding vector for the given text
 * @param text - Text to generate embedding for
 * @returns Embedding vector or null if error
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
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
 */
async function setupQdrantCollection(): Promise<void> {
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
 * @returns Array of FAQ items
 */
async function scrapeFAQData(): Promise<FaqItem[]> {
  console.log(`Scraping FAQ data from ${TARGET_URL}...`);
  const browser = await puppeteer.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.goto(TARGET_URL, { waitUntil: "networkidle2" });

    // Extract FAQ data specifically from the div.conteudo.span12 element
    const faqItems = await page.evaluate(() => {
      const items: { question: string; answer: string }[] = [];

      // Find the main content div containing the FAQ
      const contentDiv = document.querySelector("div.conteudo.span12");
      if (!contentDiv) return items;

      // Get the paragraph containing all FAQ content
      const faqParagraph = contentDiv.querySelector("p");
      if (!faqParagraph) return items;

      // Get the HTML content to process
      const htmlContent = faqParagraph.innerHTML;

      // Split the content by bold tags to separate questions and answers
      // Replace <br> tags with newlines for easier processing
      const cleanedHtml = htmlContent.replace(/<br\s*\/?>/gi, "\n");

      // Split by bold tags to identify questions
      const parts = cleanedHtml.split(/<\/?b>/);

      // Process the parts to extract questions and answers
      for (let i = 1; i < parts.length; i += 2) {
        // The odd-indexed parts are the questions (inside <b> tags)
        const question = parts[i].trim();

        // The even-indexed parts are the answers (between </b> and next <b>)
        if (i + 1 < parts.length) {
          // Clean up the answer text
          let answer = parts[i + 1]
            .replace(/\n+/g, " ") // Replace multiple newlines with space
            .replace(/<a[^>]*>(.*?)<\/a>/g, "$1") // Remove link tags, keep text
            .trim();

          // Remove leading and trailing whitespace and punctuation
          answer = answer.replace(/^[\s\n,.:;]+|[\s\n,.:;]+$/g, "");

          // Only add if we have both question and answer
          if (question && answer) {
            items.push({ question, answer });
          }
        }
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
 * @param faqItems - FAQ items to upload
 */
async function uploadFAQToQdrant(faqItems: FaqItem[]): Promise<void> {
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
async function main(): Promise<void> {
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
