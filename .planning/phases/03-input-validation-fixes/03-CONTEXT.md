# Phase 3: Input Validation Fixes - Context

**Gathered:** 2026-01-11
**Status:** Ready for planning

<vision>
## How This Should Work

When users enter values into WFA inputs, they shouldn't hit artificial minimum constraints that block reasonable values. The current validation is too tight across all WFA numeric inputs, preventing users from entering smaller window sizes, fewer periods, or other valid smaller values.

The fix should relax these constraints while keeping sensible defaults that guide users toward good choices. Users can go smaller if they need to, but the defaults still point them in the right direction.

</vision>

<essential>
## What Must Be Nailed

- **Relax minimum constraints** - All WFA numeric inputs should allow smaller values that are currently blocked
- **Keep sensible defaults** - While limits are relaxed, default values should still guide users to reasonable starting points
- **Minimal scope** - Just fix what's broken, don't over-engineer

</essential>

<boundaries>
## What's Out of Scope

- Keep scope minimal — fix the validation constraints, nothing extra
- This phase is specifically about removing artificial limits, not adding new features

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — audit all WFA inputs and relax constraints where they're too tight.

</specifics>

<notes>
## Additional Context

This came out of Phase 1 audit findings. The validation constraints were set too conservatively, blocking valid use cases where users want to test with smaller windows or fewer periods.

</notes>

---

*Phase: 03-input-validation-fixes*
*Context gathered: 2026-01-11*
