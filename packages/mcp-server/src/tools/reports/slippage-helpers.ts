/**
 * Slippage Analysis Helpers
 *
 * Re-exports from @tradeblocks/lib. All trade matching and scaling logic
 * has been consolidated into packages/lib/calculations/trade-matching.ts.
 *
 * This file preserves existing import paths for MCP server consumers.
 */

export {
  formatDateKey,
  truncateTimeToMinute,
  parseHourFromTime,
  getIsoWeekKey,
  getMonthKey,
  type MatchedTradeData,
  applyDateRangeFilter,
  applyStrategyFilter,
  calculateScaledPl,
  matchTrades,
} from "@tradeblocks/lib";
