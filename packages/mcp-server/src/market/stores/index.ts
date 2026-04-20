/**
 * Market Data 3.0 — Store factory + barrel re-exports.
 *
 * Phase 1: createMarketStores returned typed null-cast placeholders per
 * CONTEXT.md D-04 so the compiler-typed bundle was available before concrete
 * backends shipped.
 *
 * Phase 2 (Plan 02-05): the body below replaces that placeholder with real
 * backend dispatch per D-03. The factory reads the backend flag ONCE and
 * returns monomorphic instances; concrete method bodies must NEVER re-inspect
 * it (D-02). EnrichedStore receives the SpotStore via constructor
 * injection (D-15) so the enricher's IO boundaries (minute-bar reads,
 * watermark get/upsert) are satisfied without re-plumbing.
 *
 * Downstream consumers (Phase 2 integration tests, Phase 4 tool migrations)
 * import from this barrel so only `./index.js` depends on the concrete file
 * layout.
 */
import { SpotStore } from "./spot-store.js";
import { EnrichedStore } from "./enriched-store.js";
import { ChainStore } from "./chain-store.js";
import { QuoteStore } from "./quote-store.js";

// Phase 2 concrete classes (shipped in Plans 02-03 + 02-04).
import { ParquetSpotStore } from "./parquet-spot-store.js";
import { DuckdbSpotStore } from "./duckdb-spot-store.js";
import { ParquetEnrichedStore } from "./parquet-enriched-store.js";
import { DuckdbEnrichedStore } from "./duckdb-enriched-store.js";
import { ParquetChainStore } from "./parquet-chain-store.js";
import { DuckdbChainStore } from "./duckdb-chain-store.js";
import { ParquetQuoteStore } from "./parquet-quote-store.js";
import { DuckdbQuoteStore } from "./duckdb-quote-store.js";

import type { StoreContext } from "./types.js";

export interface MarketStores {
  spot: SpotStore;
  enriched: EnrichedStore;
  chain: ChainStore;
  quote: QuoteStore;
}

/**
 * Construct a MarketStores bundle using backend-appropriate concrete classes.
 *
 * D-03: reads the backend flag once and returns monomorphic instances. The
 * concrete method bodies never re-inspect the flag (D-02).
 * D-15: EnrichedStore takes `SpotStore` via constructor injection so the
 * enricher's IO refactor (Plan 02-04) receives the right backend for minute-bar
 * reads without any separate lookup.
 */
export function createMarketStores(ctx: StoreContext): MarketStores {
  if (ctx.parquetMode) {
    const spot = new ParquetSpotStore(ctx);
    const enriched = new ParquetEnrichedStore(ctx, spot);
    const chain = new ParquetChainStore(ctx);
    const quote = new ParquetQuoteStore(ctx);
    return { spot, enriched, chain, quote };
  }
  const spot = new DuckdbSpotStore(ctx);
  const enriched = new DuckdbEnrichedStore(ctx, spot);
  const chain = new DuckdbChainStore(ctx);
  const quote = new DuckdbQuoteStore(ctx);
  return { spot, enriched, chain, quote };
}

export { SpotStore, EnrichedStore, ChainStore, QuoteStore };
export type { StoreContext };
export type { EnrichedReadOpts } from "./enriched-store.js";
export type { BarRow, ContractRow, QuoteRow, CoverageReport } from "./types.js";
