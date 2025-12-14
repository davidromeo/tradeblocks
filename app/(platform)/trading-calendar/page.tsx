"use client";

import { NoActiveBlock } from "@/components/no-active-block";
import { CalendarNavigation } from "@/components/trading-calendar/calendar-navigation";
import { CalendarView } from "@/components/trading-calendar/calendar-view";
import { DayView } from "@/components/trading-calendar/day-view";
import { MatchStrategiesDialog } from "@/components/trading-calendar/match-strategies-dialog";
import { StatsHeader } from "@/components/trading-calendar/stats-header";
import { TradeDetailView } from "@/components/trading-calendar/trade-detail-view";
import { Card, CardContent } from "@/components/ui/card";
import { useBlockStore } from "@/lib/stores/block-store";
import { useTradingCalendarStore } from "@/lib/stores/trading-calendar-store";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function TradingCalendarPage() {
  const { activeBlockId, blocks } = useBlockStore();
  const { isLoading, error, navigationView, loadCalendarData, reset } =
    useTradingCalendarStore();

  const [matchDialogOpen, setMatchDialogOpen] = useState(false);

  const activeBlock = blocks.find((b) => b.id === activeBlockId);

  // Load calendar data when active block changes
  useEffect(() => {
    if (activeBlockId) {
      loadCalendarData(activeBlockId);
    } else {
      reset();
    }
  }, [activeBlockId, loadCalendarData, reset]);

  // No active block state
  if (!activeBlockId || !activeBlock) {
    return (
      <div className="p-6">
        <NoActiveBlock />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">
          <p>Failed to load calendar data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats header with metrics */}
      <StatsHeader onMatchStrategiesClick={() => setMatchDialogOpen(true)} />

      {/* Calendar card with navigation and content */}
      <Card>
        <CardContent className="space-y-6">
          {/* Navigation controls - date range, back button, view options */}
          <CalendarNavigation />

          {/* Main content area - switches based on navigation state */}
          <div className="min-h-[500px]">
            {navigationView === "calendar" && <CalendarView />}
            {navigationView === "day" && <DayView />}
            {navigationView === "trade" && <TradeDetailView />}
          </div>
        </CardContent>
      </Card>

      {/* Strategy matching dialog */}
      <MatchStrategiesDialog
        open={matchDialogOpen}
        onOpenChange={setMatchDialogOpen}
      />
    </div>
  );
}
