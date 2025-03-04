import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import { createReadStream } from "fs";
import fs from "fs/promises";
import JSONStream from "jsonstream2";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "AIzaSyCuhAaYmJQKIj0lNhwAhiX4PwoNiN3Drx8");
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Update vector size to match the model's output
const VECTOR_SIZE = 768; // text-embedding-004 actual size

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333"
});

const COLLECTION_NAME = "flipkart-fashion";
const BATCH_SIZE = 100;

// Add retry logic with exponential backoff
async function generateEmbeddingWithRetry(text, maxRetries = 5) {
  let retries = 0;
  const initialBackoff = 1000; // Start with 1 second delay
  
  while (retries < maxRetries) {
    try {
      const result = await embedModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Failed to generate embedding after ${maxRetries} attempts:`, error);
        return null;
      }
      
      // Calculate exponential backoff with jitter
      const delay = initialBackoff * Math.pow(2, retries - 1) * (0.5 + Math.random());
      console.log(`Embedding API error. Retrying in ${Math.round(delay / 1000)} seconds... (Attempt ${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

// Replace the original generate embedding function
async function generateEmbedding(text) {
  // Use the retry version
  return generateEmbeddingWithRetry(text);
}

async function setupQdrantCollection() {
  try {
    console.log("Checking for existing collections...");
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

async function processProducts(limit = 100) {
  const filePath = path.join(
    process.cwd(),
    "./scripts/data",
    "flipkart_fashion_products_dataset.json"
  );
  
  console.log(`Reading file from: ${filePath}`);
  
  // Check if file exists
  try {
    await fs.access(filePath);
    console.log("File exists, proceeding with import");
  } catch (error) {
    console.error("Error accessing file:", error);
    throw new Error(`File does not exist or is not accessible: ${filePath}`);
  }

  let batchPoints = [];
  let id = 0;
  let totalProcessed = 0;
  let errorCount = 0;

  // Create a transform stream to process each product
  const processProduct = new Transform({
    objectMode: true,
    async transform(product, encoding, callback) {
      try {
        // Add a limit to process only a small batch for testing
        if (totalProcessed >= limit) {
          callback();
          return;
        }
        
        // Log progress periodically
        totalProcessed++;
        if (totalProcessed % 10 === 0 || totalProcessed === 1) {
          console.log(`Processed ${totalProcessed} products`);
        }

        // Validate product
        if (!product || typeof product !== 'object') {
          console.warn(`Invalid product object at index ${totalProcessed}:`, product);
          callback();
          return;
        }

        // Extract product details
        const productDetails = Object.fromEntries(
          product.product_details?.map((detail) => Object.entries(detail)[0]) || []
        );

        // Create description for embedding
        const description = [
          `Title: ${product.title || ''}`,
          `Brand: ${product.brand || ''}`,
          `Category: ${product.category || ''}`,
          `Sub-category: ${product.sub_category || ''}`,
          `Description: ${product.description || ''}`,
          `Style: ${productDetails["Style Code"] || ''}`,
          `Fabric: ${productDetails["Fabric"] || ''}`,
          `Pattern: ${productDetails["Pattern"] || ''}`,
          `Color: ${productDetails["Color"] || ''}`,
          `Rating: ${product.average_rating ? `${product.average_rating}/5` : 'No rating'}`,
        ]
          .filter(Boolean)
          .join("\n");

        const embedding = await generateEmbedding(description);

        if (embedding) {
          const parsedActualPrice = typeof product.actual_price === 'string' ? 
            parseFloat(product.actual_price.replace(/,/g, "")) : 
            (typeof product.actual_price === 'number' ? product.actual_price : 0);
          
          batchPoints.push({
            id: id++,
            vector: embedding,
            payload: {
              product_id: product.pid || `product-${id}`,
              title: product.title || '',
              brand: product.brand || '',
              category: product.category || '',
              sub_category: product.sub_category || '',
              actual_price: parsedActualPrice,
              selling_price: typeof product.selling_price === 'number' ? 
                product.selling_price : 
                (typeof product.selling_price === 'string' ? 
                  parseFloat(product.selling_price) : 0),
              discount: product.discount || '',
              average_rating: typeof product.average_rating === 'number' ? 
                product.average_rating : 
                (typeof product.average_rating === 'string' ? 
                  parseFloat(product.average_rating) : 0),
              out_of_stock: product.out_of_stock || false,
              seller: product.seller || '',
              images: product.images || [],
              product_details: productDetails
            }
          });

          // Upload in batches
          if (batchPoints.length >= BATCH_SIZE) {
            try {
              await qdrant.upsert(COLLECTION_NAME, {
                points: batchPoints
              });
              console.log(`Uploaded batch of ${batchPoints.length} products (total: ${totalProcessed})`);
              batchPoints = [];
            } catch (error) {
              console.error("Error uploading batch:", error);
              errorCount++;
              // Continue processing even if upload fails
            }
          }
        } else {
          console.warn(`Failed to generate embedding for product at index ${totalProcessed}`);
        }

        callback();
      } catch (error) {
        console.error(`Error processing product at index ${totalProcessed}:`, error);
        errorCount++;
        callback(); // Continue processing even on error
      }
    }
  });

  try {
    // Process JSON file using streams
    console.log("Starting pipeline...");
    await pipeline(
      createReadStream(filePath),
      JSONStream.parse("*"), // Parse each item in the array
      processProduct
    );
    
    console.log("Pipeline completed. Processing remaining items...");

    // Upload remaining points
    if (batchPoints.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, {
        points: batchPoints
      });
      console.log(`Uploaded final batch of ${batchPoints.length} products (total: ${totalProcessed})`);
    }
    
    console.log(`Import completed with ${totalProcessed} products processed and ${errorCount} errors`);
    return totalProcessed;
  } catch (error) {
    console.error("Fatal error in pipeline:", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("Starting import process...");
    
    // Get limit from command line arguments
    const limit = process.argv[2] ? parseInt(process.argv[2]) : 100; 
    console.log(`Using limit of ${limit} products for processing`);
    
    await setupQdrantCollection();
    const processed = await processProducts(limit);
    console.log(`Import completed successfully. Total products processed: ${processed}`);
  } catch (error) {
    console.error("Error during import:", error);
    process.exit(1);
  }
}

main(); 
