# packages/mcp-server/Dockerfile
# Pre-built image for TradeBlocks MCP Server
#
# This is a monorepo project — workspace dependencies (@tradeblocks/lib)
# are resolved at build time on the host. The Docker image copies the
# pre-built output and installs only production npm dependencies.
#
# Usage:
#   cd packages/mcp-server
#   npm run build          # builds server/ and dist/ (resolves workspace deps)
#   docker build -t tradeblocks-mcp .
#   docker run -p 3100:3100 -v ./data:/data --env-file .env tradeblocks-mcp

FROM node:22-slim
WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy pre-built output (built on host via npm run build)
COPY server/ server/
COPY dist/ dist/

# Create data directory mount point
RUN mkdir -p /data

# Default port
EXPOSE 3100

# Run in HTTP mode pointing to /data volume
ENTRYPOINT ["node", "server/index.js", "--http", "/data"]
