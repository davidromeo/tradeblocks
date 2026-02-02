/**
 * Shared Filter Utilities
 *
 * Common filtering functions used across block and report tools.
 */

import type { Trade } from "@tradeblocks/lib";

/**
 * Filter trades by strategy name (case-insensitive)
 */
export function filterByStrategy(trades: Trade[], strategy?: string): Trade[] {
  if (!strategy) return trades;
  return trades.filter(
    (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
  );
}

/**
 * Filter trades by date range
 */
export function filterByDateRange(
  trades: Trade[],
  startDate?: string,
  endDate?: string
): Trade[] {
  let filtered = trades;

  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      filtered = filtered.filter((t) => new Date(t.dateOpened) >= start);
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      // Include entire end date
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => new Date(t.dateOpened) <= end);
    }
  }

  return filtered;
}
