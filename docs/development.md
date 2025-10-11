# TradeBlocks Developer Guide

This document explains how TradeBlocks is structured and how to work effectively inside the codebase. Pair it with the top-level `README.md` for quick-start instructions.

## Environment & Tooling
- **Runtime:** Node.js 20 LTS (Next.js 15 requires >=18.18, but we develop against 20 for parity with Vercel).
- **Package manager:** npm (lockfile committed). Husky installs git hooks via `npm install`.
- **Type system:** TypeScript with `strict` mode.
- **Linting:** ESLint 9 + Next.js config (`npm run lint`).
- **Formatting:** Rely on ESLint + Prettier-in-ESLint; no dedicated `format` script.
- **Testing:** Jest 30 with `ts-jest` and `fake-indexeddb` to emulate browser storage.

### First-Time Setup
1. `npm install`
2. `npm run dev`
3. Visit `http://localhost:3000` → you will be redirected to `/blocks`.
4. Create your first block and upload a trade CSV (sample: `IC_Trades.csv`).

> Resetting locally stored data: open your browser dev tools → **Application** tab → clear IndexedDB storage and `localStorage` key `tradeblocks-active-block-id`.

## Application Architecture

### High-Level Flow
1. **Block creation** – Users import CSV files through `/blocks` using `BlockDialog`.
2. **Parsing** – Files are parsed via `lib/processing/csv-parser.ts`, converted into domain models in `lib/models/*`.
3. **Storage** – Raw rows live in IndexedDB (`lib/db/`). Metadata (names, timestamps, counts) persists alongside references to stored records.
4. **State management** – Zustand stores (`lib/stores/`) expose application state to React components. Active block selection is cached in `localStorage` for reload persistence.
5. **Calculations** – Portfolio statistics, drawdowns, and Monte Carlo inputs are computed inside `lib/calculations/*`, primarily `portfolio-stats.ts`.
6. **Presentation** – App Router routes under `app/(platform)/` render dashboard experiences powered by the stores and calculations.

### Routing & Layout
- `app/page.tsx` redirects to `/blocks`.
- `app/(platform)/layout.tsx` wires the persistent sidebar (`components/app-sidebar.tsx`) and header.
- Primary screens:
  - `/blocks` – block CRUD + activation (see `app/(platform)/blocks/page.tsx`).
  - `/block-stats` – overview cards and summary metrics.
  - `/performance-blocks` – strategy filters, equity curve charts, and performance tables.
  - `/position-sizing` – Kelly calculations and sizing guidance.
  - `/risk-simulator` – Monte Carlo simulator (see audit in `RISK_SIMULATOR_AUDIT.md`).
  - `/correlation-matrix` – cross-strategy correlation heatmap.

### State & Persistence
- **Zustand stores**
  - `lib/stores/block-store.ts` – block metadata, activation, CRUD, recalculation.
  - `lib/stores/performance-store.ts` – derived performance datasets and caching.
  - Additional feature-specific stores live alongside their modules.
- **IndexedDB adapters**
  - `lib/db/index.ts` centralizes database initialization.
  - `lib/db/trade-store.ts`, `lib/db/daily-log-store.ts`, etc. manage raw data collections.
- **Data references** – `ProcessedBlock` keeps keys to related data for lazy retrieval (`lib/models/block.ts`). When you fetch a block, load trades/daily logs explicitly via the store helpers.

### Calculations & Utilities
- `lib/calculations/portfolio-stats.ts` – Computes win rates, drawdowns, expectancy, and normalized metrics. Uses Math.js to mirror the legacy Python implementation (sample standard deviation on Sharpe, population on Sortino).
- `lib/calculations/risk/` – Monte Carlo simulation helpers powering the risk simulator.
- `lib/processing/trade-processor.ts` & `daily-log-processor.ts` – Convert raw CSV strings into typed models, handling alias headers and data validation (`lib/models/validators.ts`).
- `lib/utils/date.ts`, `lib/utils/number.ts` – Reusable formatting helpers.

### UI Components
- `components/ui/` – shadcn/ui primitives configured with Tailwind CSS.
- `components/performance-charts/` – Recharts components for equity curves and strategy comparisons.
- `components/block-dialog.tsx`, `components/sidebar-active-blocks.tsx`, etc. orchestrate import flows and navigation.

## CSV Schema Reference

### Trade Logs (required)
- Expected headers match OptionOmega exports (`lib/models/trade.ts`). Key columns:
  - `Date Opened`, `Time Opened`, `Legs`, `P/L`, `Strategy`
  - `Opening Commissions + Fees`, `Closing Commissions + Fees`
  - Ratio columns such as `Opening Short/Long Ratio` are optional but supported.
- Aliases in `TRADE_COLUMN_ALIASES` normalize variants (e.g., `Opening comms & fees`).

### Daily Logs (optional)
- `Date`, `Net Liquidity`, `P/L`, `P/L %`, `Drawdown %` are required (`lib/models/daily-log.ts`).
- When absent, drawdown calculations fall back to trade-based equity curves.

## Testing
- Global Jest setup lives in `tests/setup.ts` (auto-configured via `jest.config.js`).
- `fake-indexeddb` simulates browser storage for stores/calculations.
- Focused suites:
  - `tests/unit/` – pure functions (parsers, calculators, utils).
  - `tests/integration/` – multi-module flows (e.g., block ingestion to stats).
  - `tests/data/` – fixture CSV rows.
- Useful scripts:
  - `npm test -- path/to/file.test.ts`
  - `npm test -- path/to/file.test.ts -t "test case name"`
- Coverage reports output to `coverage/` via `npm run test:coverage`.


## Development Tips
- Use the `plans/` directory for task breakdowns if you want structured TODOs (optional).
- Tailwind CSS configuration lives in `tailwind.config.ts` produced via `@tailwindcss/postcss` (Tailwind v4). Check `app/globals.css` for design tokens.
- Components expect the `@/*` alias (configured in `tsconfig.json`)—prefer it over relative paths.
- When debugging IndexedDB, the store names mirror file names (e.g., `tradeblocks-trades`); inspect them via browser dev tools.
- `npm run build` uses Turbopack; large third-party imports (Plotly/Recharts) can impact bundle size, so keep an eye on analytics when adding dependencies.

## Useful Links
- [Next.js App Router Docs](https://nextjs.org/docs) – base framework.
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) – state management used across stores.
- [Math.js](https://mathjs.org/docs/reference/functions.html) – statistics helpers used for parity with the Python implementation.

For questions or larger architectural changes, start with an architecture sketch in `plans/` or open a discussion referencing the relevant modules above.

## Comparison Blocks Roadmap

Tracking the live-vs-reporting comparison work so we keep implementation aligned with the UX we just shipped.

### Phase 1 – Strategy Alignment (done)
- Optional reporting log upload alongside trade & daily logs.
- Strategy mapping UI with single-select dialog, inline edit/delete, and auto-save to IndexedDB.
- Ledger view showing mappings, coverage indicators to spot unmapped strategies.

### Phase 2 – Reconciliation Analytics (in progress)
1. **Data plumbing**
   - Fetch aligned reporting + live trades per block (re-use `CsvTestDataLoader` + `reporting-trade-processor`).
   - Produce normalized trade records for comparison (dates, legs, premium per contract, fees).
2. **Pair analysis**
   - For each aligned pair, compute totals: trade count, net P/L, average premium, commissions.
   - Generate deltas and ratios (actual vs theoretical P/L, fill variance, timing differences).
   - Flag missing data (trades in one source only, reporting entries with no live fill).
3. **Aggregated metrics**
   - Portfolio-level tiles: total delta, % explained by slippage, % by missing trades.
   - Slippage diagnostics: scatter of premium delta vs VIX/movement; histogram of slippage.
   - Timeline comparison: cumulative P/L overlay (live vs reporting) + variance bands.
   - Daily impact: map deltas onto daily log drawdowns to show where discrepancies hurt/benefited equity.
4. **Exception handling**
   - Present unmatched items in a dedicated list with quick filters (reporting-only, live-only, stale mapping).
   - Allow tagging/notes for follow-up.

### Phase 3 – UX polish & automation (planned)
- Suggested strategy matches (name similarity, date overlap) surfaced in the dialog.
- Search/filter inputs for long strategy lists.
- Export report (CSV/PDF) summarizing reconciliation per block.
- Optional notifications when new uploads introduce mismatched strategies.

Keep this section updated as we implement analytics so future contributors understand what remains.
