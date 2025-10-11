import { getReportingTradesByBlock, getTradesByBlock } from '@/lib/db'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { StrategyAlignment, MatchOverrides, TradePair } from '@/lib/models/strategy-alignment'
import { Trade } from '@/lib/models/trade'

const MATCH_TOLERANCE_MS = 30 * 60 * 1000 // 30 minutes

export interface NormalizedTrade {
  id: string
  strategy: string
  dateOpened: Date
  timeOpened?: string
  sortTime: number
  session: string
  dateClosed?: Date
  premiumPerContract: number
  totalPremium: number
  contracts: number
  pl: number
  openingFees: number
  closingFees: number
}

export interface TradeSessionMatchItem {
  backtested?: NormalizedTrade
  reported?: NormalizedTrade
  autoBacktested: boolean
  autoReported: boolean
  includedBacktested: boolean
  includedReported: boolean
}

export interface TradeSessionMatch {
  session: string
  items: TradeSessionMatchItem[]
}

export interface AlignmentMetrics {
  backtested: TradeTotals
  reported: TradeTotals
  delta: TradeDeltaTotals
  matchRate: number
  slippagePerContract: number
  sizeVariance: number
  notes?: string
}

export interface AlignedTradeSet {
  alignmentId: string
  backtestedStrategy: string
  reportedStrategy: string
  backtestedTrades: NormalizedTrade[]
  reportedTrades: NormalizedTrade[]
  metrics: AlignmentMetrics
  sessions: TradeSessionMatch[]
  autoSelectedBacktestedIds: string[]
  autoSelectedReportedIds: string[]
  selectedBacktestedIds: string[]
  selectedReportedIds: string[]
}

export interface TradeTotals {
  tradeCount: number
  totalPl: number
  avgPl: number
  totalPremium: number
  totalContracts: number
  totalFees: number
  avgPremiumPerContract: number
}

export type TradeDeltaTotals = TradeTotals

export interface ReconciliationPayload {
  alignments: AlignedTradeSet[]
  unmappedReported: string[]
  unmappedBacktested: string[]
}

interface MatchedPair {
  backtested: NormalizedTrade
  reported: NormalizedTrade
}

interface AutoMatchResult {
  pairs: MatchedPair[]
  unmatchedBacktested: NormalizedTrade[]
  unmatchedReported: NormalizedTrade[]
}

export async function buildTradeReconciliation(
  blockId: string,
  alignments: StrategyAlignment[],
): Promise<ReconciliationPayload> {
  const [backtestedTrades, reportedTrades] = await Promise.all([
    getTradesByBlock(blockId),
    getReportingTradesByBlock(blockId),
  ])

  const normalizedBacktested = backtestedTrades.map(normalizeBacktestedTrade)
  const normalizedReported = reportedTrades.map(normalizeReportedTrade)

  const backtestedByStrategy = groupByStrategy(normalizedBacktested)
  const reportedByStrategy = groupByStrategy(normalizedReported)

  const alignmentSets: AlignedTradeSet[] = alignments.map((alignment) =>
    buildAlignmentSet(alignment, backtestedByStrategy, reportedByStrategy),
  )

  const alignedReported = new Set(
    alignmentSets.flatMap((set) => [set.reportedStrategy]),
  )
  const alignedBacktested = new Set(
    alignmentSets.flatMap((set) => [set.backtestedStrategy]),
  )

  const unmappedReported = Array.from(reportedByStrategy.keys()).filter(
    (strategy) => !alignedReported.has(strategy),
  )
  const unmappedBacktested = Array.from(backtestedByStrategy.keys()).filter(
    (strategy) => !alignedBacktested.has(strategy),
  )

  return {
    alignments: alignmentSets,
    unmappedReported,
    unmappedBacktested,
  }
}

function buildAlignmentSet(
  alignment: StrategyAlignment,
  backtestedByStrategy: Map<string, NormalizedTrade[]>,
  reportedByStrategy: Map<string, NormalizedTrade[]>,
): AlignedTradeSet {
  const backtestedStrategy = alignment.liveStrategies[0] ?? 'Unknown'
  const reportedStrategy = alignment.reportingStrategies[0] ?? 'Unknown'

  const reportedTrades = reportedByStrategy.get(reportedStrategy) ?? []
  const backtestedTradesRaw = backtestedByStrategy.get(backtestedStrategy) ?? []
  const backtestedTrades = filterBacktestedTrades(backtestedTradesRaw, reportedTrades)

  // Build lookup maps for trades by ID
  const backtestedById = new Map(backtestedTrades.map((t) => [t.id, t]))
  const reportedById = new Map(reportedTrades.map((t) => [t.id, t]))

  const overrides: MatchOverrides | undefined = alignment.matchOverrides

  // Determine if we should use explicit pairs or auto-match
  const useExplicitPairs = overrides?.tradePairs && overrides.tradePairs.length > 0

  let matchResult: AutoMatchResult
  let selectedBacktestedIds: Set<string>
  let selectedReportedIds: Set<string>
  let autoBacktestedIds: Set<string>
  let autoReportedIds: Set<string>

  if (useExplicitPairs) {
    // Use explicit trade pairs from overrides
    matchResult = buildMatchResultFromPairs(
      overrides.tradePairs!,
      backtestedById,
      reportedById,
      backtestedTrades,
      reportedTrades,
    )

    // With explicit pairs, selected IDs come from the pairs
    selectedBacktestedIds = new Set(
      overrides.tradePairs!.map((p) => p.backtestedId).filter((id) => backtestedById.has(id)),
    )
    selectedReportedIds = new Set(
      overrides.tradePairs!.map((p) => p.reportedId).filter((id) => reportedById.has(id)),
    )

    // Auto IDs are those marked as non-manual
    autoBacktestedIds = new Set(
      overrides.tradePairs!.filter((p) => !p.manual).map((p) => p.backtestedId),
    )
    autoReportedIds = new Set(
      overrides.tradePairs!.filter((p) => !p.manual).map((p) => p.reportedId),
    )
  } else {
    // Fall back to auto-matching
    matchResult = autoMatchTrades(backtestedTrades, reportedTrades)

    autoBacktestedIds = new Set(
      matchResult.pairs.map((pair) => pair.backtested.id),
    )
    autoReportedIds = new Set(
      matchResult.pairs.map((pair) => pair.reported.id),
    )

    // Use legacy selectedIds if available, otherwise use auto-matched IDs
    selectedBacktestedIds = overrides
      ? new Set(overrides.selectedBacktestedIds)
      : autoBacktestedIds
    selectedReportedIds = overrides
      ? new Set(overrides.selectedReportedIds)
      : autoReportedIds
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[reconciliation]', {
      alignmentId: alignment.id,
      backtestedStrategy,
      reportedStrategy,
      backtestedCount: backtestedTrades.length,
      reportedCount: reportedTrades.length,
      matchedPairs: matchResult.pairs.length,
      useExplicitPairs,
    })
  }

  const includedBacktestedTrades =
    selectedBacktestedIds.size > 0
      ? backtestedTrades.filter((trade) => selectedBacktestedIds.has(trade.id))
      : backtestedTrades

  const includedReportedTrades =
    selectedReportedIds.size > 0
      ? reportedTrades.filter((trade) => selectedReportedIds.has(trade.id))
      : reportedTrades

  const matchedPairs = matchResult.pairs.filter((pair) =>
    selectedBacktestedIds.size === 0 || selectedReportedIds.size === 0
      ? true
      : selectedBacktestedIds.has(pair.backtested.id) &&
          selectedReportedIds.has(pair.reported.id),
  )

  const metrics = buildMetrics(
    includedBacktestedTrades,
    includedReportedTrades,
    matchedPairs,
  )

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[reconciliation] metrics', alignment.id, {
      backtestedTrades: includedBacktestedTrades.length,
      reportedTrades: includedReportedTrades.length,
      totalPl: metrics.backtested.totalPl,
      reportedPl: metrics.reported.totalPl,
      pairs: matchedPairs.length,
    })
  }

  const sessions = buildSessionMatches(
    backtestedTrades,
    reportedTrades,
    matchResult,
    selectedBacktestedIds,
    selectedReportedIds,
    autoBacktestedIds,
    autoReportedIds,
  )

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
  }
}

function normalizeBacktestedTrade(trade: Trade): NormalizedTrade {
  const dateOpened = new Date(trade.dateOpened)
  const sortTime = resolveSortTime(dateOpened, trade.timeOpened)
  const contracts = trade.numContracts || 1
  const premiumPerContract =
    contracts !== 0 ? trade.premium / contracts : trade.premium

  return {
    id: buildTradeId(trade.strategy, dateOpened, trade.timeOpened, contracts, trade.pl),
    strategy: trade.strategy,
    dateOpened,
    timeOpened: trade.timeOpened,
    sortTime,
    session: formatSession(dateOpened),
    dateClosed: trade.dateClosed ? new Date(trade.dateClosed) : undefined,
    premiumPerContract,
    totalPremium: trade.premium,
    contracts,
    pl: trade.pl,
    openingFees: trade.openingCommissionsFees ?? 0,
    closingFees: trade.closingCommissionsFees ?? 0,
  }
}

function normalizeReportedTrade(trade: ReportingTrade): NormalizedTrade {
  const dateOpened = new Date(trade.dateOpened)
  const contracts = trade.numContracts || 1
  const premiumPerContract =
    contracts !== 0 ? trade.initialPremium / contracts : trade.initialPremium

  return {
    id: buildTradeId(trade.strategy, dateOpened, undefined, contracts, trade.pl),
    strategy: trade.strategy,
    dateOpened,
    sortTime: resolveSortTime(dateOpened),
    session: formatSession(dateOpened),
    dateClosed: trade.dateClosed ? new Date(trade.dateClosed) : undefined,
    premiumPerContract,
    totalPremium: trade.initialPremium,
    contracts,
    pl: trade.pl,
    openingFees: 0,
    closingFees: 0,
  }
}

function autoMatchTrades(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
): AutoMatchResult {
  const pairs: MatchedPair[] = []
  const unmatchedBacktested: NormalizedTrade[] = []
  const unmatchedReported: NormalizedTrade[] = []

  const backtestedBySession = groupBySession(backtestedTrades)
  const reportedBySession = groupBySession(reportedTrades)

  const sessionKeys = new Set([
    ...backtestedBySession.keys(),
    ...reportedBySession.keys(),
  ])

  Array.from(sessionKeys)
    .sort()
    .forEach((session) => {
      const reportedList = [...(reportedBySession.get(session) ?? [])].sort(
        (a, b) => a.sortTime - b.sortTime,
      )
      const backtestedList = [...(backtestedBySession.get(session) ?? [])].sort(
        (a, b) => a.sortTime - b.sortTime,
      )

      const limit = Math.min(reportedList.length, backtestedList.length)

      for (let index = 0; index < limit; index++) {
        const reported = reportedList[index]
        const candidate = findBestWithinTolerance(
          reported,
          backtestedList,
          index,
        )

        if (candidate) {
          pairs.push({ backtested: candidate, reported })
        } else {
          unmatchedReported.push(reported)
        }
      }

      if (reportedList.length > limit) {
        unmatchedReported.push(...reportedList.slice(limit))
      }
      if (backtestedList.length > 0) {
        unmatchedBacktested.push(...backtestedList)
      }
    })

  return { pairs, unmatchedBacktested, unmatchedReported }
}

function buildMatchResultFromPairs(
  tradePairs: TradePair[],
  backtestedById: Map<string, NormalizedTrade>,
  reportedById: Map<string, NormalizedTrade>,
  allBacktested: NormalizedTrade[],
  allReported: NormalizedTrade[],
): AutoMatchResult {
  const pairs: MatchedPair[] = []
  const pairedBacktestedIds = new Set<string>()
  const pairedReportedIds = new Set<string>()

  // Build pairs from explicit pairing data
  tradePairs.forEach((pair) => {
    const backtested = backtestedById.get(pair.backtestedId)
    const reported = reportedById.get(pair.reportedId)

    if (backtested && reported) {
      pairs.push({ backtested, reported })
      pairedBacktestedIds.add(pair.backtestedId)
      pairedReportedIds.add(pair.reportedId)
    }
  })

  // Identify unmatched trades
  const unmatchedBacktested = allBacktested.filter(
    (trade) => !pairedBacktestedIds.has(trade.id),
  )
  const unmatchedReported = allReported.filter(
    (trade) => !pairedReportedIds.has(trade.id),
  )

  return { pairs, unmatchedBacktested, unmatchedReported }
}

function findBestWithinTolerance(
  reported: NormalizedTrade,
  candidates: NormalizedTrade[],
  indexHint: number,
): NormalizedTrade | undefined {
  if (candidates.length === 0) {
    return undefined
  }

  const preferred = candidates[indexHint]
  if (preferred) {
    const diff = Math.abs(preferred.sortTime - reported.sortTime)
    if (diff <= MATCH_TOLERANCE_MS) {
      candidates.splice(indexHint, 1)
      return preferred
    }
  }

  let bestIdx = -1
  let bestDiff = Number.POSITIVE_INFINITY

  candidates.forEach((candidate, idx) => {
    const diff = Math.abs(candidate.sortTime - reported.sortTime)
    if (diff <= MATCH_TOLERANCE_MS && diff < bestDiff) {
      bestIdx = idx
      bestDiff = diff
    }
  })

  if (bestIdx >= 0) {
    return candidates.splice(bestIdx, 1)[0]
  }

  return undefined
}

function buildSessionMatches(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
  matchResult: AutoMatchResult,
  selectedBacktestedIds: Set<string>,
  selectedReportedIds: Set<string>,
  autoBacktestedIds: Set<string>,
  autoReportedIds: Set<string>,
): TradeSessionMatch[] {
  type SessionData = {
    pairs: TradeSessionMatchItem[]
    unmatchedBack: NormalizedTrade[]
    unmatchedReported: NormalizedTrade[]
  }

  const sessionMap = new Map<string, SessionData>()
  const ensureSession = (session: string): SessionData => {
    const data = sessionMap.get(session)
    if (data) return data
    const next: SessionData = { pairs: [], unmatchedBack: [], unmatchedReported: [] }
    sessionMap.set(session, next)
    return next
  }

  matchResult.pairs.forEach((pair) => {
    const session = pair.backtested.session
    const data = ensureSession(session)
    data.pairs.push({
      backtested: pair.backtested,
      reported: pair.reported,
      autoBacktested: autoBacktestedIds.has(pair.backtested.id),
      autoReported: autoReportedIds.has(pair.reported.id),
      includedBacktested: selectedBacktestedIds.has(pair.backtested.id),
      includedReported: selectedReportedIds.has(pair.reported.id),
    })
  })

  matchResult.unmatchedBacktested.forEach((trade) => {
    ensureSession(trade.session).unmatchedBack.push(trade)
  })

  matchResult.unmatchedReported.forEach((trade) => {
    ensureSession(trade.session).unmatchedReported.push(trade)
  })

  const sessionKeys = new Set([
    ...backtestedTrades.map((t) => t.session),
    ...reportedTrades.map((t) => t.session),
  ])

  const sortByTime = (item: TradeSessionMatchItem) =>
    item.backtested?.sortTime ?? item.reported?.sortTime ?? 0

  return Array.from(sessionKeys)
    .sort()
    .map((session) => {
      const data = sessionMap.get(session) ?? {
        pairs: [],
        unmatchedBack: [],
        unmatchedReported: [],
      }

      const items: TradeSessionMatchItem[] = [...data.pairs]
      const maxUnmatched = Math.max(
        data.unmatchedBack.length,
        data.unmatchedReported.length,
      )

      for (let index = 0; index < maxUnmatched; index++) {
        const backTrade = data.unmatchedBack[index]
        const reportedTrade = data.unmatchedReported[index]

        items.push({
          backtested: backTrade,
          reported: reportedTrade,
          autoBacktested: backTrade ? autoBacktestedIds.has(backTrade.id) : false,
          autoReported: reportedTrade
            ? autoReportedIds.has(reportedTrade.id)
            : false,
          includedBacktested: backTrade
            ? selectedBacktestedIds.has(backTrade.id)
            : false,
          includedReported: reportedTrade
            ? selectedReportedIds.has(reportedTrade.id)
            : false,
        })
      }

      items.sort((a, b) => sortByTime(a) - sortByTime(b))

      return {
        session,
        items,
      }
    })
}

function buildMetrics(
  selectedBacktested: NormalizedTrade[],
  selectedReported: NormalizedTrade[],
  matchedPairs: MatchedPair[],
): AlignmentMetrics {
  const backtestedTotals = calculateTradeTotals(selectedBacktested)
  const reportedTotals = calculateTradeTotals(selectedReported)
  const deltaTotals = calculateDeltaTotals(backtestedTotals, reportedTotals)

  const matchedBacktestedContracts = matchedPairs.reduce(
    (sum, pair) => sum + pair.backtested.contracts,
    0,
  )

  const slippagePerContract =
    matchedBacktestedContracts > 0
      ? matchedPairs.reduce(
          (sum, pair) =>
            sum + (pair.reported.totalPremium - pair.backtested.totalPremium),
          0,
        ) / matchedBacktestedContracts
      : 0

  const sizeVariance =
    matchedBacktestedContracts > 0
      ? matchedPairs.reduce(
          (sum, pair) =>
            sum + (pair.reported.contracts - pair.backtested.contracts),
          0,
        ) / matchedBacktestedContracts
      : 0

  const matchRate =
    backtestedTotals.tradeCount > 0
      ? matchedPairs.length / backtestedTotals.tradeCount
      : 0

  return {
    backtested: backtestedTotals,
    reported: reportedTotals,
    delta: deltaTotals,
    matchRate,
    slippagePerContract,
    sizeVariance,
  }
}

function calculateTradeTotals(trades: NormalizedTrade[]): TradeTotals {
  const tradeCount = trades.length
  const totalPl = trades.reduce((acc, trade) => acc + trade.pl, 0)
  const totalPremium = trades.reduce((acc, trade) => acc + trade.totalPremium, 0)
  const totalContracts = trades.reduce((acc, trade) => acc + trade.contracts, 0)
  const totalFees = trades.reduce(
    (acc, trade) => acc + trade.openingFees + trade.closingFees,
    0,
  )

  const avgPl = tradeCount > 0 ? totalPl / tradeCount : 0
  const avgPremiumPerContract =
    totalContracts > 0 ? totalPremium / totalContracts : 0

  return {
    tradeCount,
    totalPl,
    avgPl,
    totalPremium,
    totalContracts,
    totalFees,
    avgPremiumPerContract,
  }
}

function calculateDeltaTotals(
  backtested: TradeTotals,
  reported: TradeTotals,
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
  }
}

function filterBacktestedTrades(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
): NormalizedTrade[] {
  if (reportedTrades.length === 0) {
    return backtestedTrades
  }

  const earliestSession = reportedTrades.reduce((earliest, trade) =>
    trade.session < earliest ? trade.session : earliest,
  reportedTrades[0].session)

  return backtestedTrades.filter((trade) => trade.session >= earliestSession)
}

function resolveSortTime(dateOpened: Date, timeOpened?: string): number {
  if (timeOpened) {
    const session = formatSession(dateOpened)
    const [rawHours = '0', rawMinutes = '0', rawSeconds = '0'] = timeOpened.split(':')
    const pad = (value: string) => value.padStart(2, '0')
    const hours = pad(rawHours)
    const minutes = pad(rawMinutes)
    const seconds = pad(rawSeconds)
    return new Date(`${session}T${hours}:${minutes}:${seconds}`).getTime()
  }

  return dateOpened.getTime()
}

function buildTradeId(
  strategy: string,
  dateOpened: Date,
  timeOpened: string | undefined,
  contracts: number,
  pl: number,
): string {
  return [
    strategy,
    dateOpened.toISOString(),
    timeOpened ?? 'na',
    contracts,
    Number(pl.toFixed(2)),
  ].join('|')
}

function formatSession(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function groupByStrategy(trades: NormalizedTrade[]): Map<string, NormalizedTrade[]> {
  const map = new Map<string, NormalizedTrade[]>()

  trades.forEach((trade) => {
    const list = map.get(trade.strategy) ?? []
    list.push(trade)
    map.set(trade.strategy, list)
  })

  return map
}

function groupBySession(trades: NormalizedTrade[]): Map<string, NormalizedTrade[]> {
  const map = new Map<string, NormalizedTrade[]>()

  trades.forEach((trade) => {
    const list = map.get(trade.session) ?? []
    list.push(trade)
    map.set(trade.session, list)
  })

  map.forEach((list) => {
    list.sort((a, b) => a.sortTime - b.sortTime)
  })

  return map
}
