# Testing Patterns

**Analysis Date:** 2026-01-11

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.js` in project root

**Assertion Library:**
- Jest built-in expect
- @testing-library/jest-dom for DOM matchers

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm test -- -t "test name pattern"   # Specific test
npm run test:coverage                 # Coverage report
npm run test:portfolio                # Portfolio stats tests only
```

## Test File Organization

**Location:**
- All tests in `tests/` directory (not colocated with source)
- Unit tests: `tests/unit/*.test.ts`
- Integration tests: `tests/integration/*.test.ts`
- Library-specific: `tests/lib/`

**Naming:**
- Unit tests: `feature-name.test.ts`
- Integration: `feature.test.ts` in `tests/integration/`

**Structure:**
```
tests/
├── setup.ts                 # Global Jest setup, fake-indexeddb
├── unit/                    # Unit tests (60+ files)
│   ├── portfolio-stats.test.ts
│   ├── monte-carlo.test.ts
│   ├── kelly-calculator.test.ts
│   ├── walk-forward-analyzer.test.ts
│   └── ...
├── integration/             # Integration tests
│   ├── indexeddb-data-loader.test.ts
│   └── static-dataset-exact-matching.test.ts
├── lib/                     # Library-specific tests
│   ├── calculations/
│   └── utils/
└── data/                    # Test fixtures
    ├── mock-trades.ts
    ├── mock-daily-logs.ts
    ├── csv-loader.ts
    ├── tradelog.csv
    └── dailylog.csv
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, test, expect, beforeEach } from '@jest/globals'

describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // reset state
    })

    test('should handle valid input', () => {
      // arrange
      const input = createTestInput()

      // act
      const result = functionName(input)

      // assert
      expect(result).toEqual(expectedOutput)
    })

    test('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input')
    })
  })
})
```

**Patterns:**
- Use beforeEach for per-test setup
- Use afterEach to restore mocks: `jest.restoreAllMocks()`
- Explicit arrange/act/assert comments in complex tests
- One assertion focus per test (multiple expects OK)

## Mocking

**Framework:**
- Jest built-in mocking
- fake-indexeddb for IndexedDB simulation

**Patterns:**
```typescript
// Mock module
jest.mock('./external', () => ({
  externalFunction: jest.fn()
}))

// Mock IndexedDB (automatic via setup.ts)
import 'fake-indexeddb/auto'

// In test
const mockFn = jest.mocked(externalFunction)
mockFn.mockReturnValue('mocked result')
expect(mockFn).toHaveBeenCalledWith('expected arg')
```

**What to Mock:**
- IndexedDB operations (via fake-indexeddb)
- External dependencies
- Time/dates when needed

**What NOT to Mock:**
- Internal pure functions
- Simple utilities
- The code under test

## Fixtures and Factories

**Test Data:**
```typescript
// Factory functions in test file or tests/data/
function createTestTrade(overrides?: Partial<Trade>): Trade {
  return {
    dateOpened: new Date('2024-01-01'),
    timeOpened: '10:00:00',
    pl: 100,
    numContracts: 1,
    strategy: 'Test Strategy',
    ...overrides
  }
}

// Shared fixtures in tests/data/
import { mockTrades } from '@/tests/data/mock-trades'
```

**Location:**
- Factory functions: `tests/data/mock-trades.ts`, `tests/data/mock-daily-logs.ts`
- CSV fixtures: `tests/data/tradelog.csv`, `tests/data/dailylog.csv`
- CSV loader utility: `tests/data/csv-loader.ts`

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness
- Focus on critical paths (parsers, calculations)

**Configuration:**
```javascript
// jest.config.js
collectCoverageFrom: [
  'lib/**/*.{ts,tsx}',
  '!lib/**/*.d.ts',
  '!lib/**/index.ts',
]
```

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Test single function in isolation
- Mock external dependencies
- Fast: <100ms per test
- Examples: `portfolio-stats.test.ts`, `kelly-calculator.test.ts`

**Integration Tests:**
- Test multiple modules together
- Use fake-indexeddb for real database operations
- Examples: `indexeddb-data-loader.test.ts`

**E2E Tests:**
- Not currently implemented
- UI testing deferred per CLAUDE.md guidance

## Common Patterns

**Async Testing:**
```typescript
test('should handle async operation', async () => {
  const result = await asyncFunction()
  expect(result).toBe('expected')
})
```

**Error Testing:**
```typescript
test('should throw on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null')
})

// Async error
test('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('error message')
})
```

**IndexedDB Testing:**
```typescript
import 'fake-indexeddb/auto'
import { initializeDatabase, deleteDatabase } from '@/lib/db'

describe('IndexedDB Integration', () => {
  let db: IDBDatabase

  beforeAll(async () => {
    db = await initializeDatabase()
  })

  afterAll(async () => {
    await deleteDatabase()
  })

  beforeEach(async () => {
    // Clear data between tests
    await clearAllData()
  })
})
```

**Snapshot Testing:**
- Used sparingly (2 snapshots total)
- Prefer explicit assertions for clarity

## Critical Testing Decisions

**Why Jest + ts-jest?**
- Native TypeScript support
- Excellent IDE integration
- Good for Next.js projects
- fake-indexeddb solves browser storage testing

**Why No Component Tests?**
- Project focuses on data processing logic
- UI testing deferred (per CLAUDE.md: don't run app to validate UI)
- Charts tested via calculation validation

**Why fake-indexeddb?**
- Eliminates browser/Node.js incompatibility
- Fast test execution
- Deterministic results

---

*Testing analysis: 2026-01-11*
*Update when test patterns change*
