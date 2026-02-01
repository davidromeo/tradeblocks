# TODOs

Tracked issues and improvements for future phases/milestones.

## MCP Server - Reporting Log Tools

Issues discovered during Phase 37 verification testing (2026-02-01).

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

## Completed

### TODO-001: Remove Misleading Slippage Attribution Categories ✓

**Fixed**: 2026-02-01
**Context**: `analyze_discrepancies` tool

Removed broken entry/exit/size slippage attribution that used SPX underlying prices instead of option fill prices. Now only reports accurate totalSlippage (actual P/L - backtest P/L).

### TODO-002: Simplify analyze_discrepancies Output ✓

**Fixed**: 2026-02-01
**Context**: `analyze_discrepancies` tool

Streamlined output structure:
- Removed `includePerStrategy` parameter (always includes simplified breakdown)
- Removed `attribution` object with broken categories
- Simplified perStrategy to just: strategy, tradeCount, totalSlippage, avgSlippage

### TODO-004: Filter Negligible Correlations ✓

**Fixed**: 2026-02-01
**Context**: `analyze_discrepancies` tool

Now only includes correlations with |coefficient| >= 0.3. Adds note "No significant correlations found" when all are negligible.

### TODO-005: Remove Pattern Detection from Per-Strategy ✓

**Fixed**: 2026-02-01
**Context**: `analyze_discrepancies` tool

Removed patterns from per-strategy output. Pattern detection now only at portfolio level where sample sizes are meaningful.
