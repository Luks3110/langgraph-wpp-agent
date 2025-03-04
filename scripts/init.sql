-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create products table with vector support
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    sub_category TEXT,
    actual_price NUMERIC,
    selling_price NUMERIC,
    discount TEXT,
    average_rating NUMERIC,
    out_of_stock BOOLEAN,
    seller TEXT,
    images TEXT[],
    product_details JSONB,
    description TEXT,
    embedding vector(768)
);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres; 
