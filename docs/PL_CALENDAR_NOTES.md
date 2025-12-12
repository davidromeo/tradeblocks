# P/L Calendar Implementation Notes

## 1. Max Drawdown Calculation
The `PLCalendarPanel` uses a hybrid approach to calculate Max Drawdown (`maxDrawdownPct`), prioritizing explicitly imported data over local estimation.

### Logic Flow in `computeBlockSummary`
1.  **Explicit Check**:
    *   The code maps over filtered trades to finding `t.drawdownPct`.
    *   If `drawdownPct` exists (e.g., from Option Omega "Worst Drawdown" CSV column), it takes the maximum absolute value: `Math.max(...drawdownPct)`.
    *   *Why*: This ensures exact matches with official trade logs.
2.  **Legacy Fallback**:
    *   If no explicit drawdown data is found, it simulates an equity curve.
    *   **Baseline**: Uses `fundsAtClose - pl` of the first chronological trade as the starting equity (or defaults to 100k).
    *   **Curve**: Iterates through sorted trades, applying P/L to equity.
    *   **Metric**: Tracks `peak` equity and computes `(peak - current) / peak` at every step.
    *   *Why*: Required for manual logs or sources without pre-calculated drawdown stats.

## 2. Date Range Filtering
The custom `DateRangePicker` component (upstreamed) drives the filtering logic.

*   **Input**: `dateRange` prop `{ from: Date, to: Date }`.
*   **Filtering**:
    *   `filteredTrades` memoizes the result.
    *   Uses `isWithinRange(date, range)` helper.
    *   Checks `dateClosed ?? dateOpened` against the range.
*   **Interaction**: Changing the date range immediately recalculates `dailyStats`, `periodStats`, and `maxDrawdownPctAll`.

## 3. Uploaded Logs & Year Blocks
*   **Storage**: Secondary "blocks" (uploaded CSVs) are persisted in `localStorage` key `plCalendarYearBlocks`.
*   **Hydration**: On mount, potentially string-encoded dates in JSON are revived into `Date` objects.
*   **Consistency**: Uploaded blocks use the exact same `computeBlockSummary` function as the main "Live" block, ensuring that if the CSV contained `drawdownPct`, the summary card will display the correct imported Max DD rather than a re-calculated one.

## 4. Key Files
*   `components/pl-calendar/PLCalendarPanel.tsx`: Main logic hub.
*   `components/ui/date-range-picker.tsx`: Custom start/end inputs.
*   `lib/models/trade.ts`: Base `Trade` interface (note the upstream usage of `TradeWithOptionalDrawdown` to handle the optional `drawdownPct`).
