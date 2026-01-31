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

### Quality Scoring

- [ ] **QTY-01**: Model can get backtest quality score (0-100) based on accuracy vs actual
- [ ] **QTY-02**: Model receives component scores (accuracy, consistency, coverage)
- [ ] **QTY-03**: Model receives improvement suggestions based on score

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

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ING-01 | TBD | Pending |
| ING-02 | TBD | Pending |
| CMP-01 | TBD | Pending |
| CMP-02 | TBD | Pending |
| CMP-03 | TBD | Pending |
| DSC-01 | TBD | Pending |
| DSC-02 | TBD | Pending |
| DSC-03 | TBD | Pending |
| DSC-04 | TBD | Pending |
| MTH-01 | TBD | Pending |
| MTH-02 | TBD | Pending |
| MTH-03 | TBD | Pending |
| TRD-01 | TBD | Pending |
| TRD-02 | TBD | Pending |
| TRD-03 | TBD | Pending |
| QTY-01 | TBD | Pending |
| QTY-02 | TBD | Pending |
| QTY-03 | TBD | Pending |

**Coverage:**
- v2.5 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 after initial definition*
