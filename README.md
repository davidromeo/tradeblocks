# TradeBlocks

TradeBlocks is a Next.js 15 analytics workspace for evaluating options trading performance. Upload trade and daily portfolio CSV exports to calculate portfolio statistics, visualize equity curves, run Monte Carlo risk simulations, and compare strategies in one place.

## Highlights
- **Block-based workflows:** Organize trade logs, optional daily logs, and derived statistics into named "blocks" you can activate, edit, and recalculate on demand.
- **Performance dashboards:** Explore win rates, P&L breakdowns, and cumulative performance per block from the Block Stats and Performance Blocks views.
- **Risk tooling:** Drive the Monte Carlo risk simulator, position sizing helpers, and correlation matrix with the same underlying block data for consistent insights.
- **Client-side persistence:** All imported data is stored in the browser's IndexedDB so large CSVs stay fast and private. Metadata and derived metrics are cached for quick reloads.

## Getting Started
1. **Prerequisites:** Node.js 20 LTS (18.18+ works) and npm.

   For debian: 
   ```bash
   sudo apt install nodejs npm
   ```

2. **Clone the repository and move to the tradeblocks directory:**
   ```bash
   git clone https://github.com/davidromeo/tradeblocks.git
   cd tradeblocks
   ```
   
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Start tradeblocks:**

   Open a browser of your choice and visit:
   
   ```bash
   http://localhose:3000 
   ```
   Tips:
   - Use http (not https).
   - The root route redirects to `/blocks` where you can manage portfolios.

### Importing Data
1. Navigate to **Block Management** (`/blocks`) and select **New Block**.
2. Upload your trade log CSV (required) and optional daily log CSV. Expected headers follow the OptionOmega export format:
   - Trade logs: `Date Opened`, `Time Opened`, `P/L`, `Strategy`, `Opening Commissions + Fees`, etc.
   - Daily logs (optional): `Date`, `Net Liquidity`, `P/L`, `P/L %`, `Drawdown %`.
3. Save the block and activate it to see statistics populate throughout the app.

> Tip: Locally stored data lives in IndexedDB and can be reset by clearing the browser's application storage.

## Available Scripts
- `npm run dev` – start the Turbopack-powered dev server.
- `npm run build` / `npm start` – create and serve an optimized production build.
- `npm run lint` – run ESLint across the project.
- `npm test` – execute all Jest tests (uses `fake-indexeddb` to simulate browser storage).
- `npm run test:watch`, `npm run test:coverage`, `npm run test:portfolio` – additional testing modes.

## Directory Overview
- `app/` – App Router pages (`(platform)` contains the authenticated workspace experience).
- `components/` – UI building blocks, including shadcn/ui wrappers and analytics widgets.
- `lib/` – Core domain logic: CSV parsing, IndexedDB access, calculations, Zustand stores, and shared models.
- `tests/` – Unit and integration tests with fixtures under `tests/data/`.
- `legacy/` – Original Python/Dash reference implementation for parity checks.

## Developer Documentation
- `docs/development.md` – In-depth developer guide covering architecture, data flow, and local workflows.

## Contributing
1. Create a feature branch.
2. Update or add tests when behaviour changes.
3. Run `npm run lint` and `npm test` before opening a pull request.

TradeBlocks is actively evolving—additions should maintain parity with the legacy analytics while leaning into the block-based architecture documented above.

