# Market Data Provider Abstraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Massive.com API calls with a provider interface so multiple data providers (Massive, ThetaData) can be used interchangeably.

**Architecture:** Provider interface (`MarketDataProvider`) with `fetchBars` and `fetchOptionSnapshot` methods. Lazy-singleton factory selects provider via `MARKET_DATA_PROVIDER` env var. Massive adapter wraps existing logic; ThetaData adapter is new. All 5 callsites migrate to factory.

**Tech Stack:** TypeScript, Zod 4, native fetch, Jest 30, @duckdb/node-api

**Spec:** `docs/superpowers/specs/2026-03-24-market-data-provider-abstraction-design.md`

---

## File Structure

**New files:**
| File | Responsibility |
|------|---------------|
| `src/utils/market-provider.ts` | `BarRow`, `AssetClass`, `OptionContract`, `FetchBarsOptions`, `FetchSnapshotOptions`, `FetchSnapshotResult`, `MarketDataProvider` interface, `getProvider()` factory, `_resetProvider()` |
| `src/utils/providers/massive.ts` | `MassiveProvider` class — wraps existing Massive HTTP logic |
| `src/utils/providers/thetadata.ts` | `ThetaDataProvider` class — ThetaData REST API adapter |
| `tests/unit/market-provider.test.ts` | Factory routing tests |
| `tests/unit/providers/massive.test.ts` | Massive adapter unit tests (migrated from existing) |
| `tests/unit/providers/thetadata.test.ts` | ThetaData adapter unit tests |

**Modified files:**
| File | Change |
|------|--------|
| `src/utils/bar-cache.ts` | Import `BarRow`/`AssetClass` from `market-provider.ts`, use `getProvider().fetchBars()` |
| `src/utils/market-importer.ts` | Import from `market-provider.ts`, rename `importFromMassive` → `importFromApi`, rename `ImportFromMassiveOptions` → `ImportFromApiOptions` |
| `src/utils/trade-replay.ts` | `MassiveBarRow` → `BarRow` type import |
| `src/utils/data-availability.ts` | Update help text: `import_from_massive` → `import_from_api` |
| `src/tools/exit-analysis.ts` | Use `getProvider().fetchBars()` |
| `src/tools/snapshot.ts` | Use `getProvider().fetchOptionSnapshot()`, remove `injectedFetcher` DI |
| `src/tools/replay.ts` | `MassiveBarRow` → `BarRow` type import |
| `src/tools/market-imports.ts` | Rename tool `import_from_massive` → `import_from_api`, call `importFromApi` |
| `src/test-exports.ts` | Replace Massive re-exports with provider interface exports |
| `tests/unit/trade-replay.test.ts` | `MassiveBarRow` → `BarRow` |
| `tests/unit/trade-replay-greeks.test.ts` | `MassiveBarRow` → `BarRow` |
| `tests/integration/massive-import.test.ts` | `importFromMassive` → `importFromApi` |
| `tests/integration/trade-replay.test.ts` | `MassiveBarRow` → `BarRow`, `MassiveAggregateResponse` import path update |

**Removed after migration:**
| File | Reason |
|------|--------|
| `src/utils/massive-client.ts` | Logic moved into `providers/massive.ts` |
| `src/utils/massive-snapshot.ts` | Logic moved into `providers/massive.ts` |
| `tests/unit/massive-client-utils.test.ts` | Migrated to `tests/unit/providers/massive.test.ts` |
| `tests/unit/massive-client-fetch.test.ts` | Migrated to `tests/unit/providers/massive.test.ts` |
| `tests/unit/massive-snapshot.test.ts` | Migrated to `tests/unit/providers/massive.test.ts` |

---

## Task 1: Create Provider Interface + Factory + Massive Adapter

This task creates the interface, factory, AND the Massive adapter together so that `test-exports.ts` can be updated atomically — avoiding duplicate export name collisions between old and new modules.

**Files:**
- Create: `packages/mcp-server/src/utils/market-provider.ts`
- Create: `packages/mcp-server/src/utils/providers/massive.ts`
- Create: `packages/mcp-server/tests/unit/market-provider.test.ts`
- Create: `packages/mcp-server/tests/unit/providers/massive.test.ts`
- Modify: `packages/mcp-server/src/test-exports.ts`

- [ ] **Step 1: Create `market-provider.ts` with interface, types, and factory**

```typescript
// src/utils/market-provider.ts
import { MassiveProvider } from "./providers/massive.js";
import { ThetaDataProvider } from "./providers/thetadata.js";

/** Normalized OHLCV bar — shared output type for all providers. */
export interface BarRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticker: string;
  time?: string;
}

export type AssetClass = "stock" | "index" | "option";

export interface FetchBarsOptions {
  ticker: string;
  from: string;
  to: string;
  timespan?: "day" | "minute" | "hour";
  multiplier?: number;
  assetClass?: AssetClass;
}

export interface OptionContract {
  ticker: string;
  underlying_ticker: string;
  underlying_price: number;
  contract_type: "call" | "put";
  strike: number;
  expiration: string;
  exercise_style: string;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  greeks_source: "massive" | "thetadata" | "computed";
  bid: number;
  ask: number;
  midpoint: number;
  last_price: number | null;
  open_interest: number;
  volume: number;
  break_even: number;
}

export interface FetchSnapshotOptions {
  underlying: string;
  strike_price_gte?: number;
  strike_price_lte?: number;
  expiration_date_gte?: string;
  expiration_date_lte?: string;
  contract_type?: "call" | "put";
}

export interface FetchSnapshotResult {
  contracts: OptionContract[];
  underlying_price: number;
  underlying_ticker: string;
}

export interface MarketDataProvider {
  readonly name: string;
  fetchBars(options: FetchBarsOptions): Promise<BarRow[]>;
  fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult>;
}

// --- Factory (lazy singleton with static imports) ---

let _cached: MarketDataProvider | null = null;

export function getProvider(): MarketDataProvider {
  if (_cached) return _cached;
  const name = (process.env.MARKET_DATA_PROVIDER ?? "massive").toLowerCase();
  switch (name) {
    case "massive":
      _cached = new MassiveProvider();
      break;
    case "thetadata":
      _cached = new ThetaDataProvider();
      break;
    default:
      throw new Error(
        `Unknown MARKET_DATA_PROVIDER: "${name}". Supported: massive, thetadata`
      );
  }
  return _cached!;
}

export function _resetProvider(): void {
  _cached = null;
}
```

**IMPORTANT:** This uses static top-level imports (not `require()`). The project is `"type": "module"` — `require()` is illegal. Static imports of both providers is fine since the modules are small and have no side effects. The lazy singleton pattern means only the selected provider's API key is read at runtime.

- [ ] **Step 2: Create `providers/` directory and Massive adapter**

Move logic from `massive-client.ts` and `massive-snapshot.ts` into a class:

```typescript
// src/utils/providers/massive.ts
import type {
  MarketDataProvider, BarRow, FetchBarsOptions,
  FetchSnapshotOptions, FetchSnapshotResult, OptionContract, AssetClass
} from '../market-provider.js';
import { z } from "zod";
import { computeLegGreeks } from '../black-scholes.js';

// --- Zod schemas (moved from massive-client.ts) ---
// MassiveBarSchema, MassiveAggregateResponseSchema
// MassiveSnapshotGreeksSchema, MassiveSnapshotContractSchema, MassiveSnapshotResponseSchema, etc.
// ALL schemas from both massive-client.ts and massive-snapshot.ts

// --- Ticker normalization (moved from massive-client.ts) ---
// toMassiveTicker, fromMassiveTicker

// --- Timestamp conversion (moved from massive-client.ts) ---
// massiveTimestampToETDate, massiveTimestampToETTime

// --- HTTP helpers (moved from massive-client.ts) ---
// getApiKey (reads MASSIVE_API_KEY), fetchWithRetry

// --- Constants ---
// MASSIVE_BASE_URL, MASSIVE_MAX_LIMIT, MASSIVE_MAX_PAGES

// --- Snapshot helpers (moved from massive-snapshot.ts) ---
// computeDTE, detectAssetClass, mapContract, INDEX_TICKERS

export class MassiveProvider implements MarketDataProvider {
  readonly name = "massive";

  async fetchBars(options: FetchBarsOptions): Promise<BarRow[]> {
    // Existing fetchBars logic from massive-client.ts lines 283-380
    // Returns BarRow[] instead of MassiveBarRow[]
  }

  async fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult> {
    // Existing fetchOptionSnapshot logic from massive-snapshot.ts lines 362-470
    // Returns FetchSnapshotResult with OptionContract[]
  }
}

// Re-export utilities needed by other modules and tests
export { toMassiveTicker, fromMassiveTicker, massiveTimestampToETDate, massiveTimestampToETTime };
export { MassiveBarSchema, MassiveAggregateResponseSchema, MASSIVE_BASE_URL, MASSIVE_MAX_LIMIT, MASSIVE_MAX_PAGES };
// Re-export types needed by integration tests
export type { MassiveBar, MassiveAggregateResponse } from the Zod schema inferences;
```

The class methods are the existing free functions wrapped as methods. Keep all Massive-specific internals (Zod schemas, ticker prefixes, pagination) private to this file.

**Critical:** Re-export `MassiveAggregateResponse` type — it's imported by `tests/integration/trade-replay.test.ts` line 15.

- [ ] **Step 3: Create stub ThetaData adapter (needed for static import in market-provider.ts)**

```typescript
// src/utils/providers/thetadata.ts
import type { MarketDataProvider, BarRow, FetchBarsOptions, FetchSnapshotOptions, FetchSnapshotResult } from '../market-provider.js';

export class ThetaDataProvider implements MarketDataProvider {
  readonly name = "thetadata";

  async fetchBars(_options: FetchBarsOptions): Promise<BarRow[]> {
    throw new Error("ThetaData provider not yet implemented — set MARKET_DATA_PROVIDER=massive");
  }

  async fetchOptionSnapshot(_options: FetchSnapshotOptions): Promise<FetchSnapshotResult> {
    throw new Error("ThetaData provider not yet implemented — set MARKET_DATA_PROVIDER=massive");
  }
}
```

This stub is needed because `market-provider.ts` has a static import of `ThetaDataProvider`. The real implementation comes in Task 5.

- [ ] **Step 4: Migrate existing Massive tests**

Create `tests/unit/providers/massive.test.ts` by combining content from:
- `tests/unit/massive-client-utils.test.ts` (ticker normalization, timestamp conversion)
- `tests/unit/massive-client-fetch.test.ts` (fetchBars with mocked fetch)
- `tests/unit/massive-snapshot.test.ts` (fetchOptionSnapshot with mocked fetch)

Update imports to use the new provider path (via test-exports or direct).

Key changes in tests:
- `fetchBars(...)` → `new MassiveProvider().fetchBars(...)` (or `provider.fetchBars(...)`)
- `MassiveBarRow` → `BarRow`
- `MassiveAssetClass` → `AssetClass`
- `fetchOptionSnapshot(...)` → `new MassiveProvider().fetchOptionSnapshot(...)`

- [ ] **Step 5: Write factory routing tests**

```typescript
// tests/unit/market-provider.test.ts
import { describe, it, expect, afterEach } from "@jest/globals";

describe("getProvider factory", () => {
  afterEach(() => {
    delete process.env.MARKET_DATA_PROVIDER;
  });

  it("returns MassiveProvider by default", async () => {
    const { getProvider, _resetProvider } = await import("../../dist/test-exports.js");
    _resetProvider();
    const provider = getProvider();
    expect(provider.name).toBe("massive");
  });

  it("returns MassiveProvider when explicitly set", async () => {
    process.env.MARKET_DATA_PROVIDER = "massive";
    const { getProvider, _resetProvider } = await import("../../dist/test-exports.js");
    _resetProvider();
    const provider = getProvider();
    expect(provider.name).toBe("massive");
  });

  it("returns ThetaDataProvider when set", async () => {
    process.env.MARKET_DATA_PROVIDER = "thetadata";
    const { getProvider, _resetProvider } = await import("../../dist/test-exports.js");
    _resetProvider();
    const provider = getProvider();
    expect(provider.name).toBe("thetadata");
  });

  it("is case-insensitive", async () => {
    process.env.MARKET_DATA_PROVIDER = "ThetaData";
    const { getProvider, _resetProvider } = await import("../../dist/test-exports.js");
    _resetProvider();
    const provider = getProvider();
    expect(provider.name).toBe("thetadata");
  });

  it("throws on unknown provider", async () => {
    process.env.MARKET_DATA_PROVIDER = "unknown";
    const { getProvider, _resetProvider } = await import("../../dist/test-exports.js");
    _resetProvider();
    expect(() => getProvider()).toThrow('Unknown MARKET_DATA_PROVIDER: "unknown"');
  });

  it("caches provider across calls", async () => {
    const { getProvider, _resetProvider } = await import("../../dist/test-exports.js");
    _resetProvider();
    const a = getProvider();
    const b = getProvider();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 6: Update `test-exports.ts` atomically — replace old Massive exports with new provider exports**

Replace the old massive-client exports block (lines ~173-190 of `src/test-exports.ts`) AND the massive-snapshot exports with:

```typescript
// Provider interface and types (replaces massive-client.ts exports)
export {
  getProvider,
  _resetProvider,
  type BarRow,
  type AssetClass,
  type OptionContract,
  type FetchBarsOptions,
  type FetchSnapshotOptions,
  type FetchSnapshotResult,
  type MarketDataProvider,
} from './utils/market-provider.js';

// Massive provider internals (for provider-specific tests)
export {
  MassiveProvider,
  toMassiveTicker,
  fromMassiveTicker,
  massiveTimestampToETDate,
  massiveTimestampToETTime,
  MassiveBarSchema,
  MassiveAggregateResponseSchema,
  MASSIVE_BASE_URL,
  MASSIVE_MAX_LIMIT,
  MASSIVE_MAX_PAGES,
} from './utils/providers/massive.js';

// Also re-export MassiveAggregateResponse type if needed by integration tests
```

**Critical:** This must be done atomically — removing old exports and adding new ones in the same edit. Do NOT add new exports in an earlier step while old conflicting exports still exist (`FetchBarsOptions`, `OptionContract` would collide).

- [ ] **Step 7: Build and run all new tests**

```bash
cd packages/mcp-server && npm run build && npm test -- tests/unit/market-provider.test.ts tests/unit/providers/massive.test.ts -v
```

Expected: All factory tests and Massive provider tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/mcp-server/src/utils/market-provider.ts packages/mcp-server/src/utils/providers/ packages/mcp-server/tests/unit/market-provider.test.ts packages/mcp-server/tests/unit/providers/ packages/mcp-server/src/test-exports.ts
git commit -m "feat: add MarketDataProvider interface, factory, and MassiveProvider adapter"
```

---

## Task 2: Migrate Callsites to Provider Factory

**Files:**
- Modify: `packages/mcp-server/src/utils/bar-cache.ts`
- Modify: `packages/mcp-server/src/utils/market-importer.ts`
- Modify: `packages/mcp-server/src/utils/trade-replay.ts`
- Modify: `packages/mcp-server/src/tools/exit-analysis.ts`
- Modify: `packages/mcp-server/src/tools/snapshot.ts`
- Modify: `packages/mcp-server/src/tools/replay.ts`
- Modify: `packages/mcp-server/src/tools/market-imports.ts`
- Modify: `packages/mcp-server/src/utils/data-availability.ts`

- [ ] **Step 1: Migrate `bar-cache.ts`**

Replace:
```typescript
import type { MassiveBarRow, MassiveAssetClass } from './massive-client.js';
import { fetchBars } from './massive-client.js';
```
With:
```typescript
import type { BarRow, AssetClass } from './market-provider.js';
import { getProvider } from './market-provider.js';
```

Update `FetchBarsWithCacheOptions`:
- `assetClass?: MassiveAssetClass` → `assetClass?: AssetClass`

Update function signature:
- `export async function fetchBarsWithCache(...): Promise<MassiveBarRow[]>` → `Promise<BarRow[]>`

Update internal usage:
- `let bars: MassiveBarRow[] = []` → `let bars: BarRow[] = []`
- `bars = await fetchBars({...})` → `bars = await getProvider().fetchBars({...})`

- [ ] **Step 2: Migrate `market-importer.ts`**

Replace:
```typescript
import { fetchBars, type MassiveAssetClass } from "./massive-client.js";
```
With:
```typescript
import { getProvider, type AssetClass } from "./market-provider.js";
```

Rename:
- `ImportFromMassiveOptions` → `ImportFromApiOptions`
- `importFromMassive` → `importFromApi`
- `assetClass?: MassiveAssetClass` → `assetClass?: AssetClass`
- `function detectAssetClass(ticker: string): MassiveAssetClass` → `function detectAssetClass(ticker: string): AssetClass`

Replace all `fetchBars({...})` calls with `getProvider().fetchBars({...})`.

Update metadata source strings: `import_from_massive:daily:${ticker}` → `import_from_api:daily:${ticker}` (lines 767, 828, 932).

**Note on metadata:** Existing rows in DuckDB `_sync_metadata` with old source strings will remain. This is fine — the upsert key is `(source, ticker, target_table)` so new imports will create new metadata rows. Old metadata rows become orphaned but harmless.

- [ ] **Step 3: Migrate `trade-replay.ts`**

Replace:
```typescript
import type { MassiveBarRow } from './massive-client.js';
```
With:
```typescript
import type { BarRow } from './market-provider.js';
```

Find-replace all `MassiveBarRow` → `BarRow` in this file (lines 316, 327, 328, 347).

- [ ] **Step 4: Migrate `exit-analysis.ts`**

Replace:
```typescript
import { fetchBars } from "../utils/massive-client.js";
```
With:
```typescript
import { getProvider } from "../utils/market-provider.js";
```

In `fetchPriceMap` function (~line 149):
```typescript
// Before:
const bars = await fetchBars({ ticker, from, to, timespan: "minute", assetClass: "index" });
// After:
const bars = await getProvider().fetchBars({ ticker, from, to, timespan: "minute", assetClass: "index" });
```

- [ ] **Step 5: Migrate `snapshot.ts`**

Replace:
```typescript
import { fetchOptionSnapshot } from "../utils/massive-snapshot.js";
```
With:
```typescript
import { getProvider } from "../utils/market-provider.js";
```

Remove `injectedFetcher` parameter from handler (line 59). Replace:
```typescript
const fetcher = injectedFetcher ?? fetchOptionSnapshot;
const result = await fetcher({...});
```
With:
```typescript
const result = await getProvider().fetchOptionSnapshot({...});
```

- [ ] **Step 6: Migrate `replay.ts`**

Replace:
```typescript
import type { MassiveBarRow } from "../utils/massive-client.js";
```
With:
```typescript
import type { BarRow } from "../utils/market-provider.js";
```

Find-replace `MassiveBarRow` → `BarRow` (lines 270, 326).

- [ ] **Step 7: Rename tool in `market-imports.ts`**

At line 227, change:
```typescript
"import_from_massive",
```
To:
```typescript
"import_from_api",
```

Update the tool description to say "Import market data from the configured data provider" instead of Massive-specific language.

Update the handler to call `importFromApi` instead of `importFromMassive`.

**Note:** This is an intentional breaking change for beta 2. The tool name changes from `import_from_massive` to `import_from_api`. No alias needed — beta users expect API changes.

- [ ] **Step 8: Update help text in `data-availability.ts`**

At line 101, change:
```typescript
`Import VIX data with import_from_massive (ticker: "VIX", target_table: "daily") ` +
```
To:
```typescript
`Import VIX data with import_from_api (ticker: "VIX", target_table: "daily") ` +
```

- [ ] **Step 9: Build and typecheck**

```bash
cd packages/mcp-server && npm run build
```

Expected: Clean compile with no errors. All `MassiveBarRow` and `MassiveAssetClass` references should be gone from non-provider files.

- [ ] **Step 10: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "refactor: migrate all callsites to MarketDataProvider factory"
```

---

## Task 3: Migrate Tests + Remove Old Files

**Files:**
- Modify: `packages/mcp-server/tests/unit/trade-replay.test.ts`
- Modify: `packages/mcp-server/tests/unit/trade-replay-greeks.test.ts`
- Modify: `packages/mcp-server/tests/integration/massive-import.test.ts`
- Modify: `packages/mcp-server/tests/integration/trade-replay.test.ts`
- Remove: `packages/mcp-server/src/utils/massive-client.ts`
- Remove: `packages/mcp-server/src/utils/massive-snapshot.ts`
- Remove: `packages/mcp-server/tests/unit/massive-client-utils.test.ts`
- Remove: `packages/mcp-server/tests/unit/massive-client-fetch.test.ts`
- Remove: `packages/mcp-server/tests/unit/massive-snapshot.test.ts`

- [ ] **Step 1: Update `trade-replay.test.ts` (unit)**

Replace `type MassiveBarRow` with `type BarRow` in imports. Find-replace all `MassiveBarRow` → `BarRow` in the file.

- [ ] **Step 2: Update `trade-replay-greeks.test.ts`**

Same pattern: `MassiveBarRow` → `BarRow` in imports and all usages (lines 4, 15, 25).

- [ ] **Step 3: Update `massive-import.test.ts`**

- Rename test describe: `"import_from_massive integration"` → `"import_from_api integration"`
- Update function import: `importFromMassive` → `importFromApi`
- Update any `ImportFromMassiveOptions` → `ImportFromApiOptions`

- [ ] **Step 4: Update `trade-replay.test.ts` (integration)**

This file imports `MassiveAggregateResponse` from `massive-client.ts` (line 15). Update to import from `providers/massive.ts` via test-exports:
```typescript
// Before:
import type { MassiveAggregateResponse } from "../../src/utils/massive-client.js";
// After:
import type { MassiveAggregateResponse } from "../../dist/test-exports.js";
```

Also update any `MassiveBarRow` → `BarRow` references.

- [ ] **Step 5: Remove old Massive files**

```bash
cd packages/mcp-server
rm src/utils/massive-client.ts src/utils/massive-snapshot.ts
rm tests/unit/massive-client-utils.test.ts tests/unit/massive-client-fetch.test.ts tests/unit/massive-snapshot.test.ts
```

- [ ] **Step 6: Verify no remaining references to removed files**

```bash
cd packages/mcp-server && grep -r "massive-client\|massive-snapshot" src/ tests/ --include="*.ts" | grep -v "providers/massive"
```

Expected: No results (all imports now go through `providers/massive.ts` or `market-provider.ts`).

- [ ] **Step 7: Build + run full test suite**

```bash
cd packages/mcp-server && npm run build && npm test
```

Expected: All tests pass. No compile errors.

- [ ] **Step 8: Commit**

```bash
git add -A packages/mcp-server/
git commit -m "refactor: remove old massive-client/snapshot files, migrate all tests to BarRow"
```

---

## Task 4: Implement ThetaData Provider

**Files:**
- Modify: `packages/mcp-server/src/utils/providers/thetadata.ts` (replace stub)
- Create: `packages/mcp-server/tests/unit/providers/thetadata.test.ts`

- [ ] **Step 1: Write ThetaData adapter tests**

```typescript
// tests/unit/providers/thetadata.test.ts
import { describe, it, expect, afterEach, beforeEach } from "@jest/globals";

// Test: fetchBars returns BarRow[] from ThetaData EOD response
// Test: fetchBars handles empty response
// Test: fetchBars throws on missing THETADATA_API_KEY
// Test: fetchBars throws on 401
// Test: fetchBars converts ThetaData YYYYMMDD date format to YYYY-MM-DD
// Test: fetchBars handles intraday (minute) bars with ms_of_day → HH:MM ET conversion
// Test: fetchOptionSnapshot returns OptionContract[] from ThetaData bulk snapshot
// Test: fetchOptionSnapshot applies BS fallback when greeks missing
// Test: fetchOptionSnapshot throws on missing API key
```

Mock `globalThis.fetch` with `jest.spyOn(globalThis, "fetch")` per project conventions.

ThetaData REST API response shapes to mock:
- EOD bars: `{ header: { format: [...] }, response: [[date, open, high, low, close, volume], ...] }`
- Option snapshot: provider-specific format — research ThetaData docs during implementation

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/mcp-server && npm run build && npm test -- tests/unit/providers/thetadata.test.ts -v
```

Expected: All tests FAIL (stub throws "not yet implemented").

- [ ] **Step 3: Implement ThetaDataProvider**

Replace the stub in `src/utils/providers/thetadata.ts` with full implementation:

```typescript
// src/utils/providers/thetadata.ts
import type { MarketDataProvider, BarRow, FetchBarsOptions, FetchSnapshotOptions, FetchSnapshotResult, OptionContract } from '../market-provider.js';
import { z } from "zod";
import { computeLegGreeks } from '../black-scholes.js';

// --- ThetaData API constants ---
const THETADATA_BASE_URL = "https://api.thetadata.us";

// --- Zod schemas for ThetaData responses ---
// Define based on ThetaData REST API documentation

// --- Auth ---
function getApiKey(): string {
  const key = process.env.THETADATA_API_KEY;
  if (!key) {
    throw new Error("Set THETADATA_API_KEY environment variable to use ThetaData market data");
  }
  return key;
}

// --- HTTP helpers ---
// fetchWithRetry (same pattern as Massive, with ThetaData auth header)

export class ThetaDataProvider implements MarketDataProvider {
  readonly name = "thetadata";

  async fetchBars(options: FetchBarsOptions): Promise<BarRow[]> {
    // ThetaData EOD: GET /hist/stock/eod?root={ticker}&start_date={YYYYMMDD}&end_date={YYYYMMDD}
    // ThetaData intraday: GET /hist/stock/trade_quote?root={ticker}&start_date=...&ivl={ms}
    // For options: /hist/option/eod?root={root}&exp={YYYYMMDD}&strike={price*1000}&right={C|P}
    // Map response to BarRow[]
  }

  async fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult> {
    // ThetaData: GET /v2/bulk_snapshot/option/quote?root={underlying}
    // With optional exp, strike filters
    // Map to OptionContract[] with BS fallback for missing greeks
  }
}
```

Implementation notes:
- ThetaData uses YYYYMMDD date format (no hyphens) — convert at boundary
- ThetaData intraday uses `ms_of_day` field — convert to HH:MM ET
- ThetaData option tickers use separate root/exp/strike/right params, not OCC format
- Strike prices in ThetaData are multiplied by 1000 (e.g., 500.00 → 500000)
- Research exact endpoint shapes from ThetaData REST docs during implementation

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/mcp-server && npm run build && npm test -- tests/unit/providers/thetadata.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 5: Update test-exports.ts**

Add:
```typescript
export { ThetaDataProvider } from './utils/providers/thetadata.js';
```

- [ ] **Step 6: Build full project + run all tests**

```bash
cd packages/mcp-server && npm run build && npm test
```

Expected: All tests pass including factory test for `thetadata` provider.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-server/src/utils/providers/thetadata.ts packages/mcp-server/tests/unit/providers/thetadata.test.ts packages/mcp-server/src/test-exports.ts
git commit -m "feat: implement ThetaDataProvider adapter for ThetaData REST API"
```

---

## Task 5: Final Verification + Typecheck

**Files:** None (verification only)

- [ ] **Step 1: Verify no references to old types**

```bash
cd packages/mcp-server && grep -r "MassiveBarRow\|MassiveAssetClass" src/ tests/ --include="*.ts"
```

Expected: Zero results.

- [ ] **Step 2: Verify no imports from removed files**

```bash
cd packages/mcp-server && grep -r "from.*massive-client\|from.*massive-snapshot" src/ tests/ --include="*.ts" | grep -v "providers/massive"
```

Expected: Zero results.

- [ ] **Step 3: Full typecheck**

```bash
cd packages/mcp-server && npx tsc --noEmit
```

Expected: Clean.

- [ ] **Step 4: Full test suite**

```bash
cd packages/mcp-server && npm test
```

Expected: All tests pass.

- [ ] **Step 5: Root-level build**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 6: Commit any remaining fixes**

If any issues found in steps 1-5, fix and commit:
```bash
git commit -m "fix: address remaining provider migration issues"
```
