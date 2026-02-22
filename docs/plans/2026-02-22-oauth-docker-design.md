# OAuth + Docker Design

**Date**: 2026-02-22
**Branch**: feat/oauth-docker
**Approach**: Built-in OAuth 2.1 Authorization Server (Approach A)

## Context

The MCP server already supports HTTP transport (Streamable HTTP, stateless mode) but has no authentication. To enable secure self-hosting on Proxmox, cloud VMs, or any Docker environment — and to work with Claude.ai web/iOS which require OAuth discovery — we add a built-in OAuth 2.1 Authorization Code + PKCE flow.

**Constraints**:
- Single user per deployment (credentials via env vars)
- Zero external dependencies for auth (no Authelia, no external OAuth provider)
- stdio mode is completely unaffected
- Open source friendly: Docker-first, works on any platform

## Architecture

Auth is purely additive to the existing HTTP server. Nothing changes for stdio mode.

```
packages/mcp-server/
  src/
    auth/
      oauth-routes.ts     # Express routes: /authorize, /token, /.well-known
      token.ts            # JWT issue + verify (using jose)
      pkce.ts             # PKCE code challenge verification
      login-page.ts       # HTML login form (inline template)
      code-store.ts       # In-memory auth code store (TTL: 30s)
    http-server.ts        # Add: auth middleware + mount oauth-routes
    index.ts              # No changes
  Dockerfile
  docker-compose.yml
  .env.example
  .dockerignore
```

**Key principle**: Auth is Express middleware + new routes. The MCP transport layer (`/mcp`) is unchanged — it gains a `validateBearerToken` middleware guard.

## OAuth Flow

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/oauth-authorization-server` | GET | Discovery metadata |
| `/authorize` | GET | Renders HTML login form |
| `/authorize` | POST | Validates credentials, issues auth code, redirects |
| `/token` | POST | Exchanges code + PKCE verifier for JWT |
| `/mcp` | POST | Existing MCP endpoint with Bearer token validation |

### Sequence

```
Claude.ai                          TradeBlocks MCP Server
   |                                        |
   |-- GET /.well-known/oauth-* ---------->|  (discover endpoints)
   |<-- JSON metadata ------------------------|
   |                                        |
   |-- GET /authorize?                      |
   |     response_type=code&                |
   |     client_id=...&                     |
   |     redirect_uri=...&                  |
   |     code_challenge=...&                |
   |     code_challenge_method=S256 ------>|  (show login form)
   |<-- HTML login page ----------------------|
   |                                        |
   |-- POST /authorize                      |
   |     username=...&password=... -------->|  (validate creds)
   |<-- 302 redirect_uri?code=abc&state=... |
   |                                        |
   |-- POST /token                          |
   |     grant_type=authorization_code&     |
   |     code=abc&                          |
   |     code_verifier=... --------------->|  (verify PKCE, issue JWT)
   |<-- { access_token: "eyJ...", ... } -----|
   |                                        |
   |-- POST /mcp                            |
   |     Authorization: Bearer eyJ... ----->|  (validate JWT, handle MCP)
```

### Token Details

- **Auth codes**: in-memory Map, TTL 30 seconds, single-use
- **Access tokens**: JWT (HS256), signed with `TRADEBLOCKS_JWT_SECRET`, 24h expiry default
- **No refresh tokens**: re-login after expiry (keeps it simple)
- **PKCE**: S256 only (SHA-256 of code_verifier matches stored code_challenge)

### Password Handling

- `TRADEBLOCKS_PASSWORD`: plaintext comparison (simple setup)
- `TRADEBLOCKS_PASSWORD_HASH`: bcrypt verification (optional, for security-conscious users)
- One of the two is required when HTTP mode is active

## Docker

### Dockerfile

Multi-stage build:
1. **Build stage**: `node:22-alpine`, install deps, run `npm run build`
2. **Production stage**: `node:22-alpine`, copy `server/`, `dist/`, production `node_modules`, `agent-skills/`

Default entrypoint: `node server/index.js --http /data`

### docker-compose.yml

```yaml
services:
  tradeblocks:
    build: .
    ports:
      - "3100:3100"
    volumes:
      - ./data:/data
    env_file: .env
    restart: unless-stopped

  # Optional: auto-sync backtest files from another machine
  # syncthing:
  #   image: syncthing/syncthing:latest
  #   volumes:
  #     - ./data:/var/syncthing/data
  #     - ./syncthing-config:/var/syncthing/config
  #   ports:
  #     - "8384:8384"
  #     - "22000:22000"
  #   restart: unless-stopped
```

### Data Volume

Users place backtest folders and optionally `market.duckdb` in `./data/`. A `.stignore` file is included for Syncthing users to prevent syncing DuckDB files:

```
*.duckdb
*.duckdb.wal
*.duckdb.tmp
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRADEBLOCKS_USERNAME` | Yes (HTTP) | -- | Login username |
| `TRADEBLOCKS_PASSWORD` | Yes (HTTP)* | -- | Login password (plaintext) |
| `TRADEBLOCKS_PASSWORD_HASH` | No* | -- | Bcrypt hash alternative |
| `TRADEBLOCKS_JWT_SECRET` | Yes (HTTP) | -- | HMAC-SHA256 signing key |
| `TRADEBLOCKS_JWT_EXPIRY` | No | `24h` | Token lifetime |
| `TRADEBLOCKS_PORT` | No | `3100` | HTTP listen port |
| `TRADEBLOCKS_NO_AUTH` | No | `false` | Disable auth (proxy setups) |

*One of PASSWORD or PASSWORD_HASH required.

### Startup Validation (HTTP mode)

1. If no credentials configured: print error, exit
2. If no JWT secret configured: print error with generation command, exit
3. If `--no-auth` set: skip validation, log warning
4. stdio mode: skips all validation, no auth loaded

### CLI

```
tradeblocks-mcp ~/backtests                      # stdio, no auth (unchanged)
tradeblocks-mcp --http ~/backtests                # HTTP + auth required
tradeblocks-mcp --http --no-auth ~/backtests      # HTTP, auth disabled
```

### What Does NOT Change

- stdio mode: zero changes
- `--call` mode: unauthenticated (local CLI testing)
- Skill commands: unaffected
- MCP tool registration: identical, auth is purely middleware
