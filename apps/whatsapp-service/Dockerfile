FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/whatsapp-service/package.json ./apps/whatsapp-service/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/whatsapp-service ./apps/whatsapp-service

# Build packages
RUN pnpm --filter @products-monorepo/shared run build
RUN pnpm --filter @products-monorepo/whatsapp-service run build

FROM node:22-alpine AS runner

WORKDIR /app

# Install required packages for crypto
RUN apk add --no-cache openssl

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/whatsapp-service/package.json ./apps/whatsapp-service/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod

# Copy build artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/whatsapp-service/dist ./apps/whatsapp-service/dist

# Expose port
EXPOSE 3001

# Set working directory to service directory
WORKDIR /app/apps/whatsapp-service

# Run service with Node.js flags to enable WebCrypto
CMD ["node", "--experimental-global-webcrypto", "dist/index.js"] 
