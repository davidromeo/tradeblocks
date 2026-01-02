// tests/unit/mega-block-service.test.ts
import { Trade } from '@/lib/models/trade';
import { ProcessedBlock } from '@/lib/models/block';
import {
  scaleTradeByWeight,
  mergeAndScaleTrades,
  checkMegaBlockStaleness,
  buildMegaBlockData,
} from '@/lib/services/mega-block';
import { SourceBlockRef } from '@/lib/models/mega-block';

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

  it('preserves premium per contract (does not scale)', () => {
    // Premium is a per-contract value and should NOT be scaled.
    // Total exposure changes via numContracts, not premium.
    const scaled = scaleTradeByWeight(baseTrade, 2.0);
    expect(scaled.premium).toBe(2.5); // Same as original
    expect(scaled.numContracts).toBe(2); // Contracts are scaled
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

  it('converts cents premium to dollars when scaling', () => {
    const tradeWithCents: Trade = {
      ...baseTrade,
      premium: 250, // 250 cents = $2.50 per contract
      premiumPrecision: 'cents',
    };
    const scaled = scaleTradeByWeight(tradeWithCents, 2.0);
    // Premium should be converted from cents to dollars
    expect(scaled.premium).toBe(2.5); // 250 cents / 100 = $2.50
    expect(scaled.premiumPrecision).toBe('dollars');
  });

  it('does not scale maxProfit and maxLoss (they are percentages)', () => {
    const tradeWithMax: Trade = {
      ...baseTrade,
      maxProfit: 18.67, // percentage of premium
      maxLoss: -12.65,  // percentage of premium
    };
    const scaled = scaleTradeByWeight(tradeWithMax, 2.0);
    // maxProfit and maxLoss are percentages and should NOT be scaled
    expect(scaled.maxProfit).toBe(18.67);
    expect(scaled.maxLoss).toBe(-12.65);
  });
});

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
    const stratATraces = merged.filter((t) => t.strategy === 'Strategy A');
    expect(stratATraces[0].pl).toBe(200.0); // 100 * 2
    expect(stratATraces[0].numContracts).toBe(2);

    // Strategy B trades should be scaled by 1.0 (no change)
    const stratBTraces = merged.filter((t) => t.strategy === 'Strategy B');
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
        tradeLog: {
          fileName: 'a.csv',
          fileSize: 100,
          originalRowCount: 10,
          processedRowCount: 10,
          uploadedAt: new Date(),
        },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-a' },
        analysisConfig: {
          riskFreeRate: 2,
          useBusinessDaysOnly: true,
          annualizationFactor: 252,
          confidenceLevel: 0.95,
        },
      },
      {
        id: 'b',
        name: 'Block B',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 100000), // Same as recorded
        tradeLog: {
          fileName: 'b.csv',
          fileSize: 100,
          originalRowCount: 10,
          processedRowCount: 10,
          uploadedAt: new Date(),
        },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-b' },
        analysisConfig: {
          riskFreeRate: 2,
          useBusinessDaysOnly: true,
          annualizationFactor: 252,
          confidenceLevel: 0.95,
        },
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
        tradeLog: {
          fileName: 'a.csv',
          fileSize: 100,
          originalRowCount: 10,
          processedRowCount: 10,
          uploadedAt: new Date(),
        },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-a' },
        analysisConfig: {
          riskFreeRate: 2,
          useBusinessDaysOnly: true,
          annualizationFactor: 252,
          confidenceLevel: 0.95,
        },
      },
      {
        id: 'b',
        name: 'Block B',
        isActive: false,
        created: new Date(now - 200000),
        lastModified: new Date(now - 100000),
        tradeLog: {
          fileName: 'b.csv',
          fileSize: 100,
          originalRowCount: 10,
          processedRowCount: 10,
          uploadedAt: new Date(),
        },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-b' },
        analysisConfig: {
          riskFreeRate: 2,
          useBusinessDaysOnly: true,
          annualizationFactor: 252,
          confidenceLevel: 0.95,
        },
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
        tradeLog: {
          fileName: 'a.csv',
          fileSize: 100,
          originalRowCount: 10,
          processedRowCount: 10,
          uploadedAt: new Date(),
        },
        processingStatus: 'completed',
        dataReferences: { tradesStorageKey: 'trades-a' },
        analysisConfig: {
          riskFreeRate: 2,
          useBusinessDaysOnly: true,
          annualizationFactor: 252,
          confidenceLevel: 0.95,
        },
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
      tradeLog: {
        fileName: 'r.csv',
        fileSize: 100,
        originalRowCount: 10,
        processedRowCount: 10,
        uploadedAt: new Date(),
      },
      processingStatus: 'completed',
      dataReferences: { tradesStorageKey: 'trades-r' },
      analysisConfig: {
        riskFreeRate: 2,
        useBusinessDaysOnly: true,
        annualizationFactor: 252,
        confidenceLevel: 0.95,
      },
    };

    const result = checkMegaBlockStaleness(regularBlock, []);
    expect(result.isStale).toBe(false);
  });
});

describe('buildMegaBlockData', () => {
  const now = Date.now();

  const blockA: ProcessedBlock = {
    id: 'a',
    name: 'Strategy A',
    isActive: false,
    created: new Date(now - 200000),
    lastModified: new Date(now - 100000),
    tradeLog: {
      fileName: 'a.csv',
      fileSize: 100,
      originalRowCount: 10,
      processedRowCount: 10,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-a' },
    analysisConfig: {
      riskFreeRate: 2,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
  };

  const blockB: ProcessedBlock = {
    id: 'b',
    name: 'Strategy B',
    isActive: false,
    created: new Date(now - 200000),
    lastModified: new Date(now - 50000),
    tradeLog: {
      fileName: 'b.csv',
      fileSize: 100,
      originalRowCount: 10,
      processedRowCount: 10,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-b' },
    analysisConfig: {
      riskFreeRate: 2,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
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
