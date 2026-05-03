# Massive Developer-Tier Quote Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `fetch_quotes` work for Massive Developer-plan users by falling back to the `/v2/aggs/.../1/minute/...` endpoint (already in their plan) when `MASSIVE_DATA_TIER ≠ 'quotes'`, instead of returning `unsupported`.

**Architecture:** Two distinct signals at two distinct levels.

*Provider level:* `MassiveProvider.capabilities().quotes` stays semantically strict — `tier === 'quotes'` ("true NBBO available via /v3/quotes"). Honest, unchanged meaning, no surprises for consumers asking "does this provider give me real spreads?".

*Ingestor level:* The capability gate at `market-ingestor.ts:343` changes from `if (!caps.quotes)` (asks the wrong question) to `if (typeof provider.fetchQuotes !== 'function')` (asks the right question — "can I call fetchQuotes at all?"). The provider is then trusted to fulfill the call however it can.

*Provider implementation:* `MassiveProvider.fetchQuotes()` branches internally on tier — `/v3/quotes/{ticker}` for the Quotes tier (true NBBO, unchanged), `/v2/aggs/.../1/minute/...` for lower tiers (synthesized `bid=ask=close`).

*Row level:* Each persisted quote carries a `source` column tagging provenance (`'nbbo'` vs `'synth_close'`). Consumers that need to filter for true NBBO at query time use `WHERE source = 'nbbo'`; consumers that just want a usable mid don't care.

Greeks fitting in `enrichQuoteRows` already averages `(bid + ask) / 2`, so synthesized rows yield `close` as the mid — a reasonable proxy.

**Tech Stack:** TypeScript 5.8, Zod 4, Jest 30 + ts-jest (ESM preset), native `fetch` (Node 22), `jest.spyOn(globalThis, 'fetch')`.

---

## File Structure

| Path | Responsibility | Change |
|------|----------------|--------|
| `packages/mcp-server/src/utils/providers/massive.ts` | Massive provider — capabilities + fetch implementations | Modify: capability flag + new fallback method + source tagging |
| `packages/mcp-server/src/utils/provider-capabilities.ts` | Resolved capability surface (quoteHydration) | Modify: drop the `tier === 'quotes'` predicate for Massive |
| `packages/mcp-server/src/utils/market-provider.ts` | Provider interface + shared types | Modify: add `source` to `MinuteQuote`; update `quotes` capability JSDoc |
| `packages/mcp-server/src/market/stores/types.ts` | QuoteStore types (`QuoteRow`) | Modify: add `source` field |
| `packages/mcp-server/src/market/stores/parquet-quote-store.ts` | Parquet write/read for option_quote_minutes | Modify: write `q.source` (was NULL), read into `parseQuoteRow` |
| `packages/mcp-server/src/market/ingestor/market-ingestor.ts` | Ingestor — `writeQuotesForTicker` | Modify: pass `source` through to `QuoteRow` |
| `packages/mcp-server/src/tools/market-fetch.ts` | `fetch_quotes` MCP tool description | Modify: doc-string update reflecting tier behavior + source column |
| `packages/mcp-server/tests/unit/providers/massive.test.ts` | MassiveProvider unit tests | Modify: capability + tier-branching + source-tagging tests |
| `packages/mcp-server/tests/unit/provider-capabilities.test.ts` | ProviderCapabilities tests | Modify: capability flag tests |
| `packages/mcp-server/tests/unit/provider-capability-resolution.test.ts` | quoteHydration resolution tests | Modify: quoteHydration true regardless of tier for Massive |
| `packages/mcp-server/tests/...parquet-quote-store*.test.ts` | Quote store round-trip tests | Modify: source-column persistence test |
| `packages/mcp-server/tests/unit/market/ingestor/...` | Ingestor tests | Add: end-to-end Developer-tier fallback write-path test (asserts source persisted) |
| `releases/v3.0.md` | Release notes | Modify: document fallback + source-column population |

No new files (a new test file may be created in Task 8 if no existing ingest-quotes test fits — see that task). No new dependencies. No schema migrations (the `source` column already exists on `option_quote_minutes`; we're filling in a NULL).

## Decision Log (lock-in before tasks)

- **D1**: `capabilities().quotes` is **not** changed. It remains `tier === 'quotes'` for Massive — i.e., a strict "true NBBO via dedicated endpoint" signal. Honest semantics, no breaking change to consumers that ask "does this provider give me real spreads?".
- **D2**: The ingestor capability gate (`market-ingestor.ts:343`) changes from `if (!caps.quotes)` to `if (typeof provider.fetchQuotes !== 'function')`. This asks the right question for the gate's purpose ("can I dispatch the call?") rather than the wrong one ("is the data NBBO-grade?"). The provider then handles tier-specific dispatch internally.
- **D3**: Add `source: "nbbo" | "synth_close" | null` to `QuoteRow` + `MinuteQuote`. Codex flagged that `bid === ask` is not a reliable disambiguator (locked NBBO can have zero spread). The on-disk `option_quote_minutes.source` column already exists (currently NULL) — we populate it. Two distinct signals at two distinct levels: `caps.quotes` (provider-wide), `row.source` (per-row).
- **D4**: When `tier ≠ 'quotes'` AND `assetClass !== 'option'`, fallback still applies — but in practice `fetchQuotes` is only called for option tickers via the ingestor (`toMassiveTicker(ticker, "option")` at `massive.ts:617`). The new method also forces `assetClass: "option"`.
- **D5**: Tool description updates `fetch_quotes` to mention fallback + source column — the LLM relies on these descriptions to set expectations.
- **D6**: ThetaData provider's `fetchQuotes` body is untouched. Once `MinuteQuote.source` lands (Task 5), `MarketIngestor.writeQuotesForTicker` writes `quote.source ?? null` for every provider — so ThetaData rows persist `NULL` in the `source` column until the ThetaData provider is updated to tag its outputs `'nbbo'`. This is a follow-up, not blocking. Tool description (Task 9) and release notes (Task 10) reflect that source-tagging is currently Massive-only.

---

### Task 1: Pin existing capability semantics with explicit tests

**Goal:** `MassiveProvider.capabilities().quotes` stays `tier === 'quotes'` (unchanged). Add explicit tests so the contract is locked: `caps.quotes` means "true NBBO available", nothing more. The fallback is enabled at the **ingestor** level (Task 2), not the capability level.

**Files:**
- Test: `packages/mcp-server/tests/unit/providers/massive.test.ts`

- [ ] **Step 1: Add tests that pin the existing capability semantics**

Open `packages/mcp-server/tests/unit/providers/massive.test.ts`. Add a new describe block:

```typescript
describe("MassiveProvider.capabilities.quotes — strictly NBBO availability", () => {
  afterEach(() => {
    delete process.env.MASSIVE_DATA_TIER;
  });

  it("reports quotes=false when MASSIVE_DATA_TIER is unset (Developer/Starter plan, no /v3/quotes access)", () => {
    delete process.env.MASSIVE_DATA_TIER;
    expect(new MassiveProvider().capabilities().quotes).toBe(false);
  });

  it("reports quotes=false when MASSIVE_DATA_TIER=ohlc", () => {
    process.env.MASSIVE_DATA_TIER = "ohlc";
    expect(new MassiveProvider().capabilities().quotes).toBe(false);
  });

  it("reports quotes=false when MASSIVE_DATA_TIER=trades", () => {
    process.env.MASSIVE_DATA_TIER = "trades";
    expect(new MassiveProvider().capabilities().quotes).toBe(false);
  });

  it("reports quotes=true ONLY when MASSIVE_DATA_TIER=quotes (true NBBO via /v3/quotes)", () => {
    process.env.MASSIVE_DATA_TIER = "quotes";
    expect(new MassiveProvider().capabilities().quotes).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests, verify they pass**

```bash
cd packages/mcp-server && npx jest tests/unit/providers/massive.test.ts -t "strictly NBBO availability" --no-coverage
```

Expected: all 4 PASS — these pin existing behavior so the fallback work in subsequent tasks doesn't accidentally drift the semantics.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/tests/unit/providers/massive.test.ts
git commit -m "test(massive): pin capabilities.quotes as strict 'NBBO available' signal"
```

---

### Task 2: Remove the over-broad capability gate; rely on per-mode dispatch gates

**Goal:** `market-ingestor.ts:343` currently short-circuits when `!caps.quotes` — but this gate applies to BOTH the per-ticker and bulk-by-underlying paths. The per-ticker path already has its own correct gate at `:377` (`typeof provider.fetchQuotes !== "function"`); the bulk path has its own at `:429` (`!caps.bulkByRoot || !provider.fetchBulkQuotes`). The unified gate is redundant, asks the wrong question, and would also reject a hypothetical bulk-only provider that doesn't implement `fetchQuotes`. Delete it. Then simplify `quoteHydration` in `provider-capabilities.ts` to match the per-ticker gate's predicate (a separate concern — `quoteHydration` is read for resolution, not dispatch).

**Files:**
- Modify: `packages/mcp-server/src/market/ingestor/market-ingestor.ts:340-349` (delete the over-broad gate in `ingestQuotes`)
- Modify: `packages/mcp-server/src/utils/provider-capabilities.ts:25` (`quoteHydration` resolution)
- Test: `packages/mcp-server/tests/unit/provider-capability-resolution.test.ts`
- Test: `packages/mcp-server/tests/unit/market/ingestor/ingest-quotes.test.ts`

- [ ] **Step 1: Failing test for `quoteHydration` resolution**

Open `packages/mcp-server/tests/unit/provider-capability-resolution.test.ts`. If there's an existing test asserting `quoteHydration === false` for `MASSIVE_DATA_TIER='ohlc'` (or similar), DELETE it. Add:

```typescript
  test('quoteHydration is true for Massive whenever fetchQuotes exists, regardless of tier', () => {
    const provider = new MassiveProvider();
    expect(resolveProviderCapabilities(provider, { MASSIVE_DATA_TIER: 'ohlc' }).quoteHydration).toBe(true);
    expect(resolveProviderCapabilities(provider, { MASSIVE_DATA_TIER: 'trades' }).quoteHydration).toBe(true);
    expect(resolveProviderCapabilities(provider, { MASSIVE_DATA_TIER: 'quotes' }).quoteHydration).toBe(true);
    expect(resolveProviderCapabilities(provider, {}).quoteHydration).toBe(true);
  });
```

If the file doesn't already import them, add at the top:

```typescript
import { MassiveProvider } from '../../src/utils/providers/massive.js';
import { resolveProviderCapabilities } from '../../src/utils/provider-capabilities.js';
```

(Match the file's existing import style.)

- [ ] **Step 2: Run, verify failure**

```bash
cd packages/mcp-server && npx jest tests/unit/provider-capability-resolution.test.ts -t "quoteHydration is true for Massive" --no-coverage
```

Expected: FAIL — `quoteHydration` is currently gated by `massiveDataTier === 'quotes'` at `provider-capabilities.ts:27`.

- [ ] **Step 3: Simplify `quoteHydration`**

Edit `packages/mcp-server/src/utils/provider-capabilities.ts`. Find the existing block:

```typescript
  const quoteHydration =
    provider.name === "massive"
      ? massiveDataTier === "quotes" && typeof provider.fetchQuotes === "function"
      : base.quotes && typeof provider.fetchQuotes === "function";
```

Replace with:

```typescript
  // The right question for hydration dispatch is "can I call fetchQuotes?",
  // not "is the data NBBO-grade?" — provenance is captured per-row via
  // QuoteRow.source. Massive's fetchQuotes branches internally on
  // MASSIVE_DATA_TIER (true NBBO via /v3/quotes vs synthesized from /v2/aggs);
  // either path returns useful per-minute data.
  const quoteHydration = typeof provider.fetchQuotes === "function";
```

The `massiveDataTier` local on line 24 is now unused if no other code in the file references it — leave it if other resolved fields use it (they do — it's still returned in the result object).

- [ ] **Step 4: Re-run resolution tests, verify pass**

```bash
cd packages/mcp-server && npx jest tests/unit/provider-capability-resolution.test.ts --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Failing test for ingestor dispatch**

Open `packages/mcp-server/tests/unit/market/ingestor/ingest-quotes.test.ts`. The file already constructs ingestors inline — follow the existing pattern (see lines ~85–110 for the canonical setup).

Add two tests inside the existing top-level describe block:

```typescript
it("ingestQuotes per-ticker mode dispatches to provider.fetchQuotes even when caps.quotes=false", async () => {
  // Massive's Developer-tier shape: capability strict-NBBO=false, but the
  // provider has its own internal tier-aware fallback in fetchQuotes.
  const provider: MarketDataProvider = {
    name: "test-provider",
    capabilities: () => ({
      tradeBars: true, quotes: false, greeks: false, flatFiles: false,
      bulkByRoot: false, perTicker: true, minuteBars: true, dailyBars: true,
    }),
    fetchBars: async () => [],
    fetchOptionSnapshot: async () => ({ contracts: [] }),
    fetchQuotes: async () => {
      const m = new Map<string, { bid: number; ask: number }>();
      m.set("2026-01-05 09:30", { bid: 10.0, ask: 10.5 });
      return m;
    },
  };
  const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
  const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

  const result = await ingestor.ingestQuotes({
    tickers: ["SPXW260319C04800000"],
    from: "2026-01-05",
    to: "2026-01-05",
  });

  expect(result.status).toBe("ok");          // not "unsupported"
  expect(result.rowsWritten).toBe(1);
});

it("ingestQuotes per-ticker mode returns unsupported when provider has no fetchQuotes method", async () => {
  const provider: MarketDataProvider = {
    name: "no-quotes-provider",
    capabilities: () => ({
      tradeBars: true, quotes: false, greeks: false, flatFiles: false,
      bulkByRoot: false, perTicker: true, minuteBars: true, dailyBars: true,
    }),
    fetchBars: async () => [],
    fetchOptionSnapshot: async () => ({ contracts: [] }),
    // fetchQuotes intentionally omitted
  };
  const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
  const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

  const result = await ingestor.ingestQuotes({
    tickers: ["SPXW260319C04800000"],
    from: "2026-01-05",
    to: "2026-01-05",
  });

  expect(result.status).toBe("unsupported");
  expect(result.error).toMatch(/fetchQuotes|per-ticker/i);
});
```

- [ ] **Step 6: Run, verify failure**

```bash
cd packages/mcp-server && npx jest tests/unit/market/ingestor/ -t "dispatches to provider.fetchQuotes when the method exists" --no-coverage
```

Expected: FAIL — first test returns `status: "unsupported"` because of `caps.quotes === false`.

- [ ] **Step 7: Delete the over-broad capability gate**

Edit `packages/mcp-server/src/market/ingestor/market-ingestor.ts`. Find lines 340–349 in `ingestQuotes`:

```typescript
    const provider = this.resolveProvider(opts.provider);
    const caps = provider.capabilities();

    if (!caps.quotes) {
      return {
        status: "unsupported",
        rowsWritten: 0,
        error: `Provider ${provider.name} does not support quote fetch (capability.quotes=${caps.quotes})`,
      };
    }
```

Replace with:

```typescript
    const provider = this.resolveProvider(opts.provider);

    // Dispatch decisions live on the per-mode paths below — the per-ticker
    // path gates on `typeof provider.fetchQuotes === "function"` (line ~377);
    // the bulk-by-underlying path gates on `caps.bulkByRoot` + `fetchBulkQuotes`
    // (line ~429). A unified `caps.quotes` gate would (a) reject Massive on
    // Developer plan even though its fetchQuotes has tier-aware fallback, and
    // (b) reject any future bulk-only provider that doesn't implement the
    // per-ticker fetchQuotes method. Provenance — "is this NBBO-grade?" — is
    // captured per-row via the QuoteRow.source column.
```

(After the edit, `caps` is no longer referenced in this method. Verify by reading the function body — if no other line uses `caps`, the existing `const caps = provider.capabilities();` should also be deleted, but leave the per-mode helper methods untouched since they call `provider.capabilities()` themselves.)

- [ ] **Step 8: Re-run ingestor tests, verify pass**

```bash
cd packages/mcp-server && npx jest tests/unit/market/ingestor/ -t "dispatches to provider.fetchQuotes" --no-coverage
```

Expected: both new tests PASS.

- [ ] **Step 9: Run full ingestor + capability test suites for regressions**

```bash
cd packages/mcp-server && npx jest tests/unit/market/ingestor/ tests/unit/provider-capabilities.test.ts tests/unit/provider-capability-resolution.test.ts --no-coverage
```

Expected: all PASS. If any test asserted `unsupported` for a Massive non-quotes-tier scenario, update it to assert the new dispatch behavior.

- [ ] **Step 10: Commit**

```bash
git add packages/mcp-server/src/market/ingestor/market-ingestor.ts \
        packages/mcp-server/src/utils/provider-capabilities.ts \
        packages/mcp-server/tests/unit/market/ingestor/ \
        packages/mcp-server/tests/unit/provider-capability-resolution.test.ts
git commit -m "refactor(ingestor): gate ingestQuotes on provider.fetchQuotes existence

Previously gated on caps.quotes — the wrong question. caps.quotes asks
'is the data NBBO-grade?'; the dispatch gate should ask 'can I call
fetchQuotes?'. Massive returns useful data on lower tiers via /v2/aggs
fallback (Task 4); the per-row source column captures provenance.
caps.quotes semantics unchanged — still strictly true NBBO availability."
```

---

### Task 3: Tier-branching `fetchQuotes` — failing test for /v3 path preservation

**Files:**
- Test: `packages/mcp-server/tests/unit/providers/massive.test.ts`

- [ ] **Step 1: Add a focused test that verifies `/v3/quotes` is used when tier='quotes'**

Open `packages/mcp-server/tests/unit/providers/massive.test.ts`. Find the existing `Quotes enrichment` describe block and the `fetchSpy` setup pattern used elsewhere in the file. Below the existing tests, add a new describe block:

```typescript
describe("MassiveProvider.fetchQuotes — tier-aware endpoint selection", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.MASSIVE_API_KEY = "test-key";
    fetchSpy = jest.spyOn(globalThis, "fetch") as unknown as jest.SpiedFunction<typeof fetch>;
  });

  afterEach(() => {
    delete process.env.MASSIVE_API_KEY;
    delete process.env.MASSIVE_DATA_TIER;
    jest.restoreAllMocks();
  });

  it("uses /v3/quotes endpoint when MASSIVE_DATA_TIER=quotes", async () => {
    process.env.MASSIVE_DATA_TIER = "quotes";
    fetchSpy.mockResolvedValue(mockResponse({ status: "OK", request_id: "r1", results: [] }));

    const provider = new MassiveProvider();
    await provider.fetchQuotes("SPX250107C05000000", "2025-01-07", "2025-01-07");

    expect(fetchSpy).toHaveBeenCalled();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/v3/quotes/");
    expect(url).toContain("O%3ASPX250107C05000000");
  });
});
```

(Reuse the file's existing `mockResponse` helper.)

- [ ] **Step 2: Run, verify pass (this is current behavior)**

```bash
cd packages/mcp-server && npx jest tests/unit/providers/massive.test.ts -t "uses /v3/quotes endpoint" --no-coverage
```

Expected: PASS — test pins the existing behavior so the next task's refactor doesn't regress it.

- [ ] **Step 3: Add a failing test for the fallback endpoint**

In the same `describe("MassiveProvider.fetchQuotes — tier-aware endpoint selection")` block, append:

```typescript
  it("uses /v2/aggs minute-bars endpoint when MASSIVE_DATA_TIER is unset (Developer plan fallback)", async () => {
    delete process.env.MASSIVE_DATA_TIER;
    // 2025-01-07 09:30 ET = UTC 14:30 = 1736260200000 ms (EST/UTC-5).
    // See massive.test.ts:618 for the canonical timestamp reference.
    const barResponse = {
      ticker: "O:SPX250107C05000000",
      queryCount: 1,
      resultsCount: 1,
      adjusted: false,
      results: [{ v: 50, vw: 13.0, o: 12.8, c: 13.2, h: 13.5, l: 12.5, t: 1736260200000, n: 10 }],
      status: "OK",
      request_id: "req-aggs-001",
    };
    fetchSpy.mockResolvedValueOnce(mockResponse(barResponse));

    const provider = new MassiveProvider();
    const quotes = await provider.fetchQuotes("SPX250107C05000000", "2025-01-07", "2025-01-07");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/v2/aggs/ticker/");
    expect(url).toContain("O%3ASPX250107C05000000");
    expect(url).toContain("/range/1/minute/2025-01-07/2025-01-07");

    // bid === ask === close, keyed by ET minute
    expect(quotes.size).toBe(1);
    const entry = quotes.get("2025-01-07 09:30");
    expect(entry).toBeDefined();
    expect(entry!.bid).toBe(13.2);
    expect(entry!.ask).toBe(13.2);
  });

  it("uses /v2/aggs minute-bars endpoint when MASSIVE_DATA_TIER=ohlc", async () => {
    process.env.MASSIVE_DATA_TIER = "ohlc";
    fetchSpy.mockResolvedValueOnce(mockResponse({
      ticker: "O:SPX250107C05000000",
      queryCount: 0,
      resultsCount: 0,
      adjusted: false,
      results: [],
      status: "OK",
      request_id: "req-aggs-002",
    }));

    const provider = new MassiveProvider();
    await provider.fetchQuotes("SPX250107C05000000", "2025-01-07", "2025-01-07");

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/v2/aggs/ticker/");
    expect(url).not.toContain("/v3/quotes/");
  });

  it("synthesizes bid=ask=close for every minute returned by /v2/aggs", async () => {
    delete process.env.MASSIVE_DATA_TIER;
    // 09:30 ET = 1736260200000, 09:31 ET = +60_000 ms.
    fetchSpy.mockResolvedValueOnce(mockResponse({
      ticker: "O:SPX250107C05000000",
      queryCount: 1,
      resultsCount: 2,
      adjusted: false,
      results: [
        { v: 50, vw: 13.0, o: 12.8, c: 13.20, h: 13.5, l: 12.5, t: 1736260200000, n: 10 },
        { v: 60, vw: 13.4, o: 13.20, c: 13.50, h: 13.6, l: 13.1, t: 1736260260000, n: 12 },
      ],
      status: "OK",
      request_id: "req-aggs-003",
    }));

    const provider = new MassiveProvider();
    const quotes = await provider.fetchQuotes("SPX250107C05000000", "2025-01-07", "2025-01-07");

    expect(quotes.size).toBe(2);
    for (const [, q] of quotes) {
      expect(q.bid).toBe(q.ask);
    }
    expect(quotes.get("2025-01-07 09:30")!.bid).toBe(13.20);
    expect(quotes.get("2025-01-07 09:31")!.bid).toBe(13.50);
  });

  it("filters out bars outside RTH (09:30–16:00 ET)", async () => {
    delete process.env.MASSIVE_DATA_TIER;
    // 09:29 ET = 1736260140000 (in pre-market), 09:30 ET = 1736260200000 (in RTH),
    // 16:01 ET = 1736283660000 (after close).
    fetchSpy.mockResolvedValueOnce(mockResponse({
      ticker: "O:SPX250107C05000000",
      queryCount: 1,
      resultsCount: 3,
      adjusted: false,
      results: [
        { v: 10, vw: 13.0, o: 12.8, c: 13.10, h: 13.2, l: 12.7, t: 1736260140000, n: 5 },
        { v: 50, vw: 13.0, o: 12.8, c: 13.20, h: 13.5, l: 12.5, t: 1736260200000, n: 10 },
        { v: 5,  vw: 13.0, o: 12.8, c: 13.30, h: 13.4, l: 12.9, t: 1736283660000, n: 3 },
      ],
      status: "OK",
      request_id: "req-aggs-004",
    }));

    const provider = new MassiveProvider();
    const quotes = await provider.fetchQuotes("SPX250107C05000000", "2025-01-07", "2025-01-07");

    expect(quotes.size).toBe(1);
    expect(quotes.has("2025-01-07 09:30")).toBe(true);
    expect(quotes.has("2025-01-07 09:29")).toBe(false);
    expect(quotes.has("2025-01-07 16:01")).toBe(false);
  });
});
```

- [ ] **Step 4: Run, verify failure**

```bash
cd packages/mcp-server && npx jest tests/unit/providers/massive.test.ts -t "tier-aware endpoint selection" --no-coverage
```

Expected: the three new tests FAIL with the URL assertion ("expected `/v2/aggs/ticker/` to be in `/v3/quotes/...`"). The first ("/v3/quotes when tier=quotes") still PASSES.

---

### Task 4: Implement the fallback in `MassiveProvider.fetchQuotes`

**Files:**
- Modify: `packages/mcp-server/src/utils/providers/massive.ts:615` (`fetchQuotes`)

- [ ] **Step 1: Add the fallback method**

Open `packages/mcp-server/src/utils/providers/massive.ts`. Just above the existing `async fetchQuotes(ticker, from, to)` method (currently at line 615), add a new private method:

```typescript
  /**
   * Developer-tier fallback. When MASSIVE_DATA_TIER ≠ 'quotes' the user
   * doesn't have access to /v3/quotes, but /v2/aggs minute bars are included
   * in lower tiers (Developer plan). We fetch option minute OHLCV via the
   * shared bar-aggregates path and synthesize {bid: close, ask: close} per
   * minute. Downstream `enrichQuoteRows` averages bid+ask, so this surfaces
   * `close` as the mid — a reasonable proxy when true NBBO is unavailable.
   * Tagged source='synth_close' in Task 6 so consumers can distinguish from
   * true NBBO (locked-spread NBBO can also have bid==ask, so the source
   * column is the authoritative signal — not the bid/ask equality).
   */
  private async fetchQuotesViaMinuteBars(
    ticker: string,
    from: string,
    to: string,
  ): Promise<Map<string, { bid: number; ask: number }>> {
    const bars = await this.fetchBars({
      ticker,
      from,
      to,
      timespan: "minute",
      multiplier: 1,
      assetClass: "option",
    });

    const out = new Map<string, { bid: number; ask: number }>();
    for (const bar of bars) {
      if (!bar.time) continue;
      const time = bar.time.slice(0, 5); // "HH:MM"
      // RTH window only — match the /v3/quotes path's behavior
      if (time < "09:30" || time > "16:00") continue;
      const key = `${bar.date} ${time}`;
      out.set(key, { bid: bar.close, ask: bar.close });
    }
    return out;
  }
```

- [ ] **Step 2: Branch `fetchQuotes` on tier**

In the same file, replace the existing `fetchQuotes` method body (currently at line 615):

```typescript
  async fetchQuotes(ticker: string, from: string, to: string): Promise<Map<string, { bid: number; ask: number }>> {
    const apiKey = getApiKey();
    const apiTicker = toMassiveTicker(ticker, "option");
    const headers = { Authorization: `Bearer ${apiKey}` };
    return this.fetchQuotesForBars(apiTicker, headers, from, to);
  }
```

with:

```typescript
  async fetchQuotes(ticker: string, from: string, to: string): Promise<Map<string, { bid: number; ask: number }>> {
    const tier = resolveMassiveDataTier();
    if (tier !== "quotes") {
      // Developer / OHLC / trades tiers: /v3/quotes is gated. Fall back to
      // /v2/aggs minute bars and synthesize bid=ask=close. See
      // fetchQuotesViaMinuteBars JSDoc for the trade-off.
      return this.fetchQuotesViaMinuteBars(ticker, from, to);
    }
    const apiKey = getApiKey();
    const apiTicker = toMassiveTicker(ticker, "option");
    const headers = { Authorization: `Bearer ${apiKey}` };
    return this.fetchQuotesForBars(apiTicker, headers, from, to);
  }
```

- [ ] **Step 3: Run the new tests, verify pass**

```bash
cd packages/mcp-server && npx jest tests/unit/providers/massive.test.ts -t "tier-aware endpoint selection" --no-coverage
```

Expected: all 4 PASS.

- [ ] **Step 4: Run the entire massive provider suite to catch regressions**

```bash
cd packages/mcp-server && npx jest tests/unit/providers/massive.test.ts --no-coverage
```

Expected: every test PASSES. Pay special attention to the existing `Quotes enrichment` block (line ~669) — those tests set `MASSIVE_DATA_TIER='quotes'` so they should still hit the original `/v3/quotes` path.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/utils/providers/massive.ts \
        packages/mcp-server/tests/unit/providers/massive.test.ts
git commit -m "feat(massive): fallback fetchQuotes via /v2/aggs minute bars when tier!=quotes

When MASSIVE_DATA_TIER is unset, ohlc, or trades (Developer plan), the
user does not have access to /v3/quotes. Instead of refusing the call,
fetchQuotes now fetches option minute OHLCV via /v2/aggs and synthesizes
bid=ask=close per minute. Downstream greeks fitting averages bid+ask, so
close becomes the mid proxy. Synthesized rows are detectable by bid==ask."
```

---

### Task 5: Add `source` column tagging — type plumbing

**Goal:** Add `source: "nbbo" | "synth_close" | null` to `QuoteRow` and `MinuteQuote` so synthesized rows are unambiguously distinguishable from true NBBO. The on-disk schema already has the column in BOTH backends — `parquet-quote-store.ts:80` and the physical DuckDB table — but writes currently store NULL (`parquet-quote-store.ts:102` and `duckdb-quote-store.ts:105-106`) and reads ignore it (`parquet-quote-store.ts:41` and `duckdb-quote-store.ts:31-47`). This task fills it in across both backends so the existing-test code path (which uses `parquetMode: false` → `DuckdbQuoteStore`) actually persists and reads `source`.

**Files:**
- Modify: `packages/mcp-server/src/utils/market-provider.ts:209` (`MinuteQuote`)
- Modify: `packages/mcp-server/src/market/stores/types.ts:38` (`QuoteRow`)
- Modify: `packages/mcp-server/src/market/stores/parquet-quote-store.ts:41` (`parseQuoteRow`) and `:88-118` (writeQuotes append loop)
- Modify: `packages/mcp-server/src/market/stores/duckdb-quote-store.ts:31` (`parseQuoteRow`) and `:94-115` (writeQuotes params + INSERT)
- Modify: `packages/mcp-server/src/market/ingestor/market-ingestor.ts:596` (`writeQuotesForTicker`)

- [ ] **Step 1: Add `source` to `MinuteQuote`**

Edit `packages/mcp-server/src/utils/market-provider.ts`. Find `MinuteQuote` (around line 209) and add the new optional field:

```typescript
export interface MinuteQuote {
  bid: number;
  ask: number;
  /**
   * Provenance tag for the quote.
   *  - "nbbo": true bid/ask from a quotes-tier endpoint (Massive /v3/quotes,
   *    ThetaData NBBO).
   *  - "synth_close": synthesized from option minute OHLCV when the provider's
   *    NBBO endpoint isn't available; bid === ask === close.
   *  - null/undefined: legacy / unknown provenance.
   */
  source?: "nbbo" | "synth_close" | null;
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  iv?: number | null;
  greeks_source?: "massive" | "thetadata" | "computed" | null;
}
```

- [ ] **Step 2: Add `source` to `QuoteRow`**

Edit `packages/mcp-server/src/market/stores/types.ts`. Find `QuoteRow` (line 38) and add `source` between `ask_size` and `delta`:

```typescript
export interface QuoteRow {
  occ_ticker: string;
  timestamp: string;
  bid: number;
  ask: number;
  bid_size?: number;
  ask_size?: number;
  /** See MinuteQuote.source for semantics. Persisted to option_quote_minutes.source. */
  source?: "nbbo" | "synth_close" | null;
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  iv?: number | null;
  greeks_source?: "massive" | "thetadata" | "computed" | null;
  greeks_revision?: number | null;
}
```

- [ ] **Step 3: Failing test for parquet write/read round-trip**

Find the existing parquet-quote-store test file:

```bash
find packages/mcp-server/tests -name "parquet-quote-store*" -o -name "*quote-store*"
```

Open the test file. Add a new test inside the existing describe block:

```typescript
it("persists and reads back QuoteRow.source verbatim", async () => {
  const store = makeParquetQuoteStore(/* test ctx */);
  const rows: QuoteRow[] = [
    { occ_ticker: "SPX250107C05000000", timestamp: "2025-01-07 09:30",
      bid: 13.20, ask: 13.20, source: "synth_close" },
    { occ_ticker: "SPX250107C05000000", timestamp: "2025-01-07 09:31",
      bid: 13.10, ask: 13.30, source: "nbbo" },
  ];
  await store.writeQuotes("SPX", "2025-01-07", rows);

  const readBack = await store.readQuotes(["SPX250107C05000000"], "2025-01-07", "2025-01-07");
  const persisted = readBack.get("SPX250107C05000000")!;
  expect(persisted).toHaveLength(2);
  expect(persisted[0].source).toBe("synth_close");
  expect(persisted[1].source).toBe("nbbo");
});
```

Run:

```bash
cd packages/mcp-server && npx jest tests -t "persists and reads back QuoteRow.source" --no-coverage
```

Expected: FAIL — the write path appends NULL at `parquet-quote-store.ts:102` and the read path doesn't extract `source` in `parseQuoteRow`.

- [ ] **Step 4: Update the write path**

Edit `packages/mcp-server/src/market/stores/parquet-quote-store.ts`. Find the appender loop (around line 102):

```typescript
          appender.appendNull(); // last_updated_ns — not tracked in QuoteRow
          appender.appendNull(); // source — not tracked
```

Change the second line to:

```typescript
          appender.appendNull(); // last_updated_ns — not tracked in QuoteRow
          if (q.source == null) appender.appendNull();
          else appender.appendVarchar(q.source);
```

- [ ] **Step 5: Update the read path**

In the same file, find `parseQuoteRow` (line 41). The canonical projection from `quote-parquet-projection.ts:125` projects columns in order: `underlying[0], date[1], ticker[2], time[3], bid[4], ask[5], mid[6], last_updated_ns[7], source[8], delta[9], gamma[10], theta[11], vega[12], iv[13], greeks_source[14], greeks_revision[15]`. Add the `source` extraction:

```typescript
function parseQuoteRow(row: unknown[]): QuoteRow {
  const occ = String(row[2]);
  const date = String(row[1]);
  const time = String(row[3]);
  return {
    occ_ticker: occ,
    timestamp: `${date} ${time}`,
    bid: Number(row[4]),
    ask: Number(row[5]),
    source: row[8] == null ? null : (String(row[8]) as QuoteRow["source"]),
    delta: row[9] == null ? null : Number(row[9]),
    gamma: row[10] == null ? null : Number(row[10]),
    theta: row[11] == null ? null : Number(row[11]),
    vega: row[12] == null ? null : Number(row[12]),
    iv: row[13] == null ? null : Number(row[13]),
    greeks_source: row[14] == null ? null : String(row[14]) as QuoteRow["greeks_source"],
    greeks_revision: row[15] == null ? null : Number(row[15]),
  };
}
```

- [ ] **Step 6: Run round-trip test, verify pass**

```bash
cd packages/mcp-server && npx jest tests -t "persists and reads back QuoteRow.source" --no-coverage
```

Expected: PASS. If FAIL with `source: null`, double-check the column-index ordering in `quote-parquet-projection.ts:125` matches what `parseQuoteRow` reads.

- [ ] **Step 7: Update DuckdbQuoteStore write path**

Open `packages/mcp-server/src/market/stores/duckdb-quote-store.ts`. Find `writeQuotes` (around line 81) — specifically the params construction inside `quotes.flatMap` (around line 94–115). The current code passes a literal `null` for the `source` column slot:

```typescript
        underlying,
        qdate ?? date,
        q.occ_ticker,
        qtime ?? "09:30",
        q.bid,
        q.ask,
        mid,
        null,    // last_updated_ns
        null,    // source — currently NULL
        q.delta ?? null,
        // ...
```

Change the `source` slot to:

```typescript
        null,                  // last_updated_ns — not tracked in QuoteRow
        q.source ?? null,      // source — populated when provider tags rows (Task 6)
        q.delta ?? null,
        // ...
```

- [ ] **Step 8: Update DuckdbQuoteStore read path**

In the same file, find `parseQuoteRow` (line 31). The DuckDB store's read uses the same canonical projection ordering (underlying[0], date[1], ticker[2], time[3], bid[4], ask[5], mid[6], last_updated_ns[7], source[8], delta[9], gamma[10], theta[11], vega[12], iv[13], greeks_source[14], greeks_revision[15]). Add the `source` extraction:

```typescript
function parseQuoteRow(row: unknown[]): QuoteRow {
  const occ = String(row[2]);
  const date = String(row[1]);
  const time = String(row[3]);
  return {
    occ_ticker: occ,
    timestamp: `${date} ${time}`,
    bid: Number(row[4]),
    ask: Number(row[5]),
    source: row[8] == null ? null : (String(row[8]) as QuoteRow["source"]),
    delta: row[9] == null ? null : Number(row[9]),
    gamma: row[10] == null ? null : Number(row[10]),
    theta: row[11] == null ? null : Number(row[11]),
    vega: row[12] == null ? null : Number(row[12]),
    iv: row[13] == null ? null : Number(row[13]),
    greeks_source: row[14] == null ? null : String(row[14]) as QuoteRow["greeks_source"],
    greeks_revision: row[15] == null ? null : Number(row[15]),
  };
}
```

- [ ] **Step 9: Mirror the round-trip test for the DuckDB backend**

The Step 3 test only exercises ParquetQuoteStore. Add a parallel test inside the existing DuckdbQuoteStore tests (find `tests/unit/market/stores/duckdb-quote-store*.test.ts` if separate, or it may share the parquet store's test file). Same shape:

```typescript
it("DuckdbQuoteStore: persists and reads back QuoteRow.source verbatim", async () => {
  const store = makeDuckdbQuoteStore(/* test ctx */);
  const rows: QuoteRow[] = [
    { occ_ticker: "SPX250107C05000000", timestamp: "2025-01-07 09:30",
      bid: 13.20, ask: 13.20, source: "synth_close" },
    { occ_ticker: "SPX250107C05000000", timestamp: "2025-01-07 09:31",
      bid: 13.10, ask: 13.30, source: "nbbo" },
  ];
  await store.writeQuotes("SPX", "2025-01-07", rows);

  const readBack = await store.readQuotes(["SPX250107C05000000"], "2025-01-07", "2025-01-07");
  const persisted = readBack.get("SPX250107C05000000")!;
  expect(persisted).toHaveLength(2);
  expect(persisted[0].source).toBe("synth_close");
  expect(persisted[1].source).toBe("nbbo");
});
```

(Match the file's existing store-construction pattern. If it's parametrized over both backends, add the assertion inside that loop.)

- [ ] **Step 10: Run the full quote store test suite for regressions**

```bash
cd packages/mcp-server && npx jest tests/unit/market/stores/ --no-coverage
```

Expected: all PASS, including both new round-trip tests. Existing tests still pass because `source` is optional everywhere.

- [ ] **Step 11: Commit**

```bash
git add packages/mcp-server/src/utils/market-provider.ts \
        packages/mcp-server/src/market/stores/types.ts \
        packages/mcp-server/src/market/stores/parquet-quote-store.ts \
        packages/mcp-server/src/market/stores/duckdb-quote-store.ts \
        packages/mcp-server/tests/
git commit -m "feat(quote-store): add 'source' provenance column to QuoteRow + MinuteQuote

Both Parquet and DuckDB backends already had the column in their on-disk
schema but writes stored NULL and reads ignored it. Now threaded
end-to-end so callers can distinguish 'nbbo' (true bid/ask) from
'synth_close' (synthesized from OHLCV close)."
```

---

### Task 6: Tag MassiveProvider.fetchQuotes outputs with source

**Files:**
- Modify: `packages/mcp-server/src/utils/providers/massive.ts:552` (`fetchQuotesForBars`) and `:fetchQuotesViaMinuteBars` (added in Task 4)
- Modify: `packages/mcp-server/src/market/ingestor/market-ingestor.ts:596` (`writeQuotesForTicker`)
- Modify: `packages/mcp-server/tests/unit/providers/massive.test.ts` — extend Task 3 tests

- [ ] **Step 1: Update return-type signatures**

The existing `fetchQuotes` and helper signatures use `Map<string, { bid: number; ask: number }>`. To carry `source`, widen them to use `MinuteQuote`:

Edit `packages/mcp-server/src/utils/providers/massive.ts`. The provider-interface contract at `market-provider.ts:228` already declares `fetchQuotes?(...): Promise<Map<string, MinuteQuote>>`, so the implementation just needs to match. Add the import at the top of `massive.ts` if it's not already there:

```typescript
import type {
  MarketDataProvider,
  ProviderCapabilities,
  BarRow,
  MinuteQuote,
  // ...existing imports
} from "../market-provider.js";
```

Then update three method signatures and bodies in `massive.ts`:

a) `fetchQuotes` (line 615):

```typescript
  async fetchQuotes(ticker: string, from: string, to: string): Promise<Map<string, MinuteQuote>> {
    const tier = resolveMassiveDataTier();
    if (tier !== "quotes") {
      return this.fetchQuotesViaMinuteBars(ticker, from, to);
    }
    const apiKey = getApiKey();
    const apiTicker = toMassiveTicker(ticker, "option");
    const headers = { Authorization: `Bearer ${apiKey}` };
    return this.fetchQuotesForBars(apiTicker, headers, from, to);
  }
```

b) `fetchQuotesForBars` (line 552) — change return type and tag every entry as `"nbbo"`:

```typescript
  private async fetchQuotesForBars(
    apiTicker: string,
    headers: Record<string, string>,
    from: string,
    to: string,
  ): Promise<Map<string, MinuteQuote>> {
    const result = new Map<string, MinuteQuote>();
    // ... existing body unchanged until the byMinute loop ...
    // Inside the existing per-quote loop:
    //   byMinute.set(key, { bid: q.bid_price, ask: q.ask_price });
    // Change to:
    //   byMinute.set(key, { bid: q.bid_price, ask: q.ask_price, source: "nbbo" });
    // ... and the final aggregation loop already does result.set(key, val) — that's fine since
    // val now carries source.
```

(In the actual edit you'll need to find both lines: the `byMinute.set` and the `Map<string, { bid, ask }>` declaration — change the inner Map's value-type to `MinuteQuote` and add `source: "nbbo"` when constructing the value.)

c) `fetchQuotesViaMinuteBars` (added in Task 4) — change return type and tag entries `"synth_close"`:

```typescript
  private async fetchQuotesViaMinuteBars(
    ticker: string,
    from: string,
    to: string,
  ): Promise<Map<string, MinuteQuote>> {
    const bars = await this.fetchBars({
      ticker, from, to,
      timespan: "minute", multiplier: 1, assetClass: "option",
    });

    const out = new Map<string, MinuteQuote>();
    for (const bar of bars) {
      if (!bar.time) continue;
      const time = bar.time.slice(0, 5);
      if (time < "09:30" || time > "16:00") continue;
      const key = `${bar.date} ${time}`;
      out.set(key, { bid: bar.close, ask: bar.close, source: "synth_close" });
    }
    return out;
  }
```

- [ ] **Step 2: Thread source through `writeQuotesForTicker`**

Edit `packages/mcp-server/src/market/ingestor/market-ingestor.ts`. Find `writeQuotesForTicker` (line 596). The function already accepts a wide quote-value type. Update the inline type and the row-construction block:

```typescript
  private async writeQuotesForTicker(
    provider: MarketDataProvider,
    ticker: string,
    quotes: Map<string, MinuteQuote>,
  ): Promise<{ rowsWritten: number; minDate?: string; maxDate?: string }> {
    // ... existing setup ...
    for (const [key, quote] of quotes) {
      // ... existing date split ...
      list.push({
        occ_ticker: ticker,
        timestamp: key,
        bid: quote.bid,
        ask: quote.ask,
        source: quote.source ?? null,    // ← NEW LINE
        delta: quote.delta ?? null,
        gamma: quote.gamma ?? null,
        theta: quote.theta ?? null,
        vega: quote.vega ?? null,
        iv: quote.iv ?? null,
        greeks_source: quote.greeks_source ?? null,
      });
      byDate.set(date, list);
    }
    // ... rest unchanged ...
  }
```

If the existing inline parameter type was a structural literal `Map<string, { bid: number; ask: number; delta?: ...; ... }>`, replace it with `Map<string, MinuteQuote>` and add `import type { MinuteQuote } from "../../utils/market-provider.js"` at the top of the file if not already imported.

- [ ] **Step 3: Extend Task 3 fetchQuotes tests with source assertions**

In `packages/mcp-server/tests/unit/providers/massive.test.ts`, find the three new tests added in Task 3 (`uses /v2/aggs minute-bars endpoint when MASSIVE_DATA_TIER is unset`, `... =ohlc`, `synthesizes bid=ask=close`). Add a `source` assertion to each that returns rows:

For the "Developer plan fallback" test (after the existing `expect(entry!.ask).toBe(13.2);`):

```typescript
    expect(entry!.source).toBe("synth_close");
```

For the "synthesizes bid=ask=close for every minute" test, inside the existing `for (const [, q] of quotes)` loop:

```typescript
    for (const [, q] of quotes) {
      expect(q.bid).toBe(q.ask);
      expect(q.source).toBe("synth_close");
    }
```

For the existing `/v3/quotes` test (`uses /v3/quotes endpoint when MASSIVE_DATA_TIER=quotes`), modify the mock to return at least one valid quote and assert `source === "nbbo"`:

```typescript
  it("uses /v3/quotes endpoint when MASSIVE_DATA_TIER=quotes and tags rows as nbbo", async () => {
    process.env.MASSIVE_DATA_TIER = "quotes";
    // 09:30 ET = 14:30 UTC = 1736260200000 ms; nanos = ms * 1_000_000
    const nanos = 1736260200000 * 1_000_000;
    fetchSpy.mockResolvedValue(mockResponse({
      status: "OK",
      request_id: "r1",
      results: [{ bid_price: 12.5, ask_price: 13.5, sip_timestamp: nanos, bid_size: 10, ask_size: 15, sequence_number: 1 }],
    }));

    const provider = new MassiveProvider();
    const quotes = await provider.fetchQuotes("SPX250107C05000000", "2025-01-07", "2025-01-07");

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/v3/quotes/");
    expect(url).toContain("O%3ASPX250107C05000000");

    const entry = quotes.get("2025-01-07 09:30");
    expect(entry).toBeDefined();
    expect(entry!.bid).toBe(12.5);
    expect(entry!.ask).toBe(13.5);
    expect(entry!.source).toBe("nbbo");
  });
```

- [ ] **Step 4: Run massive tests, verify all pass**

```bash
cd packages/mcp-server && npx jest tests/unit/providers/massive.test.ts --no-coverage
```

Expected: all PASS. If any of the existing pre-Task-3 quote-related tests break because they expected `Map<string, { bid, ask }>` with no `source`, they pass anyway since `source` is optional and the structural type widens.

- [ ] **Step 5: Add a note for Task 8 — assert source on the ingestor write-path test**

Task 8 (next, after Task 7) builds the end-to-end ingestor write-path test. When you reach it, that test must additionally assert `expect(persisted[0].source).toBe("synth_close")` after its bid/ask assertions. The Task 8 spec already includes this assertion — no edit needed here, just a forward note. (This step exists only to flag the dependency — no code change in Task 6 itself.)

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-server/src/utils/providers/massive.ts \
        packages/mcp-server/src/market/ingestor/market-ingestor.ts \
        packages/mcp-server/tests/
git commit -m "feat(massive): tag fetchQuotes outputs with source provenance

NBBO path (/v3/quotes) tags rows as 'nbbo'; fallback minute-bar synthesis
tags as 'synth_close'. Threaded through writeQuotesForTicker so the
'source' column on option_quote_minutes is now populated for Massive."
```

---

### Task 7: Tighten `ProviderCapabilities.quotes` interface comment

**Goal:** The existing JSDoc says "NBBO bid/ask (tick or minute level)" — close but ambiguous. Tighten the language so future contributors understand `caps.quotes` is strictly a "true NBBO available" signal — and that the `fetchQuotes` *method* may return useful data even when `caps.quotes === false` (via provider-internal fallback like Massive's). Per-row provenance is the `source` column.

**Files:**
- Modify: `packages/mcp-server/src/utils/market-provider.ts:151`

- [ ] **Step 1: Tighten the JSDoc on `ProviderCapabilities.quotes`**

Open `packages/mcp-server/src/utils/market-provider.ts`. Find the `ProviderCapabilities` interface (around line 149) and the `quotes` field comment. Change:

```typescript
  tradeBars: boolean;       // minute OHLC from trade aggregates
  quotes: boolean;          // NBBO bid/ask (tick or minute level)
```

to:

```typescript
  tradeBars: boolean;       // minute OHLC from trade aggregates
  /**
   * Strictly: "true NBBO bid/ask is available via this provider's dedicated
   * quotes endpoint". Use this when you specifically need real bid/ask spreads.
   *
   * NOTE: this is NOT the right gate for "should I call fetchQuotes()". A
   * provider may implement `fetchQuotes` and return useful per-minute data
   * (e.g. synthesized from OHLCV) even when `quotes === false`. Dispatch on
   * `typeof provider.fetchQuotes === 'function'` instead, and use the
   * persisted `source` column on `option_quote_minutes` ('nbbo' vs
   * 'synth_close') for per-row provenance.
   */
  quotes: boolean;
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd packages/mcp-server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/utils/market-provider.ts
git commit -m "docs(provider): clarify quotes capability is strict NBBO signal, not dispatch gate"
```

---

### Task 8: Ingestor end-to-end write-path test

**Files:**
- Test: `packages/mcp-server/tests/unit/market/ingestor/ingest-quotes.test.ts` (or wherever the existing `ingestQuotes` tests live — confirm with `find`)

- [ ] **Step 1: Locate the ingestor test file**

```bash
find packages/mcp-server/tests -name "ingest-quotes*" -o -name "*market-ingestor*"
```

Expected: at least one file. Open the one that already exercises `ingestQuotes()`. If `ingest-quotes.test.ts` exists, use it; otherwise create `packages/mcp-server/tests/unit/market/ingestor/ingest-quotes-massive-fallback.test.ts`.

- [ ] **Step 2: Read the existing test file's setup pattern**

Look for how it constructs `MarketIngestor` (mock stores vs. real DuckDB). Confirm whether existing tests use a stub provider or a real `MassiveProvider` with mocked `fetch`. Match whatever pattern is already in use — it's higher-trust to follow the existing convention than to invent a parallel one.

- [ ] **Step 3: Add a failing integration-style test**

Append (or create the file with) a new test that:
1. Sets `delete process.env.MASSIVE_DATA_TIER` (Developer-tier behavior)
2. Mocks `globalThis.fetch` to return a valid `/v2/aggs` minute-bar response with a single bar at 09:30 ET (`t: 1736260200000`)
3. Constructs an ingestor with a real `MassiveProvider` and the existing test stores
4. Calls `ingestor.ingestQuotes({ tickers: ["SPX250107C05000000"], from: "2025-01-07", to: "2025-01-07" })`
5. Asserts `result.status === "ok"`, `result.rowsWritten === 1`
6. Reads back via `stores.quote.readQuotes("SPX", "2025-01-07")` (or the equivalent reader pattern in the file) and asserts the persisted row has `bid === ask === 13.20`

Concrete code template (adjust imports/store-construction to match the file's existing setup):

```typescript
it("ingestQuotes uses fetchBars fallback synthesis when MASSIVE_DATA_TIER is unset", async () => {
  delete process.env.MASSIVE_DATA_TIER;
  process.env.MASSIVE_API_KEY = "test-key";

  const fetchSpy = jest.spyOn(globalThis, "fetch") as unknown as jest.SpiedFunction<typeof fetch>;
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
    ticker: "O:SPX250107C05000000",
    queryCount: 1,
    resultsCount: 1,
    adjusted: false,
    results: [{ v: 50, vw: 13.0, o: 12.8, c: 13.20, h: 13.5, l: 12.5, t: 1736260200000, n: 10 }],
    status: "OK",
    request_id: "req-001",
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const provider = new MassiveProvider();
  // Use whatever ingestor + stores construction pattern the existing tests use
  const ingestor = makeTestIngestor({ provider });

  const result = await ingestor.ingestQuotes({
    tickers: ["SPX250107C05000000"],
    from: "2025-01-07",
    to: "2025-01-07",
  });

  expect(result.status).toBe("ok");
  expect(result.rowsWritten).toBe(1);

  // Read back via the store reader. The existing test pattern uses
  // createMarketStores({ ..., parquetMode: false }) → DuckdbQuoteStore;
  // both backends now persist `source` (Tasks 4a Steps 7–9).
  const persisted = await stores.quote.readQuotes(
    ["SPX250107C05000000"], "2025-01-07", "2025-01-07"
  );
  const rows = persisted.get("SPX250107C05000000")!;
  expect(rows).toHaveLength(1);
  expect(rows[0].bid).toBe(13.20);
  expect(rows[0].ask).toBe(13.20);
  expect(rows[0].source).toBe("synth_close");
  expect(rows[0].occ_ticker).toBe("SPX250107C05000000");

  fetchSpy.mockRestore();
  delete process.env.MASSIVE_API_KEY;
});
```

If the existing tests use a stub provider rather than the real `MassiveProvider`, then this test is the *first* one in the file to exercise the real provider end-to-end — that's intentional and important coverage.

- [ ] **Step 4: Run, verify pass**

```bash
cd packages/mcp-server && npx jest tests/unit/market/ingestor/ -t "MASSIVE_DATA_TIER is unset" --no-coverage
```

Expected: PASS. (If FAIL with `status: "unsupported"`, the dispatch-gate change from Task 2 didn't propagate — verify the over-broad `caps.quotes` gate at the top of `ingestQuotes` was actually deleted.)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/tests/unit/market/ingestor/
git commit -m "test(ingestor): cover Massive Developer-tier quote fallback end-to-end"
```

---

### Task 9: Update `fetch_quotes` MCP tool description

**Files:**
- Modify: `packages/mcp-server/src/tools/market-fetch.ts:88-107` (`fetch_quotes` registerTool block)

- [ ] **Step 1: Update the description**

Open `packages/mcp-server/src/tools/market-fetch.ts`. Find the `fetch_quotes` description block (around line 92). Replace:

```typescript
      description:
        "Fetch NBBO minute-level option quotes. Two modes — pass EITHER 'tickers' (specific OCC contracts, per-ticker provider calls) OR 'underlyings' (every contract under a symbol, one wildcard call per (root, right) per date — ThetaData only). " +
        "Bulk mode collapses thousands of per-contract fetches to ~4 wire requests per SPX day; use it whenever you want full-chain coverage. " +
        "Writes to market.option_quote_minutes. Capability-gated: ThetaData supports both modes; Massive requires MASSIVE_DATA_TIER=quotes for the per-ticker mode and does not support bulk mode. " +
        "Returns status='unsupported' with a clear error when the active provider lacks the requested mode.",
```

with:

```typescript
      description:
        "Fetch minute-level option quotes. Two modes — pass EITHER 'tickers' (specific OCC contracts, per-ticker provider calls) OR 'underlyings' (every contract under a symbol, one wildcard call per (root, right) per date — ThetaData only). " +
        "Bulk mode collapses thousands of per-contract fetches to ~4 wire requests per SPX day; use it whenever you want full-chain coverage. " +
        "Writes to market.option_quote_minutes. The 'source' column tags Massive provider rows: 'nbbo' (real bid/ask via /v3/quotes when MASSIVE_DATA_TIER=quotes) or 'synth_close' (synthesized from /v2/aggs OHLCV close when the user's plan lacks /v3/quotes; bid=ask=close). ThetaData rows currently leave 'source' as NULL pending a follow-up — its data is true NBBO regardless. " +
        "Massive falls back automatically on Developer/lower plans; ThetaData (both modes) returns true NBBO. " +
        "Returns status='unsupported' with a clear error only when the active provider lacks the requested mode (e.g., bulk-by-underlying on Massive).",
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/mcp-server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/tools/market-fetch.ts
git commit -m "docs(fetch_quotes): document tier-aware fallback in tool description"
```

---

### Task 10: Release notes update

**Files:**
- Modify: `releases/v3.0.md`

- [ ] **Step 1: Locate the right insertion point**

```bash
grep -n "MASSIVE_DATA_TIER\|fetch_quotes\|provider" releases/v3.0.md | head -20
```

Look for the existing MASSIVE_DATA_TIER mention (~line 237 per the earlier grep). Add a new bullet near it.

- [ ] **Step 2: Add a release-notes entry**

In `releases/v3.0.md`, near the existing `MASSIVE_DATA_TIER` discussion, add:

```markdown
- **Massive Developer-plan quote fallback** — `fetch_quotes` (per-ticker mode, the only mode Massive supports) used to return `unsupported` for users without `MASSIVE_DATA_TIER=quotes`. It now falls back to `/v2/aggs/ticker/{O:OCC}/range/1/minute/{from}/{to}` (included in the Developer plan) and synthesizes `bid=ask=close` per minute. Downstream greeks fitting averages bid+ask, so close serves as the mid proxy. Set `MASSIVE_DATA_TIER=quotes` to keep using true NBBO via `/v3/quotes`.
- **Quote provenance column** — `option_quote_minutes` now populates the existing `source` column (previously NULL) for Massive provider rows: `'nbbo'` for true bid/ask via /v3/quotes, `'synth_close'` for fallback-synthesized rows from /v2/aggs. ThetaData rows currently still write NULL pending a follow-up tagging update — its data is true NBBO regardless. Filter by `source = 'nbbo'` for analyses that require real spreads; the column carries through to `MinuteQuote.source` and `QuoteRow.source` in the API surface.
```

(Match the file's existing bullet style — check `head -50 releases/v3.0.md` for the format conventions.)

- [ ] **Step 3: Commit**

```bash
git add releases/v3.0.md
git commit -m "docs(release): note Massive Developer-tier quote fallback in v3.0 release notes"
```

---

### Task 11: Build + live MCP smoke test (mandatory per CLAUDE.md)

**Files:**
- None (verification only)

- [ ] **Step 1: Build the MCP server**

```bash
cd packages/mcp-server && npm run build
```

Expected: build succeeds with no TypeScript errors. If errors surface, fix in the relevant source file and re-run before continuing.

- [ ] **Step 2: Smoke — list tools (default tier, fallback path active)**

```bash
unset MASSIVE_DATA_TIER
MARKET_DATA_PROVIDER=massive npx --yes @modelcontextprotocol/inspector --cli \
  --config /home/romeo/code/tradeblocks/.mcp.json --server tradeblocks \
  --method tools/list 2>&1 | head -40
```

Expected: server starts cleanly, tool list includes `fetch_quotes` with the updated description text. No init errors.

- [ ] **Step 3: Smoke — real (non-dry-run) fetch exercises the fallback synthesis end-to-end**

`dry_run=true` short-circuits at `market-ingestor.ts:351` BEFORE `provider.fetchQuotes()` is called, so it would only verify the capability flip — not the synthesis. Use a real fetch against a known-good liquid contract on a recent trading day.

Pick a recent trading day (within the last week). Adjust the OCC ticker below to a contract that actually traded on that day (any liquid SPX/SPXW weekly works — strike near spot, expiration ≥ 2 weeks out). Example shape:

```bash
unset MASSIVE_DATA_TIER
MARKET_DATA_PROVIDER=massive npx --yes @modelcontextprotocol/inspector --cli \
  --config /home/romeo/code/tradeblocks/.mcp.json --server tradeblocks \
  --method tools/call --tool-name fetch_quotes \
  --tool-arg 'tickers=["SPXW260515C05000000"]' \
  --tool-arg 'from=2026-05-01' --tool-arg 'to=2026-05-01' 2>&1 | tail -40
```

Expected: `status: "ok"`, `rowsWritten` > 0 (a single RTH session is ~390 minutes, but a single OTM contract may have far fewer traded minutes). Critically — the call must NOT return `status: "unsupported"`.

- [ ] **Step 4: Verify synthesized rows are tagged with source='synth_close'**

```bash
unset MASSIVE_DATA_TIER
MARKET_DATA_PROVIDER=massive npx --yes @modelcontextprotocol/inspector --cli \
  --config /home/romeo/code/tradeblocks/.mcp.json --server tradeblocks \
  --method tools/call --tool-name run_sql \
  --tool-arg "query=SELECT COUNT(*) AS n, COUNT_IF(source = 'synth_close') AS synth_tagged, COUNT_IF(bid = ask) AS bid_eq_ask FROM market.option_quote_minutes WHERE ticker = 'SPXW260515C05000000' AND date = '2026-05-01'" 2>&1 | tail -20
```

Expected: `n > 0`, `synth_tagged == n` (every row tagged as synth — the unambiguous source-column proof), `bid_eq_ask == n` (sanity — synthesized rows always have bid == ask).

- [ ] **Step 5: Smoke — quotes tier still works (no regression)**

Re-run Step 3 with `MASSIVE_DATA_TIER=quotes` and a *different* ticker/date pair (or first DELETE the rows from Step 3 via run_sql so the second pass doesn't read cached output):

```bash
MARKET_DATA_PROVIDER=massive MASSIVE_DATA_TIER=quotes npx --yes @modelcontextprotocol/inspector --cli \
  --config /home/romeo/code/tradeblocks/.mcp.json --server tradeblocks \
  --method tools/call --tool-name fetch_quotes \
  --tool-arg 'tickers=["SPXW260515P04800000"]' \
  --tool-arg 'from=2026-05-01' --tool-arg 'to=2026-05-01' 2>&1 | tail -40
```

Expected: `status: "ok"`. Then verify with run_sql that the new rows are tagged source='nbbo' (and as a sanity check that most rows have `bid < ask`):

```bash
MARKET_DATA_PROVIDER=massive MASSIVE_DATA_TIER=quotes npx --yes @modelcontextprotocol/inspector --cli \
  --config /home/romeo/code/tradeblocks/.mcp.json --server tradeblocks \
  --method tools/call --tool-name run_sql \
  --tool-arg "query=SELECT COUNT(*) AS n, COUNT_IF(source = 'nbbo') AS nbbo_tagged, COUNT_IF(bid < ask) AS bid_lt_ask FROM market.option_quote_minutes WHERE ticker = 'SPXW260515P04800000' AND date = '2026-05-01'" 2>&1 | tail -20
```

Expected: `n > 0`, `nbbo_tagged == n` (the unambiguous proof — source column is correctly populated for the NBBO path), `bid_lt_ask` close to `n` (a few rows with locked spreads are normal).

- [ ] **Step 6: Smoke — ThetaData provider still works (multi-provider gate per CLAUDE.md)**

Skip this step if a ThetaData terminal isn't running locally. If it is:

```bash
MARKET_DATA_PROVIDER=thetadata npx --yes @modelcontextprotocol/inspector --cli \
  --config /home/romeo/code/tradeblocks/.mcp.json --server tradeblocks \
  --method tools/call --tool-name fetch_quotes \
  --tool-arg 'tickers=["SPXW260515C05050000"]' \
  --tool-arg 'from=2026-05-01' --tool-arg 'to=2026-05-01' \
  --tool-arg 'dry_run=true' 2>&1 | tail -30
```

Expected: `status: "skipped"` (dry-run is fine here — we only need to confirm ThetaData's capability resolution is unchanged).

- [ ] **Step 7: If any smoke step fails, do NOT mark this task done**

Triage:
- Server-init crashes → regression in capability resolution or import order
- `status: "unsupported"` in Step 3 → capability change didn't propagate (rebuild check first)
- Step 3 succeeds but Step 4 returns `synth_tagged == 0` → either the `source` column write isn't reaching parquet (check Task 5 Step 4) or the fallback path didn't tag rows (check Task 6 Step 1c)
- Step 5 returns `nbbo_tagged == 0` → the NBBO path's source tagging is broken (Task 6 Step 1b) — and this is the regression-canary: pre-Task-6, this column would be NULL across the board

---

### Task 12: Run full test suite + final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full test suite**

```bash
cd packages/mcp-server && npm test
```

Expected: all PASS. If a test elsewhere asserts that `fetch_quotes` returns `unsupported` for non-quotes Massive tier, it must be updated to assert the new fallback behavior — flag and fix.

- [ ] **Step 2: TypeScript check across the workspace**

```bash
cd /home/romeo/code/tradeblocks && npm run typecheck 2>&1 | tail -30
```

Expected: no errors. (If `typecheck` is not a workspace script, run `npx tsc --noEmit` in `packages/mcp-server` and again at the repo root if there's a root tsconfig.)

- [ ] **Step 3: Final commit if anything was missed**

If Steps 1 or 2 surfaced fixes, stage and commit:

```bash
git add -p
git commit -m "test: align with Massive fetchQuotes tier-aware fallback"
```

If nothing changed, skip.

- [ ] **Step 4: Confirm clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

---

## Codex Review Feedback Applied (2026-05-03)

External review (Codex via codex-rescue agent) surfaced four issues, all now resolved:

1. ✅ **Test timestamps** — Tasks 3 fallback tests originally used `1736253000000` (= 04:30 ET, would be filtered by RTH window). Fixed to `1736260200000` (= 09:30 ET) per the canonical reference at `massive.test.ts:618`.
2. ✅ **Smoke test exercises the fallback** — Task 11 Step 3 originally used `dry_run=true` which short-circuits at `market-ingestor.ts:351` before `fetchQuotes` runs. Replaced with a real fetch + `run_sql` verification of the `source` column.
3. ✅ **Interface JSDoc** — `ProviderCapabilities.quotes` JSDoc was vague ("NBBO bid/ask"). Task 7 tightens it to make explicit that it's a strict "true NBBO available" signal and explicitly directs callers to dispatch on `typeof provider.fetchQuotes === 'function'` instead.
4. ✅ **Ingestor write-path test** — added as Task 8, exercising `ingestQuotes` end-to-end with the real `MassiveProvider` and mocked `fetch`.
5. ✅ **Source-column tagging** — Codex noted `bid === ask` is not a fully reliable disambiguator (locked NBBO can have zero spread). Resolved via Tasks 5 + 6: added `source: "nbbo" | "synth_close" | null` to `MinuteQuote` and `QuoteRow`, populated the existing parquet AND DuckDB `source` columns (both were NULL), and tagged Massive provider outputs at the source. Task 11 smoke verification now queries the `source` column directly.

## User Review Feedback Applied (2026-05-03)

User flagged: flipping `capabilities().quotes` to always `true` lies about the capability for users without true NBBO access. Resolved by restructuring the design:

- ✅ `caps.quotes` semantics **unchanged** — still strictly "true NBBO via dedicated endpoint" (`tier === 'quotes'` for Massive).
- ✅ Task 1 now pins existing semantics with explicit assertions instead of flipping them.
- ✅ Task 2 moves the dispatch gate from `if (!caps.quotes)` (wrong question) to `if (typeof provider.fetchQuotes !== 'function')` (right question — "can I dispatch the call?"). The provider then handles tier-specific behavior internally.
- ✅ `quoteHydration` in `provider-capabilities.ts` simplifies to the same predicate.
- ✅ Task 7 JSDoc explicitly directs future callers to dispatch on the method's existence, not the capability flag.
- Net effect: two distinct signals at two distinct levels — `caps.quotes` (provider-wide, strict NBBO) + `row.source` (per-row provenance) — both honest. No semantic shift to existing consumers.

---

## Self-Review

**Spec coverage:**
- User pain ("`fetch_quotes` returns unsupported on Developer plan") → addressed by Tasks 1, 2, 4 (capability flip + fallback implementation).
- User's specific endpoint ask ("route through `/v2/aggs/.../1/minute/...`") → Task 4 implements exactly that path via `fetchBars({timespan:"minute", assetClass:"option"})`.
- Tool-description discoverability for the LLM/user → Task 9.
- Release notes for users tracking changes → Task 10.
- CLAUDE.md mandatory MCP smoke → Task 11.
- CLAUDE.md mandatory multi-provider testing → Task 11 Step 6 (ThetaData skipped only if terminal is unavailable, which is acceptable since this change is Massive-only).
- Test coverage gates from CLAUDE.md ("Every new utility module with pure logic MUST have unit tests") → No new utility module added; the fallback is a method on an existing class with full test coverage in Task 3.

**Placeholder scan:**
- No "TBD", "TODO", or "implement later" markers.
- Every code step shows the actual code.
- Every test step shows the assertion code.
- File paths and line numbers cited where the engineer needs to navigate.

**Type consistency:**
- `MarketDataProvider.fetchQuotes` declares `Promise<Map<string, MinuteQuote>>` (`market-provider.ts:228`). After Task 5 adds `source` to `MinuteQuote` and Task 6 widens MassiveProvider's internal helpers to use `MinuteQuote`, the implementation matches the interface. `writeQuotesForTicker` (Task 6 Step 2) accepts `Map<string, MinuteQuote>` and reads `quote.source ?? null` along with greeks — all fields optional, so older providers (untagged) still type-check.
- `BarRow.time` is typed `string | undefined` — fallback method guards with `if (!bar.time) continue` before slicing.
- `resolveMassiveDataTier` returns `'ohlc' | 'trades' | 'quotes'` — the `tier !== "quotes"` branch covers both `'ohlc'` and `'trades'`.
- `QuoteRow.source` and `MinuteQuote.source` use the same union `"nbbo" | "synth_close" | null` so the threading at `writeQuotesForTicker` is a straight assignment.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-03-massive-developer-tier-quote-fallback.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
