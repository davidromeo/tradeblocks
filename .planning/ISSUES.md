# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-001: Hide empty result sections before analysis runs

- **Discovered:** Phase 2 Task 3 (2026-01-11)
- **Type:** UX
- **Description:** The WFA page shows multiple empty placeholder cards ("Execute a walk-forward run to unlock robustness insights", "Run at least one analysis to surface suggestions", "Run an analysis to unlock timeline insights", "Run the analysis to populate this table") before any analysis has been configured or run. These add visual clutter and make the page feel unfinished. Consider hiding these sections entirely until results exist, or collapsing them into a single "Results will appear here after running analysis" message.
- **Impact:** Low (works correctly, this would enhance)
- **Effort:** Medium
- **Suggested phase:** Phase 10 (Integration & Polish)

### ISS-002: Avg Performance Delta metric needs better explanation

- **Discovered:** Phase 6 (2026-01-11)
- **Type:** UX
- **Description:** Users don't understand what Avg Performance Delta means or why it matters. The current tooltip is too shallow.
- **Impact:** Medium (confusing for newcomers)
- **Effort:** Low
- **Status:** ~~Planned for Phase 7-01 Task 1~~ **RESOLVED** in Phase 7

### ISS-003: Configuration-aware interpretation guidance

- **Discovered:** Phase 8-02 checkpoint (2026-01-11)
- **Type:** UX
- **Description:** Analysis tab only evaluates output metrics (efficiency, stability, consistency) and assumes configuration was sensible. It can't distinguish between "strategy is overfit" vs "configuration was too aggressive". Example: 14d IS / 7d OOS with 16 windows may not give strategies enough time to show their edge - poor results could be config-driven, not strategy-driven.
- **Impact:** Medium (users may blame strategies when config is the issue)
- **Effort:** Medium
- **Status:** **RESOLVED** in Phase 8-03 - Added Configuration Notes section to Analysis tab with 5 pattern detection

### ISS-004: Pre-run configuration guidance

- **Discovered:** Phase 8-02 checkpoint (2026-01-11)
- **Type:** UX
- **Description:** Users should understand configuration tradeoffs BEFORE running analysis. Short windows favor noise over signal. More windows with less data per window may hurt strategy evaluation.
- **Impact:** Medium (prevents "bad config → bad results → blame strategy" loop)
- **Effort:** Medium
- **Suggested phase:** Phase 10 (Integration & Polish)

## Closed Enhancements

[Moved here when addressed]
