# Architecture

**Analysis Date:** 2026-01-11

## Pattern Overview

**Overall:** Layered Client-Side Application with Domain-Driven Design for trading domain

**Key Characteristics:**
- 100% client-side processing (no backend API)
- Block-based data organization for trading portfolios
- Dual storage: IndexedDB for persistence, Zustand for UI state
- Comprehensive calculation engine for financial metrics

## Layers

**Presentation Layer:**
- Purpose: User interface and interaction
- Contains: Next.js pages, React components, Plotly charts
- Location: `app/`, `components/`
- Depends on: State management layer
- Used by: End users

**State Management Layer:**
- Purpose: UI state coordination and data access
- Contains: Zustand stores for blocks, performance, calendar, walk-forward
- Location: `lib/stores/*.ts`
- Depends on: Services layer, IndexedDB layer
- Used by: Presentation layer

**Service/Orchestration Layer:**
- Purpose: Complex multi-step calculations with progress tracking
- Contains: Performance snapshot builder, calendar data operations
- Location: `lib/services/*.ts`
- Depends on: Calculation engine, data layer
- Used by: Stores

**Calculation Engine:**
- Purpose: Financial metrics and statistical analysis
- Contains: Portfolio stats, Monte Carlo, correlation, walk-forward analysis
- Location: `lib/calculations/*.ts`
- Depends on: Data models, mathjs
- Used by: Services, stores

**Data Processing Layer:**
- Purpose: CSV import and data transformation
- Contains: CSV parser, trade processor, daily log processor
- Location: `lib/processing/*.ts`
- Depends on: Data models, validators
- Used by: Block import flow

**Data Model Layer:**
- Purpose: Domain entity definitions and validation
- Contains: TypeScript interfaces, Zod validators
- Location: `lib/models/*.ts`
- Depends on: None (leaf layer)
- Used by: All other layers

**Data Persistence Layer:**
- Purpose: IndexedDB operations and caching
- Contains: Store modules for blocks, trades, daily logs, calculations
- Location: `lib/db/*.ts`
- Depends on: Data models
- Used by: State management layer

**Utilities Layer:**
- Purpose: Shared helper functions
- Contains: Time conversions, CSV headers, export helpers
- Location: `lib/utils/*.ts`
- Depends on: None
- Used by: All layers

## Data Flow

**CSV Import Flow:**

1. User uploads CSV file in Block Dialog (`components/block-dialog.tsx`)
2. CSVParser.parseFile() parses raw content (`lib/processing/csv-parser.ts`)
3. TradeProcessor.processFile() validates and transforms (`lib/processing/trade-processor.ts`)
4. Trades stored in IndexedDB (`lib/db/trades-store.ts`)
5. Block created with metadata (`lib/db/blocks-store.ts`)
6. recalculateBlock() triggers calculations (`lib/stores/block-store.ts`)
7. buildPerformanceSnapshot() computes all metrics (`lib/services/performance-snapshot.ts`)
8. Results cached for instant page loads (`lib/db/performance-snapshot-cache.ts`)

**Block Data Access Flow:**

1. UI component requests data via Zustand store
2. Store checks performance snapshot cache
3. Cache hit: Return cached SnapshotData
4. Cache miss: Load from IndexedDB, compute via PortfolioStatsCalculator
5. Store result in cache, update UI

**State Management:**
- File-based: All persistent state in IndexedDB (`TradeBlocksDB` v4)
- Ephemeral: Zustand stores for UI selections and filters
- Cache strategy: Data hash-based invalidation

## Key Abstractions

**Block:**
- Purpose: Portfolio/strategy unit containing trade data
- Examples: `ProcessedBlock` in `lib/models/block.ts`
- Pattern: Entity with relationships (trades, daily logs, reporting logs)

**Trade:**
- Purpose: Individual trade record
- Examples: `Trade` interface in `lib/models/trade.ts`
- Pattern: Value object with calculated enrichments

**PortfolioStatsCalculator:**
- Purpose: Calculate all portfolio metrics
- Examples: `lib/calculations/portfolio-stats.ts`
- Pattern: Stateless calculator with config

**Store:**
- Purpose: Client-side state container
- Examples: `useBlockStore`, `usePerformanceStore` in `lib/stores/`
- Pattern: Zustand store with actions and selectors

## Entry Points

**Application Entry:**
- Location: `app/layout.tsx`
- Triggers: Page load
- Responsibilities: Theme provider, database initialization

**Main Hub:**
- Location: `app/(platform)/blocks/page.tsx`
- Triggers: User navigation, root redirect
- Responsibilities: Block management, data import

**Platform Layout:**
- Location: `app/(platform)/layout.tsx`
- Triggers: All platform routes
- Responsibilities: Sidebar navigation, header

## Error Handling

**Strategy:** Return defaults on calculation errors, surface critical errors to UI

**Patterns:**
- Try/catch in service methods with error logging
- Return empty arrays/objects rather than throwing
- Error state in Zustand stores for UI display
- Validation errors collected in arrays for batch processing

## Cross-Cutting Concerns

**Logging:**
- Console.log for development
- Debug logging in calculations (conditional)

**Validation:**
- Zod schemas at data import boundaries
- Type guards for runtime type checking
- CSV header normalization and alias resolution

**Caching:**
- Performance snapshot cache per block
- Combined trades cache for filtered views
- Cache invalidation on block data changes

**Timezone Handling:**
- All dates/times in US Eastern Time (America/New_York)
- DST awareness for date display
- Preserve calendar dates from CSV import

---

*Architecture analysis: 2026-01-11*
*Update when major patterns change*
