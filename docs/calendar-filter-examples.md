# Calendar Event Filtering - Usage Examples

This document provides practical examples of how to use the calendar sensitivity features to solve the original issue: easily analyze trades with and without blackout days (news/short weeks).

## Quick Start: The Original Problem

**Before (Manual Process):**
1. Run trades on all days
2. Manually pick out blackout days
3. Run them separately
4. Change blackout days and repeat...

**After (Automated with Calendar Sensitivity):**
```typescript
import { getCleanTradeSet } from '@/lib/utils/calendar-filter-helpers'

// Automatically identify and remove problematic event days
const { cleanTrades, removedEventTypes, recommendations } = getCleanTradeSet(allTrades)

console.log(`Automatically removed ${removedEventTypes.length} event types`)
recommendations.forEach(rec => {
  console.log(`${rec.eventType}: Avg P/L ${rec.avgPlEventDays} vs ${rec.avgPlNormalDays}`)
})

// Now analyze the clean set
const stats = calculatePortfolioStats(cleanTrades)
```

## Example 1: Manual Blackout Day Filtering

```typescript
import { excludeBlackoutDays, includeOnlyEventDays } from '@/lib/utils/calendar-filter-helpers'

// Your original trades
const allTrades = getTradesFromBlock()

// Exclude FOMC and NFP days
const cleanTrades = excludeBlackoutDays(allTrades, [
  'fomc_meeting',
  'nonfarm_payroll'
])

// Analyze separately
const cleanStats = calculatePortfolioStats(cleanTrades)
const fomcTrades = includeOnlyEventDays(allTrades, ['fomc_meeting'])
const fomcStats = calculatePortfolioStats(fomcTrades)

console.log('Clean trades:', cleanStats.avgPL)
console.log('FOMC trades:', fomcStats.avgPL)
```

## Example 2: Compare Multiple Blackout Configurations

```typescript
import { excludeBlackoutDays } from '@/lib/utils/calendar-filter-helpers'
import { calculatePortfolioStats } from '@/lib/calculations/portfolio-stats'

const allTrades = getTradesFromBlock()

// Test different blackout configurations
const configs = [
  { name: 'No Filtering', eventTypes: [] },
  { name: 'Exclude FOMC', eventTypes: ['fomc_meeting'] },
  { name: 'Exclude NFP', eventTypes: ['nonfarm_payroll'] },
  { name: 'Exclude Short Weeks', eventTypes: ['short_week'] },
  { name: 'Exclude All News', eventTypes: ['fomc_meeting', 'nonfarm_payroll', 'cpi_release'] },
  { name: 'Exclude News + Short Weeks', eventTypes: ['fomc_meeting', 'nonfarm_payroll', 'short_week'] },
]

configs.forEach(config => {
  const filteredTrades = config.eventTypes.length > 0
    ? excludeBlackoutDays(allTrades, config.eventTypes)
    : allTrades
  
  const stats = calculatePortfolioStats(filteredTrades)
  
  console.log(`\n${config.name}:`)
  console.log(`  Trades: ${filteredTrades.length}`)
  console.log(`  Avg P/L: $${stats.avgPL.toFixed(2)}`)
  console.log(`  Win Rate: ${stats.winRate.toFixed(1)}%`)
  console.log(`  Sharpe: ${stats.sharpeRatio.toFixed(2)}`)
})
```

## Example 3: Split Analysis (Original Workflow)

```typescript
import { splitByEventDays } from '@/lib/utils/calendar-filter-helpers'

const allTrades = getTradesFromBlock()

// Split into FOMC and non-FOMC days
const { eventDayTrades, normalDayTrades } = splitByEventDays(allTrades, ['fomc_meeting'])

console.log(`Total trades: ${allTrades.length}`)
console.log(`FOMC days: ${eventDayTrades.length}`)
console.log(`Normal days: ${normalDayTrades.length}`)

// Analyze each separately
const fomcStats = calculatePortfolioStats(eventDayTrades)
const normalStats = calculatePortfolioStats(normalDayTrades)

console.log('\nFOMC Day Performance:')
console.log(`  Avg P/L: $${fomcStats.avgPL.toFixed(2)}`)
console.log(`  Win Rate: ${fomcStats.winRate.toFixed(1)}%`)

console.log('\nNormal Day Performance:')
console.log(`  Avg P/L: $${normalStats.avgPL.toFixed(2)}`)
console.log(`  Win Rate: ${normalStats.winRate.toFixed(1)}%`)
```

## Example 4: Automatic Blackout Day Detection

```typescript
import { recommendEventTypesToAvoid, excludeBlackoutDays } from '@/lib/utils/calendar-filter-helpers'

const allTrades = getTradesFromBlock()

// Get recommendations (event types where you perform significantly worse)
const recommendations = recommendEventTypesToAvoid(
  allTrades,
  5,    // Minimum 5 trades to consider
  -50   // Consider if avg P/L is $50 worse on event days
)

if (recommendations.length === 0) {
  console.log('No problematic event types detected')
} else {
  console.log('Recommended event types to avoid:')
  recommendations.forEach(rec => {
    console.log(`\n${rec.eventType}:`)
    console.log(`  Event days avg: $${rec.avgPlEventDays.toFixed(2)}`)
    console.log(`  Normal days avg: $${rec.avgPlNormalDays.toFixed(2)}`)
    console.log(`  Difference: $${rec.difference.toFixed(2)}`)
    console.log(`  Trade count: ${rec.tradeCount}`)
  })

  // Apply recommendations
  const eventTypesToRemove = recommendations.map(r => r.eventType)
  const cleanTrades = excludeBlackoutDays(allTrades, eventTypesToRemove)
  
  console.log(`\nFiltered ${allTrades.length - cleanTrades.length} trades`)
  console.log(`Analyzing ${cleanTrades.length} clean trades...`)
  
  const cleanStats = calculatePortfolioStats(cleanTrades)
  console.log(`Clean set avg P/L: $${cleanStats.avgPL.toFixed(2)}`)
}
```

## Example 5: One-Click Clean Trade Set

```typescript
import { getCleanTradeSet } from '@/lib/utils/calendar-filter-helpers'

const allTrades = getTradesFromBlock()

// One function does it all
const result = getCleanTradeSet(allTrades, {
  minTradeCount: 5,        // Need at least 5 trades to make a decision
  performanceThreshold: -50 // Remove if $50 worse on event days
})

console.log(`Original: ${result.originalTradeCount} trades`)
console.log(`Removed: ${result.removedTradeCount} trades`)
console.log(`Clean set: ${result.cleanTradeCount} trades`)
console.log(`\nRemoved event types:`)
result.removedEventTypes.forEach(type => console.log(`  - ${type}`))

// Use the clean trade set
const stats = calculatePortfolioStats(result.cleanTrades)
console.log(`\nClean set performance:`)
console.log(`  Avg P/L: $${stats.avgPL.toFixed(2)}`)
console.log(`  Win Rate: ${stats.winRate.toFixed(1)}%`)
```

## Example 6: Sensitivity Summary Report

```typescript
import { getEventSensitivitySummary } from '@/lib/utils/calendar-filter-helpers'
import { CALENDAR_EVENT_TYPE_LABELS } from '@/lib/models/calendar-event'

const allTrades = getTradesFromBlock()
const summary = getEventSensitivitySummary(allTrades)

console.log('Calendar Sensitivity Report')
console.log('===========================\n')

Object.entries(summary).forEach(([eventType, stats]) => {
  const label = CALENDAR_EVENT_TYPE_LABELS[eventType] || eventType
  
  console.log(`${label}:`)
  console.log(`  Event days: ${stats.tradeCountEventDays} trades, $${stats.avgPlEventDays.toFixed(2)} avg, ${stats.winRateEventDays.toFixed(1)}% win rate`)
  console.log(`  Normal days: ${stats.tradeCountNormalDays} trades, $${stats.avgPlNormalDays.toFixed(2)} avg, ${stats.winRateNormalDays.toFixed(1)}% win rate`)
  console.log(`  Difference: $${stats.difference.toFixed(2)} ${stats.difference >= 0 ? '✓' : '✗'}`)
  console.log()
})
```

## Example 7: Building a Custom Filter UI

```typescript
'use client'

import { useState } from 'react'
import { excludeBlackoutDays } from '@/lib/utils/calendar-filter-helpers'
import { CALENDAR_EVENT_TYPE_LABELS, CalendarEventType } from '@/lib/models/calendar-event'

export function BlackoutDayFilter({ trades, onFilteredTradesChange }) {
  const [selectedEventTypes, setSelectedEventTypes] = useState<CalendarEventType[]>([])
  
  const eventTypes: CalendarEventType[] = [
    'fomc_meeting',
    'nonfarm_payroll',
    'cpi_release',
    'short_week',
    'holiday',
    'option_expiration',
  ]
  
  const handleToggle = (eventType: CalendarEventType) => {
    const newSelection = selectedEventTypes.includes(eventType)
      ? selectedEventTypes.filter(t => t !== eventType)
      : [...selectedEventTypes, eventType]
    
    setSelectedEventTypes(newSelection)
    
    // Apply filter
    const filtered = newSelection.length > 0
      ? excludeBlackoutDays(trades, newSelection)
      : trades
    
    onFilteredTradesChange(filtered)
  }
  
  const filteredCount = selectedEventTypes.length > 0
    ? excludeBlackoutDays(trades, selectedEventTypes).length
    : trades.length
  
  return (
    <div className="space-y-4">
      <h3>Blackout Day Filter</h3>
      <p>Total: {trades.length} trades | Filtered: {filteredCount} trades</p>
      
      <div className="space-y-2">
        {eventTypes.map(eventType => (
          <label key={eventType} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedEventTypes.includes(eventType)}
              onChange={() => handleToggle(eventType)}
            />
            <span>Exclude {CALENDAR_EVENT_TYPE_LABELS[eventType]}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
```

## Example 8: Integrating with Report Builder

```typescript
import { excludeBlackoutDays, getEventSensitivitySummary } from '@/lib/utils/calendar-filter-helpers'

// In your report builder component
function generateReport(trades, options) {
  // Apply blackout filter if specified
  let reportTrades = trades
  if (options.excludeEventTypes && options.excludeEventTypes.length > 0) {
    reportTrades = excludeBlackoutDays(trades, options.excludeEventTypes)
  }
  
  // Generate stats
  const stats = calculatePortfolioStats(reportTrades)
  
  // Include sensitivity analysis
  const sensitivity = getEventSensitivitySummary(trades)
  
  return {
    stats,
    sensitivity,
    tradeCount: {
      total: trades.length,
      filtered: reportTrades.length,
      removed: trades.length - reportTrades.length,
    }
  }
}
```

## Real-World Workflow

Here's a complete workflow showing how a trader might use this feature:

```typescript
import { 
  getEventSensitivitySummary,
  recommendEventTypesToAvoid,
  excludeBlackoutDays,
} from '@/lib/utils/calendar-filter-helpers'

// 1. Load your trades
const allTrades = await loadTradesFromBlock('my-strategy-2024')

// 2. Get sensitivity analysis
const sensitivity = getEventSensitivitySummary(allTrades)

// 3. Review the numbers
console.log('Short Weeks:', sensitivity.short_week)
console.log('FOMC Days:', sensitivity.fomc_meeting)
// ... etc

// 4. Get automatic recommendations
const recommendations = recommendEventTypesToAvoid(allTrades)

// 5. Decide which events to exclude
// Option A: Follow recommendations
const eventTypesToExclude = recommendations.map(r => r.eventType)

// Option B: Manual selection
// const eventTypesToExclude = ['fomc_meeting', 'short_week']

// 6. Filter trades
const cleanTrades = excludeBlackoutDays(allTrades, eventTypesToExclude)

// 7. Analyze filtered results
const cleanStats = calculatePortfolioStats(cleanTrades)

// 8. Compare
const allStats = calculatePortfolioStats(allTrades)

console.log('\nComparison:')
console.log(`All days: ${allStats.avgPL} avg, ${allStats.winRate}% win rate`)
console.log(`Clean days: ${cleanStats.avgPL} avg, ${cleanStats.winRate}% win rate`)

// 9. If clean set is better, use it for future analysis
if (cleanStats.sharpeRatio > allStats.sharpeRatio) {
  console.log('✓ Filtered set shows better risk-adjusted returns')
  // Continue with cleanTrades for further analysis
}
```

This workflow solves the original issue by providing an automated, code-based approach to analyzing trades with and without blackout days, eliminating the manual back-and-forth process.
