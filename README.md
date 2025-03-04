# Products Monorepo

A monorepo containing a WhatsApp integration service and a product recommendation agent using LangChain, LangGraph, and Qdrant for vector search.

## Architecture

This project uses a microservices architecture with the following components:

1. **WhatsApp Service**: Handles WhatsApp webhook events, receives messages, and forwards them to the agent service using BullMQ queues.

2. **Products Agent Service**: Processes messages using a LangChain agent and Qdrant vector search, then sends responses back to the WhatsApp service through BullMQ. Runs in cluster mode with PM2 to utilize multiple CPU cores.

3. **Redis**: Manages message queues between services using BullMQ.

4. **Shared Package**: Contains common types and utilities used by both services.

## Prerequisites

- Node.js 18+
- pnpm
- Docker and Docker Compose (for local development with Redis and Qdrant)
- WhatsApp Business API credentials
- Google Generative AI API key

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/products-monorepo.git
cd products-monorepo
```

2. Install dependencies:

```bash
pnpm install
```

3. Create `.env` files for each service based on the provided `.env.example` files:

```bash
cp apps/whatsapp-service/.env.example apps/whatsapp-service/.env
cp apps/products-agent/.env.example apps/products-agent/.env
```

4. Edit both `.env` files with your API keys and service configurations.

## Development

To build all packages:

```bash
pnpm build
```

To run services in development mode:

```bash
# Run WhatsApp service
pnpm --filter @products-monorepo/whatsapp-service dev

# Run Products Agent service
pnpm --filter @products-monorepo/products-agent dev
```

### Running Products Agent with PM2

The Products Agent service can be run in cluster mode using PM2 to take advantage of multiple CPU cores:

```bash
# Build the service first
pnpm --filter @products-monorepo/products-agent build

# Start with PM2 in cluster mode
pnpm --filter @products-monorepo/products-agent start:pm2

# Monitor the cluster
pnpm --filter @products-monorepo/products-agent monit:pm2

# Reload the cluster (zero-downtime restart)
pnpm --filter @products-monorepo/products-agent reload:pm2

# Stop the cluster
pnpm --filter @products-monorepo/products-agent stop:pm2
```

## Testing Redis and BullMQ

The project includes a test script to verify Redis and BullMQ functionality:

1. Make sure Redis is running (via Docker Compose or locally):

```bash
docker compose up redis -d
```

2. Run the test script:

```bash
pnpm test-queue
```

This script will:
- Test the Redis connection
- Create a test queue and worker
- Send a test message and verify it's processed correctly

## Seed Product Data

To populate the Qdrant vector database with sample product data:

```bash
pnpm --filter @products-monorepo/products-agent seed
```

## Docker Deployment

To run the entire stack with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- Redis for message queuing on port 6379
- Qdrant vector database on port 6333
- WhatsApp Service on port 3001
- Products Agent Service on port 3002 (running in PM2 cluster mode)

## Webhooks Configuration

To use the WhatsApp service with the Meta WhatsApp Business API:

1. Configure your WhatsApp Business account to send webhooks to `https://your-domain.com/webhook`
2. Set the verify token in your WhatsApp service `.env` file to match your Meta webhook configuration

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## License

MIT 
