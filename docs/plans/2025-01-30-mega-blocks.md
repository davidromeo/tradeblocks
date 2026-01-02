# Mega Blocks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to combine multiple strategy blocks into "Mega Blocks" for portfolio construction analysis, with comparison tools to help decide which strategies to include and at what weights.

**Architecture:** Hybrid storage model—Mega Blocks store a "recipe" (source block IDs + weights) for editability, plus materialized trades for performance. The Portfolio Builder page provides a tabbed UI with real-time comparison tools (correlation, equity curves, tail risk, drawdowns). Mega Blocks appear in the main blocks list with a distinct icon and work with all existing features.

**Tech Stack:** Next.js 15, TypeScript, Zustand, IndexedDB (via existing db layer), Plotly (via ChartWrapper), shadcn/ui components, math.js for calculations.

---

## Task 1: Extend ProcessedBlock Model with Mega Block Fields

**Files:**
- Modify: `lib/models/block.ts`

**Step 1: Write the failing test**

Create test file:

```typescript
// tests/unit/mega-block-model.test.ts
import { ProcessedBlock } from '@/lib/models/block';

describe('Mega Block Model', () => {
  it('should have isMegaBlock discriminator field', () => {
    const megaBlock: ProcessedBlock = {
      id: 'test-mega',
      name: 'Combined Portfolio',
      isActive: false,
      created: new Date(),
      lastModified: new Date(),
      tradeLog: {
        fileName: 'materialized.csv',
        fileSize: 0,
        originalRowCount: 0,
        processedRowCount: 100,
        uploadedAt: new Date(),
      },
      processingStatus: 'completed',
      dataReferences: {
        tradesStorageKey: 'trades-test-mega',
      },
      analysisConfig: {
        riskFreeRate: 2.0,
        useBusinessDaysOnly: true,
        annualizationFactor: 252,
        confidenceLevel: 0.95,
      },
      // Mega Block specific fields
      isMegaBlock: true,
      megaBlockConfig: {
        sourceBlocks: [
          { blockId: 'block-a', weight: 2.0 },
          { blockId: 'block-b', weight: 1.0 },
        ],
        lastMaterializedAt: new Date(),
        sourceBlockVersions: {
          'block-a': 1706600000000,
          'block-b': 1706500000000,
        },
      },
    };

    expect(megaBlock.isMegaBlock).toBe(true);
    expect(megaBlock.megaBlockConfig?.sourceBlocks).toHaveLength(2);
  });

  it('should allow regular blocks without mega block fields', () => {
    const regularBlock: ProcessedBlock = {
      id: 'test-regular',
      name: 'Single Strategy',
      isActive: false,
      created: new Date(),
      lastModified: new Date(),
      tradeLog: {
        fileName: 'trades.csv',
        fileSize: 1000,
        originalRowCount: 50,
        processedRowCount: 50,
        uploadedAt: new Date(),
      },
      processingStatus: 'completed',
      dataReferences: {
        tradesStorageKey: 'trades-test-regular',
      },
      analysisConfig: {
        riskFreeRate: 2.0,
        useBusinessDaysOnly: true,
        annualizationFactor: 252,
        confidenceLevel: 0.95,
      },
    };

    expect(regularBlock.isMegaBlock).toBeUndefined();
    expect(regularBlock.megaBlockConfig).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mega-block-model.test.ts`
Expected: FAIL with TypeScript errors about missing properties

**Step 3: Write minimal implementation**

Add to `lib/models/block.ts` after line 86 (inside ProcessedBlock interface, after analysisConfig):

```typescript
  // Mega Block configuration (only present for combined blocks)
  isMegaBlock?: boolean;
  megaBlockConfig?: {
    sourceBlocks: Array<{
      blockId: string;
      weight: number;
    }>;
    lastMaterializedAt: Date;
    sourceBlockVersions: Record<string, number>; // blockId -> lastModified timestamp
  };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/mega-block-model.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/models/block.ts tests/unit/mega-block-model.test.ts
git commit -m "feat: add mega block fields to ProcessedBlock model

- Add isMegaBlock discriminator field
- Add megaBlockConfig with sourceBlocks, weights, and version tracking
- All fields optional to maintain backward compatibility

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Mega Block Type Guards and Helpers

**Files:**
- Create: `lib/models/mega-block.ts`
- Test: `tests/unit/mega-block-helpers.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/mega-block-helpers.test.ts
import { ProcessedBlock } from '@/lib/models/block';
import {
  isMegaBlock,
  getMegaBlockSourceIds,
  getMegaBlockTotalWeight,
} from '@/lib/models/mega-block';

describe('Mega Block Helpers', () => {
  const megaBlock: ProcessedBlock = {
    id: 'mega-1',
    name: 'Combined',
    isActive: false,
    created: new Date(),
    lastModified: new Date(),
    tradeLog: {
      fileName: 'materialized.csv',
      fileSize: 0,
      originalRowCount: 0,
      processedRowCount: 100,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-mega-1' },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
    isMegaBlock: true,
    megaBlockConfig: {
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.5 },
      ],
      lastMaterializedAt: new Date(),
      sourceBlockVersions: { a: 1000, b: 2000 },
    },
  };

  const regularBlock: ProcessedBlock = {
    id: 'regular-1',
    name: 'Single',
    isActive: false,
    created: new Date(),
    lastModified: new Date(),
    tradeLog: {
      fileName: 'trades.csv',
      fileSize: 1000,
      originalRowCount: 50,
      processedRowCount: 50,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-regular-1' },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
  };

  describe('isMegaBlock', () => {
    it('returns true for mega blocks', () => {
      expect(isMegaBlock(megaBlock)).toBe(true);
    });

    it('returns false for regular blocks', () => {
      expect(isMegaBlock(regularBlock)).toBe(false);
    });
  });

  describe('getMegaBlockSourceIds', () => {
    it('returns source block IDs', () => {
      expect(getMegaBlockSourceIds(megaBlock)).toEqual(['a', 'b']);
    });

    it('returns empty array for regular blocks', () => {
      expect(getMegaBlockSourceIds(regularBlock)).toEqual([]);
    });
  });

  describe('getMegaBlockTotalWeight', () => {
    it('returns sum of weights', () => {
      expect(getMegaBlockTotalWeight(megaBlock)).toBe(3.5);
    });

    it('returns 0 for regular blocks', () => {
      expect(getMegaBlockTotalWeight(regularBlock)).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mega-block-helpers.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// lib/models/mega-block.ts
import { ProcessedBlock } from './block';

/**
 * Type guard to check if a block is a Mega Block
 */
export function isMegaBlock(block: ProcessedBlock): boolean {
  return block.isMegaBlock === true && block.megaBlockConfig !== undefined;
}

/**
 * Get source block IDs from a Mega Block
 */
export function getMegaBlockSourceIds(block: ProcessedBlock): string[] {
  if (!isMegaBlock(block)) return [];
  return block.megaBlockConfig!.sourceBlocks.map((s) => s.blockId);
}

/**
 * Get total weight across all source blocks
 */
export function getMegaBlockTotalWeight(block: ProcessedBlock): number {
  if (!isMegaBlock(block)) return 0;
  return block.megaBlockConfig!.sourceBlocks.reduce((sum, s) => sum + s.weight, 0);
}

/**
 * Source block reference with weight
 */
export interface SourceBlockRef {
  blockId: string;
  weight: number;
}

/**
 * Configuration for creating a new Mega Block
 */
export interface CreateMegaBlockConfig {
  name: string;
  description?: string;
  sourceBlocks: SourceBlockRef[];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/mega-block-helpers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/models/mega-block.ts tests/unit/mega-block-helpers.test.ts
git commit -m "feat: add mega block type guards and helpers

- isMegaBlock() type guard
- getMegaBlockSourceIds() helper
- getMegaBlockTotalWeight() helper
- CreateMegaBlockConfig interface

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Trade Scaling Logic

**Files:**
- Create: `lib/services/mega-block.ts`
- Test: `tests/unit/mega-block-service.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/mega-block-service.test.ts
import { Trade } from '@/lib/models/trade';
import { scaleTradeByWeight } from '@/lib/services/mega-block';

describe('scaleTradeByWeight', () => {
  const baseTrade: Trade = {
    dateOpened: new Date('2024-01-15'),
    timeOpened: '09:30:00',
    openingPrice: 4535.25,
    legs: 'SPX 15JAN24 4500P/4450P',
    premium: 2.5,
    closingPrice: 1.25,
    dateClosed: new Date('2024-01-15'),
    timeClosed: '15:45:00',
    avgClosingCost: 1.25,
    reasonForClose: 'Profit Target',
    pl: 125.0,
    numContracts: 1,
    fundsAtClose: 10125.0,
    marginReq: 1000.0,
    strategy: 'Bull Put Spread',
    openingCommissionsFees: 1.5,
    closingCommissionsFees: 1.5,
    openingShortLongRatio: 0.5,
    closingShortLongRatio: 0.5,
  };

  it('scales P&L by weight', () => {
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.pl).toBe(250.0);
  });

  it('scales contracts by weight', () => {
    const scaled = scaleTradeByWeight(baseTrade, 3.0);
    expect(scaled.numContracts).toBe(3);
  });

  it('scales premium by weight', () => {
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.premium).toBe(5.0);
  });

  it('scales commissions by weight', () => {
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.openingCommissionsFees).toBe(3.0);
    expect(scaled.closingCommissionsFees).toBe(3.0);
  });

  it('scales margin requirement by weight', () => {
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.marginReq).toBe(2000.0);
  });

  it('scales fundsAtClose by weight', () => {
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.fundsAtClose).toBe(20250.0);
  });

  it('preserves non-scaled fields', () => {
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.dateOpened).toEqual(baseTrade.dateOpened);
    expect(scaled.timeOpened).toBe(baseTrade.timeOpened);
    expect(scaled.strategy).toBe(baseTrade.strategy);
    expect(scaled.legs).toBe(baseTrade.legs);
    expect(scaled.openingPrice).toBe(baseTrade.openingPrice);
    expect(scaled.closingPrice).toBe(baseTrade.closingPrice);
  });

  it('handles weight of 1.0 (no change)', () => {
    const scaled = scaleTradeByWeight(baseTrade, 1.0);
    expect(scaled.pl).toBe(125.0);
    expect(scaled.numContracts).toBe(1);
  });

  it('handles fractional weights', () => {
    const scaled = scaleTradeByWeight(baseTrade, 0.5);
    expect(scaled.pl).toBe(62.5);
    expect(scaled.numContracts).toBe(0.5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// lib/services/mega-block.ts
import { Trade } from '../models/trade';

/**
 * Scale a trade's monetary and quantity values by a weight factor.
 * Used when combining blocks with different allocations.
 *
 * Scaled fields:
 * - pl, premium, fundsAtClose, marginReq
 * - numContracts
 * - openingCommissionsFees, closingCommissionsFees
 * - maxProfit, maxLoss (if present)
 *
 * Preserved fields:
 * - All dates and times
 * - strategy, legs, reasonForClose
 * - Prices (openingPrice, closingPrice, avgClosingCost)
 * - Ratios (openingShortLongRatio, closingShortLongRatio)
 * - VIX values
 * - gap, movement
 */
export function scaleTradeByWeight(trade: Trade, weight: number): Trade {
  return {
    ...trade,
    // Scale monetary values
    pl: trade.pl * weight,
    premium: trade.premium * weight,
    fundsAtClose: trade.fundsAtClose * weight,
    marginReq: trade.marginReq * weight,
    openingCommissionsFees: trade.openingCommissionsFees * weight,
    closingCommissionsFees: trade.closingCommissionsFees * weight,
    // Scale quantity
    numContracts: trade.numContracts * weight,
    // Scale optional monetary fields if present
    ...(trade.maxProfit !== undefined && { maxProfit: trade.maxProfit * weight }),
    ...(trade.maxLoss !== undefined && { maxLoss: trade.maxLoss * weight }),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/mega-block.ts tests/unit/mega-block-service.test.ts
git commit -m "feat: add trade scaling function for mega blocks

- scaleTradeByWeight() scales monetary and quantity fields
- Preserves dates, strategy names, prices, and ratios
- Handles fractional weights for flexible allocation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Merge and Materialize Logic

**Files:**
- Modify: `lib/services/mega-block.ts`
- Test: `tests/unit/mega-block-service.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/mega-block-service.test.ts`:

```typescript
import { Trade } from '@/lib/models/trade';
import { scaleTradeByWeight, mergeAndScaleTrades } from '@/lib/services/mega-block';
import { SourceBlockRef } from '@/lib/models/mega-block';

// ... existing tests ...

describe('mergeAndScaleTrades', () => {
  const tradesA: Trade[] = [
    {
      dateOpened: new Date('2024-01-15'),
      timeOpened: '09:30:00',
      openingPrice: 4535.25,
      legs: 'SPX 15JAN24 4500P/4450P',
      premium: 2.5,
      pl: 100.0,
      numContracts: 1,
      fundsAtClose: 10100.0,
      marginReq: 1000.0,
      strategy: 'Strategy A',
      openingCommissionsFees: 1.0,
      closingCommissionsFees: 1.0,
      openingShortLongRatio: 0.5,
    },
    {
      dateOpened: new Date('2024-01-17'),
      timeOpened: '10:00:00',
      openingPrice: 4540.0,
      legs: 'SPX 17JAN24 4500P/4450P',
      premium: 3.0,
      pl: 150.0,
      numContracts: 1,
      fundsAtClose: 10250.0,
      marginReq: 1000.0,
      strategy: 'Strategy A',
      openingCommissionsFees: 1.0,
      closingCommissionsFees: 1.0,
      openingShortLongRatio: 0.5,
    },
  ];

  const tradesB: Trade[] = [
    {
      dateOpened: new Date('2024-01-16'),
      timeOpened: '09:30:00',
      openingPrice: 4538.0,
      legs: 'SPX 16JAN24 4600C/4650C',
      premium: 2.0,
      pl: -50.0,
      numContracts: 1,
      fundsAtClose: 9950.0,
      marginReq: 800.0,
      strategy: 'Strategy B',
      openingCommissionsFees: 1.0,
      closingCommissionsFees: 1.0,
      openingShortLongRatio: 0.6,
    },
  ];

  const sourceBlocks: SourceBlockRef[] = [
    { blockId: 'a', weight: 2.0 },
    { blockId: 'b', weight: 1.0 },
  ];

  const tradesMap: Record<string, Trade[]> = {
    a: tradesA,
    b: tradesB,
  };

  it('merges trades from multiple blocks', () => {
    const merged = mergeAndScaleTrades(tradesMap, sourceBlocks);
    expect(merged).toHaveLength(3);
  });

  it('scales trades by their block weight', () => {
    const merged = mergeAndScaleTrades(tradesMap, sourceBlocks);

    // Strategy A trades should be scaled by 2.0
    const stratATraces = merged.filter(t => t.strategy === 'Strategy A');
    expect(stratATraces[0].pl).toBe(200.0); // 100 * 2
    expect(stratATraces[0].numContracts).toBe(2);

    // Strategy B trades should be scaled by 1.0 (no change)
    const stratBTraces = merged.filter(t => t.strategy === 'Strategy B');
    expect(stratBTraces[0].pl).toBe(-50.0);
    expect(stratBTraces[0].numContracts).toBe(1);
  });

  it('sorts trades chronologically by dateOpened then timeOpened', () => {
    const merged = mergeAndScaleTrades(tradesMap, sourceBlocks);

    // Order should be: Jan 15, Jan 16, Jan 17
    expect(merged[0].dateOpened).toEqual(new Date('2024-01-15'));
    expect(merged[1].dateOpened).toEqual(new Date('2024-01-16'));
    expect(merged[2].dateOpened).toEqual(new Date('2024-01-17'));
  });

  it('handles empty trades for a block', () => {
    const tradesMapWithEmpty: Record<string, Trade[]> = {
      a: tradesA,
      b: [],
    };
    const merged = mergeAndScaleTrades(tradesMapWithEmpty, sourceBlocks);
    expect(merged).toHaveLength(2);
  });

  it('handles missing block in tradesMap', () => {
    const incompleteMap: Record<string, Trade[]> = {
      a: tradesA,
      // b is missing
    };
    const merged = mergeAndScaleTrades(incompleteMap, sourceBlocks);
    expect(merged).toHaveLength(2); // Only trades from block a
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: FAIL - mergeAndScaleTrades not exported

**Step 3: Write minimal implementation**

Add to `lib/services/mega-block.ts`:

```typescript
import { SourceBlockRef } from '../models/mega-block';

// ... existing code ...

/**
 * Merge trades from multiple blocks, scaling each by its weight,
 * and sort chronologically.
 *
 * @param tradesMap - Map of blockId to trades array
 * @param sourceBlocks - Source block references with weights
 * @returns Merged and scaled trades, sorted by dateOpened/timeOpened
 */
export function mergeAndScaleTrades(
  tradesMap: Record<string, Trade[]>,
  sourceBlocks: SourceBlockRef[]
): Trade[] {
  const allTrades: Trade[] = [];

  for (const source of sourceBlocks) {
    const trades = tradesMap[source.blockId];
    if (!trades) continue;

    for (const trade of trades) {
      allTrades.push(scaleTradeByWeight(trade, source.weight));
    }
  }

  // Sort chronologically
  return allTrades.sort((a, b) => {
    const dateA = new Date(a.dateOpened).getTime();
    const dateB = new Date(b.dateOpened).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.timeOpened.localeCompare(b.timeOpened);
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/mega-block.ts tests/unit/mega-block-service.test.ts
git commit -m "feat: add mergeAndScaleTrades for mega block materialization

- Merges trades from multiple source blocks
- Scales each trade by its block's weight
- Sorts result chronologically
- Handles empty or missing blocks gracefully

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Staleness Detection Logic

**Files:**
- Modify: `lib/services/mega-block.ts`
- Test: `tests/unit/mega-block-service.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/mega-block-service.test.ts`:

```typescript
import { ProcessedBlock } from '@/lib/models/block';
import {
  scaleTradeByWeight,
  mergeAndScaleTrades,
  checkMegaBlockStaleness,
  StalenessResult,
} from '@/lib/services/mega-block';

// ... existing tests ...

describe('checkMegaBlockStaleness', () => {
  const now = Date.now();

  const megaBlock: ProcessedBlock = {
    id: 'mega-1',
    name: 'Combined',
    isActive: false,
    created: new Date(now - 100000),
    lastModified: new Date(now - 50000),
    tradeLog: {
      fileName: 'materialized.csv',
      fileSize: 0,
      originalRowCount: 0,
      processedRowCount: 100,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-mega-1' },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
    isMegaBlock: true,
    megaBlockConfig: {
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.0 },
      ],
      lastMaterializedAt: new Date(now - 50000),
      sourceBlockVersions: {
        a: now - 100000,
        b: now - 100000,
      },
    },
  };

  it('returns fresh when no source blocks have changed', () => {
    const sourceBlocks: ProcessedBlock[] = [
      {
        id: 'a',
        name: 'Block A',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 100000), // Same as recorded
        tradeLog: { fileName: 'a.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-a' },
        analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
      },
      {
        id: 'b',
        name: 'Block B',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 100000), // Same as recorded
        tradeLog: { fileName: 'b.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-b' },
        analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
      },
    ];

    const result = checkMegaBlockStaleness(megaBlock, sourceBlocks);
    expect(result.isStale).toBe(false);
    expect(result.updatedBlocks).toHaveLength(0);
    expect(result.missingBlocks).toHaveLength(0);
  });

  it('detects when a source block has been updated', () => {
    const sourceBlocks: ProcessedBlock[] = [
      {
        id: 'a',
        name: 'Block A',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 10000), // NEWER than recorded
        tradeLog: { fileName: 'a.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-a' },
        analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
      },
      {
        id: 'b',
        name: 'Block B',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 100000),
        tradeLog: { fileName: 'b.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-b' },
        analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
      },
    ];

    const result = checkMegaBlockStaleness(megaBlock, sourceBlocks);
    expect(result.isStale).toBe(true);
    expect(result.updatedBlocks).toContain('a');
    expect(result.missingBlocks).toHaveLength(0);
  });

  it('detects when a source block is missing', () => {
    const sourceBlocks: ProcessedBlock[] = [
      {
        id: 'a',
        name: 'Block A',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 100000),
        tradeLog: { fileName: 'a.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-a' },
        analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
      },
      // Block 'b' is missing!
    ];

    const result = checkMegaBlockStaleness(megaBlock, sourceBlocks);
    expect(result.isStale).toBe(true);
    expect(result.missingBlocks).toContain('b');
  });

  it('returns not stale for regular blocks', () => {
    const regularBlock: ProcessedBlock = {
      id: 'regular',
      name: 'Regular',
      isActive: false,
      created: new Date(),
      lastModified: new Date(),
      tradeLog: { fileName: 'r.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
      processingStatus: 'completed',
      dataReferences: { tradesStorageKey: 'trades-r' },
      analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
    };

    const result = checkMegaBlockStaleness(regularBlock, []);
    expect(result.isStale).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: FAIL - checkMegaBlockStaleness not exported

**Step 3: Write minimal implementation**

Add to `lib/services/mega-block.ts`:

```typescript
import { ProcessedBlock } from '../models/block';
import { isMegaBlock } from '../models/mega-block';

// ... existing code ...

/**
 * Result of staleness check
 */
export interface StalenessResult {
  isStale: boolean;
  updatedBlocks: string[]; // Block IDs that have been updated since materialization
  missingBlocks: string[]; // Block IDs that no longer exist
}

/**
 * Check if a Mega Block needs to be refreshed.
 * Compares source block lastModified timestamps against recorded versions.
 *
 * @param megaBlock - The mega block to check
 * @param sourceBlocks - Current source blocks from database
 * @returns Staleness result with details
 */
export function checkMegaBlockStaleness(
  megaBlock: ProcessedBlock,
  sourceBlocks: ProcessedBlock[]
): StalenessResult {
  // Regular blocks are never stale
  if (!isMegaBlock(megaBlock)) {
    return { isStale: false, updatedBlocks: [], missingBlocks: [] };
  }

  const config = megaBlock.megaBlockConfig!;
  const updatedBlocks: string[] = [];
  const missingBlocks: string[] = [];

  // Build lookup map for current blocks
  const blockMap = new Map<string, ProcessedBlock>();
  for (const block of sourceBlocks) {
    blockMap.set(block.id, block);
  }

  // Check each source block
  for (const source of config.sourceBlocks) {
    const currentBlock = blockMap.get(source.blockId);

    if (!currentBlock) {
      missingBlocks.push(source.blockId);
      continue;
    }

    const recordedVersion = config.sourceBlockVersions[source.blockId];
    const currentVersion = new Date(currentBlock.lastModified).getTime();

    if (currentVersion > recordedVersion) {
      updatedBlocks.push(source.blockId);
    }
  }

  return {
    isStale: updatedBlocks.length > 0 || missingBlocks.length > 0,
    updatedBlocks,
    missingBlocks,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/mega-block.ts tests/unit/mega-block-service.test.ts
git commit -m "feat: add staleness detection for mega blocks

- checkMegaBlockStaleness() compares source block timestamps
- Detects updated and missing source blocks
- Returns detailed staleness result for UI display

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Mega Block Creation Function

**Files:**
- Modify: `lib/services/mega-block.ts`
- Test: `tests/unit/mega-block-service.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/mega-block-service.test.ts`:

```typescript
import {
  scaleTradeByWeight,
  mergeAndScaleTrades,
  checkMegaBlockStaleness,
  StalenessResult,
  buildMegaBlockData,
  MegaBlockBuildResult,
} from '@/lib/services/mega-block';

// ... existing tests ...

describe('buildMegaBlockData', () => {
  const now = Date.now();

  const blockA: ProcessedBlock = {
    id: 'a',
    name: 'Strategy A',
    isActive: false,
    created: new Date(now - 200000),
    lastModified: new Date(now - 100000),
    tradeLog: { fileName: 'a.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-a' },
    analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
  };

  const blockB: ProcessedBlock = {
    id: 'b',
    name: 'Strategy B',
    isActive: false,
    created: new Date(now - 200000),
    lastModified: new Date(now - 50000),
    tradeLog: { fileName: 'b.csv', fileSize: 100, originalRowCount: 10, processedRowCount: 10, uploadedAt: new Date() },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-b' },
    analysisConfig: { riskFreeRate: 2, useBusinessDaysOnly: true, annualizationFactor: 252, confidenceLevel: 0.95 },
  };

  const tradesA: Trade[] = [
    {
      dateOpened: new Date('2024-01-15'),
      timeOpened: '09:30:00',
      openingPrice: 4535.25,
      legs: 'SPX 15JAN24 4500P/4450P',
      premium: 2.5,
      pl: 100.0,
      numContracts: 1,
      fundsAtClose: 10100.0,
      marginReq: 1000.0,
      strategy: 'Strategy A',
      openingCommissionsFees: 1.0,
      closingCommissionsFees: 1.0,
      openingShortLongRatio: 0.5,
    },
  ];

  const tradesB: Trade[] = [
    {
      dateOpened: new Date('2024-01-16'),
      timeOpened: '09:30:00',
      openingPrice: 4538.0,
      legs: 'SPX 16JAN24 4600C/4650C',
      premium: 2.0,
      pl: -50.0,
      numContracts: 1,
      fundsAtClose: 9950.0,
      marginReq: 800.0,
      strategy: 'Strategy B',
      openingCommissionsFees: 1.0,
      closingCommissionsFees: 1.0,
      openingShortLongRatio: 0.6,
    },
  ];

  it('builds mega block data with correct structure', () => {
    const result = buildMegaBlockData({
      name: 'Combined Portfolio',
      description: 'Test combination',
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.0 },
      ],
      sourceBlocksData: [blockA, blockB],
      tradesMap: { a: tradesA, b: tradesB },
    });

    expect(result.block.name).toBe('Combined Portfolio');
    expect(result.block.description).toBe('Test combination');
    expect(result.block.isMegaBlock).toBe(true);
    expect(result.block.megaBlockConfig?.sourceBlocks).toHaveLength(2);
  });

  it('includes scaled and merged trades', () => {
    const result = buildMegaBlockData({
      name: 'Combined',
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.0 },
      ],
      sourceBlocksData: [blockA, blockB],
      tradesMap: { a: tradesA, b: tradesB },
    });

    expect(result.trades).toHaveLength(2);
    expect(result.trades[0].pl).toBe(200.0); // Scaled by 2.0
    expect(result.trades[1].pl).toBe(-50.0); // Scaled by 1.0
  });

  it('records source block versions', () => {
    const result = buildMegaBlockData({
      name: 'Combined',
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.0 },
      ],
      sourceBlocksData: [blockA, blockB],
      tradesMap: { a: tradesA, b: tradesB },
    });

    const versions = result.block.megaBlockConfig?.sourceBlockVersions;
    expect(versions?.a).toBe(new Date(blockA.lastModified).getTime());
    expect(versions?.b).toBe(new Date(blockB.lastModified).getTime());
  });

  it('sets correct date range from merged trades', () => {
    const result = buildMegaBlockData({
      name: 'Combined',
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.0 },
      ],
      sourceBlocksData: [blockA, blockB],
      tradesMap: { a: tradesA, b: tradesB },
    });

    expect(result.block.dateRange?.start).toEqual(new Date('2024-01-15'));
    expect(result.block.dateRange?.end).toEqual(new Date('2024-01-16'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: FAIL - buildMegaBlockData not exported

**Step 3: Write minimal implementation**

Add to `lib/services/mega-block.ts`:

```typescript
import { SourceBlockRef, CreateMegaBlockConfig } from '../models/mega-block';

// ... existing code ...

/**
 * Input for building mega block data
 */
export interface BuildMegaBlockInput {
  name: string;
  description?: string;
  sourceBlocks: SourceBlockRef[];
  sourceBlocksData: ProcessedBlock[]; // Full block data for version tracking
  tradesMap: Record<string, Trade[]>; // blockId -> trades
}

/**
 * Result of building mega block data
 */
export interface MegaBlockBuildResult {
  block: Omit<ProcessedBlock, 'id' | 'created' | 'lastModified'>;
  trades: Trade[];
}

/**
 * Build the data for a new Mega Block.
 * Does NOT save to database - that's handled by the caller.
 *
 * @param input - Configuration and source data
 * @returns Block data and merged trades ready for storage
 */
export function buildMegaBlockData(input: BuildMegaBlockInput): MegaBlockBuildResult {
  const { name, description, sourceBlocks, sourceBlocksData, tradesMap } = input;

  // Merge and scale trades
  const trades = mergeAndScaleTrades(tradesMap, sourceBlocks);

  // Build source block versions map
  const sourceBlockVersions: Record<string, number> = {};
  for (const block of sourceBlocksData) {
    sourceBlockVersions[block.id] = new Date(block.lastModified).getTime();
  }

  // Calculate date range from merged trades
  let dateRange: { start: Date; end: Date } | undefined;
  if (trades.length > 0) {
    const dates = trades.map((t) => new Date(t.dateOpened).getTime());
    dateRange = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }

  // Build the block (without id, created, lastModified - those are added on save)
  const block: Omit<ProcessedBlock, 'id' | 'created' | 'lastModified'> = {
    name,
    description,
    isActive: false,
    tradeLog: {
      fileName: 'materialized-mega-block.csv',
      fileSize: 0, // Not a real file
      originalRowCount: trades.length,
      processedRowCount: trades.length,
      uploadedAt: new Date(),
    },
    dateRange,
    processingStatus: 'completed',
    dataReferences: {
      tradesStorageKey: '', // Will be set when saving
    },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
    isMegaBlock: true,
    megaBlockConfig: {
      sourceBlocks,
      lastMaterializedAt: new Date(),
      sourceBlockVersions,
    },
  };

  return { block, trades };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/mega-block-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/mega-block.ts tests/unit/mega-block-service.test.ts
git commit -m "feat: add buildMegaBlockData for mega block creation

- Builds complete block data from source blocks and trades
- Merges and scales trades using configured weights
- Records source block versions for staleness detection
- Calculates date range from merged trades

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Portfolio Builder Page Structure

**Files:**
- Create: `app/(platform)/portfolio-builder/page.tsx`

**Step 1: Create the basic page structure**

```typescript
// app/(platform)/portfolio-builder/page.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { isMegaBlock } from "@/lib/models/mega-block";
import { Layers, Plus, Trash2, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

interface SelectedBlock {
  blockId: string;
  name: string;
  weight: number;
}

export default function PortfolioBuilderPage() {
  const blocks = useBlockStore((state) => state.blocks);
  const isInitialized = useBlockStore((state) => state.isInitialized);

  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [megaBlockName, setMegaBlockName] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Filter out mega blocks from available blocks
  const availableBlocks = useMemo(() => {
    // For now, just filter by name not containing "Mega" - we'll improve this
    // once we have the full ProcessedBlock data with isMegaBlock
    return blocks.filter((block) => {
      // Check if already selected
      const isSelected = selectedBlocks.some((sb) => sb.blockId === block.id);
      return !isSelected;
    });
  }, [blocks, selectedBlocks]);

  const handleAddBlock = useCallback((block: Block) => {
    setSelectedBlocks((prev) => [
      ...prev,
      { blockId: block.id, name: block.name, weight: 1.0 },
    ]);
    setIsAddDialogOpen(false);
  }, []);

  const handleRemoveBlock = useCallback((blockId: string) => {
    setSelectedBlocks((prev) => prev.filter((b) => b.blockId !== blockId));
  }, []);

  const handleWeightChange = useCallback((blockId: string, weight: number) => {
    setSelectedBlocks((prev) =>
      prev.map((b) => (b.blockId === blockId ? { ...b, weight } : b))
    );
  }, []);

  const canCreate = selectedBlocks.length >= 2 && megaBlockName.trim().length > 0;

  const handleCreateMegaBlock = useCallback(async () => {
    if (!canCreate) return;

    // TODO: Implement actual creation
    console.log("Creating Mega Block:", {
      name: megaBlockName,
      blocks: selectedBlocks,
    });
  }, [canCreate, megaBlockName, selectedBlocks]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading blocks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Builder</h1>
        <p className="text-muted-foreground">
          Combine multiple strategy blocks into a Mega Block for portfolio analysis
        </p>
      </div>

      {/* Top Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Selected Blocks */}
            <div className="space-y-2">
              <Label>Selected Blocks</Label>
              <div className="flex flex-wrap items-center gap-2">
                {selectedBlocks.map((block) => (
                  <Badge
                    key={block.blockId}
                    variant="secondary"
                    className="flex items-center gap-2 py-1.5 px-3"
                  >
                    <span className="font-medium">{block.name}</span>
                    <button
                      onClick={() => handleRemoveBlock(block.blockId)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Block
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Block to Portfolio</DialogTitle>
                      <DialogDescription>
                        Select a block to include in your Mega Block
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {availableBlocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No more blocks available to add
                        </p>
                      ) : (
                        availableBlocks.map((block) => (
                          <button
                            key={block.id}
                            onClick={() => handleAddBlock(block)}
                            className="w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors"
                          >
                            <div className="font-medium">{block.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {block.tradeLog.rowCount} trades
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Weights */}
            {selectedBlocks.length > 0 && (
              <div className="space-y-2">
                <Label>Weights</Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedBlocks.map((block) => (
                    <div
                      key={block.blockId}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
                    >
                      <span className="flex-1 text-sm font-medium truncate">
                        {block.name}
                      </span>
                      <Input
                        type="number"
                        value={block.weight}
                        onChange={(e) =>
                          handleWeightChange(
                            block.blockId,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 h-8 text-center"
                        min={0.1}
                        max={10}
                        step={0.1}
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1">
                <Input
                  placeholder="Mega Block name..."
                  value={megaBlockName}
                  onChange={(e) => setMegaBlockName(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button
                onClick={handleCreateMegaBlock}
                disabled={!canCreate}
                className="gap-2"
              >
                <Layers className="h-4 w-4" />
                Create Mega Block
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs - only show when blocks are selected */}
      {selectedBlocks.length >= 2 && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
            <TabsTrigger value="equity">Equity Curves</TabsTrigger>
            <TabsTrigger value="tail-risk">Tail Risk</TabsTrigger>
            <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Side-by-side metrics table and combined preview coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="correlation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Strategy correlation heatmap coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Equity Curves</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Overlaid equity curves coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tail-risk" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tail Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Tail risk analysis coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drawdowns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Drawdown Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Drawdown overlap analysis coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state */}
      {selectedBlocks.length < 2 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Select at least 2 blocks</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Add blocks using the button above to see comparison tools and create
              a Mega Block for portfolio analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify the page renders**

Run: `npm run dev` and navigate to `/portfolio-builder`
Expected: Page renders with header, controls, and empty state

**Step 3: Commit**

```bash
git add app/\(platform\)/portfolio-builder/page.tsx
git commit -m "feat: add Portfolio Builder page structure

- Top controls with block selector and weight inputs
- Tabbed layout for comparison tools (placeholder content)
- Add Block dialog for selecting blocks
- Create Mega Block button with validation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Portfolio Builder to Sidebar Navigation

**Files:**
- Modify: `components/app-sidebar.tsx`

**Step 1: Add navigation item**

Add to the `navMain` array in `components/app-sidebar.tsx`, after the "Block Management" entry:

```typescript
{
  title: "Portfolio Builder",
  href: "/portfolio-builder",
  icon: IconStack3,
  badge: "New",
},
```

Also add the import at the top:

```typescript
import {
  IconCalendar,
  IconChartHistogram,
  IconDatabase,
  IconGauge,
  IconLayoutDashboard,
  IconReportAnalytics,
  IconRouteSquare,
  IconSparkles,
  IconStack2,
  IconStack3, // Add this
  IconTimelineEvent,
  IconTrendingDown,
} from "@tabler/icons-react";
```

**Step 2: Verify navigation works**

Run: `npm run dev`
Expected: "Portfolio Builder" appears in sidebar with "New" badge, clicking navigates to the page

**Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat: add Portfolio Builder to sidebar navigation

- Added navigation item with IconStack3 icon
- Marked with 'New' badge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Tasks 9-20: Remaining Implementation

The remaining tasks follow the same pattern:

### Task 9: Overview Tab - Side-by-Side Metrics Table
Create `components/portfolio-builder/tabs/overview-tab.tsx` with metrics comparison table and combined preview.

### Task 10: Correlation Tab
Adapt existing correlation matrix for multi-block comparison in `components/portfolio-builder/tabs/correlation-tab.tsx`.

### Task 11: Equity Curves Tab
Create overlaid equity curves chart in `components/portfolio-builder/tabs/equity-curves-tab.tsx`.

### Task 12: Tail Risk Tab
Adapt existing tail risk analysis for multi-block in `components/portfolio-builder/tabs/tail-risk-tab.tsx`.

### Task 13: Drawdowns Tab
Create drawdown overlap analysis in `components/portfolio-builder/tabs/drawdowns-tab.tsx`.

### Task 14: Wire Create Button to Database
Implement actual Mega Block creation using `buildMegaBlockData` and save to IndexedDB.

### Task 15: Add Mega Block Icon to Blocks List
Update `BlockCard` and `BlockRow` components to show stacked-blocks icon for Mega Blocks.

### Task 16: Add "Build Mega Block" Button to Blocks Page
Add navigation button on `/blocks` page linking to Portfolio Builder.

### Task 17: Implement Edit Mode
Load existing Mega Block into Portfolio Builder for editing weights/composition.

### Task 18: Add Staleness Banner
Show warning when source blocks have been updated with refresh action.

### Task 19: Handle Source Block Deletion
Show incomplete warning when a source block is deleted.

### Task 20: Integration Tests
Write integration tests for the full Mega Block lifecycle.

---

## Summary

This plan provides the foundation for Mega Blocks:

1. **Model extensions** (Tasks 1-2): Add fields to ProcessedBlock, type guards
2. **Core logic** (Tasks 3-6): Trade scaling, merging, staleness detection, building
3. **UI structure** (Tasks 7-8): Portfolio Builder page and navigation
4. **Comparison tools** (Tasks 9-13): Five tabs with analysis visualizations
5. **Integration** (Tasks 14-20): Database operations, UI polish, editing

Each task is self-contained with TDD approach: write failing test, implement, verify, commit.
