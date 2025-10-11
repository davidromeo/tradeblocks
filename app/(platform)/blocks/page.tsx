"use client";

import { BlockDialog } from "@/components/block-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { Activity, Calendar, Grid3X3, List, Plus, Search, RotateCcw } from "lucide-react";
import React, { useState } from "react";

function BlockCard({
  block,
  onEdit,
}: {
  block: Block;
  onEdit: (block: Block) => void;
}) {
  const setActiveBlock = useBlockStore(state => state.setActiveBlock);
  const recalculateBlock = useBlockStore(state => state.recalculateBlock);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateBlock(block.id);

      // If this block is active, also refresh the performance store
      if (block.isActive) {
        const { usePerformanceStore } = await import('@/lib/stores/performance-store');
        await usePerformanceStore.getState().fetchPerformanceData(block.id);
      }
    } catch (error) {
      console.error('Failed to recalculate block:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <Card
      className={`relative transition-all hover:shadow-md ${
        block.isActive ? "ring-2 ring-primary" : ""
      }`}
    >
      {block.isActive && (
        <Badge className="absolute -top-2 -right-2 bg-primary">ACTIVE</Badge>
      )}

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold leading-tight">
              {block.name}
            </CardTitle>
            {block.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {block.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File Indicators */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            <Activity className="w-3 h-3 mr-1" />
            Trade Log ({block.tradeLog.rowCount})
          </Badge>
          {block.dailyLog && (
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              <Calendar className="w-3 h-3 mr-1" />
              Daily Log ({block.dailyLog.rowCount})
            </Badge>
          )}
        </div>

        {/* Last Modified */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          Last updated: {formatDate(block.lastModified)}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {!block.isActive && (
            <Button
              size="sm"
              className="flex-1 min-w-[80px]"
              onClick={() => setActiveBlock(block.id)}
            >
              Activate
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[80px]"
            onClick={() => onEdit(block)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-w-fit"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            title="Recalculate statistics and charts"
          >
            <RotateCcw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 hidden sm:inline">{isRecalculating ? 'Recalculating...' : 'Recalculate'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BlockManagementPage() {
  const blocks = useBlockStore(state => state.blocks);
  const isInitialized = useBlockStore(state => state.isInitialized);
  const error = useBlockStore(state => state.error);
  const loadBlocks = useBlockStore(state => state.loadBlocks);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"new" | "edit">("new");
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);

  // No need for useEffect here since AppSidebar handles loading

  const handleNewBlock = () => {
    setDialogMode("new");
    setSelectedBlock(null);
    setIsBlockDialogOpen(true);
  };

  const handleEditBlock = (block: Block) => {
    setDialogMode("edit");
    setSelectedBlock(block);
    setIsBlockDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Search and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Search blocks..." className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <List className="w-4 h-4" />
          </Button>
          <Button onClick={handleNewBlock}>
            <Plus className="w-4 h-4 mr-2" />
            New Block
          </Button>
        </div>
      </div>

      {/* Blocks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trading Blocks</h2>
          <span className="text-sm text-muted-foreground">
            {!isInitialized ? "Loading..." : `${blocks.length} blocks`}
          </span>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-900 dark:text-red-100 font-medium">Error loading blocks</p>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBlocks()}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {!isInitialized ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Loading skeleton */}
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No trading blocks yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first trading block to start analyzing your performance.
            </p>
            <Button onClick={handleNewBlock}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Block
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blocks.map((block) => (
              <BlockCard key={block.id} block={block} onEdit={handleEditBlock} />
            ))}
          </div>
        )}
      </div>

      <BlockDialog
        open={isBlockDialogOpen}
        onOpenChange={setIsBlockDialogOpen}
        mode={dialogMode}
        block={selectedBlock}
      />
    </div>
  );
}
