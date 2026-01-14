# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-005: Plotly TypeScript type conflicts with pnpm

- **Discovered:** Phase 11-01 (2026-01-14)
- **Type:** Build
- **Description:** After converting to pnpm workspace, TypeScript build fails with Plotly type errors. The issue is a conflict between types from `plotly.js` v3.1.2 and `@types/plotly.js` v3.0.7 (pulled via `@types/react-plotly.js`). The types in plotly.js have additional chart types (like "choroplethmap") that don't exist in @types/plotly.js, causing type incompatibility.
- **Impact:** Medium (build fails, but app works at runtime)
- **Effort:** Medium (needs proper type resolution strategy)
- **Status:** Open
- **Potential fixes:**
  1. Pin @types/plotly.js to match plotly.js version
  2. Create type declaration file to harmonize types
  3. Update to newer @types/react-plotly.js when available
  4. Cast Plotly data/layout props to `unknown` in components

## Closed Enhancements

### ISS-001: Hide empty result sections before analysis runs

- **Discovered:** Phase 2 Task 3 (2026-01-11)
- **Type:** UX
- **Description:** The WFA page shows multiple empty placeholder cards before any analysis has been configured or run. These add visual clutter and make the page feel unfinished.
- **Impact:** Low (works correctly, this would enhance)
- **Effort:** Medium
- **Status:** **RESOLVED** in Phase 6
- **Resolution:** Phase 6 restructuring wrapped all results in `{results && ...}` guards. No empty placeholder cards appear before analysis runs - the entire results section only renders after an analysis completes.

### ISS-002: Avg Performance Delta metric needs better explanation

- **Discovered:** Phase 6 (2026-01-11)
- **Type:** UX
- **Description:** Users don't understand what Avg Performance Delta means or why it matters. The current tooltip is too shallow.
- **Impact:** Medium (confusing for newcomers)
- **Effort:** Low
- **Status:** **RESOLVED** in Phase 7
- **Resolution:** Phase 7-01 added comprehensive tooltips explaining what Avg Performance Delta measures (IS vs OOS performance difference), how to interpret positive/negative values, and what results suggest about strategy robustness.

### ISS-003: Configuration-aware interpretation guidance

- **Discovered:** Phase 8-02 checkpoint (2026-01-11)
- **Type:** UX
- **Description:** Analysis tab only evaluates output metrics (efficiency, stability, consistency) and assumes configuration was sensible. It can't distinguish between "strategy is overfit" vs "configuration was too aggressive".
- **Impact:** Medium (users may blame strategies when config is the issue)
- **Effort:** Medium
- **Status:** **RESOLVED** in Phase 8-03
- **Resolution:** Added Configuration Notes section to Analysis tab with 5 pattern detection rules: short IS window, short OOS window, aggressive IS/OOS ratio, few analysis windows, and many analysis windows. Each pattern shows informational or warning messages explaining how configuration may affect results.

### ISS-004: Pre-run configuration guidance

- **Discovered:** Phase 8-02 checkpoint (2026-01-11)
- **Type:** UX
- **Description:** Users should understand configuration tradeoffs BEFORE running analysis. Short windows favor noise over signal. More windows with less data per window may hurt strategy evaluation.
- **Impact:** Medium (prevents "bad config → bad results → blame strategy" loop)
- **Effort:** Medium
- **Status:** **RESOLVED** in Phase 10-01
- **Resolution:** Added validatePreRunConfiguration function that analyzes window configuration before running analysis. Displays guidance alerts in Configuration card when aggressive settings detected (short windows, extreme ratios, auto-config constraints). Uses same ConfigurationObservation interface for consistency with post-run analysis.
