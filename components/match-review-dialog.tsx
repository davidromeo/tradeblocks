"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TradePair } from "@/lib/models/strategy-alignment";
import type { NormalizedTrade } from "@/lib/services/trade-reconciliation";
import type { AlignedTradeSet } from "@/lib/stores/comparison-store";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowLeft, CheckCircle2, Link2, Loader2, RotateCcw, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MatchReviewDialogProps {
  alignment: AlignedTradeSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tradePairs: TradePair[]) => void;
  normalizeTo1Lot?: boolean;
  onNormalizeTo1LotChange?: (value: boolean) => void;
}

interface SessionStats {
  session: string;
  matchedCount: number;
  unmatchedBacktestedCount: number;
  unmatchedReportedCount: number;
  backtestedCount: number;
  reportedCount: number;
  matchableCount: number;
  matchRate: number;
  hasUnmatched: boolean;
}

const MATCH_TOLERANCE_MS = 30 * 60 * 1000;

function buildAutoPairsForSession(
  backtested: NormalizedTrade[],
  reported: NormalizedTrade[],
): TradePair[] {
  if (backtested.length === 0 || reported.length === 0) {
    return [];
  }

  const sortedBacktested = [...backtested].sort((a, b) => a.sortTime - b.sortTime);
  const sortedReported = [...reported].sort((a, b) => a.sortTime - b.sortTime);
  const remainingBacktested = [...sortedBacktested];
  const pairs: TradePair[] = [];

  sortedReported.forEach((reportedTrade) => {
    let bestIndex = -1;
    let bestDiff = Number.POSITIVE_INFINITY;

    remainingBacktested.forEach((candidate, index) => {
      const diff = Math.abs(candidate.sortTime - reportedTrade.sortTime);
      if (diff <= MATCH_TOLERANCE_MS && diff < bestDiff) {
        bestIndex = index;
        bestDiff = diff;
      }
    });

    if (bestIndex >= 0) {
      const [matched] = remainingBacktested.splice(bestIndex, 1);
      pairs.push({
        backtestedId: matched.id,
        reportedId: reportedTrade.id,
        manual: false,
      });
    }
  });

  return pairs;
}

export function MatchReviewDialog({
  alignment,
  open,
  onOpenChange,
  onSave,
  normalizeTo1Lot = false,
  onNormalizeTo1LotChange,
}: MatchReviewDialogProps) {
  const [confirmedPairs, setConfirmedPairs] = useState<TradePair[]>([]);
  const [loadedPairs, setLoadedPairs] = useState<TradePair[]>([]); // Track originally loaded pairs
  const [selectedBacktested, setSelectedBacktested] = useState<string | null>(null);
  const [selectedReported, setSelectedReported] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false); // Confirm before going back with unsaved changes
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'last7' | 'last30' | 'last90'>('all');
  const [isSaving, setIsSaving] = useState(false);

  // Track the alignment ID to detect when we switch to a different strategy comparison
  const alignmentIdRef = useRef<string | null>(null);
  // Track if we just saved to skip the next alignment update
  const justSavedRef = useRef(false);
  // Keep a stable alignment reference during saves to prevent flashing
  const stableAlignmentRef = useRef<AlignedTradeSet | null>(null);

  // Use stable alignment during save to prevent flash
  const stableAlignment = isSaving && stableAlignmentRef.current
    ? stableAlignmentRef.current
    : alignment;

  useEffect(() => {
    if (alignment && open) {
      // Skip state reset if we just saved - alignment data will match our local state
      if (justSavedRef.current) {
        justSavedRef.current = false;
        setIsSaving(false);
        stableAlignmentRef.current = null; // Clear stable ref after save completes
        return;
      }

      // Build pairs from the session data
      // Use the isPaired flag to distinguish actual pairs from unmatched trades
      // that happen to be displayed side-by-side
      const newLoadedPairs: TradePair[] = [];

      alignment.sessions.forEach((session) => {
        session.items.forEach((item) => {
          // Only load items that are actual pairs (from matchResult.pairs)
          // Items with isPaired=false are just unmatched trades displayed together
          if (item.isPaired && item.backtested && item.reported) {
            const isAuto = item.autoBacktested && item.autoReported;

            newLoadedPairs.push({
              backtestedId: item.backtested.id,
              reportedId: item.reported.id,
              manual: !isAuto,
            });
          }
        });
      });

      setConfirmedPairs(newLoadedPairs);
      setLoadedPairs(newLoadedPairs); // Track what was originally loaded
      setSelectedBacktested(null);
      setSelectedReported(null);

      // Only reset session/filters if we're opening the dialog or switching alignments
      const alignmentChanged = alignmentIdRef.current !== alignment.alignmentId;
      if (alignmentChanged || !alignmentIdRef.current) {
        setSelectedSession(null); // Reset to session selection view
        setSessionFilter('all'); // Reset filter
        setDateRangeFilter('all'); // Reset date filter
        alignmentIdRef.current = alignment.alignmentId;
      }
    }
  }, [alignment, open]);

  const handleUnlockPair = (pair: TradePair) => {
    setConfirmedPairs((prev) => prev.filter(
      (p) => !(p.backtestedId === pair.backtestedId && p.reportedId === pair.reportedId)
    ));
  };

  const handleCreateManualPair = () => {
    if (!selectedBacktested || !selectedReported || !alignment) return;

    const backtestedTrade = backtestedById.get(selectedBacktested);
    const reportedTrade = reportedById.get(selectedReported);

    if (!backtestedTrade || !reportedTrade) return;

    const newPair: TradePair = {
      backtestedId: selectedBacktested,
      reportedId: selectedReported,
      manual: true,
    };

    // Insert the pair in chronological order based on backtested trade time
    setConfirmedPairs((prev) => {
      const updated = [...prev, newPair];

      // Sort by backtested trade sortTime
      updated.sort((a, b) => {
        const tradeA = backtestedById.get(a.backtestedId);
        const tradeB = backtestedById.get(b.backtestedId);

        if (!tradeA || !tradeB) return 0;

        return tradeA.sortTime - tradeB.sortTime;
      });

      return updated;
    });

    setSelectedBacktested(null);
    setSelectedReported(null);
  };

  const handleResetToAuto = () => {
    if (!stableAlignment || !selectedSession) return;

    const sessionBacktestedIds = new Set(
      stableAlignment.backtestedTrades
        .filter((trade) => trade.session === selectedSession)
        .map((trade) => trade.id)
    );

    const hasManualPairs = confirmedPairs.some(
      (pair) => pair.manual && sessionBacktestedIds.has(pair.backtestedId)
    );

    if (hasManualPairs) {
      setShowResetConfirm(true);
    } else {
      confirmResetToAuto();
    }
  };

  const confirmResetToAuto = () => {
    if (!stableAlignment || !selectedSession) return;

    const sessionBacktestedTrades = stableAlignment.backtestedTrades.filter(
      (trade) => trade.session === selectedSession
    );
    const sessionReportedTrades = stableAlignment.reportedTrades.filter(
      (trade) => trade.session === selectedSession
    );

    const autoPairs = buildAutoPairsForSession(
      sessionBacktestedTrades,
      sessionReportedTrades
    );
    const backtestedLookup = new Map(
      stableAlignment.backtestedTrades.map((trade) => [trade.id, trade])
    );

    setConfirmedPairs((prev) => {
      const sessionBacktestedIds = new Set(
        sessionBacktestedTrades.map((trade) => trade.id)
      );

      const nextPairs = prev.filter(
        (pair) => !sessionBacktestedIds.has(pair.backtestedId)
      );
      nextPairs.push(...autoPairs);

      nextPairs.sort((a, b) => {
        const tradeA = backtestedLookup.get(a.backtestedId);
        const tradeB = backtestedLookup.get(b.backtestedId);
        if (!tradeA || !tradeB) return 0;
        return tradeA.sortTime - tradeB.sortTime;
      });

      return nextPairs;
    });

    setSelectedBacktested(null);
    setSelectedReported(null);
    setShowResetConfirm(false);
  };

  const handleSave = () => {
    // Store current alignment to prevent flash during refresh
    stableAlignmentRef.current = alignment;
    setIsSaving(true);
    justSavedRef.current = true;
    onSave(confirmedPairs);
    setLoadedPairs(confirmedPairs); // Update loaded pairs after save
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      onOpenChange(false);
    } else {
      onOpenChange(true);
    }
  };

  if (!stableAlignment) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review Trade Matches</DialogTitle>
            <DialogDescription>
              Select a strategy mapping to review matches.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate session stats
  const sessionStats: SessionStats[] = stableAlignment.sessions.map((sessionMatch) => {
    const pairedIds = new Set(
      confirmedPairs
        .filter((pair) => {
          const bt = stableAlignment.backtestedTrades.find(t => t.id === pair.backtestedId);
          return bt?.session === sessionMatch.session;
        })
        .flatMap(p => [p.backtestedId, p.reportedId])
    );

    const sessionBacktested = stableAlignment.backtestedTrades.filter(t => t.session === sessionMatch.session);
    const sessionReported = stableAlignment.reportedTrades.filter(t => t.session === sessionMatch.session);

    const unmatchedBT = sessionBacktested.filter(t => !pairedIds.has(t.id)).length;
    const unmatchedRPT = sessionReported.filter(t => !pairedIds.has(t.id)).length;
    const backtestedCount = sessionBacktested.length;
    const reportedCount = sessionReported.length;
    const matched = Math.min(
      backtestedCount - unmatchedBT,
      reportedCount - unmatchedRPT
    );
    const matchableCount = Math.min(backtestedCount, reportedCount);
    const matchRate = matchableCount === 0 ? 0 : matched / matchableCount;

    return {
      session: sessionMatch.session,
      matchedCount: matched,
      unmatchedBacktestedCount: unmatchedBT,
      unmatchedReportedCount: unmatchedRPT,
      backtestedCount,
      reportedCount,
      matchableCount,
      matchRate,
      hasUnmatched: unmatchedBT > 0 || unmatchedRPT > 0,
    };
  });

  // If no session selected, show session selection view
  if (!selectedSession) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="h-[85vh] w-full flex flex-col sm:max-w-[calc(100vw-2rem)] md:max-w-5xl xl:max-w-6xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>Review Trade Matches</DialogTitle>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Backtested:
                </span>
                <span className="font-semibold text-foreground">
                  {stableAlignment.backtestedStrategy}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reported:
                </span>
                <span className="font-semibold text-foreground">
                  {stableAlignment.reportedStrategy}
                </span>
              </div>
            </div>
            <DialogDescription>
              Adjust which backtested trades to compare against the reported executions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-6 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Reported Sessions</h3>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={sessionFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSessionFilter('all')}
                    className="h-8 text-xs"
                  >
                    All ({sessionStats.length})
                  </Button>
                  <Button
                    type="button"
                    variant={sessionFilter === 'matched' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSessionFilter('matched')}
                    className="h-8 text-xs"
                  >
                    Matched ({sessionStats.filter(s => !s.hasUnmatched).length})
                  </Button>
                  <Button
                    type="button"
                    variant={sessionFilter === 'unmatched' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSessionFilter('unmatched')}
                    className="h-8 text-xs"
                  >
                    Unmatched ({sessionStats.filter(s => s.hasUnmatched).length})
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Date Range:</span>
                <Button
                  type="button"
                  variant={dateRangeFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRangeFilter('all')}
                  className="h-7 text-xs px-2"
                >
                  All Time
                </Button>
                <Button
                  type="button"
                  variant={dateRangeFilter === 'last7' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRangeFilter('last7')}
                  className="h-7 text-xs px-2"
                >
                  Last 7 Days
                </Button>
                <Button
                  type="button"
                  variant={dateRangeFilter === 'last30' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRangeFilter('last30')}
                  className="h-7 text-xs px-2"
                >
                  Last 30 Days
                </Button>
                <Button
                  type="button"
                  variant={dateRangeFilter === 'last90' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRangeFilter('last90')}
                  className="h-7 text-xs px-2"
                >
                  Last 90 Days
                </Button>
              </div>
            </div>
            <div className="grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {sessionStats
                .filter((stats) => {
                  // Match status filter
                  if (sessionFilter === 'matched' && stats.hasUnmatched) return false;
                  if (sessionFilter === 'unmatched' && !stats.hasUnmatched) return false;

                  // Date range filter
                  if (dateRangeFilter !== 'all') {
                    const sessionDate = new Date(stats.session);
                    const now = new Date();
                    const daysAgo = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);

                    if (dateRangeFilter === 'last7' && daysAgo > 7) return false;
                    if (dateRangeFilter === 'last30' && daysAgo > 30) return false;
                    if (dateRangeFilter === 'last90' && daysAgo > 90) return false;
                  }

                  return true;
                })
                .map((stats) => {
                  const matchPercent = Math.round(stats.matchRate * 100);
                  return (
                    <button
                      key={stats.session}
                      type="button"
                      onClick={() => setSelectedSession(stats.session)}
                      className={cn(
                        "group relative flex h-full min-w-[240px] flex-col rounded-xl border px-5 py-5 text-left shadow-sm transition-all",
                        "hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2",
                        stats.hasUnmatched
                          ? "border-amber-400/70 bg-amber-50/80 dark:border-amber-500/60 dark:bg-amber-500/10"
                          : "border-emerald-400/70 bg-emerald-50/80 dark:border-emerald-500/60 dark:bg-emerald-500/10"
                      )}
                    >
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Session
                        </div>
                        <div className="mt-1 text-lg font-semibold leading-tight text-foreground">
                          {formatSessionDate(stats.session)}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                        {stats.hasUnmatched ? (
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span
                          className={cn(
                            stats.hasUnmatched
                              ? "text-amber-700 dark:text-amber-200"
                              : "text-emerald-700 dark:text-emerald-200"
                          )}
                        >
                          {stats.hasUnmatched
                            ? `${stats.matchedCount} of ${stats.matchableCount} trades matched`
                            : `${stats.matchedCount} trade${stats.matchedCount === 1 ? "" : "s"} matched`}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 transition-colors group-hover:bg-muted/60">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Backtested
                          </div>
                          <div className="mt-1 text-sm font-semibold text-foreground">
                            {stats.backtestedCount}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {stats.unmatchedBacktestedCount > 0 ? `${stats.unmatchedBacktestedCount} unmatched` : "No unmatched"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 transition-colors group-hover:bg-muted/60">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Reported
                          </div>
                          <div className="mt-1 text-sm font-semibold text-foreground">
                            {stats.reportedCount}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {stats.unmatchedReportedCount > 0 ? `${stats.unmatchedReportedCount} unmatched` : "No unmatched"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              stats.hasUnmatched
                                ? "bg-amber-400/80 dark:bg-amber-500/70"
                                : "bg-emerald-400/80 dark:bg-emerald-500/70"
                            )}
                            style={{
                              width: stats.matchableCount === 0 ? "100%" : `${matchPercent}%`,
                              opacity: stats.matchableCount === 0 ? 0.35 : 1,
                            }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {stats.matchableCount === 0 ? "No comparable trades yet" : `Match Rate ${matchPercent}%`}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Session detail view - filter trades to selected session
  const sessionBacktestedTrades = stableAlignment.backtestedTrades.filter(
    (trade) => trade.session === selectedSession
  );
  const sessionReportedTrades = stableAlignment.reportedTrades.filter(
    (trade) => trade.session === selectedSession
  );

  // Get paired trade IDs for this session
  const sessionPairs = confirmedPairs.filter((pair) => {
    const bt = stableAlignment.backtestedTrades.find(t => t.id === pair.backtestedId);
    return bt?.session === selectedSession;
  });

  const pairedBacktestedIds = new Set(sessionPairs.map((p) => p.backtestedId));
  const pairedReportedIds = new Set(sessionPairs.map((p) => p.reportedId));

  // Get unmatched trades for this session
  const unmatchedBacktested = sessionBacktestedTrades.filter(
    (trade) => !pairedBacktestedIds.has(trade.id)
  );
  const unmatchedReported = sessionReportedTrades.filter(
    (trade) => !pairedReportedIds.has(trade.id)
  );

  // Build trade lookup maps (still need full alignment for lookups)
  const backtestedById = new Map(
    stableAlignment.backtestedTrades.map((t) => [t.id, t])
  );
  const reportedById = new Map(
    stableAlignment.reportedTrades.map((t) => [t.id, t])
  );

  const canCreatePair = selectedBacktested && selectedReported;

  // Check if there are unsaved changes
  const hasUnsavedChanges = JSON.stringify(confirmedPairs.sort((a, b) => 
    `${a.backtestedId}-${a.reportedId}`.localeCompare(`${b.backtestedId}-${b.reportedId}`))
  ) !== JSON.stringify(loadedPairs.sort((a, b) => 
    `${a.backtestedId}-${a.reportedId}`.localeCompare(`${b.backtestedId}-${b.reportedId}`))
  );

  const handleBackToSessions = () => {
    if (hasUnsavedChanges) {
      setShowBackConfirm(true);
    } else {
      setSelectedSession(null);
    }
  };

  const confirmBackToSessions = () => {
    setShowBackConfirm(false);
    setSelectedSession(null);
    // Reset to loaded state
    setConfirmedPairs(loadedPairs);
    setSelectedBacktested(null);
    setSelectedReported(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="h-[90vh] w-[calc(100vw-4rem)] !max-w-[calc(100vw-4rem)] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBackToSessions}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <DialogTitle>Review Trade Matches - {formatSessionDate(selectedSession)}</DialogTitle>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Backtested:
              </span>
              <span className="font-semibold text-foreground">
                {stableAlignment.backtestedStrategy}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reported:
              </span>
              <span className="font-semibold text-foreground">
                {stableAlignment.reportedStrategy}
              </span>
            </div>
            {normalizeTo1Lot && (
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-xs">
                  Normalized to 1-lot
                </Badge>
                <span className="text-xs text-muted-foreground">
                  All values shown per contract
                </span>
              </div>
            )}
          </div>
          <DialogDescription>
            Lock in confirmed trade pairs or create manual matches between backtested and reported trades.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-hidden flex-1 min-h-0">
          {/* Confirmed Pairs Section */}
          <div className="flex flex-col overflow-hidden rounded-md border flex-1">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-green-500/10 dark:bg-green-500/20">
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">Confirmed Pairs</div>
                <div className="text-xs text-muted-foreground">
                  {sessionPairs.length} matched {sessionPairs.length === 1 ? 'pair' : 'pairs'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="normalize-dialog"
                    checked={normalizeTo1Lot}
                    onCheckedChange={onNormalizeTo1LotChange}
                    disabled={!onNormalizeTo1LotChange}
                  />
                  <Label htmlFor="normalize-dialog" className="cursor-pointer text-xs">
                    Normalize to 1-lot
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToAuto}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Auto
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessionPairs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No confirmed pairs yet. Select trades below to create manual matches.
                </div>
              ) : (
                <div className="divide-y">
                  {sessionPairs.map((pair) => {
                    const backtested = backtestedById.get(pair.backtestedId);
                    const reported = reportedById.get(pair.reportedId);

                    if (!backtested || !reported) return null;

                    return (
                      <div
                        key={`${pair.backtestedId}-${pair.reportedId}`}
                        className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          <TradeCard trade={backtested} label="Backtested" normalizeTo1Lot={normalizeTo1Lot} />
                          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <TradeCard trade={reported} label="Reported" normalizeTo1Lot={normalizeTo1Lot} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pair.manual ? "secondary" : "default"} className="text-xs">
                            {pair.manual ? "MANUAL" : "AUTO"}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnlockPair(pair)}
                            aria-label="Unlock pair"
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Unmatched Trades Section */}
          <div className="flex flex-col overflow-hidden rounded-md border flex-1">
            <div className="border-b px-4 py-3 bg-amber-500/10 dark:bg-amber-500/20">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Unmatched Trades</div>
              <div className="text-xs text-muted-foreground">
                Select one trade from each side to create a manual pair
              </div>
            </div>
            <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x min-h-0">
              {/* Backtested Trades */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b bg-blue-500/10 dark:bg-blue-500/20">
                  <div className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    Backtested ({unmatchedBacktested.length})
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {unmatchedBacktested.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      All backtested trades are paired
                    </div>
                  ) : (
                    <div className="divide-y">
                      {unmatchedBacktested.map((trade) => (
                        <button
                          key={trade.id}
                          type="button"
                          onClick={() => setSelectedBacktested(
                            selectedBacktested === trade.id ? null : trade.id
                          )}
                          className={cn(
                            "w-full p-3 text-left transition-colors",
                            selectedBacktested === trade.id
                              ? "bg-primary/10 border-l-4 border-primary"
                              : "hover:bg-muted/50"
                          )}
                          aria-label={`Select backtested trade from ${formatDateTime(trade)}`}
                        >
                          <TradeListItem trade={trade} normalizeTo1Lot={normalizeTo1Lot} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reported Trades */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b bg-purple-500/10 dark:bg-purple-500/20">
                  <div className="text-xs font-medium uppercase tracking-wide text-purple-700 dark:text-purple-400">
                    Reported ({unmatchedReported.length})
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {unmatchedReported.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      All reported trades are paired
                    </div>
                  ) : (
                    <div className="divide-y">
                      {unmatchedReported.map((trade) => (
                        <button
                          key={trade.id}
                          type="button"
                          onClick={() => setSelectedReported(
                            selectedReported === trade.id ? null : trade.id
                          )}
                          className={cn(
                            "w-full p-3 text-left transition-colors",
                            selectedReported === trade.id
                              ? "bg-primary/10 border-l-4 border-primary"
                              : "hover:bg-muted/50"
                          )}
                          aria-label={`Select reported trade from ${formatDateTime(trade)}`}
                        >
                          <TradeListItem trade={trade} normalizeTo1Lot={normalizeTo1Lot} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Create Pair Button */}
            {canCreatePair && (
              <div className="border-t px-4 py-3 bg-muted/30">
                <Button
                  type="button"
                  onClick={handleCreateManualPair}
                  className="w-full"
                  size="sm"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Create Manual Pair
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {sessionPairs.length} pairs • {unmatchedBacktested.length} unmatched BT • {unmatchedReported.length} unmatched RPT
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToSessions}
              disabled={isSaving}
            >
              Back to Sessions
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Pairs"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Auto Matching?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all manual trade pairs and reset to automatic matching based on time proximity.
              <br /><br />
              <strong>This action cannot be undone.</strong> Any manual pairings you created will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetToAuto}>
              Reset to Auto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your trade matches. If you go back now, your changes will be lost.
              <br /><br />
              <strong>Do you want to discard your changes?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBackToSessions} className="bg-destructive hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function TradeCard({ trade, label, normalizeTo1Lot }: { trade: NormalizedTrade; label: string; normalizeTo1Lot: boolean }) {
  // Always display premium as the per-contract (per-share) value traders expect
  const displayPremium = trade.premiumPerContract;
  const displayPl = normalizeTo1Lot && trade.contracts > 0
    ? trade.pl / trade.contracts
    : trade.pl;

  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium whitespace-nowrap">
            {formatDateTime(trade)}
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {normalizeTo1Lot ? '1x' : `${trade.contracts}x`}
          </Badge>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(displayPremium)}
          </div>
          <div
            className={cn(
              "text-sm font-semibold tabular-nums",
              displayPl >= 0
                ? "text-green-600 dark:text-green-500"
                : "text-red-600 dark:text-red-500"
            )}
          >
            {formatCurrency(displayPl)}
          </div>
        </div>
        {trade.legs && (
          <div className="text-xs text-muted-foreground font-mono leading-relaxed">
            {trade.legs}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeListItem({ trade, normalizeTo1Lot }: { trade: NormalizedTrade; normalizeTo1Lot: boolean }) {
  // Always display premium as the per-contract (per-share) value traders expect
  const displayPremium = trade.premiumPerContract;
  const displayPl = normalizeTo1Lot && trade.contracts > 0
    ? trade.pl / trade.contracts
    : trade.pl;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {formatDateTime(trade)}
        </div>
        <Badge variant="outline" className="text-xs">
          {normalizeTo1Lot ? '1x' : `${trade.contracts}x`}
        </Badge>
      </div>
      {trade.legs && (
        <div className="text-[11px] text-muted-foreground font-mono leading-relaxed">
          {trade.legs}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground tabular-nums">
          Premium: {formatCurrency(displayPremium)}
        </div>
        <div
          className={cn(
            "text-sm font-semibold tabular-nums",
            displayPl >= 0
              ? "text-green-600 dark:text-green-500"
              : "text-red-600 dark:text-red-500"
          )}
        >
          {formatCurrency(displayPl)}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(trade: {
  dateOpened: Date;
  timeOpened?: string;
  sortTime: number;
}): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(trade.sortTime));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSessionDate(session: string): string {
  // Session format is typically "YYYY-MM-DD"
  const [year, month, day] = session.split("-").map(Number);
  const hasValidParts = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);
  const date = hasValidParts
    ? new Date(year, month - 1, day)
    : new Date(session);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
