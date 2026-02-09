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
 * Validate that a date string is in YYYY-MM-DD format.
 * Returns the string if valid, undefined if not (skips that filter boundary).
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validateDateParam(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return DATE_RE.test(date) ? date : undefined;
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
 * Malformed date inputs (not YYYY-MM-DD) are silently ignored.
 */
export function filterByDateRange(
  trades: Trade[],
  startDate?: string,
  endDate?: string
): Trade[] {
  const start = validateDateParam(startDate);
  const end = validateDateParam(endDate);
  let filtered = trades;

  if (start) {
    filtered = filtered.filter((t) => toEasternDateStr(new Date(t.dateOpened)) >= start);
  }

  if (end) {
    filtered = filtered.filter((t) => toEasternDateStr(new Date(t.dateOpened)) <= end);
  }

  return filtered;
}

/**
 * Filter daily log entries by date range using string comparison on Eastern Time calendar dates.
 * Mirrors filterByDateRange but uses entry.date (Date object) instead of t.dateOpened.
 * Malformed date inputs (not YYYY-MM-DD) are silently ignored.
 */
export function filterDailyLogsByDateRange(
  dailyLogs: DailyLogEntry[],
  startDate?: string,
  endDate?: string
): DailyLogEntry[] {
  const start = validateDateParam(startDate);
  const end = validateDateParam(endDate);
  let filtered = dailyLogs;

  if (start) {
    filtered = filtered.filter((entry) => toEasternDateStr(new Date(entry.date)) >= start);
  }

  if (end) {
    filtered = filtered.filter((entry) => toEasternDateStr(new Date(entry.date)) <= end);
  }

  return filtered;
}
