# Codebase Structure

**Analysis Date:** 2026-01-11

## Directory Layout

```
tradeblocks/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx               # Root layout with theme provider
│   ├── page.tsx                 # Redirect to /blocks
│   └── (platform)/              # Platform layout group
│       ├── layout.tsx           # Sidebar + header layout
│       ├── blocks/              # Block management
│       ├── block-stats/         # Block statistics
│       ├── performance-blocks/  # Performance analysis
│       ├── trading-calendar/    # Backtest vs actual comparison
│       ├── walk-forward/        # Walk-forward analysis
│       ├── tail-risk-analysis/  # Tail risk metrics
│       ├── risk-simulator/      # Monte Carlo simulation
│       ├── position-sizing/     # Position sizing calculator
│       ├── correlation-matrix/  # Correlation analysis
│       ├── static-datasets/     # Static data management
│       └── assistant/           # AI assistant page
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components (40+)
│   ├── performance-charts/      # Plotly charts (22+)
│   ├── report-builder/          # Custom report components (21+)
│   ├── trading-calendar/        # Calendar-specific
│   ├── position-sizing/         # Position sizing UI
│   ├── risk-simulator/          # Risk simulation UI
│   ├── static-datasets/         # Dataset management UI
│   ├── tail-risk/              # Tail risk UI
│   └── walk-forward/           # Walk-forward UI
├── lib/                         # Core business logic
│   ├── models/                 # TypeScript interfaces (16 files)
│   ├── calculations/           # Statistics engine (22 files)
│   ├── processing/            # CSV parsing & ETL (8 files)
│   ├── db/                    # IndexedDB persistence (13 files)
│   ├── stores/               # Zustand state (6 stores)
│   ├── services/            # Orchestration (2 services)
│   ├── utils/              # Helper functions (10+ files)
│   └── metrics/             # Specific metrics (1 file)
├── hooks/                  # Custom React hooks
├── tests/                  # Jest test suites
│   ├── unit/              # Unit tests (60+ files)
│   ├── integration/       # Integration tests
│   ├── lib/               # Library-specific tests
│   └── data/              # Test fixtures and mock data
├── public/               # Static assets
├── docs/                # Documentation
└── [config files]       # Project configuration
```

## Directory Purposes

**app/:**
- Purpose: Next.js 15 App Router pages and layouts
- Contains: Route pages, layouts, loading states
- Key files: `layout.tsx`, `(platform)/layout.tsx`
- Subdirectories: Route groups for platform features

**components/ui/:**
- Purpose: shadcn/ui component library (Radix UI + Tailwind)
- Contains: 40+ reusable UI components
- Key files: `button.tsx`, `dialog.tsx`, `card.tsx`, `table.tsx`
- Pattern: Copy-paste components, not npm installed

**components/performance-charts/:**
- Purpose: Plotly-based data visualization
- Contains: 22+ chart components
- Key files: `chart-wrapper.tsx`, `equity-curve-chart.tsx`, `drawdown-chart.tsx`
- Pattern: ChartWrapper provides consistent Card styling and Plotly config

**lib/models/:**
- Purpose: TypeScript domain model interfaces
- Contains: Trade, Block, DailyLogEntry, PortfolioStats, etc.
- Key files: `trade.ts`, `block.ts`, `portfolio-stats.ts`, `validators.ts`
- Pattern: Interface + column mapping + validation schema

**lib/calculations/:**
- Purpose: Financial statistics calculation engine
- Contains: Portfolio stats, Monte Carlo, correlation, walk-forward
- Key files: `portfolio-stats.ts`, `monte-carlo.ts`, `correlation.ts`, `walk-forward-analyzer.ts`
- Pattern: Pure functions or stateless calculator classes

**lib/processing/:**
- Purpose: CSV import and data transformation
- Contains: Parsers, processors, data loaders
- Key files: `csv-parser.ts`, `trade-processor.ts`, `daily-log-processor.ts`, `data-loader.ts`
- Pattern: Streaming parser with progress callbacks

**lib/db/:**
- Purpose: IndexedDB persistence layer
- Contains: Store modules for each entity type, caches
- Key files: `index.ts`, `trades-store.ts`, `blocks-store.ts`, `performance-snapshot-cache.ts`
- Pattern: Promisified IDBRequest, transaction-based operations

**lib/stores/:**
- Purpose: Zustand state management
- Contains: Client state for blocks, performance, settings
- Key files: `block-store.ts`, `performance-store.ts`, `trading-calendar-store.ts`
- Pattern: create() with state + actions

**lib/services/:**
- Purpose: High-level orchestration with progress tracking
- Contains: Complex multi-step operations
- Key files: `performance-snapshot.ts`, `calendar-data.ts`
- Pattern: Async functions with progress callbacks

**lib/utils/:**
- Purpose: Shared helper functions
- Contains: Time handling, CSV helpers, export utilities
- Key files: `time-conversions.ts`, `time-formatting.ts`, `performance-export.ts`
- Pattern: Pure utility functions

**tests/:**
- Purpose: Jest test suites
- Contains: Unit, integration, and fixture data
- Key files: `setup.ts`, `data/mock-trades.ts`, `data/csv-loader.ts`
- Subdirectories: `unit/`, `integration/`, `data/`

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout, theme provider
- `app/(platform)/layout.tsx` - Platform shell with sidebar
- `app/(platform)/blocks/page.tsx` - Main block management hub

**Configuration:**
- `tsconfig.json` - TypeScript compiler options
- `next.config.ts` - Next.js configuration
- `jest.config.js` - Jest test configuration
- `eslint.config.mjs` - ESLint flat config
- `components.json` - shadcn/ui configuration
- `postcss.config.mjs` - PostCSS with Tailwind

**Core Logic:**
- `lib/calculations/portfolio-stats.ts` - Main statistics calculator
- `lib/services/performance-snapshot.ts` - Performance data builder
- `lib/stores/block-store.ts` - Block state management
- `lib/db/index.ts` - Database initialization

**Testing:**
- `tests/setup.ts` - Global Jest setup with fake-indexeddb
- `tests/data/` - Test fixtures and mock data
- `tests/unit/` - Unit tests for calculations

**Documentation:**
- `README.md` - User-facing guide
- `.claude/CLAUDE.md` - Instructions for Claude Code

## Naming Conventions

**Files:**
- kebab-case.ts: All TypeScript source files
- kebab-case.tsx: React components
- UPPERCASE.md: Important project files (README, CLAUDE)
- *.test.ts: Test files in tests/ directory

**Directories:**
- kebab-case: All directories
- Plural for collections: `stores/`, `models/`, `calculations/`

**Special Patterns:**
- `*-store.ts`: Zustand stores
- `*-processor.ts`: CSV/data processors
- `*-cache.ts`: IndexedDB cache stores
- `use-*.ts`: React hooks
- `*.test.ts`: Jest test files

## Where to Add New Code

**New Feature:**
- Primary code: `lib/calculations/` or `lib/services/`
- UI components: `components/`
- Page: `app/(platform)/feature-name/`
- Tests: `tests/unit/`

**New Component:**
- Implementation: `components/feature-name/`
- Types: Define in component file or `lib/models/`
- Tests: `tests/` if complex logic

**New Route:**
- Page: `app/(platform)/route-name/page.tsx`
- Layout: `app/(platform)/route-name/layout.tsx` (if needed)

**New Calculation:**
- Implementation: `lib/calculations/name.ts`
- Types: `lib/models/` if new interfaces needed
- Tests: `tests/unit/name.test.ts`

**New Store:**
- Implementation: `lib/stores/name-store.ts`
- Pattern: Follow `block-store.ts` structure

**Utilities:**
- Shared helpers: `lib/utils/`
- Type definitions: `lib/models/`

## Special Directories

**.planning/:**
- Purpose: Project planning documents
- Source: Created by planning workflows
- Committed: Yes

**.next/:**
- Purpose: Next.js build output
- Source: Auto-generated during build
- Committed: No (in .gitignore)

**coverage/:**
- Purpose: Test coverage reports
- Source: Generated by `npm run test:coverage`
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-11*
*Update when directory structure changes*
