"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchReviewDialog } from "@/components/match-review-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  getReportingTradesByBlock,
  getTradesByBlock,
  updateBlock as updateProcessedBlock,
} from "@/lib/db";
import { StrategyAlignment } from "@/lib/models/strategy-alignment";
import { useBlockStore } from "@/lib/stores/block-store";
import { useComparisonStore, type AlignedTradeSet } from "@/lib/stores/comparison-store";
import type { NormalizedTrade } from "@/lib/services/trade-reconciliation";
import { cn } from "@/lib/utils";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface SelectableStrategy {
  name: string;
  count: number;
  totalPl: number;
}

function buildStrategySummary(
  strategies: string[],
  values: { strategy: string; pl: number }[]
): SelectableStrategy[] {
  const summary = new Map<string, { count: number; totalPl: number }>();
  strategies.forEach((name) => {
    summary.set(name, { count: 0, totalPl: 0 });
  });

  values.forEach(({ strategy, pl }) => {
    const entry = summary.get(strategy) ?? { count: 0, totalPl: 0 };
    entry.count += 1;
    entry.totalPl += pl;
    summary.set(strategy, entry);
  });

  return Array.from(summary.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function ComparisonBlocksPage() {
  const activeBlock = useBlockStore((state) => {
    const activeBlockId = state.activeBlockId;
    return activeBlockId
      ? state.blocks.find((block) => block.id === activeBlockId)
      : null;
  });
  const refreshBlock = useBlockStore((state) => state.refreshBlock);
  const comparisonData = useComparisonStore((state) => state.data);
  const comparisonError = useComparisonStore((state) => state.error);
  const comparisonLoading = useComparisonStore((state) => state.isLoading);
  const refreshComparison = useComparisonStore((state) => state.refresh);
  const resetComparison = useComparisonStore((state) => state.reset);
  const activeBlockId = activeBlock?.id ?? null;

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingStrategies, setReportingStrategies] = useState<
    SelectableStrategy[]
  >([]);
  const [backtestedStrategies, setBacktestedStrategies] = useState<
    SelectableStrategy[]
  >([]);
  const [alignments, setAlignments] = useState<StrategyAlignment[]>([]);
  const [matchDialogAlignmentId, setMatchDialogAlignmentId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReporting, setSelectedReporting] = useState<string | null>(
    null
  );
  const [selectedBacktested, setSelectedBacktested] = useState<string | null>(
    null
  );
  const [dialogNote, setDialogNote] = useState("");

  useEffect(() => {
    if (!activeBlock) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const blockId = activeBlock.id;
        const [trades, reportingTrades] = await Promise.all([
          getTradesByBlock(blockId),
          getReportingTradesByBlock(blockId),
        ]);

        const uniqueBacktested = Array.from(
          new Set(trades.map((trade) => trade.strategy || "Unknown"))
        ).sort((a, b) => a.localeCompare(b));
        const uniqueReporting = Array.from(
          new Set(reportingTrades.map((trade) => trade.strategy || "Unknown"))
        ).sort((a, b) => a.localeCompare(b));

        setBacktestedStrategies(
          buildStrategySummary(
            uniqueBacktested,
            trades.map((trade) => ({
              strategy: trade.strategy || "Unknown",
              pl: trade.pl,
            }))
          )
        );

        setReportingStrategies(
          buildStrategySummary(
            uniqueReporting,
            reportingTrades.map((trade) => ({
              strategy: trade.strategy || "Unknown",
              pl: trade.pl,
            }))
          )
        );

        const existingAlignments =
          activeBlock.strategyAlignment?.mappings ?? [];
        if (process.env.NODE_ENV !== "production") {
          console.debug("[comparison] loaded alignments", existingAlignments);
        }
        setAlignments(
          existingAlignments.map((mapping) => ({
            ...mapping,
            createdAt: new Date(mapping.createdAt),
            updatedAt: new Date(mapping.updatedAt),
          }))
        );
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to load comparison data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    load().catch(console.error);
  }, [activeBlock]);

  useEffect(() => {
    if (!activeBlockId) {
      resetComparison();
      return;
    }

    if (alignments.length === 0) {
      resetComparison();
      return;
    }

    refreshComparison(activeBlockId, alignments).catch(console.error);
  }, [activeBlockId, alignments, refreshComparison, resetComparison]);

  const alignmentCoverage = useMemo(() => {
    const reportingCovered = new Set<string>();
    const backtestedCovered = new Set<string>();

    alignments.forEach((mapping) => {
      mapping.reportingStrategies.forEach((strategy) =>
        reportingCovered.add(strategy)
      );
      mapping.liveStrategies.forEach((strategy) =>
        backtestedCovered.add(strategy)
      );
    });

    return {
      reportingCovered,
      backtestedCovered,
    };
  }, [alignments]);

  const editingMapping = useMemo(
    () =>
      editingId ? alignments.find((mapping) => mapping.id === editingId) : null,
    [alignments, editingId]
  );

  const reportingMappedSet = useMemo(() => {
    const set = new Set(alignmentCoverage.reportingCovered);
    if (editingMapping) {
      editingMapping.reportingStrategies.forEach((strategy) =>
        set.delete(strategy)
      );
    }
    return set;
  }, [alignmentCoverage.reportingCovered, editingMapping]);

  const backtestedMappedSet = useMemo(() => {
    const set = new Set(alignmentCoverage.backtestedCovered);
    if (editingMapping) {
      editingMapping.liveStrategies.forEach((strategy) => set.delete(strategy));
    }
    return set;
  }, [alignmentCoverage.backtestedCovered, editingMapping]);

  const combinedError = error ?? comparisonError;

  const handleOpenMatchDialog = (alignmentId: string) => {
    setMatchDialogAlignmentId(alignmentId);
  };

  const activeMatchAlignment = matchDialogAlignmentId
    ? comparisonData?.alignments.find(
        (alignment) => alignment.alignmentId === matchDialogAlignmentId,
      ) ?? null
    : null;

  const summaryRows = useMemo(() => {
    if (!comparisonData) return [];
    if (process.env.NODE_ENV !== "production") {
      console.debug("[comparison] reconciliation", comparisonData);
    }

    return comparisonData.alignments.map((alignment) => ({
      id: alignment.alignmentId,
      reportedStrategy: alignment.reportedStrategy,
      backtestedStrategy: alignment.backtestedStrategy,
      reported: alignment.metrics.reported,
      backtested: alignment.metrics.backtested,
      delta: alignment.metrics.delta,
      matchRate: alignment.metrics.matchRate,
      slippagePerContract: alignment.metrics.slippagePerContract,
      sizeVariance: alignment.metrics.sizeVariance,
      selectedBacktestedCount:
        alignment.selectedBacktestedIds.length > 0
          ? alignment.selectedBacktestedIds.length
          : alignment.backtestedTrades.length,
      totalBacktestedCount: alignment.backtestedTrades.length,
      selectedReportedCount:
        alignment.selectedReportedIds.length > 0
          ? alignment.selectedReportedIds.length
          : alignment.reportedTrades.length,
      totalReportedCount: alignment.reportedTrades.length,
    }));
  }, [comparisonData]);

  const aggregateSummary = useMemo(() => {
    if (summaryRows.length === 0) {
      return null;
    }

    const result = summaryRows.reduce(
      (acc, row) => {
        acc.backtested.tradeCount += row.backtested.tradeCount;
        acc.backtested.totalPl += row.backtested.totalPl;
        acc.backtested.totalFees += row.backtested.totalFees;
        acc.backtested.totalPremium += row.backtested.totalPremium;
        acc.backtested.totalContracts += row.backtested.totalContracts;

        acc.reported.tradeCount += row.reported.tradeCount;
        acc.reported.totalPl += row.reported.totalPl;
        acc.reported.totalFees += row.reported.totalFees;
        acc.reported.totalPremium += row.reported.totalPremium;
        acc.reported.totalContracts += row.reported.totalContracts;

        acc.delta.tradeCount += row.delta.tradeCount;
        acc.delta.totalPl += row.delta.totalPl;
        acc.delta.totalFees += row.delta.totalFees;
        acc.delta.totalPremium += row.delta.totalPremium;
        acc.delta.totalContracts += row.delta.totalContracts;

        acc.matchRateNumerator +=
          Math.min(row.reported.tradeCount, row.backtested.tradeCount);
        acc.matchRateDenominator += row.backtested.tradeCount;
        acc.slippageNumerator +=
          row.slippagePerContract * Math.max(row.backtested.totalContracts, 1);
        acc.slippageDenominator += Math.max(
          row.backtested.totalContracts,
          1,
        );
        acc.sizeNumerator +=
          row.sizeVariance * Math.max(row.backtested.totalContracts, 1);
        acc.sizeDenominator += Math.max(row.backtested.totalContracts, 1);

        return acc;
      },
      {
        backtested: {
          tradeCount: 0,
          totalPl: 0,
          avgPl: 0,
          totalPremium: 0,
          totalContracts: 0,
          totalFees: 0,
          avgPremiumPerContract: 0,
        },
        reported: {
          tradeCount: 0,
          totalPl: 0,
          avgPl: 0,
          totalPremium: 0,
          totalContracts: 0,
          totalFees: 0,
          avgPremiumPerContract: 0,
        },
        delta: {
          tradeCount: 0,
          totalPl: 0,
          avgPl: 0,
          totalPremium: 0,
          totalContracts: 0,
          totalFees: 0,
          avgPremiumPerContract: 0,
        },
        matchRateNumerator: 0,
        matchRateDenominator: 0,
        slippageNumerator: 0,
        slippageDenominator: 0,
        sizeNumerator: 0,
        sizeDenominator: 0,
      },
    )

    result.backtested.avgPl =
      result.backtested.tradeCount > 0
        ? result.backtested.totalPl / result.backtested.tradeCount
        : 0
    result.backtested.avgPremiumPerContract =
      result.backtested.totalContracts > 0
        ? result.backtested.totalPremium / result.backtested.totalContracts
        : 0

    result.reported.avgPl =
      result.reported.tradeCount > 0
        ? result.reported.totalPl / result.reported.tradeCount
        : 0
    result.reported.avgPremiumPerContract =
      result.reported.totalContracts > 0
        ? result.reported.totalPremium / result.reported.totalContracts
        : 0

    result.delta.avgPl =
      result.backtested.tradeCount > 0
        ? result.delta.totalPl / result.backtested.tradeCount
        : 0
    result.delta.avgPremiumPerContract =
      result.backtested.totalContracts > 0
        ? result.delta.totalPremium / result.backtested.totalContracts
        : 0

    return result
  }, [summaryRows]);

  const aggregateTradeCounts = useMemo(
    () =>
      summaryRows.reduce(
        (acc, row) => {
          acc.backtested.selected += row.selectedBacktestedCount;
          acc.backtested.total += row.totalBacktestedCount;
          acc.reported.selected += row.selectedReportedCount;
          acc.reported.total += row.totalReportedCount;
          return acc;
        },
        {
          backtested: { selected: 0, total: 0 },
          reported: { selected: 0, total: 0 },
        },
      ),
    [summaryRows],
  )

  const aggregateMatchRate = useMemo(() => {
    const expectedTrades = summaryRows.reduce(
      (sum, row) => sum + row.backtested.tradeCount,
      0,
    )
    if (expectedTrades === 0) return 0

    const matchedTrades = summaryRows.reduce(
      (sum, row) => sum + row.matchRate * row.backtested.tradeCount,
      0,
    )

    return matchedTrades / expectedTrades
  }, [summaryRows])

  const aggregateSlippagePerContract = useMemo(() => {
    let numerator = 0
    let denominator = 0

    summaryRows.forEach((row) => {
      const weight = Math.max(row.backtested.totalContracts, 1)
      numerator += row.slippagePerContract * weight
      denominator += weight
    })

    return denominator > 0 ? numerator / denominator : 0
  }, [summaryRows])

  const aggregateSizeVariance = useMemo(() => {
    let numerator = 0
    let denominator = 0

    summaryRows.forEach((row) => {
      const weight = Math.max(row.backtested.totalContracts, 1)
      numerator += row.sizeVariance * weight
      denominator += weight
    })

    return denominator > 0 ? numerator / denominator : 0
  }, [summaryRows])

  const handleSaveMatchOverrides = async (
    alignmentId: string,
    backtestedIds: string[],
    reportedIds: string[],
  ) => {
    const autoData = comparisonData?.alignments.find(
      (alignment) => alignment.alignmentId === alignmentId,
    )

    if (!autoData) {
      setMatchDialogAlignmentId(null)
      return
    }

    const backSet = new Set(backtestedIds)
    const reportedSet = new Set(reportedIds)
    const autoBackSet = new Set(autoData.autoSelectedBacktestedIds)
    const autoReportedSet = new Set(autoData.autoSelectedReportedIds)

    const shouldStore =
      !setsEqual(backSet, autoBackSet) || !setsEqual(reportedSet, autoReportedSet)

    const nextAlignments = alignments.map((alignment) =>
      alignment.id === alignmentId
        ? {
            ...alignment,
            matchOverrides: shouldStore
              ? {
                  selectedBacktestedIds: Array.from(backSet),
                  selectedReportedIds: Array.from(reportedSet),
                }
              : undefined,
          }
        : alignment,
    )

    void persistAlignments(nextAlignments)
    setMatchDialogAlignmentId(null)
  }

  const persistAlignments = async (nextAlignments: StrategyAlignment[]) => {
    if (!activeBlock) {
      setAlignments(nextAlignments);
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const payload = {
        version: 1,
        updatedAt: new Date(),
        mappings: nextAlignments.map((mapping) => ({
          ...mapping,
          createdAt: mapping.createdAt,
          updatedAt: new Date(),
        })),
      };

      await updateProcessedBlock(activeBlock.id, {
        strategyAlignment: payload,
      });
      await refreshBlock(activeBlock.id);
      setAlignments(nextAlignments);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to persist alignments"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const resetDialogState = () => {
    setSelectedReporting(null);
    setSelectedBacktested(null);
    setDialogNote("");
    setEditingId(null);
    setDialogMode("create");
  };

  const openCreateDialog = () => {
    resetDialogState();
    setDialogMode("create");
    setIsDialogOpen(true);
  };

  const openEditDialog = (mapping: StrategyAlignment) => {
    setDialogMode("edit");
    setEditingId(mapping.id);
    setSelectedReporting(mapping.reportingStrategies[0] ?? null);
    setSelectedBacktested(mapping.liveStrategies[0] ?? null);
    setDialogNote(mapping.note ?? "");
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      resetDialogState();
    } else {
      setIsDialogOpen(true);
    }
  };

  const removeMapping = async (id: string) => {
    const next = alignments.filter((mapping) => mapping.id !== id);
    await persistAlignments(next);
  };

  const upsertMapping = async () => {
    if (!selectedReporting || !selectedBacktested) {
      return;
    }

    const now = new Date();

    if (dialogMode === "edit" && editingId) {
      const next = alignments.map((mapping) =>
        mapping.id === editingId
          ? {
              ...mapping,
              reportingStrategies: [selectedReporting],
              liveStrategies: [selectedBacktested],
              note: dialogNote.trim() || undefined,
              updatedAt: now,
            }
          : mapping
      );
      await persistAlignments(next);
    } else {
      const newMapping: StrategyAlignment = {
        id: crypto.randomUUID(),
        reportingStrategies: [selectedReporting],
        liveStrategies: [selectedBacktested],
        note: dialogNote.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      await persistAlignments([...alignments, newMapping]);
    }

    setIsDialogOpen(false);
    resetDialogState();
  };

  if (!activeBlock) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>No Active Block Selected</CardTitle>
            <CardDescription>
              Choose a block from the sidebar to align reporting strategies with
              live trades.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Comparison Blocks
          </h1>
          <p className="text-sm text-muted-foreground">
            Map reporting strategies from your backtests to live trade
            strategies for the block
            <span className="font-medium text-foreground">
              {" "}
              {activeBlock.name}
            </span>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Reporting strategies: {reportingStrategies.length}
          </Badge>
          <Badge variant="outline">
            Backtested strategies: {backtestedStrategies.length}
          </Badge>
          {comparisonData && (
            <>
              <Badge variant="outline">
                Unmapped reported: {comparisonData.unmappedReported.length}
              </Badge>
              <Badge variant="outline">
                Unmapped backtested: {comparisonData.unmappedBacktested.length}
              </Badge>
            </>
          )}
        </div>
      </div>

      {combinedError && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive">
              Something went wrong
            </CardTitle>
            <CardDescription className="text-destructive/80">
              {combinedError}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={openCreateDialog}
          disabled={isLoading || comparisonLoading}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Strategy Mapping
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aligned Strategies</CardTitle>
          <CardDescription>
            Review, edit, or remove existing mappings before saving them back to
            the block.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(isLoading || comparisonLoading) && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isLoading ? "Loading strategy data..." : "Reconciling mappings..."}
            </div>
          )}
          {!isLoading && !comparisonLoading && alignments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No mappings yet. Click “Add Strategy Mapping” to create the first
              pairing.
            </p>
          )}
          {!isLoading && !comparisonLoading && alignments.length > 0 && (
            <ul className="space-y-2">
              {alignments.map((mapping) => (
                <li
                  key={mapping.id}
                  className="rounded-lg border bg-card/60 p-3"
                >
                  <div className="grid gap-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
                    <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,260px))] md:items-center md:gap-6">
                      <StrategyBadgeGroup
                        label="Reporting"
                        strategies={mapping.reportingStrategies}
                        compact
                      />
                      <StrategyBadgeGroup
                        label="Backtested"
                        strategies={mapping.liveStrategies}
                        compact
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end md:justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(mapping)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMapping(mapping.id)}
                        aria-label="Remove mapping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {mapping.note && (
                      <div className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                        {mapping.note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <Separator />
        <CardFooter className="flex items-center justify-end text-xs text-muted-foreground">
          {isSyncing || comparisonLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isSyncing ? "Saving changes…" : "Updating reconciliation…"}
            </span>
          ) : (
            <span>All changes saved • Analysis up to date</span>
          )}
        </CardFooter>
      </Card>

      <MappingDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        reportingStrategies={reportingStrategies}
        backtestedStrategies={backtestedStrategies}
        reportingMappedSet={reportingMappedSet}
        backtestedMappedSet={backtestedMappedSet}
        selectedReporting={selectedReporting}
        selectedBacktested={selectedBacktested}
        note={dialogNote}
        onSelectReporting={setSelectedReporting}
        onSelectBacktested={setSelectedBacktested}
        onNoteChange={setDialogNote}
        onSave={upsertMapping}
      />

      {summaryRows.length > 0 && !comparisonLoading && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>
              How closely reported results matched the backtest (backtested vs reported).
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pt-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Strategy<br />Mapping
                  </th>
                  <th className="pb-3 pt-2 px-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Backtested<br />P/L
                  </th>
                  <th className="pb-3 pt-2 px-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reported<br />P/L
                  </th>
                  <th className="pb-3 pt-2 px-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    P/L<br />Variance
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Trade<br />Comparison
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fill<br />Match
                  </th>
                  <th className="pb-3 pt-2 px-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Slippage /<br />Contract
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sizing<br />Drift
                  </th>
                  <th className="pb-3 pt-2 px-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Δ Fees
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summaryRows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-foreground">
                        {row.backtestedStrategy}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ↳ {row.reportedStrategy}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums">
                      {formatCurrency(row.backtested.totalPl)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums">
                      {formatCurrency(row.reported.totalPl)}
                    </td>
                    <td className={cn("py-3 px-3 text-right font-bold tabular-nums", getDeltaClass(row.delta.totalPl))}>
                      {formatCurrency(row.delta.totalPl)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mx-auto"
                        onClick={() => handleOpenMatchDialog(row.id)}
                      >
                        <span className="font-medium">Review</span>
                      </Button>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">{row.totalBacktestedCount}</span> vs <span className="font-medium">{row.totalReportedCount}</span> trades
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={row.matchRate >= 0.9 ? "default" : row.matchRate >= 0.7 ? "secondary" : "destructive"} className="tabular-nums">
                        {formatPercent(row.matchRate)}
                      </Badge>
                    </td>
                    <td className={cn("py-3 px-3 text-right tabular-nums", getDeltaClass(row.slippagePerContract))}>
                      {formatCurrency(row.slippagePerContract)}
                    </td>
                    <td className={cn("py-3 px-3 text-right tabular-nums", getDeltaClass(row.sizeVariance))}>
                      {formatPercent(row.sizeVariance)}
                    </td>
                    <td className={cn("py-3 px-3 text-right tabular-nums", getDeltaClass(row.delta.totalFees))}>
                      {formatCurrency(row.delta.totalFees)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {aggregateSummary && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/30">
                    <td className="py-3 pr-4 font-bold">Totals</td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums">
                      {formatCurrency(aggregateSummary.backtested.totalPl)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums">
                      {formatCurrency(aggregateSummary.reported.totalPl)}
                    </td>
                    <td className={cn("py-3 px-3 text-right font-bold tabular-nums", getDeltaClass(aggregateSummary.delta.totalPl))}>
                      {formatCurrency(aggregateSummary.delta.totalPl)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{aggregateTradeCounts.backtested.total}</span> vs <span className="font-medium">{aggregateTradeCounts.reported.total}</span> trades
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={aggregateMatchRate >= 0.9 ? "default" : aggregateMatchRate >= 0.7 ? "secondary" : "destructive"} className="tabular-nums">
                        {formatPercent(aggregateMatchRate)}
                      </Badge>
                    </td>
                    <td className={cn("py-3 px-3 text-right font-semibold tabular-nums", getDeltaClass(aggregateSlippagePerContract))}>
                      {formatCurrency(aggregateSlippagePerContract)}
                    </td>
                    <td className={cn("py-3 px-3 text-right font-semibold tabular-nums", getDeltaClass(aggregateSizeVariance))}>
                      {formatPercent(aggregateSizeVariance)}
                    </td>
                    <td className={cn("py-3 px-3 text-right font-semibold tabular-nums", getDeltaClass(aggregateSummary.delta.totalFees))}>
                      {formatCurrency(aggregateSummary.delta.totalFees)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      )}

      <MatchReviewDialog
        alignment={activeMatchAlignment}
        open={Boolean(activeMatchAlignment)}
        onOpenChange={(open) => {
          if (!open) setMatchDialogAlignmentId(null)
        }}
        onSave={(backIds, reportedIds) => {
          if (matchDialogAlignmentId) {
            handleSaveMatchOverrides(matchDialogAlignmentId, backIds, reportedIds)
          }
        }}
      />
    </div>
  );
}

function StrategyBadgeGroup({
  label,
  strategies,
  compact = false,
}: {
  label: string;
  strategies: string[];
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-0" : "gap-1")}>
      <p
        className={cn(
          "text-xs uppercase tracking-wide text-muted-foreground",
          compact ? "leading-4" : undefined
        )}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {strategies.map((strategy) => (
          <Badge key={strategy} variant="outline" className="text-xs">
            {strategy}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
}

function getDeltaClass(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

function MappingDialog({
  open,
  onOpenChange,
  mode,
  reportingStrategies,
  backtestedStrategies,
  reportingMappedSet,
  backtestedMappedSet,
  selectedReporting,
  selectedBacktested,
  note,
  onSelectReporting,
  onSelectBacktested,
  onNoteChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  reportingStrategies: SelectableStrategy[];
  backtestedStrategies: SelectableStrategy[];
  reportingMappedSet: Set<string>;
  backtestedMappedSet: Set<string>;
  selectedReporting: string | null;
  selectedBacktested: string | null;
  note: string;
  onSelectReporting: (value: string | null) => void;
  onSelectBacktested: (value: string | null) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
}) {
  const title =
    mode === "create" ? "Add Strategy Mapping" : "Edit Strategy Mapping";
  const actionLabel = mode === "create" ? "Create mapping" : "Update mapping";
  const canSave = Boolean(selectedReporting && selectedBacktested);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-[720px] md:max-w-[820px] lg:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose one reporting strategy and one backtested strategy, then add
            optional context before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <StrategyPickList
            title="Reporting strategy"
            strategies={reportingStrategies}
            selected={selectedReporting}
            onSelect={onSelectReporting}
            mappedSet={reportingMappedSet}
            emptyMessage="No reporting strategies found."
          />
          <StrategyPickList
            title="Backtested strategy"
            strategies={backtestedStrategies}
            selected={selectedBacktested}
            onSelect={onSelectBacktested}
            mappedSet={backtestedMappedSet}
            emptyMessage="No backtested strategies found."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="mapping-note">
            Note (optional)
          </label>
          <Textarea
            id="mapping-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Capture sizing differences, manual overrides, or anything else worth remembering"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={!canSave}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StrategyPickList({
  title,
  strategies,
  selected,
  onSelect,
  mappedSet,
  emptyMessage,
}: {
  title: string;
  strategies: SelectableStrategy[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  mappedSet: Set<string>;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {strategies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-card/40">
          <ul className="divide-y">
            {strategies.map((strategy) => {
              const isSelected = strategy.name === selected;
              const isMapped = mappedSet.has(strategy.name);

              return (
                <li key={strategy.name}>
                  <button
                    type="button"
                    onClick={() => onSelect(isSelected ? null : strategy.name)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 p-3 text-left",
                      isSelected ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {strategy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {strategy.count} trades • Total P/L{" "}
                        {strategy.totalPl.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMapped && !isSelected && (
                        <Badge variant="secondary" className="text-xs">
                          Mapped
                        </Badge>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
