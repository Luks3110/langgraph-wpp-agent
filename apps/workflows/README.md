# Workflow Engine

A generic workflow engine inspired by ActivePieces, built with Hono, BullMQ, and Supabase.

## Features

- Generic workflow definition format
- Extensible node system (triggers and actions)
- BullMQ-based execution queue
- Supabase database integration
- RESTful API with Hono
- TypeScript support

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start worker process
pnpm worker

# Build for production
pnpm build

# Run tests
pnpm test
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation and [PLAN.md](./PLAN.md) for implementation details.

## API Endpoints

- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/:id` - Get workflow
- `PUT /api/workflows/:id` - Update workflow
- `POST /api/workflows/:id/execute` - Execute workflow
- `POST /webhooks/:webhookId` - Webhook endpoint
