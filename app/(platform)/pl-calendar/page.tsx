"use client";

import { useEffect, useState } from "react";

import { NoActiveBlock } from "@/components/no-active-block";
import { PLCalendarPanel } from "@/components/pl-calendar/PLCalendarPanel";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getTradesByBlockWithOptions } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";

export default function PlCalendarPage() {
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

  // Load blocks if not initialized
  useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [isInitialized, loadBlocks]);

  // Fetch trades when active block changes
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

  if (!activeBlock) {
    return <NoActiveBlock />;
  }

  return (
    <WorkspaceShell
      title="P/L Calendar"
      label="New"
      description="Visualize daily P/L and drill into trades and legs for each day."
    >
      {isLoadingData ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      ) : (
        <PLCalendarPanel trades={trades} />
      )}
    </WorkspaceShell>
  );
}
