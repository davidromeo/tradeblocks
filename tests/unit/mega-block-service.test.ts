// tests/unit/mega-block-service.test.ts
import { Trade } from '@/lib/models/trade';
import { scaleTradeByWeight, mergeAndScaleTrades } from '@/lib/services/mega-block';
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
