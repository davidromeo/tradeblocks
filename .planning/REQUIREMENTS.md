# Requirements: TradeBlocks

**Defined:** 2026-01-31
**Core Value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows

## v2.5 Requirements

Requirements for Reporting Log Integration & Discrepancy Analysis. Each maps to roadmap phases.

### Ingestion

- [ ] **ING-01**: Model can load reporting log (strategylog.csv) for a block via MCP
- [ ] **ING-02**: Model receives parsing statistics (strategy count, date range, total P/L)

### Comparison

- [ ] **CMP-01**: Model can get trade-level details in backtest vs actual comparison (entry/exit prices, contracts, reasons)
- [ ] **CMP-02**: Model can identify high-slippage outliers automatically
- [ ] **CMP-03**: Model can group comparison results by strategy or date

### Discrepancy Analysis

- [ ] **DSC-01**: Model can classify slippage sources (execution quality, entry/exit timing, contract count, fees)
- [ ] **DSC-02**: Model can identify systematic slippage patterns per strategy
- [ ] **DSC-03**: Model receives risk assessment for strategies with consistent slippage issues
- [ ] **DSC-04**: Model can correlate slippage with market conditions (VIX, time-of-day)

### Strategy Matching

- [ ] **MTH-01**: Model can get suggested strategy matches based on P/L correlation
- [ ] **MTH-02**: Model receives confidence scores for match suggestions
- [ ] **MTH-03**: Model can detect when backtest ≠ actual systematically (unmatchable divergence)

### Trend Analysis

- [ ] **TRD-01**: Model can analyze time-series slippage by strategy
- [ ] **TRD-02**: Model can detect if slippage is getting worse/better over time
- [ ] **TRD-03**: Model can correlate slippage trends with external factors

### ~~Quality Scoring~~ (Dropped)

Requirements dropped — existing tools (compare_backtest_to_actual, analyze_discrepancies, analyze_slippage_trends) provide all necessary metrics. AI synthesizes quality assessment from these tools rather than prescriptive scores.

- ~~**QTY-01**: Model can get backtest quality score (0-100) based on accuracy vs actual~~
- ~~**QTY-02**: Model receives component scores (accuracy, consistency, coverage)~~
- ~~**QTY-03**: Model receives improvement suggestions based on score~~

## v3+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Analysis

- **ADV-01**: Real-time slippage monitoring (would require persistent connection)
- **ADV-02**: Machine learning-based slippage prediction
- **ADV-03**: Automated trade execution quality alerts

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web UI for reporting log comparison | MCP-first focus for v2.5, web UI already has Trading Calendar |
| Automatic strategy matching without user confirmation | Matches should be suggestions, not automatic |
| External API calls for market data | Maintains 100% local data principle |
| Quality scoring / combined scores | Existing tools provide metrics; AI synthesizes — avoids prescriptive judgments |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ING-01 | Phase 35 | Complete |
| ING-02 | Phase 35 | Complete |
| CMP-01 | Phase 36 | Complete |
| CMP-02 | Phase 36 | Complete |
| CMP-03 | Phase 36 | Complete |
| DSC-01 | Phase 37 | Complete |
| DSC-02 | Phase 37 | Complete |
| DSC-03 | Phase 37 | Complete |
| DSC-04 | Phase 37 | Complete |
| MTH-01 | Phase 38 | Complete |
| MTH-02 | Phase 38 | Complete |
| MTH-03 | Phase 38 | Complete |
| TRD-01 | Phase 39 | Complete |
| TRD-02 | Phase 39 | Complete |
| TRD-03 | Phase 39 | Complete |
| ~~QTY-01~~ | ~~Phase 40~~ | Dropped |
| ~~QTY-02~~ | ~~Phase 40~~ | Dropped |
| ~~QTY-03~~ | ~~Phase 40~~ | Dropped |

**Coverage:**
- v2.5 requirements: 15 delivered (3 dropped)
- Mapped to phases: 15
- Dropped: 3 (QTY-01, QTY-02, QTY-03 — redundant with existing tools)

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-02-01 — Phase 40 dropped, milestone complete*
