# Feature: Walk-Forward Analysis Tool (Using Existing Data)

## Summary
Implement a walk-forward analysis tool that validates trading performance and optimizes position sizing/risk management using rolling in-sample/out-of-sample periods with the data already available in trade logs.

## Background
Users currently upload trade logs and daily portfolio logs from Option Omega. These logs contain sufficient data for performance-based optimization without requiring any additional user input. Walk-forward analysis can help validate that position sizing and risk management approaches work on unseen data.

## Problem Statement
- Position sizing and risk parameters are static rather than adaptive
- No current method to validate if risk management rules are robust
- Strategy allocation percentages are not optimized
- Users cannot test different position sizing approaches across time periods

## Proposed Solution

### Performance-Based Walk-Forward Analysis
Implement optimization using only the existing data fields from trade logs and daily logs.

#### Core Features
- **Window Configuration**
  - Configurable in-sample period (e.g., 60 days)
  - Configurable out-of-sample period (e.g., 20 days)
  - Rolling window step size

- **Optimizable Parameters (All Derivable from Existing Data)**
  - **Position Sizing Methods**
    - Kelly fraction multiplier (0.25x to 2x of calculated Kelly)
    - Fixed fractional sizing (1% to 10% of account per trade)
    - Fixed contract sizing normalized by margin requirement

  - **Risk Management Rules**
    - Maximum daily loss threshold (% of account)
    - Maximum drawdown before stopping (% from peak)
    - Consecutive loss limits (stop after N losses)
    - Maximum open risk (based on margin requirements in data)

  - **Strategy Allocation** (for multi-strategy logs)
    - Strategy selection (which to trade in each period)
    - Allocation percentages between strategies
    - Correlation-based limits (already calculable)

- **Target Metrics (All Currently Calculated)**
  - Sharpe ratio
  - Calmar ratio
  - Profit factor
  - Kelly criterion
  - Win rate
  - Average win/loss ratio

#### Technical Requirements

**New Files:**
```
lib/calculations/walk-forward-analyzer.ts
lib/stores/walk-forward-store.ts
lib/models/walk-forward.ts
app/(platform)/walk-forward/page.tsx
components/walk-forward/analysis-chart.tsx
components/walk-forward/robustness-metrics.tsx
components/walk-forward/period-selector.tsx
```

**Database Schema Extension:**
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

## User Interface Requirements

### Configuration Panel
- [ ] Period length selection (IS/OOS/step size)
- [ ] Target metric selection (Sharpe, Calmar, Profit Factor, etc.)
- [ ] Position sizing method selection (Kelly, Fixed %, Fixed Contracts)
- [ ] Risk parameter ranges with sliders
- [ ] Quick presets: Conservative, Moderate, Aggressive

### Results Dashboard
- [ ] Timeline with IS/OOS period shading
- [ ] Optimal parameter evolution chart
- [ ] Performance comparison table (IS vs OOS for each period)
- [ ] Robustness score card

### Key Metrics Display
- [ ] Efficiency Ratio (OOS Performance / IS Performance)
- [ ] Parameter Stability (how consistent are optimal parameters)
- [ ] Consistency Score (% of profitable OOS periods)
- [ ] Average Performance Degradation

## Acceptance Criteria

### Functional Requirements
- [ ] Segments existing trade history into rolling IS/OOS windows
- [ ] Optimizes position sizing using existing Kelly calculations
- [ ] Tests risk management thresholds using existing P&L data
- [ ] Evaluates strategy allocation using existing strategy labels
- [ ] Calculates all metrics using existing portfolio stats calculator
- [ ] Persists results to IndexedDB
- [ ] Exports analysis summary as CSV/JSON

### Performance Requirements
- [ ] Analysis of 1 year of trades completes in < 30 seconds
- [ ] Real-time progress updates during analysis
- [ ] Cancelable analysis process
- [ ] Cached results for instant retrieval

### User Experience
- [ ] No additional data input required from users
- [ ] Clear visual distinction between IS and OOS periods
- [ ] Tooltips explaining each metric
- [ ] Actionable insights (e.g., "Your optimal Kelly fraction is 0.5x")

## Technical Implementation Notes

### Algorithm Using Existing Data
1. **Extract Available Data**
   - Trade P&L from `trade.pl` field
   - Account balance from `fundsAtClose` field
   - Margin requirements from `marginReq` field
   - Strategy labels from `strategy` field
   - Trade timing from `dateOpened`/`dateClosed`

2. **For Each Rolling Window**
   - Filter trades to IS period using existing date indexes
   - Test parameter combinations:
     - Kelly multipliers on existing Kelly calculation
     - Fixed % using `fundsAtClose` for account size
     - Risk limits using daily P&L aggregation
   - Select parameters that maximize target metric
   - Apply to OOS period and measure performance

3. **Calculate Robustness Metrics**
   - All metrics use existing `PortfolioStatsCalculator`
   - No new calculations needed, just period filtering

### Integration with Existing Code
- Uses `PortfolioStatsCalculator` for all metrics
- Leverages `performance-snapshot` service for filtering
- Extends existing IndexedDB stores
- Reuses date filtering from performance store

### Data Fields We'll Use
```typescript
// From existing Trade interface
{
  pl: number;                 // For P&L calculations
  fundsAtClose: number;       // For account balance
  marginReq: number;          // For position sizing
  noOfContracts: number;      // For contract normalization
  strategy: string;           // For strategy allocation
  dateOpened: Date;           // For period segmentation
  dateClosed: Date;           // For period segmentation
}

// From existing DailyLog interface
{
  date: Date;                 // For daily aggregation
  portfolioValue: number;     // For drawdown calculation
  dailyPLPercent: number;     // For daily loss limits
}
```

## Risks and Mitigation
- **Risk**: Computational complexity with many parameter combinations
  - **Mitigation**: Limit parameter grid, use smart search algorithms

- **Risk**: User confusion about walk-forward methodology
  - **Mitigation**: Include "What is this?" help section with visual guide

- **Risk**: Overfitting to position sizing rather than strategy parameters
  - **Mitigation**: Clear disclaimer that this optimizes risk management, not strategy signals

## Example Use Cases

### Use Case 1: Position Sizing Optimization
User uploads a trade log and wants to find the optimal Kelly fraction multiplier that works best across different market periods without overfitting to the full dataset.

### Use Case 2: Risk Management Validation
User wants to test if a 2% daily loss limit and 10% maximum drawdown limit would have improved their performance consistently across different time periods.

### Use Case 3: Strategy Allocation
User with multiple strategies in their log wants to find the optimal allocation percentages that maximize Sharpe ratio while remaining stable across different periods.

## References
- Current portfolio stats: [lib/calculations/portfolio-stats.ts](lib/calculations/portfolio-stats.ts)
- Kelly calculations: [lib/calculations/kelly.ts](lib/calculations/kelly.ts)
- Performance service: [lib/services/performance-snapshot.ts](lib/services/performance-snapshot.ts)
- Trade model: [lib/models/trade.ts](lib/models/trade.ts)
- Example trade log: [tests/data/tradelog.csv](tests/data/tradelog.csv)