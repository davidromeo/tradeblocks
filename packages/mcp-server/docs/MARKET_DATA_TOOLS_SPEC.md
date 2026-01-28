# MCP Server Market Data Tools Specification

## Overview

This document specifies new MCP tools for the TradeBlocks server that enable market context analysis and strategy hypothesis generation. These tools consume the daily market data exported from TradingView.

## Data Source

**Location:** `<blocks_directory>/_marketdata/spx_daily.csv`

The CSV is exported from the `0DTE Strategy Research Export v2` PineScript indicator and contains ~60 fields per trading day.

---

## New Tools

### 1. `get_market_context`

**Purpose:** Query market conditions for a specific date or date range, independent of any trades.

**Input Schema:**
```typescript
{
  startDate: string,           // Required: "YYYY-MM-DD"
  endDate?: string,            // Optional: defaults to startDate
  fields?: string[],           // Optional: subset of fields to return
  filters?: {
    minVix?: number,           // VIX_Close >= value
    maxVix?: number,           // VIX_Close <= value
    volRegime?: number[],      // e.g., [2, 3, 4] for Low/Normal/Elevated
    gapDirection?: 'up' | 'down' | 'any',
    minGapPct?: number,        // |Gap_Pct| >= value
    maxGapPct?: number,        // |Gap_Pct| <= value
    dayOfWeek?: number[],      // 2=Mon, 3=Tue, ... 6=Fri
    termStructure?: -1 | 0 | 1,// -1=backwardation, 0=flat, 1=contango
    minTrendScore?: number,    // Trend_Score >= value
    maxTrendScore?: number,    // Trend_Score <= value
    isOpex?: boolean,          // Filter for/against OPEX days
    minRsi?: number,
    maxRsi?: number
  },
  limit?: number               // Max rows to return (default: 100)
}
```

**Output:**
```typescript
{
  query: { startDate, endDate, filters },
  totalMatching: number,
  returned: number,
  days: [
    {
      date: string,
      // Requested fields or all fields
      Open: number,
      Close: number,
      Gap_Pct: number,
      VIX_Close: number,
      Vol_Regime: number,
      Term_Structure_State: number,
      // ... etc
    }
  ]
}
```

**Example Use Cases:**
- "Show me all days in 2023 where VIX > 25 and gap was down"
- "Find Mondays with VIX between 15-20 in contango"
- "Get market context for the day I had my biggest loss"

---

### 2. `enrich_trades`

**Purpose:** Join market data to an existing block's trades, adding context fields for analysis.

**Input Schema:**
```typescript
{
  blockId: string,             // Required: existing block ID
  additionalFields?: string[]  // Optional: specific fields to add (default: all)
}
```

**Output:**
```typescript
{
  blockId: string,
  tradesEnriched: number,
  tradesNotMatched: number,    // Trades where date not in market data
  sampleTrade: {
    // Original trade fields
    dateOpened: string,
    pl: number,
    // ...
    // Added market context
    market: {
      VIX_Close: number,
      Gap_Pct: number,
      Vol_Regime: number,
      Term_Structure_State: number,
      // ...
    }
  }
}
```

**Behavior:**
- Matches trades by `dateOpened` to market data `date`
- Returns summary; enriched data available for subsequent queries
- Enables `find_predictive_fields` to include market context

---

### 3. `find_similar_days`

**Purpose:** Given a reference date or set of conditions, find historically similar days.

**Input Schema:**
```typescript
{
  referenceDate?: string,      // Find days similar to this date
  // OR specify conditions directly:
  conditions?: {
    vixRange?: [number, number],      // [min, max]
    gapPctRange?: [number, number],
    termStructure?: -1 | 0 | 1,
    volRegime?: number[],
    trendScoreRange?: [number, number],
    rsiRange?: [number, number],
    consecutiveDaysRange?: [number, number]
  },
  excludeDates?: string[],     // Dates to exclude from results
  limit?: number               // Max results (default: 20)
}
```

**Output:**
```typescript
{
  reference: { /* conditions used */ },
  similarDays: [
    {
      date: string,
      similarityScore: number,   // 0-1, how closely it matches
      VIX_Close: number,
      Gap_Pct: number,
      Intraday_Return_Pct: number,
      // Key fields for quick comparison
    }
  ]
}
```

**Example Use Cases:**
- "Find days similar to March 14, 2023"
- "Show me high-VIX gap-down days in contango"
- "What happened on days with conditions like today?"

---

### 4. `analyze_regime_performance`

**Purpose:** Break down an existing block's performance by market regime.

**Input Schema:**
```typescript
{
  blockId: string,
  segmentBy: 'volRegime' | 'termStructure' | 'dayOfWeek' | 'gapDirection' | 'trendScore',
  strategy?: string            // Optional: filter to specific strategy
}
```

**Output:**
```typescript
{
  blockId: string,
  segmentBy: string,
  segments: [
    {
      segment: string | number,  // e.g., "Vol Regime 3" or "Monday"
      tradeCount: number,
      winRate: number,
      totalPl: number,
      avgPl: number,
      avgWin: number,
      avgLoss: number,
      profitFactor: number,
      // Performance relative to overall
      vsOverallWinRate: number,  // e.g., +5.2% means 5.2pp better
      vsOverallAvgPl: number
    }
  ],
  insight: string              // Auto-generated observation
}
```

**Example Output:**
```json
{
  "blockId": "dumpy dump",
  "segmentBy": "volRegime",
  "segments": [
    { "segment": "2 (Low)", "tradeCount": 8, "winRate": 87.5, "avgPl": 3200, ... },
    { "segment": "3 (Normal)", "tradeCount": 18, "winRate": 83.3, "avgPl": 2900, ... },
    { "segment": "4 (Elevated)", "tradeCount": 9, "winRate": 66.7, "avgPl": 1800, ... },
    { "segment": "5 (High)", "tradeCount": 2, "winRate": 50.0, "avgPl": -500, ... }
  ],
  "insight": "Strategy performs best in Low vol (regime 2) with 87.5% win rate. Consider avoiding High vol (regime 5) where win rate drops to 50%."
}
```

---

### 5. `suggest_filters`

**Purpose:** Analyze a block's losing trades and suggest market-based filters that would have improved performance.

**Input Schema:**
```typescript
{
  blockId: string,
  strategy?: string,
  minImprovementPct?: number   // Only suggest filters with >= X% improvement (default: 5)
}
```

**Output:**
```typescript
{
  blockId: string,
  currentStats: {
    trades: number,
    winRate: number,
    totalPl: number,
    sharpe: number
  },
  suggestedFilters: [
    {
      filter: string,           // e.g., "Skip when Gap_Pct > 1.0%"
      condition: {
        field: string,
        operator: '>' | '<' | '>=' | '<=' | '==' | 'in',
        value: number | number[]
      },
      tradesRemoved: number,
      winnersRemoved: number,
      losersRemoved: number,
      newStats: {
        trades: number,
        winRate: number,
        totalPl: number,
        sharpe: number
      },
      improvement: {
        winRateDelta: number,
        plDelta: number,
        sharpeDelta: number
      },
      confidence: 'high' | 'medium' | 'low'  // Based on sample size
    }
  ],
  combinedFilter: {
    // If multiple filters are applied together
    filters: string[],
    newStats: { ... },
    improvement: { ... }
  }
}
```

**Example Output:**
```json
{
  "blockId": "dumpy dump",
  "suggestedFilters": [
    {
      "filter": "Skip when |Gap_Pct| > 0.8%",
      "tradesRemoved": 4,
      "winnersRemoved": 1,
      "losersRemoved": 3,
      "improvement": {
        "winRateDelta": 6.2,
        "plDelta": 8500,
        "sharpeDelta": 1.8
      },
      "confidence": "medium"
    },
    {
      "filter": "Skip when VIX_Change_Pct > 5%",
      "tradesRemoved": 2,
      "winnersRemoved": 0,
      "losersRemoved": 2,
      "improvement": { ... },
      "confidence": "low"
    }
  ]
}
```

---

### 6. `find_missed_opportunities`

**Purpose:** Identify days matching entry criteria where no trade was taken, with hypothetical outcomes.

**Input Schema:**
```typescript
{
  blockId: string,             // Reference block for typical entry conditions
  startDate: string,
  endDate: string,
  entryConditions?: {          // Override inferred conditions
    dayOfWeek?: number[],
    minVix?: number,
    maxVix?: number,
    volRegime?: number[],
    termStructure?: number[]
  },
  limit?: number
}
```

**Output:**
```typescript
{
  tradedDays: number,
  potentialDays: number,       // Days matching conditions but not traded
  missedDays: [
    {
      date: string,
      marketContext: {
        VIX_Close: number,
        Gap_Pct: number,
        Intraday_Return_Pct: number,
        // ...
      },
      // What would have happened (directional estimate only)
      estimatedFavorability: 'high' | 'medium' | 'low',
      reasoning: string        // Why this day looks favorable
    }
  ]
}
```

**Note:** This tool provides **qualitative** assessment, not P&L estimates. Without options chain data, we can only assess market conditions, not actual trade outcomes.

---

## Implementation Priority

### Phase 1 (Core)
1. `get_market_context` - Foundation for all other tools
2. `enrich_trades` - Enables joining to existing analysis

### Phase 2 (Analysis)
3. `analyze_regime_performance` - High-value insight generation
4. `suggest_filters` - Actionable improvement suggestions

### Phase 3 (Discovery)
5. `find_similar_days` - Pattern recognition
6. `find_missed_opportunities` - Opportunity identification

---

## Data Loading

### CSV Parser Requirements

The market data CSV uses TradingView's export format:
- First column: timestamp (will be converted to date)
- Column headers match PineScript plot names
- NA values for missing data (especially VIX9D/VIX3M on older dates)

### Caching Strategy

- Load CSV once on first market data request
- Cache in memory for session duration
- Invalidate if CSV file modified time changes
- Index by date for O(1) lookups

### Date Matching

When joining to trades:
- Parse trade `dateOpened` to YYYY-MM-DD
- Match to market data `date` field
- Handle timezone: both should be in ET (market time)

---

## Example Workflow

### Analyzing Dumpy Dump Strategy

```
User: "Why did I lose money in September?"

Claude: [Calls get_market_context for Sep 2025]
        [Calls analyze_regime_performance segmented by gap direction]

Response: "Your September losses clustered on large gap-down days.
The strategy lost on Sep 2 (gap -58.75 points) and Sep 9 (gap +8.18).
Suggest testing filter: Skip when |Gap_Pct| > 0.5%"

User: "What would that filter have done to my overall stats?"

Claude: [Calls suggest_filters for dumpy dump block]

Response: "Applying |Gap_Pct| < 0.5% filter:
- Removes 5 trades (2 winners, 3 losers)
- Win rate: 81% → 87%
- Net P&L: $108,831 → $115,200
- Sharpe: 9.7 → 11.2

This filter has medium confidence due to small sample of removed trades."
```

---

## Future Enhancements

### With Options Chain Data
If historical options data becomes available:
- `simulate_structure` - Accurate P&L estimation
- `backtest_structure` - Full strategy backtesting
- `compare_structures` - Head-to-head comparison
- `find_optimal_structure` - Parameter optimization

### With Intraday Data
If intraday price checkpoints are added:
- Intraday entry timing optimization
- Max adverse excursion analysis
- Partial fill / scaling analysis
