/**
 * Tail Risk Analysis using Gaussian Copula
 *
 * Measures tail dependence between strategies - how likely they are to have
 * extreme losses together, even if their day-to-day correlation is low.
 *
 * Key insight: Two strategies can have low Pearson correlation (0.2) but
 * high tail dependence (0.7), meaning they blow up together on big market moves.
 */

import { eigs, matrix } from "mathjs";
import { Trade } from "../models/trade";
import {
  AlignedStrategyReturns,
  MarginalContribution,
  TailRiskAnalytics,
  TailRiskAnalysisOptions,
  TailRiskAnalysisResult,
} from "../models/tail-risk";
import {
  pearsonCorrelation,
  probabilityIntegralTransform,
} from "./statistical-utils";

// Threshold for classifying a strategy pair as having "high" tail dependence
// Pairs above this value are flagged in analytics as concerning
const HIGH_DEPENDENCE_THRESHOLD = 0.5;

// Weights for marginal contribution calculation
// Equal weighting between concentration (factor loading) and average dependence
const CONCENTRATION_WEIGHT = 0.5;
const DEPENDENCE_WEIGHT = 0.5;

/**
 * Perform full Gaussian copula tail risk analysis
 *
 * @param trades - Array of trades to analyze
 * @param options - Analysis configuration options
 * @returns Complete tail risk analysis result
 */
export function performTailRiskAnalysis(
  trades: Trade[],
  options: TailRiskAnalysisOptions = {}
): TailRiskAnalysisResult {
  const startTime = performance.now();

  const {
    tailThreshold = 0.1,
    minTradingDays = 30,
    normalization = "raw",
    dateBasis = "opened",
    tickerFilter,
    strategyFilter,
    varianceThreshold = 0.8,
  } = options;

  // Step 1: Filter trades
  let filteredTrades = trades;

  if (tickerFilter) {
    filteredTrades = filteredTrades.filter((t) => {
      // Extract ticker from legs or other fields
      // For now, check if any leg contains the ticker
      const legsStr = t.legs || "";
      return legsStr.toUpperCase().includes(tickerFilter.toUpperCase());
    });
  }

  if (strategyFilter && strategyFilter.length > 0) {
    const filterSet = new Set(strategyFilter);
    filteredTrades = filteredTrades.filter(
      (t) => t.strategy && filterSet.has(t.strategy)
    );
  }

  // Step 2: Aggregate daily returns and align strategies
  const aligned = aggregateAndAlignReturns(
    filteredTrades,
    normalization,
    dateBasis
  );

  // Handle edge cases
  if (aligned.strategies.length < 2) {
    return createEmptyResult(aligned, tailThreshold, varianceThreshold, startTime);
  }

  if (aligned.dates.length < minTradingDays) {
    return createEmptyResult(aligned, tailThreshold, varianceThreshold, startTime);
  }

  // Step 3: Apply PIT to each strategy's returns
  const transformedReturns = aligned.returns.map((strategyReturns) =>
    probabilityIntegralTransform(strategyReturns)
  );

  // Step 4: Compute copula correlation matrix (Pearson on transformed data)
  const copulaCorrelationMatrix = computeCorrelationMatrix(transformedReturns);

  // Step 5: Eigenvalue decomposition
  const { eigenvalues, eigenvectors, explainedVariance, effectiveFactors } =
    performEigenAnalysis(copulaCorrelationMatrix, varianceThreshold);

  // Step 6: Estimate empirical tail dependence
  const tailDependenceMatrix = estimateTailDependence(
    transformedReturns,
    tailThreshold
  );

  // Step 7: Calculate analytics
  const analytics = calculateTailRiskAnalytics(
    tailDependenceMatrix,
    aligned.strategies
  );

  // Step 8: Calculate marginal contributions
  const marginalContributions = calculateMarginalContributions(
    copulaCorrelationMatrix,
    tailDependenceMatrix,
    eigenvectors,
    aligned.strategies
  );

  const endTime = performance.now();

  return {
    strategies: aligned.strategies,
    tradingDaysUsed: aligned.dates.length,
    dateRange: {
      start: new Date(aligned.dates[0]),
      end: new Date(aligned.dates[aligned.dates.length - 1]),
    },
    tailThreshold,
    varianceThreshold,
    copulaCorrelationMatrix,
    tailDependenceMatrix,
    eigenvalues,
    eigenvectors,
    explainedVariance,
    effectiveFactors,
    analytics,
    marginalContributions,
    computedAt: new Date(),
    computationTimeMs: endTime - startTime,
  };
}

/**
 * Aggregate trades into daily returns and align to shared trading days
 */
function aggregateAndAlignReturns(
  trades: Trade[],
  normalization: "raw" | "margin" | "notional",
  dateBasis: "opened" | "closed"
): AlignedStrategyReturns {
  // Group trades by strategy and date
  const strategyDailyReturns: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();

  for (const trade of trades) {
    // Skip trades without a strategy
    if (!trade.strategy || trade.strategy.trim() === "") {
      continue;
    }

    if (dateBasis === "closed" && !trade.dateClosed) {
      continue;
    }

    const strategy = trade.strategy;
    const date = dateBasis === "closed" ? trade.dateClosed : trade.dateOpened;

    if (!date) {
      continue;
    }

    const dateKey = date.toISOString().split("T")[0];
    const normalizedReturn = normalizeReturn(trade, normalization);

    if (normalizedReturn === null) {
      continue;
    }

    if (!strategyDailyReturns[strategy]) {
      strategyDailyReturns[strategy] = {};
    }

    strategyDailyReturns[strategy][dateKey] =
      (strategyDailyReturns[strategy][dateKey] || 0) + normalizedReturn;

    allDates.add(dateKey);
  }

  const strategies = Object.keys(strategyDailyReturns).sort();

  if (strategies.length < 2) {
    return {
      strategies,
      dates: [],
      returns: strategies.map(() => []),
    };
  }

  // Use all dates (union) and zero-pad missing days
  // This is necessary because strategies may trade on different schedules
  // (e.g., Monday-only vs Friday-only strategies would have zero shared days)
  const sortedDates = Array.from(allDates).sort();

  // Build aligned returns matrix with zero-padding for non-trading days
  const returns = strategies.map((strategy) =>
    sortedDates.map((date) => strategyDailyReturns[strategy][date] || 0)
  );

  return {
    strategies,
    dates: sortedDates,
    returns,
  };
}

/**
 * Normalize trade return based on selected mode
 */
function normalizeReturn(
  trade: Trade,
  mode: "raw" | "margin" | "notional"
): number | null {
  switch (mode) {
    case "margin": {
      if (!trade.marginReq) {
        return null;
      }
      return trade.pl / trade.marginReq;
    }
    case "notional": {
      const notional = Math.abs(
        (trade.openingPrice || 0) * (trade.numContracts || 0)
      );
      if (!notional) {
        return null;
      }
      return trade.pl / notional;
    }
    default:
      return trade.pl;
  }
}

/**
 * Compute correlation matrix from transformed returns
 */
function computeCorrelationMatrix(transformedReturns: number[][]): number[][] {
  const n = transformedReturns.length;
  const correlationMatrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        row.push(pearsonCorrelation(transformedReturns[i], transformedReturns[j]));
      }
    }
    correlationMatrix.push(row);
  }

  return correlationMatrix;
}

/**
 * Perform eigenvalue decomposition and calculate explained variance
 */
function performEigenAnalysis(
  correlationMatrix: number[][],
  varianceThreshold: number = 0.8
): {
  eigenvalues: number[];
  eigenvectors: number[][];
  explainedVariance: number[];
  effectiveFactors: number;
} {
  const n = correlationMatrix.length;

  if (n === 0) {
    return {
      eigenvalues: [],
      eigenvectors: [],
      explainedVariance: [],
      effectiveFactors: 0,
    };
  }

  try {
    // Use mathjs eigs function
    const result = eigs(matrix(correlationMatrix));

    // Extract eigenvalues (may be complex, take real parts)
    let eigenvalues: number[] = [];
    // Handle both array and MathCollection types
    const rawValues = (
      Array.isArray(result.values)
        ? result.values
        : (result.values as { toArray: () => unknown[] }).toArray()
    ) as (number | { re: number; im: number })[];

    for (const val of rawValues) {
      if (typeof val === "number") {
        eigenvalues.push(val);
      } else if (val && typeof val === "object" && "re" in val) {
        eigenvalues.push(val.re);
      }
    }

    // Extract eigenvectors
    // Note: result.eigenvectors is an array of {value, vector} objects
    // where vector is a DenseMatrix that needs .toArray() called on it
    type EigenvectorEntry = {
      value: number | { re: number };
      vector: { toArray: () => (number | { re: number })[] };
    };
    const rawVectors = result.eigenvectors as EigenvectorEntry[];
    let eigenvectors: number[][] = [];

    for (const ev of rawVectors) {
      const vecArray = ev.vector.toArray();
      const vec = vecArray.map((v) =>
        typeof v === "number" ? v : v.re
      );
      eigenvectors.push(vec);
    }

    // Sort by eigenvalue descending
    const indexed = eigenvalues.map((val, idx) => ({ val, idx }));
    indexed.sort((a, b) => b.val - a.val);

    eigenvalues = indexed.map((item) => item.val);
    eigenvectors = indexed.map((item) => eigenvectors[item.idx]);

    // Calculate explained variance
    const totalVariance = eigenvalues.reduce((sum, val) => sum + val, 0);
    let cumulative = 0;
    const explainedVariance = eigenvalues.map((val) => {
      cumulative += val / totalVariance;
      return cumulative;
    });

    // Find effective factors (configurable threshold)
    let effectiveFactors = eigenvalues.length;
    for (let i = 0; i < explainedVariance.length; i++) {
      if (explainedVariance[i] >= varianceThreshold) {
        effectiveFactors = i + 1;
        break;
      }
    }

    return {
      eigenvalues,
      eigenvectors,
      explainedVariance,
      effectiveFactors,
    };
  } catch (error) {
    // Fallback for numerical issues (e.g., near-singular matrices)
    console.warn("Eigenvalue decomposition failed, using identity fallback:", error);
    return {
      eigenvalues: new Array(n).fill(1),
      eigenvectors: correlationMatrix.map((_, i) =>
        new Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))
      ),
      explainedVariance: new Array(n).fill(0).map((_, i) => (i + 1) / n),
      effectiveFactors: n,
    };
  }
}

/**
 * Estimate empirical tail dependence between strategies
 *
 * For each pair (i, j), calculates P(j in tail | i in tail)
 * where "in tail" means below the tailThreshold percentile
 */
function estimateTailDependence(
  transformedReturns: number[][],
  tailThreshold: number
): number[][] {
  const n = transformedReturns.length;
  const m = transformedReturns[0]?.length || 0;

  if (n === 0 || m === 0) {
    return [];
  }

  // For each strategy, find the threshold value (tailThreshold percentile)
  const thresholdValues: number[] = transformedReturns.map((returns) => {
    const sorted = [...returns].sort((a, b) => a - b);
    const idx = Math.floor(tailThreshold * m);
    return sorted[Math.max(0, Math.min(idx, m - 1))];
  });

  // Identify which observations are in the tail for each strategy
  const inTail: boolean[][] = transformedReturns.map((returns, i) =>
    returns.map((val) => val <= thresholdValues[i])
  );

  // Compute tail dependence matrix
  const tailDependenceMatrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1.0);
        continue;
      }

      // Count co-occurrences in tail
      let bothInTail = 0;
      let iInTail = 0;

      for (let t = 0; t < m; t++) {
        if (inTail[i][t]) {
          iInTail++;
          if (inTail[j][t]) {
            bothInTail++;
          }
        }
      }

      // P(j in tail | i in tail)
      const dependence = iInTail > 0 ? bothInTail / iInTail : 0;
      row.push(dependence);
    }
    tailDependenceMatrix.push(row);
  }

  return tailDependenceMatrix;
}

/**
 * Calculate analytics from tail dependence matrix
 */
function calculateTailRiskAnalytics(
  tailDependenceMatrix: number[][],
  strategies: string[]
): TailRiskAnalytics {
  const n = strategies.length;

  if (n < 2) {
    return {
      highestTailDependence: { value: 0, pair: ["", ""] },
      lowestTailDependence: { value: 0, pair: ["", ""] },
      averageTailDependence: 0,
      highDependencePairsPct: 0,
    };
  }

  let highest = { value: -Infinity, pair: ["", ""] as [string, string] };
  let lowest = { value: Infinity, pair: ["", ""] as [string, string] };
  let sum = 0;
  let count = 0;
  let highDependenceCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Tail dependence is asymmetric: P(B in tail | A in tail) ≠ P(A in tail | B in tail)
      // We average both directions for a single summary metric per pair
      const value =
        (tailDependenceMatrix[i][j] + tailDependenceMatrix[j][i]) / 2;

      sum += value;
      count++;

      if (value > highest.value) {
        highest = { value, pair: [strategies[i], strategies[j]] };
      }
      if (value < lowest.value) {
        lowest = { value, pair: [strategies[i], strategies[j]] };
      }
      if (value > HIGH_DEPENDENCE_THRESHOLD) {
        highDependenceCount++;
      }
    }
  }

  return {
    highestTailDependence: highest,
    lowestTailDependence: lowest,
    averageTailDependence: count > 0 ? sum / count : 0,
    highDependencePairsPct: count > 0 ? highDependenceCount / count : 0,
  };
}

/**
 * Calculate marginal contribution of each strategy to portfolio tail risk
 */
function calculateMarginalContributions(
  _copulaCorrelationMatrix: number[][],
  tailDependenceMatrix: number[][],
  eigenvectors: number[][],
  strategies: string[]
): MarginalContribution[] {
  // Note: copulaCorrelationMatrix is passed for potential future use
  // (e.g., incorporating copula-based risk measures) but currently unused
  const n = strategies.length;

  if (n === 0 || eigenvectors.length === 0) {
    return [];
  }

  const contributions: MarginalContribution[] = [];

  // Get first eigenvector (dominant factor)
  const firstEigenvector = eigenvectors[0] || new Array(n).fill(0);
  const sumAbsLoadings = firstEigenvector.reduce(
    (sum, val) => sum + Math.abs(val),
    0
  );

  for (let i = 0; i < n; i++) {
    // Concentration score: loading on first factor
    const concentrationScore =
      sumAbsLoadings > 0
        ? Math.abs(firstEigenvector[i]) / sumAbsLoadings
        : 1 / n;

    // Average tail dependence with other strategies
    let sumDependence = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        sumDependence +=
          (tailDependenceMatrix[i][j] + tailDependenceMatrix[j][i]) / 2;
      }
    }
    const avgTailDependence = n > 1 ? sumDependence / (n - 1) : 0;

    // Tail risk contribution: weighted combination of concentration and avg dependence
    // Higher concentration + higher avg dependence = higher contribution
    const tailRiskContribution =
      (concentrationScore * CONCENTRATION_WEIGHT + avgTailDependence * DEPENDENCE_WEIGHT) * 100;

    contributions.push({
      strategy: strategies[i],
      tailRiskContribution,
      concentrationScore,
      avgTailDependence,
    });
  }

  // Sort by contribution descending
  contributions.sort((a, b) => b.tailRiskContribution - a.tailRiskContribution);

  return contributions;
}

/**
 * Create empty result for edge cases
 */
function createEmptyResult(
  aligned: AlignedStrategyReturns,
  tailThreshold: number,
  varianceThreshold: number,
  startTime: number
): TailRiskAnalysisResult {
  const n = aligned.strategies.length;
  const identity = aligned.strategies.map((_, i) =>
    aligned.strategies.map((_, j) => (i === j ? 1.0 : 0.0))
  );

  return {
    strategies: aligned.strategies,
    tradingDaysUsed: aligned.dates.length,
    dateRange: {
      start: aligned.dates.length > 0 ? new Date(aligned.dates[0]) : new Date(),
      end:
        aligned.dates.length > 0
          ? new Date(aligned.dates[aligned.dates.length - 1])
          : new Date(),
    },
    tailThreshold,
    varianceThreshold,
    copulaCorrelationMatrix: identity,
    tailDependenceMatrix: identity,
    eigenvalues: new Array(n).fill(1),
    eigenvectors: identity,
    explainedVariance: new Array(n).fill(0).map((_, i) => (i + 1) / Math.max(n, 1)),
    effectiveFactors: n,
    analytics: {
      highestTailDependence: { value: 0, pair: ["", ""] },
      lowestTailDependence: { value: 0, pair: ["", ""] },
      averageTailDependence: 0,
      highDependencePairsPct: 0,
    },
    marginalContributions: aligned.strategies.map((strategy) => ({
      strategy,
      tailRiskContribution: 100 / Math.max(n, 1),
      concentrationScore: 1 / Math.max(n, 1),
      avgTailDependence: 0,
    })),
    computedAt: new Date(),
    computationTimeMs: performance.now() - startTime,
  };
}
