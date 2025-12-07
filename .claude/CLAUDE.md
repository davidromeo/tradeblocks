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
- Sortino Ratio: Uses population standard deviation (N) via `std(data, 'biased')` to match numpy
- This ensures exact parity with Python calculations

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

## Testing Strategy

Tests use `fake-indexeddb` for IndexedDB simulation. When writing tests:
- Import `tests/setup.ts` is configured automatically via Jest setup
- Use mock data from `tests/data/` when possible
- Portfolio stats tests validate consistency
- Always test edge cases: empty datasets, single trade, missing daily logs

## Path Aliases

TypeScript is configured with `@/*` pointing to repository root, allowing imports like:
```typescript
import { Trade } from '@/lib/models/trade'
import { Button } from '@/components/ui/button'
```

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