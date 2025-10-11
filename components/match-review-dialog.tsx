"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AlignedTradeSet } from "@/lib/stores/comparison-store";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface MatchReviewDialogProps {
  alignment: AlignedTradeSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (backtestedIds: string[], reportedIds: string[]) => void;
}

export function MatchReviewDialog({
  alignment,
  open,
  onOpenChange,
  onSave,
}: MatchReviewDialogProps) {
  const [selectedBacktested, setSelectedBacktested] = useState<Set<string>>(
    new Set()
  );
  const [selectedReported, setSelectedReported] = useState<Set<string>>(
    new Set()
  );
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [backtestedFallbackToAll, setBacktestedFallbackToAll] = useState(false);
  const [reportedFallbackToAll, setReportedFallbackToAll] = useState(false);

  useEffect(() => {
    if (alignment && open) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[comparison] open match dialog", alignment.alignmentId, {
          sessions: alignment.sessions.length,
          autoBacktested: alignment.autoSelectedBacktestedIds.length,
          autoReported: alignment.autoSelectedReportedIds.length,
        });
      }
      const selectionConfig = buildSelectionConfig(alignment, "selected");
      setSelectedBacktested(selectionConfig.backSet);
      setSelectedReported(selectionConfig.reportedSet);
      setBacktestedFallbackToAll(selectionConfig.backFallback);
      setReportedFallbackToAll(selectionConfig.reportedFallback);
      setActiveSession(alignment.sessions[0]?.session ?? null);
    }
  }, [alignment, open]);

  const toggleBacktested = (id: string | undefined, checked: boolean) => {
    if (!id) return;
    setBacktestedFallbackToAll(false);
    setSelectedBacktested((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleReported = (id: string | undefined, checked: boolean) => {
    if (!id) return;
    setReportedFallbackToAll(false);
    setSelectedReported((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleReset = () => {
    if (!alignment) return;
    const config = buildSelectionConfig(alignment, "auto");
    setSelectedBacktested(config.backSet);
    setSelectedReported(config.reportedSet);
    setBacktestedFallbackToAll(config.backFallback);
    setReportedFallbackToAll(config.reportedFallback);
  };

  const handleSave = () => {
    if (!alignment) return;
    const backIds = backtestedFallbackToAll
      ? []
      : Array.from(selectedBacktested);
    const reportedIds = reportedFallbackToAll ? [] : Array.from(selectedReported);
    onSave(backIds, reportedIds);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      onOpenChange(false);
    } else {
      onOpenChange(true);
    }
  };

  const activeSessionData =
    alignment && activeSession
      ? alignment.sessions.find((session) => session.session === activeSession) ??
        null
      : null;

  const sessionStats = activeSessionData
    ? activeSessionData.items.reduce(
        (acc, item) => {
          if (item.backtested) {
            acc.totalBacktested += 1;
            if (selectedBacktested.has(item.backtested.id)) {
              acc.selectedBacktested += 1;
            }
          }

          if (item.reported) {
            acc.totalReported += 1;
            if (selectedReported.has(item.reported.id)) {
              acc.selectedReported += 1;
            }
          }

          if (item.backtested && item.reported) {
            acc.matchedPairs += 1;
          }

          return acc;
        },
        {
          matchedPairs: 0,
          selectedBacktested: 0,
          totalBacktested: 0,
          selectedReported: 0,
          totalReported: 0,
        }
      )
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="h-[90vh] w-[calc(100vw-4rem)] !max-w-[calc(100vw-4rem)] sm:!max-w-[calc(100vw-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Trade Matches</DialogTitle>
          {alignment && (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Backtested:
                </span>
                <span className="font-semibold text-foreground">
                  {alignment.backtestedStrategy}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reported:
                </span>
                <span className="font-semibold text-foreground">
                  {alignment.reportedStrategy}
                </span>
              </div>
            </div>
          )}
          <DialogDescription>
            Adjust which backtested trades to compare against the reported
            executions.
          </DialogDescription>
        </DialogHeader>

        {!alignment ? (
          <p className="text-sm text-muted-foreground">
            Select a strategy mapping to review matches.
          </p>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
            <div className="rounded-md border shrink-0">
              <div className="border-b px-4 py-2 text-sm font-medium">
                Reported Sessions
              </div>
              <div className="px-2 py-2 max-h-48 overflow-y-auto">
                {alignment.sessions.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No reported sessions found.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {alignment.sessions.map((session) => {
                      const matchedCount = session.items.filter(
                        (item) => item.backtested && item.reported
                      ).length;
                      const backtestedCount = session.items.filter(
                        (item) => item.backtested
                      ).length;
                      const reportedCount = session.items.filter(
                        (item) => item.reported
                      ).length;

                      return (
                        <button
                          key={session.session}
                          type="button"
                          onClick={() => setActiveSession(session.session)}
                          className={cn(
                            "rounded-md px-3 py-2 text-left text-sm transition border whitespace-nowrap",
                            activeSession === session.session
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          <div className="font-semibold text-sm">
                            {session.session}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Badge
                              variant={
                                matchedCount > 0 ? "default" : "secondary"
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {matchedCount} matched
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {backtestedCount} BT · {reportedCount} RPT
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-md border flex-1 min-h-0">
              <div className="flex flex-col gap-2 border-b px-6 py-2 sm:flex-row sm:items-start sm:justify-between shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase tracking-wide"
                    >
                      Matched Trades
                    </Badge>
                    {sessionStats && (
                      <span className="text-xs text-muted-foreground">
                        {sessionStats.matchedPairs} pairs •{" "}
                        {formatTradeCount(
                          sessionStats.selectedBacktested,
                          sessionStats.totalBacktested
                        )}{" "}
                        backtested •{" "}
                        {formatTradeCount(
                          sessionStats.selectedReported,
                          sessionStats.totalReported
                        )}{" "}
                        reported
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium">
                    {activeSession || "Select a session"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Toggle trades to include in the comparison.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!alignment) return;
                    const config = buildSelectionConfig(alignment, "auto");
                    setSelectedBacktested(config.backSet);
                    setSelectedReported(config.reportedSet);
                    setBacktestedFallbackToAll(config.backFallback);
                    setReportedFallbackToAll(config.reportedFallback);
                  }}
                  disabled={!alignment}
                >
                  Reset Session
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                {activeSessionData ? (
                  activeSessionData.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No trades for this session.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th
                              colSpan={6}
                              className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground"
                            >
                              Backtested Trades
                            </th>
                            <th className="w-4 bg-border"></th>
                            <th
                              colSpan={6}
                              className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground"
                            >
                              Reported Trades
                            </th>
                          </tr>
                          <tr className="border-b">
                            <th className="pb-3 pt-2 text-left font-medium uppercase tracking-wide text-xs text-muted-foreground w-10">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="pb-3 pt-2 text-left font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              Time
                            </th>
                            <th className="pb-3 pt-2 text-right font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              Contracts
                            </th>
                            <th className="pb-3 pt-2 text-right font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              Premium
                            </th>
                            <th className="pb-3 pt-2 text-right font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              P/L
                            </th>
                            <th className="pb-3 pt-2 text-center font-medium uppercase tracking-wide text-xs text-muted-foreground w-16">
                              Auto
                            </th>
                            <th className="w-4 bg-border"></th>
                            <th className="pb-3 pt-2 text-left font-medium uppercase tracking-wide text-xs text-muted-foreground w-10">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="pb-3 pt-2 text-left font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              Time
                            </th>
                            <th className="pb-3 pt-2 text-right font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              Contracts
                            </th>
                            <th className="pb-3 pt-2 text-right font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              Premium
                            </th>
                            <th className="pb-3 pt-2 text-right font-medium uppercase tracking-wide text-xs text-muted-foreground">
                              P/L
                            </th>
                            <th className="pb-3 pt-2 text-center font-medium uppercase tracking-wide text-xs text-muted-foreground w-16">
                              Auto
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSessionData.items.map((item, index) => {
                            const backtestedSelected =
                              item.backtested &&
                              selectedBacktested.has(item.backtested.id);
                            const reportedSelected =
                              item.reported &&
                              selectedReported.has(item.reported.id);
                            const isMatched = Boolean(
                              item.backtested && item.reported
                            );

                            return (
                              <tr
                                key={`${activeSession}-${index}`}
                                className={cn(
                                  "border-b transition-colors hover:bg-muted/30",
                                  isMatched &&
                                    (backtestedSelected || reportedSelected) &&
                                    "bg-primary/5"
                                )}
                              >
                                <td className="py-4 pl-3 pr-3 align-middle">
                                  {item.backtested && item.reported && (
                                    <Checkbox
                                      checked={Boolean(backtestedSelected)}
                                      onCheckedChange={(checked) =>
                                        toggleBacktested(
                                          item.backtested?.id,
                                          Boolean(checked)
                                        )
                                      }
                                      aria-label={`Include backtested trade ${formatDateTime(
                                        item.backtested
                                      )}`}
                                    />
                                  )}
                                </td>
                                <td className="py-4 pr-4 align-middle">
                                  {item.backtested ? (
                                    <span className="font-medium whitespace-nowrap">
                                      {formatDateTime(item.backtested)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-right align-middle">
                                  {item.backtested ? (
                                    <span className="font-medium tabular-nums">
                                      {item.backtested.contracts}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-right align-middle">
                                  {item.backtested ? (
                                    <span className="font-medium tabular-nums">
                                      {formatCurrency(
                                        item.backtested.totalPremium
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-right align-middle">
                                  {item.backtested ? (
                                    <span
                                      className={cn(
                                        "font-semibold tabular-nums",
                                        item.backtested.pl >= 0
                                          ? "text-green-600 dark:text-green-500"
                                          : "text-red-600 dark:text-red-500"
                                      )}
                                    >
                                      {formatCurrency(item.backtested.pl)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-center align-middle">
                                  {item.backtested && item.autoBacktested && (
                                    <span className="text-xs text-muted-foreground">
                                      AUTO
                                    </span>
                                  )}
                                </td>
                                <td className="w-4 bg-border"></td>
                                <td className="py-4 pl-3 pr-3 align-middle">
                                  {item.reported && item.backtested && (
                                    <Checkbox
                                      checked={Boolean(reportedSelected)}
                                      onCheckedChange={(checked) =>
                                        toggleReported(
                                          item.reported?.id,
                                          Boolean(checked)
                                        )
                                      }
                                      aria-label={`Include reported trade ${formatDateTime(
                                        item.reported
                                      )}`}
                                    />
                                  )}
                                </td>
                                <td className="py-4 pr-4 align-middle">
                                  {item.reported ? (
                                    <span className="font-medium whitespace-nowrap">
                                      {formatDateTime(item.reported)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-right align-middle">
                                  {item.reported ? (
                                    <span className="font-medium tabular-nums">
                                      {item.reported.contracts}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-right align-middle">
                                  {item.reported ? (
                                    <span className="font-medium tabular-nums">
                                      {formatCurrency(item.reported.totalPremium)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-right align-middle">
                                  {item.reported ? (
                                    <span
                                      className={cn(
                                        "font-semibold tabular-nums",
                                        item.reported.pl >= 0
                                          ? "text-green-600 dark:text-green-500"
                                          : "text-red-600 dark:text-red-500"
                                      )}
                                    >
                                      {formatCurrency(item.reported.pl)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 text-center align-middle">
                                  {item.reported && item.autoReported && (
                                    <span className="text-xs text-muted-foreground">
                                      AUTO
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a session to review its trades.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={!alignment}
          >
            Reset to Auto Matches
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!alignment}
            >
              Save Selection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SelectionSource = "selected" | "auto";

function buildSelectionConfig(
  alignment: AlignedTradeSet,
  source: SelectionSource
): {
  backSet: Set<string>;
  reportedSet: Set<string>;
  backFallback: boolean;
  reportedFallback: boolean;
} {
  const backSource =
    source === "selected"
      ? alignment.selectedBacktestedIds
      : alignment.autoSelectedBacktestedIds;

  const reportedSource =
    source === "selected"
      ? alignment.selectedReportedIds
      : alignment.autoSelectedReportedIds;

  const shouldFallbackBacktested =
    backSource.length === 0 && alignment.backtestedTrades.length > 0;

  const shouldFallbackReported =
    reportedSource.length === 0 && alignment.reportedTrades.length > 0;

  const backIds = shouldFallbackBacktested
    ? alignment.backtestedTrades.map((trade) => trade.id)
    : backSource;

  const reportedIds = shouldFallbackReported
    ? alignment.reportedTrades.map((trade) => trade.id)
    : reportedSource;

  return {
    backSet: new Set(backIds),
    reportedSet: new Set(reportedIds),
    backFallback: shouldFallbackBacktested,
    reportedFallback: shouldFallbackReported,
  };
}

function formatTradeCount(included: number, total: number): string {
  if (total === 0) {
    return "0";
  }

  if (included === total) {
    return String(total);
  }

  return `${included} / ${total}`;
}

function formatDateTime(trade: {
  dateOpened: Date;
  timeOpened?: string;
  sortTime: number;
}): string {
  // Use sortTime which properly combines date and time
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
