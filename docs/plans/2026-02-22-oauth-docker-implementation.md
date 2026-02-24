# OAuth + Docker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OAuth 2.1 Authorization Code + PKCE authentication to the MCP HTTP server, plus Docker packaging for self-hosting.

**Architecture:** The MCP SDK (`@modelcontextprotocol/sdk` v1.26+) provides `mcpAuthRouter()` which handles all OAuth endpoints (discovery, authorize, token, register). We implement the `OAuthServerProvider` interface with username/password auth via env vars and JWT token issuance via `jose`. Auth is Express middleware — the MCP transport layer is unchanged.

**Tech Stack:** Express, `@modelcontextprotocol/sdk` auth framework, `jose` (JWT), Docker multi-stage build

**Design doc:** `docs/plans/2026-02-22-oauth-docker-design.md`

**Key SDK imports** (all resolve via `./*` wildcard export):
```typescript
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
// Types
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokens, OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
```

**Working directory:** `/Users/davidromeo/Code/tradeblocks/.worktrees/oauth-docker`
**MCP server package:** `packages/mcp-server/`
**Test runner:** `cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest`

---

### Task 1: Install jose dependency

**Files:**
- Modify: `packages/mcp-server/package.json`

**Step 1: Install jose**

```bash
cd packages/mcp-server && npm install jose
```

**Step 2: Verify installation**

```bash
node -e "import('jose').then(m => console.log('jose loaded, SignJWT:', typeof m.SignJWT))"
```

Expected: `jose loaded, SignJWT: function`

**Step 3: Commit**

```bash
git add packages/mcp-server/package.json packages/mcp-server/package-lock.json
git commit -m "chore: add jose dependency for JWT auth"
```

---

### Task 2: Auth configuration module

**Files:**
- Create: `packages/mcp-server/src/auth/config.ts`
- Create: `packages/mcp-server/tests/unit/auth/config.test.ts`

**Step 1: Write the tests**

```typescript
// tests/unit/auth/config.test.ts
import { loadAuthConfig } from '../../src/auth/config.js';

describe('loadAuthConfig', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIG_ENV };
    // Set all required vars
    process.env.TRADEBLOCKS_USERNAME = 'admin';
    process.env.TRADEBLOCKS_PASSWORD = 'secret';
    process.env.TRADEBLOCKS_JWT_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('loads valid config from env vars', () => {
    const config = loadAuthConfig();
    expect(config.username).toBe('admin');
    expect(config.password).toBe('secret');
    expect(config.jwtSecret).toBe('test-secret-key');
    expect(config.jwtExpiry).toBe('24h');
    expect(config.noAuth).toBe(false);
  });

  it('uses custom JWT expiry when set', () => {
    process.env.TRADEBLOCKS_JWT_EXPIRY = '7d';
    const config = loadAuthConfig();
    expect(config.jwtExpiry).toBe('7d');
  });

  it('uses custom issuer URL when set', () => {
    process.env.TRADEBLOCKS_ISSUER_URL = 'https://mcp.example.com';
    const config = loadAuthConfig();
    expect(config.issuerUrl).toBe('https://mcp.example.com');
  });

  it('throws when username is missing', () => {
    delete process.env.TRADEBLOCKS_USERNAME;
    expect(() => loadAuthConfig()).toThrow('TRADEBLOCKS_USERNAME');
  });

  it('throws when password is missing', () => {
    delete process.env.TRADEBLOCKS_PASSWORD;
    expect(() => loadAuthConfig()).toThrow('TRADEBLOCKS_PASSWORD');
  });

  it('throws when JWT secret is missing', () => {
    delete process.env.TRADEBLOCKS_JWT_SECRET;
    expect(() => loadAuthConfig()).toThrow('TRADEBLOCKS_JWT_SECRET');
  });

  it('returns noAuth config when noAuth option is true', () => {
    delete process.env.TRADEBLOCKS_USERNAME;
    delete process.env.TRADEBLOCKS_PASSWORD;
    delete process.env.TRADEBLOCKS_JWT_SECRET;
    const config = loadAuthConfig({ noAuth: true });
    expect(config.noAuth).toBe(true);
    expect(config.username).toBe('');
  });

  it('returns noAuth config when TRADEBLOCKS_NO_AUTH env is true', () => {
    delete process.env.TRADEBLOCKS_USERNAME;
    delete process.env.TRADEBLOCKS_PASSWORD;
    delete process.env.TRADEBLOCKS_JWT_SECRET;
    process.env.TRADEBLOCKS_NO_AUTH = 'true';
    const config = loadAuthConfig();
    expect(config.noAuth).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/config.test.ts
```

Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/auth/config.ts

export interface AuthConfig {
  username: string;
  password: string;
  jwtSecret: string;
  jwtExpiry: string;
  issuerUrl?: string;
  noAuth: boolean;
}

export function loadAuthConfig(options: { noAuth?: boolean } = {}): AuthConfig {
  const noAuth = options.noAuth || process.env.TRADEBLOCKS_NO_AUTH === 'true';

  if (noAuth) {
    return {
      username: '',
      password: '',
      jwtSecret: '',
      jwtExpiry: '24h',
      noAuth: true,
    };
  }

  const username = process.env.TRADEBLOCKS_USERNAME;
  const password = process.env.TRADEBLOCKS_PASSWORD;
  const jwtSecret = process.env.TRADEBLOCKS_JWT_SECRET;
  const jwtExpiry = process.env.TRADEBLOCKS_JWT_EXPIRY || '24h';
  const issuerUrl = process.env.TRADEBLOCKS_ISSUER_URL;

  if (!username) {
    throw new Error(
      'TRADEBLOCKS_USERNAME is required for HTTP mode.\n' +
      'Set it in your .env file or pass --no-auth to disable authentication.'
    );
  }
  if (!password) {
    throw new Error(
      'TRADEBLOCKS_PASSWORD is required for HTTP mode.\n' +
      'Set it in your .env file.'
    );
  }
  if (!jwtSecret) {
    throw new Error(
      'TRADEBLOCKS_JWT_SECRET is required for HTTP mode.\n' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  return { username, password, jwtSecret, jwtExpiry, issuerUrl, noAuth: false };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/config.test.ts
```

Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add packages/mcp-server/src/auth/config.ts packages/mcp-server/tests/unit/auth/config.test.ts
git commit -m "feat(auth): add configuration module with env var validation"
```

---

### Task 3: In-memory authorization code store

**Files:**
- Create: `packages/mcp-server/src/auth/code-store.ts`
- Create: `packages/mcp-server/tests/unit/auth/code-store.test.ts`

**Step 1: Write the tests**

```typescript
// tests/unit/auth/code-store.test.ts
import { AuthCodeStore } from '../../src/auth/code-store.js';

describe('AuthCodeStore', () => {
  it('stores and retrieves a code via peek', () => {
    const store = new AuthCodeStore();
    store.store('abc', {
      codeChallenge: 'challenge123',
      clientId: 'client1',
      redirectUri: 'https://example.com/callback',
      scopes: ['mcp:tools'],
    });
    const entry = store.peek('abc');
    expect(entry).toBeDefined();
    expect(entry!.codeChallenge).toBe('challenge123');
    expect(entry!.clientId).toBe('client1');
  });

  it('peek does not consume the code', () => {
    const store = new AuthCodeStore();
    store.store('abc', {
      codeChallenge: 'c',
      clientId: 'x',
      redirectUri: 'https://example.com/cb',
      scopes: [],
    });
    store.peek('abc');
    expect(store.peek('abc')).toBeDefined();
  });

  it('consume returns and deletes the code', () => {
    const store = new AuthCodeStore();
    store.store('abc', {
      codeChallenge: 'c',
      clientId: 'x',
      redirectUri: 'https://example.com/cb',
      scopes: [],
    });
    const entry = store.consume('abc');
    expect(entry).toBeDefined();
    expect(store.consume('abc')).toBeUndefined();
  });

  it('returns undefined for unknown code', () => {
    const store = new AuthCodeStore();
    expect(store.peek('nope')).toBeUndefined();
    expect(store.consume('nope')).toBeUndefined();
  });

  it('returns undefined for expired code', () => {
    const store = new AuthCodeStore(1); // 1ms TTL
    store.store('abc', {
      codeChallenge: 'c',
      clientId: 'x',
      redirectUri: 'https://example.com/cb',
      scopes: [],
    });
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(store.peek('abc')).toBeUndefined();
    expect(store.consume('abc')).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/code-store.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/auth/code-store.ts

export interface CodeEntry {
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  resource?: URL;
  expiresAt: number;
}

type StoreInput = Omit<CodeEntry, 'expiresAt'>;

export class AuthCodeStore {
  private codes = new Map<string, CodeEntry>();
  private ttlMs: number;

  constructor(ttlMs = 30_000) {
    this.ttlMs = ttlMs;
  }

  store(code: string, entry: StoreInput): void {
    this.codes.set(code, { ...entry, expiresAt: Date.now() + this.ttlMs });
  }

  peek(code: string): CodeEntry | undefined {
    const entry = this.codes.get(code);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.codes.delete(code);
      return undefined;
    }
    return entry;
  }

  consume(code: string): CodeEntry | undefined {
    const entry = this.peek(code);
    if (!entry) return undefined;
    this.codes.delete(code);
    return entry;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/code-store.test.ts
```

Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add packages/mcp-server/src/auth/code-store.ts packages/mcp-server/tests/unit/auth/code-store.test.ts
git commit -m "feat(auth): add in-memory authorization code store with TTL"
```

---

### Task 4: JWT token utilities

**Files:**
- Create: `packages/mcp-server/src/auth/token.ts`
- Create: `packages/mcp-server/tests/unit/auth/token.test.ts`

**Step 1: Write the tests**

```typescript
// tests/unit/auth/token.test.ts
import { issueAccessToken, verifyAccessToken } from '../../src/auth/token.js';

const TEST_SECRET = 'test-secret-key-at-least-32-chars-long';

describe('issueAccessToken', () => {
  it('returns a JWT string and expiry', async () => {
    const result = await issueAccessToken({
      clientId: 'client1',
      scopes: ['mcp:tools'],
      secret: TEST_SECRET,
      expiry: '1h',
    });
    expect(result.access_token).toMatch(/^eyJ/); // JWT header
    expect(result.expires_in).toBe(3600);
  });

  it('defaults to 24h when expiry format is invalid', async () => {
    const result = await issueAccessToken({
      clientId: 'client1',
      scopes: [],
      secret: TEST_SECRET,
      expiry: 'invalid',
    });
    expect(result.expires_in).toBe(86400);
  });
});

describe('verifyAccessToken', () => {
  it('verifies a valid token and returns AuthInfo', async () => {
    const { access_token } = await issueAccessToken({
      clientId: 'client1',
      scopes: ['mcp:tools'],
      secret: TEST_SECRET,
      expiry: '1h',
    });
    const info = await verifyAccessToken(access_token, TEST_SECRET);
    expect(info.clientId).toBe('client1');
    expect(info.scopes).toEqual(['mcp:tools']);
    expect(info.token).toBe(access_token);
    expect(info.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a token signed with wrong secret', async () => {
    const { access_token } = await issueAccessToken({
      clientId: 'client1',
      scopes: [],
      secret: TEST_SECRET,
      expiry: '1h',
    });
    await expect(
      verifyAccessToken(access_token, 'wrong-secret-that-is-also-long-enough')
    ).rejects.toThrow();
  });

  it('rejects a malformed token', async () => {
    await expect(
      verifyAccessToken('not.a.jwt', TEST_SECRET)
    ).rejects.toThrow();
  });
});

describe('parseExpiry', () => {
  it('handles seconds, minutes, hours, days', async () => {
    const cases = [
      { expiry: '30s', expected: 30 },
      { expiry: '15m', expected: 900 },
      { expiry: '2h', expected: 7200 },
      { expiry: '7d', expected: 604800 },
    ];
    for (const { expiry, expected } of cases) {
      const result = await issueAccessToken({
        clientId: 'c', scopes: [], secret: TEST_SECRET, expiry,
      });
      expect(result.expires_in).toBe(expected);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/token.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/auth/token.ts
import { SignJWT, jwtVerify } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export async function issueAccessToken(params: {
  clientId: string;
  scopes: string[];
  secret: string;
  expiry: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const secretKey = new TextEncoder().encode(params.secret);
  const expirySeconds = parseExpiry(params.expiry);

  const jwt = await new SignJWT({
    client_id: params.clientId,
    scope: params.scopes.join(' '),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('tradeblocks-user')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
    .sign(secretKey);

  return { access_token: jwt, expires_in: expirySeconds };
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AuthInfo> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretKey);

  return {
    token,
    clientId: (payload.client_id as string) || '',
    scopes: ((payload.scope as string) || '').split(' ').filter(Boolean),
    expiresAt: payload.exp,
  };
}

export function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 86400; // default 24h
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return 86400;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/token.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/mcp-server/src/auth/token.ts packages/mcp-server/tests/unit/auth/token.test.ts
git commit -m "feat(auth): add JWT token issuance and verification with jose"
```

---

### Task 5: In-memory OAuth clients store

**Files:**
- Create: `packages/mcp-server/src/auth/clients-store.ts`
- Create: `packages/mcp-server/tests/unit/auth/clients-store.test.ts`

**Step 1: Write the tests**

```typescript
// tests/unit/auth/clients-store.test.ts
import { InMemoryClientsStore } from '../../src/auth/clients-store.js';

describe('InMemoryClientsStore', () => {
  it('returns undefined for unknown client', async () => {
    const store = new InMemoryClientsStore();
    expect(await store.getClient('nope')).toBeUndefined();
  });

  it('registers a client and retrieves it', async () => {
    const store = new InMemoryClientsStore();
    const registered = await store.registerClient({
      redirect_uris: ['https://example.com/callback'],
      client_name: 'Test Client',
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    } as any);

    expect(registered.client_id).toBeDefined();
    expect(registered.client_name).toBe('Test Client');

    const retrieved = await store.getClient(registered.client_id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.client_id).toBe(registered.client_id);
  });

  it('generates unique client IDs', async () => {
    const store = new InMemoryClientsStore();
    const a = await store.registerClient({ redirect_uris: ['https://a.com/cb'] } as any);
    const b = await store.registerClient({ redirect_uris: ['https://b.com/cb'] } as any);
    expect(a.client_id).not.toBe(b.client_id);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/clients-store.test.ts
```

**Step 3: Write the implementation**

```typescript
// src/auth/clients-store.ts
import { randomUUID } from 'node:crypto';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';

// Use a generic type for client info to avoid tight coupling to SDK Zod schemas
type ClientInfo = { client_id: string; [key: string]: unknown };

export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, ClientInfo>();

  async getClient(clientId: string): Promise<ClientInfo | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(clientMetadata: Record<string, unknown>): Promise<ClientInfo> {
    const clientId = randomUUID();
    const client: ClientInfo = {
      ...clientMetadata,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(clientId, client);
    return client;
  }
}
```

**Note:** The `OAuthRegisteredClientsStore` interface uses Zod-inferred types from the SDK. If the exact type imports cause issues, the implementing agent should check the SDK's exported types and adjust the imports. The important thing is that the class satisfies the interface contract: `getClient(id) → client | undefined` and `registerClient(metadata) → client`.

**Step 4: Run tests to verify they pass**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/clients-store.test.ts
```

**Step 5: Commit**

```bash
git add packages/mcp-server/src/auth/clients-store.ts packages/mcp-server/tests/unit/auth/clients-store.test.ts
git commit -m "feat(auth): add in-memory OAuth clients store with dynamic registration"
```

---

### Task 6: Login page HTML template

**Files:**
- Create: `packages/mcp-server/src/auth/login-page.ts`

**Step 1: Write the implementation**

This is a pure template function with no logic worth TDD-ing — just string interpolation.

```typescript
// src/auth/login-page.ts

export interface LoginPageParams {
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  error?: string;
}

export function renderLoginPage(params: LoginPageParams): string {
  const error = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TradeBlocks - Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a; color: #e5e5e5;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #171717; border: 1px solid #262626;
      border-radius: 12px; padding: 2rem;
      width: 100%; max-width: 400px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #a3a3a3; margin-bottom: 1.5rem; font-size: 0.875rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; color: #d4d4d4; }
    input[type="text"], input[type="password"] {
      width: 100%; padding: 0.5rem 0.75rem;
      background: #0a0a0a; border: 1px solid #404040;
      border-radius: 6px; color: #e5e5e5; font-size: 1rem;
      margin-bottom: 1rem;
    }
    input:focus { outline: none; border-color: #3b82f6; }
    button {
      width: 100%; padding: 0.625rem;
      background: #3b82f6; color: white;
      border: none; border-radius: 6px;
      font-size: 1rem; cursor: pointer;
    }
    button:hover { background: #2563eb; }
    .error {
      background: #451a1a; border: 1px solid #7f1d1d;
      color: #fca5a5; padding: 0.75rem;
      border-radius: 6px; margin-bottom: 1rem; font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>TradeBlocks</h1>
    <p class="subtitle">Sign in to access your trading data</p>
    ${error}
    <form method="POST" action="/login">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(params.state || '')}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
      <input type="hidden" name="scopes" value="${escapeHtml(params.scopes.join(' '))}">
      ${params.resource ? `<input type="hidden" name="resource" value="${escapeHtml(params.resource)}">` : ''}
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autocomplete="username">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

**Step 2: Commit**

```bash
git add packages/mcp-server/src/auth/login-page.ts
git commit -m "feat(auth): add HTML login page template"
```

---

### Task 7: OAuth server provider

This is the core piece. It implements `OAuthServerProvider` from the MCP SDK and integrates the code store, token utilities, and login page.

**Files:**
- Create: `packages/mcp-server/src/auth/provider.ts`
- Create: `packages/mcp-server/tests/unit/auth/provider.test.ts`

**Step 1: Write the tests**

```typescript
// tests/unit/auth/provider.test.ts
import { TradeBlocksAuthProvider } from '../../src/auth/provider.js';
import type { AuthConfig } from '../../src/auth/config.js';

const TEST_CONFIG: AuthConfig = {
  username: 'admin',
  password: 'secret',
  jwtSecret: 'test-secret-key-at-least-32-characters-long',
  jwtExpiry: '1h',
  noAuth: false,
};

describe('TradeBlocksAuthProvider', () => {
  let provider: TradeBlocksAuthProvider;

  beforeEach(() => {
    provider = new TradeBlocksAuthProvider(TEST_CONFIG);
  });

  describe('authorize', () => {
    it('sends HTML login page via res', async () => {
      let sentHtml = '';
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn((html: string) => { sentHtml = html; }),
      } as any;

      await provider.authorize(
        { client_id: 'c1', redirect_uris: ['https://example.com/cb'] },
        {
          state: 'xyz',
          scopes: [],
          codeChallenge: 'challenge123',
          redirectUri: 'https://example.com/cb',
        },
        mockRes
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(sentHtml).toContain('TradeBlocks');
      expect(sentHtml).toContain('challenge123');
    });
  });

  describe('handleLogin', () => {
    it('returns redirect URL on valid credentials', () => {
      const result = provider.handleLogin({
        username: 'admin',
        password: 'secret',
        redirect_uri: 'https://example.com/cb',
        state: 'xyz',
        code_challenge: 'challenge123',
        client_id: 'c1',
      });
      expect('redirectUrl' in result).toBe(true);
      if ('redirectUrl' in result) {
        const url = new URL(result.redirectUrl);
        expect(url.origin).toBe('https://example.com');
        expect(url.searchParams.get('code')).toBeDefined();
        expect(url.searchParams.get('state')).toBe('xyz');
      }
    });

    it('returns error on invalid credentials', () => {
      const result = provider.handleLogin({
        username: 'admin',
        password: 'wrong',
        redirect_uri: 'https://example.com/cb',
        code_challenge: 'c',
        client_id: 'c1',
      });
      expect('error' in result).toBe(true);
    });
  });

  describe('challengeForAuthorizationCode', () => {
    it('returns the stored challenge for a valid code', async () => {
      // First, create a code via handleLogin
      const result = provider.handleLogin({
        username: 'admin',
        password: 'secret',
        redirect_uri: 'https://example.com/cb',
        code_challenge: 'my-challenge',
        client_id: 'c1',
      });
      expect('redirectUrl' in result).toBe(true);
      if (!('redirectUrl' in result)) return;

      const url = new URL(result.redirectUrl);
      const code = url.searchParams.get('code')!;

      const challenge = await provider.challengeForAuthorizationCode(
        { client_id: 'c1' },
        code
      );
      expect(challenge).toBe('my-challenge');
    });

    it('throws for invalid code', async () => {
      await expect(
        provider.challengeForAuthorizationCode({ client_id: 'c1' }, 'bad-code')
      ).rejects.toThrow();
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('returns JWT tokens for valid code and matching client', async () => {
      const result = provider.handleLogin({
        username: 'admin',
        password: 'secret',
        redirect_uri: 'https://example.com/cb',
        code_challenge: 'my-challenge',
        client_id: 'c1',
      });
      if (!('redirectUrl' in result)) throw new Error('Expected redirect');

      const url = new URL(result.redirectUrl);
      const code = url.searchParams.get('code')!;

      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1' },
        code
      );
      expect(tokens.access_token).toMatch(/^eyJ/);
      expect(tokens.token_type).toBe('bearer');
      expect(tokens.expires_in).toBe(3600);
    });

    it('rejects code issued to different client', async () => {
      const result = provider.handleLogin({
        username: 'admin',
        password: 'secret',
        redirect_uri: 'https://example.com/cb',
        code_challenge: 'c',
        client_id: 'c1',
      });
      if (!('redirectUrl' in result)) throw new Error('Expected redirect');

      const url = new URL(result.redirectUrl);
      const code = url.searchParams.get('code')!;

      await expect(
        provider.exchangeAuthorizationCode({ client_id: 'c2' }, code)
      ).rejects.toThrow('not issued to this client');
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies a token issued by this provider', async () => {
      const result = provider.handleLogin({
        username: 'admin',
        password: 'secret',
        redirect_uri: 'https://example.com/cb',
        code_challenge: 'c',
        client_id: 'c1',
      });
      if (!('redirectUrl' in result)) throw new Error('Expected redirect');

      const url = new URL(result.redirectUrl);
      const code = url.searchParams.get('code')!;

      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1' },
        code
      );

      const authInfo = await provider.verifyAccessToken(tokens.access_token);
      expect(authInfo.clientId).toBe('c1');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/provider.test.ts
```

**Step 3: Write the implementation**

```typescript
// src/auth/provider.ts
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InMemoryClientsStore } from './clients-store.js';
import { AuthCodeStore } from './code-store.js';
import { issueAccessToken, verifyAccessToken as verifyJwt } from './token.js';
import { renderLoginPage } from './login-page.js';
import type { AuthConfig } from './config.js';

// Match the SDK's AuthorizationParams shape
interface AuthorizationParams {
  state?: string;
  scopes?: string[];
  codeChallenge: string;
  redirectUri: string;
  resource?: URL;
}

interface LoginBody {
  username: string;
  password: string;
  redirect_uri: string;
  state?: string;
  code_challenge: string;
  client_id: string;
  scopes?: string;
  resource?: string;
}

type LoginResult = { redirectUrl: string } | { error: string };

export class TradeBlocksAuthProvider implements OAuthServerProvider {
  private _clientsStore: InMemoryClientsStore;
  private codeStore: AuthCodeStore;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this._clientsStore = new InMemoryClientsStore();
    this.codeStore = new AuthCodeStore();
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  async authorize(
    client: { client_id: string; [key: string]: unknown },
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const html = renderLoginPage({
      redirectUri: params.redirectUri,
      state: params.state,
      codeChallenge: params.codeChallenge,
      clientId: client.client_id,
      scopes: params.scopes || [],
      resource: params.resource?.toString(),
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  handleLogin(body: LoginBody): LoginResult {
    if (!this.validateCredentials(body.username, body.password)) {
      return { error: 'Invalid username or password' };
    }

    const code = randomUUID();
    this.codeStore.store(code, {
      codeChallenge: body.code_challenge,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      scopes: (body.scopes || '').split(' ').filter(Boolean),
      resource: body.resource ? new URL(body.resource) : undefined,
    });

    const targetUrl = new URL(body.redirect_uri);
    targetUrl.searchParams.set('code', code);
    if (body.state) {
      targetUrl.searchParams.set('state', body.state);
    }

    return { redirectUrl: targetUrl.toString() };
  }

  async challengeForAuthorizationCode(
    _client: { client_id: string; [key: string]: unknown },
    authorizationCode: string
  ): Promise<string> {
    const entry = this.codeStore.peek(authorizationCode);
    if (!entry) throw new Error('Invalid authorization code');
    return entry.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: { client_id: string; [key: string]: unknown },
    authorizationCode: string
  ): Promise<{ access_token: string; token_type: string; expires_in: number; scope: string }> {
    const entry = this.codeStore.consume(authorizationCode);
    if (!entry) throw new Error('Invalid or expired authorization code');

    if (entry.clientId !== client.client_id) {
      throw new Error('Authorization code was not issued to this client');
    }

    const { access_token, expires_in } = await issueAccessToken({
      clientId: client.client_id,
      scopes: entry.scopes,
      secret: this.config.jwtSecret,
      expiry: this.config.jwtExpiry,
    });

    return {
      access_token,
      token_type: 'bearer',
      expires_in,
      scope: entry.scopes.join(' '),
    };
  }

  async exchangeRefreshToken(): Promise<never> {
    throw new Error('Refresh tokens are not supported');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    return verifyJwt(token, this.config.jwtSecret);
  }

  private validateCredentials(username: string, password: string): boolean {
    // Use SHA-256 hashing + timing-safe comparison to prevent timing attacks.
    // Hashing first normalizes the length so timingSafeEqual doesn't throw.
    const hashA = createHash('sha256').update(username).digest();
    const hashB = createHash('sha256').update(this.config.username).digest();
    const hashC = createHash('sha256').update(password).digest();
    const hashD = createHash('sha256').update(this.config.password).digest();
    return timingSafeEqual(hashA, hashB) && timingSafeEqual(hashC, hashD);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/provider.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/mcp-server/src/auth/provider.ts packages/mcp-server/tests/unit/auth/provider.test.ts
git commit -m "feat(auth): add OAuth server provider with login flow and JWT issuance"
```

---

### Task 8: Wire auth into HTTP server

**Files:**
- Modify: `packages/mcp-server/src/http-server.ts`

**Step 1: Update HttpServerOptions to accept auth config**

The `startHttpServer` function gains an optional `auth` parameter. When present and `noAuth` is false, it mounts the OAuth routes and protects MCP endpoints.

**Step 2: Write the updated http-server.ts**

Replace the entire `packages/mcp-server/src/http-server.ts` with:

```typescript
/**
 * HTTP Server for MCP
 *
 * Provides HTTP transport for web platforms (ChatGPT, Google AI Studio, Julius, Claude.ai)
 * that cannot connect to stdio-based MCP servers.
 *
 * When auth is configured, adds OAuth 2.1 Authorization Code + PKCE flow:
 * - /.well-known/oauth-authorization-server (discovery)
 * - /authorize, /token, /register (via MCP SDK auth router)
 * - /login (custom credential form handler)
 * - Bearer token validation on /mcp endpoints
 */

import { createServer, type Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express, type Request, type Response, type RequestHandler } from "express";
import type { AuthConfig } from "./auth/config.js";

export interface HttpServerOptions {
  port: number;
  host?: string;
  auth?: AuthConfig;
}

/** Factory function type for creating configured MCP servers */
export type ServerFactory = () => McpServer;

/**
 * Creates and starts an HTTP server for MCP with optional OAuth authentication.
 */
export async function startHttpServer(
  serverFactory: ServerFactory,
  options: HttpServerOptions
): Promise<Server> {
  const { port, host = "0.0.0.0", auth } = options;

  const app: Express = express();
  app.use(express.json());

  // Auth middleware array - empty when auth is disabled
  let mcpAuthMiddleware: RequestHandler[] = [];

  if (auth && !auth.noAuth) {
    // Dynamically import auth modules to avoid loading them when unused
    const { mcpAuthRouter } = await import(
      "@modelcontextprotocol/sdk/server/auth/router.js"
    );
    const { requireBearerAuth } = await import(
      "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js"
    );
    const { TradeBlocksAuthProvider } = await import("./auth/provider.js");
    const { renderLoginPage } = await import("./auth/login-page.js");

    const provider = new TradeBlocksAuthProvider(auth);

    // Determine issuer URL (public URL for OAuth discovery metadata)
    const issuerUrl = new URL(
      auth.issuerUrl || `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`
    );

    // Mount OAuth routes: /.well-known, /authorize, /token, /register
    app.use(mcpAuthRouter({ provider, issuerUrl }));

    // Parse URL-encoded form bodies for /login
    app.use(express.urlencoded({ extended: false }));

    // Custom login route for credential form submission
    app.post("/login", (req: Request, res: Response) => {
      const result = provider.handleLogin(req.body);
      if ("error" in result) {
        // Re-render login page with error message
        const html = renderLoginPage({
          redirectUri: req.body.redirect_uri || "",
          state: req.body.state,
          codeChallenge: req.body.code_challenge || "",
          clientId: req.body.client_id || "",
          scopes: (req.body.scopes || "").split(" ").filter(Boolean),
          resource: req.body.resource,
          error: result.error,
        });
        res.setHeader("Content-Type", "text/html");
        res.send(html);
        return;
      }
      res.redirect(result.redirectUrl);
    });

    // Create auth middleware for MCP endpoints
    mcpAuthMiddleware = [requireBearerAuth({ verifier: provider })];

    console.error(`Authentication enabled. Login at ${issuerUrl}/authorize`);
  } else if (auth?.noAuth) {
    console.error(
      "WARNING: Authentication disabled (--no-auth). Only use behind an authenticating reverse proxy."
    );
  }

  // Health check endpoint
  app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
      name: "tradeblocks-mcp",
      status: "ok",
      mcp_endpoint: "/mcp",
    });
  });

  // MCP endpoints with conditional auth middleware
  app.post("/", ...mcpAuthMiddleware, handleMcpRequest(serverFactory));
  app.post("/mcp", ...mcpAuthMiddleware, handleMcpRequest(serverFactory));

  app.get("/mcp", ...mcpAuthMiddleware, (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method not allowed. Use POST for MCP requests.",
      },
      id: null,
    });
  });

  app.delete("/mcp", ...mcpAuthMiddleware, (_req: Request, res: Response) => {
    res.status(202).send();
  });

  const httpServer = createServer(app);

  return new Promise((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, host, () => {
      console.error(
        `TradeBlocks MCP HTTP server listening on http://${host}:${port}/mcp`
      );
      console.error(`Health check available at http://${host}:${port}/`);
      resolve(httpServer);
    });
  });
}

/**
 * Creates a request handler that instantiates fresh server+transport per request.
 * This is the correct stateless pattern per MCP SDK examples.
 */
function handleMcpRequest(serverFactory: ServerFactory) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const server = serverFactory();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };
}
```

**Step 3: Verify the build compiles**

```bash
cd packages/mcp-server && npx tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/http-server.ts
git commit -m "feat(auth): wire OAuth routes and Bearer middleware into HTTP server"
```

---

### Task 9: CLI updates — --no-auth flag and startup validation

**Files:**
- Modify: `packages/mcp-server/src/index.ts`

**Step 1: Update parseServerArgs to include --no-auth and --market-db**

In the `parseServerArgs` function in `src/index.ts`, add `noAuth` to the return type and parse the `--no-auth` flag:

```typescript
function parseServerArgs(): {
  http: boolean;
  port: number;
  noAuth: boolean;
  directory: string | undefined;
} {
  const args = process.argv.slice(2);
  let http = false;
  let port = 3100;
  let noAuth = false;
  let directory: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--http") {
      http = true;
    } else if (arg === "--port" && args[i + 1]) {
      const parsedPort = parseInt(args[i + 1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        port = parsedPort;
      }
      i++;
    } else if (arg === "--no-auth") {
      noAuth = true;
    } else if (!arg.startsWith("-") && !arg.startsWith("--")) {
      directory = arg;
    }
  }

  if (!directory) {
    directory = process.env.BLOCKS_DIRECTORY;
  }

  return { http, port, noAuth, directory };
}
```

**Step 2: Update the MCP Server mode section to load and pass auth config**

In the `main()` function, after parsing server args and before creating the MCP server, add auth config loading for HTTP mode:

```typescript
  if (http) {
    // Load auth config for HTTP mode
    const { loadAuthConfig } = await import("./auth/config.js");
    let auth;
    try {
      auth = loadAuthConfig({ noAuth });
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    const { startHttpServer } = await import("./http-server.js");
    await startHttpServer(createServer, { port, auth });
  }
```

**Step 3: Update the --help text**

In `printUsage()`, add the `--no-auth` option:

```
Options:
  --http             Start HTTP server instead of stdio (for web platforms)
  --port <number>    HTTP server port (default: 3100, requires --http)
  --no-auth          Disable authentication (only use behind an auth proxy)
  --market-db <path> Path to market.duckdb (default: <folder>/market.duckdb)
```

**Step 4: Verify the build compiles**

```bash
cd packages/mcp-server && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add packages/mcp-server/src/index.ts
git commit -m "feat(auth): add --no-auth flag and auth config loading to CLI"
```

---

### Task 10: Dockerfile

**Files:**
- Create: `packages/mcp-server/Dockerfile`
- Create: `packages/mcp-server/.dockerignore`

**Step 1: Write the Dockerfile**

```dockerfile
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
```

**Step 2: Write the .dockerignore**

```
# packages/mcp-server/.dockerignore
node_modules
.git
*.md
tests
scripts
docs
*.test.ts
.env
.env.*
data
```

**Step 3: Verify Docker build (optional — skip if Docker not available locally)**

```bash
cd packages/mcp-server && docker build -t tradeblocks-mcp .
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/mcp-server/Dockerfile packages/mcp-server/.dockerignore
git commit -m "feat(docker): add multi-stage Dockerfile for MCP server"
```

---

### Task 11: Docker Compose, .env.example, and Syncthing config

**Files:**
- Create: `packages/mcp-server/docker-compose.yml`
- Create: `packages/mcp-server/.env.example`
- Create: `packages/mcp-server/data/.stignore`

**Step 1: Write docker-compose.yml**

```yaml
# packages/mcp-server/docker-compose.yml
services:
  tradeblocks:
    build: .
    ports:
      - "${TRADEBLOCKS_PORT:-3100}:3100"
    volumes:
      - ./data:/data
    env_file: .env
    restart: unless-stopped

  # Optional: auto-sync backtest files from another machine.
  # Syncthing watches the data/ directory and syncs CSVs between devices.
  # DuckDB files are excluded via data/.stignore.
  #
  # To enable:
  # 1. Uncomment the syncthing service below
  # 2. Run: docker compose up -d
  # 3. Open http://localhost:8384 to configure sync folders
  #
  # syncthing:
  #   image: syncthing/syncthing:latest
  #   volumes:
  #     - ./data:/var/syncthing/data
  #     - syncthing-config:/var/syncthing/config
  #   ports:
  #     - "8384:8384"    # Web UI
  #     - "22000:22000"  # Sync protocol (TCP)
  #     - "22000:22000/udp"  # Sync protocol (QUIC)
  #   environment:
  #     - PUID=1000
  #     - PGID=1000
  #   restart: unless-stopped

# volumes:
#   syncthing-config:
```

**Step 2: Write .env.example**

```bash
# packages/mcp-server/.env.example
#
# TradeBlocks MCP Server Configuration
# Copy this file to .env and fill in the values.
#

# --- Required ---

# Login credentials
TRADEBLOCKS_USERNAME=admin
TRADEBLOCKS_PASSWORD=changeme

# JWT signing secret — generate with: openssl rand -hex 32
TRADEBLOCKS_JWT_SECRET=

# --- Optional ---

# HTTP server port (default: 3100)
# TRADEBLOCKS_PORT=3100

# JWT token expiry (default: 24h). Examples: 1h, 7d, 30m
# TRADEBLOCKS_JWT_EXPIRY=24h

# Public URL for OAuth discovery metadata.
# Set this when running behind a reverse proxy with a custom domain.
# Example: https://mcp.yourdomain.com
# TRADEBLOCKS_ISSUER_URL=

# Disable authentication entirely.
# Only use this if the server is behind a reverse proxy that handles auth.
# TRADEBLOCKS_NO_AUTH=false
```

**Step 3: Write data/.stignore (for Syncthing users)**

```
// .stignore — prevents Syncthing from syncing DuckDB files.
// DuckDB databases are built server-side from imported data and should
// not be synced. Only backtest CSV folders should transfer between devices.
*.duckdb
*.duckdb.wal
*.duckdb.tmp
```

**Step 4: Create data/.gitkeep to ensure the directory exists**

```bash
mkdir -p packages/mcp-server/data
touch packages/mcp-server/data/.gitkeep
```

**Step 5: Commit**

```bash
git add packages/mcp-server/docker-compose.yml packages/mcp-server/.env.example packages/mcp-server/data/.stignore packages/mcp-server/data/.gitkeep
git commit -m "feat(docker): add docker-compose, env template, and Syncthing config"
```

---

### Task 12: Run full test suite and verify build

This is the final verification task.

**Step 1: Run all auth unit tests**

```bash
cd packages/mcp-server && NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/auth/
```

Expected: All tests pass (config, code-store, token, clients-store, provider)

**Step 2: Run full MCP server test suite**

```bash
cd packages/mcp-server && npm test
```

Expected: All existing tests still pass, plus new auth tests

**Step 3: Verify TypeScript compiles**

```bash
cd packages/mcp-server && npx tsc --noEmit
```

Expected: No errors

**Step 4: Verify the build succeeds**

```bash
cd packages/mcp-server && npm run build
```

Expected: Build completes, server/ and dist/ output generated

**Step 5: Bump version to 1.5.0 (new feature: auth + Docker)**

In `packages/mcp-server/package.json`, update version to `"1.5.0"`.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(auth): OAuth 2.1 + PKCE authentication for HTTP mode with Docker support

Adds built-in OAuth 2.1 Authorization Code + PKCE flow to the MCP HTTP
server. Self-hosters configure username/password via env vars. Includes
Docker packaging with optional Syncthing sidecar for file sync."
```
