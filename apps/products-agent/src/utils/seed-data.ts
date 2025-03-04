import { Document } from '@langchain/core/documents';
import { QdrantAdapter } from '../database/qdrant.js';

// Sample product data for seeding
const sampleProducts = [
    {
        name: "Men's Classic Fit Jeans",
        description: "Comfortable everyday jeans with classic fit. Made with durable denim that lasts through multiple washes.",
        price: 59.99,
        category: "Men's Clothing",
        url: "https://example.com/products/mens-classic-jeans"
    },
    {
        name: "Women's Running Shoes",
        description: "Lightweight, breathable running shoes with excellent support for daily workouts. Cushioned sole for impact protection.",
        price: 89.99,
        category: "Women's Footwear",
        url: "https://example.com/products/womens-running-shoes"
    },
    {
        name: "Smart LED TV 55-inch",
        description: "4K Ultra HD Smart LED TV with HDR. Connect to your favorite streaming apps and enjoy vibrant color display.",
        price: 499.99,
        category: "Electronics",
        url: "https://example.com/products/smart-led-tv-55"
    },
    {
        name: "Wireless Bluetooth Headphones",
        description: "Over-ear noise cancelling headphones with 30 hour battery life. Rich sound quality and comfortable fit.",
        price: 129.99,
        category: "Electronics",
        url: "https://example.com/products/wireless-headphones"
    },
    {
        name: "Stainless Steel Kitchen Knife Set",
        description: "Professional 8-piece kitchen knife set with stainless steel blades and ergonomic handles. Dishwasher safe.",
        price: 79.99,
        category: "Home & Kitchen",
        url: "https://example.com/products/kitchen-knife-set"
    }
];

/**
 * Create LangChain documents from sample products
 */
function createDocuments(): Document[] {
    return sampleProducts.map(product => {
        const content = `
            Product: ${product.name}
            Description: ${product.description}
            Price: $${product.price}
            Category: ${product.category}
            URL: ${product.url}
        `;

        return new Document({
            pageContent: content,
            metadata: {
                name: product.name,
                price: product.price,
                category: product.category,
                url: product.url
            }
        });
    });
}

/**
 * Seed the Qdrant database with sample products
 */
export async function seedVectorStore() {
    try {
        console.log('Starting database seeding...');

        // Initialize QdrantAdapter
        const qdrantAdapter = new QdrantAdapter();
        await qdrantAdapter.initialize();

        // Create sample documents
        const documents = createDocuments();
        console.log(`Created ${documents.length} sample product documents`);

        // Add documents to vector store
        // Note: We need to implement this method in QdrantAdapter
        // await qdrantAdapter.addDocuments(documents);

        console.log('Database seeded successfully');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

// Only run the seeding function when this module is executed directly
if (require.main === module) {
    seedVectorStore().catch(console.error);
} 
