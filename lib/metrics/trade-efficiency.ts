/**
 * Trade Efficiency Metrics - FIXED VERSION
 * 
 * This version correctly handles DEBIT strategies (inverted iron condors)
 * where max profit/loss values are already in dollars and should NOT
 * be multiplied by 100.
 */

import { Trade } from '@/lib/models/trade'

/**
 * Standard options multiplier used to convert per-contract values into notional dollars.
 * Equity and index option contracts typically control 100 shares, so premium/max profit
 * values need to be scaled by 100 to reflect the total economic exposure.
 */
const OPTION_CONTRACT_MULTIPLIER = 100

/**
 * Margin-to-notional ratio threshold that indicates a trade is lightly margined.
 * When gross notional is less than 50% of the posted margin requirement we treat
 * the trade as an option-style structure and apply the contract multiplier.
 */
const MARGIN_RATIO_THRESHOLD = 0.5

/**
 * Notional dollar threshold under which trades are considered "small". These trades
 * likely represent single-lot option structures, so we apply the option multiplier
 * even if there is no explicit margin requirement to compare against.
 */
const SMALL_NOTIONAL_THRESHOLD = 5_000

/**
 * Maximum reasonable ratio of max profit/loss to margin requirement.
 * If applying the multiplier would exceed this, the values are likely already in dollars.
 */
const MAX_REASONABLE_RATIO = 1.5

function getNormalizedContractCount(trade: Trade): number {
  const contracts = typeof trade.numContracts === 'number' && isFinite(trade.numContracts)
    ? Math.abs(trade.numContracts)
    : 0

  return contracts > 0 ? contracts : 1
}

/**
 * FIXED: Apply option multiplier only when appropriate
 * 
 * For DEBIT strategies (inverted iron condors, long options):
 *   - Premium is negative
 *   - Max profit/loss are already in dollars from Option Omega
 *   - Should NOT multiply by 100
 * 
 * For CREDIT strategies (regular iron condors, credit spreads):
 *   - Premium is positive
 *   - Max profit/loss may need 100x multiplier
 */
function applyOptionMultiplierIfNeeded(total: number, trade: Trade, isMaxProfitLoss: boolean = false): number {
  if (!isFinite(total) || total <= 0) {
    return total
  }

  const margin = typeof trade.marginReq === 'number' && isFinite(trade.marginReq)
    ? Math.abs(trade.marginReq)
    : undefined

  // NEW: For debit strategies, max profit/loss are already in dollars
  // Don't apply multiplier if premium is negative
  if (isMaxProfitLoss && typeof trade.premium === 'number' && trade.premium < 0) {
    return total
  }

  if (margin && margin > 0) {
    const ratio = total / margin
    if (ratio > 0 && ratio < MARGIN_RATIO_THRESHOLD) {
      const scaledTotal = total * OPTION_CONTRACT_MULTIPLIER
      const scaledRatio = scaledTotal / margin
      
      // NEW: Sanity check - only apply multiplier if result is reasonable
      // If scaled value would greatly exceed margin, original is probably correct
      if (scaledRatio <= MAX_REASONABLE_RATIO) {
        return scaledTotal
      }
      return total
    }
    return total
  }

  if (total < SMALL_NOTIONAL_THRESHOLD) {
    return total * OPTION_CONTRACT_MULTIPLIER
  }

  return total
}

function normalisePerContractValue(value: number, trade: Trade, isPremium: boolean, isMaxProfitLoss: boolean = false): number {
  const contracts = getNormalizedContractCount(trade)
  let base = Math.abs(value)

  if (isPremium && trade.premiumPrecision === 'cents') {
    base = base / 100
  }

  const total = base * contracts
  return applyOptionMultiplierIfNeeded(total, trade, isMaxProfitLoss)
}

export function computeTotalPremium(trade: Trade): number | undefined {
  if (typeof trade.premium !== 'number' || !isFinite(trade.premium)) {
    return undefined
  }

  const total = normalisePerContractValue(Math.abs(trade.premium), trade, true, false)
  return isFinite(total) && total > 0 ? total : undefined
}

export function computeTotalMaxProfit(trade: Trade): number | undefined {
  if (typeof trade.maxProfit !== 'number' || !isFinite(trade.maxProfit) || trade.maxProfit === 0) {
    return undefined
  }

  // FIXED: Pass true to indicate this is max profit/loss value
  const total = normalisePerContractValue(Math.abs(trade.maxProfit), trade, false, true)
  return isFinite(total) && total > 0 ? total : undefined
}

export function computeTotalMaxLoss(trade: Trade): number | undefined {
  if (typeof trade.maxLoss !== 'number' || !isFinite(trade.maxLoss) || trade.maxLoss === 0) {
    return undefined
  }

  // FIXED: Pass true to indicate this is max profit/loss value  
  const total = normalisePerContractValue(Math.abs(trade.maxLoss), trade, false, true)
  return isFinite(total) && total > 0 ? total : undefined
}

export type EfficiencyBasis = 'premium' | 'maxProfit' | 'margin' | 'unknown'

export interface PremiumEfficiencyResult {
  percentage?: number
  denominator?: number
  basis: EfficiencyBasis
}

/**
 * Calculates a trade's premium efficiency percentage.
 *
 * The function searches for the most appropriate denominator to express trade performance:
 * 1. Total premium collected (preferred when available)
 * 2. Total maximum profit
 * 3. Margin requirement
 *
 * Once a denominator is selected, it normalizes the trade's P/L against that value to
 * compute an efficiency percentage. If no denominator can be derived or the resulting
 * ratio is not finite, only the basis is reported.
 *
 * @param trade Trade record including premium, max profit, margin requirement, and P/L.
 * @returns Object describing the efficiency percentage, denominator, and basis used.
 */
export function calculatePremiumEfficiencyPercent(trade: Trade): PremiumEfficiencyResult {
  const totalPremium = computeTotalPremium(trade)
  const totalMaxProfit = computeTotalMaxProfit(trade)
  const margin = typeof trade.marginReq === 'number' && isFinite(trade.marginReq) && trade.marginReq !== 0
    ? Math.abs(trade.marginReq)
    : undefined

  let denominator: number | undefined
  let basis: EfficiencyBasis = 'unknown'

  if (totalPremium && totalPremium > 0) {
    denominator = totalPremium
    basis = 'premium'
  } else if (totalMaxProfit && totalMaxProfit > 0) {
    denominator = totalMaxProfit
    basis = 'maxProfit'
  } else if (margin && margin > 0) {
    denominator = margin
    basis = 'margin'
  }

  if (!denominator || denominator === 0) {
    return { basis }
  }

  const percentage = (trade.pl / denominator) * 100

  if (!isFinite(percentage)) {
    return { basis }
  }

  return {
    percentage,
    denominator,
    basis
  }
}
