// lib/services/mega-block.ts
import { Trade } from '../models/trade';
import { SourceBlockRef } from '../models/mega-block';

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
