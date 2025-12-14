import {
  calculateCorrelationMetrics,
  calculatePairedTTest,
  CorrelationMetrics,
  MatchedPair as StatMatchedPair,
  TTestResult,
} from "@/lib/calculations/reconciliation-stats";
import { getReportingTradesByBlock, getTradesByBlock } from "@/lib/db";
import { ReportingTrade } from "@/lib/models/reporting-trade";
import {
  MatchOverrides,
  StrategyAlignment,
  TradePair,
} from "@/lib/models/strategy-alignment";
import { Trade } from "@/lib/models/trade";

const MATCH_TOLERANCE_MS = 30 * 60 * 1000; // 30 minutes

export interface NormalizedTrade {
  id: string;
  strategy: string;
  dateOpened: Date;
  timeOpened?: string;
  sortTime: number;
  session: string;
  dateClosed?: Date;
  premiumPerContract: number;
  totalPremium: number;
  contracts: number;
  pl: number;
  openingFees: number;
  closingFees: number;
  legs?: string;
}

export interface TradeSessionMatchItem {
  backtested?: NormalizedTrade;
  reported?: NormalizedTrade;
  autoBacktested: boolean;
  autoReported: boolean;
  includedBacktested: boolean;
  includedReported: boolean;
  isPaired: boolean; // true if from matchResult.pairs, false if from unmatched loop
}

export interface TradeSessionMatch {
  session: string;
  items: TradeSessionMatchItem[];
}

export interface AlignmentMetrics {
  backtested: TradeTotals;
  reported: TradeTotals;
  delta: TradeDeltaTotals;
  matchRate: number;
  slippagePerContract: number;
  sizeVariance: number;
  tTest: TTestResult | null;
  correlation: CorrelationMetrics | null;
  matched: {
    tradeCount: number;
    totalSlippage: number;
    backtestedAvgPremiumPerContract: number;
    backtestedContractBaseline: number;
  };
  notes?: string;
}

export interface AlignedTradeSet {
  alignmentId: string;
  backtestedStrategy: string;
  reportedStrategy: string;
  backtestedTrades: NormalizedTrade[];
  reportedTrades: NormalizedTrade[];
  metrics: AlignmentMetrics;
  sessions: TradeSessionMatch[];
  autoSelectedBacktestedIds: string[];
  autoSelectedReportedIds: string[];
  selectedBacktestedIds: string[];
  selectedReportedIds: string[];
}

export interface TradeTotals {
  tradeCount: number;
  totalPl: number;
  avgPl: number;
  totalPremium: number;
  totalContracts: number;
  totalFees: number;
  avgPremiumPerContract: number;
}

export type TradeDeltaTotals = TradeTotals;

export interface ReconciliationPayload {
  alignments: AlignedTradeSet[];
  unmappedReported: string[];
  unmappedBacktested: string[];
}

interface MatchedPair {
  backtested: NormalizedTrade;
  reported: NormalizedTrade;
}

interface AutoMatchResult {
  pairs: MatchedPair[];
  unmatchedBacktested: NormalizedTrade[];
  unmatchedReported: NormalizedTrade[];
}

export async function buildTradeReconciliation(
  blockId: string,
  alignments: StrategyAlignment[],
  normalizeTo1Lot = false
): Promise<ReconciliationPayload> {
  const [backtestedTrades, reportedTrades] = await Promise.all([
    getTradesByBlock(blockId),
    getReportingTradesByBlock(blockId),
  ]);

  const normalizedBacktested = backtestedTrades.map(normalizeBacktestedTrade);
  const normalizedReported = reportedTrades.map(normalizeReportedTrade);

  const backtestedByStrategy = groupByStrategy(normalizedBacktested);
  const reportedByStrategy = groupByStrategy(normalizedReported);

  const alignmentSets: AlignedTradeSet[] = alignments.map((alignment) =>
    buildAlignmentSet(
      alignment,
      backtestedByStrategy,
      reportedByStrategy,
      normalizeTo1Lot
    )
  );

  const alignedReported = new Set(
    alignmentSets.flatMap((set) => [set.reportedStrategy])
  );
  const alignedBacktested = new Set(
    alignmentSets.flatMap((set) => [set.backtestedStrategy])
  );

  const unmappedReported = Array.from(reportedByStrategy.keys()).filter(
    (strategy) => !alignedReported.has(strategy)
  );
  const unmappedBacktested = Array.from(backtestedByStrategy.keys()).filter(
    (strategy) => !alignedBacktested.has(strategy)
  );

  return {
    alignments: alignmentSets,
    unmappedReported,
    unmappedBacktested,
  };
}

function buildAlignmentSet(
  alignment: StrategyAlignment,
  backtestedByStrategy: Map<string, NormalizedTrade[]>,
  reportedByStrategy: Map<string, NormalizedTrade[]>,
  normalizeTo1Lot: boolean
): AlignedTradeSet {
  const backtestedStrategy = alignment.liveStrategies[0];
  const reportedStrategy = alignment.reportingStrategies[0];

  if (!backtestedStrategy || !reportedStrategy) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[reconciliation] alignment missing strategies", {
        alignmentId: alignment.id,
        liveStrategies: alignment.liveStrategies,
        reportingStrategies: alignment.reportingStrategies,
      });
    }

    return {
      alignmentId: alignment.id,
      backtestedStrategy: backtestedStrategy ?? "Unknown",
      reportedStrategy: reportedStrategy ?? "Unknown",
      backtestedTrades: [],
      reportedTrades: [],
      metrics: buildMetrics([], [], [], normalizeTo1Lot),
      sessions: [],
      autoSelectedBacktestedIds: [],
      autoSelectedReportedIds: [],
      selectedBacktestedIds: [],
      selectedReportedIds: [],
    };
  }

  const reportedTrades = reportedByStrategy.get(reportedStrategy) ?? [];
  const backtestedTradesRaw =
    backtestedByStrategy.get(backtestedStrategy) ?? [];
  const backtestedTrades = filterBacktestedTrades(
    backtestedTradesRaw,
    reportedTrades
  );

  // Build lookup maps for trades by ID
  const backtestedById = new Map(backtestedTrades.map((t) => [t.id, t]));
  const reportedById = new Map(reportedTrades.map((t) => [t.id, t]));

  const overrides: MatchOverrides | undefined = alignment.matchOverrides;
  const tradePairOverride = overrides?.tradePairs;

  // Determine if we should use explicit pairs or auto-match
  const useExplicitPairs = Array.isArray(tradePairOverride);

  let matchResult: AutoMatchResult;
  let selectedBacktestedIds: Set<string>;
  let selectedReportedIds: Set<string>;
  let autoBacktestedIds: Set<string>;
  let autoReportedIds: Set<string>;

  if (useExplicitPairs) {
    const explicitPairs = tradePairOverride ?? [];

    // Use explicit trade pairs from overrides
    matchResult = buildMatchResultFromPairs(
      explicitPairs,
      backtestedById,
      reportedById,
      backtestedTrades,
      reportedTrades
    );

    // With explicit pairs, selected IDs should honor explicit selections when provided.
    const explicitSelectedBacktested = overrides?.selectedBacktestedIds ?? [];
    const explicitSelectedReported = overrides?.selectedReportedIds ?? [];

    selectedBacktestedIds =
      explicitSelectedBacktested.length > 0
        ? new Set(
            explicitSelectedBacktested.filter((id) => backtestedById.has(id))
          )
        : new Set(
            explicitPairs
              .map((p) => p.backtestedId)
              .filter((id) => backtestedById.has(id))
          );

    selectedReportedIds =
      explicitSelectedReported.length > 0
        ? new Set(explicitSelectedReported.filter((id) => reportedById.has(id)))
        : new Set(
            explicitPairs
              .map((p) => p.reportedId)
              .filter((id) => reportedById.has(id))
          );

    // Auto IDs are those marked as non-manual
    autoBacktestedIds = new Set(
      explicitPairs.filter((p) => !p.manual).map((p) => p.backtestedId)
    );
    autoReportedIds = new Set(
      explicitPairs.filter((p) => !p.manual).map((p) => p.reportedId)
    );
  } else {
    // Fall back to auto-matching
    matchResult = autoMatchTrades(backtestedTrades, reportedTrades);

    autoBacktestedIds = new Set(
      matchResult.pairs.map((pair) => pair.backtested.id)
    );
    autoReportedIds = new Set(
      matchResult.pairs.map((pair) => pair.reported.id)
    );

    // Use legacy selectedIds if available, otherwise use auto-matched IDs
    selectedBacktestedIds = overrides
      ? new Set(overrides.selectedBacktestedIds)
      : autoBacktestedIds;
    selectedReportedIds = overrides
      ? new Set(overrides.selectedReportedIds)
      : autoReportedIds;
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[reconciliation]", {
      alignmentId: alignment.id,
      backtestedStrategy,
      reportedStrategy,
      backtestedCount: backtestedTrades.length,
      reportedCount: reportedTrades.length,
      matchedPairs: matchResult.pairs.length,
      useExplicitPairs,
    });
  }

  const includedBacktestedTrades =
    selectedBacktestedIds.size > 0
      ? backtestedTrades.filter((trade) => selectedBacktestedIds.has(trade.id))
      : backtestedTrades;

  const includedReportedTrades =
    selectedReportedIds.size > 0
      ? reportedTrades.filter((trade) => selectedReportedIds.has(trade.id))
      : reportedTrades;

  const matchedPairs = matchResult.pairs.filter((pair) =>
    selectedBacktestedIds.size === 0 || selectedReportedIds.size === 0
      ? true
      : selectedBacktestedIds.has(pair.backtested.id) &&
        selectedReportedIds.has(pair.reported.id)
  );

  const metrics = buildMetrics(
    includedBacktestedTrades,
    includedReportedTrades,
    matchedPairs,
    normalizeTo1Lot
  );

  if (process.env.NODE_ENV !== "production") {
    console.debug("[reconciliation] metrics", alignment.id, {
      backtestedTrades: includedBacktestedTrades.length,
      reportedTrades: includedReportedTrades.length,
      totalPl: metrics.backtested.totalPl,
      reportedPl: metrics.reported.totalPl,
      pairs: matchedPairs.length,
    });
  }

  const sessions = buildSessionMatches(
    backtestedTrades,
    reportedTrades,
    matchResult,
    selectedBacktestedIds,
    selectedReportedIds,
    autoBacktestedIds,
    autoReportedIds
  );

  return {
    alignmentId: alignment.id,
    backtestedStrategy,
    reportedStrategy,
    backtestedTrades,
    reportedTrades,
    metrics,
    sessions,
    autoSelectedBacktestedIds: Array.from(autoBacktestedIds),
    autoSelectedReportedIds: Array.from(autoReportedIds),
    selectedBacktestedIds: Array.from(selectedBacktestedIds),
    selectedReportedIds: Array.from(selectedReportedIds),
  };
}

function normalizeBacktestedTrade(trade: Trade): NormalizedTrade {
  const dateOpened = new Date(trade.dateOpened);
  const sortTime = resolveSortTime(dateOpened, trade.timeOpened);
  const contracts = trade.numContracts || 1;

  // OptionOmega-style CSV exports encode premium in cents (e.g. 1360 -> $13.60).
  // Prefer the precision flag captured during CSV parsing; fall back to legacy detection
  // for trades saved before that metadata existed.
  const isPremiumInCents =
    trade.premiumPrecision === "cents" ||
    (trade.premiumPrecision === undefined &&
      (trade.maxProfit !== undefined || trade.maxLoss !== undefined) &&
      Number.isInteger(trade.premium) &&
      Math.abs(trade.premium) >= 100);
  let premiumPerContract: number;
  let totalPremium: number;

  if (isPremiumInCents) {
    premiumPerContract = trade.premium / 100;
    totalPremium = premiumPerContract * contracts;
  } else {
    totalPremium = trade.premium;
    premiumPerContract =
      contracts !== 0 ? totalPremium / contracts : totalPremium;
  }

  return {
    id: buildTradeId(
      trade.strategy,
      dateOpened,
      trade.timeOpened,
      contracts,
      trade.pl
    ),
    strategy: trade.strategy,
    dateOpened,
    timeOpened: trade.timeOpened,
    sortTime,
    session: formatSession(dateOpened),
    dateClosed: trade.dateClosed ? new Date(trade.dateClosed) : undefined,
    premiumPerContract,
    totalPremium,
    contracts,
    pl: trade.pl,
    openingFees: trade.openingCommissionsFees ?? 0,
    closingFees: trade.closingCommissionsFees ?? 0,
    legs: trade.legs,
  };
}

function normalizeReportedTrade(trade: ReportingTrade): NormalizedTrade {
  const dateOpened = new Date(trade.dateOpened);
  const contracts = trade.numContracts || 1;
  const totalPremium = trade.initialPremium;
  const premiumPerContract =
    contracts !== 0 ? totalPremium / contracts : totalPremium;

  return {
    id: buildTradeId(
      trade.strategy,
      dateOpened,
      undefined,
      contracts,
      trade.pl
    ),
    strategy: trade.strategy,
    dateOpened,
    sortTime: resolveSortTime(dateOpened),
    session: formatSession(dateOpened),
    dateClosed: trade.dateClosed ? new Date(trade.dateClosed) : undefined,
    premiumPerContract,
    totalPremium,
    contracts,
    pl: trade.pl,
    openingFees: 0,
    closingFees: 0,
    legs: trade.legs,
  };
}

function autoMatchTrades(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[]
): AutoMatchResult {
  const pairs: MatchedPair[] = [];
  const unmatchedBacktested: NormalizedTrade[] = [];
  const unmatchedReported: NormalizedTrade[] = [];

  const backtestedBySession = groupBySession(backtestedTrades);
  const reportedBySession = groupBySession(reportedTrades);

  const sessionKeys = new Set([
    ...backtestedBySession.keys(),
    ...reportedBySession.keys(),
  ]);

  Array.from(sessionKeys)
    .sort()
    .forEach((session) => {
      const reportedList = [...(reportedBySession.get(session) ?? [])].sort(
        (a, b) => a.sortTime - b.sortTime
      );
      const backtestedList = [...(backtestedBySession.get(session) ?? [])].sort(
        (a, b) => a.sortTime - b.sortTime
      );

      const limit = Math.min(reportedList.length, backtestedList.length);

      for (let index = 0; index < limit; index++) {
        const reported = reportedList[index];
        const candidate = findBestWithinTolerance(reported, backtestedList);

        if (candidate) {
          pairs.push({ backtested: candidate, reported });
        } else {
          unmatchedReported.push(reported);
        }
      }

      if (reportedList.length > limit) {
        unmatchedReported.push(...reportedList.slice(limit));
      }
      if (backtestedList.length > 0) {
        unmatchedBacktested.push(...backtestedList);
      }
    });

  return { pairs, unmatchedBacktested, unmatchedReported };
}

function buildMatchResultFromPairs(
  tradePairs: TradePair[],
  backtestedById: Map<string, NormalizedTrade>,
  reportedById: Map<string, NormalizedTrade>,
  allBacktested: NormalizedTrade[],
  allReported: NormalizedTrade[]
): AutoMatchResult {
  const pairs: MatchedPair[] = [];
  const pairedBacktestedIds = new Set<string>();
  const pairedReportedIds = new Set<string>();

  // Build pairs from explicit pairing data
  tradePairs.forEach((pair) => {
    const backtested = backtestedById.get(pair.backtestedId);
    const reported = reportedById.get(pair.reportedId);

    if (backtested && reported) {
      pairs.push({ backtested, reported });
      pairedBacktestedIds.add(pair.backtestedId);
      pairedReportedIds.add(pair.reportedId);
    }
  });

  // Identify unmatched trades
  const unmatchedBacktested = allBacktested.filter(
    (trade) => !pairedBacktestedIds.has(trade.id)
  );
  const unmatchedReported = allReported.filter(
    (trade) => !pairedReportedIds.has(trade.id)
  );

  return { pairs, unmatchedBacktested, unmatchedReported };
}

/**
 * Extract option type from trade legs
 * Helps match Calls with Calls and Puts with Puts in strategies with concurrent positions
 */
function extractOptionType(
  legs: string | undefined
): "call" | "put" | "mixed" | "unknown" {
  if (!legs) return "unknown";

  const legString = legs.toLowerCase();
  const hasCall = legString.includes(" c ") || legString.includes("call");
  const hasPut = legString.includes(" p ") || legString.includes("put");

  if (hasCall && hasPut) return "mixed";
  if (hasCall) return "call";
  if (hasPut) return "put";
  return "unknown";
}

function findBestWithinTolerance(
  reported: NormalizedTrade,
  candidates: NormalizedTrade[]
): NormalizedTrade | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  // Extract option type from reported trade
  const reportedType = extractOptionType(reported.legs);

  // Find the closest match by time within tolerance, preferring matching option types
  let bestIdx = -1;
  let bestDiff = Number.POSITIVE_INFINITY;
  let bestMatchesType = false;

  candidates.forEach((candidate, idx) => {
    const diff = Math.abs(candidate.sortTime - reported.sortTime);
    if (diff > MATCH_TOLERANCE_MS) return;

    const candidateType = extractOptionType(candidate.legs);
    const matchesType =
      reportedType === candidateType ||
      reportedType === "unknown" ||
      candidateType === "unknown";

    // Prefer matching option types, then fall back to closest time
    const shouldReplace =
      bestIdx < 0 || // No match yet
      (matchesType && !bestMatchesType) || // This matches type, current best doesn't
      (matchesType === bestMatchesType && diff < bestDiff); // Same type-match status, closer time

    if (shouldReplace) {
      bestIdx = idx;
      bestDiff = diff;
      bestMatchesType = matchesType;
    }
  });

  if (bestIdx >= 0) {
    return candidates.splice(bestIdx, 1)[0];
  }

  return undefined;
}

function buildSessionMatches(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
  matchResult: AutoMatchResult,
  selectedBacktestedIds: Set<string>,
  selectedReportedIds: Set<string>,
  autoBacktestedIds: Set<string>,
  autoReportedIds: Set<string>
): TradeSessionMatch[] {
  type SessionData = {
    pairs: TradeSessionMatchItem[];
    unmatchedBack: NormalizedTrade[];
    unmatchedReported: NormalizedTrade[];
  };

  const sessionMap = new Map<string, SessionData>();
  const ensureSession = (session: string): SessionData => {
    const data = sessionMap.get(session);
    if (data) return data;
    const next: SessionData = {
      pairs: [],
      unmatchedBack: [],
      unmatchedReported: [],
    };
    sessionMap.set(session, next);
    return next;
  };

  matchResult.pairs.forEach((pair) => {
    const session = pair.backtested.session;
    const data = ensureSession(session);
    data.pairs.push({
      backtested: pair.backtested,
      reported: pair.reported,
      autoBacktested: autoBacktestedIds.has(pair.backtested.id),
      autoReported: autoReportedIds.has(pair.reported.id),
      includedBacktested: selectedBacktestedIds.has(pair.backtested.id),
      includedReported: selectedReportedIds.has(pair.reported.id),
      isPaired: true, // This item represents an actual pair
    });
  });

  matchResult.unmatchedBacktested.forEach((trade) => {
    ensureSession(trade.session).unmatchedBack.push(trade);
  });

  matchResult.unmatchedReported.forEach((trade) => {
    ensureSession(trade.session).unmatchedReported.push(trade);
  });

  const sessionKeys = new Set([
    ...backtestedTrades.map((t) => t.session),
    ...reportedTrades.map((t) => t.session),
  ]);

  const sortByTime = (item: TradeSessionMatchItem) =>
    item.backtested?.sortTime ?? item.reported?.sortTime ?? 0;

  return Array.from(sessionKeys)
    .sort()
    .map((session) => {
      const data = sessionMap.get(session) ?? {
        pairs: [],
        unmatchedBack: [],
        unmatchedReported: [],
      };

      const items: TradeSessionMatchItem[] = [...data.pairs];
      const maxUnmatched = Math.max(
        data.unmatchedBack.length,
        data.unmatchedReported.length
      );

      for (let index = 0; index < maxUnmatched; index++) {
        const backTrade = data.unmatchedBack[index];
        const reportedTrade = data.unmatchedReported[index];

        items.push({
          backtested: backTrade,
          reported: reportedTrade,
          autoBacktested: backTrade
            ? autoBacktestedIds.has(backTrade.id)
            : false,
          autoReported: reportedTrade
            ? autoReportedIds.has(reportedTrade.id)
            : false,
          includedBacktested: backTrade
            ? selectedBacktestedIds.has(backTrade.id)
            : false,
          includedReported: reportedTrade
            ? selectedReportedIds.has(reportedTrade.id)
            : false,
          isPaired: false, // This item is just unmatched trades displayed together
        });
      }

      items.sort((a, b) => sortByTime(a) - sortByTime(b));

      return {
        session,
        items,
      };
    });
}

function buildMetrics(
  selectedBacktested: NormalizedTrade[],
  selectedReported: NormalizedTrade[],
  matchedPairs: MatchedPair[],
  normalizeTo1Lot: boolean
): AlignmentMetrics {
  const backtestedTotals = calculateTradeTotals(
    selectedBacktested,
    normalizeTo1Lot
  );
  const reportedTotals = calculateTradeTotals(
    selectedReported,
    normalizeTo1Lot
  );
  const deltaTotals = calculateDeltaTotals(backtestedTotals, reportedTotals);

  const matchedTradeCount = matchedPairs.length;

  const normalizedContractWeight = (trade: NormalizedTrade): number =>
    normalizeTo1Lot ? 1 : trade.contracts;

  const normalizedPremium = (trade: NormalizedTrade): number =>
    normalizeTo1Lot ? trade.premiumPerContract : trade.totalPremium;

  const matchedBacktestedContractBaseline = matchedPairs.reduce(
    (sum, pair) => sum + normalizedContractWeight(pair.backtested),
    0
  );

  const matchedBacktestedContractsRaw = matchedPairs.reduce(
    (sum, pair) => sum + pair.backtested.contracts,
    0
  );

  const totalSlippage = matchedPairs.reduce(
    (sum, pair) =>
      sum +
      (normalizedPremium(pair.reported) - normalizedPremium(pair.backtested)),
    0
  );

  const slippagePerContract =
    matchedBacktestedContractBaseline > 0
      ? totalSlippage / matchedBacktestedContractBaseline
      : 0;

  const matchedBacktestedTotalPremium = matchedPairs.reduce(
    (sum, pair) => sum + normalizedPremium(pair.backtested),
    0
  );

  const matchedBacktestedAvgPremiumPerContract =
    matchedBacktestedContractBaseline > 0
      ? matchedBacktestedTotalPremium / matchedBacktestedContractBaseline
      : 0;

  const normalizedPairs: StatMatchedPair[] = matchedPairs.map((pair) => ({
    backtested: normalizeTradeForStats(pair.backtested, normalizeTo1Lot),
    reported: normalizeTradeForStats(pair.reported, normalizeTo1Lot),
  }));

  const sizeVariance =
    matchedBacktestedContractsRaw > 0
      ? matchedPairs.reduce(
          (sum, pair) =>
            sum + (pair.reported.contracts - pair.backtested.contracts),
          0
        ) / matchedBacktestedContractsRaw
      : 0;

  // Calculate match rate as percentage of matched pairs out of the larger dataset
  // This gives a more realistic alignment quality metric
  const totalTrades = Math.max(
    backtestedTotals.tradeCount,
    reportedTotals.tradeCount
  );
  const matchRate = totalTrades > 0 ? matchedPairs.length / totalTrades : 0;

  // Calculate statistical metrics for matched pairs
  const tTest = calculatePairedTTest(normalizedPairs);
  const correlation = calculateCorrelationMetrics(normalizedPairs);

  return {
    backtested: backtestedTotals,
    reported: reportedTotals,
    delta: deltaTotals,
    matchRate,
    slippagePerContract,
    sizeVariance,
    tTest,
    correlation,
    matched: {
      tradeCount: matchedTradeCount,
      totalSlippage,
      backtestedAvgPremiumPerContract: matchedBacktestedAvgPremiumPerContract,
      backtestedContractBaseline: matchedBacktestedContractBaseline,
    },
  };
}

function normalizeTradeForStats(
  trade: NormalizedTrade,
  normalizeTo1Lot: boolean
): NormalizedTrade {
  if (!normalizeTo1Lot || trade.contracts === 0) {
    return trade;
  }

  return {
    ...trade,
    pl: trade.pl / trade.contracts,
    totalPremium: trade.premiumPerContract,
    premiumPerContract: trade.premiumPerContract,
    openingFees: trade.openingFees / trade.contracts,
    closingFees: trade.closingFees / trade.contracts,
    contracts: 1,
  };
}

function calculateTradeTotals(
  trades: NormalizedTrade[],
  normalizeTo1Lot: boolean
): TradeTotals {
  const tradeCount = trades.length;

  // Scale values to per-contract if normalization is enabled
  const totalPl = trades.reduce((acc, trade) => {
    const pl =
      normalizeTo1Lot && trade.contracts > 0
        ? trade.pl / trade.contracts
        : trade.pl;
    return acc + pl;
  }, 0);

  const totalPremium = trades.reduce((acc, trade) => {
    const premium =
      normalizeTo1Lot && trade.contracts > 0
        ? trade.premiumPerContract
        : trade.totalPremium;
    return acc + premium;
  }, 0);

  const totalContracts = normalizeTo1Lot
    ? tradeCount
    : trades.reduce((acc, trade) => acc + trade.contracts, 0);

  const totalFees = trades.reduce((acc, trade) => {
    const fees =
      normalizeTo1Lot && trade.contracts > 0
        ? (trade.openingFees + trade.closingFees) / trade.contracts
        : trade.openingFees + trade.closingFees;
    return acc + fees;
  }, 0);

  const avgPl = tradeCount > 0 ? totalPl / tradeCount : 0;
  const avgPremiumPerContract =
    totalContracts > 0 ? totalPremium / totalContracts : 0;

  return {
    tradeCount,
    totalPl,
    avgPl,
    totalPremium,
    totalContracts,
    totalFees,
    avgPremiumPerContract,
  };
}

function calculateDeltaTotals(
  backtested: TradeTotals,
  reported: TradeTotals
): TradeDeltaTotals {
  return {
    tradeCount: reported.tradeCount - backtested.tradeCount,
    totalPl: reported.totalPl - backtested.totalPl,
    avgPl: reported.avgPl - backtested.avgPl,
    totalPremium: reported.totalPremium - backtested.totalPremium,
    totalContracts: reported.totalContracts - backtested.totalContracts,
    totalFees: reported.totalFees - backtested.totalFees,
    avgPremiumPerContract:
      reported.avgPremiumPerContract - backtested.avgPremiumPerContract,
  };
}

function filterBacktestedTrades(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[]
): NormalizedTrade[] {
  if (reportedTrades.length === 0) {
    return backtestedTrades;
  }

  const earliestSession = reportedTrades.reduce(
    (earliest, trade) => (trade.session < earliest ? trade.session : earliest),
    reportedTrades[0].session
  );

  return backtestedTrades.filter((trade) => trade.session >= earliestSession);
}

function resolveSortTime(dateOpened: Date, timeOpened?: string): number {
  if (timeOpened) {
    const session = formatSession(dateOpened);
    const [rawHours = "0", rawMinutes = "0", rawSeconds = "0"] =
      timeOpened.split(":");
    const pad = (value: string) => value.padStart(2, "0");
    const hours = pad(rawHours);
    const minutes = pad(rawMinutes);
    const seconds = pad(rawSeconds);
    return new Date(`${session}T${hours}:${minutes}:${seconds}`).getTime();
  }

  return dateOpened.getTime();
}

function buildTradeId(
  strategy: string,
  dateOpened: Date,
  timeOpened: string | undefined,
  contracts: number,
  pl: number
): string {
  return [
    strategy,
    dateOpened.toISOString(),
    timeOpened ?? "na",
    contracts,
    Number(pl.toFixed(2)),
  ].join("|");
}

import { format } from "date-fns";

function formatSession(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function groupByStrategy(
  trades: NormalizedTrade[]
): Map<string, NormalizedTrade[]> {
  const map = new Map<string, NormalizedTrade[]>();

  trades.forEach((trade) => {
    const list = map.get(trade.strategy) ?? [];
    list.push(trade);
    map.set(trade.strategy, list);
  });

  return map;
}

function groupBySession(
  trades: NormalizedTrade[]
): Map<string, NormalizedTrade[]> {
  const map = new Map<string, NormalizedTrade[]>();

  trades.forEach((trade) => {
    const list = map.get(trade.session) ?? [];
    list.push(trade);
    map.set(trade.session, list);
  });

  map.forEach((list) => {
    list.sort((a, b) => a.sortTime - b.sortTime);
  });

  return map;
}
