"use client";

import { useEffect, useMemo, useState } from "react";

import { NoActiveBlock } from "@/components/no-active-block";
import { PLAnalyticsPanel } from "@/components/pl-analytics/PLAnalyticsPanel";
import { WorkspaceShell } from "@/components/workspace-shell";
import { RawTrade } from "@/lib/analytics/pl-analytics";
import { getTradesByBlockWithOptions } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";

export default function PlAnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const activeBlock = useBlockStore((state) => {
    const activeBlockId = state.activeBlockId;
    return activeBlockId
      ? state.blocks.find((block) => block.id === activeBlockId)
      : null;
  });
  const isInitialized = useBlockStore((state) => state.isInitialized);
  const loadBlocks = useBlockStore((state) => state.loadBlocks);

  useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [isInitialized, loadBlocks]);

  useEffect(() => {
    async function fetchData() {
      if (!activeBlock) {
        setTrades([]);
        return;
      }

      setIsLoadingData(true);
      try {
        const fetchedTrades = await getTradesByBlockWithOptions(activeBlock.id);
        setTrades(fetchedTrades);
      } catch (error) {
        console.error("Failed to fetch trades:", error);
      } finally {
        setIsLoadingData(false);
      }
    }

    fetchData();
  }, [activeBlock]);

  const rawTrades: RawTrade[] = useMemo(
    () =>
      trades.map((t, idx) => ({
        id: t.timeOpened ? `${t.dateOpened}-${t.timeOpened}` : String(idx),
        strategy: t.strategy || "Uncategorized",
        openedOn: new Date(t.dateOpened),
        closedOn: t.dateClosed
          ? new Date(t.dateClosed)
          : new Date(t.dateOpened),
        pl: t.pl || 0,
        premium: t.premium,
        marginReq: t.marginReq,
        contracts: t.numContracts,
        fundsAtClose: t.fundsAtClose ?? undefined,
        dayKey: t.dayKey,
      })),
    [trades]
  );

  return (
    <WorkspaceShell
      title="P/L Analytics"
      label="New"
      description="Average P/L statistics and monthly withdrawal simulator."
    >
      {!activeBlock ? (
        <NoActiveBlock />
      ) : isLoadingData ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      ) : rawTrades.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No trades available for this block yet.
        </div>
      ) : (
        <PLAnalyticsPanel trades={rawTrades} />
      )}
    </WorkspaceShell>
  );
}
