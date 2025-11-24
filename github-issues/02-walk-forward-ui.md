# Walk-Forward Analysis - UI Components

## Summary
Implement the user interface for configuring, running, and visualizing walk-forward analysis results.

## Context
This issue depends on the core engine implementation (#1). It provides the UI for users to configure analysis parameters and view results.

## Requirements

### Configuration Panel
- Period length selection (IS/OOS/step size)
- Target metric selection dropdown (Sharpe, Calmar, Profit Factor, etc.)
- Position sizing method selection (Kelly, Fixed %, Fixed Contracts)
- Risk parameter range configuration with sliders
- Quick presets: Conservative, Moderate, Aggressive

### Results Dashboard
- Timeline visualization with IS/OOS period shading
- Optimal parameter evolution chart
- Performance comparison table (IS vs OOS for each period)
- Robustness score card with metrics:
  - Efficiency Ratio (OOS/IS Performance)
  - Parameter Stability score
  - Consistency Score (% profitable OOS periods)
  - Average Performance Degradation

### Files to Create
```
app/(platform)/walk-forward/page.tsx
components/walk-forward/analysis-chart.tsx
components/walk-forward/robustness-metrics.tsx
components/walk-forward/period-selector.tsx
lib/stores/walk-forward-store.ts
```

## Acceptance Criteria
- [ ] Configuration panel validates input ranges
- [ ] Real-time progress updates during analysis
- [ ] Clear visual distinction between IS and OOS periods
- [ ] Tooltips explaining each metric
- [ ] Actionable insights displayed (e.g., "Optimal Kelly fraction: 0.5x")
- [ ] Export analysis summary as CSV/JSON
- [ ] Responsive design for mobile/tablet

## Dependencies
- Walk-Forward Analysis Core Engine (#1)
- Existing ChartWrapper component
- Plotly.js for visualizations

## UI/UX Requirements
- Follow existing TradeBlocks design patterns
- Use shadcn/ui components
- Dark/light mode support
- Loading states and error handling