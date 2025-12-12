// Multi-Correlation Engine for NemoBlocks
// Pure analytics helpers (no React imports)

export interface StrategyDailyPnlPoint {
  date: string; // yyyy-MM-dd
  pl: number; // sized P/L for the day
  margin?: number;
}

export interface StrategySeries {
  id: string;
  name: string;
  weightPct: number; // portfolio allocation in percent
  points: StrategyDailyPnlPoint[];
}

export interface CorrelationMatrix {
  strategies: string[];
  matrix: number[][];
}

export interface CorrelationCluster {
  id: string;
  strategyIds: string[];
  meanCorrelation: number;
}

export interface ClusterExposure {
  clusterId: string;
  strategyIds: string[];
  totalWeightPct: number;
  meanCorrelation: number;
}

export interface MultiCorrelationResult {
  strategies: string[];
  correlationMatrix: number[][];
  clusters: CorrelationCluster[];
  clusterExposures: ClusterExposure[];
  portfolioCorrelation: number;
  diversificationScore: number;
  warnings: string[];
}

export type CorrelationMethod = "pearson" | "kendall";

interface DiversificationInput {
  portfolioCorrelation: number;
  maxClusterWeightPct: number;
  numClusters: number;
}

// Align all series to a common set of dates; missing values become 0.
const alignSeriesByDate = (series: StrategySeries[]): { dates: string[]; values: Map<string, number[]> } => {
  const dateSet = new Set<string>();
  series.forEach((s) => s.points.forEach((p) => dateSet.add(p.date)));
  const dates = Array.from(dateSet).sort();

  const values = new Map<string, number[]>();
  series.forEach((s) => {
    const lookup = new Map<string, number>();
    s.points.forEach((p) => lookup.set(p.date, p.pl));
    const arr = dates.map((d) => lookup.get(d) ?? 0);
    values.set(s.id, arr);
  });

  return { dates, values };
};

const pearson = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }
  const numerator = n * sumXY - sumX * sumY;
  const denomPartX = n * sumX2 - sumX * sumX;
  const denomPartY = n * sumY2 - sumY * sumY;
  const denominator = Math.sqrt(denomPartX * denomPartY);
  if (!isFinite(denominator) || denominator === 0) return 0;
  const corr = numerator / denominator;
  return Math.max(-1, Math.min(1, corr));
};

// Simple Kendall tau-a (ties counted as zero effect).
const kendall = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      if (dx === 0 || dy === 0) continue;
      const sign = Math.sign(dx) * Math.sign(dy);
      if (sign > 0) concordant += 1;
      else if (sign < 0) discordant += 1;
    }
  }
  const totalPairs = (n * (n - 1)) / 2;
  if (totalPairs === 0) return 0;
  const tau = (concordant - discordant) / totalPairs;
  return Math.max(-1, Math.min(1, tau));
};

export const computeCorrelationMatrix = (
  series: StrategySeries[],
  method: CorrelationMethod = "pearson"
): CorrelationMatrix => {
  const strategies = series.map((s) => s.id);
  const { values } = alignSeriesByDate(series);
  const matrix: number[][] = [];

  for (let i = 0; i < strategies.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < strategies.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const xi = values.get(strategies[i]) ?? [];
      const yj = values.get(strategies[j]) ?? [];
      const corr = method === "kendall" ? kendall(xi, yj) : pearson(xi, yj);
      matrix[i][j] = corr;
    }
  }

  return { strategies, matrix };
};

export const detectCorrelationClusters = (
  matrix: number[][],
  strategies: string[],
  threshold = 0.4
): CorrelationCluster[] => {
  const visited = new Set<number>();
  const clusters: CorrelationCluster[] = [];

  const isConnected = (i: number, j: number) => Math.abs(matrix[i][j]) >= threshold;

  for (let i = 0; i < strategies.length; i++) {
    if (visited.has(i)) continue;
    const queue = [i];
    const nodes: number[] = [];
    visited.add(i);

    while (queue.length) {
      const node = queue.shift()!;
      nodes.push(node);
      for (let j = 0; j < strategies.length; j++) {
        if (visited.has(j) || j === node) continue;
        if (isConnected(node, j)) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    const strategyIds = nodes.map((n) => strategies[n]);
    let corrSum = 0;
    let corrCount = 0;
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        corrSum += Math.abs(matrix[nodes[a]][nodes[b]]);
        corrCount += 1;
      }
    }
    const meanCorrelation = corrCount > 0 ? corrSum / corrCount : 0;
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      strategyIds,
      meanCorrelation,
    });
  }

  return clusters;
};

export const computeClusterWeights = (
  clusters: CorrelationCluster[],
  series: StrategySeries[]
): ClusterExposure[] => {
  const weights = new Map(series.map((s) => [s.id, s.weightPct]));
  return clusters.map((c) => {
    const totalWeightPct = c.strategyIds.reduce((sum, id) => sum + (weights.get(id) ?? 0), 0);
    return {
      clusterId: c.id,
      strategyIds: c.strategyIds,
      totalWeightPct,
      meanCorrelation: c.meanCorrelation,
    };
  });
};

export const computePortfolioCorrelationScore = (
  matrix: number[][],
  strategies: string[],
  series: StrategySeries[]
): number => {
  const weightMap = new Map(series.map((s) => [s.id, s.weightPct]));
  const weights = strategies.map((id) => weightMap.get(id) ?? 0);
  const total = weights.reduce((a, b) => a + b, 0);
  const fractions = total > 0 ? weights.map((w) => w / total) : weights.map(() => 0);

  let score = 0;
  for (let i = 0; i < strategies.length; i++) {
    for (let j = 0; j < strategies.length; j++) {
      score += fractions[i] * fractions[j] * matrix[i][j];
    }
  }
  return Math.max(-1, Math.min(1, score));
};

export const computeDiversificationScore = ({
  portfolioCorrelation,
  maxClusterWeightPct,
  numClusters,
}: DiversificationInput): number => {
  let score = 100;

  // Penalize high positive correlation.
  const corrPenalty = Math.max(0, portfolioCorrelation) * 60;
  score -= corrPenalty;

  // Penalize concentrated clusters above ~30%.
  const clusterPenalty = Math.max(0, maxClusterWeightPct - 30) * 1.2;
  score -= clusterPenalty;

  // Reward having more than 2 clusters.
  const clusterBonus = Math.min(15, Math.max(0, numClusters - 2) * 3);
  score += clusterBonus;

  return Math.max(0, Math.min(100, score));
};

export interface AnalyzeOptions {
  method?: CorrelationMethod;
  clusterThreshold?: number;
  highClusterWeightWarningPct?: number;
}

export const analyzeMultiCorrelation = (
  series: StrategySeries[],
  options: AnalyzeOptions = {}
): MultiCorrelationResult => {
  const method = options.method ?? "pearson";
  const threshold = options.clusterThreshold ?? 0.4;
  const highClusterWeightWarningPct = options.highClusterWeightWarningPct ?? 35;

  if (series.length === 0) {
    return {
      strategies: [],
      correlationMatrix: [],
      clusters: [],
      clusterExposures: [],
      portfolioCorrelation: 0,
      diversificationScore: 100,
      warnings: [],
    };
  }

  const { strategies, matrix } = computeCorrelationMatrix(series, method);
  const clusters = detectCorrelationClusters(matrix, strategies, threshold);
  const clusterExposures = computeClusterWeights(clusters, series);
  const portfolioCorrelation = computePortfolioCorrelationScore(matrix, strategies, series);
  const maxClusterWeightPct = clusterExposures.reduce(
    (max, c) => Math.max(max, c.totalWeightPct),
    0
  );
  const diversificationScore = computeDiversificationScore({
    portfolioCorrelation,
    maxClusterWeightPct,
    numClusters: clusters.length,
  });

  const warnings: string[] = [];
  clusterExposures.forEach((c) => {
    if (c.totalWeightPct > highClusterWeightWarningPct) {
      warnings.push(`${c.clusterId} has ${c.totalWeightPct.toFixed(1)}% weight; consider rebalancing.`);
    }
  });
  if (portfolioCorrelation > 0.6) {
    warnings.push("Portfolio correlation is high (> 0.6); diversification may be limited.");
  }

  return {
    strategies,
    correlationMatrix: matrix,
    clusters,
    clusterExposures,
    portfolioCorrelation,
    diversificationScore,
    warnings,
  };
};
