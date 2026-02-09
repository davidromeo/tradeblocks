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
 * Format a Date to YYYY-MM-DD in Eastern Time for string comparison.
 * Trades are stored in Eastern Time, so we compare calendar dates in that timezone.
 */
function toEasternDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Filter trades by date range using string comparison on Eastern Time calendar dates.
 * Avoids timezone bugs from mixing UTC Date parsing with local time setHours.
 */
export function filterByDateRange(
  trades: Trade[],
  startDate?: string,
  endDate?: string
): Trade[] {
  let filtered = trades;

  if (startDate) {
    filtered = filtered.filter((t) => toEasternDateStr(new Date(t.dateOpened)) >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((t) => toEasternDateStr(new Date(t.dateOpened)) <= endDate);
  }

  return filtered;
}

/**
 * Filter daily log entries by date range using string comparison on Eastern Time calendar dates.
 * Mirrors filterByDateRange but uses entry.date (Date object) instead of t.dateOpened.
 */
export function filterDailyLogsByDateRange(
  dailyLogs: DailyLogEntry[],
  startDate?: string,
  endDate?: string
): DailyLogEntry[] {
  let filtered = dailyLogs;

  if (startDate) {
    filtered = filtered.filter((entry) => toEasternDateStr(new Date(entry.date)) >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((entry) => toEasternDateStr(new Date(entry.date)) <= endDate);
  }

  return filtered;
}
