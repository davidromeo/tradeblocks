/**
 * Monte Carlo Risk Simulator
 *
 * Performs bootstrap resampling simulations to project future portfolio performance
 * and calculate risk metrics like Value at Risk (VaR) and maximum drawdown distributions.
 */

import { Trade } from "@/lib/models/trade";

/**
 * Parameters for Monte Carlo simulation
 */
export interface MonteCarloParams {
  /** Number of simulation paths to generate */
  numSimulations: number;

  /** Number of trades/days to project forward in each simulation */
  simulationLength: number;

  /**
   * Size of the resample pool (how many recent trades/days to sample from)
   * If undefined or larger than available data, uses all available data
   * Key improvement: Can be smaller than simulationLength for stress testing
   */
  resampleWindow?: number;

  /** Resample from individual trades, daily returns, or percentage returns */
  resampleMethod: "trades" | "daily" | "percentage";

  /** Starting capital for simulations */
  initialCapital: number;

  /** Filter to specific strategy (optional) */
  strategy?: string;

  /** Expected number of trades per year (for annualization) */
  tradesPerYear: number;

  /** Random seed for reproducibility (optional) */
  randomSeed?: number;

  /** Normalize trades to 1-lot by scaling P&L by numContracts (optional) */
  normalizeTo1Lot?: boolean;
}

/**
 * Result of a single simulation path
 */
export interface SimulationPath {
  /** Equity curve values for this simulation */
  equityCurve: number[];

  /** Final portfolio value */
  finalValue: number;

  /** Total return as percentage */
  totalReturn: number;

  /** Annualized return percentage */
  annualizedReturn: number;

  /** Maximum drawdown encountered in this simulation */
  maxDrawdown: number;

  /** Sharpe ratio for this simulation */
  sharpeRatio: number;
}

/**
 * Statistical summary of all simulations
 */
export interface SimulationStatistics {
  /** Mean final portfolio value across all simulations */
  meanFinalValue: number;

  /** Median final portfolio value */
  medianFinalValue: number;

  /** Standard deviation of final values */
  stdFinalValue: number;

  /** Mean total return percentage */
  meanTotalReturn: number;

  /** Median total return percentage */
  medianTotalReturn: number;

  /** Mean annualized return percentage */
  meanAnnualizedReturn: number;

  /** Median annualized return percentage */
  medianAnnualizedReturn: number;

  /** Mean maximum drawdown across simulations */
  meanMaxDrawdown: number;

  /** Median maximum drawdown */
  medianMaxDrawdown: number;

  /** Mean Sharpe ratio */
  meanSharpeRatio: number;

  /** Probability of profit (% of simulations ending above initial capital) */
  probabilityOfProfit: number;

  /** Value at Risk at different confidence levels */
  valueAtRisk: {
    p5: number; // 5th percentile (95% VaR)
    p10: number; // 10th percentile (90% VaR)
    p25: number; // 25th percentile
  };
}

/**
 * Percentile data for equity curves across all simulations
 */
export interface PercentileData {
  /** Step numbers (x-axis) */
  steps: number[];

  /** 5th percentile equity values */
  p5: number[];

  /** 25th percentile equity values */
  p25: number[];

  /** 50th percentile (median) equity values */
  p50: number[];

  /** 75th percentile equity values */
  p75: number[];

  /** 95th percentile equity values */
  p95: number[];
}

/**
 * Complete Monte Carlo simulation result
 */
export interface MonteCarloResult {
  /** All simulation paths */
  simulations: SimulationPath[];

  /** Percentile equity curves */
  percentiles: PercentileData;

  /** Statistical summary */
  statistics: SimulationStatistics;

  /** Parameters used for this simulation */
  parameters: MonteCarloParams;

  /** Timestamp when simulation was run */
  timestamp: Date;

  /** Number of trades/days actually available in resample pool */
  actualResamplePoolSize: number;
}

/**
 * Bootstrap resampling utilities
 */

/**
 * Scale trade P&L to 1-lot equivalent
 *
 * @param trade - Trade to scale
 * @returns Scaled P&L value (P&L per contract)
 */
export function scaleTradeToOneLot(trade: Trade): number {
  if (trade.numContracts <= 0) {
    return trade.pl;
  }
  return trade.pl / trade.numContracts;
}

/**
 * Resample from an array with replacement
 *
 * @param data - Array of values to sample from
 * @param sampleSize - Number of samples to draw
 * @param seed - Optional random seed for reproducibility
 * @returns Array of resampled values
 */
function resampleWithReplacement<T>(
  data: T[],
  sampleSize: number,
  seed?: number
): T[] {
  const rng = seed !== undefined ? createSeededRandom(seed) : Math.random;
  const result: T[] = [];

  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(rng() * data.length);
    result.push(data[randomIndex]);
  }

  return result;
}

/**
 * Create a seeded random number generator
 * Simple LCG (Linear Congruential Generator) for reproducibility
 *
 * @param seed - Integer seed value
 * @returns Function that returns random numbers in [0, 1)
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    // LCG parameters from Numerical Recipes
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Get the resample pool from trade data
 *
 * @param trades - All available trades
 * @param resampleWindow - Number of recent trades to use (undefined = all)
 * @param strategy - Optional strategy filter
 * @returns Array of trades to resample from
 */
export function getTradeResamplePool(
  trades: Trade[],
  resampleWindow?: number,
  strategy?: string
): Trade[] {
  // Filter by strategy if specified
  let filteredTrades = trades;
  if (strategy && strategy !== "all") {
    filteredTrades = trades.filter((t) => t.strategy === strategy);
  }

  // Sort by date to ensure consistent ordering
  const sortedTrades = [...filteredTrades].sort(
    (a, b) => a.dateOpened.getTime() - b.dateOpened.getTime()
  );

  // Apply resample window if specified
  if (resampleWindow !== undefined && resampleWindow < sortedTrades.length) {
    // Take the most recent N trades
    return sortedTrades.slice(-resampleWindow);
  }

  return sortedTrades;
}

/**
 * Resample trade P&L values with replacement
 *
 * @param trades - Trades to resample from
 * @param sampleSize - Number of trades to generate
 * @param seed - Optional random seed
 * @returns Array of resampled P&L values
 */
export function resampleTradePLs(
  trades: Trade[],
  sampleSize: number,
  seed?: number
): number[] {
  const pls = trades.map((t) => t.pl);
  return resampleWithReplacement(pls, sampleSize, seed);
}

/**
 * Calculate daily returns from trades
 * Groups trades by date and sums P&L for each day
 *
 * @param trades - Trades to aggregate
 * @param normalizeTo1Lot - Whether to scale P&L to 1-lot
 * @returns Array of { date, dailyPL } objects sorted by date
 */
export function calculateDailyReturns(
  trades: Trade[],
  normalizeTo1Lot?: boolean
): Array<{ date: string; dailyPL: number }> {
  // Group trades by date
  const dailyPLMap = new Map<string, number>();

  for (const trade of trades) {
    // Use ISO date string as key (YYYY-MM-DD)
    const dateKey = trade.dateOpened.toISOString().split("T")[0];
    const currentPL = dailyPLMap.get(dateKey) || 0;
    const pl = normalizeTo1Lot ? scaleTradeToOneLot(trade) : trade.pl;
    dailyPLMap.set(dateKey, currentPL + pl);
  }

  // Convert to sorted array
  const dailyReturns = Array.from(dailyPLMap.entries())
    .map(([date, dailyPL]) => ({ date, dailyPL }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return dailyReturns;
}

/**
 * Get the resample pool from daily returns data
 *
 * @param dailyReturns - All daily returns
 * @param resampleWindow - Number of recent days to use (undefined = all)
 * @returns Array of daily P&L values to resample from
 */
export function getDailyResamplePool(
  dailyReturns: Array<{ date: string; dailyPL: number }>,
  resampleWindow?: number
): number[] {
  // Already sorted by date from calculateDailyReturns
  let poolReturns = dailyReturns;

  // Apply resample window if specified
  if (
    resampleWindow !== undefined &&
    resampleWindow < dailyReturns.length
  ) {
    // Take the most recent N days
    poolReturns = dailyReturns.slice(-resampleWindow);
  }

  return poolReturns.map((d) => d.dailyPL);
}

/**
 * Calculate percentage returns from trades based on HISTORICAL capital at trade time
 * This properly accounts for compounding strategies where position sizes grow with equity
 *
 * IMPORTANT: Uses the actual historical account values to compute percentages, NOT the
 * user's chosen initial capital. This ensures that when users scale up/down their starting
 * capital in simulations, the percentage returns scale proportionally.
 *
 * @param trades - Trades to calculate percentage returns from
 * @param normalizeTo1Lot - Whether to scale P&L to 1-lot before calculating percentage
 * @returns Array of percentage returns (as decimals, e.g., 0.05 = 5%)
 */
export function calculatePercentageReturns(
  trades: Trade[],
  normalizeTo1Lot?: boolean
): number[] {
  if (trades.length === 0) {
    return [];
  }

  // Sort trades by date to ensure proper chronological order
  const sortedTrades = [...trades].sort(
    (a, b) => a.dateOpened.getTime() - b.dateOpened.getTime()
  );

  const percentageReturns: number[] = [];

  // Calculate HISTORICAL initial capital from the first trade
  const firstTrade = sortedTrades[0];
  let capital = firstTrade.fundsAtClose - firstTrade.pl;

  for (const trade of sortedTrades) {
    if (capital <= 0) {
      // Account is busted, treat remaining returns as 0
      percentageReturns.push(0);
      continue;
    }

    // Get trade P&L (optionally normalized)
    const pl = normalizeTo1Lot ? scaleTradeToOneLot(trade) : trade.pl;

    // Calculate percentage return based on HISTORICAL capital at trade time
    // This ensures percentages are independent of user's chosen simulation capital
    const percentageReturn = pl / capital;
    percentageReturns.push(percentageReturn);

    // Update capital for next trade using historical account values
    capital += pl;
  }

  return percentageReturns;
}

/**
 * Get the resample pool from percentage returns data
 *
 * @param percentageReturns - All percentage returns
 * @param resampleWindow - Number of recent returns to use (undefined = all)
 * @returns Array of percentage returns to resample from
 */
export function getPercentageResamplePool(
  percentageReturns: number[],
  resampleWindow?: number
): number[] {
  if (
    resampleWindow !== undefined &&
    resampleWindow < percentageReturns.length
  ) {
    // Take the most recent N returns
    return percentageReturns.slice(-resampleWindow);
  }

  return percentageReturns;
}

/**
 * Resample daily P&L values with replacement
 *
 * @param dailyPLs - Daily P&L values to resample from
 * @param sampleSize - Number of days to generate
 * @param seed - Optional random seed
 * @returns Array of resampled daily P&L values
 */
export function resampleDailyPLs(
  dailyPLs: number[],
  sampleSize: number,
  seed?: number
): number[] {
  return resampleWithReplacement(dailyPLs, sampleSize, seed);
}

/**
 * Core Monte Carlo simulation engine
 */

/**
 * Run a single simulation path and calculate its metrics
 *
 * @param resampledValues - Array of resampled values (either P&L or percentage returns)
 * @param initialCapital - Starting capital
 * @param tradesPerYear - Number of trades per year for annualization
 * @param isPercentageMode - Whether values are percentage returns (true) or dollar P&L (false)
 * @returns SimulationPath with equity curve and metrics
 */
function runSingleSimulation(
  resampledValues: number[],
  initialCapital: number,
  tradesPerYear: number,
  isPercentageMode: boolean = false
): SimulationPath {
  // Track capital over time
  let capital = initialCapital;
  const equityCurve: number[] = [];
  const returns: number[] = [];

  // Build equity curve (as cumulative returns from starting capital)
  for (const value of resampledValues) {
    const capitalBeforeTrade = capital;

    if (isPercentageMode) {
      // Value is a percentage return - apply it to current capital
      capital = capital * (1 + value);
    } else {
      // Value is dollar P&L - add it to capital
      capital += value;
    }

    const cumulativeReturn = (capital - initialCapital) / initialCapital;
    equityCurve.push(cumulativeReturn);

    if (capitalBeforeTrade > 0) {
      const periodReturn = capital / capitalBeforeTrade - 1;
      returns.push(periodReturn);
    } else {
      returns.push(0);
    }
  }

  // Final metrics
  const finalValue = capital;
  const totalReturn = (finalValue - initialCapital) / initialCapital;

  // Annualized return
  const numTrades = resampledValues.length;
  const yearsElapsed = numTrades / tradesPerYear;
  const annualizedReturn =
    yearsElapsed > 0
      ? Math.pow(1 + totalReturn, 1 / yearsElapsed) - 1
      : totalReturn;

  // Maximum drawdown
  const maxDrawdown = calculateMaxDrawdown(equityCurve);

  // Sharpe ratio (using individual returns)
  const sharpeRatio = calculateSharpeRatio(returns, tradesPerYear);

  return {
    equityCurve,
    finalValue,
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
  };
}

/**
 * Calculate maximum drawdown from an equity curve
 *
 * @param equityCurve - Array of cumulative returns
 * @returns Maximum drawdown as a decimal (positive number for losses)
 */
function calculateMaxDrawdown(equityCurve: number[]): number {
  let maxDrawdown = 0;
  let peak = 0; // Treat initial capital (0% return) as the starting peak

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = peak - value;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculate Sharpe ratio from returns
 *
 * @param returns - Array of individual returns
 * @param periodsPerYear - Number of trading periods per year
 * @returns Sharpe ratio (annualized)
 */
function calculateSharpeRatio(
  returns: number[],
  periodsPerYear: number
): number {
  if (returns.length < 2) {
    return 0;
  }

  // Mean return
  const meanReturn =
    returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Standard deviation (sample std dev with N-1)
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
    (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return 0;
  }

  // Annualized Sharpe ratio (assuming risk-free rate = 0)
  const sharpe = (meanReturn / stdDev) * Math.sqrt(periodsPerYear);

  return sharpe;
}

/**
 * Run Monte Carlo simulation
 *
 * @param trades - Historical trade data
 * @param params - Simulation parameters
 * @returns MonteCarloResult with all simulations and analysis
 */
export function runMonteCarloSimulation(
  trades: Trade[],
  params: MonteCarloParams
): MonteCarloResult {
  // Validate inputs
  if (trades.length < 10) {
    throw new Error(
      `Insufficient trades for Monte Carlo simulation. Found ${trades.length} trades, need at least 10.`
    );
  }

  const timestamp = new Date();

  // Get resample pool based on method
  let resamplePool: number[];
  let actualResamplePoolSize: number;
  const isPercentageMode = params.resampleMethod === "percentage";

  if (params.resampleMethod === "trades") {
    // Individual trade P&L resampling
    const tradePool = getTradeResamplePool(
      trades,
      params.resampleWindow,
      params.strategy
    );
    actualResamplePoolSize = tradePool.length;
    // Extract P&L values, optionally scaling to 1-lot
    resamplePool = tradePool.map((t) =>
      params.normalizeTo1Lot ? scaleTradeToOneLot(t) : t.pl
    );
  } else if (params.resampleMethod === "daily") {
    // Daily returns resampling
    const filteredTrades =
      params.strategy && params.strategy !== "all"
        ? trades.filter((t) => t.strategy === params.strategy)
        : trades;

    const dailyReturns = calculateDailyReturns(
      filteredTrades,
      params.normalizeTo1Lot
    );
    const dailyPLs = getDailyResamplePool(
      dailyReturns,
      params.resampleWindow
    );
    actualResamplePoolSize = dailyPLs.length;
    resamplePool = dailyPLs;
  } else {
    // Percentage returns resampling (for compounding strategies)
    const filteredTrades =
      params.strategy && params.strategy !== "all"
        ? trades.filter((t) => t.strategy === params.strategy)
        : trades;

    const percentageReturns = calculatePercentageReturns(
      filteredTrades,
      params.normalizeTo1Lot
    );
    const percentagePool = getPercentageResamplePool(
      percentageReturns,
      params.resampleWindow
    );
    actualResamplePoolSize = percentagePool.length;
    resamplePool = percentagePool;
  }

  // Validate resample pool size
  if (actualResamplePoolSize < 5) {
    throw new Error(
      `Insufficient data in resample pool. Found ${actualResamplePoolSize} samples, need at least 5.`
    );
  }

  // Run all simulations
  const simulations: SimulationPath[] = [];

  for (let i = 0; i < params.numSimulations; i++) {
    // Generate unique seed for each simulation if base seed provided
    const seed = params.randomSeed !== undefined ? params.randomSeed + i : undefined;

    // Resample P&Ls
    const resampledPLs = resampleWithReplacement(
      resamplePool,
      params.simulationLength,
      seed
    );

    // Run simulation
    const simulation = runSingleSimulation(
      resampledPLs,
      params.initialCapital,
      params.tradesPerYear,
      isPercentageMode
    );

    simulations.push(simulation);
  }

  // Calculate percentiles
  const percentiles = calculatePercentiles(simulations);

  // Calculate statistics
  const statistics = calculateStatistics(simulations);

  return {
    simulations,
    percentiles,
    statistics,
    parameters: params,
    timestamp,
    actualResamplePoolSize,
  };
}

/**
 * Calculate percentile curves across all simulations
 *
 * @param simulations - Array of simulation paths
 * @returns PercentileData with P5, P25, P50, P75, P95 curves
 */
function calculatePercentiles(
  simulations: SimulationPath[]
): PercentileData {
  if (simulations.length === 0) {
    throw new Error("No simulations to calculate percentiles from");
  }

  const simulationLength = simulations[0].equityCurve.length;
  const steps = Array.from({ length: simulationLength }, (_, i) => i + 1);

  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];

  // For each step, collect all values at that step and calculate percentiles
  for (let step = 0; step < simulationLength; step++) {
    const valuesAtStep = simulations.map((sim) => sim.equityCurve[step]);
    valuesAtStep.sort((a, b) => a - b);

    p5.push(percentile(valuesAtStep, 5));
    p25.push(percentile(valuesAtStep, 25));
    p50.push(percentile(valuesAtStep, 50));
    p75.push(percentile(valuesAtStep, 75));
    p95.push(percentile(valuesAtStep, 95));
  }

  return { steps, p5, p25, p50, p75, p95 };
}

/**
 * Calculate a specific percentile from sorted data
 *
 * @param sortedData - Array of numbers sorted in ascending order
 * @param p - Percentile to calculate (0-100)
 * @returns Percentile value
 */
function percentile(sortedData: number[], p: number): number {
  if (sortedData.length === 0) {
    return 0;
  }

  const index = (p / 100) * (sortedData.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedData.length) {
    return sortedData[sortedData.length - 1];
  }

  return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
}

/**
 * Calculate aggregate statistics from all simulations
 *
 * @param simulations - Array of simulation paths
 * @param initialCapital - Starting capital
 * @returns SimulationStatistics
 */
function calculateStatistics(simulations: SimulationPath[]): SimulationStatistics {
  const finalValues = simulations.map((s) => s.finalValue);
  const totalReturns = simulations.map((s) => s.totalReturn);
  const annualizedReturns = simulations.map((s) => s.annualizedReturn);
  const maxDrawdowns = simulations.map((s) => s.maxDrawdown);
  const sharpeRatios = simulations.map((s) => s.sharpeRatio);

  // Sort for percentile calculations
  const sortedFinalValues = [...finalValues].sort((a, b) => a - b);
  const sortedTotalReturns = [...totalReturns].sort((a, b) => a - b);

  // Mean and median calculations
  const meanFinalValue =
    finalValues.reduce((sum, v) => sum + v, 0) / finalValues.length;
  const medianFinalValue = percentile(sortedFinalValues, 50);

  const meanTotalReturn =
    totalReturns.reduce((sum, r) => sum + r, 0) / totalReturns.length;
  const medianTotalReturn = percentile(sortedTotalReturns, 50);

  const meanAnnualizedReturn =
    annualizedReturns.reduce((sum, r) => sum + r, 0) /
    annualizedReturns.length;
  const medianAnnualizedReturn = percentile(
    [...annualizedReturns].sort((a, b) => a - b),
    50
  );

  const meanMaxDrawdown =
    maxDrawdowns.reduce((sum, d) => sum + d, 0) / maxDrawdowns.length;
  const medianMaxDrawdown = percentile(
    [...maxDrawdowns].sort((a, b) => a - b),
    50
  );

  const meanSharpeRatio =
    sharpeRatios.reduce((sum, s) => sum + s, 0) / sharpeRatios.length;

  // Standard deviation of final values
  const variance =
    finalValues.reduce(
      (sum, v) => sum + Math.pow(v - meanFinalValue, 2),
      0
    ) /
    (finalValues.length - 1);
  const stdFinalValue = Math.sqrt(variance);

  // Probability of profit
  const profitableSimulations = totalReturns.filter((r) => r > 0).length;
  const probabilityOfProfit =
    profitableSimulations / totalReturns.length;

  // Value at Risk
  const valueAtRisk = {
    p5: percentile(sortedTotalReturns, 5),
    p10: percentile(sortedTotalReturns, 10),
    p25: percentile(sortedTotalReturns, 25),
  };

  return {
    meanFinalValue,
    medianFinalValue,
    stdFinalValue,
    meanTotalReturn,
    medianTotalReturn,
    meanAnnualizedReturn,
    medianAnnualizedReturn,
    meanMaxDrawdown,
    medianMaxDrawdown,
    meanSharpeRatio,
    probabilityOfProfit,
    valueAtRisk,
  };
}
