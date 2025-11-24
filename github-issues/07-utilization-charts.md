# Performance Charts - Add Utilization Visualizations

## Summary
Add capital utilization charts to the existing Performance section to visualize utilization trends, distributions, and correlations with returns.

## Context
The Performance section already has a Margin Utilization scatter plot. This issue adds complementary charts to provide comprehensive utilization analysis alongside existing performance metrics.

## Requirements

### New Charts to Add

#### 1. Daily Utilization Timeline (Risk & Margin tab)
- Line chart showing utilization % over time
- Primary line: Total portfolio daily average utilization
- Secondary lines: Strategy-level utilization (toggleable)
- Overlay: 30-day rolling average
- Similar pattern to existing Rolling Metrics Chart

#### 2. Utilization Distribution Histogram (Risk & Margin tab)
- Distribution of daily utilization levels
- Bins: 0-25%, 25-50%, 50-75%, 75-100%, >100%
- Overlay: Average returns per utilization band
- Shows optimal utilization zones for risk/return

#### 3. Utilization vs Returns Scatter Plot (Risk & Margin tab)
- X-axis: Daily average utilization %
- Y-axis: Daily returns %
- Color: Strategy
- Bubble size: Number of trades
- Identifies if higher utilization = higher risk/return

#### 4. Drawdown with Utilization Overlay (Overview tab enhancement)
- Add utilization as secondary Y-axis to existing Drawdown Chart
- Shows correlation between high utilization and drawdowns
- Visual proof of risk concentration theory

### Data Integration
```typescript
// Add to SnapshotChartData interface
utilizationTimeline: Array<{
  date: string;
  portfolioUtilization: number;
  strategyUtilization: Record<string, number>;
  accountValue: number;
}>;

utilizationDistribution: Array<{
  band: string;
  count: number;
  avgReturn: number;
  totalPL: number;
}>;

utilizationReturns: Array<{
  date: string;
  utilization: number;
  returnPct: number;
  strategy: string;
  tradeCount: number;
}>;
```

### Files to Create/Modify
```
components/performance-charts/utilization-timeline-chart.tsx (new)
components/performance-charts/utilization-distribution-chart.tsx (new)
components/performance-charts/utilization-returns-chart.tsx (new)
components/performance-charts/drawdown-chart.tsx (modify)
lib/services/performance-snapshot.ts (extend)
```

## Acceptance Criteria
- [ ] Utilization timeline shows accurate daily percentages
- [ ] Distribution histogram bins data correctly
- [ ] Scatter plot shows clear correlation patterns
- [ ] Drawdown overlay aligns properly with dual Y-axes
- [ ] All charts follow existing ChartWrapper patterns
- [ ] Theme-aware (dark/light mode)
- [ ] Responsive and performant
- [ ] Tooltips provide helpful context

## UI/UX Requirements
- Consistent with existing performance charts design
- Use Plotly.js for rendering
- Follow existing color schemes
- Maintain 350px default height
- Include description and help tooltips

## Dependencies
- Utilization Analytics implementation (#6)
- Existing ChartWrapper component
- Performance store and snapshot service

## Testing
- Unit tests for data transformation
- Visual regression tests
- Performance tests with large datasets
- Verify calculations match utilization analytics