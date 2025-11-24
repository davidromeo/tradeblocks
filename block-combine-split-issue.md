# Feature: Combine and Split Trading Blocks

## Summary
Implement functionality to combine multiple trading blocks into a portfolio block and split portfolio blocks into individual strategy blocks, enabling flexible analysis of trading performance at different aggregation levels.

## Background
Currently, when users upload trade logs, each creates a single block that may contain either:
- A single trading strategy
- A portfolio with multiple strategies (distinguished by the `strategy` field in trades)

Users need the ability to:
1. **Combine** multiple single-strategy blocks into a unified portfolio block for aggregate analysis
2. **Split** a portfolio block into individual strategy blocks for isolated performance analysis

## Problem Statement
- Users cannot analyze multiple strategies together if they were uploaded as separate blocks
- Users cannot isolate individual strategy performance from portfolio blocks without re-uploading data
- No way to create custom portfolio combinations for comparative analysis
- Cannot separate strategies for individual optimization or risk analysis

## Proposed Solution

### Core Functionality

#### 1. Combine Blocks
Create a new portfolio block by merging selected blocks:
- Preserves all original trade data
- Maintains strategy labels (adds block name as prefix if no strategy field exists)
- Combines daily logs chronologically (if present)
- Recalculates portfolio statistics for the combined dataset

#### 2. Split Blocks
Separate a portfolio block into individual strategy blocks:
- Creates one new block per unique strategy value
- Preserves trade history for each strategy
- Splits daily logs proportionally (if applicable)
- Maintains reference to parent block

### Technical Implementation

#### New Database Schema
```typescript
interface BlockRelationship {
  id: string;
  type: 'combined' | 'split';
  parentBlockIds: string[];  // Original blocks (for combined) or parent (for split)
  childBlockId: string;       // Result block
  createdAt: Date;
  metadata: {
    operationType: 'combine' | 'split';
    strategyMapping?: Record<string, string>; // For tracking strategy renames
  };
}

// Extension to existing ProcessedBlock
interface ProcessedBlock {
  // ... existing fields ...
  derivedFrom?: {
    type: 'combined' | 'split';
    sourceBlockIds: string[];
    relationshipId: string;
  };
}
```

#### New Files Required
```
lib/services/block-operations.ts       // Core combine/split logic
lib/stores/block-operations-store.ts   // UI state for operations
components/blocks/block-combiner.tsx   // UI for combining blocks
components/blocks/block-splitter.tsx   // UI for splitting blocks
components/blocks/operation-history.tsx // View operation history
```

### User Interface

#### Block List Page Enhancement
- [ ] Multi-select mode for combining blocks
- [ ] "Combine Selected" button (appears when 2+ blocks selected)
- [ ] "Split Block" option in block menu (for portfolio blocks)
- [ ] Visual indicators for derived blocks (icon showing combined/split status)

#### Combine Blocks Dialog
```
┌─────────────────────────────────────┐
│ Combine Blocks                     │
├─────────────────────────────────────┤
│ Selected Blocks:                    │
│ • SPX Strategy (1,234 trades)      │
│ • QQQ Strategy (567 trades)        │
│                                     │
│ New Block Name: [Portfolio 2024]   │
│                                     │
│ Strategy Naming:                    │
│ ○ Keep original strategy names      │
│ ● Prefix with block name           │
│ ○ Custom mapping                    │
│                                     │
│ Daily Logs:                         │
│ ☑ Combine daily logs (sum values)  │
│                                     │
│ [Cancel]              [Combine]     │
└─────────────────────────────────────┘
```

#### Split Block Dialog
```
┌─────────────────────────────────────┐
│ Split Block: Portfolio 2024         │
├─────────────────────────────────────┤
│ Strategies Found:                   │
│ ☑ SPX Iron Condor (45% of trades)  │
│ ☑ QQQ Put Spread (30% of trades)   │
│ ☑ IWM Call Spread (25% of trades)  │
│                                     │
│ Naming Pattern:                     │
│ [Portfolio 2024] - {strategy}      │
│                                     │
│ Daily Logs:                         │
│ ○ Skip (trade-based stats only)    │
│ ● Proportional split by P&L        │
│                                     │
│ [Cancel]               [Split]      │
└─────────────────────────────────────┘
```

### Implementation Logic

#### Combine Operation
```typescript
async function combineBlocks(
  blockIds: string[],
  newBlockName: string,
  options: CombineOptions
): Promise<ProcessedBlock> {
  // 1. Load all trades from selected blocks
  const allTrades = await loadTradesFromBlocks(blockIds);

  // 2. Apply strategy naming rules
  const processedTrades = applyStrategyNaming(allTrades, options);

  // 3. Combine daily logs if present
  const combinedDailyLogs = await combineDailyLogs(blockIds);

  // 4. Create new block with combined data
  const newBlock = await createBlock({
    name: newBlockName,
    trades: processedTrades,
    dailyLogs: combinedDailyLogs,
    derivedFrom: {
      type: 'combined',
      sourceBlockIds: blockIds
    }
  });

  // 5. Calculate portfolio statistics
  await calculateStats(newBlock);

  return newBlock;
}
```

#### Split Operation
```typescript
async function splitBlock(
  blockId: string,
  strategies: string[],
  options: SplitOptions
): Promise<ProcessedBlock[]> {
  // 1. Load trades and group by strategy
  const trades = await loadBlockTrades(blockId);
  const groupedTrades = groupByStrategy(trades, strategies);

  // 2. Split daily logs if requested
  const splitDailyLogs = options.splitDailyLogs ?
    await splitDailyLogsByStrategy(blockId, groupedTrades) : null;

  // 3. Create new blocks for each strategy
  const newBlocks = await Promise.all(
    strategies.map(strategy => createBlock({
      name: `${blockName} - ${strategy}`,
      trades: groupedTrades[strategy],
      dailyLogs: splitDailyLogs?.[strategy],
      derivedFrom: {
        type: 'split',
        sourceBlockIds: [blockId]
      }
    }))
  );

  return newBlocks;
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] Can select multiple blocks and combine into portfolio
- [ ] Combined block shows aggregate statistics correctly
- [ ] Can split portfolio block by strategy field
- [ ] Split blocks maintain accurate trade data
- [ ] Original blocks remain unchanged (non-destructive)
- [ ] Can view operation history for derived blocks
- [ ] Can delete derived blocks without affecting source blocks

### Data Integrity
- [ ] No trades lost during combine/split operations
- [ ] P&L calculations remain accurate
- [ ] Commissions and fees properly aggregated
- [ ] Date ranges correctly determined
- [ ] Strategy labels properly maintained/assigned

### User Experience
- [ ] Clear visual distinction for derived blocks
- [ ] Undo capability (delete derived block)
- [ ] Progress indicators for long operations
- [ ] Preview of operation results before confirming
- [ ] Helpful tooltips explaining implications

### Performance
- [ ] Combine operation < 5 seconds for 10,000 trades
- [ ] Split operation < 3 seconds for typical portfolio
- [ ] No UI blocking during operations
- [ ] Efficient IndexedDB queries

## Edge Cases to Handle

1. **Combining blocks with overlapping dates**
   - Allow but warn user about potential duplication
   - Show date range overlap in preview

2. **Splitting block with no strategy field**
   - Treat as single strategy
   - Inform user no split possible

3. **Combining blocks with different account currencies**
   - Warn user about currency mismatch
   - Proceed but flag in metadata

4. **Daily logs with different granularity**
   - Use trade-based calculations if daily logs incompatible
   - Notify user of fallback

## Future Enhancements
- Combine blocks with weighted allocations
- Time-based splitting (split by date ranges)
- Strategy filtering within combined blocks
- Correlation analysis between combined strategies
- Export combined/split configurations for reuse

## Dependencies
- Existing block store and database operations
- Portfolio stats calculator for recalculation
- Trade and daily log processors
- IndexedDB stores

## Mockups Needed
- Multi-select UI for block list
- Combine blocks dialog
- Split blocks dialog
- Derived block indicators
- Operation history view

## Testing Requirements
- Unit tests for combine/split logic
- Integration tests with IndexedDB
- Edge case handling validation
- Performance benchmarks with large datasets
- UI interaction tests