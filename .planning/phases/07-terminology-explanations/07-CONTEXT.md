# Phase 7: Terminology Explanations - Context

**Gathered:** 2026-01-11
**Status:** Ready for planning

<vision>
## How This Should Work

Users encountering WFA terminology should have help available through the existing tooltip pattern (info icons on metrics cards). The current implementation has gaps — some terms lack tooltips, and existing explanations may be too shallow to truly help newcomers understand what they're looking at.

The key is making the IS/OOS (in-sample vs out-of-sample) concept crystal clear, since everything else in WFA builds on understanding that fundamental split. Once users grasp IS/OOS, the window types and robustness metrics make sense.

A deeper "Analysis" tab with interpretive content was considered but deferred — this phase focuses on terminology clarity, not guidance on whether results are good or bad.

</vision>

<essential>
## What Must Be Nailed

- **IS/OOS clarity** — Users must understand in-sample vs out-of-sample. This is THE core WFA concept that everything else depends on.
- **Coverage completeness** — Every WFA-specific term and metric should have a tooltip explanation
- **Depth over breadth** — Explanations should be genuinely helpful, not just dictionary definitions

</essential>

<boundaries>
## What's Out of Scope

- **Interpretation guidance** — "Is this result good or bad?" belongs in Phase 8
- **Analysis tab** — Deeper analysis view deferred to future phase
- **Calculation formulas** — Explain WHAT metrics mean, not HOW they're calculated mathematically

</boundaries>

<specifics>
## Specific Areas to Address

Priority confusion points identified:
1. **Avg Performance Delta** — Already flagged as confusing (ISS-002 from Phase 6)
2. **Anchored vs Rolling** — Window types need clearer distinction
3. **Robustness metrics** — Efficiency vs Robustness Score vs Consistency overlap is confusing

Pattern: Use existing metrics card tooltip pattern (info icons with hover explanations)

</specifics>

<notes>
## Additional Context

- Phase 6 deferred "Avg Performance Delta" explanation to this phase (ISS-002)
- Existing MetricsCard component already has tooltip infrastructure
- This phase is terminology-focused; Phase 8 handles "what should I do about this?" guidance

</notes>

---

*Phase: 07-terminology-explanations*
*Context gathered: 2026-01-11*
