/**
 * Calendar Event Models
 *
 * Models for trading calendar events (short weeks, news days, holidays)
 * that can be used to analyze trading sensitivity to special market conditions.
 */

/**
 * Type of calendar event
 */
export type CalendarEventType = 
  | 'short_week'        // Week with fewer trading days due to holidays
  | 'fomc_meeting'      // Federal Reserve FOMC meeting days
  | 'nonfarm_payroll'   // Employment report (NFP) release days
  | 'cpi_release'       // Consumer Price Index release days
  | 'gdp_release'       // GDP report release days
  | 'earnings_season'   // Major earnings season periods
  | 'option_expiration' // Options expiration days
  | 'holiday'           // Market holidays
  | 'custom'            // User-defined event

/**
 * Human-readable labels for event types
 */
export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  short_week: 'Short Week',
  fomc_meeting: 'FOMC Meeting',
  nonfarm_payroll: 'Non-Farm Payroll',
  cpi_release: 'CPI Release',
  gdp_release: 'GDP Release',
  earnings_season: 'Earnings Season',
  option_expiration: 'Options Expiration',
  holiday: 'Holiday',
  custom: 'Custom Event',
}

/**
 * Descriptions for event types
 */
export const CALENDAR_EVENT_TYPE_DESCRIPTIONS: Record<CalendarEventType, string> = {
  short_week: 'Weeks with fewer trading days due to holidays',
  fomc_meeting: 'Federal Reserve FOMC meeting announcement days',
  nonfarm_payroll: 'Monthly employment report (Non-Farm Payroll) release days',
  cpi_release: 'Consumer Price Index inflation report release days',
  gdp_release: 'Quarterly GDP economic growth report release days',
  earnings_season: 'Periods when major companies report quarterly earnings',
  option_expiration: 'Monthly or weekly options expiration days',
  holiday: 'Market holidays and early close days',
  custom: 'User-defined custom event types',
}

/**
 * A single calendar event occurrence
 */
export interface CalendarEvent {
  /** Unique identifier */
  id: string

  /** Type of event */
  type: CalendarEventType

  /** Event name/description */
  name: string

  /** Event date */
  date: Date

  /** Optional: Event affects multiple days (for periods like earnings seasons) */
  endDate?: Date

  /** Optional: Impact level (high, medium, low) for filtering */
  impact?: 'high' | 'medium' | 'low'

  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Calendar event dataset metadata
 */
export interface CalendarEventDataset {
  /** Unique identifier */
  id: string

  /** User-provided name */
  name: string

  /** Event type this dataset contains */
  type: CalendarEventType

  /** Original filename from upload (if applicable) */
  fileName?: string

  /** When the dataset was created/uploaded */
  createdAt: Date

  /** Total number of events */
  eventCount: number

  /** Date range covered by the events */
  dateRange: {
    start: Date
    end: Date
  }

  /** Whether this is a built-in dataset or user-uploaded */
  isBuiltin: boolean
}

/**
 * Stored version of CalendarEvent with auto-generated ID for IndexedDB
 */
export interface StoredCalendarEvent extends CalendarEvent {
  /** Reference to parent dataset */
  datasetId: string

  /** Auto-generated IndexedDB ID */
  id?: number
}

/**
 * Result of matching a trade to calendar events
 */
export interface CalendarEventMatch {
  /** The matched event */
  event: CalendarEvent

  /** The dataset containing this event */
  datasetId: string

  /** Time difference in milliseconds between trade and event date */
  timeDifferenceMs: number
}

/**
 * Aggregated statistics for calendar event analysis
 */
export interface CalendarEventStats {
  /** Event type being analyzed */
  eventType: CalendarEventType

  /** Total number of trades */
  totalTrades: number

  /** Number of trades on event days */
  tradesOnEventDays: number

  /** Number of trades on normal days */
  tradesOnNormalDays: number

  /** Average P/L on event days */
  avgPlEventDays: number

  /** Average P/L on normal days */
  avgPlNormalDays: number

  /** Win rate on event days (0-100) */
  winRateEventDays: number

  /** Win rate on normal days (0-100) */
  winRateNormalDays: number

  /** Percentage of trades on event days */
  eventDaysPercent: number
}

/**
 * Sensitivity analysis comparing multiple event types
 */
export interface CalendarSensitivityAnalysis {
  /** Overall stats for all trades */
  overall: {
    totalTrades: number
    avgPl: number
    winRate: number
  }

  /** Stats broken down by event type */
  byEventType: Map<CalendarEventType, CalendarEventStats>

  /** Stats for trades on days with NO events */
  normalDays: {
    tradeCount: number
    avgPl: number
    winRate: number
  }
}
