import { Trade } from '@/lib/models/trade'

function scaleNumeric(value: number, factor: number): number {
  return Number.isFinite(value) ? value * factor : value
}

function sortTradesChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.dateClosed ?? a.dateOpened)
    const dateB = new Date(b.dateClosed ?? b.dateOpened)

    if (!isFinite(dateA.getTime()) || !isFinite(dateB.getTime())) {
      return 0
    }

    const diff = dateA.getTime() - dateB.getTime()
    if (diff !== 0) return diff

    const timeA = a.timeClosed ?? a.timeOpened
    const timeB = b.timeClosed ?? b.timeOpened
    return (timeA || '').localeCompare(timeB || '')
  })
}

function calculateInitialCapitalPerLot(trades: Trade[]): number {
  if (trades.length === 0) return 100_000

  const chronological = sortTradesChronologically(trades)
  const firstTrade = chronological[0]
  const capitalBeforeTrade = firstTrade.fundsAtClose - firstTrade.pl
  const contracts = Math.max(1, Math.abs(firstTrade.numContracts) || 1)
  const perLotCapital = capitalBeforeTrade / contracts

  if (!Number.isFinite(perLotCapital) || perLotCapital <= 0) {
    return 100_000
  }

  return perLotCapital
}

function normalizeTradeToOneLotInternal(trade: Trade): Trade {
  const contracts = Math.abs(trade.numContracts)
  if (!Number.isFinite(contracts) || contracts <= 1) {
    // Even if already 1 lot, convert cents to dollars if needed
    if (trade.premiumPrecision === 'cents' && trade.premium !== undefined) {
      return {
        ...trade,
        numContracts: 1,
        premium: trade.premium / 100,
        premiumPrecision: 'dollars',
      }
    }
    return {
      ...trade,
      numContracts: 1,
    }
  }

  const factor = 1 / contracts

  // Convert premium from cents to dollars if needed
  let scaledPremium = trade.premium
  let newPremiumPrecision = trade.premiumPrecision
  if (trade.premium !== undefined && trade.premiumPrecision === 'cents') {
    scaledPremium = trade.premium / 100
    newPremiumPrecision = 'dollars' as const
  }

  return {
    ...trade,
    pl: trade.pl * factor,
    marginReq: scaleNumeric(trade.marginReq, factor),
    openingCommissionsFees: scaleNumeric(trade.openingCommissionsFees, factor),
    closingCommissionsFees: scaleNumeric(trade.closingCommissionsFees, factor),
    numContracts: 1,
    // Premium per contract stays the same (just converted from cents to dollars if needed)
    ...(scaledPremium !== undefined && {
      premium: scaledPremium,
      premiumPrecision: newPremiumPrecision,
    }),
    // NOTE: maxProfit and maxLoss are PERCENTAGES, not dollar amounts.
    // They should NOT be scaled.
  }
}

export function normalizeTradeToOneLot(trade: Trade): Trade {
  return normalizeTradesToOneLot([trade])[0]
}

/**
 * Normalize a single trade to a target contract count.
 * Scales P&L, margin, and commissions proportionally.
 */
function normalizeTradeToContractsInternal(trade: Trade, targetContracts: number): Trade {
  const contracts = Math.abs(trade.numContracts)
  if (!Number.isFinite(contracts) || contracts === 0) {
    return {
      ...trade,
      numContracts: targetContracts,
    }
  }

  // If already at target, no scaling needed
  if (contracts === targetContracts) {
    return trade
  }

  const factor = targetContracts / contracts

  // Handle premium scaling carefully:
  // - Premium is stored as per-contract value
  // - When scaling, we need to preserve the total premium relationship
  // - If premium is in cents, convert to dollars per contract after scaling
  //   to avoid fractional cents issues in downstream calculations
  let scaledPremium = trade.premium
  let newPremiumPrecision = trade.premiumPrecision
  if (trade.premium !== undefined) {
    if (trade.premiumPrecision === 'cents') {
      // Convert cents to dollars first, then the per-contract value is preserved
      // Original: premium in cents per contract
      // After: premium in dollars per contract (same dollar amount per contract)
      // The scaling factor doesn't change per-contract premium, only total exposure
      scaledPremium = trade.premium / 100  // Convert to dollars per contract
      newPremiumPrecision = 'dollars' as const
    }
    // Note: premium per contract stays the same regardless of position size
    // Only total exposure changes (via numContracts)
  }

  return {
    ...trade,
    pl: trade.pl * factor,
    marginReq: scaleNumeric(trade.marginReq, factor),
    openingCommissionsFees: scaleNumeric(trade.openingCommissionsFees, factor),
    closingCommissionsFees: scaleNumeric(trade.closingCommissionsFees, factor),
    numContracts: targetContracts,
    // Premium per contract stays the same (just converted from cents to dollars if needed)
    ...(scaledPremium !== undefined && {
      premium: scaledPremium,
      premiumPrecision: newPremiumPrecision,
    }),
    // NOTE: maxProfit and maxLoss are PERCENTAGES, not dollar amounts.
    // They represent % of initial premium and should NOT be scaled.
    // The efficiency calculation uses: mfe = (maxProfit / 100) * totalPremium
    // Since totalPremium is already scaled, the percentage stays the same.
  }
}

/**
 * Normalize all trades to a target contract count.
 * Each trade is scaled individually based on its actual contract count.
 * Also recalculates fundsAtClose to maintain a consistent equity curve.
 *
 * @param trades - Array of trades to normalize
 * @param targetContracts - Target number of contracts (default: 1)
 * @returns Normalized trades with recalculated equity curve
 */
export function normalizeTradesToContracts(trades: Trade[], targetContracts: number = 1): Trade[] {
  if (trades.length === 0) return []

  const normalized = trades.map((trade) => normalizeTradeToContractsInternal(trade, targetContracts))

  const chronological = trades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => {
      const dateA = new Date(a.trade.dateClosed ?? a.trade.dateOpened)
      const dateB = new Date(b.trade.dateClosed ?? b.trade.dateOpened)

      if (!isFinite(dateA.getTime()) || !isFinite(dateB.getTime())) {
        return 0
      }

      const diff = dateA.getTime() - dateB.getTime()
      if (diff !== 0) return diff

      const timeA = a.trade.timeClosed ?? a.trade.timeOpened
      const timeB = b.trade.timeClosed ?? b.trade.timeOpened
      return (timeA || '').localeCompare(timeB || '')
    })

  const initialCapitalPerLot = calculateInitialCapitalPerLot(trades)
  // Scale initial capital proportionally to target contracts
  let runningEquity = initialCapitalPerLot * targetContracts

  chronological.forEach(({ index }) => {
    const normalizedTrade = normalized[index]
    runningEquity += normalizedTrade.pl
    normalizedTrade.fundsAtClose = runningEquity
  })

  return normalized
}

export function normalizeTradesToOneLot(trades: Trade[]): Trade[] {
  if (trades.length === 0) return []

  const normalized = trades.map((trade) => normalizeTradeToOneLotInternal(trade))

  const chronological = trades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => {
      const dateA = new Date(a.trade.dateClosed ?? a.trade.dateOpened)
      const dateB = new Date(b.trade.dateClosed ?? b.trade.dateOpened)

      if (!isFinite(dateA.getTime()) || !isFinite(dateB.getTime())) {
        return 0
      }

      const diff = dateA.getTime() - dateB.getTime()
      if (diff !== 0) return diff

      const timeA = a.trade.timeClosed ?? a.trade.timeOpened
      const timeB = b.trade.timeClosed ?? b.trade.timeOpened
      return (timeA || '').localeCompare(timeB || '')
    })

  const initialCapitalPerLot = calculateInitialCapitalPerLot(trades)
  let runningEquity = initialCapitalPerLot

  chronological.forEach(({ index }) => {
    const normalizedTrade = normalized[index]
    runningEquity += normalizedTrade.pl
    normalizedTrade.fundsAtClose = runningEquity
  })

  return normalized
}
