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
const BATCH_SIZE = 100;
const DATA_FILE = path.join(
  process.cwd(),
  "./scripts/data",
  "flipkart_fashion_products_dataset.json"
);

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

// Generate embedding with retry
async function generateEmbedding(text) {
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

// Function to count total products
async function countTotalProducts() {
  console.log("Counting total products...");
  let totalProducts = 0;
  
  const countStream = new Transform({
    objectMode: true,
    transform(product, encoding, callback) {
      totalProducts++;
      callback();
    }
  });

  try {
    await pipeline(
      createReadStream(DATA_FILE),
      JSONStream.parse("*"),
      countStream
    );
    
    console.log(`Total products to process: ${totalProducts}`);
    return totalProducts;
  } catch (error) {
    console.error("Error counting products:", error);
    throw error;
  }
}

// Process products for a worker
async function processProducts(workerId, totalWorkers, startIndex) {
  console.log(`[Worker ${workerId}] Processing products starting from index ${startIndex}`);
  console.log(`[Worker ${workerId}] Will process items where index % ${totalWorkers} = ${workerId - 1}`);
  
  // Check if file exists
  try {
    await fs.access(DATA_FILE);
    console.log(`[Worker ${workerId}] Data file exists and is accessible`);
  } catch (error) {
    console.error(`[Worker ${workerId}] Error accessing data file:`, error);
    throw new Error(`Data file not accessible: ${DATA_FILE}`);
  }
  
  let batchPoints = [];
  let id = startIndex;
  let productsProcessed = 0;
  let currentIndex = 0;
  
  // Create a transform stream to process each product
  const processProduct = new Transform({
    objectMode: true,
    async transform(product, encoding, callback) {
      try {
        currentIndex++;
        
        // Log progress periodically
        if (currentIndex % 1000 === 0 || currentIndex === 1) {
          console.log(`[Worker ${workerId}] Scanning product ${currentIndex}`);
        }
        
        // Skip products that don't belong to this worker
        if (currentIndex % totalWorkers !== workerId - 1) {
          callback();
          return;
        }
        
        productsProcessed++;
        if (productsProcessed % 50 === 0) {
          console.log(`[Worker ${workerId}] Processed ${productsProcessed} products so far`);
        }

        // Extract product details
        const productDetails = Object.fromEntries(
          product.product_details?.map((detail) => Object.entries(detail)[0]) || []
        );

        // Create rich description for embedding
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
            id: id,
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

          id += totalWorkers; // Ensure unique IDs across workers

          // Upload in batches
          if (batchPoints.length >= BATCH_SIZE) {
            try {
              await qdrant.upsert(COLLECTION_NAME, {
                points: batchPoints
              });
              console.log(
                `[Worker ${workerId}] Uploaded batch of ${batchPoints.length} products (processed: ${productsProcessed})`
              );
              batchPoints = [];
            } catch (error) {
              console.error(`[Worker ${workerId}] Error uploading batch:`, error);
            }
          }
        } else {
          console.warn(`[Worker ${workerId}] Failed to generate embedding for product at index ${currentIndex}`);
        }

        callback();
      } catch (error) {
        console.error(`[Worker ${workerId}] Error processing product at index ${currentIndex}:`, error);
        callback(); // Continue processing even on error
      }
    }
  });

  try {
    // Process the JSON file using streams
    console.log(`[Worker ${workerId}] Starting pipeline...`);
    await pipeline(
      createReadStream(DATA_FILE),
      JSONStream.parse("*"),
      processProduct
    );
    
    console.log(`[Worker ${workerId}] Pipeline completed. Processing remaining items...`);

    // Upload remaining points
    if (batchPoints.length > 0) {
      try {
        await qdrant.upsert(COLLECTION_NAME, {
          points: batchPoints
        });
        console.log(
          `[Worker ${workerId}] Uploaded final batch of ${batchPoints.length} products (total: ${productsProcessed})`
        );
      } catch (error) {
        console.error(`[Worker ${workerId}] Error uploading final batch:`, error);
      }
    }

    console.log(`[Worker ${workerId}] Completed processing ${productsProcessed} products`);
    return productsProcessed;
  } catch (error) {
    console.error(`[Worker ${workerId}] Error in pipeline:`, error);
    throw error;
  }
}

// Worker process function
async function worker() {
  try {
    // Get worker ID from environment variable
    const workerId = parseInt(process.env.WORKER_ID || "1");
    console.log(`Worker ${workerId} started (PID: ${process.pid})`);
    
    // Each worker processes its portion of data
    const startIndex = workerId - 1;
    const totalWorkers = parseInt(process.env.TOTAL_WORKERS || "4");
    
    // Process products - no need to wait for a message
    console.log(`[Worker ${workerId}] Starting to process products with modulo ${workerId - 1}`);
    const productsProcessed = await processProducts(workerId, totalWorkers, startIndex);
    
    // Report completion back to primary
    if (process.send) {
      process.send({ 
        type: 'complete', 
        workerId, 
        productsProcessed 
      });
      console.log(`[Worker ${workerId}] Sent completion message to primary`);
    } else {
      console.log(`[Worker ${workerId}] Completed processing ${productsProcessed} products (process.send not available)`);
    }
  } catch (error) {
    console.error(`Worker error:`, error);
    if (process.send) {
      process.send({ 
        type: 'error', 
        workerId: process.env.WORKER_ID, 
        error: error.message 
      });
    }
    process.exit(1);
  }
}

// Primary process function 
async function primary() {
  try {
    console.log(`Primary process ${process.pid} is running`);
    console.log(`Setting up ${maxWorkers} workers...`);
    
    // Set up the collection first
    await setupQdrantCollection();
    
    // Count total products
    const totalProducts = await countTotalProducts();
    
    // Track worker completion
    let completedWorkers = 0;
    let totalProcessed = 0;
    
    // Handle messages from workers
    cluster.on('message', (worker, message) => {
      console.log(`✓ ~ cluster.on ~ worker:`, worker.id);
      console.log(`✓ ~ cluster.on ~ message:`, message);
      
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
        console.error(`Worker ${worker.id} died with code ${code} and signal ${signal}`);
      }
    });
    
    // Fork workers with environment variables for direct configuration
    for (let i = 1; i <= maxWorkers; i++) {
      const worker = cluster.fork({ 
        WORKER_ID: i.toString(),
        TOTAL_WORKERS: maxWorkers.toString()
      });
      
      console.log(`Started worker ${i} with PID ${worker.process.pid}`);
    }
  } catch (error) {
    console.error("Error in primary process:", error);
    process.exit(1);
  }
}

// Main execution
if (cluster.isPrimary) {
  primary();
} else {
  worker();
} 
