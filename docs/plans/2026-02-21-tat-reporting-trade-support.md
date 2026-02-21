# TAT Reporting Trade Support - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Parse TAT (Trade Automation Toolbox) CSV exports into ReportingTrade objects so the existing Trading Calendar comparison works with OO backtests + TAT execution results.

**Architecture:** Add a shared TAT adapter in `packages/lib/processing/` that converts TAT CSV rows to `ReportingTrade`. Both the website (`ReportingTradeProcessor`) and MCP server (`block-loader.ts`) detect TAT format by headers and route to this adapter. No changes to matching, scaling, or comparison infrastructure.

**Tech Stack:** TypeScript, Zod validation, Jest tests

**Design doc:** `docs/plans/2026-02-21-tat-reporting-trade-support-design.md`

---

### Task 1: TAT Adapter - Core Conversion Logic

**Files:**
- Create: `packages/lib/processing/tat-adapter.ts`
- Test: `tests/unit/tat-adapter.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/tat-adapter.test.ts` with tests for the core adapter:

```typescript
import {
  isTatFormat,
  convertTatRowToReportingTrade,
  buildTatLegsString,
} from '@tradeblocks/lib/processing/tat-adapter'

// Sample TAT CSV row (from real export)
const SAMPLE_TAT_ROW: Record<string, string> = {
  Account: 'IB:U***1234',
  Date: '1/30/2026',
  TimeOpened: '10:04 AM',
  TimeClosed: '3:51 PM',
  TradeType: 'DoubleCalendar',
  StopType: 'Vertical',
  StopMultiple: '0',
  PriceOpen: '-53.1',
  PriceClose: '57.05',
  PriceStopTarget: '',
  TotalPremium: '-26550',
  Qty: '5',
  Commission: '45.65',
  ProfitLoss: '1929.35',
  Status: 'Manual Closed',
  ShortPut: '6945',
  LongPut: '6945',
  ShortCall: '6945',
  LongCall: '6945',
  BuyingPower: '26550',
  StopMultipleResult: '0',
  Slippage: '0',
  StopTrigger: 'Single Bid',
  PutDelta: '-0.504191198',
  CallDelta: '0.495787545',
  Template: 'MEDC 3/7',
  Strategy: 'DC',
  PriceLong: '113.872',
  PriceShort: '60.772',
  OpenDate: '2026-01-30',
  OpenTime: '10:04:13',
  CloseDate: '2026-01-30',
  CloseTime: '15:51:13',
  TradeID: '15780',
  ParentTaskID: '0',
  ContractCount: '20',
  UnderlyingSymbol: 'SPX',
  CustomLeg1: '',
  CustomLeg2: '',
  CustomLeg3: '',
  CustomLeg4: '',
}

// TAT headers (from real export)
const TAT_HEADERS = [
  'Account', 'Date', 'TimeOpened', 'TimeClosed', 'TradeType', 'StopType',
  'StopMultiple', 'PriceOpen', 'PriceClose', 'PriceStopTarget', 'TotalPremium',
  'Qty', 'Commission', 'ProfitLoss', 'Status', 'ShortPut', 'LongPut',
  'ShortCall', 'LongCall', 'BuyingPower', 'StopMultipleResult', 'Slippage',
  'StopTrigger', 'PutDelta', 'CallDelta', 'Template', 'Strategy', 'PriceLong',
  'PriceShort', 'OpenDate', 'OpenTime', 'CloseDate', 'CloseTime', 'TradeID',
  'ParentTaskID', 'ContractCount', 'UnderlyingSymbol',
]

// OO reporting headers
const OO_HEADERS = [
  'Date Opened', 'Time Opened', 'Opening Price', 'Legs', 'Premium',
  'Closing Price', 'Date Closed', 'Time Closed', 'P/L', 'Strategy',
  'No. of Contracts',
]

describe('TAT Adapter', () => {
  describe('isTatFormat', () => {
    it('detects TAT format from headers', () => {
      expect(isTatFormat(TAT_HEADERS)).toBe(true)
    })

    it('rejects OO format headers', () => {
      expect(isTatFormat(OO_HEADERS)).toBe(false)
    })

    it('rejects empty headers', () => {
      expect(isTatFormat([])).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(isTatFormat(TAT_HEADERS.map(h => h.toLowerCase()))).toBe(true)
    })
  })

  describe('buildTatLegsString', () => {
    it('builds legs from all four strikes (MEDC-style same strikes)', () => {
      const legs = buildTatLegsString({
        ShortPut: '6945', LongPut: '6945',
        ShortCall: '6945', LongCall: '6945',
        UnderlyingSymbol: 'SPX', TradeType: 'DoubleCalendar',
      })
      expect(legs).toContain('6945')
      expect(legs).toContain('SPX')
    })

    it('builds legs from different strikes (wide DC)', () => {
      const legs = buildTatLegsString({
        ShortPut: '6905', LongPut: '6905',
        ShortCall: '7125', LongCall: '7125',
        UnderlyingSymbol: 'SPX', TradeType: 'DoubleCalendar',
      })
      expect(legs).toContain('6905')
      expect(legs).toContain('7125')
      expect(legs).toContain('SPX')
    })

    it('handles missing strikes gracefully', () => {
      const legs = buildTatLegsString({
        ShortPut: '6945', LongPut: '6945',
        ShortCall: '', LongCall: '',
        UnderlyingSymbol: 'SPX', TradeType: 'PutCalendar',
      })
      expect(legs).toContain('6945')
      expect(legs).not.toContain('undefined')
    })

    it('handles zero strikes as missing', () => {
      const legs = buildTatLegsString({
        ShortPut: '0', LongPut: '0',
        ShortCall: '6945', LongCall: '6945',
        UnderlyingSymbol: 'SPX', TradeType: 'CallCalendar',
      })
      expect(legs).toContain('6945')
    })

    it('handles missing UnderlyingSymbol', () => {
      const legs = buildTatLegsString({
        ShortPut: '6945', LongPut: '6945',
        ShortCall: '6945', LongCall: '6945',
        UnderlyingSymbol: '', TradeType: 'DoubleCalendar',
      })
      expect(legs).toContain('6945')
      // Should not throw or return empty
      expect(legs.length).toBeGreaterThan(0)
    })
  })

  describe('convertTatRowToReportingTrade', () => {
    it('converts a complete TAT row to ReportingTrade', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)

      expect(trade.strategy).toBe('DC')
      expect(trade.pl).toBe(1929.35)
      expect(trade.numContracts).toBe(5) // Qty, NOT ContractCount
      expect(trade.initialPremium).toBe(-26550)
      expect(trade.reasonForClose).toBe('Manual Closed')
    })

    it('uses OpenDate for dateOpened (precise format)', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      // OpenDate is 2026-01-30
      expect(trade.dateOpened.getFullYear()).toBe(2026)
      expect(trade.dateOpened.getMonth()).toBe(0) // January = 0
      expect(trade.dateOpened.getDate()).toBe(30)
    })

    it('falls back to Date field when OpenDate is missing', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenDate: '' }
      const trade = convertTatRowToReportingTrade(row)
      // Date is "1/30/2026"
      expect(trade.dateOpened.getFullYear()).toBe(2026)
      expect(trade.dateOpened.getMonth()).toBe(0)
      expect(trade.dateOpened.getDate()).toBe(30)
    })

    it('formats timeOpened from OpenTime (HH:MM:SS -> H:MM AM/PM)', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      // OpenTime is "10:04:13" -> "10:04 AM"
      expect(trade.timeOpened).toBe('10:04 AM')
    })

    it('falls back to TimeOpened field when OpenTime is missing', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '' }
      const trade = convertTatRowToReportingTrade(row)
      // TimeOpened is "10:04 AM" (already formatted)
      expect(trade.timeOpened).toBe('10:04 AM')
    })

    it('uses Qty for numContracts (spreads), not ContractCount (legs)', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade.numContracts).toBe(5) // Qty=5, NOT ContractCount=20
    })

    it('uses abs(PriceOpen) for openingPrice', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade.openingPrice).toBe(53.1) // abs(-53.1)
    })

    it('maps PriceClose to closingPrice', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade.closingPrice).toBe(57.05)
    })

    it('maps CloseDate to dateClosed', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade.dateClosed).toBeDefined()
      expect(trade.dateClosed!.getFullYear()).toBe(2026)
      expect(trade.dateClosed!.getMonth()).toBe(0)
      expect(trade.dateClosed!.getDate()).toBe(30)
    })

    it('formats timeClosed from CloseTime', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      // CloseTime is "15:51:13" -> "3:51 PM"
      expect(trade.timeClosed).toBe('3:51 PM')
    })

    it('constructs legs string from strike columns', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade.legs).toBeTruthy()
      expect(trade.legs.length).toBeGreaterThan(0)
      expect(trade.legs).toContain('6945')
    })

    it('returns null for rows missing ProfitLoss', () => {
      const row = { ...SAMPLE_TAT_ROW, ProfitLoss: '' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade).toBeNull()
    })

    it('returns null for rows missing Date/OpenDate', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenDate: '', Date: '' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade).toBeNull()
    })

    it('handles PM times after noon correctly', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '15:11:02' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('3:11 PM')
    })

    it('handles midnight (00:xx) correctly', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '00:30:00' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('12:30 AM')
    })

    it('handles noon (12:xx) correctly', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '12:38:19' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('12:38 PM')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/tat-adapter.test.ts`
Expected: FAIL — module `@tradeblocks/lib/processing/tat-adapter` does not exist

**Step 3: Write the TAT adapter implementation**

Create `packages/lib/processing/tat-adapter.ts`:

```typescript
/**
 * TAT (Trade Automation Toolbox) CSV Adapter
 *
 * Converts TAT CSV export rows into ReportingTrade objects.
 * TAT is used for live execution of options strategies (primarily double calendars).
 * This adapter allows comparing TAT execution results against Option Omega backtests
 * using the existing Trading Calendar comparison infrastructure.
 *
 * TAT CSV columns (key fields):
 *   Strategy, OpenDate, OpenTime, CloseDate, CloseTime, PriceOpen, PriceClose,
 *   TotalPremium, Qty, ContractCount, ProfitLoss, Commission, Status,
 *   ShortPut, LongPut, ShortCall, LongCall, UnderlyingSymbol, TradeType, TradeID
 *
 * Critical: numContracts uses Qty (spreads), NOT ContractCount (total legs).
 * This matches OO's No. of Contracts semantics and is required for correct
 * perContract/toReported scaling math.
 */

import type { ReportingTrade } from '../models/reporting-trade'

/**
 * TAT-specific required headers for format detection.
 * All three must be present (case-insensitive) to identify a TAT export.
 */
const TAT_SIGNATURE_HEADERS = ['tradeid', 'profitloss', 'buyingpower']

/**
 * Detect whether CSV headers indicate a TAT export.
 */
export function isTatFormat(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase().trim())
  return TAT_SIGNATURE_HEADERS.every(sig => lower.includes(sig))
}

/**
 * Parse a date string preserving the calendar day.
 * Handles both YYYY-MM-DD (precise) and M/D/YYYY (display) formats.
 * Creates Date at local midnight to avoid timezone shifting.
 */
function parseTatDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  // Try YYYY-MM-DD first (OpenDate/CloseDate format)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Try M/D/YYYY (Date field format)
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (usMatch) {
    const [, month, day, year] = usMatch
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  return null
}

/**
 * Format a 24-hour time string (HH:MM:SS) to 12-hour format (H:MM AM/PM).
 * Also accepts already-formatted "H:MM AM/PM" strings and passes them through.
 */
function formatTatTime(timeStr: string): string | undefined {
  if (!timeStr || timeStr.trim() === '') return undefined

  // Already in AM/PM format? Pass through.
  if (/[AP]M$/i.test(timeStr.trim())) return timeStr.trim()

  // Parse 24-hour format: HH:MM or HH:MM:SS
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return undefined

  const hours = parseInt(match[1], 10)
  const minutes = match[2]
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return `${displayHours}:${minutes} ${period}`
}

/**
 * Build a human-readable legs string from TAT strike columns.
 *
 * Format: "SPX 6905P/7125C | 6905P/7125C DC"
 *         (short legs)      (long legs)   (trade type)
 *
 * The " | " separator is required for compatibility with the LegsRow UI
 * component which splits on it.
 */
export function buildTatLegsString(row: Record<string, string>): string {
  const symbol = (row.UnderlyingSymbol || '').trim()
  const tradeType = (row.TradeType || '').trim()
  const shortPut = (row.ShortPut || '').trim()
  const shortCall = (row.ShortCall || '').trim()
  const longPut = (row.LongPut || '').trim()
  const longCall = (row.LongCall || '').trim()

  const isPresent = (v: string) => v !== '' && v !== '0'

  // Build short leg description
  const shortParts: string[] = []
  if (isPresent(shortPut)) shortParts.push(`${shortPut}P`)
  if (isPresent(shortCall)) shortParts.push(`${shortCall}C`)
  const shortLeg = shortParts.join('/')

  // Build long leg description
  const longParts: string[] = []
  if (isPresent(longPut)) longParts.push(`${longPut}P`)
  if (isPresent(longCall)) longParts.push(`${longCall}C`)
  const longLeg = longParts.join('/')

  // Combine with symbol prefix and trade type suffix
  const prefix = symbol ? `${symbol} ` : ''
  const suffix = tradeType ? ` ${tradeType}` : ''

  if (shortLeg && longLeg) {
    return `${prefix}${shortLeg} | ${longLeg}${suffix}`
  }
  if (shortLeg) return `${prefix}${shortLeg}${suffix}`
  if (longLeg) return `${prefix}${longLeg}${suffix}`

  return tradeType || 'Unknown'
}

/**
 * Parse a numeric value from a TAT CSV field.
 * Handles empty strings, whitespace, NaN.
 */
function parseNumber(value: string | undefined, defaultValue?: number): number {
  if (!value || value.trim() === '' || value.toLowerCase() === 'nan') {
    return defaultValue ?? 0
  }
  const cleaned = value.replace(/[$,%]/g, '').trim()
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? (defaultValue ?? 0) : parsed
}

/**
 * Convert a single TAT CSV row to a ReportingTrade object.
 * Returns null if the row is missing required data (date or P/L).
 */
export function convertTatRowToReportingTrade(
  row: Record<string, string>
): ReportingTrade | null {
  // Parse date: prefer OpenDate, fall back to Date
  const dateOpened = parseTatDate(row.OpenDate) ?? parseTatDate(row.Date)
  if (!dateOpened || isNaN(dateOpened.getTime())) return null

  // P/L is required
  const plStr = (row.ProfitLoss || '').trim()
  if (!plStr) return null

  // Parse closing date: prefer CloseDate, fall back to parsing TimeClosed date
  const dateClosed = parseTatDate(row.CloseDate) ?? undefined

  // Parse times: prefer precise OpenTime/CloseTime, fall back to TimeOpened/TimeClosed
  const timeOpened = formatTatTime(row.OpenTime) ?? formatTatTime(row.TimeOpened)
  const timeClosed = formatTatTime(row.CloseTime) ?? formatTatTime(row.TimeClosed)

  const legs = buildTatLegsString(row)

  return {
    strategy: (row.Strategy || row.Template || '').trim() || 'Unknown',
    dateOpened,
    timeOpened,
    openingPrice: Math.abs(parseNumber(row.PriceOpen)),
    legs,
    initialPremium: parseNumber(row.TotalPremium),
    numContracts: parseNumber(row.Qty, 1), // Qty = spreads (matches OO semantics)
    pl: parseNumber(row.ProfitLoss),
    closingPrice: row.PriceClose ? parseNumber(row.PriceClose) : undefined,
    dateClosed,
    timeClosed,
    reasonForClose: (row.Status || '').trim() || undefined,
  }
}
```

**Step 4: Export from processing index**

Add to `packages/lib/processing/index.ts`:

```typescript
export * from './tat-adapter'
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/unit/tat-adapter.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/lib/processing/tat-adapter.ts packages/lib/processing/index.ts tests/unit/tat-adapter.test.ts
git commit -m "feat: add TAT CSV adapter for ReportingTrade conversion"
```

---

### Task 2: Integrate TAT Adapter into Website ReportingTradeProcessor

**Files:**
- Modify: `packages/lib/processing/reporting-trade-processor.ts`
- Test: `tests/unit/tat-adapter.test.ts` (add integration test)

**Step 1: Write failing integration test**

Add to `tests/unit/tat-adapter.test.ts`:

```typescript
import { ReportingTradeProcessor } from '@tradeblocks/lib'

describe('ReportingTradeProcessor TAT integration', () => {
  it('processes a TAT CSV file into ReportingTrades', async () => {
    const csvContent = [
      'Account,Date,TimeOpened,TimeClosed,TradeType,StopType,StopMultiple,PriceOpen,PriceClose,PriceStopTarget,TotalPremium,Qty,Commission,ProfitLoss,Status,ShortPut,LongPut,ShortCall,LongCall,BuyingPower,StopMultipleResult,Slippage,StopTrigger,PutDelta,CallDelta,Template,Strategy,PriceLong,PriceShort,OpenDate,OpenTime,CloseDate,CloseTime,TradeID,ParentTaskID,ContractCount,UnderlyingSymbol,CustomLeg1,CustomLeg2,CustomLeg3,CustomLeg4',
      'IB:U***1234,1/30/2026,10:04 AM,3:51 PM,DoubleCalendar,Vertical,0,-53.1,57.05,,-26550,5,45.65,1929.35,Manual Closed,6945,6945,6945,6945,26550,0,0,Single Bid,-0.504191198,0.495787545,MEDC 3/7,DC,113.872,60.772,2026-01-30,10:04:13,2026-01-30,15:51:13,15780,0,20,SPX,,,,',
      'IB:U***1234,1/30/2026,11:04 AM,3:51 PM,DoubleCalendar,Vertical,0,-54.1,57.2,,-27050,5,45.65,1504.35,Manual Closed,6940,6940,6940,6940,27050,0,0,Single Bid,-0.471937343,0.528139003,MEDC 3/7,DC,109.77,55.67,2026-01-30,11:04:26,2026-01-30,15:51:37,15790,0,20,SPX,,,,',
    ].join('\n')

    const file = new File([csvContent], 'export-2026-02-04.csv', { type: 'text/csv' })
    const processor = new ReportingTradeProcessor()
    const result = await processor.processFile(file)

    expect(result.validTrades).toBe(2)
    expect(result.invalidTrades).toBe(0)
    expect(result.trades[0].strategy).toBe('DC')
    expect(result.trades[0].numContracts).toBe(5)
    expect(result.trades[0].pl).toBe(1504.35) // sorted by date, both same date so by position
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tat-adapter.test.ts -t "ReportingTradeProcessor TAT integration"`
Expected: FAIL — TAT columns not recognized by current processor

**Step 3: Modify ReportingTradeProcessor to detect and route TAT format**

In `packages/lib/processing/reporting-trade-processor.ts`:

1. Add import at top:
```typescript
import { isTatFormat, convertTatRowToReportingTrade } from './tat-adapter'
```

2. In `processFile()`, after `parseResult` is obtained (around line 83), before the `normalizedHeaders` / `missingColumns` check (line 86), add TAT format detection:

Replace the section from line 86 (`const normalizedHeaders = ...`) through line 89 (`throw new Error(...)`) with logic that checks for TAT format first. If TAT, skip the OO column validation and use the TAT converter. If not TAT, proceed with existing OO validation and conversion.

The key change is in the conversion loop (lines 106-136). Currently it calls `this.convertToReportingTrade(rawTrade)`. For TAT format, it should call `convertTatRowToReportingTrade(rawTrade)` instead.

Specifically, after `parseResult` is populated:

```typescript
// Detect TAT format from headers
const isTat = isTatFormat(parseResult.headers)

if (!isTat) {
  // Existing OO validation
  const normalizedHeaders = normalizeHeaders(parseResult.headers, REPORTING_TRADE_COLUMN_ALIASES)
  const missingColumns = findMissingHeaders(normalizedHeaders, REQUIRED_REPORTING_TRADE_COLUMNS)
  if (missingColumns.length > 0) {
    throw new Error(`Missing required reporting trade columns: ${missingColumns.join(', ')}`)
  }
}
```

And in the conversion loop, change:
```typescript
const trade = isTat
  ? convertTatRowToReportingTrade(rawTrade as unknown as Record<string, string>)
  : this.convertToReportingTrade(rawTrade)
```

For TAT rows, `convertTatRowToReportingTrade` returns `null` for invalid rows (instead of throwing), so handle that:

```typescript
if (isTat) {
  const trade = convertTatRowToReportingTrade(rawTrade as unknown as Record<string, string>)
  if (trade) {
    trades.push(trade)
    validTrades++
  } else {
    invalidTrades++
    errors.push({
      type: 'validation',
      message: `TAT trade conversion failed at row ${i + 2}: missing required fields`,
      field: 'unknown',
      value: rawTrade,
      expected: 'Valid TAT trade data',
    })
  }
} else {
  const trade = this.convertToReportingTrade(rawTrade)
  trades.push(trade)
  validTrades++
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/tat-adapter.test.ts`
Expected: All tests PASS (both unit and integration)

**Step 5: Run existing reporting trade tests to verify no regressions**

Run: `npm test -- tests/unit/`
Expected: All existing tests still PASS

**Step 6: Commit**

```bash
git add packages/lib/processing/reporting-trade-processor.ts tests/unit/tat-adapter.test.ts
git commit -m "feat: integrate TAT adapter into ReportingTradeProcessor"
```

---

### Task 3: Integrate TAT Adapter into MCP Server

**Files:**
- Modify: `packages/mcp-server/src/utils/block-loader.ts`

**Step 1: Add TAT detection to `detectCsvType`**

In `packages/mcp-server/src/utils/block-loader.ts`, add TAT format detection in `detectCsvType()`. This should go **before** the existing reporting log detection block (before line 295) so TAT CSVs are recognized even without explicit `csvType`:

```typescript
// TAT (Trade Automation Toolbox) detection:
// Has "TradeID" AND "ProfitLoss" AND "BuyingPower"
const tatSignature = ['tradeid', 'profitloss', 'buyingpower']
const isTat = tatSignature.every(sig => headers.includes(sig))
if (isTat) {
  return 'reportinglog'
}
```

**Step 2: Add TAT routing to `convertToReportingTrade`**

Import the adapter at the top of `block-loader.ts`:

```typescript
import { isTatFormat, convertTatRowToReportingTrade } from "@tradeblocks/lib";
```

Modify `convertToReportingTrade()` (line 1032) to detect TAT format from the row's keys and route accordingly:

```typescript
function convertToReportingTrade(
  raw: Record<string, string>
): ReportingTrade | null {
  // Check if this is a TAT format row
  const keys = Object.keys(raw)
  if (isTatFormat(keys)) {
    return convertTatRowToReportingTrade(raw)
  }

  // Existing OO conversion logic...
  try {
    const normalized = normalizeRecordHeaders(raw);
    // ... rest of existing code
  }
}
```

**Step 3: Run MCP server typecheck**

Run: `npm run typecheck` (from project root)
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/utils/block-loader.ts
git commit -m "feat: add TAT format detection and routing in MCP server"
```

---

### Task 4: Verify End-to-End with Sample Data

**Files:**
- Test: manual verification with sample TAT CSV

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors

**Step 4: Verify MCP server can import TAT CSV**

Use the MCP `import_csv` tool to import the sample TAT file:

```
mcp__tradeblocks__import_csv({
  csvPath: "~/Downloads/tat gmoney/export-2026-02-04.csv",
  blockName: "TAT GMoney Feb 2026",
  csvType: "reportinglog"
})
```

Verify it imports successfully and reports correct trade count (11 trades).

**Step 5: Verify MCP server auto-detects TAT format**

Import without specifying csvType (should auto-detect):

```
mcp__tradeblocks__import_csv({
  csvPath: "~/Downloads/tat gmoney/export-2026-02-04.csv",
  blockName: "TAT GMoney Auto-Detect"
})
```

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during TAT adapter E2E verification"
```

---

### Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | TAT adapter core (tat-adapter.ts + unit tests) | None |
| 2 | Website integration (ReportingTradeProcessor routing) | Task 1 |
| 3 | MCP server integration (block-loader.ts routing + detection) | Task 1 |
| 4 | E2E verification with sample data | Tasks 1-3 |

Tasks 2 and 3 are independent of each other (both depend only on Task 1) and can be done in parallel.
