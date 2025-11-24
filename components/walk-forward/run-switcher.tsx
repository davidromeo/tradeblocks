"use client"

import { format } from "date-fns"
import { History, PanelRight, Trash2 } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import type { WalkForwardAnalysis } from "@/lib/models/walk-forward"

interface RunSwitcherProps {
  history: WalkForwardAnalysis[]
  currentId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => Promise<void>
}

export function RunSwitcher({ history, currentId, onSelect, onDelete }: RunSwitcherProps) {
  if (!history || history.length === 0) return null

  const pills = history.slice(0, 12) // keep top section light; full list in drawer

  const renderPill = (analysis: WalkForwardAnalysis) => {
    const isActive = analysis.id === currentId
    const efficiency = (analysis.results.summary.degradationFactor * 100).toFixed(1)
    const robustness = (analysis.results.summary.robustnessScore * 100).toFixed(1)

    return (
      <button
        key={analysis.id}
        onClick={() => onSelect(analysis.id)}
        className={cn(
          "whitespace-nowrap rounded-full border px-3 py-2 text-xs shadow-sm transition hover:border-primary",
          isActive
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{format(new Date(analysis.createdAt), "MMM d, yyyy")}</span>
          <Badge variant="outline" className="uppercase text-[10px]">
            {analysis.config.optimizationTarget}
          </Badge>
        </div>
        <div className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span>{analysis.results.periods.length} windows</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
          <span>{efficiency}% eff</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
          <span>{robustness}% robust</span>
        </div>
      </button>
    )
  }

  return (
    <div className="rounded-lg border bg-card/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-primary" />
          Run Switcher
        </div>
        <Drawer direction="right">
          <DrawerTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <PanelRight className="h-4 w-4" />
              Full history
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Run history</DrawerTitle>
              <DrawerDescription>All saved walk-forward analyses.</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 space-y-2">
              {history.map((analysis) => (
                <div
                  key={analysis.id}
                  className={cn(
                    "flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
                    analysis.id === currentId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary"
                  )}
                >
                  <button
                    onClick={() => onSelect(analysis.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {format(new Date(analysis.createdAt), "PP")}
                      </span>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {analysis.config.optimizationTarget}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {analysis.results.periods.length} windows ·{" "}
                      {(analysis.results.summary.degradationFactor * 100).toFixed(1)}% efficiency ·{" "}
                      {(analysis.results.summary.robustnessScore * 100).toFixed(1)}% robustness
                    </div>
                  </button>
                  <button
                    aria-label="Delete run"
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      const ok = window.confirm("Delete this run? This cannot be undone.")
                      if (ok) onDelete(analysis.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 pt-0">
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">
                  Close
                </Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      <div className="mt-3">
        <ScrollArea className="whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {pills.map(renderPill)}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}
