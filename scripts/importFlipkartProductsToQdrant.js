import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import { createReadStream } from "fs";
import JSONStream from "jsonstream2";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
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

const COLLECTION_NAME = "flipkart-fashion";

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
  console.log("Processing products...");
  let batchPoints = [];
  let id = 0;

  // Create a transform stream to process each product
  const processProduct = new Transform({
    objectMode: true,
    async transform(product, encoding, callback) {
      try {
        // Extract product details
        const productDetails = Object.fromEntries(
          product.product_details?.map((detail) => Object.entries(detail)[0]) ||
            []
        );

        // Create rich description for embedding
        const description = [
          `Title: ${product.title}`,
          `Brand: ${product.brand}`,
          `Category: ${product.category}`,
          `Sub-category: ${product.sub_category}`,
          `Description: ${product.description}`,
          `Style: ${productDetails["Style Code"]}`,
          `Fabric: ${productDetails["Fabric"]}`,
          `Pattern: ${productDetails["Pattern"]}`,
          `Color: ${productDetails["Color"]}`,
          `Rating: ${product.average_rating}/5`,
        ]
          .filter(Boolean)
          .join("\n");

        const embedding = await generateEmbedding(description);

        if (embedding) {
          batchPoints.push({
            id: id++,
            vector: embedding,
            payload: {
              product_id: product.pid,
              title: product.title,
              brand: product.brand,
              category: product.category,
              sub_category: product.sub_category,
              actual_price: parseFloat(product.actual_price.replace(/,/g, "")),
              selling_price: parseFloat(product.selling_price),
              discount: product.discount,
              average_rating: parseFloat(product.average_rating),
              out_of_stock: product.out_of_stock,
              seller: product.seller,
              images: product.images,
              product_details: productDetails
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

        callback();
      } catch (error) {
        callback(error);
      }
    }
  });

  // Process the JSON file using streams
  await pipeline(
    createReadStream(
      path.join(
        process.cwd(),
        "./scripts/data",
        "flipkart_fashion_products_dataset.json"
      )
    ),
    JSONStream.parse("*"), // Parse each item in the array
    processProduct
  );

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
