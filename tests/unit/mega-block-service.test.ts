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
