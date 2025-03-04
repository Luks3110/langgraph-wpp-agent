import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { pipeline } from "stream/promises";
import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI("AIzaSyCuhAaYmJQKIj0lNhwAhiX4PwoNiN3Drx8");
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Update vector size to match the model's output
const VECTOR_SIZE = 768; // text-embedding-004 actual size

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333"
});

const COLLECTION_NAME = "brazilian-ecommerce";

// Helper function to load CSV data into memory
async function loadCSVData(filePath) {
  const data = new Map();
  await pipeline(
    createReadStream(filePath),
    parse({ columns: true }),
    async function* (source) {
      for await (const record of source) {
        data.set(record[Object.keys(record)[0]], record);
      }
    }
  );
  return data;
}

async function generateEmbedding(text) {
  try {
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

async function setupQdrantCollection() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME
    );

    if (exists) {
      console.log("Deleting existing collection...");
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

async function processProducts() {
  console.log("Loading auxiliary data...");

  // Load all necessary datasets
  const translations = await loadCSVData(
    path.join(process.cwd(), "data", "product_category_name_translation.csv")
  );

  const sellers = await loadCSVData(
    path.join(process.cwd(), "data", "olist_sellers_dataset.csv")
  );

  // Create a map of product reviews
  const productReviews = new Map();
  const orderItems = new Map();

  // Load order items to map products to orders
  console.log("Loading order items...");
  await pipeline(
    createReadStream(
      path.join(process.cwd(), "data", "olist_order_items_dataset.csv")
    ),
    parse({ columns: true }),
    async function* (source) {
      for await (const record of source) {
        if (!orderItems.has(record.product_id)) {
          orderItems.set(record.product_id, []);
        }
        orderItems.get(record.product_id).push(record.order_id);
      }
    }
  );

  // Load reviews and map them to products
  console.log("Loading reviews...");
  await pipeline(
    createReadStream(
      path.join(process.cwd(), "data", "olist_order_reviews_dataset.csv")
    ),
    parse({ columns: true }),
    async function* (source) {
      for await (const record of source) {
        const orderId = record.order_id;
        // Find all products in this order
        orderItems.forEach((orders, productId) => {
          if (orders.includes(orderId)) {
            if (!productReviews.has(productId)) {
              productReviews.set(productId, []);
            }
            if (record.review_comment_message) {
              productReviews.get(productId).push({
                score: record.review_score,
                comment: record.review_comment_message
              });
            }
          }
        });
      }
    }
  );

  // Process products
  console.log("Processing products...");
  let batchPoints = [];
  let id = 0;

  await pipeline(
    createReadStream(
      path.join(process.cwd(), "data", "olist_products_dataset.csv")
    ),
    parse({ columns: true }),
    async function* (source) {
      for await (const record of source) {
        // Get reviews for this product
        const reviews = productReviews.get(record.product_id) || [];
        const reviewTexts = reviews
          .map((r) => `Review (${r.score}/5): ${r.comment}`)
          .join(" | ");

        // Create rich description for embedding
        const description = [
          `Category: ${
            translations.get(record.product_category_name)
              ?.product_category_name_english || record.product_category_name
          }`,
          `Product specs: ${record.product_name_length} chars name, ${record.product_description_length} chars description`,
          `Physical attributes: ${record.product_weight_g}g, ${record.product_length_cm}x${record.product_height_cm}x${record.product_width_cm}cm`,
          `Photos: ${record.product_photos_qty}`,
          reviewTexts
        ]
          .filter(Boolean)
          .join("\n");

        const embedding = await generateEmbedding(description);

        if (embedding) {
          batchPoints.push({
            id: id++,
            vector: embedding,
            payload: {
              product_id: record.product_id,
              category: translations.get(record.product_category_name)
                ?.product_category_name_english,
              description_length: parseInt(record.product_description_length),
              name_length: parseInt(record.product_name_length),
              photos_qty: parseInt(record.product_photos_qty),
              weight_g: parseFloat(record.product_weight_g),
              length_cm: parseFloat(record.product_length_cm),
              height_cm: parseFloat(record.product_height_cm),
              width_cm: parseFloat(record.product_width_cm),
              review_count: reviews.length,
              avg_review_score:
                reviews.length > 0
                  ? reviews.reduce((acc, r) => acc + parseFloat(r.score), 0) /
                    reviews.length
                  : null
            }
          });

          // Upload in batches of 100
          if (batchPoints.length >= 100) {
            await qdrant.upsert(COLLECTION_NAME, {
              points: batchPoints
            });
            console.log(
              `Uploaded batch of ${batchPoints.length} products (total: ${id})`
            );
            batchPoints = [];
          }
        }
      }

      // Upload remaining points
      if (batchPoints.length > 0) {
        await qdrant.upsert(COLLECTION_NAME, {
          points: batchPoints
        });
        console.log(
          `Uploaded final batch of ${batchPoints.length} products (total: ${id})`
        );
      }
    }
  );
}

async function main() {
  try {
    console.log("Starting import process...");
    await setupQdrantCollection();
    await processProducts();
    console.log("Import completed successfully");
  } catch (error) {
    console.error("Error during import:", error);
    process.exit(1);
  }
}

main();
