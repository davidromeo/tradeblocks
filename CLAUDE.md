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

**Math.js for Statistical Calculations**: All statistics use `math.js` library to ensure consistency with legacy Python implementation:
- Sharpe Ratio: Uses sample standard deviation (N-1) via `std(data, 'uncorrected')`
- Sortino Ratio: Uses population standard deviation (N) via `std(data, 'biased')` to match numpy
- This ensures exact parity with Python calculations

### Directory Structure

- `app/` - Next.js 15 app router pages and layouts
  - `(platform)/` - Main application routes with sidebar layout
- `components/` - React components
  - `ui/` - shadcn/ui components (Radix UI primitives)
  - `performance-charts/` - Recharts-based performance visualizations
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
- Portfolio stats tests validate consistency with legacy Python implementation
- Always test edge cases: empty datasets, single trade, missing daily logs

## Path Aliases

TypeScript is configured with `@/*` pointing to repository root, allowing imports like:
```typescript
import { Trade } from '@/lib/models/trade'
import { Button } from '@/components/ui/button'
```

## UI Component Library

Uses shadcn/ui components built on Radix UI primitives with Tailwind CSS. Components are in `components/ui/` and follow the shadcn pattern (copy-paste, not npm installed).

## State Management

Zustand stores manage:
- **block-store**: Active block selection, block metadata, statistics
- **performance-store**: Filtered performance data, chart data caching

IndexedDB stores (via `lib/db/`) handle persistence of:
- Blocks metadata
- Trade records (can be thousands per block)
- Daily log entries
- Cached calculations

## Legacy Application (Python/Dash)

The `legacy/` folder contains the original Python/Dash application that this Next.js app is migrating from. When implementing new features, reference the legacy implementation for:

### Legacy Tech Stack
- **Backend**: FastAPI + Uvicorn
- **Frontend**: Dash + Dash Mantine Components (React-based Python UI)
- **Charts**: Plotly (interactive visualizations)
- **Data Processing**: Pandas + NumPy + SciPy

### Legacy Architecture Patterns

**Hybrid FastAPI + Dash**: The legacy app uniquely combines REST API with interactive dashboard:
- FastAPI serves stateless API endpoints at `/api/v1/*`
- Dash provides the interactive UI mounted at root `/`
- WSGIMiddleware bridges the two frameworks

**Data Models** (`legacy/app/data/models.py`):
- `Trade` - Pydantic model matching CSV structure (date/time as Python date/time objects)
- `Portfolio` - Collection of trades with metadata
- `PortfolioStats` - Calculated statistics (matches `lib/models/portfolio-stats.ts`)
- `StrategyStats` - Per-strategy metrics

**Calculation Modules** (`legacy/app/calculations/`):
- `performance.py` - PerformanceCalculator class with comprehensive metrics
- `geekistics.py` - Advanced statistical analysis (geek statistics)
- `monte_carlo.py` - Monte Carlo simulations for risk analysis
- `position_sizing.py` - Kelly criterion and position sizing
- `correlation.py` - Strategy correlation analysis
- `shared.py` - Common calculation utilities

**UI Components** (`legacy/app/dash_app/components/tabs/`):
- `performance_charts.py` - Equity curves, drawdowns, returns distribution
- `geekistics.py` - Advanced statistics visualization
- `risk_simulator.py` - Monte Carlo simulation UI
- `position_sizing.py` - Position sizing calculator
- `correlation_matrix.py` - Strategy correlation heatmap
- `trade_data.py` - Trade log data table

### When to Reference Legacy Code

**Calculation Consistency**: When implementing calculations in TypeScript, reference the Python implementation to ensure mathematical parity:
- NumPy → math.js equivalents
- Pandas operations → manual TypeScript/array operations
- Statistical formulas (Sharpe, Sortino, drawdowns) must match exactly

**Feature Implementation**: When building new features, check if they exist in legacy:
1. Look for UI component in `legacy/app/dash_app/components/tabs/`
2. Find corresponding calculation logic in `legacy/app/calculations/`
3. Check callback behavior in `legacy/app/dash_app/callbacks/`
4. Replicate the core logic in TypeScript

**Data Processing**: CSV parsing and trade processing logic in `legacy/app/data/processor.py` shows the exact field mapping and validation rules used historically.

### Running Legacy Application

```bash
# From repository root
PYTHONPATH=/Users/davidromeo/Code/tradeblocks python legacy/app/main.py

# Run legacy tests
PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest legacy/tests/ -v
```

### Migration Notes

- Legacy uses Pydantic models; Next.js uses TypeScript interfaces
- Legacy stores data in Dash clientside storage (`dcc.Store`); Next.js uses IndexedDB
- Legacy uses Plotly charts; Next.js uses Recharts (similar but different API)
- Math.js in TypeScript configured to match NumPy behavior (see "Math.js for Statistical Calculations" above)
