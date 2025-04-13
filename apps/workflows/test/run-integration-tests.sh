#!/bin/bash

# Change to the workflows directory
cd "$(dirname "$0")/.."

# Install dependencies if needed
pnpm install

# Run the integration tests with coverage
pnpm test:coverage 
