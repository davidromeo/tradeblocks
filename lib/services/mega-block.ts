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
