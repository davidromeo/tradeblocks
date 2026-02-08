/**
 * Shared Filter Utilities
 *
 * Common filtering functions used across block and report tools.
 */

import type { Trade, DailyLogEntry } from "@tradeblocks/lib";

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

/**
 * Filter daily log entries by date range
 * Mirrors filterByDateRange but uses entry.date (Date object) instead of t.dateOpened
 */
export function filterDailyLogsByDateRange(
  dailyLogs: DailyLogEntry[],
  startDate?: string,
  endDate?: string
): DailyLogEntry[] {
  let filtered = dailyLogs;

  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      filtered = filtered.filter((entry) => new Date(entry.date) >= start);
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      // Include entire end date
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((entry) => new Date(entry.date) <= end);
    }
  }

  return filtered;
}
