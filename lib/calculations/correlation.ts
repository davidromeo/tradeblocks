import { Trade } from "@/lib/models/trade";
import { mean } from "mathjs";

export type CorrelationMethod = "pearson" | "spearman" | "kendall";
export type CorrelationAlignment = "shared" | "zero-pad";
export type CorrelationNormalization = "raw" | "margin" | "notional";
export type CorrelationDateBasis = "opened" | "closed";

export interface CorrelationOptions {
  method?: CorrelationMethod;
  alignment?: CorrelationAlignment;
  normalization?: CorrelationNormalization;
  dateBasis?: CorrelationDateBasis;
}

export interface CorrelationMatrix {
  strategies: string[];
  correlationData: number[][];
  pairStats: PairStats[][];
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

export interface PairStats {
  triggered: number;
  wins: number;
  losses: number;
  winRate: number;
  netPL: number;
}

/**
 * Calculate correlation matrix between trading strategies based on daily returns
 */
export function calculateCorrelationMatrix(
  trades: Trade[],
  options: CorrelationOptions = {}
): CorrelationMatrix {
  const {
    method = "pearson",
    alignment = "shared",
    normalization = "raw",
    dateBasis = "opened",
  } = options;

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
    const dateKey = getTradeDateKey(trade, dateBasis);
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

  // Need at least 2 strategies
  if (strategies.length < 2) {
    const identityMatrix = strategies.map((_, i) =>
      strategies.map((_, j) => (i === j ? 1.0 : 0.0))
    );
    const emptyStats = strategies.map(() =>
      strategies.map(() => ({
        triggered: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        netPL: 0,
      }))
    );
    return { strategies, correlationData: identityMatrix, pairStats: emptyStats };
  }

  const correlationData: number[][] = [];
  const pairStats: PairStats[][] = [];

  const sortedDates = alignment === "zero-pad"
    ? Array.from(allDates).sort()
    : [];

  const zeroPaddedReturns: Record<string, number[]> = {};
  if (alignment === "zero-pad") {
    for (const strategy of strategies) {
      zeroPaddedReturns[strategy] = sortedDates.map(
        (date) => strategyDailyReturns[strategy][date] || 0
      );
    }
  }

  for (const strategy1 of strategies) {
    const row: number[] = [];
    const statsRow: PairStats[] = [];

    for (const strategy2 of strategies) {
      if (strategy1 === strategy2) {
        row.push(1.0);
        statsRow.push({
          triggered: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          netPL: 0,
        });
        continue;
      }

      let returns1: number[] = [];
      let returns2: number[] = [];

      if (alignment === "zero-pad") {
        returns1 = zeroPaddedReturns[strategy1];
        returns2 = zeroPaddedReturns[strategy2];
      } else {
        const strategy1Data = strategyDailyReturns[strategy1];
        const strategy2Data = strategyDailyReturns[strategy2];

        for (const date of Object.keys(strategy1Data)) {
          if (date in strategy2Data) {
            returns1.push(strategy1Data[date]);
            returns2.push(strategy2Data[date]);
          }
        }
      }

      let triggered = 0;
      let wins = 0;
      let losses = 0;
      let netPL = 0;

      const len = Math.min(returns1.length, returns2.length);
      for (let idx = 0; idx < len; idx++) {
        const r1 = returns1[idx] ?? 0;
        const r2 = returns2[idx] ?? 0;
        if (r1 !== 0 && r2 !== 0) {
          triggered += 1;
          const combo = r1 + r2;
          netPL += combo;
          if (combo > 0) wins += 1;
          else if (combo < 0) losses += 1;
        }
      }
      const winRate = triggered > 0 ? (wins / triggered) * 100 : 0;

      // Need at least 2 data points for correlation
      if (returns1.length < 2 || returns2.length < 2) {
        row.push(0.0);
        statsRow.push({ triggered, wins, losses, winRate, netPL });
        continue;
      }

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
      statsRow.push({ triggered, wins, losses, winRate, netPL });
    }

    correlationData.push(row);
    pairStats.push(statsRow);
  }

  return { strategies, correlationData, pairStats };
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

function normalizeReturn(
  trade: Trade,
  mode: CorrelationNormalization
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

function getTradeDateKey(
  trade: Trade,
  basis: CorrelationDateBasis
): string {
  const date = basis === "closed" ? trade.dateClosed : trade.dateOpened;

  if (!date) {
    throw new Error(
      "Trade is missing required date information for correlation calculation"
    );
  }

  return date.toISOString().split("T")[0];
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
      sumCorrelation += value;
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
