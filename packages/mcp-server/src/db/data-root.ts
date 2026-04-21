/**
 * Data Root Directory Override
 *
 * When --data-root is set, shared data (market/, market-meta/, strategies/, blocks/)
 * lives under this path instead of alongside DuckDB files.
 *
 * Set via --data-root CLI flag or TRADEBLOCKS_DATA_ROOT env var.
 * When not set, getDataRoot() falls back to its argument (backward compat).
 */
let _dataRoot: string | null = null;

export function setDataRoot(dir: string): void {
  _dataRoot = dir;
}

export function getDataRoot(fallback: string): string {
  return _dataRoot ?? fallback;
}

/** Reset for testing. Not used in production. */
export function resetDataRoot(): void {
  _dataRoot = null;
}
