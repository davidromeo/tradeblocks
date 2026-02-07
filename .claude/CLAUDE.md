# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TradeBlocks is a Next.js 15 application for analyzing options trading performance. It processes CSV exports of trade logs and daily portfolio logs to calculate comprehensive portfolio statistics, drawdowns, and performance metrics. The application uses IndexedDB for client-side storage of trading data.

## Development Commands

### Running the Application
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production bundle with Turbopack
- `npm start` - Start production server

### Testing
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:portfolio` - Run portfolio stats tests specifically

To run a single test file:
```bash
npm test -- path/to/test-file.test.ts
```

To run a specific test case:
```bash
npm test -- path/to/test-file.test.ts -t "test name pattern"
```

### Code Quality
- `npm run lint` - Run ESLint on the codebase

## Architecture

### Core Data Flow

1. **Data Import**: Users upload CSV files (trade logs and optional daily logs)
2. **Processing Pipeline**:
   - CSV parsing (`lib/processing/csv-parser.ts`)
   - Trade/daily log processing (`lib/processing/trade-processor.ts`, `lib/processing/daily-log-processor.ts`)
   - Data validation (`lib/models/validators.ts`)
3. **Storage**: Data stored in IndexedDB via store modules (`lib/db/`)
4. **Calculation**: Portfolio statistics calculated via `lib/calculations/portfolio-stats.ts`
5. **State Management**: Zustand stores (`lib/stores/`) manage UI state and coordinate data access

### Key Architectural Patterns

**Block-Based Organization**: Trading data is organized into "blocks" - each block represents a trading portfolio/strategy with:
- Trade log (required): Individual trade records
- Daily log (optional): Daily portfolio values for enhanced performance calculations
- Calculated statistics cached for performance

**Dual Storage Pattern**:
- Raw trade/daily log data → IndexedDB (via `lib/db/`)
- UI state & metadata → Zustand stores (via `lib/stores/`)
- This separation allows efficient data handling for large datasets

**Math.js for Statistical Calculations**: All statistics use `math.js` library to ensure consistency:
- Sharpe Ratio: Uses sample standard deviation (N-1) via `std(data, 'uncorrected')`
- Sortino Ratio: Uses standard downside deviation = sqrt((1/N) * sum(min(excess_i, 0)^2)) where N = total observations. This is the RMS of negative excess returns from zero, NOT std() of only the negative returns.

### Directory Structure

- `app/` - Next.js 15 app router pages and layouts
  - `(platform)/` - Main application routes with sidebar layout
- `components/` - React components
  - `ui/` - shadcn/ui components (Radix UI primitives)
  - `performance-charts/` - Plotly-based performance visualizations (via react-plotly.js)
- `lib/` - Core business logic (framework-agnostic)
  - `models/` - TypeScript interfaces and types
  - `processing/` - CSV parsing and data processing
  - `calculations/` - Portfolio statistics calculations
  - `db/` - IndexedDB operations
  - `stores/` - Zustand state management
- `tests/` - Jest test suites
  - `unit/` - Unit tests for calculations and processing
  - `integration/` - Integration tests for data flow
  - `data/` - Mock data and test fixtures

### Critical Implementation Details

**Timezone Handling**: All dates and times are processed and displayed as **US Eastern Time** (America/New_York). This is critical because:
- Trading data originates from US markets operating on Eastern Time
- CSVs contain dates/times in Eastern Time format
- When parsing dates, preserve the calendar date as-is (don't convert to UTC)
- When displaying times, show Eastern Time (with DST awareness)
- Use `toLocaleDateString('en-US')` or manual string extraction instead of `.toISOString()` which converts to UTC
- Static datasets in `tests/data/` explicitly handle Eastern Time with DST awareness

**Date Handling**: Trades use separate `dateOpened` (Date object) and `timeOpened` (string) fields. When processing CSVs, parse dates carefully and maintain consistency with legacy format.

**Trade P&L Calculations**:
- Always separate gross P&L (`trade.pl`) from commissions (`openingCommissionsFees` + `closingCommissionsFees`)
- Net P&L = gross P&L - total commissions
- Strategy filtering MUST use trade-based calculations only (not daily logs) since daily logs represent full portfolio performance

**Drawdown Calculations**:
- Uses daily logs when available for more accurate drawdowns
- Falls back to trade-based equity curve when daily logs are missing
- Portfolio value tracks cumulative returns over time
- See `lib/calculations/portfolio-stats.ts` for implementation

**IndexedDB Data References**: The `ProcessedBlock` interface uses `dataReferences` to store keys for related data in IndexedDB. When working with blocks, always load associated trades/daily logs separately.

**Risk-Free Rate Data**: Historical Treasury rates are stored in `lib/data/treasury-rates.ts`. See the file header for update instructions. To update with new rates:
1. Fetch CSV from FRED: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTB3&cosd=START_DATE&coed=END_DATE`
2. Add entries in format `"YYYY-MM-DD": X.XX,`
3. Run tests: `npm test -- tests/unit/risk-free-rate.test.ts`

### MCP Server Considerations

When adding new metrics, calculations, or chart data to the UI, **consider whether it should also be exposed via the MCP server** (`packages/mcp-server/`). The MCP server allows Claude to programmatically access portfolio data and statistics.

**Key MCP tools to consider updating:**
- `get_statistics` (in `src/tools/blocks.ts`) - Add new summary metrics here (e.g., peak exposure alongside max drawdown)
- `get_performance_charts` (in `src/tools/performance.ts`) - Add new chart data types here (e.g., daily_exposure alongside equity_curve)

**When to add to MCP:**
- New summary statistics that would be useful for AI analysis
- New time series data that could answer user questions
- New risk metrics or portfolio health indicators

**MCP server structure:**
- `src/tools/blocks.ts` - Core stats, block listing, comparisons
- `src/tools/performance.ts` - Chart data, period returns, backtest vs actual
- `src/tools/analysis.ts` - Monte Carlo, walk-forward, correlations
- `src/tools/reports.ts` - Custom queries, field statistics
- `src/tools/market-data.ts` - Market context, intraday checkpoints, ORB calculation

### Using MCP Tools Natively

The TradeBlocks MCP server is connected via `npm link`, making tools available directly as `mcp__tradeblocks__*`. Use these native tools instead of CLI commands for querying portfolio data.

**Available tools** (use `ToolSearch` to load before first use):
- `mcp__tradeblocks__list_blocks` - List all portfolio blocks (START HERE)
- `mcp__tradeblocks__get_statistics` - Get portfolio statistics for a block
- `mcp__tradeblocks__get_trades` - Get individual trades
- `mcp__tradeblocks__get_performance_charts` - Get chart data (equity curve, drawdown, etc.)
- `mcp__tradeblocks__get_market_context` - Get market data with intraday fields
- `mcp__tradeblocks__run_monte_carlo` - Run Monte Carlo simulations
- `mcp__tradeblocks__compare_backtest_to_actual` - Compare theoretical vs actual results

**Example workflow:**
```
1. ToolSearch: "select:mcp__tradeblocks__list_blocks"
2. Call mcp__tradeblocks__list_blocks to see available blocks
3. Call mcp__tradeblocks__get_statistics with a blockId
```

**Market data tips:**
- Use `includeIntraday: true` for MOC_*, P_* fields
- Use `flatten: true` to merge intraday/highlow/vix into main record
- Without `flatten`, data is nested under `intraday`, `highlow`, `vix` keys

### Trading Calendar Data Model

The Trading Calendar feature compares **backtest** (theoretical) results against **actual** (reported/live) trades. **CRITICAL**: The variable names map as follows:

| Term in UI | Model Type | CSV Source | Variable Names | Description |
|------------|------------|------------|----------------|-------------|
| **Backtest** | `Trade` | `tradelog.csv` | `backtestTrades`, `backtestPl` | Theoretical results, typically **more contracts** |
| **Actual** | `ReportingTrade` | `strategylog.csv` | `actualTrades`, `actualPl` | Live/reported trades, typically **fewer contracts** |

**Scaling Modes** (for comparing P&L fairly):
- `raw`: Show P&L values as-is, no adjustment
- `perContract`: Divide each P&L by its contract count for per-lot comparison
- `toReported`: Scale **backtest DOWN** to match actual contract counts

**Scaling Logic for `toReported`**:
```typescript
// Backtest has MORE contracts, actual has FEWER
// Scale factor < 1 to scale DOWN
const scaleFactor = actualContracts / btContracts  // e.g., 1/10 = 0.1
const scaledBacktestPl = backtestPl * scaleFactor  // Scales DOWN
const actualPl = actualPl  // Stays as-is (this is the reference)
```

**Key files**:
- `lib/models/trade.ts` - `Trade` interface (backtest)
- `lib/models/reporting-trade.ts` - `ReportingTrade` interface (actual)
- `lib/stores/trading-calendar-store.ts` - State management and scaling
- `lib/services/calendar-data.ts` - `scaleStrategyComparison()` function

## Testing Strategy

Tests use `fake-indexeddb` for IndexedDB simulation. When writing tests:
- Import `tests/setup.ts` is configured automatically via Jest setup
- Use mock data from `tests/data/` when possible
- Portfolio stats tests validate consistency
- Always test edge cases: empty datasets, single trade, missing daily logs

## Path Aliases

TypeScript is configured with path aliases for clean imports:

```typescript
// Library imports use the workspace package
import { Trade, PortfolioStatsCalculator } from '@tradeblocks/lib'
import { useBlockStore } from '@tradeblocks/lib/stores'

// Component imports use root-relative paths
import { Button } from '@/components/ui/button'
```

The `@tradeblocks/lib` workspace package (in `packages/lib/`) exports all models, calculations, processing, db, and utility functions. Stores are exported separately from `@tradeblocks/lib/stores`.

## UI Component Library

Uses shadcn/ui components built on Radix UI primitives with Tailwind CSS. Components are in `components/ui/` and follow the shadcn pattern (copy-paste, not npm installed).

## Charting

All performance charts use **Plotly** via `react-plotly.js`, NOT Recharts. Charts follow a consistent pattern:

1. **Use `ChartWrapper`** (`components/performance-charts/chart-wrapper.tsx`) - provides consistent Card styling, theme support, tooltips, and Plotly configuration
2. **Import types from plotly.js**: `import type { Layout, PlotData } from 'plotly.js'`
3. **Build traces in useMemo** with proper typing: `const traces: Partial<PlotData>[] = [...]`
4. **Pass to ChartWrapper**: `<ChartWrapper title="..." data={traces} layout={layout} />`

Common Plotly features used:
- Stacked areas: `stackgroup: "one"`, `groupnorm: "percent"`
- Fill to zero: `fill: 'tozeroy'`
- Custom hover: `hovertemplate: '...<extra></extra>'`

## Form Input Patterns

**Number inputs with validation**: When creating number inputs that users need to edit freely (delete and retype), use a two-state pattern:

```typescript
const [value, setValue] = useState<number>(10)           // Actual validated value
const [inputValue, setInputValue] = useState<string>("10") // String for input display

const handleBlur = () => {
  const val = parseInt(inputValue, 10)
  if (!isNaN(val) && val >= min && val <= max) {
    setValue(val)
    setInputValue(String(val))
  } else {
    setInputValue(String(value)) // Revert to last valid value
  }
}

<Input
  type="number"
  value={inputValue}
  onChange={(e) => setInputValue(e.target.value)}
  onBlur={handleBlur}
  onKeyDown={(e) => e.key === "Enter" && handleBlur()}
/>
```

This pattern allows users to delete the entire value and type a new number, with validation only on blur or Enter.

## State Management

Zustand stores manage:
- **block-store**: Active block selection, block metadata, statistics
- **performance-store**: Filtered performance data, chart data caching

IndexedDB stores (via `lib/db/`) handle persistence of:
- Blocks metadata
- Trade records (can be thousands per block)
- Daily log entries
- Cached calculations

**When starting work on a Next.js project, ALWAYS call the `init` tool from
next-devtools-mcp FIRST to set up proper context and establish documentation
requirements. Do this automatically without being asked.**

## GSD Workflow Rules

1. **Use GSD method for all features:**
   - `/gsd:discuss-phase` - Understand requirements
   - `/gsd:plan-phase` - Create PLAN.md with tasks
   - `/gsd:execute-plan` - Execute with subagents
   - NEVER code without a plan

2. **Subagent execution:**
   - Spawn multiple subagents IN PARALLEL (single message, multiple Task calls)
   - Each subagent gets fresh 200k context
   - Subagents commit their own work and create SUMMARY.md
   - Main context only for orchestration (~5% usage)
   - NEVER use TaskOutput to read full subagent output

3. **Plans location:** `.planning/phases/XX-name/`

4. **After subagent work:** Always run `npm run typecheck` before final commit

5. **Version management:**
   - Bump MCP server version in `packages/mcp-server/package.json` when MCP functionality changes (new tools, API changes, bug fixes)
   - Version bumps can happen mid-milestone if MCP changes are shipped
   - Follow semver: patch for fixes, minor for new features, major for breaking changes

6. **Milestone completion checklist:**
   - Archive milestone to `.planning/milestones/`
   - Update `.planning/MILESTONES.md`, `ROADMAP.md`, `PROJECT.md`, `STATE.md`
   - Create git tag `v{X.Y}` for the milestone