# Calendar Sensitivity Analysis

This feature analyzes how trading performance varies on special calendar days (FOMC meetings, economic data releases, short weeks, holidays, etc.) compared to normal trading days.

## Overview

The Calendar Sensitivity Analysis helps traders answer questions like:
- Should I trade on FOMC meeting days?
- How does my strategy perform during short weeks?
- Are earnings season trades more volatile?
- Should I avoid trading on NFP release days?

## Components

### 1. Calendar Event Models (`lib/models/calendar-event.ts`)

Defines the data structures for calendar events:

```typescript
export type CalendarEventType = 
  | 'short_week'
  | 'fomc_meeting'
  | 'nonfarm_payroll'
  | 'cpi_release'
  | 'gdp_release'
  | 'earnings_season'
  | 'option_expiration'
  | 'holiday'
  | 'custom'
```

### 2. Calendar Event Generator (`lib/services/calendar-event-generator.ts`)

Generates calendar events for common trading events:

```typescript
import { generateAllCalendarEvents, generateCalendarEventsForRange } from '@/lib/services/calendar-event-generator'

// Generate all events for a single year
const events2024 = generateAllCalendarEvents(2024)

// Generate events for a range of years (e.g., 2020-2025)
const events = generateCalendarEventsForRange(2020, 2025)
```

Available generators:
- `generateFOMCMeetings(year)` - 8 FOMC meetings per year
- `generateNonFarmPayrollDates(year)` - First Friday of each month
- `generateCPIReleaseDates(year)` - Mid-month CPI releases
- `generateOptionsExpirationDates(year)` - Third Friday of each month
- `generateUSHolidays(year)` - US market holidays
- `generateShortWeeks(year)` - Weeks with holidays

### 3. Calendar Sensitivity Analysis (`lib/calculations/calendar-sensitivity.ts`)

Analyzes trading performance:

```typescript
import { analyzeCalendarSensitivity } from '@/lib/calculations/calendar-sensitivity'
import { generateCalendarEventsForRange } from '@/lib/services/calendar-event-generator'

// Get trades from your block
const trades = blockTrades // your Trade[] array

// Generate events for the date range of your trades
const events = generateCalendarEventsForRange(2020, 2025)

// Analyze sensitivity
const analysis = analyzeCalendarSensitivity(trades, events)

// Access results
console.log('Overall avg P/L:', analysis.overall.avgPl)
console.log('Overall win rate:', analysis.overall.winRate)

// Get FOMC-specific stats
const fomcStats = analysis.byEventType.get('fomc_meeting')
if (fomcStats) {
  console.log('FOMC days avg P/L:', fomcStats.avgPlEventDays)
  console.log('Normal days avg P/L:', fomcStats.avgPlNormalDays)
  console.log('FOMC days win rate:', fomcStats.winRateEventDays)
  console.log('Normal days win rate:', fomcStats.winRateNormalDays)
}

// Stats for days with NO events
console.log('Normal days avg P/L:', analysis.normalDays.avgPl)
console.log('Normal days win rate:', analysis.normalDays.winRate)
```

### 4. Calendar Sensitivity Chart (`components/performance-charts/calendar-sensitivity-chart.tsx`)

React component for visualizing the analysis:

```typescript
import { CalendarSensitivityChart } from '@/components/performance-charts/calendar-sensitivity-chart'
import { generateCalendarEventsForRange } from '@/lib/services/calendar-event-generator'

export function MyPerformancePage() {
  const trades = useTrades() // your trades
  const events = generateCalendarEventsForRange(2020, 2025)
  
  return (
    <CalendarSensitivityChart 
      trades={trades}
      events={events}
      className="w-full"
    />
  )
}
```

The chart provides:
- Toggle between Avg P/L, Win Rate, and Trade Count views
- Filter by specific event types (FOMC, NFP, Short Weeks, etc.)
- Visual comparison between event days vs normal days
- Interactive tooltips with trade counts

## Use Cases

### 1. Filter Out Event Days

Use the analysis to identify which event types negatively impact your strategy, then filter them out:

```typescript
import { filterTradesExcludingEvents } from '@/lib/calculations/calendar-sensitivity'

// Exclude all FOMC and NFP days
const filteredTrades = filterTradesExcludingEvents(
  trades,
  events,
  ['fomc_meeting', 'nonfarm_payroll']
)

// Now analyze only non-event days
const cleanStats = calculatePortfolioStats(filteredTrades)
```

### 2. Analyze Only Event Days

Focus on specific event types:

```typescript
import { filterTradesByEventType } from '@/lib/calculations/calendar-sensitivity'

// Analyze only short week performance
const shortWeekTrades = filterTradesByEventType(
  trades,
  events,
  ['short_week']
)

const shortWeekStats = calculatePortfolioStats(shortWeekTrades)
```

### 3. Compare Multiple Strategies

```typescript
// Compare Strategy A vs Strategy B on FOMC days
const strategyATrades = trades.filter(t => t.strategy === 'Strategy A')
const strategyBTrades = trades.filter(t => t.strategy === 'Strategy B')

const analysisA = analyzeCalendarSensitivity(strategyATrades, events)
const analysisB = analyzeCalendarSensitivity(strategyBTrades, events)

const fomcStatsA = analysisA.byEventType.get('fomc_meeting')
const fomcStatsB = analysisB.byEventType.get('fomc_meeting')

// Compare which strategy handles FOMC days better
```

### 4. Identify Best/Worst Event Types

```typescript
const analysis = analyzeCalendarSensitivity(trades, events)

// Find which event type has best performance
let bestEventType = null
let bestAvgPl = -Infinity

analysis.byEventType.forEach((stats, eventType) => {
  if (stats.avgPlEventDays > bestAvgPl && stats.tradesOnEventDays > 10) {
    bestEventType = eventType
    bestAvgPl = stats.avgPlEventDays
  }
})

console.log('Best event type to trade:', bestEventType)
```

## Integration with Existing Features

The calendar sensitivity feature integrates with existing TradeBlocks infrastructure:

1. **Static Datasets**: Could be extended to import custom calendar data from CSV
2. **Regime Analysis**: Calendar events could be used as regime filters
3. **Performance Blocks**: Add calendar sensitivity charts to performance views
4. **Report Builder**: Export calendar sensitivity data to reports
5. **Monte Carlo**: Run simulations excluding specific event types

## Future Enhancements

Potential future improvements:

1. **FRED API Integration**: Auto-fetch actual economic release dates
2. **Custom Calendar Import**: Upload custom CSV calendar data
3. **Intraday Analysis**: Analyze performance before/after event times
4. **Multi-event Analysis**: Performance on days with multiple events
5. **Event Impact Duration**: Analyze day-before and day-after effects
6. **Volatility Analysis**: Compare volatility on event vs normal days

## Testing

Run tests with:

```bash
npm test -- calendar-sensitivity
```

Tests cover:
- Event matching logic
- Statistical calculations
- Edge cases (empty data, no matches)
- Calendar event generation

## Example: Adding to Performance Blocks Page

To add the calendar sensitivity chart to the Performance Blocks page:

1. Import the component and generators:

```typescript
import { CalendarSensitivityChart } from '@/components/performance-charts/calendar-sensitivity-chart'
import { generateCalendarEventsForRange } from '@/lib/services/calendar-event-generator'
```

2. Generate events (useMemo for performance):

```typescript
const calendarEvents = useMemo(() => {
  if (!data?.trades) return []
  return generateCalendarEventsForRange(2020, 2025)
}, [data?.trades])
```

3. Add to the chart grid:

```typescript
<CalendarSensitivityChart 
  trades={data?.trades || []}
  events={calendarEvents}
  className="col-span-full"
/>
```

The chart will automatically:
- Match trades to calendar events
- Calculate statistics
- Provide interactive filtering and view modes
- Display tooltips with trade counts
