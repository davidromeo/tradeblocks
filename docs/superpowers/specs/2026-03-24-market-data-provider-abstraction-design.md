# Market Data Provider Abstraction

**Date:** 2026-03-24
**Target:** v2.2 beta 2
**Status:** Approved

## Problem

The Massive.com API is hardcoded across 5 callsites in the MCP server. Users wanting to use alternative data providers (ThetaData, custom APIs) cannot do so without forking the codebase. Amy has specifically requested ThetaData support.

## Decision

Introduce a `MarketDataProvider` interface with adapter pattern. Each provider (Massive, ThetaData) implements the interface. A factory function routes to the active provider based on an environment variable. All callsites migrate from direct Massive imports to the provider factory.

## Provider Interface

All types live in `packages/mcp-server/src/utils/market-provider.ts`.

```typescript
/** Normalized OHLCV bar — the shared output type for all providers. */
export interface BarRow {
  date: string;      // "YYYY-MM-DD" Eastern Time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticker: string;    // Plain storage format (no prefix)
  time?: string;     // "HH:MM" ET — only for intraday
}

export type AssetClass = "stock" | "index" | "option";

export interface FetchBarsOptions {
  ticker: string;
  from: string;        // "YYYY-MM-DD"
  to: string;          // "YYYY-MM-DD"
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
  expiration: string;        // "YYYY-MM-DD"
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

/** The contract every market data provider must implement. */
export interface MarketDataProvider {
  readonly name: string;
  fetchBars(options: FetchBarsOptions): Promise<BarRow[]>;
  fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult>;
}
```

## Provider Factory

```typescript
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
  return _cached;
}

/** Reset cached provider — for test isolation only. */
export function _resetProvider(): void {
  _cached = null;
}
```

- `MARKET_DATA_PROVIDER` env var selects the active provider (default: `"massive"`)
- Each provider reads its own API key at call site: `MASSIVE_API_KEY`, `THETADATA_API_KEY`
- Lazy singleton — provider is cached after first `getProvider()` call since env var does not change mid-process
- `_resetProvider()` exposed for test teardown (`afterEach`)

## Adapter Files

Both adapters live under `packages/mcp-server/src/utils/providers/`.

### `providers/massive.ts`

Wraps existing `massive-client.ts` and `massive-snapshot.ts` logic into a class implementing `MarketDataProvider`. The HTTP helpers (`fetchWithRetry`, ticker normalization, Zod schemas, timestamp conversion) remain as private implementation details within this file or imported from shared utils.

Key mappings:
- `fetchBars()` delegates to existing Massive aggregates endpoint logic
- `fetchOptionSnapshot()` delegates to existing Massive v3/snapshot/options logic
- `greeks_source` = `"massive"` or `"computed"` (BS fallback via shared `computeLegGreeks`)

### `providers/thetadata.ts`

New adapter for the ThetaData REST API.

Key mappings:
- ThetaData historical bars → `BarRow` (date format conversion, field renaming)
- ThetaData option chain snapshot → `OptionContract` (greeks mapping, ticker normalization)
- Auth: `THETADATA_API_KEY` in request header
- `greeks_source` = `"thetadata"` or `"computed"` (BS fallback via shared `computeLegGreeks`)

ThetaData-specific concerns:
- Ticker format differs (plain root + separate strike/exp params vs OCC format)
- Timestamps may be ms_of_day format for intraday — adapter handles ET conversion
- Pagination model differs from Massive — adapter encapsulates this

### Shared utilities

`computeLegGreeks` from `black-scholes.ts` remains a shared utility imported by both provider adapters for the BS greeks fallback. It does not move into the providers directory.

## Callsite Migration

All callsites change from direct Massive imports to the provider factory:

| File | Change |
|------|--------|
| `bar-cache.ts` | Replace internal `fetchBars` import with `getProvider().fetchBars(...)`. The `fetchBarsWithCache` wrapper function and its DuckDB caching logic remain unchanged — only the API fetch path changes. |
| `market-importer.ts` | `fetchBars` import → `getProvider().fetchBars(...)` inside renamed `importFromApi()`. `ImportFromMassiveOptions` → `ImportFromApiOptions`. VIX/VIX9D/VIX3M context convenience import logic stays in the importer (calls `getProvider().fetchBars()` three times). |
| `exit-analysis.ts` | `fetchBars(...)` → `getProvider().fetchBars(...)` |
| `snapshot.ts` | `fetchOptionSnapshot(...)` → `getProvider().fetchOptionSnapshot(...)`. Remove `injectedFetcher` DI parameter — tests use `MARKET_DATA_PROVIDER` env var + mock `globalThis.fetch` instead. |
| `replay.ts` | No direct change — goes through `bar-cache.ts` |
| `trade-replay.ts` | Type-only change: `MassiveBarRow` import → `BarRow` from `market-provider.ts` |

### Tool rename

`import_from_massive` MCP tool → `import_from_api`. Tool description updates to say "Import from configured market data provider" instead of referencing Massive specifically. Update help text in `data-availability.ts` to reference the new tool name.

## Type Migration

`MassiveBarRow` is replaced by `BarRow` everywhere. No alias — clean break for beta 2. All downstream code (DuckDB inserts, enrichment, replay engine) already works with the same field shape.

`MassiveAssetClass` → `AssetClass`.

`OptionContract` moves from `massive-snapshot.ts` to `market-provider.ts`.

## Testing

### Unit tests per provider
- Mock `globalThis.fetch`, verify Zod validation, response mapping to `BarRow`
- Each provider tested in isolation

### Provider conformance test
- Shared test suite that any provider can be run against
- Validates contract: returns `BarRow[]`, handles empty results, throws on auth failure, throws on invalid response

### Factory test
- Verify env var routing returns correct provider
- Verify unknown provider throws descriptive error
- Use `_resetProvider()` in `afterEach` for test isolation

### Existing test migration

Tests that need **import path + structural changes** (code they test is moving):
- `tests/unit/massive-client-utils.test.ts` — tests for ticker normalization, timestamp conversion (stay as Massive-specific provider tests)
- `tests/unit/massive-client-fetch.test.ts` — tests for fetchBars (become `tests/unit/providers/massive.test.ts`)
- `tests/unit/massive-snapshot.test.ts` — tests for fetchOptionSnapshot (merge into Massive provider tests)
- `tests/integration/massive-import.test.ts` — tests for importFromMassive (update to importFromApi, set provider env var)

Tests that need **type rename only** (`MassiveBarRow` → `BarRow`):
- `tests/unit/trade-replay.test.ts`
- `tests/unit/trade-replay-greeks.test.ts`
- `tests/integration/trade-replay.test.ts`

### test-exports.ts migration

`src/test-exports.ts` currently re-exports `fetchBars`, `MassiveBarRow`, `MassiveAssetClass` from `massive-client.js` and types from `massive-snapshot.js`. After migration:
- Export `BarRow`, `AssetClass`, `OptionContract`, `getProvider`, `_resetProvider` from `market-provider.ts`
- Export `MassiveProvider` from `providers/massive.ts` for Massive-specific unit tests
- Remove old Massive type re-exports

## Files Changed (Summary)

**New files:**
- `src/utils/market-provider.ts` — interface, types, factory
- `src/utils/providers/massive.ts` — Massive adapter
- `src/utils/providers/thetadata.ts` — ThetaData adapter
- `tests/unit/market-provider.test.ts` — factory + conformance tests
- `tests/unit/providers/massive.test.ts`
- `tests/unit/providers/thetadata.test.ts`

**Modified files:**
- `src/utils/bar-cache.ts` — use `getProvider().fetchBars()` internally
- `src/utils/market-importer.ts` — use `getProvider().fetchBars()`, rename `importFromMassive` → `importFromApi`, rename `ImportFromMassiveOptions` → `ImportFromApiOptions`
- `src/utils/trade-replay.ts` — `MassiveBarRow` type → `BarRow`
- `src/utils/data-availability.ts` — update help text referencing tool name
- `src/tools/exit-analysis.ts` — use `getProvider().fetchBars()`
- `src/tools/snapshot.ts` — use `getProvider().fetchOptionSnapshot()`, remove `injectedFetcher` DI
- `src/tools/market-imports.ts` — rename tool, update descriptions
- `src/test-exports.ts` — replace Massive re-exports with provider interface exports
- `tests/unit/massive-client-utils.test.ts` — import path changes
- `tests/unit/massive-client-fetch.test.ts` — becomes provider-specific test
- `tests/unit/massive-snapshot.test.ts` — becomes provider-specific test
- `tests/unit/trade-replay.test.ts` — type rename
- `tests/unit/trade-replay-greeks.test.ts` — type rename
- `tests/integration/massive-import.test.ts` — function rename + provider env var
- `tests/integration/trade-replay.test.ts` — type rename

**Removed after migration:**
- `src/utils/massive-client.ts` — logic moves into `providers/massive.ts`
- `src/utils/massive-snapshot.ts` — logic moves into `providers/massive.ts`
