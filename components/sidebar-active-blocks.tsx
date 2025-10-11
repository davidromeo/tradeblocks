"use client";

import {
  IconArrowsShuffle,
  IconCheck,
  IconFileSpreadsheet,
  IconRefresh,
} from "@tabler/icons-react";
import { useState } from "react";

import { BlockSwitchDialog } from "@/components/block-switch-dialog";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { type Block } from "@/lib/stores/block-store";

export function SidebarActiveBlocks({ activeBlock }: { activeBlock: Block }) {
  const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false);
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) return "today";
    if (diffInDays === 1) return "yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }).format(date);
  };

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Active Block</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3">
        <div className="rounded-xl border border-border/60 bg-sidebar-accent/40 p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconCheck className="size-4 rounded-full text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-sidebar-foreground">
                {activeBlock.name}
              </p>
            </div>
          </div>

          <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-2 py-1">
              <dt className="flex items-center gap-2 font-medium text-foreground">
                <IconFileSpreadsheet className="size-3.5" />
                Trade Log
              </dt>
              <dd className="flex flex-col items-end text-right text-[0.7rem]">
                <span className="max-w-[140px] truncate text-xs">
                  {activeBlock.tradeLog.fileName}
                </span>
                <span className="text-muted-foreground uppercase tracking-wide">
                  {activeBlock.tradeLog.rowCount} rows
                </span>
              </dd>
            </div>

            {activeBlock.dailyLog && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-2 py-1">
                <dt className="flex items-center gap-2 font-medium text-foreground">
                  <IconFileSpreadsheet className="size-3.5" />
                  Daily Log
                </dt>
                <dd className="flex flex-col items-end text-right text-[0.7rem]">
                  <span className="max-w-[140px] truncate text-xs">
                    {activeBlock.dailyLog.fileName}
                  </span>
                  <span className="text-muted-foreground uppercase tracking-wide">
                    {activeBlock.dailyLog.rowCount} rows
                  </span>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-3 flex items-center justify-between text-[0.65rem] text-muted-foreground">
            <span className="flex items-center gap-1">
              <IconRefresh className="size-3" />
              Updated {formatDate(activeBlock.lastModified)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[0.7rem]"
              onClick={() => setIsSwitchDialogOpen(true)}
            >
              <IconArrowsShuffle className="size-3" />
              Switch
            </Button>
          </div>
        </div>
      </SidebarGroupContent>

      <BlockSwitchDialog
        open={isSwitchDialogOpen}
        onOpenChange={setIsSwitchDialogOpen}
      />
    </SidebarGroup>
  );
}
