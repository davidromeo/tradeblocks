# TAT Reporting Trade Support

## Problem

Users running Option Omega (OO) for backtesting and TAT (Trade Automation Toolbox) for execution need to compare backtest vs actual results in TradeBlocks. The existing Trading Calendar comparison infrastructure works, but TradeBlocks can only parse OO-format reporting CSVs. TAT exports have completely different column names and semantics.

Additionally, OO itself has a reporting/actual trade export format that should also be supported as a reporting log (currently only the backtest tradelog format is supported).

## Solution

Add a TAT-to-ReportingTrade adapter that converts TAT CSV rows into the existing `ReportingTrade` model. Auto-detect TAT vs OO format based on CSV headers within the `reportinglog` type. No changes to the matching, scaling, or comparison infrastructure.

## Format Detection

When a CSV is classified as `reportinglog`, inspect headers to determine source format:

- **TAT**: Headers contain `TradeID` AND `ProfitLoss` AND `BuyingPower`
- **OO**: Headers contain `Date Opened` AND `P/L` (existing behavior, default fallback)

Detection happens in two places:
1. **Website** (`ReportingTradeProcessor`) - after CSV parsing, before row conversion
2. **MCP server** (`block-loader.ts`) - when loading/converting records

Additionally, `detectCsvType` in `block-loader.ts` gains TAT header detection so TAT CSVs imported without explicit `csvType` are correctly classified as `reportinglog`.

## TAT Field Mapping

| ReportingTrade field | TAT source | Notes |
|---|---|---|
| `strategy` | `Strategy` | Direct |
| `dateOpened` | `OpenDate` -> fallback `Date` | YYYY-MM-DD or M/D/YYYY |
| `timeOpened` | `OpenTime` -> fallback `TimeOpened` | HH:MM:SS formatted to "H:MM AM/PM" |
| `openingPrice` | `abs(PriceOpen)` | SPX underlying price at entry |
| `legs` | Constructed from strikes | `"SPX {ShortPut}P/{ShortCall}C \| {LongPut}P/{LongCall}C DC"` |
| `initialPremium` | `TotalPremium` | Direct |
| `numContracts` | `Qty` | **Spreads**, NOT `ContractCount` (which is total legs) |
| `pl` | `ProfitLoss` | Net of commissions (verified: gross - commission = ProfitLoss) |
| `closingPrice` | `PriceClose` | Direct |
| `dateClosed` | `CloseDate` -> fallback parse from `TimeClosed` | |
| `timeClosed` | `CloseTime` -> fallback `TimeClosed` | |
| `reasonForClose` | `Status` | e.g., "Profit Target", "Manual Closed" |

### Critical: numContracts Semantics

OO's `No. of Contracts` counts **spreads** (e.g., 6 = six 4-leg double calendars).
TAT has two fields:
- `Qty` = spreads (e.g., 5)
- `ContractCount` = total individual legs (e.g., 20 = 5 spreads * 4 legs)

We use `Qty` to match OO semantics. This is critical because `numContracts` drives the scaling math:
- `perContract` mode: `pl / numContracts`
- `toReported` mode: `actualContracts / btContracts`

### Legs Construction

TAT provides individual strike columns (`ShortPut`, `LongPut`, `ShortCall`, `LongCall`) plus `TradeType` and `UnderlyingSymbol`. Since `legs` is display-only throughout the system (never structurally parsed), we construct a readable string:

```
SPX 6945P/6945C | 6945P/6945C DC
     ^short        ^long          ^trade type
```

Only non-empty/non-zero strikes are included. The `" | "` separator is maintained for compatibility with the `LegsRow` UI component which splits on it.

### P/L Verification

Both OO and TAT report P/L net of commissions:
- TAT: `ProfitLoss = (PriceClose - abs(PriceOpen)) * Qty * 100 - Commission`
- OO reporting: `P/L` includes commissions

No adjustment needed for comparison.

### Date/Time Handling

TAT has two date/time column pairs:
- `OpenDate`/`OpenTime` - precise (YYYY-MM-DD / HH:MM:SS)
- `Date`/`TimeOpened` - display format (M/D/YYYY / h:mm AM/PM)

Prefer `OpenDate`/`OpenTime`, fall back to `Date`/`TimeOpened`. Parse dates via `parseDatePreservingCalendarDay` to avoid timezone shifting.

## Implementation Locations

### Shared adapter (packages/lib/)

- **New**: `packages/lib/processing/tat-adapter.ts` - TAT CSV row -> ReportingTrade conversion
  - `isTatFormat(headers: string[]): boolean` - header detection
  - `convertTatRowToReportingTrade(row: Record<string, string>): ReportingTrade` - row conversion
  - `buildTatLegsString(row): string` - legs construction helper
- **Modify**: `packages/lib/processing/reporting-trade-processor.ts` - detect format after parsing, route to TAT adapter or existing OO conversion path

### MCP server (packages/mcp-server/)

- **Modify**: `packages/mcp-server/src/utils/block-loader.ts`:
  - `detectCsvType()` - add TAT header detection -> `reportinglog`
  - `convertToReportingTrade()` - detect TAT format, use adapter from packages/lib
  - `loadReportingLog()` - no changes needed (already uses convertToReportingTrade)

### Tests

- **New**: `tests/unit/tat-adapter.test.ts` - unit tests for TAT -> ReportingTrade conversion
  - Field mapping correctness
  - Date parsing (both formats, fallback chain)
  - Legs construction (various strike combos, missing strikes)
  - numContracts uses Qty not ContractCount
  - P/L preservation (net of commissions)
  - Format detection (TAT vs OO headers)

## What Does NOT Change

- `ReportingTrade` interface - no new fields
- Trade matching logic (`trade-matching.ts`) - same date+strategy+time matching
- Strategy alignment UI (`match-strategies-dialog.tsx`) - manual linking already works
- Scaling calculations - same perContract/toReported math
- MCP comparison tools - work against ReportingTrade, format-agnostic
- Trading Calendar UI - displays ReportingTrade, format-agnostic

## TAT-Specific Extra Fields (Not Preserved)

The following TAT fields are intentionally discarded (map to existing fields only):
- `Account` (broker ID)
- `BuyingPower`
- `PutDelta` / `CallDelta`
- `Slippage`
- `StopType` / `StopMultiple` / `StopMultipleResult`
- `TradeID` / `ParentTaskID`
- `Template`
- `CustomLeg1-4`
