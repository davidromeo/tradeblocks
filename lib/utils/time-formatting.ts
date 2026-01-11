/**
 * Time of Day Formatting Utilities
 *
 * Utilities for formatting time-of-day values (minutes since midnight)
 * as readable times and generating axis tick labels.
 */

/**
 * Format minutes since midnight as readable time (e.g., "11:45 AM ET")
 *
 * @param minutes - Minutes since midnight (0-1439)
 * @param includeTimezone - Whether to include "ET" suffix (default: true)
 * @returns Formatted time string like "11:45 AM ET"
 */
export function formatMinutesToTime(minutes: number, includeTimezone = true): string {
  // Handle wrap-around: normalize to [0, 1440) for both negative and overflow values
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440
  // Round first, then extract hours/mins to avoid "10:60" edge case
  const totalMinutesRounded = Math.round(normalizedMinutes)
  const hours = Math.floor(totalMinutesRounded / 60)
  const mins = totalMinutesRounded % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  const time = `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`
  return includeTimezone ? `${time} ET` : time
}

/**
 * Generate tick values and labels for time of day axis (every hour)
 *
 * @param min - Minimum time in minutes
 * @param max - Maximum time in minutes
 * @param includeTimezone - Whether to include "ET" suffix in labels (default: true)
 * @returns Object with tickvals (numbers) and ticktext (formatted strings)
 */
export function generateTimeAxisTicks(
  min: number,
  max: number,
  includeTimezone = true
): { tickvals: number[]; ticktext: string[] } {
  const tickvals: number[] = []
  const ticktext: string[] = []

  // Start at the first full hour at or after min
  const startHour = Math.ceil(min / 60)
  const endHour = Math.floor(max / 60)

  for (let hour = startHour; hour <= endHour; hour++) {
    const minutes = hour * 60
    tickvals.push(minutes)
    ticktext.push(formatMinutesToTime(minutes, includeTimezone))
  }

  return { tickvals, ticktext }
}

/**
 * Generate time axis ticks from an array of time values.
 * Convenience wrapper that computes min/max from data and generates ticks.
 *
 * @param values - Array of time values in minutes since midnight
 * @param includeTimezone - Whether to include "ET" suffix in labels (default: true)
 * @returns Object with tickvals and ticktext, or null if values is empty
 */
export function generateTimeAxisTicksFromData(
  values: number[],
  includeTimezone = true
): { tickvals: number[]; ticktext: string[] } | null {
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  return generateTimeAxisTicks(min, max, includeTimezone)
}

/**
 * Generate tick values for time axis at larger intervals (e.g., every 2 hours)
 * Useful for charts with limited horizontal space
 *
 * @param min - Minimum time in minutes
 * @param max - Maximum time in minutes
 * @param intervalHours - Hours between ticks (default: 2)
 * @param includeTimezone - Whether to include "ET" suffix in labels (default: false for compact display)
 * @returns Object with tickvals (numbers) and ticktext (formatted strings)
 */
export function generateTimeAxisTicksWithInterval(
  min: number,
  max: number,
  intervalHours = 2,
  includeTimezone = false
): { tickvals: number[]; ticktext: string[] } {
  const tickvals: number[] = []
  const ticktext: string[] = []

  // Normalize min to handle negative values, then find the nearest interval mark
  const normalizedMin = Math.max(0, min)
  const intervalMinutes = intervalHours * 60
  const startHour = Math.floor(normalizedMin / intervalMinutes) * intervalHours
  const endHour = Math.floor(max / 60)

  for (let hour = startHour; hour <= endHour; hour += intervalHours) {
    const minutes = hour * 60
    if (minutes >= min && minutes <= max) {
      tickvals.push(minutes)
      ticktext.push(formatMinutesToTime(minutes, includeTimezone))
    }
  }

  return { tickvals, ticktext }
}
