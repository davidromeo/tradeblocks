import { Trade } from "@/lib/models/trade";
import { mean } from "mathjs";

export interface CorrelationMatrix {
  strategies: string[];
  correlationData: number[][];
}

export interface CorrelationAnalytics {
  strongest: {
    value: number;
    pair: [string, string];
  };
  weakest: {
    value: number;
    pair: [string, string];
  };
  averageCorrelation: number;
  strategyCount: number;
}

/**
 * Calculate correlation matrix between trading strategies based on daily returns
 */
export function calculateCorrelationMatrix(
  trades: Trade[],
  method: "pearson" | "spearman" | "kendall" = "pearson"
): CorrelationMatrix {
  // Group trades by strategy and date
  const strategyDailyReturns: Record<string, Record<string, number>> = {};

  for (const trade of trades) {
    // Skip trades without a strategy
    if (!trade.strategy || trade.strategy.trim() === "") {
      continue;
    }

    const strategy = trade.strategy;
    const dateKey = trade.dateOpened.toISOString().split("T")[0];

    if (!strategyDailyReturns[strategy]) {
      strategyDailyReturns[strategy] = {};
    }

    strategyDailyReturns[strategy][dateKey] =
      (strategyDailyReturns[strategy][dateKey] || 0) + trade.pl;
  }

  const strategies = Object.keys(strategyDailyReturns).sort();

  // Need at least 2 strategies
  if (strategies.length < 2) {
    const identityMatrix = strategies.map((_, i) =>
      strategies.map((_, j) => (i === j ? 1.0 : 0.0))
    );
    return { strategies, correlationData: identityMatrix };
  }

  // Get all unique dates
  const allDates = new Set<string>();
  for (const strategyData of Object.values(strategyDailyReturns)) {
    for (const date of Object.keys(strategyData)) {
      allDates.add(date);
    }
  }

  const sortedDates = Array.from(allDates).sort();

  // Create aligned returns arrays for each strategy
  const strategyReturnsArrays: Record<string, number[]> = {};
  for (const strategy of strategies) {
    strategyReturnsArrays[strategy] = sortedDates.map(
      (date) => strategyDailyReturns[strategy][date] || 0
    );
  }

  // Calculate correlation matrix
  const correlationData: number[][] = [];

  for (const strategy1 of strategies) {
    const row: number[] = [];
    const returns1 = strategyReturnsArrays[strategy1];

    for (const strategy2 of strategies) {
      const returns2 = strategyReturnsArrays[strategy2];

      let correlation: number;
      if (method === "pearson") {
        correlation = pearsonCorrelation(returns1, returns2);
      } else if (method === "spearman") {
        correlation = spearmanCorrelation(returns1, returns2);
      } else {
        // Kendall
        correlation = kendallCorrelation(returns1, returns2);
      }

      row.push(correlation);
    }

    correlationData.push(row);
  }

  return { strategies, correlationData };
}

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;

  for (let i = 0; i < x.length; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;

    numerator += diffX * diffY;
    sumXSquared += diffX * diffX;
    sumYSquared += diffY * diffY;
  }

  const denominator = Math.sqrt(sumXSquared * sumYSquared);

  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Calculate Spearman rank correlation coefficient
 */
function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  // Convert values to ranks
  const rankX = getRanks(x);
  const rankY = getRanks(y);

  // Calculate Pearson correlation on ranks
  return pearsonCorrelation(rankX, rankY);
}

/**
 * Calculate Kendall's tau correlation coefficient
 */
function kendallCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < x.length - 1; i++) {
    for (let j = i + 1; j < x.length; j++) {
      const diffX = x[j] - x[i];
      const diffY = y[j] - y[i];

      if ((diffX > 0 && diffY > 0) || (diffX < 0 && diffY < 0)) {
        concordant++;
      } else if ((diffX > 0 && diffY < 0) || (diffX < 0 && diffY > 0)) {
        discordant++;
      }
    }
  }

  const n = x.length;
  const denominator = (n * (n - 1)) / 2;

  if (denominator === 0) return 0;

  return (concordant - discordant) / denominator;
}

/**
 * Convert array of values to ranks (handling ties with average rank)
 */
function getRanks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array(values.length);
  let i = 0;

  while (i < indexed.length) {
    let j = i;
    // Find all tied values
    while (j < indexed.length && indexed[j].value === indexed[i].value) {
      j++;
    }

    // Assign average rank to all tied values
    const averageRank = (i + j + 1) / 2; // +1 because ranks are 1-indexed
    for (let k = i; k < j; k++) {
      ranks[indexed[k].index] = averageRank;
    }

    i = j;
  }

  return ranks;
}

/**
 * Calculate quick analytics from correlation matrix
 */
export function calculateCorrelationAnalytics(
  matrix: CorrelationMatrix
): CorrelationAnalytics {
  const { strategies, correlationData } = matrix;

  let strongest = { value: -1, pair: ["", ""] as [string, string] };
  let weakest = { value: 1, pair: ["", ""] as [string, string] };
  let sumCorrelation = 0;
  let count = 0;

  // Find strongest and weakest correlations (excluding diagonal)
  // Strongest = highest correlation (most positive)
  // Weakest = lowest correlation (most negative)
  for (let i = 0; i < strategies.length; i++) {
    for (let j = i + 1; j < strategies.length; j++) {
      const value = correlationData[i][j];
      sumCorrelation += Math.abs(value);
      count++;

      // Strongest is the most positive correlation
      if (value > strongest.value) {
        strongest = { value, pair: [strategies[i], strategies[j]] };
      }

      // Weakest is the most negative correlation (minimum value)
      if (value < weakest.value) {
        weakest = { value, pair: [strategies[i], strategies[j]] };
      }
    }
  }

  return {
    strongest,
    weakest,
    averageCorrelation: count > 0 ? sumCorrelation / count : 0,
    strategyCount: strategies.length,
  };
}
