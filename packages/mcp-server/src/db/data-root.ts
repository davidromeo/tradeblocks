/**
 * Data Root Directory Override
 *
 * When --data-root is set, shared data (market/, market-meta/, strategies/, blocks/)
 * lives under this path instead of alongside DuckDB files.
 *
 * Set via --data-root CLI flag or TRADEBLOCKS_DATA_ROOT env var.
 * When not set, getDataRoot() falls back to its argument (backward compat).
 *
 * Stored on globalThis so all bundle instances in the same process share state.
 * tsup duplicates this module across separate bundles; a module-scoped variable
 * would give each bundle its own _dataRoot, leaving one path correct (set by
 * the CLI parser) and the other null (a consumer reads its own copy and falls
 * back to the default → wrong path).
 */
const KEY = "__tradeblocks_data_root__";
type GlobalSlot = { [KEY]?: string | null };

export function setDataRoot(dir: string): void {
  (globalThis as GlobalSlot)[KEY] = dir;
}

export function getDataRoot(fallback: string): string {
  return (globalThis as GlobalSlot)[KEY] ?? fallback;
}

/** Reset for testing. Not used in production. */
export function resetDataRoot(): void {
  (globalThis as GlobalSlot)[KEY] = null;
}
