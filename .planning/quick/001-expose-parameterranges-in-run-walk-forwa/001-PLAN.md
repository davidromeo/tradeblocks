---
phase: 001-expose-parameterranges
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/mcp-server/src/tools/analysis.ts
autonomous: true

must_haves:
  truths:
    - "Users can pass parameterRanges to run_walk_forward MCP tool"
    - "Kelly multiplier sweep works via kellyMultiplier parameter range"
    - "Tool validates parameter range format [min, max, step]"
    - "Empty parameterRanges still works (backward compatible)"
  artifacts:
    - path: "packages/mcp-server/src/tools/analysis.ts"
      provides: "parameterRanges input schema and passthrough"
      contains: "parameterRanges"
  key_links:
    - from: "run_walk_forward inputSchema"
      to: "WalkForwardAnalyzer.analyze()"
      via: "config.parameterRanges passthrough"
      pattern: "parameterRanges.*config"
---

<objective>
Expose parameterRanges in run_walk_forward MCP tool

Purpose: Allow users to sweep position sizing parameters (Kelly fractions, fixed fraction, etc.) via the MCP tool, enabling analysis like "which Kelly multiplier (0.25, 0.5, 1.0) performs best?"

Output: Updated run_walk_forward tool with optional parameterRanges input that passes through to WalkForwardAnalyzer
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/mcp-server/src/tools/analysis.ts (lines 48-450 - run_walk_forward tool)
@packages/lib/models/walk-forward.ts (lines 19-21 - WalkForwardParameterRangeTuple type)
@packages/lib/calculations/walk-forward-analyzer.ts (lines 468-520 - parameter multiplier logic)

Key types:
- `WalkForwardParameterRangeTuple = [min: number, max: number, step: number]`
- `WalkForwardParameterRanges = Record<string, WalkForwardParameterRangeTuple>`

Supported parameter keys (from walk-forward-analyzer.ts):
- `kellyMultiplier` - position scaling multiplier (e.g., [0.25, 1.0, 0.25] for quarter/half/full Kelly)
- `fixedFractionPct` - fixed fraction percentage
- `fixedContracts` - fixed contract count
- `strategy:StrategyName` - per-strategy weights
- `maxDrawdownPct` - risk constraint
- `consecutiveLossLimit` - risk constraint
- `maxDailyLossPct` - risk constraint
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add parameterRanges to run_walk_forward input schema</name>
  <files>packages/mcp-server/src/tools/analysis.ts</files>
  <action>
Add parameterRanges to the run_walk_forward inputSchema (after line 191, before the closing brace):

```typescript
// Parameter ranges for position sizing sweeps
parameterRanges: z
  .record(
    z.string(),
    z.tuple([z.number(), z.number(), z.number()])
  )
  .optional()
  .describe(
    "Parameter ranges for optimization sweep. Each key maps to [min, max, step]. " +
    "Supported keys: 'kellyMultiplier' (position scaling, e.g. [0.25, 1.0, 0.25] for quarter/half/full Kelly), " +
    "'fixedFractionPct' (fixed fraction %), 'fixedContracts' (contract count), " +
    "'maxDrawdownPct'/'maxDailyLossPct'/'consecutiveLossLimit' (risk constraints), " +
    "'strategy:StrategyName' (per-strategy weights)."
  ),
```

Add `parameterRanges` to the destructured parameters in the handler function (around line 224).

Update the config object passed to analyzer.analyze() (around line 341) to use the provided parameterRanges instead of empty object:

```typescript
parameterRanges: parameterRanges ?? {},
```

Update the structuredData.config object (around line 368) to include parameterRanges:

```typescript
parameterRanges: parameterRanges ?? null,
```
  </action>
  <verify>
Run typecheck to verify schema is valid:
```bash
npm run typecheck
```
  </verify>
  <done>
- parameterRanges appears in run_walk_forward inputSchema with Record<string, [number, number, number]> type
- parameterRanges is passed through to WalkForwardAnalyzer.analyze()
- parameterRanges is included in structured output for Claude reasoning
- Typecheck passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Test parameterRanges via MCP CLI</name>
  <files>packages/mcp-server/src/tools/analysis.ts</files>
  <action>
Test the updated tool using the MCP CLI pattern from CLAUDE.md:

1. Test with empty parameterRanges (backward compatibility):
```bash
TRADEBLOCKS_DATA_DIR=~/backtests node packages/mcp-server/server/index.js --call run_walk_forward \
  '{"blockId":"your-test-block","isWindowCount":3,"oosWindowCount":1}' 2>/dev/null | head -20
```

2. Test with kellyMultiplier sweep:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests node packages/mcp-server/server/index.js --call run_walk_forward \
  '{"blockId":"your-test-block","isWindowCount":3,"oosWindowCount":1,"parameterRanges":{"kellyMultiplier":[0.25,1.0,0.25]}}' 2>/dev/null | head -30
```

If no test block available, verify:
- Tool lists parameterRanges in its schema
- Tool doesn't error on invocation

Note: The actual sweep behavior is already implemented in WalkForwardAnalyzer - this task just verifies the MCP passthrough works.
  </action>
  <verify>
Both test commands complete without errors. Output includes parameterRanges in config section when provided.
  </verify>
  <done>
- Empty parameterRanges works (backward compatible)
- kellyMultiplier sweep parameter is accepted and passed through
- No runtime errors when calling the tool
  </done>
</task>

</tasks>

<verification>
1. `npm run typecheck` passes
2. MCP tool accepts parameterRanges input
3. Backward compatible (empty/missing parameterRanges works)
</verification>

<success_criteria>
- Users can call `run_walk_forward` with `parameterRanges: {"kellyMultiplier": [0.25, 1.0, 0.25]}` to sweep Kelly fractions
- Existing calls without parameterRanges continue to work
- Tool description documents supported parameter keys
</success_criteria>

<output>
After completion, create `.planning/quick/001-expose-parameterranges-in-run-walk-forwa/001-SUMMARY.md`
</output>
