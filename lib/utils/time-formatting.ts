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
  // Handle 24:00 (1440 minutes) and values beyond by wrapping to valid range
  const normalizedMinutes = minutes % 1440
  const hours = Math.floor(normalizedMinutes / 60)
  const mins = Math.round(normalizedMinutes % 60)
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

  // Start from the nearest interval mark
  const intervalMinutes = intervalHours * 60
  const startHour = Math.floor(min / intervalMinutes) * intervalHours

  for (let hour = startHour; hour * 60 <= max; hour += intervalHours) {
    const minutes = hour * 60
    if (minutes >= min && minutes <= max) {
      tickvals.push(minutes)
      ticktext.push(formatMinutesToTime(minutes, includeTimezone))
    }
  }

  return { tickvals, ticktext }
}
