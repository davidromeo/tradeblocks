# Phase 23: Portfolio Health Check Tool - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<vision>
## How This Should Work

One call returns a layered health report with four levels of information:

1. **Quick verdict up front** — "HEALTHY" / "MODERATE CONCERNS" / "ISSUES DETECTED" with a one-liner explaining why

2. **Graded dimensions (dashboard-style):**
   - Diversification: A (avg correlation 0.09, no high pairs)
   - Tail Risk: B- (moderate, one pair at 0.78)
   - Walk-Forward Robustness: C (WFE -17%)
   - Return Consistency: A (100% profit probability in MC)

3. **Specific flags (pass/fail style):**
   - ⚠️ "5/7 17Δ and Friday DC 5/7 25D have 0.78 tail dependence - consider sizing"
   - ⚠️ "Monte Carlo median MDD (21.5%) is 3.7x historical MDD (5.86%)"
   - ✓ "No correlation pairs above 0.5 threshold"

4. **Key numbers without the full matrix dumps:**
   - Strategies: 17 | Trades: 3,565 | Sharpe: 6.21 | MDD: 5.86%

The flags are what users would actually act on. The grades give context. The raw matrices should only be needed if someone wants to dig deeper — the summary layer should surface everything important.

</vision>

<essential>
## What Must Be Nailed

- **Layered structure** — verdict → grades → flags → key numbers (all four levels matter equally)
- **Actionable flags** — the ⚠️ warnings that tell you what to look at, with specific strategy names and numbers
- **Quick verdict** — immediately know if you need to dig deeper
- **Graded dimensions** — A/B/C grades that contextualize quality across diversification, tail risk, robustness, consistency

</essential>

<boundaries>
## What's Out of Scope

- **Historical comparison** — don't compare to previous health checks or show trends over time
- **Recommendations engine** — flag issues but don't suggest specific fixes like "remove strategy X"
- Raw matrix dumps in the main response — only surface what matters

</boundaries>

<specifics>
## Specific Ideas

- Thresholds should use sensible defaults matching existing tools (strategy_similarity, stress_test, etc.)
- Thresholds should be configurable via optional parameters so the AI model can override them if needed
- Grades: A/B/C style (possibly with +/- modifiers like B-)
- Flags use ⚠️ for warnings and ✓ for passing checks
- Include strategy names in flags so user knows exactly what to look at

</specifics>

<notes>
## Additional Context

This tool orchestrates existing analysis capabilities (correlation, tail risk, Monte Carlo, WFA metrics) but the value is in the summary layer — surfacing what matters without requiring the user to wade through raw matrices.

The user found that during real analysis, they needed to dig into correlation matrices only because there wasn't a summary layer telling them what was noteworthy. The health check eliminates that friction.

</notes>

---

*Phase: 23-portfolio-health-check*
*Context gathered: 2026-01-18*
