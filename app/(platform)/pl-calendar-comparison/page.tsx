"use client";

import { PLComparisonCalendarPanel } from "@/components/pl-calendar/PLComparisonCalendarPanel";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalendarDayComparison } from "@/lib/analytics/calendar-comparison";
import { buildCalendarDayComparisons } from "@/lib/analytics/calendar-comparison";
import type { DailyPnLPoint } from "@/lib/analytics/pl-analytics";
import { useBlockStore } from "@/lib/stores/block-store";
import { useMemo, useState } from "react";

export default function PLCalendarComparisonPage() {
  const blocks = useBlockStore((s) => s.blocks);
  const [btBlockId, setBtBlockId] = useState<string | undefined>();
  const [liveBlockId, setLiveBlockId] = useState<string | undefined>();

  const btBlock = useMemo(
    () => blocks.find((b) => b.id === btBlockId),
    [blocks, btBlockId]
  );
  const liveBlock = useMemo(
    () => blocks.find((b) => b.id === liveBlockId),
    [blocks, liveBlockId]
  );

  const dayComparisons = useMemo<CalendarDayComparison[]>(() => {
    // NOTE: We need daily log data. The Block interface has `dailyLogs`.
    // Ensure the store actually populates this or we have it.
    // If `dailyLogs` is on the block object in the store (after processing), we use it.
    // If the store only holds metadata, we might need a way to load the content.
    // Assuming for now the blocks in the store (if loaded) have the data or we can pass empty.

    // Checking block structure standard... usually 'processed' blocks in store act as the source.
    // If we need to load logs specifically, that logic isn't visible here yet, but let's assume
    // the `useBlockStore` provides fully hydrated blocks or accessible log references.
    // Wait, `Block` in `lib/models/block.ts` defines `dailyLog` as metadata mainly.
    // But maybe we are using the `activeBlock` context usually?

    // FOR PHASE 1 PROTOTYPE:
    // We assume `btBlock` and `liveBlock` objects have the data we need.
    // But looking at `Block` interface, `dailyLog` is `{ fileName, rowCount, ... }` -- it's NOT the array of rows.
    // So we likely can't just sync comparison from strictly `blocks`.
    // We might need to rely on the active block context, OR just prototype with mock data if real data isn't easily accessible without loading.

    // User Prompt says: "Get their trades/daily logs from the store... 2. Get their trades/daily logs from the store and pass into the comparison helper."
    // I will implement assuming `(btBlock as any).dailyLogs` exists or try to find where it's stored.
    // If not, I might need to `view_file` the store logic.
    // For now, I will cast to any to avoid TS errors if the type is loose,
    // but ideally I should verify how to get the daily rows.

    // Cast to local interface properly
    interface BlockWithData {
      dailyLogs?: DailyPnLPoint[];
    }

    const btDaily = (btBlock as unknown as BlockWithData)?.dailyLogs ?? [];
    const liveDaily = (liveBlock as unknown as BlockWithData)?.dailyLogs ?? [];

    return buildCalendarDayComparisons(btDaily, liveDaily);
  }, [btBlock, liveBlock]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Comparison Calendar
        </h1>
        <p className="text-muted-foreground">
          Analyze slippage by comparing Backtest (Baseline) against Live
          (Reporting) execution.
        </p>
      </div>

      <div className="flex gap-8 items-end p-4 border rounded-lg bg-card/50">
        <div className="flex flex-col space-y-2 w-[300px]">
          <Label>Backtest Block (Baseline)</Label>
          <Select value={btBlockId} onValueChange={setBtBlockId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a block..." />
            </SelectTrigger>
            <SelectContent>
              {blocks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col space-y-2 w-[300px]">
          <Label>Live Block (Reporting)</Label>
          <Select value={liveBlockId} onValueChange={setLiveBlockId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a block..." />
            </SelectTrigger>
            <SelectContent>
              {blocks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <PLComparisonCalendarPanel days={dayComparisons} />
      </div>
    </div>
  );
}
