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

interface ComparisonRowProps {
  label: string
  backtestValue: string | number | null | undefined
  actualValue: string | number | null | undefined
  format?: 'currency' | 'number' | 'text' | 'percent'
  highlightDiff?: boolean
}

function ComparisonRow({
  label,
  backtestValue,
  actualValue,
  format = 'text',
  highlightDiff = false
}: ComparisonRowProps) {
  const formatValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'string') return value
    if (format === 'currency') return formatCurrency(value)
    if (format === 'number') return value.toLocaleString()
    if (format === 'percent') return `${value.toFixed(2)}%`
    return String(value)
  }

  const btFormatted = formatValue(backtestValue)
  const actualFormatted = formatValue(actualValue)

  // Calculate if there's a meaningful difference for highlighting
  const showDiff = highlightDiff &&
    typeof backtestValue === 'number' &&
    typeof actualValue === 'number' &&
    backtestValue !== actualValue

  const diff = showDiff ? (actualValue as number) - (backtestValue as number) : 0

  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-border/50">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-center">
        {btFormatted}
      </div>
      <div className={cn(
        "text-sm font-medium text-center",
        showDiff && diff > 0 && "text-green-500",
        showDiff && diff < 0 && "text-red-500"
      )}>
        {actualFormatted}
        {showDiff && format === 'currency' && (
          <span className="text-xs ml-1">
            ({diff > 0 ? '+' : ''}{formatCurrency(diff)})
          </span>
        )}
      </div>
    </div>
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

  // For now, use the first trade from each side for comparison
  // Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual
  const backtestTrade: Trade | null = backtestTrades[0] ?? null
  const actualTrade: ReportingTrade | null = actualTrades[0] ?? null

  // Scale values based on scaling mode - must be called unconditionally
  const scaledValues = useMemo(() => {
    return scaleTradeValues(backtestTrade, actualTrade, scalingMode)
  }, [backtestTrade, actualTrade, scalingMode])

  // Calculate aggregated totals for multiple trades - must be called unconditionally
  // Note: backtestTrades are Trade (tradelog.csv), actualTrades are ReportingTrade (strategylog.csv)
  const btTotals = useMemo(() => {
    if (backtestTrades.length === 0) return null
    return {
      pl: backtestTrades.reduce((sum, t) => sum + t.pl, 0),
      contracts: backtestTrades.reduce((sum, t) => sum + t.numContracts, 0),
      premium: backtestTrades.reduce((sum, t) => sum + t.premium, 0),
      commissions: backtestTrades.reduce((sum, t) =>
        sum + (t.openingCommissionsFees ?? 0) + (t.closingCommissionsFees ?? 0), 0),
      tradeCount: backtestTrades.length
    }
  }, [backtestTrades])

  const actualTotals = useMemo(() => {
    if (actualTrades.length === 0) return null
    return {
      pl: actualTrades.reduce((sum, t) => sum + t.pl, 0),
      contracts: actualTrades.reduce((sum, t) => sum + t.numContracts, 0),
      premium: actualTrades.reduce((sum, t) => sum + t.initialPremium, 0),
      tradeCount: actualTrades.length
    }
  }, [actualTrades])

  // Early return after all hooks
  if (!selectedDate || !selectedStrategy) return null
  if (!dayData) return null

  // Format time
  const formatTime = (date: Date | undefined, time?: string): string => {
    if (!date) return '-'
    if (time) return time
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      {/* Trade summary header */}
      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{selectedStrategy}</CardTitle>
            <div className="flex gap-2">
              {backtestTrade && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/50">
                  Backtest
                </Badge>
              )}
              {actualTrade && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/50">
                  Actual
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Scaling mode indicator */}
          {scalingMode !== 'raw' && (
            <div className="text-xs text-muted-foreground mb-3">
              {scalingMode === 'perContract' && '* Values normalized to 1 contract'}
              {scalingMode === 'toReported' && '* Backtest scaled to match actual contract count'}
            </div>
          )}

          {/* P&L Summary */}
          <div className="flex items-center gap-8">
            {scaledValues.backtest && (
              <div>
                <span className="text-sm text-muted-foreground">Backtest P&L</span>
                <div className={cn(
                  "text-2xl font-bold",
                  scaledValues.backtest.pl > 0 && "text-green-500",
                  scaledValues.backtest.pl < 0 && "text-red-500"
                )}>
                  {formatCurrency(scaledValues.backtest.pl)}
                </div>
                {scalingMode === 'raw' && btTotals && (
                  <span className="text-xs text-muted-foreground">
                    {btTotals.contracts} contracts, {btTotals.tradeCount} trades
                  </span>
                )}
              </div>
            )}

            {scaledValues.actual && (
              <div>
                <span className="text-sm text-muted-foreground">Actual P&L</span>
                <div className={cn(
                  "text-2xl font-bold",
                  scaledValues.actual.pl > 0 && "text-green-500",
                  scaledValues.actual.pl < 0 && "text-red-500"
                )}>
                  {formatCurrency(scaledValues.actual.pl)}
                </div>
                {scalingMode === 'raw' && actualTotals && (
                  <span className="text-xs text-muted-foreground">
                    {actualTotals.contracts} contracts, {actualTotals.tradeCount} trades
                  </span>
                )}
              </div>
            )}

            {scaledValues.slippage !== null && (
              <div>
                <span className="text-sm text-muted-foreground">Slippage</span>
                <div className={cn(
                  "text-2xl font-bold",
                  scaledValues.slippage > 0 && "text-green-500",
                  scaledValues.slippage < 0 && "text-red-500"
                )}>
                  {formatCurrency(scaledValues.slippage)}
                </div>
                {scaledValues.backtest && scaledValues.backtest.pl !== 0 && (
                  <span className="text-xs text-muted-foreground">
                    {((scaledValues.slippage / Math.abs(scaledValues.backtest.pl)) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed comparison table */}
      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trade Details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-4 py-2 border-b-2 border-border">
            <div className="text-sm font-medium text-muted-foreground">Field</div>
            <div className="text-sm font-medium text-center text-blue-500">Backtest</div>
            <div className="text-sm font-medium text-center text-purple-500">Actual</div>
          </div>

          {/* Time */}
          <ComparisonRow
            label="Time Opened"
            backtestValue={backtestTrade ? formatTime(backtestTrade.dateOpened, backtestTrade.timeOpened) : null}
            actualValue={actualTrade ? formatTime(actualTrade.dateOpened) : null}
          />

          {/* Opening Price */}
          <ComparisonRow
            label="Opening Price"
            backtestValue={backtestTrade?.openingPrice}
            actualValue={actualTrade?.openingPrice}
            format="number"
            highlightDiff
          />

          {/* Legs */}
          <ComparisonRow
            label="Legs"
            backtestValue={backtestTrade?.legs}
            actualValue={actualTrade?.legs}
          />

          {/* Premium */}
          <ComparisonRow
            label="Premium"
            backtestValue={backtestTrade?.premium}
            actualValue={actualTrade?.initialPremium}
            format="currency"
            highlightDiff
          />

          {/* Contracts */}
          <ComparisonRow
            label="Contracts"
            backtestValue={backtestTrade?.numContracts}
            actualValue={actualTrade?.numContracts}
            format="number"
          />

          {/* Closing Price */}
          <ComparisonRow
            label="Closing Price"
            backtestValue={backtestTrade?.closingPrice}
            actualValue={actualTrade?.closingPrice}
            format="number"
            highlightDiff
          />

          {/* Avg Closing Cost */}
          <ComparisonRow
            label="Avg Closing Cost"
            backtestValue={backtestTrade?.avgClosingCost}
            actualValue={actualTrade?.avgClosingCost}
            format="currency"
            highlightDiff
          />

          {/* Reason for Close */}
          <ComparisonRow
            label="Reason for Close"
            backtestValue={backtestTrade?.reasonForClose}
            actualValue={actualTrade?.reasonForClose}
          />

          {/* P&L */}
          <ComparisonRow
            label="P&L"
            backtestValue={backtestTrade?.pl}
            actualValue={actualTrade?.pl}
            format="currency"
            highlightDiff
          />

          <Separator className="my-2" />

          {/* Backtest-only fields (Trade from tradelog.csv has extra fields) */}
          {backtestTrade && (
            <>
              <div className="text-xs text-muted-foreground uppercase tracking-wide py-2">
                Backtest Trade Details
              </div>

              <ComparisonRow
                label="Opening Commissions"
                backtestValue={backtestTrade.openingCommissionsFees}
                actualValue={null}
                format="currency"
              />

              <ComparisonRow
                label="Closing Commissions"
                backtestValue={backtestTrade.closingCommissionsFees}
                actualValue={null}
                format="currency"
              />

              <ComparisonRow
                label="Margin Requirement"
                backtestValue={backtestTrade.marginReq}
                actualValue={null}
                format="currency"
              />

              {backtestTrade.openingVix && (
                <ComparisonRow
                  label="Opening VIX"
                  backtestValue={backtestTrade.openingVix}
                  actualValue={null}
                  format="number"
                />
              )}

              {backtestTrade.closingVix && (
                <ComparisonRow
                  label="Closing VIX"
                  backtestValue={backtestTrade.closingVix}
                  actualValue={null}
                  format="number"
                />
              )}

              {backtestTrade.gap !== undefined && (
                <ComparisonRow
                  label="Gap"
                  backtestValue={backtestTrade.gap}
                  actualValue={null}
                  format="percent"
                />
              )}

              {backtestTrade.movement !== undefined && (
                <ComparisonRow
                  label="Movement"
                  backtestValue={backtestTrade.movement}
                  actualValue={null}
                  format="percent"
                />
              )}

              {backtestTrade.maxProfit !== undefined && (
                <ComparisonRow
                  label="Max Profit"
                  backtestValue={backtestTrade.maxProfit}
                  actualValue={null}
                  format="percent"
                />
              )}

              {backtestTrade.maxLoss !== undefined && (
                <ComparisonRow
                  label="Max Loss"
                  backtestValue={backtestTrade.maxLoss}
                  actualValue={null}
                  format="percent"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Multiple trades notice */}
      {(backtestTrades.length > 1 || actualTrades.length > 1) && (
        <Card className="py-3 bg-muted/30">
          <CardContent className="px-4 py-0 text-sm text-muted-foreground">
            Note: This strategy had {backtestTrades.length > 1 ? `${backtestTrades.length} backtest trades` : ''}
            {backtestTrades.length > 1 && actualTrades.length > 1 ? ' and ' : ''}
            {actualTrades.length > 1 ? `${actualTrades.length} actual trades` : ''} on this day.
            Showing details for the first trade of each. Totals reflect all trades.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
