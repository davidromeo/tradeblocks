# packages/mcp-server/Dockerfile
# Multi-stage build for TradeBlocks MCP Server

# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/

# Build the server
RUN npm run build

# --- Production stage ---
FROM node:22-alpine
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built output from builder
COPY --from=builder /app/server/ server/
COPY --from=builder /app/dist/ dist/

# Copy agent-skills if they exist (optional, for skill installation)
COPY agent-skills/ agent-skills/

# Create data directory mount point
RUN mkdir -p /data

# Default port
EXPOSE 3100

# Run in HTTP mode pointing to /data volume
ENTRYPOINT ["node", "server/index.js", "--http", "/data"]
