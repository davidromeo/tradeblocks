# Technology Stack

**Analysis Date:** 2026-01-11

## Languages

**Primary:**
- TypeScript 5.x - All application code (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript - Build scripts, config files
- CSS - Tailwind CSS with CSS-in-JS via shadcn/ui

## Runtime

**Environment:**
- Node.js 20 LTS (18.18+ works) - `.github/workflows/ci.yml`, `README.md`
- Browser Runtime: Modern browsers with IndexedDB support

**Package Manager:**
- pnpm 8.6.7+ - `package.json`
- Lockfile: `pnpm-lock.yaml` (also `package-lock.json` for compatibility)
- Config: `.npmrc` with `package-lock=true`, `optional=true`

## Frameworks

**Core:**
- Next.js 16.0.7 - App Router, Turbopack bundler (`package.json`)
- React 19.2.1 - UI framework (`package.json`)

**Testing:**
- Jest 30.2.0 - Unit and integration tests (`jest.config.js`)
- ts-jest 29.4.4 - TypeScript preprocessor for Jest
- @testing-library/react 16.3.0 - React component testing
- @testing-library/jest-dom 6.9.1 - Custom Jest matchers
- fake-indexeddb 6.2.2 - IndexedDB mocking for tests

**Build/Dev:**
- Turbopack - Next.js native bundler (via `npm run dev --turbopack`)
- TypeScript 5.x - Compilation and type checking
- ESLint 9 - Code linting (`eslint.config.mjs`)

## Key Dependencies

**Critical:**
- zustand 5.0.8 - State management (`lib/stores/*.ts`)
- mathjs 15.1.0 - Statistical calculations for Sharpe/Sortino ratios (`lib/calculations/portfolio-stats.ts`)
- zod 4.1.11 - Schema validation (`lib/models/validators.ts`)
- plotly.js 3.1.0 + react-plotly.js 2.6.0 - Data visualization (`components/performance-charts/`)

**UI Components:**
- Radix UI primitives (20+ packages) - Headless components (`package.json`)
- lucide-react 0.556.0 - Icons
- @tabler/icons-react 3.35.0 - Additional icons
- shadcn/ui (copy-paste components) - `components/ui/` (40+ components)

**Utilities:**
- date-fns 4.1.0 - Date manipulation
- @tanstack/react-table 8.21.3 - Data tables
- @dnd-kit/* - Drag and drop
- sonner 2.0.7 - Toast notifications
- next-themes 0.4.6 - Theme switching

**Infrastructure:**
- IndexedDB (browser-native) - Client-side persistence (`lib/db/`)

## Configuration

**Environment:**
- No environment variables required (100% client-side)
- Configuration via in-browser state and IndexedDB

**Build:**
- `tsconfig.json` - TypeScript compiler options, path aliases (`@/*`)
- `next.config.ts` - Next.js configuration (minimal, defaults used)
- `postcss.config.mjs` - PostCSS with Tailwind plugin
- `eslint.config.mjs` - ESLint flat config
- `jest.config.js` - Jest test configuration
- `components.json` - shadcn/ui configuration (New York style, slate base color)

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js)
- No external dependencies (no Docker, no database)

**Production:**
- Pure static Next.js app - deployable to Vercel, Netlify, GitHub Pages
- No backend required
- All data stored in browser IndexedDB

---

*Stack analysis: 2026-01-11*
*Update after major dependency changes*
