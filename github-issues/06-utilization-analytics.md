# Capital Utilization Analytics - Risk Concentration Analysis

## Summary
Implement comprehensive capital utilization tracking and risk concentration analysis to identify periods of high capital deployment and their correlation with portfolio risk.

## Context
Traders need to identify which dates have the most capital employed to understand risk concentration and optimize position sizing. This builds on the calendar view to add advanced analytics.

## Requirements

### Core Metrics to Calculate
**Daily Utilization**:
- Total margin required (sum of all open positions)
- Peak intraday utilization
- Average utilization (time-weighted)
- Utilization as % of account value
- Number of concurrent positions

**Aggregate Analytics**:
- Portfolio-wide average daily utilization
- Average utilization by strategy
- Day-of-week patterns
- Monthly rolling averages
- Correlation with drawdown periods

### Risk Concentration Detection
- Identify dates with above-average capital deployment
- Calculate correlation between utilization and drawdowns
- Generate position sizing recommendations
- Risk heat map overlay for calendar view

### Database Schema
```typescript
interface DailyUtilization {
  id: string;
  blockId: string;
  date: Date;
  metrics: {
    totalMarginRequired: number;
    peakUtilization: number;
    avgUtilization: number;
    utilizationPercent: number;
    concurrentPositions: number;
    strategyUtilization: Record<string, {
      marginRequired: number;
      tradeCount: number;
    }>;
  };
  intradaySnapshots?: Array<{
    timestamp: Date;
    marginRequired: number;
    openPositions: string[];
  }>;
}
```

### Analytics Dashboard Components
- Utilization timeline chart
- Day-of-week analysis
- Strategy breakdown
- Risk correlation metrics
- Optimization suggestions

### Files to Create
```
lib/calculations/utilization-analyzer.ts
components/calendar/utilization-chart.tsx
components/calendar/risk-heatmap.tsx
```

## Acceptance Criteria
- [ ] Accurately calculates daily utilization from margin requirements
- [ ] Peak utilization detection works correctly
- [ ] Time-weighted averages calculated properly
- [ ] Strategy-level breakdown matches trade data
- [ ] Correlation with drawdowns correctly computed
- [ ] Risk concentration alerts generated appropriately
- [ ] Day-of-week patterns identified accurately
- [ ] Suggestions for position sizing are actionable

## Key Insights to Generate
- "Days with >80% utilization have 2.3x higher drawdown risk"
- "Wednesday average utilization is 71% vs 48% other days"
- "Reducing position size by 20% on high-utilization days could reduce max drawdown by 15%"

## Dependencies
- Calendar View implementation (#5)
- Existing margin requirement data from trades
- Portfolio stats calculator for correlations

## Testing
- Unit tests for utilization calculations
- Integration tests with trade data
- Validation of correlation metrics
- Edge cases (missing margin data, etc.)