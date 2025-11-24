"use client";

import { MatchReviewDialog } from "@/components/match-review-dialog";
import { NoActiveBlock } from "@/components/no-active-block";
import { ReconciliationMetrics } from "@/components/reconciliation-charts/ReconciliationMetrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getBlock,
  getReportingTradesByBlock,
  getTradesByBlockWithOptions,
  updateBlock as updateProcessedBlock,
} from "@/lib/db";
import { StrategyAlignment } from "@/lib/models/strategy-alignment";
import { useBlockStore } from "@/lib/stores/block-store";
import { useComparisonStore } from "@/lib/stores/comparison-store";
import { cn } from "@/lib/utils";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface SelectableStrategy {
  name: string;
  count: number;
  totalPl: number;
}

const NORMALIZE_STORAGE_KEY_PREFIX = "comparison:normalizeTo1Lot:";

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
  const comparisonLastBlockId = useComparisonStore((state) => state.lastBlockId);
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
  const [matchDialogAlignmentId, setMatchDialogAlignmentId] = useState<
    string | null
  >(null);
  const [selectedAlignmentId, setSelectedAlignmentId] = useState<string | null>(
    null
  );

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
  const [normalizeTo1Lot, setNormalizeTo1Lot] = useState(false);

  useEffect(() => {
    if (!activeBlockId || typeof window === "undefined") {
      return;
    }

    const storageKey = `${NORMALIZE_STORAGE_KEY_PREFIX}${activeBlockId}`;
    const stored = window.localStorage.getItem(storageKey);

    if (stored !== null) {
      setNormalizeTo1Lot(stored === "true");
    } else {
      setNormalizeTo1Lot(false);
    }
  }, [activeBlockId]);

  useEffect(() => {
    if (!activeBlockId || typeof window === "undefined") {
      return;
    }

    const storageKey = `${NORMALIZE_STORAGE_KEY_PREFIX}${activeBlockId}`;
    window.localStorage.setItem(storageKey, normalizeTo1Lot ? "true" : "false");
  }, [activeBlockId, normalizeTo1Lot]);

  useEffect(() => {
    if (!activeBlockId) {
      resetComparison();
      setAlignments([]);
      setReportingStrategies([]);
      setBacktestedStrategies([]);
      return;
    }

    if (!activeBlock) {
      return;
    }

    setIsLoading(true);
    setError(null);
    resetComparison();
    // Clear alignments immediately to prevent stale data
    setAlignments([]);

    const load = async () => {
      try {
        const blockId = activeBlock.id;
        const processedBlock = await getBlock(blockId);
        const combineLegGroups =
          processedBlock?.analysisConfig?.combineLegGroups ?? false;

        const [trades, reportingTrades] = await Promise.all([
          getTradesByBlockWithOptions(blockId, { combineLegGroups }),
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
  }, [activeBlockId, activeBlock, resetComparison]);

  useEffect(() => {
    if (!activeBlockId) {
      resetComparison();
      return;
    }

    if (alignments.length === 0) {
      resetComparison();
      return;
    }

    refreshComparison(activeBlockId, alignments, normalizeTo1Lot).catch(
      console.error
    );
  }, [
    activeBlockId,
    alignments,
    normalizeTo1Lot,
    refreshComparison,
    resetComparison,
  ]);

  useEffect(() => {
    if (!comparisonData || comparisonData.alignments.length === 0) {
      if (selectedAlignmentId !== null) {
        setSelectedAlignmentId(null);
      }
      return;
    }

    const stillValid = comparisonData.alignments.some(
      (alignment) => alignment.alignmentId === selectedAlignmentId
    );

    if (!stillValid) {
      setSelectedAlignmentId(comparisonData.alignments[0].alignmentId);
    }
  }, [comparisonData, selectedAlignmentId]);

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

  // Memoize to keep stable reference during loading/refreshes
  const activeMatchAlignment = useMemo(() => {
    if (!matchDialogAlignmentId) return null;
    return comparisonData?.alignments.find(
      (alignment) => alignment.alignmentId === matchDialogAlignmentId
    ) ?? null;
  }, [matchDialogAlignmentId, comparisonData?.alignments]);

  const summaryRows = useMemo(() => {
    // Only show comparison data if it matches the current block
    if (!comparisonData || comparisonLastBlockId !== activeBlockId) return [];
    if (process.env.NODE_ENV !== "production") {
      console.debug("[comparison] reconciliation", comparisonData);
    }

    return comparisonData.alignments.map((alignment) => {
      let autoMatchedCount = 0;
      let manualMatchedCount = 0;
      let unmatchedBacktestedCount = 0;
      let unmatchedReportedCount = 0;
      let matchedSessions = 0;
      let unmatchedSessions = 0;

      alignment.sessions.forEach((session) => {
        let sessionHasUnmatched = false;
        let sessionHasMatch = false;

        session.items.forEach((item) => {
          const hasBacktested = Boolean(item.backtested);
          const hasReported = Boolean(item.reported);

          // Only count as matched if isPaired is true (actual pair from matchResult.pairs)
          // Items with both trades but isPaired=false are just unmatched trades displayed together
          if (item.isPaired && hasBacktested && hasReported) {
            if (item.autoBacktested && item.autoReported) {
              autoMatchedCount += 1;
            } else {
              manualMatchedCount += 1;
            }
            sessionHasMatch = true;
          } else {
            if (hasBacktested) {
              unmatchedBacktestedCount += 1;
              sessionHasUnmatched = true;
            }
            if (hasReported) {
              unmatchedReportedCount += 1;
              sessionHasUnmatched = true;
            }
          }
        });

        if (sessionHasUnmatched) {
          unmatchedSessions += 1;
        }
        if (sessionHasMatch) {
          matchedSessions += 1;
        }
      });

      const totalBacktestedCount =
        autoMatchedCount + manualMatchedCount + unmatchedBacktestedCount;
      const totalReportedCount =
        autoMatchedCount + manualMatchedCount + unmatchedReportedCount;

      return {
        id: alignment.alignmentId,
        reportedStrategy: alignment.reportedStrategy,
        backtestedStrategy: alignment.backtestedStrategy,
        matchRate: alignment.metrics.matchRate,
        autoMatchedCount,
        manualMatchedCount,
        unmatchedBacktestedCount,
        unmatchedReportedCount,
        totalBacktestedCount,
        totalReportedCount,
        totalSessions: alignment.sessions.length,
        matchedSessions,
        unmatchedSessions,
      };
    });
  }, [comparisonData, comparisonLastBlockId, activeBlockId]);

  const aggregateMatchStats = useMemo(() => {
    return summaryRows.reduce(
      (acc, row) => {
        acc.autoMatched += row.autoMatchedCount;
        acc.manualMatched += row.manualMatchedCount;
        acc.unmatchedBacktested += row.unmatchedBacktestedCount;
        acc.unmatchedReported += row.unmatchedReportedCount;
        acc.totalBacktested += row.totalBacktestedCount;
        acc.totalReported += row.totalReportedCount;
        acc.totalSessions += row.totalSessions;
        acc.matchedSessions += row.matchedSessions;
        acc.unmatchedSessions += row.unmatchedSessions;
        return acc;
      },
      {
        autoMatched: 0,
        manualMatched: 0,
        unmatchedBacktested: 0,
        unmatchedReported: 0,
        totalBacktested: 0,
        totalReported: 0,
        totalSessions: 0,
        matchedSessions: 0,
        unmatchedSessions: 0,
      }
    );
  }, [summaryRows]);

  const handleSaveMatchOverrides = async (
    alignmentId: string,
    tradePairs: import("@/lib/models/strategy-alignment").TradePair[]
  ) => {
    const autoData = comparisonData?.alignments.find(
      (alignment) => alignment.alignmentId === alignmentId
    );

    if (!autoData) {
      setMatchDialogAlignmentId(null);
      return;
    }

    // selectedBacktestedIds and selectedReportedIds should contain ALL trades
    // to ensure they're included in stats calculations.
    // The tradePairs array is the authoritative source for what's actually paired.
    // The isPaired flag in session items distinguishes real pairs from unmatched trades.
    const allBacktestedIds = autoData.backtestedTrades.map((trade) => trade.id);
    const allReportedIds = autoData.reportedTrades.map((trade) => trade.id);

    const nextAlignments = alignments.map((mapping) =>
      mapping.id === alignmentId
        ? {
            ...mapping,
            matchOverrides: {
              selectedBacktestedIds: allBacktestedIds,
              selectedReportedIds: allReportedIds,
              tradePairs,
            },
          }
        : mapping
    );

    await persistAlignments(nextAlignments);
    // Refresh comparison with the new alignments
    if (activeBlockId) {
      await refreshComparison(activeBlockId, nextAlignments, normalizeTo1Lot);
    }
    // Keep the dialog open so the user can navigate back to sessions
  };

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
      <NoActiveBlock description="Choose a block from the sidebar to align reporting strategies with live trades." />
    );
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Aligned Strategies</CardTitle>
              <CardDescription>
                Review, edit, or remove existing mappings before saving them back to
                the block.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={openCreateDialog}
              disabled={isLoading || comparisonLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Strategy Mapping
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(isLoading || comparisonLoading) && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isLoading
                ? "Loading strategy data..."
                : "Reconciling mappings..."}
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
                  <div className="grid gap-3 text-sm md:grid-cols-[1fr_auto] md:items-start">
                    <div className="grid gap-3 md:grid-cols-2 md:gap-6">
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
                    <div className="flex items-center gap-2 justify-end md:justify-start md:pt-5">
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

      {(summaryRows.length > 0 || comparisonLoading || isLoading) && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Summary</CardTitle>
            <CardDescription>
              Keep reconciliations aligned by monitoring matched trades,
              sessions needing review, and outstanding differences between
              backtested and reported executions.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto relative">
            {(comparisonLoading || isLoading) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Updating reconciliation…
                </span>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pt-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Strategy
                    <br />
                    Mapping
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground border-x">
                    Sessions
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Matched
                    <br />
                    Trades
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground border-x">
                    Included
                    <br />
                    Trades
                  </th>
                  <th className="pb-3 pt-2 px-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summaryRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-foreground">
                        {row.backtestedStrategy}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ↳ {row.reportedStrategy}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-3 gap-3 text-xs rounded-md border border-muted bg-muted/20 p-2">
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Total
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.totalSessions}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Matched
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.matchedSessions}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Unmatched
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.unmatchedSessions}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-3 gap-3 text-xs rounded-md border border-muted bg-muted/20 p-2">
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Auto
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.autoMatchedCount}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Manual
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.manualMatchedCount}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Unmatched
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            BT {row.unmatchedBacktestedCount} / RPT{" "}
                            {row.unmatchedReportedCount}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-2 gap-3 text-xs text-center rounded-md border border-muted bg-muted/20 p-2">
                        <div>
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            BT
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.totalBacktestedCount}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            RPT
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {row.totalReportedCount}
                          </div>
                        </div>
                      </div>
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
                    </td>
                  </tr>
                ))}
              </tbody>
              {summaryRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/30">
                    <td className="py-3 pr-4 font-bold">Totals</td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-3 gap-3 text-xs rounded-md border border-muted bg-muted/20 p-2">
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Total
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.totalSessions}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Matched
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.matchedSessions}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Unmatched
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.unmatchedSessions}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-3 gap-3 text-xs rounded-md border border-muted bg-muted/20 p-2">
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Auto
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.autoMatched}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Manual
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.manualMatched}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            Unmatched
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            BT {aggregateMatchStats.unmatchedBacktested} / RPT{" "}
                            {aggregateMatchStats.unmatchedReported}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-2 gap-3 text-xs text-center rounded-md border border-muted bg-muted/20 p-2">
                        <div>
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            BT
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.totalBacktested}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wide text-muted-foreground text-[10px]">
                            RPT
                          </div>
                          <div className="font-medium text-foreground tabular-nums">
                            {aggregateMatchStats.totalReported}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                      —
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      )}

      {/* Statistical Analysis Section - Show detailed metrics for selected alignment */}
      {comparisonData && comparisonData.alignments.length > 0 && comparisonLastBlockId === activeBlockId && (() => {
        const selectedAlignment = selectedAlignmentId
          ? comparisonData.alignments.find(a => a.alignmentId === selectedAlignmentId)
          : comparisonData.alignments[0];

        if (!selectedAlignment) return null;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Statistical Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  Detailed performance metrics and statistical insights for each alignment
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="normalize-1lot"
                    checked={normalizeTo1Lot}
                    onCheckedChange={setNormalizeTo1Lot}
                    disabled={comparisonLoading || isLoading}
                  />
                  <Label
                    htmlFor="normalize-1lot"
                    className="cursor-pointer text-sm"
                  >
                    Normalize to 1-lot
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {normalizeTo1Lot
                      ? "Showing per-contract values"
                      : "Showing actual trade values"}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Strategy:</span>
                  <Select
                    value={selectedAlignmentId ?? undefined}
                    onValueChange={setSelectedAlignmentId}
                  >
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select alignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {comparisonData.alignments.map((alignment) => (
                        <SelectItem key={alignment.alignmentId} value={alignment.alignmentId}>
                          {alignment.backtestedStrategy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedAlignment.backtestedStrategy}
                </CardTitle>
                <CardDescription className="mt-1">
                  Reporting: {selectedAlignment.reportedStrategy}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Reconciliation Metrics Dashboard */}
                <ReconciliationMetrics
                  key={`${selectedAlignment.alignmentId}-${normalizeTo1Lot ? "norm" : "raw"}`}
                  metrics={selectedAlignment.metrics}
                  alignment={selectedAlignment}
                  normalizeTo1Lot={normalizeTo1Lot}
                />
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <MatchReviewDialog
        alignment={activeMatchAlignment}
        open={Boolean(activeMatchAlignment)}
        onOpenChange={(open) => {
          if (!open) setMatchDialogAlignmentId(null);
        }}
        onSave={(tradePairs) => {
          if (matchDialogAlignmentId) {
            handleSaveMatchOverrides(matchDialogAlignmentId, tradePairs);
          }
        }}
        normalizeTo1Lot={normalizeTo1Lot}
        onNormalizeTo1LotChange={setNormalizeTo1Lot}
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
