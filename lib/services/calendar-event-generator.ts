/**
 * Calendar Event Generator
 *
 * Generates calendar event data for common trading events like FOMC meetings,
 * economic data releases, options expiration, and short weeks.
 */

import type { CalendarEvent, CalendarEventType } from '@/lib/models/calendar-event'

/**
 * Generate FOMC meeting dates
 * Based on typical FOMC schedule: 8 meetings per year, roughly every 6 weeks
 * These are approximate dates and should be verified against actual FOMC calendar
 */
export function generateFOMCMeetings(year: number): CalendarEvent[] {
  // Typical FOMC meeting months (8 per year)
  // Usually: Jan/Feb, March, May, June, July, Sept, Oct/Nov, Dec
  const meetingMonths = [
    { month: 0, day: 31 },  // Jan/Feb (last day of January)
    { month: 2, day: 20 },  // March (mid-month)
    { month: 4, day: 1 },   // May (early month)
    { month: 5, day: 13 },  // June (mid-month)
    { month: 6, day: 27 },  // July (late month)
    { month: 8, day: 20 },  // September (mid-month)
    { month: 10, day: 1 },  // Nov (early month)
    { month: 11, day: 13 }, // December (mid-month)
  ]

  return meetingMonths.map((meeting, index) => ({
    id: `fomc-${year}-${index + 1}`,
    type: 'fomc_meeting' as CalendarEventType,
    name: `FOMC Meeting ${index + 1}/${meetingMonths.length} ${year}`,
    date: new Date(year, meeting.month, meeting.day),
    impact: 'high' as const,
  }))
}

/**
 * Generate Non-Farm Payroll release dates
 * Released first Friday of each month at 8:30 AM ET
 */
export function generateNonFarmPayrollDates(year: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (let month = 0; month < 12; month++) {
    // Find first Friday of the month
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    
    // Calculate days until Friday (5)
    let daysUntilFriday = 5 - firstDayOfWeek
    if (daysUntilFriday < 0) daysUntilFriday += 7
    
    const nfpDate = new Date(year, month, 1 + daysUntilFriday)

    events.push({
      id: `nfp-${year}-${month + 1}`,
      type: 'nonfarm_payroll',
      name: `Non-Farm Payroll ${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`,
      date: nfpDate,
      impact: 'high',
    })
  }

  return events
}

/**
 * Generate CPI release dates
 * Released mid-month (typically around the 13th-15th) at 8:30 AM ET
 */
export function generateCPIReleaseDates(year: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (let month = 0; month < 12; month++) {
    // CPI typically released around 13th-15th of month
    const cpiDate = new Date(year, month, 13)

    events.push({
      id: `cpi-${year}-${month + 1}`,
      type: 'cpi_release',
      name: `CPI Release ${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`,
      date: cpiDate,
      impact: 'high',
    })
  }

  return events
}

/**
 * Generate options expiration dates
 * Third Friday of each month (monthly expiration)
 */
export function generateOptionsExpirationDates(year: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (let month = 0; month < 12; month++) {
    // Find third Friday of the month
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    
    // Calculate days until first Friday
    let daysUntilFriday = 5 - firstDayOfWeek
    if (daysUntilFriday < 0) daysUntilFriday += 7
    
    // Third Friday is first Friday + 14 days
    const expirationDate = new Date(year, month, 1 + daysUntilFriday + 14)

    events.push({
      id: `opex-${year}-${month + 1}`,
      type: 'option_expiration',
      name: `Options Expiration ${new Date(year, month).toLocaleString('default', { month: 'short' })} ${year}`,
      date: expirationDate,
      impact: 'medium',
    })
  }

  return events
}

/**
 * Generate US market holidays
 */
export function generateUSHolidays(year: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // New Year's Day - January 1 (observed)
  const newYearsDay = new Date(year, 0, 1)
  const newYearsDayObserved = adjustForWeekend(newYearsDay)
  events.push({
    id: `holiday-${year}-newyears`,
    type: 'holiday',
    name: "New Year's Day",
    date: newYearsDayObserved,
    impact: 'high',
  })

  // Martin Luther King Jr. Day - Third Monday in January
  events.push({
    id: `holiday-${year}-mlk`,
    type: 'holiday',
    name: 'Martin Luther King Jr. Day',
    date: getNthWeekdayOfMonth(year, 0, 1, 3),
    impact: 'medium',
  })

  // Presidents' Day - Third Monday in February
  events.push({
    id: `holiday-${year}-presidents`,
    type: 'holiday',
    name: "Presidents' Day",
    date: getNthWeekdayOfMonth(year, 1, 1, 3),
    impact: 'medium',
  })

  // Good Friday - Friday before Easter (calculated)
  const easter = calculateEaster(year)
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)
  events.push({
    id: `holiday-${year}-goodfriday`,
    type: 'holiday',
    name: 'Good Friday',
    date: goodFriday,
    impact: 'high',
  })

  // Memorial Day - Last Monday in May
  events.push({
    id: `holiday-${year}-memorial`,
    type: 'holiday',
    name: 'Memorial Day',
    date: getLastWeekdayOfMonth(year, 4, 1),
    impact: 'medium',
  })

  // Juneteenth - June 19 (observed)
  const juneteenth = new Date(year, 5, 19)
  const juneteenthObserved = adjustForWeekend(juneteenth)
  events.push({
    id: `holiday-${year}-juneteenth`,
    type: 'holiday',
    name: 'Juneteenth',
    date: juneteenthObserved,
    impact: 'medium',
  })

  // Independence Day - July 4 (observed)
  const july4 = new Date(year, 6, 4)
  const july4Observed = adjustForWeekend(july4)
  events.push({
    id: `holiday-${year}-july4`,
    type: 'holiday',
    name: 'Independence Day',
    date: july4Observed,
    impact: 'high',
  })

  // Labor Day - First Monday in September
  events.push({
    id: `holiday-${year}-labor`,
    type: 'holiday',
    name: 'Labor Day',
    date: getNthWeekdayOfMonth(year, 8, 1, 1),
    impact: 'medium',
  })

  // Thanksgiving - Fourth Thursday in November
  events.push({
    id: `holiday-${year}-thanksgiving`,
    type: 'holiday',
    name: 'Thanksgiving',
    date: getNthWeekdayOfMonth(year, 10, 4, 4),
    impact: 'high',
  })

  // Christmas - December 25 (observed)
  const christmas = new Date(year, 11, 25)
  const christmasObserved = adjustForWeekend(christmas)
  events.push({
    id: `holiday-${year}-christmas`,
    type: 'holiday',
    name: 'Christmas',
    date: christmasObserved,
    impact: 'high',
  })

  return events
}

/**
 * Generate short week identifiers
 * A short week is defined as a week with one or more holidays
 */
export function generateShortWeeks(year: number): CalendarEvent[] {
  const holidays = generateUSHolidays(year)
  const shortWeeks: CalendarEvent[] = []
  const processedWeeks = new Set<string>()

  holidays.forEach(holiday => {
    // Get the Monday of the week containing this holiday
    const holidayDate = new Date(holiday.date)
    const dayOfWeek = holidayDate.getDay()
    const monday = new Date(holidayDate)
    monday.setDate(holidayDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))

    // Create a unique key for this week
    const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`

    // Only add each short week once
    if (!processedWeeks.has(weekKey)) {
      processedWeeks.add(weekKey)

      // Calculate Friday of this week
      const friday = new Date(monday)
      friday.setDate(monday.getDate() + 4)

      shortWeeks.push({
        id: `shortweek-${weekKey}`,
        type: 'short_week',
        name: `Short Week (${holiday.name})`,
        date: monday,
        endDate: friday,
        impact: 'high',
        metadata: {
          holiday: holiday.name,
          holidayDate: holiday.date,
        },
      })
    }
  })

  return shortWeeks
}

/**
 * Helper: Get the Nth occurrence of a weekday in a month
 * @param year - Year
 * @param month - Month (0-11)
 * @param weekday - Day of week (0=Sunday, 1=Monday, etc.)
 * @param n - Which occurrence (1=first, 2=second, etc.)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  
  let daysUntilWeekday = weekday - firstWeekday
  if (daysUntilWeekday < 0) daysUntilWeekday += 7
  
  const date = 1 + daysUntilWeekday + (n - 1) * 7
  return new Date(year, month, date)
}

/**
 * Helper: Get the last occurrence of a weekday in a month
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  // Start with last day of month
  const lastDay = new Date(year, month + 1, 0)
  const lastWeekday = lastDay.getDay()
  
  let daysBack = lastWeekday - weekday
  if (daysBack < 0) daysBack += 7
  
  return new Date(year, month, lastDay.getDate() - daysBack)
}

/**
 * Helper: Adjust holiday to nearest weekday if it falls on weekend
 */
function adjustForWeekend(date: Date): Date {
  const day = date.getDay()
  const adjusted = new Date(date)
  
  if (day === 0) {
    // Sunday -> observe on Monday
    adjusted.setDate(date.getDate() + 1)
  } else if (day === 6) {
    // Saturday -> observe on Friday
    adjusted.setDate(date.getDate() - 1)
  }
  
  return adjusted
}

/**
 * Helper: Calculate Easter Sunday using Computus algorithm
 */
function calculateEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  
  return new Date(year, month, day)
}

/**
 * Generate all calendar events for a given year
 */
export function generateAllCalendarEvents(year: number): CalendarEvent[] {
  return [
    ...generateFOMCMeetings(year),
    ...generateNonFarmPayrollDates(year),
    ...generateCPIReleaseDates(year),
    ...generateOptionsExpirationDates(year),
    ...generateUSHolidays(year),
    ...generateShortWeeks(year),
  ]
}

/**
 * Generate calendar events for a range of years
 */
export function generateCalendarEventsForRange(startYear: number, endYear: number): CalendarEvent[] {
  const events: CalendarEvent[] = []
  
  for (let year = startYear; year <= endYear; year++) {
    events.push(...generateAllCalendarEvents(year))
  }
  
  return events
}
