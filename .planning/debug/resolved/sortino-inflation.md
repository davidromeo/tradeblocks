---
status: resolved
trigger: "Sortino ratio calculation uses non-standard downside deviation formula that inflates results"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: All 41 tests pass (40 existing + 1 new regression test)
expecting: N/A
next_action: Archive session

## Symptoms

expected: Sortino downside deviation should use DD = sqrt((1/N) * sum(min(R_i - target, 0)^2)) where N = total observations
actual: Current implementation filters to only negative excess returns, computes std() of those (dispersion around their mean, not RMS from zero), and divides by count of negatives (M) not total observations (N)
errors: No runtime errors. Sortino values inflated. Example: Sharpe 1.22 with Sortino 19.61 (16:1 ratio, typical is 1.5-3x)
reproduction: Any block with tightly clustered losses shows inflated Sortino
started: Present since original implementation

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:00:30Z
  checked: packages/lib/calculations/portfolio-stats.ts lines 473-484
  found: Uses `const negativeExcessReturns = excessReturns.filter(ret => ret < 0)` then `std(negativeExcessReturns, 'biased')`. This computes population std of only the negative values - i.e., dispersion of negatives around THEIR OWN MEAN, not RMS from zero. Also uses M (count of negatives) not N (total count).
  implication: Two compounding errors inflate Sortino: (1) std measures spread around mean, not distance from zero, (2) dividing by M < N further reduces denominator

- timestamp: 2026-02-07T00:00:45Z
  checked: packages/lib/services/calendar-data.ts lines 1091-1101
  found: SAME bug - identical pattern: filter negatives, std(negativeExcessReturns, 'biased')
  implication: Bug exists in two locations - both need fixing

- timestamp: 2026-02-07T00:00:50Z
  checked: All 40 existing tests
  found: All pass. Tests don't assert specific Sortino values, only that the result exists and is within very wide bounds (e.g., -10 to 100)
  implication: Tests need tighter assertions after fix

- timestamp: 2026-02-07T00:01:30Z
  checked: Hand computation comparing old vs new formula
  found: For test data [+2%, +1%, -1%, +1.5%, -0.5%], old formula gives Sortino=38.10, new gives Sortino=19.05. Old formula inflated by 2x on this data; gets worse with tightly clustered losses.
  implication: Fix correctly halves the inflation for this dataset

## Resolution

root_cause: Sortino downside deviation formula was wrong in two files. Used `std(negativeExcessReturns, 'biased')` which computes population standard deviation of only negative excess returns around their own mean. Two compounding errors: (1) std() measures dispersion around the mean of negatives, not distance from zero target; (2) denominator uses M (count of negatives) instead of N (all observations). Correct formula: DD = sqrt((1/N) * sum(min(excess_return_i, 0)^2))

fix: Replaced std() call with manual RMS-from-zero computation in both locations:
  - `packages/lib/calculations/portfolio-stats.ts`: Replaced lines 473-484 with reduce over all excessReturns computing sum(min(r,0)^2)/N, then sqrt
  - `packages/lib/services/calendar-data.ts`: Same replacement at lines 1091-1101
  - Updated file-level docstring in portfolio-stats.ts
  - Updated `.claude/CLAUDE.md` to reflect correct formula

verification: 41 tests pass (40 existing + 1 new). New test asserts Sortino/Sharpe ratio is between 0.5x and 5.0x (old formula could produce 10-20x). Pre-existing failures in monte-carlo and drawdown-scaling tests are unrelated (confirmed by running on pre-fix code). No TypeScript errors in modified files.

files_changed:
  - packages/lib/calculations/portfolio-stats.ts
  - packages/lib/services/calendar-data.ts
  - tests/unit/portfolio-stats-risk-free.test.ts
  - .claude/CLAUDE.md
