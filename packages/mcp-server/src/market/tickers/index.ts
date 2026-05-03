/**
 * Ticker registry — shared module (no .ext.ts). Ships to both public and private repos.
 *
 * Flat re-exports of:
 *   - Pure resolver helpers (resolver.ts) — Task 1-02-01
 *   - TickerRegistry class + entry types (registry.ts) — Task 1-02-02
 *   - JSON loader for {dataRoot}/market/underlyings.json (loader.ts) — Task 1-02-03
 *   - Zod schemas for file + MCP-tool input validation (schemas.ts) — Task 1-02-02
 */
export { extractRoot, rootToUnderlying } from "./resolver.js";
export { TickerRegistry } from "./registry.js";
export type { TickerEntry, EntrySource } from "./registry.js";
export {
  UnderlyingsFileSchema,
  registerUnderlyingSchema,
  unregisterUnderlyingSchema,
  listUnderlyingsSchema,
  resolveRootSchema,
  TICKER_RE,
} from "./schemas.js";
export { loadRegistry, saveUserOverride } from "./loader.js";
