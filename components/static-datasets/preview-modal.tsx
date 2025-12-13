"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react"
import type { StaticDataset, StaticDatasetRow, DatasetMatchResult } from "@/lib/models/static-dataset"
import { MATCH_STRATEGY_LABELS } from "@/lib/models/static-dataset"
import type { Trade } from "@/lib/models/trade"
import {
  matchTradesToDataset,
  calculateMatchStats,
  formatTimeDifference,
  combineDateAndTime,
} from "@/lib/calculations/static-dataset-matcher"
import { useStaticDatasetsStore } from "@/lib/stores/static-datasets-store"
import { useBlockStore } from "@/lib/stores/block-store"
import { getTradesByBlock } from "@/lib/db"

interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataset: StaticDataset | null
}

interface PreviewData {
  trades: Trade[]
  rows: StaticDatasetRow[]
  matchResults: DatasetMatchResult[]
  stats: {
    totalTrades: number
    matchedTrades: number
    outsideDateRange: number
    matchPercentage: number
  }
}

export function PreviewModal({ open, onOpenChange, dataset }: PreviewModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getDatasetRows = useStaticDatasetsStore((state) => state.getDatasetRows)
  const activeBlockId = useBlockStore((state) => state.activeBlockId)
  const blocks = useBlockStore((state) => state.blocks)

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId),
    [blocks, activeBlockId]
  )

  // Load preview data when modal opens
  useEffect(() => {
    if (!open || !dataset) {
      setPreviewData(null)
      setError(null)
      return
    }

    if (!activeBlockId) {
      setError("No active block selected. Please activate a block to preview matching.")
      return
    }

    const loadPreviewData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Load dataset rows and block trades in parallel
        const [rows, trades] = await Promise.all([
          getDatasetRows(dataset.id),
          getTradesByBlock(activeBlockId),
        ])

        if (trades.length === 0) {
          setError("No trades found in the active block.")
          setIsLoading(false)
          return
        }

        // Calculate matches
        const matchResults = matchTradesToDataset(trades, dataset, rows)
        const stats = calculateMatchStats(trades, dataset, rows)

        setPreviewData({
          trades,
          rows,
          matchResults,
          stats,
        })
      } catch (err) {
        console.error("Failed to load preview data:", err)
        setError(err instanceof Error ? err.message : "Failed to load preview data")
      } finally {
        setIsLoading(false)
      }
    }

    loadPreviewData()
  }, [open, dataset, activeBlockId, getDatasetRows])

  const formatTradeTime = (trade: Trade) => {
    const timestamp = combineDateAndTime(trade.dateOpened, trade.timeOpened)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(timestamp)
  }

  const formatMatchedTime = (date: Date | null) => {
    if (!date) return "No match"
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date))
  }

  // Get first data column for preview
  const previewColumn = dataset?.columns[0] || "value"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Preview: {dataset?.name} → &quot;{activeBlock?.name || "No Block"}&quot;
          </DialogTitle>
          <DialogDescription>
            Match Strategy: {dataset ? MATCH_STRATEGY_LABELS[dataset.matchStrategy] : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview Data */}
          {previewData && !isLoading && (
            <>
              {/* Stats Summary */}
              <div className="flex flex-wrap gap-3">
                <Badge
                  variant={previewData.stats.matchPercentage >= 90 ? "default" : "secondary"}
                  className="text-sm py-1 px-3"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {previewData.stats.matchedTrades}/{previewData.stats.totalTrades} trades matched (
                  {previewData.stats.matchPercentage}%)
                </Badge>
                {previewData.stats.outsideDateRange > 0 && (
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    {previewData.stats.outsideDateRange} trades outside dataset date range
                  </Badge>
                )}
              </div>

              {/* Info about preview */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Showing how trades in &quot;{activeBlock?.name}&quot; would match to {dataset?.name} data.
                  Column shown: <code className="text-xs bg-muted px-1 rounded">{dataset?.name}.{previewColumn}</code>
                </AlertDescription>
              </Alert>

              {/* Match Table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Trade Open Time</th>
                      <th className="text-left p-3 font-medium">Matched Timestamp</th>
                      <th className="text-left p-3 font-medium">Offset</th>
                      <th className="text-right p-3 font-medium">
                        {dataset?.name}.{previewColumn}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.matchResults.slice(0, 100).map((result, index) => {
                      const trade = previewData.trades[index]
                      const value = result.matchedRow?.values[previewColumn]

                      return (
                        <tr
                          key={index}
                          className={`border-t ${!result.matchedRow ? "bg-destructive/5" : ""}`}
                        >
                          <td className="p-3 font-mono text-xs">
                            {formatTradeTime(trade)}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {formatMatchedTime(result.matchedTimestamp)}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={result.matchedRow ? "outline" : "destructive"}
                              className="text-xs"
                            >
                              {formatTimeDifference(result.timeDifferenceMs)}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            {value !== undefined
                              ? typeof value === "number"
                                ? value.toFixed(2)
                                : value
                              : "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {previewData.matchResults.length > 100 && (
                  <div className="p-3 text-center text-sm text-muted-foreground bg-muted border-t">
                    Showing first 100 of {previewData.matchResults.length} trades
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
