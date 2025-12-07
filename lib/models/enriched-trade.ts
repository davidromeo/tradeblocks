/**
 * Enriched Trade Model
 *
 * Extends the base Trade interface with pre-computed derived fields
 * for use in the Report Builder and other analysis components.
 */

import { Trade } from './trade'

/**
 * Trade with all derived/calculated fields pre-computed
 */
export interface EnrichedTrade extends Trade {
  // MFE/MAE metrics (from calculateMFEMAEData)
  mfePercent?: number           // MFE as % of premium/margin
  maePercent?: number           // MAE as % of premium/margin
  profitCapturePercent?: number // P/L / MFE * 100 - what % of peak profit was captured
  excursionRatio?: number       // MFE / MAE (reward/risk ratio)
  shortLongRatioChange?: number // Closing SLR / Opening SLR
  shortLongRatioChangePct?: number // SLR % change

  // Return metrics
  rom?: number                  // Return on Margin (P/L / margin * 100)
  premiumEfficiency?: number    // P/L / premium * 100

  // Timing
  durationHours?: number        // Holding period in hours
  dayOfWeek?: number            // 0-6 (Sun-Sat) when trade was opened
  hourOfDay?: number            // 0-23 when trade was opened

  // Costs & Net
  totalFees?: number            // Opening + closing fees
  netPl?: number                // P/L after fees

  // VIX changes
  vixChange?: number            // Closing VIX - Opening VIX
  vixChangePct?: number         // VIX % change

  // Risk metrics
  rMultiple?: number            // P/L / MAE (risk multiples won/lost)
  isWinner?: number             // 1 if win, 0 if loss (for aggregations)

  // Sequential
  tradeNumber?: number          // 1-indexed trade sequence
}
