# Scraper Service

A service for scraping data from various sources and uploading it to vector databases.

## Setup

1. Copy the `.env.example` file to `.env` and fill in the required environment variables:

   ```
   cp .env.example .env
   ```

2. Install dependencies:
   ```
   pnpm install
   ```

## Available Scripts

### Essência do Vale FAQ Scraper

This script scrapes FAQ data from the Essência do Vale website and uploads it to a Qdrant collection.

```bash
# From the root of the monorepo
pnpm --filter scraper-service scrape:essencia-faq

# Or from within the scraper-service directory
pnpm scrape:essencia-faq
```

## How It Works

The Essência do Vale FAQ scraper:

1. Scrapes the FAQ page from https://loja.essenciadovale.com/pagina/perguntas-frequentes-faq.html
2. Extracts questions and answers using Puppeteer
3. Generates vector embeddings for each FAQ item using Google's Generative AI
4. Creates or resets a Qdrant collection called "ess-faq"
5. Uploads the FAQ data with embeddings to Qdrant

## Adding New Scrapers

To add a new scraper:

1. Create a new script file in the `src/scripts` directory
2. Implement the scraping logic using Puppeteer
3. Add a corresponding script entry in `package.json`
