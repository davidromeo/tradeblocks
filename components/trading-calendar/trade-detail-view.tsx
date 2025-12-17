'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTradingCalendarStore } from '@/lib/stores/trading-calendar-store'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { formatCurrency, scaleTradeValues } from '@/lib/services/calendar-data'
import { cn } from '@/lib/utils'

interface DetailRowProps {
  label: string
  value: string | number | null | undefined
  format?: 'currency' | 'number' | 'text' | 'percent' | 'premium'
  scaleFactor?: number | null
}

function DetailRow({
  label,
  value,
  format = 'text',
  scaleFactor = null
}: DetailRowProps) {
  const formatValue = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'string') return val
    if (format === 'currency') return formatCurrency(val)
    if (format === 'number') return val.toLocaleString()
    if (format === 'percent') return `${val.toFixed(2)}%`
    if (format === 'premium') {
      // Format as debit (db) or credit (cr)
      const absVal = Math.abs(val)
      const formatted = absVal.toFixed(2)
      return val < 0 ? `${formatted} db` : `${formatted} cr`
    }
    return String(val)
  }

  // Apply scaling if provided
  const hasScaling = scaleFactor !== null && scaleFactor !== 1 && typeof value === 'number'
  const scaledValue = hasScaling ? (value as number) * scaleFactor! : null

  const primaryValue = scaledValue ?? value
  const primaryFormatted = formatValue(primaryValue)
  const rawFormatted = hasScaling ? formatValue(value) : null

  return (
    <div className="grid grid-cols-2 gap-4 py-2 border-b border-border/50">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-right">
        {primaryFormatted}
        {rawFormatted && (
          <span className="text-xs text-muted-foreground ml-1">
            (raw: {rawFormatted})
          </span>
        )}
      </div>
    </div>
  )
}

interface SingleTradeCardProps {
  trade: ReportingTrade
  tradeIndex: number
  totalTrades: number
  scalingMode: 'raw' | 'perContract' | 'toReported'
}

function ActualTradeCard({ trade, tradeIndex, totalTrades, scalingMode }: SingleTradeCardProps) {
  const scaleFactor = useMemo(() => {
    if (scalingMode === 'raw') return null
    if (scalingMode === 'perContract') {
      return trade.numContracts > 0 ? 1 / trade.numContracts : null
    }
    return null
  }, [scalingMode, trade.numContracts])

  const tradeLabel = totalTrades > 1 ? ` (Trade ${tradeIndex + 1} of ${totalTrades})` : ''

  return (
    <Card className="pt-2 pb-4">
      <CardHeader className="pt-2 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Trade Details{tradeLabel}
            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/50 text-xs">
              Actual
            </Badge>
          </CardTitle>
          <div className={cn(
            "text-lg font-bold",
            trade.pl > 0 && "text-green-500",
            trade.pl < 0 && "text-red-500"
          )}>
            {formatCurrency(trade.pl)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DetailRow
          label="Time Opened"
          value={trade.timeOpened ?? '-'}
        />
        <DetailRow
          label="Time Closed"
          value={trade.timeClosed ?? '-'}
        />
        <DetailRow
          label="Opening Price"
          value={trade.openingPrice}
          format="number"
        />
        <DetailRow
          label="Legs"
          value={trade.legs}
        />
        <DetailRow
          label="Premium"
          value={trade.initialPremium}
          format="premium"
        />
        <DetailRow
          label="Contracts"
          value={trade.numContracts}
          format="number"
        />
        <DetailRow
          label="Closing Price"
          value={trade.closingPrice}
          format="number"
        />
        <DetailRow
          label="Avg Closing Cost"
          value={trade.avgClosingCost}
          format="currency"
          scaleFactor={scaleFactor}
        />
        <DetailRow
          label="Reason for Close"
          value={trade.reasonForClose}
        />
        <DetailRow
          label="P&L"
          value={trade.pl}
          format="currency"
          scaleFactor={scaleFactor}
        />
      </CardContent>
    </Card>
  )
}

interface BacktestTradeCardProps {
  trade: Trade
  tradeIndex: number
  totalTrades: number
  scalingMode: 'raw' | 'perContract' | 'toReported'
  actualContracts?: number
}

function BacktestTradeCard({ trade, tradeIndex, totalTrades, scalingMode, actualContracts }: BacktestTradeCardProps) {
  const scaleFactor = useMemo(() => {
    if (scalingMode === 'raw') return null
    if (scalingMode === 'perContract') {
      return trade.numContracts > 0 ? 1 / trade.numContracts : null
    }
    if (scalingMode === 'toReported' && actualContracts) {
      return trade.numContracts > 0 ? actualContracts / trade.numContracts : null
    }
    return null
  }, [scalingMode, trade.numContracts, actualContracts])

  const tradeLabel = totalTrades > 1 ? ` (Trade ${tradeIndex + 1} of ${totalTrades})` : ''

  return (
    <Card className="pt-2 pb-4">
      <CardHeader className="pt-2 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Trade Details{tradeLabel}
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/50 text-xs">
              Backtest
            </Badge>
          </CardTitle>
          <div className={cn(
            "text-lg font-bold",
            trade.pl > 0 && "text-green-500",
            trade.pl < 0 && "text-red-500"
          )}>
            {formatCurrency(scaleFactor ? trade.pl * scaleFactor : trade.pl)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DetailRow
          label="Time Opened"
          value={trade.timeOpened ?? '-'}
        />
        <DetailRow
          label="Time Closed"
          value={trade.timeClosed ?? '-'}
        />
        <DetailRow
          label="Opening Price"
          value={trade.openingPrice}
          format="number"
        />
        <DetailRow
          label="Legs"
          value={trade.legs}
        />
        <DetailRow
          label="Premium"
          value={trade.premium}
          format="premium"
        />
        <DetailRow
          label="Contracts"
          value={trade.numContracts}
          format="number"
        />
        <DetailRow
          label="Closing Price"
          value={trade.closingPrice}
          format="number"
        />
        <DetailRow
          label="Avg Closing Cost"
          value={trade.avgClosingCost}
          format="currency"
          scaleFactor={scaleFactor}
        />
        <DetailRow
          label="Reason for Close"
          value={trade.reasonForClose}
        />
        <DetailRow
          label="P&L"
          value={trade.pl}
          format="currency"
          scaleFactor={scaleFactor}
        />

        <Separator className="my-2" />

        <div className="text-xs text-muted-foreground uppercase tracking-wide py-2">
          Additional Backtest Details
        </div>

        <DetailRow
          label="Opening Commissions"
          value={trade.openingCommissionsFees}
          format="currency"
          scaleFactor={scaleFactor}
        />
        <DetailRow
          label="Closing Commissions"
          value={trade.closingCommissionsFees}
          format="currency"
          scaleFactor={scaleFactor}
        />
        <DetailRow
          label="Margin Requirement"
          value={trade.marginReq}
          format="currency"
          scaleFactor={scaleFactor}
        />

        {trade.openingVix && (
          <DetailRow
            label="Opening VIX"
            value={trade.openingVix}
            format="number"
          />
        )}
        {trade.closingVix && (
          <DetailRow
            label="Closing VIX"
            value={trade.closingVix}
            format="number"
          />
        )}
        {trade.gap !== undefined && (
          <DetailRow
            label="Gap"
            value={trade.gap}
            format="percent"
          />
        )}
        {trade.movement !== undefined && (
          <DetailRow
            label="Movement"
            value={trade.movement}
            format="percent"
          />
        )}
        {trade.maxProfit !== undefined && (
          <DetailRow
            label="Max Profit"
            value={trade.maxProfit}
            format="percent"
          />
        )}
        {trade.maxLoss !== undefined && (
          <DetailRow
            label="Max Loss"
            value={trade.maxLoss}
            format="percent"
          />
        )}
      </CardContent>
    </Card>
  )
}

export function TradeDetailView() {
  const {
    selectedDate,
    selectedStrategy,
    calendarDays,
    scalingMode
  } = useTradingCalendarStore()

  const dayData = selectedDate ? calendarDays.get(selectedDate) : undefined

  // Find trades for this strategy on this day
  const backtestTrades = useMemo(() => {
    if (!dayData || !selectedStrategy) return []
    return dayData.backtestTrades.filter(t => t.strategy === selectedStrategy)
  }, [dayData, selectedStrategy])

  const actualTrades = useMemo(() => {
    if (!dayData || !selectedStrategy) return []
    return dayData.actualTrades.filter(t => t.strategy === selectedStrategy)
  }, [dayData, selectedStrategy])

  // Calculate totals for the summary header
  const btTotals = useMemo(() => {
    if (backtestTrades.length === 0) return null
    return {
      pl: backtestTrades.reduce((sum, t) => sum + t.pl, 0),
      contracts: backtestTrades.reduce((sum, t) => sum + t.numContracts, 0),
      tradeCount: backtestTrades.length
    }
  }, [backtestTrades])

  const actualTotals = useMemo(() => {
    if (actualTrades.length === 0) return null
    return {
      pl: actualTrades.reduce((sum, t) => sum + t.pl, 0),
      contracts: actualTrades.reduce((sum, t) => sum + t.numContracts, 0),
      tradeCount: actualTrades.length
    }
  }, [actualTrades])

  // Scale totals based on scaling mode
  const scaledTotals = useMemo(() => {
    // For the header, use the first trades to get scale factor (consistent with previous behavior)
    const backtestTrade = backtestTrades[0] ?? null
    const actualTrade = actualTrades[0] ?? null
    return scaleTradeValues(backtestTrade, actualTrade, scalingMode)
  }, [backtestTrades, actualTrades, scalingMode])

  // Early return after all hooks
  if (!selectedDate || !selectedStrategy) return null
  if (!dayData) return null

  const hasBacktest = backtestTrades.length > 0
  const hasActual = actualTrades.length > 0

  return (
    <div className="space-y-4">
      {/* Strategy summary header */}
      <Card className="py-3">
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-6">
            {/* Left: Strategy name and badges */}
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{selectedStrategy}</h2>
              <div className="flex gap-1.5">
                {hasBacktest && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/50 text-xs">
                    Backtest
                  </Badge>
                )}
                {hasActual && (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/50 text-xs">
                    Actual
                  </Badge>
                )}
              </div>
              {scalingMode !== 'raw' && (
                <span className="text-xs text-muted-foreground">
                  {scalingMode === 'perContract' ? '(per contract)' : '(scaled to actual)'}
                </span>
              )}
            </div>

            {/* Right: P&L totals */}
            <div className="flex items-center gap-6">
              {scaledTotals.backtest && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Backtest</div>
                  <div className={cn(
                    "text-lg font-bold",
                    scaledTotals.backtest.pl > 0 && "text-green-500",
                    scaledTotals.backtest.pl < 0 && "text-red-500"
                  )}>
                    {formatCurrency(scaledTotals.backtest.pl)}
                  </div>
                  {scalingMode === 'raw' && btTotals && (
                    <div className="text-xs text-muted-foreground">
                      {btTotals.contracts}c · {btTotals.tradeCount}t
                    </div>
                  )}
                </div>
              )}

              {scaledTotals.actual && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Actual</div>
                  <div className={cn(
                    "text-lg font-bold",
                    scaledTotals.actual.pl > 0 && "text-green-500",
                    scaledTotals.actual.pl < 0 && "text-red-500"
                  )}>
                    {formatCurrency(scaledTotals.actual.pl)}
                  </div>
                  {scalingMode === 'raw' && actualTotals && (
                    <div className="text-xs text-muted-foreground">
                      {actualTotals.contracts}c · {actualTotals.tradeCount}t
                    </div>
                  )}
                </div>
              )}

              {scaledTotals.slippage !== null && (
                <div className="text-right border-l border-border pl-6">
                  <div className="text-xs text-muted-foreground">Slippage</div>
                  <div className={cn(
                    "text-lg font-bold",
                    scaledTotals.slippage > 0 && "text-green-500",
                    scaledTotals.slippage < 0 && "text-red-500"
                  )}>
                    {formatCurrency(scaledTotals.slippage)}
                  </div>
                  {scaledTotals.backtest && scaledTotals.backtest.pl !== 0 && (
                    <div className="text-xs text-muted-foreground">
                      {((scaledTotals.slippage / Math.abs(scaledTotals.backtest.pl)) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual actual trade cards */}
      {actualTrades.map((trade, index) => (
        <ActualTradeCard
          key={`actual-${index}`}
          trade={trade}
          tradeIndex={index}
          totalTrades={actualTrades.length}
          scalingMode={scalingMode}
        />
      ))}

      {/* Individual backtest trade cards */}
      {backtestTrades.map((trade, index) => (
        <BacktestTradeCard
          key={`backtest-${index}`}
          trade={trade}
          tradeIndex={index}
          totalTrades={backtestTrades.length}
          scalingMode={scalingMode}
          actualContracts={actualTotals?.contracts}
        />
      ))}
    </div>
  )
}
