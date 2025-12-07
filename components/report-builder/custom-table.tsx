"use client"

/**
 * Custom Table
 *
 * Displays aggregated trade statistics in a table format,
 * bucketed by the X-axis field with user-defined thresholds.
 */

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { ChartAxisConfig, getFieldInfo } from '@/lib/models/report-config'
import { buildTableRows } from '@/lib/calculations/table-aggregation'

interface CustomTableProps {
  trades: EnrichedTrade[]
  xAxis: ChartAxisConfig
  bucketEdges: number[]
  className?: string
}

/**
 * Format a number as currency
 */
function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  const formatted = absValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
  return value < 0 ? `-${formatted}` : formatted
}

/**
 * Format a number as percentage
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Get CSS class for P&L value coloring
 */
function getPlColorClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return ''
}

export function CustomTable({
  trades,
  xAxis,
  bucketEdges,
  className
}: CustomTableProps) {
  // Build table rows
  const rows = useMemo(() => {
    if (!bucketEdges || bucketEdges.length === 0) {
      return []
    }
    return buildTableRows(trades, xAxis.field, bucketEdges)
  }, [trades, xAxis.field, bucketEdges])

  // Get field info for header
  const fieldInfo = getFieldInfo(xAxis.field)
  const fieldLabel = fieldInfo?.label ?? xAxis.field

  // Calculate totals
  const totals = useMemo(() => {
    if (rows.length === 0) return null

    const totalCount = rows.reduce((sum, r) => sum + r.count, 0)
    const totalPl = rows.reduce((sum, r) => sum + r.totalPl, 0)
    const totalWinners = rows.reduce((sum, r) => sum + Math.round(r.count * r.winRate / 100), 0)

    return {
      count: totalCount,
      winRate: totalCount > 0 ? (totalWinners / totalCount) * 100 : 0,
      avgPlDollar: totalCount > 0 ? totalPl / totalCount : 0,
      totalPl
    }
  }, [rows])

  if (rows.length === 0) {
    return (
      <div className={`text-center text-muted-foreground py-8 ${className ?? ''}`}>
        {bucketEdges.length === 0
          ? 'Enter bucket thresholds to generate table'
          : 'No trades match the current filters'}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border bg-muted/20 ${className ?? ''}`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">{fieldLabel}</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">Avg P&L (%)</TableHead>
              <TableHead className="text-right">Avg P&L ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{formatPercent(row.winRate)}</TableCell>
                <TableCell className={`text-right ${getPlColorClass(row.avgPlPercent)}`}>
                  {formatPercent(row.avgPlPercent)}
                </TableCell>
                <TableCell className={`text-right ${getPlColorClass(row.avgPlDollar)}`}>
                  {formatCurrency(row.avgPlDollar)}
                </TableCell>
              </TableRow>
            ))}

            {/* Totals row */}
            {totals && (
              <TableRow className="border-t-2 font-medium bg-muted/30">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.count}</TableCell>
                <TableCell className="text-right">{formatPercent(totals.winRate)}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className={`text-right ${getPlColorClass(totals.avgPlDollar)}`}>
                  {formatCurrency(totals.avgPlDollar)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default CustomTable
