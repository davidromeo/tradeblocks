---
created: 2026-02-24T02:16:33.701Z
title: Fix VIX data accuracy from Pine Script cross-security
area: mcp-server
files:
  - scripts/spx-daily.pine
  - packages/mcp-server/src/utils/market-enricher.ts
  - packages/mcp-server/src/db/market-schemas.ts
---

## Problem

`request.security("CBOE:VIX", timeframe.period, open/close)` on an SPX chart produces inaccurate VIX values due to session boundary mismatch. VIX (CBOE index) has a different session than SPX — VIX settles at 4:15 PM ET vs SPX at 4:00 PM, and the "open" value at SPX's 9:30 session start differs from VIX's actual first RTH print.

Verified with real data on Feb 17, 2026:
- VIX_Open: Pine gives 21.48, actual CBOE:VIX = 21.70 (off by 0.22)
- VIX_Close: Pine gives 20.60, actual CBOE:VIX = 20.29 (off by 0.31)

This affects ALL VIX fields in market.context (VIX_Open, VIX_Close, VIX_High, VIX_Low, VIX9D_Close, VIX3M_Close) and cascades into Tier 2 enrichment (Vol_Regime, VIX_Change_Pct, VIX_Spike_Pct, Term_Structure_State, VIX_Percentile).

Reported by user ddr on Discord with independent verification against TradingView CBOE:VIX chart.

## Solution

1. **Remove VIX `request.security` calls from `scripts/spx-daily.pine`** — the universal script should only export the chart's own OHLCV data, not cross-security VIX pulls
2. **Document separate VIX export workflow** — users apply the same universal script to a CBOE:VIX daily chart and import into `market.context` with appropriate column mapping
3. **Consider deriving market.context VIX fields from market.intraday VIX bars** — we already have accurate VIX intraday data; the enrichment pipeline could compute VIX_Open (9:30 bar), VIX_Close (last bar), VIX_High/Low from those bars, eliminating Pine Script as VIX source entirely
4. **Re-enrich existing data** after fixing the VIX source to correct the cascading Tier 2 errors

Option 3 is the strongest fix — it removes the dependency on Pine Script for VIX entirely and uses the authoritative intraday data we already import.
