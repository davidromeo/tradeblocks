# TODOs

Tracked issues and improvements for future phases/milestones.

## MCP Server - Reporting Log Tools

Issues discovered during Phase 37 verification testing (2026-02-01).

### TODO-001: Remove Misleading Slippage Attribution Categories

**Priority**: High
**Context**: `analyze_discrepancies` tool

The entry/exit/size slippage attribution is fundamentally broken for options:
- `entryPriceSlippage` and `exitPriceSlippage` use SPX underlying prices, not option fill prices
- Option fills are embedded in "Legs" field as text (e.g., "2 Jan 22 6910 P BTO 11.15"), not parsed
- Results in huge misleading numbers when SPX moves 10+ points intraday
- `sizeSlippage` is always 0 (formula not triggering correctly)
- `entryPriceSlippage` is always 0 (backtest and actual have same SPX open time)

**Action**: Remove the `attribution.byCategory` breakdown entirely. Keep only:
- `totalSlippage` (actual P/L - backtest P/L) - this is accurate and useful
- `avgSlippagePerTrade`

The slippage decomposition requires leg-level fill data we don't have. Better to remove than mislead.

**Files**: `packages/mcp-server/src/tools/reports.ts`

---

### TODO-002: Simplify analyze_discrepancies Output

**Priority**: High
**Context**: `analyze_discrepancies` tool

Current output has too many sections that don't add value:
- Attribution categories (see TODO-001)
- Per-strategy breakdown with empty patterns (minSamples=10 means most strategies show nothing)
- Correlations for fields that rarely correlate (hourOfDay, contracts show "negligible")

**Action**: Streamline to:
```typescript
{
  summary: { matchedTrades, unmatchedBacktest, unmatchedActual, totalSlippage, avgSlippage, dateRange },
  patterns: PatternInsight[],  // Portfolio-level only
  correlations: { method, significantOnly: [...] },  // Only show |r| > 0.3
  perStrategy: [{ strategy, tradeCount, totalSlippage, avgSlippage }]  // Remove patterns from per-strategy
}
```

Remove the `includePerStrategy` parameter - always include it but simplified.

**Files**: `packages/mcp-server/src/tools/reports.ts`

---

### TODO-003: Document Matching Mode Difference

**Priority**: Medium
**Context**: `compare_backtest_to_actual` vs `analyze_discrepancies`

The two tools use different matching logic by default:
- `compare_backtest_to_actual` (summary mode): matches by `date|strategy` (44 matched)
- `compare_backtest_to_actual` (trades mode): matches by `date|strategy|time` (39 matched)
- `analyze_discrepancies`: always matches by `date|strategy|time` (39 matched)

This causes confusing count differences when users call both tools.

**Action**: Add `matchingMode` parameter to `compare_backtest_to_actual`:
- `"daily"` (default for summary): aggregate by date+strategy
- `"trade"` (default for trades): match by date+strategy+time

And document in tool description that `analyze_discrepancies` always uses trade-level matching.

**Files**: `packages/mcp-server/src/tools/performance.ts`

---

### TODO-004: Filter Negligible Correlations

**Priority**: Low
**Context**: `analyze_discrepancies` tool correlations

Currently returns all 6 correlation fields even when negligible (|r| < 0.2):
```json
{ "field": "hourOfDay", "coefficient": 0.047, "interpretation": "negligible" }
```

This clutters output and confuses less capable LLMs.

**Action**: Only include correlations where |coefficient| >= 0.3 (weak or stronger). Add a note if all correlations are negligible: `"note": "No significant correlations found"`.

**Files**: `packages/mcp-server/src/tools/reports.ts`

---

### TODO-005: Remove Pattern Detection from Per-Strategy

**Priority**: Low
**Context**: `analyze_discrepancies` tool

Per-strategy patterns are always empty because:
- `minSamples` defaults to 10
- Most strategies have <10 matched trades
- Even with 10+ trades, sample is too small for reliable patterns

**Action**: Remove `patterns` from per-strategy output entirely. Pattern detection only makes sense at portfolio level where we have 30+ trades.

**Files**: `packages/mcp-server/src/tools/reports.ts`

---

## Completed

(Move items here when fixed)
