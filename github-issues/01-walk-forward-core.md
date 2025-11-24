# Walk-Forward Analysis - Core Engine Implementation

## Summary
Implement the core calculation engine for walk-forward optimization that validates trading performance and optimizes position sizing/risk management using rolling in-sample/out-of-sample periods.

## Context
This is the backend implementation for walk-forward analysis. The UI will be handled in a separate issue. This issue focuses on the calculation logic, data structures, and database persistence.

## Requirements

### Database Schema
```typescript
interface WalkForwardAnalysis {
  id: string;
  blockId: string;
  config: {
    inSampleDays: number;
    outOfSampleDays: number;
    stepSizeDays: number;
    optimizationTarget: string;
    parameterRanges: Record<string, [min: number, max: number, step: number]>;
  };
  results: {
    periods: Array<{
      inSampleStart: Date;
      inSampleEnd: Date;
      outOfSampleStart: Date;
      outOfSampleEnd: Date;
      optimalParameters: Record<string, number>;
      inSampleMetrics: PortfolioStats;
      outOfSampleMetrics: PortfolioStats;
    }>;
    summary: {
      avgInSamplePerformance: number;
      avgOutOfSamplePerformance: number;
      degradationFactor: number;
      parameterStability: number;
      robustnessScore: number;
    };
  };
  createdAt: Date;
}
```

### Core Algorithm
1. Segment trade history into rolling IS/OOS windows
2. For each window:
   - Filter trades to IS period
   - Test parameter combinations (Kelly multipliers, fixed %, risk limits)
   - Select parameters that maximize target metric
   - Apply to OOS period and measure performance
3. Calculate robustness metrics using existing PortfolioStatsCalculator

### Optimizable Parameters
- **Position Sizing**: Kelly fraction multiplier (0.25x to 2x), fixed fractional (1-10%), fixed contracts
- **Risk Management**: Max daily loss %, max drawdown %, consecutive loss limits
- **Strategy Allocation**: Strategy selection, allocation percentages

### Files to Create
```
lib/calculations/walk-forward-analyzer.ts
lib/models/walk-forward.ts
lib/db/walk-forward-store.ts
```

## Acceptance Criteria
- [ ] Segments existing trade history into rolling windows correctly
- [ ] Optimizes position sizing using existing Kelly calculations
- [ ] Tests risk management thresholds using existing P&L data
- [ ] Evaluates strategy allocation using existing strategy labels
- [ ] Calculates all metrics using existing portfolio stats calculator
- [ ] Persists results to IndexedDB
- [ ] Analysis of 1 year of trades completes in < 30 seconds
- [ ] Cancelable analysis process with progress callbacks

## Dependencies
- Existing PortfolioStatsCalculator
- Performance snapshot service
- IndexedDB stores

## Testing
- Unit tests for window segmentation
- Unit tests for parameter optimization
- Integration tests with sample trade data
- Performance benchmarks