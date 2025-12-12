"use client";

import { useEffect, useState } from "react";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { NoActiveBlock } from "@/components/no-active-block";
import { PLCalendarPanel } from "@/components/pl-calendar/PLCalendarPanel";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { getTradesByBlockWithOptions } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import { cn } from "@/lib/utils";

export default function PlCalendarPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">P/L Calendar</h1>
          <p className="text-muted-foreground">
            Visualize daily P/L and drill into trades and legs for each day.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>All time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {isLoadingData ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      ) : (
        <PLCalendarPanel trades={trades} dateRange={dateRange} />
      )}
    </div>
  );
}
