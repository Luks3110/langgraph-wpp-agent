import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import cluster from "cluster";
import dotenv from "dotenv";
import { createReadStream } from "fs";
import fs from "fs/promises";
import JSONStream from "jsonstream2";
import { cpus } from "os";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
dotenv.config();

// Get total number of CPUs for cluster size
const numCPUs = cpus().length;
// Use at most 4 workers to avoid overloading APIs
const maxWorkers = Math.min(4, numCPUs);

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
const TEMP_FOLDER = path.join(process.cwd(), "./scripts/data/temp");

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

// Function to prepare data for workers
async function prepareData() {
  // Ensure temp directory exists
  try {
    await fs.mkdir(TEMP_FOLDER, { recursive: true });
  } catch (error) {
    console.error("Error creating temp directory:", error);
  }

  // Count total number of products to process
  console.log("Counting total products...");
  let totalProducts = 0;
  
  const countStream = new Transform({
    objectMode: true,
    transform(product, encoding, callback) {
      totalProducts++;
      callback();
    }
  });

  await pipeline(
    createReadStream(
      path.join(
        process.cwd(),
        "./scripts/data",
        "flipkart_fashion_products_dataset.json"
      )
    ),
    JSONStream.parse("*"),
    countStream
  );

  console.log(`Total products to process: ${totalProducts}`);
  return totalProducts;
}

async function processProducts(workerId, totalWorkers, startIndex, totalProducts) {
  console.log(`[Worker ${workerId}] Processing products from index ${startIndex}...`);
  let batchPoints = [];
  let id = startIndex;
  let productsProcessed = 0;
  let currentIndex = 0;

  // Create a transform stream to process each product
  const processProduct = new Transform({
    objectMode: true,
    async transform(product, encoding, callback) {
      try {
        // Skip products that don't belong to this worker
        if (currentIndex % totalWorkers !== workerId - 1) {
          currentIndex++;
          callback();
          return;
        }
        
        currentIndex++;
        productsProcessed++;

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
            id: id,
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

          id += totalWorkers; // Ensure unique IDs across workers

          // Upload in batches of 100
          if (batchPoints.length >= 100) {
            await qdrant.upsert(COLLECTION_NAME, {
              points: batchPoints
            });
            console.log(
              `[Worker ${workerId}] Uploaded batch of ${batchPoints.length} products (processed: ${productsProcessed})`
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
      `[Worker ${workerId}] Uploaded final batch of ${batchPoints.length} products (total processed: ${productsProcessed})`
    );
  }

  return productsProcessed;
}

async function workerProcess(workerId, totalWorkers, totalProducts) {
  try {
    console.log(`[Worker ${workerId}] Starting processing...`);
    
    // Each worker starts with a different index
    const startIndex = workerId - 1; 
    console.log("🚀 ~ workerProcess ~ startIndex:", startIndex)
    
    // Process products for this worker
    const productsProcessed = await processProducts(workerId, totalWorkers, startIndex, totalProducts);
    
    console.log(`[Worker ${workerId}] Completed processing ${productsProcessed} products`);
    
    // Signal completion to master
    if (process.send) {
      process.send({ type: 'complete', workerId, productsProcessed });
    }
  } catch (error) {
    console.error(`[Worker ${workerId}] Error:`, error);
    if (process.send) {
      process.send({ type: 'error', workerId, error: error.message });
    }
    process.exit(1);
  }
}

async function main() {
  if (cluster.isPrimary) {
    try {
      console.log(`Primary process ${process.pid} is running`);
      console.log(`Setting up ${maxWorkers} workers...`);
      
      // Set up the Qdrant collection first
      await setupQdrantCollection();
      
      // Get total product count and prepare for parallel processing
      const totalProducts = await prepareData();
      
      // Track worker completion
      let completedWorkers = 0;
      let totalProcessed = 0;
      
      // Fork workers
      for (let i = 1; i <= maxWorkers; i++) {
        const worker = cluster.fork({ WORKER_ID: i });
        
        // Send worker initialization data
        worker.send({ 
          workerId: i, 
          totalWorkers: maxWorkers,
          totalProducts
        });
      }
      
      // Listen for messages from workers
      cluster.on('message', (worker, message) => {
        console.log("🚀 ~ cluster.on ~ worker:", worker)
        console.log("🚀 ~ cluster.on ~ message:", message)
        if (message.type === 'complete') {
          console.log(`Worker ${message.workerId} completed processing ${message.productsProcessed} products`);
          totalProcessed += message.productsProcessed;
          completedWorkers++;
          
          if (completedWorkers === maxWorkers) {
            console.log(`All workers completed. Total products processed: ${totalProcessed}`);
            console.log("Import completed successfully");
            // Clean up
            setTimeout(() => process.exit(0), 1000);
          }
        } else if (message.type === 'error') {
          console.error(`Worker ${message.workerId} encountered an error: ${message.error}`);
        }
      });
      
      // Handle worker exits
      cluster.on('exit', (worker, code, signal) => {
        if (code !== 0) {
          console.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
        }
      });
      
    } catch (error) {
      console.error("Error in primary process:", error);
      process.exit(1);
    }
  } else {
    // Worker process
    process.on('message', async (message) => {
      console.log("🚀 ~ process.on ~ message:", message)
      if (message.workerId) {
        await workerProcess(message.workerId, message.totalWorkers, message.totalProducts);
      }
    });
  }
}

main(); 
