# Coding Conventions

**Analysis Date:** 2026-01-11

## Naming Patterns

**Files:**
- kebab-case for all files (`trade-processor.ts`, `portfolio-stats.ts`)
- *.test.ts in tests/ directory
- index.ts for barrel exports

**Functions:**
- camelCase for all functions (`calculatePortfolioStats`, `getTradesByBlock`)
- No special prefix for async functions
- `handle` prefix for event handlers (`handleBlur`, `handleSubmit`)

**Variables:**
- camelCase for variables
- UPPER_SNAKE_CASE for constants (`REQUIRED_TRADE_COLUMNS`, `MS_PER_DAY`)
- Boolean prefixes: `is`, `has`, `should`, `can` (`isLoading`, `hasValidKelly`)

**Types:**
- PascalCase for interfaces, no I prefix (`Trade`, `Block`, not `ITrade`)
- PascalCase for type aliases (`UserConfig`, `ResponseData`)
- `Props` suffix for component props (`ChartWrapperProps`)

## Code Style

**Formatting:**
- 2-space indentation
- Semicolons required
- Double quotes for imports/strings, backticks for templates
- No explicit Prettier config (manual formatting)
- Line length: natural wrapping based on readability

**Linting:**
- ESLint 9 with flat config (`eslint.config.mjs`)
- Plugins: @next/eslint-plugin-next, eslint-plugin-react, eslint-plugin-react-hooks
- Key rules: react-hooks/rules-of-hooks (error), react-hooks/exhaustive-deps (warn)
- Run: `npm run lint`

## Import Organization

**Order:**
1. React/Next.js (`import { useState } from 'react'`)
2. External packages (`import { format } from 'date-fns'`)
3. Internal modules (`import { Trade } from '@/lib/models/trade'`)
4. Relative imports (`import { helper } from './utils'`)

**Grouping:**
- Blank line between groups
- Type imports use explicit `type` keyword (`import type { Trade }`)

**Path Aliases:**
- `@/` maps to repository root (`tsconfig.json`)
- Use: `import { Button } from '@/components/ui/button'`

## Error Handling

**Patterns:**
- Try/catch in service methods, log and surface to UI
- Return empty/default values rather than throwing for non-critical operations
- Error state in Zustand stores for UI display

**Error Types:**
- Throw on invalid input that prevents operation
- Return Result types for expected failures
- Log error with context: `console.error("Failed to X:", error)`

## Logging

**Framework:**
- Console.log for development (to be replaced with proper logger)
- Levels: log for info, error for errors, warn for warnings

**Patterns:**
- Log at service boundaries, not in utilities
- Include context: `console.log("Recalculating stats for", trades.length, "trades")`
- Debug logging removed for production/tests

## Comments

**When to Comment:**
- Explain "why" not "what"
- Document business logic and algorithms
- Mark critical implementation details with `// CRITICAL:`
- Avoid obvious comments

**JSDoc/TSDoc:**
- Required for public API functions
- Optional for internal if signature is self-explanatory
- Use @param, @returns, @throws tags
- Example from `lib/utils.ts`:
  ```typescript
  /**
   * Truncates a strategy name to a maximum length with ellipsis.
   * @param strategyName - The full strategy name
   * @param maxLength - Maximum character length (default: 40)
   * @returns Truncated strategy name with ellipsis if needed
   */
  ```

**TODO Comments:**
- Format: `// TODO: description`
- Link to issue if exists: `// TODO: Fix race condition (issue #123)`

## Function Design

**Size:**
- Keep under 50 lines
- Extract helpers for complex logic

**Parameters:**
- Max 3 parameters
- Use options object for 4+ parameters
- Destructure in parameter list: `function process({ id, name }: ProcessParams)`

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Consistent return types (don't mix undefined and null)

## Module Design

**Exports:**
- Named exports preferred
- Default exports only for React pages/components
- Export public API from index.ts barrel files

**Barrel Files:**
- index.ts re-exports public API
- Keep internal helpers private
- Avoid circular dependencies

## React Patterns

**Components:**
- Functional components only
- Props interface defined above component
- Hooks at top of component body

**State Management:**
- Zustand stores for global state
- useState for local UI state
- IndexedDB for persistence

**Number Inputs Pattern:**
```typescript
// Two-state pattern for user-editable numbers
const [value, setValue] = useState<number>(10)
const [inputValue, setInputValue] = useState<string>("10")

const handleBlur = () => {
  const val = parseInt(inputValue, 10)
  if (!isNaN(val) && val >= min && val <= max) {
    setValue(val)
    setInputValue(String(val))
  } else {
    setInputValue(String(value)) // Revert to last valid
  }
}
```

## TypeScript Patterns

**Type Safety:**
- Strict mode enabled
- Avoid `any` where possible
- Use type guards for runtime checks

**Common Patterns:**
- Partial<T> for optional config
- Omit<T, K> for derived types
- Generic constraints: `<T extends Trade>`

## Charting Patterns

**Plotly Charts:**
- Use ChartWrapper for consistent styling (`components/performance-charts/chart-wrapper.tsx`)
- Import types from plotly.js: `import type { Layout, PlotData } from 'plotly.js'`
- Build traces in useMemo with proper typing
- Pass to ChartWrapper: `<ChartWrapper title="..." data={traces} layout={layout} />`

---

*Convention analysis: 2026-01-11*
*Update when patterns change*
