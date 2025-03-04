import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import dotenv from "dotenv";
import { Transform } from "stream";
import JSONStream from "jsonstream2";
import pg from "pg";
dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI("AIzaSyCuhAaYmJQKIj0lNhwAhiX4PwoNiN3Drx8");
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Initialize PostgreSQL client
const client = new pg.Client({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "wpp_agent",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres"
});

async function generateEmbedding(text) {
  try {
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
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
          `Rating: ${product.average_rating}/5`
        ]
          .filter(Boolean)
          .join("\n");

        const embedding = await generateEmbedding(description);

        if (embedding) {
          const query = `
            INSERT INTO products (
              product_id, title, brand, category, sub_category,
              actual_price, selling_price, discount, average_rating,
              out_of_stock, seller, images, product_details, description,
              embedding
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::vector)
          `;

          const values = [
            product.pid,
            product.title,
            product.brand,
            product.category,
            product.sub_category,
            parseFloat(product.actual_price.replace(/,/g, "")),
            parseFloat(product.selling_price),
            product.discount,
            parseFloat(product.average_rating),
            product.out_of_stock,
            product.seller,
            product.images,
            JSON.stringify(productDetails),
            description,
            `[${embedding.join(",")}]`
          ];

          await client.query(query, values);
          id++;

          if (id % 100 === 0) {
            console.log(`Processed ${id} products`);
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

  console.log(`Import completed. Total products processed: ${id}`);
}

async function main() {
  try {
    console.log("Starting import process...");
    await client.connect();
    await processProducts();
    console.log("Import completed successfully");
  } catch (error) {
    console.error("Error during import:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
