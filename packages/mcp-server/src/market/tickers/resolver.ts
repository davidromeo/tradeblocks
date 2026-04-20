/**
 * Root-to-underlying resolver.
 *
 * extractRoot: pure string manipulation — no registry lookup.
 * rootToUnderlying: extractRoot + registry.resolve (identity fallback for unknowns).
 *
 * The root-extraction regex is intentionally duplicated from an optional
 * private extension's OCC ticker parser (private-only module; shared code
 * cannot import it). If the OCC-ticker regex is ever updated in one place,
 * update the other as well.
 */
import type { TickerRegistry } from "./registry.js"; // TYPE-ONLY — break runtime cycle (Pitfall 10)

// OCC option ticker shape: root + YYMMDD + C/P + 8-digit strike (15+ chars after root).
// When input matches OCC, extract just the leading letters as the root.
// Otherwise treat the whole input as a bare root (preserves "VIX9D", "VIX3M", etc.).
const OCC_RE = /^([A-Z]+)\d{6}[CP]\d{8}$/;
const LEADING_LETTERS_RE = /^([A-Z]+)/;

/**
 * Extract the root from an input symbol.
 *  - OCC ticker  ("SPXW251219C05000000")  → leading letters only ("SPXW")
 *  - Bare root   ("SPXW", "VIX9D", "VIX3M") → returned unchanged
 *
 * @throws when input has no leading alpha characters at all.
 */
export function extractRoot(input: string): string {
  const occMatch = input.match(OCC_RE);
  if (occMatch) return occMatch[1];
  // Bare root path — must start with at least one letter.
  if (!LEADING_LETTERS_RE.test(input)) {
    throw new Error(`Cannot extract root from "${input}"`);
  }
  return input;
}

/**
 * Resolve any OCC ticker or bare root to its underlying.
 * Unknown roots return themselves (identity fallback per CONTEXT.md D-05) —
 * this is how leveraged ETFs (SPXL/SPXS/SPXU/SPXC) and any new symbol stay
 * correct without explicit registry entries.
 */
export function rootToUnderlying(input: string, registry: TickerRegistry): string {
  const root = extractRoot(input);
  return registry.resolve(root);
}
