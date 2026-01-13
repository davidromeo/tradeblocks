# Box Plot Configurable Bucket Count

## Problem

The box plot chart in Report Builder always divides X-axis values into exactly 4 quartile buckets (Q1-Q4). When users select fields like "Month of Year", they expect to see 12 boxes (one per month), not 4 arbitrary quartile groups.

## Solution

Add a configurable "Buckets" input that lets users control how many groups the X-axis values are divided into.

## Design

### UI Changes

- Add a number input labeled "Buckets" in the chart header row
- Appears only when chart type is "box"
- Placement: alongside X/Y axis selectors (consistent with other chart types)
- Minimum value: 2
- No maximum (data readability is its own guardrail)
- Default value: 4 (preserves current quartile behavior)

### State Changes

- Add `boxBucketCount` state in `report-builder-tab.tsx` (default: 4)
- Add `boxBucketCount?: number` to `ReportConfig` interface for saved reports
- Pass through `results-panel.tsx` to `CustomChart`

### Logic Changes

Update `buildBoxTraces()` in `custom-chart.tsx`:
- Accept `bucketCount` parameter
- Divide X-axis range into N equal-sized buckets (instead of quartiles)
- Generate dynamic labels based on bucket ranges (e.g., "0-10", "10-20")

### Files to Modify

1. `lib/models/report-config.ts` - Add `boxBucketCount` to `ReportConfig`
2. `components/report-builder/custom-chart.tsx` - Update `buildBoxTraces()`
3. `components/report-builder/results-panel.tsx` - Add Buckets input control
4. `components/report-builder/report-builder-tab.tsx` - Add state and handlers

## What-If Analysis

Not applicable for box plots. The chart already answers "how do outcomes vary across groups?" without needing interactive threshold analysis.

## Decisions Made

- Manual bucket count over smart defaults per field (simpler, more flexible)
- No upper limit on bucket count (unusable data is its own feedback)
- Default of 4 to preserve familiar quartile behavior
