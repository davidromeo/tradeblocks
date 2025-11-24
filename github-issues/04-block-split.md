# Block Operations - Split Portfolio into Strategies

## Summary
Implement functionality to split a portfolio block containing multiple strategies into individual strategy blocks for isolated analysis.

## Context
Users need to isolate individual strategy performance from portfolio blocks without re-uploading data. This enables strategy-specific optimization and risk analysis.

## Requirements

### Core Functionality
- Identify unique strategies within a portfolio block
- Create separate blocks for each strategy
- Preserve trade history for each strategy
- Optionally split daily logs proportionally
- Maintain reference to parent block

### Database Schema
Uses same `BlockRelationship` interface as combine feature, with `type: 'split'`

### UI Requirements
**Block Menu Option**:
- "Split Block" option (only for multi-strategy blocks)
- Disabled if block has single/no strategy

**Split Dialog**:
- List of strategies found with trade percentages
- Checkboxes to select which to split
- Naming pattern input with `{strategy}` placeholder
- Daily log handling options:
  - Skip (trade-based stats only)
  - Proportional split by P&L

### Implementation
```typescript
async function splitBlock(
  blockId: string,
  strategies: string[],
  options: SplitOptions
): Promise<ProcessedBlock[]>
```

### Files to Create
```
components/blocks/block-splitter.tsx
// Reuses lib/services/block-operations.ts from combine feature
```

## Acceptance Criteria
- [ ] Correctly identifies all unique strategies
- [ ] Creates separate blocks with accurate data
- [ ] No trades lost during split
- [ ] P&L calculations remain accurate per strategy
- [ ] Parent block remains unchanged
- [ ] Split blocks show relationship to parent
- [ ] Split operation completes in < 3 seconds
- [ ] Can delete split blocks without affecting parent

## Edge Cases
- No strategy field (inform user split not possible)
- Single strategy (inform user split not needed)
- Empty strategy values (group as "Unspecified")
- Very large number of strategies (pagination in UI)

## Dependencies
- Block combine feature (shares block-operations.ts)
- Existing block store

## Testing
- Unit tests for strategy grouping
- Integration tests for block creation
- Verification of P&L accuracy post-split