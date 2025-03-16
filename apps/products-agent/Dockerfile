FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/products-agent/package.json ./apps/products-agent/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/products-agent ./apps/products-agent

# Build packages
RUN pnpm --filter @products-monorepo/shared run build
RUN pnpm --filter @products-monorepo/products-agent run build

FROM node:22-alpine AS runner

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/products-agent/package.json ./apps/products-agent/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm globally (removed PM2)
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod

# Copy build artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/products-agent/dist ./apps/products-agent/dist

# Expose port
EXPOSE 3002

# Set working directory to service directory
WORKDIR /app/apps/products-agent

# Run service directly with Node instead of PM2
CMD ["node", "dist/index.js"] 
