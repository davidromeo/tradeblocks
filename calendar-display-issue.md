# Feature: Calendar Display with Trade Visualization and Capital Utilization Tracking

## Summary
Implement a calendar-based visualization for trades that shows daily trading activity, capital utilization patterns, and enables visual reconciliation with daily logs. This provides traders with insights into capital deployment patterns, risk concentration periods, and helps identify opportunities for portfolio optimization.

## Background
Traders need a visual way to understand their trading patterns over time, similar to platforms like TradeZella. Currently, TradeBlocks shows trades in list format and performance charts, but lacks a calendar view that can reveal:
- Trading frequency patterns
- Capital utilization peaks and valleys
- Risk concentration on specific dates
- Correlation between high utilization days and drawdowns

## Problem Statement
- No visual representation of when trades occur throughout the month
- Cannot easily identify days with high capital concentration
- Difficult to spot patterns in trading frequency or capital deployment
- No way to visually reconcile trades with daily P&L logs
- Cannot identify which dates might benefit from reduced position sizing

## Proposed Solution

### Core Features

#### 1. Calendar View with Trade Markers
- Monthly calendar grid with visual indicators for trading activity
- Color-coded cells based on metrics (P&L, utilization, trade count)
- Click-through to daily details
- Mini charts within calendar cells showing intraday capital curve

#### 2. Capital Utilization Tracking
- **Daily Metrics**:
  - Total capital employed (sum of margin requirements)
  - Peak intraday utilization
  - Number of concurrent positions
  - Utilization as % of account value

- **Aggregate Metrics**:
  - Average daily utilization (portfolio-wide)
  - Average utilization by strategy
  - Day-of-week utilization patterns
  - Monthly rolling averages

#### 3. Risk Concentration Analysis
- Highlight dates with above-average capital deployment
- Correlation overlay with drawdown periods
- "Risk heat map" showing concentration levels
- Suggestions for position sizing adjustments

### Technical Implementation

#### New Database Schema
```typescript
interface DailyUtilization {
  id: string;
  blockId: string;
  date: Date;
  metrics: {
    // Capital metrics
    totalMarginRequired: number;      // Sum of all marginReq for open positions
    peakUtilization: number;          // Highest utilization during the day
    avgUtilization: number;           // Time-weighted average
    accountValue: number;             // From fundsAtClose or daily log
    utilizationPercent: number;       // (marginRequired / accountValue) * 100

    // Trade metrics
    tradesOpened: number;
    tradesClosed: number;
    concurrentPositions: number;      // Max positions open at once

    // P&L metrics
    realizedPL: number;
    unrealizedPL: number;
    dailyPLPercent: number;

    // By strategy breakdown
    strategyUtilization: Record<string, {
      marginRequired: number;
      tradeCount: number;
      plPercent: number;
    }>;
  };

  // Detailed timeline for intraday analysis
  intradaySnapshots?: Array<{
    timestamp: Date;
    marginRequired: number;
    openPositions: string[];  // Trade IDs
  }>;
}

interface CalendarViewConfig {
  id: string;
  blockId: string;
  viewType: 'month' | 'quarter' | 'year';
  colorScheme: 'pl' | 'utilization' | 'tradeCount' | 'risk';
  filters: {
    strategies?: string[];
    minUtilization?: number;
    maxUtilization?: number;
  };
  savedAt: Date;
}
```

#### New Files Required
```
app/(platform)/calendar/page.tsx              // Main calendar view
components/calendar/trade-calendar.tsx        // Calendar grid component
components/calendar/day-detail-modal.tsx      // Daily trade breakdown
components/calendar/utilization-chart.tsx     // Utilization visualizations
components/calendar/risk-heatmap.tsx         // Risk concentration overlay
lib/calculations/utilization-analyzer.ts      // Capital utilization calculations
lib/services/calendar-data-service.ts        // Calendar data preparation
lib/stores/calendar-store.ts                 // Calendar UI state
```

### User Interface

#### Main Calendar View
```
┌─────────────────────────────────────────────────────────────┐
│ Trade Calendar - Portfolio 2024                            │
├─────────────────────────────────────────────────────────────┤
│ [◀] November 2024 [▶]   View: [Month ▼] Color: [P&L ▼]    │
├─────────────────────────────────────────────────────────────┤
│ Sun    Mon    Tue    Wed    Thu    Fri    Sat             │
├───────┬───────┬───────┬───────┬───────┬───────┬───────────┤
│       │   1   │   2   │   3   │   4   │   5   │    6      │
│       │ +$450 │ -$200 │ +$800 │   0   │+$1200 │           │
│       │  45%  │  62%  │  38%  │  12%  │  85%  │           │
│       │  ▁▃█▂ │  ▃██▅ │  ▂▃▂▁ │  ▁▁▁▁ │  ████ │           │
├───────┼───────┼───────┼───────┼───────┼───────┼───────────┤
│   7   │   8   │   9   │  10   │  11   │  12   │   13      │
│  ...  │  ...  │  ...  │  ...  │  ...  │  ...  │   ...     │
└───────┴───────┴───────┴───────┴───────┴───────┴───────────┘

Legend: [P&L] [Utilization %] [Mini Chart]

Summary Panel:
├─ Avg Daily Utilization: 52.3%
├─ Peak Utilization: 85% (Nov 5)
├─ Days Traded: 18/22 (82%)
└─ Risk Concentration: 3 high-risk days ⚠️
```

#### Daily Detail Modal
```
┌──────────────────────────────────────────────────────┐
│ November 5, 2024 - Daily Details                     │
├──────────────────────────────────────────────────────┤
│ Capital Utilization Timeline                         │
│ 100% ┤                    ╱▔▔▔▔╲                    │
│  75% ┤         ╱▔▔▔▔▔▔▔▔▔╱      ╲                   │
│  50% ┤    ╱▔▔▔╱                   ╲▔▔╲              │
│  25% ┤ ▔▔╱                            ╲▔▔           │
│   0% └────┬────┬────┬────┬────┬────┬────┬────┬────  │
│       9:30 10:00 10:30 11:00 11:30 12:00 12:30 1:00  │
│                                                       │
│ Trades (5 total, 3 concurrent max)                   │
│ ├─ 09:32 SPX Iron Condor    -$2,500 margin  +$450   │
│ ├─ 10:15 QQQ Put Spread     -$1,200 margin  -$180   │
│ ├─ 10:45 IWM Call Spread    -$1,800 margin  +$320   │
│ ├─ 11:20 SPX Put Spread     -$2,200 margin  +$610   │
│ └─ 12:05 Close QQQ          +$1,200 margin          │
│                                                       │
│ Metrics:                                              │
│ • Peak Utilization: 85% at 11:20                     │
│ • Average Utilization: 68%                           │
│ • Total P&L: +$1,200 (2.4% of account)              │
│ • From Daily Log: +$1,195 ✓ (reconciled)            │
│                                                       │
│ [View Trades] [Analyze Risk] [Suggest Optimization]  │
└──────────────────────────────────────────────────────┘
```

#### Utilization Analytics Dashboard
```
┌──────────────────────────────────────────────────────┐
│ Capital Utilization Analysis                         │
├──────────────────────────────────────────────────────┤
│ Portfolio Average Daily Utilization (30-day)         │
│ 80% ┤                    ╱╲                         │
│ 60% ┤ ═══════╱▔▔▔▔▔▔▔▔▔╱  ╲═════════              │
│ 40% ┤      ╱                ╲                       │
│ 20% ┤                                               │
│                                                       │
│ By Strategy:                                         │
│ • SPX Iron Condor:  45% avg (Mon/Wed/Fri peaks)     │
│ • QQQ Put Spread:   28% avg (Tuesday peaks)         │
│ • IWM Call Spread:  18% avg (Thursday peaks)        │
│                                                       │
│ By Day of Week:                                      │
│ Mon: 58% │ ████████████                             │
│ Tue: 62% │ █████████████                            │
│ Wed: 71% │ ███████████████                          │
│ Thu: 44% │ █████████                                │
│ Fri: 48% │ ██████████                               │
│                                                       │
│ Risk Alerts:                                          │
│ ⚠️ 5 days with >80% utilization in last month       │
│ ⚠️ Drawdowns correlate with high utilization (r=0.72)│
│ ℹ️ Consider reducing position size on Wednesdays     │
└──────────────────────────────────────────────────────┘
```

### Implementation Logic

#### Utilization Calculation
```typescript
async function calculateDailyUtilization(
  blockId: string,
  date: Date
): Promise<DailyUtilization> {
  // 1. Get all trades active on this date
  const trades = await getTradesForDate(blockId, date);

  // 2. Build intraday timeline
  const timeline = buildIntradayTimeline(trades);

  // 3. Calculate metrics at each point
  const snapshots = timeline.map(point => ({
    timestamp: point.time,
    marginRequired: calculateTotalMargin(point.openTrades),
    openPositions: point.openTrades.map(t => t.id)
  }));

  // 4. Calculate aggregate metrics
  const peakUtilization = Math.max(...snapshots.map(s => s.marginRequired));
  const avgUtilization = calculateTimeWeightedAverage(snapshots);

  // 5. Group by strategy
  const strategyBreakdown = groupByStrategy(trades);

  return {
    date,
    metrics: {
      totalMarginRequired: peakUtilization,
      peakUtilization,
      avgUtilization,
      utilizationPercent: (peakUtilization / accountValue) * 100,
      // ... other metrics
    },
    intradaySnapshots: snapshots
  };
}
```

#### Risk Concentration Detection
```typescript
function identifyHighRiskDays(
  utilizations: DailyUtilization[],
  drawdowns: DrawdownPeriod[]
): RiskAnalysis {
  // 1. Find utilization outliers (>75th percentile)
  const threshold = percentile(utilizations.map(u => u.metrics.peakUtilization), 75);
  const highUtilDays = utilizations.filter(u => u.metrics.peakUtilization > threshold);

  // 2. Correlate with drawdown periods
  const correlation = calculateCorrelation(
    utilizations.map(u => u.metrics.utilizationPercent),
    dailyReturns.map(r => Math.min(0, r)) // Negative returns only
  );

  // 3. Generate recommendations
  const recommendations = generateOptimizationSuggestions(highUtilDays, drawdowns);

  return {
    highRiskDates: highUtilDays.map(u => u.date),
    riskCorrelation: correlation,
    recommendations
  };
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] Calendar displays all trading days with visual indicators
- [ ] Click on any day shows detailed trade breakdown
- [ ] Color coding works for P&L, utilization, and trade count
- [ ] Utilization calculated correctly from margin requirements
- [ ] Strategy-level utilization breakdown available
- [ ] Day-of-week patterns correctly identified
- [ ] Reconciliation with daily logs when available
- [ ] Export calendar data as CSV/image

### Visual Requirements
- [ ] Calendar cells show multiple data points clearly
- [ ] Mini sparklines render within calendar cells
- [ ] Heat map overlay for risk concentration
- [ ] Responsive design for mobile/tablet
- [ ] Print-friendly calendar view
- [ ] Customizable color schemes

### Performance Requirements
- [ ] Calendar loads in < 2 seconds for 1 year of data
- [ ] Smooth navigation between months
- [ ] Day details load instantly (pre-calculated)
- [ ] Utilization metrics cached appropriately

### Analytics Requirements
- [ ] Accurate peak and average utilization calculations
- [ ] Time-weighted averages for intraday analysis
- [ ] Correlation with drawdowns correctly computed
- [ ] Strategy-level breakdown matches trade data
- [ ] Rolling averages update dynamically

## Edge Cases to Handle

1. **Trades spanning multiple days**
   - Show on all days when position is open
   - Prorate margin requirement by time held

2. **Missing margin requirement data**
   - Fall back to contract count * estimated margin
   - Flag days with estimated data

3. **Account value changes**
   - Use daily log values when available
   - Interpolate between known values
   - Handle deposits/withdrawals

4. **Weekend/holiday trades**
   - Group with next trading day
   - Show separately in weekly view

5. **Multiple accounts/portfolios**
   - Allow filtering by account
   - Aggregate view across all accounts

## Integration Points

- **With Performance Charts**
  - Click from drawdown chart to calendar view of that period
  - Overlay utilization on equity curve chart

- **With Block Management**
  - Calendar view available for each block
  - Combined view for multiple blocks

- **With Position Sizing**
  - Use utilization data to inform Kelly calculations
  - Suggest position size adjustments based on patterns

## Future Enhancements

- Heat map by time of day (not just date)
- Correlation analysis between strategies
- Seasonal pattern detection
- Machine learning for risk prediction
- Integration with broker APIs for real-time updates
- Alerts for approaching utilization limits
- What-if analysis for position sizing changes

## Testing Requirements

- Unit tests for utilization calculations
- Integration tests with trade/daily log data
- Visual regression tests for calendar rendering
- Performance tests with large datasets (5+ years)
- Edge case validation (missing data, holidays, etc.)

## Mockups Needed

- Calendar month/quarter/year views
- Daily detail modal with all tabs
- Utilization analytics dashboard
- Risk heat map overlay
- Mobile-responsive calendar
- Print layout

## References

- Similar to TradeZella's calendar view
- Inspiration from Google Calendar's multi-layer events
- Heat map similar to GitHub contribution graph
- Risk metrics from existing drawdown calculations