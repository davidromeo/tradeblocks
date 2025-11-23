"use client";

import { BlockDialog } from "@/components/block-dialog";
import { EquityCurveUploadDialog } from "@/components/equity-curve-upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { Activity, Calendar, ChevronDown, Download, FileSpreadsheet, Grid3X3, Info, List, Plus, Search, RotateCcw } from "lucide-react";
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
          {block.reportingLog && (
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              <List className="w-3 h-3 mr-1" />
              Reporting Log ({block.reportingLog.rowCount})
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

function BlockRow({
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
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${
        block.isActive ? "ring-2 ring-primary bg-primary/5" : "bg-card"
      }`}
    >
      {/* Name and Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{block.name}</h3>
          {block.isActive && (
            <Badge variant="default" className="text-xs">ACTIVE</Badge>
          )}
        </div>
        {block.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {block.description}
          </p>
        )}
      </div>

      {/* File Indicators */}
      <div className="hidden md:flex items-center gap-2">
        <Badge variant="secondary" className="text-xs whitespace-nowrap">
          <Activity className="w-3 h-3 mr-1" />
          {block.tradeLog.rowCount}
        </Badge>
        {block.dailyLog && (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            <Calendar className="w-3 h-3 mr-1" />
            {block.dailyLog.rowCount}
          </Badge>
        )}
        {block.reportingLog && (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            <List className="w-3 h-3 mr-1" />
            {block.reportingLog.rowCount}
          </Badge>
        )}
      </div>

      {/* Last Modified */}
      <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(block.lastModified)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {!block.isActive && (
          <Button
            size="sm"
            onClick={() => setActiveBlock(block.id)}
          >
            Activate
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(block)}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRecalculate}
          disabled={isRecalculating}
          title="Recalculate statistics and charts"
        >
          <RotateCcw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}

const COMPLETE_TEMPLATE_CSV = `Date Opened,Time Opened,Opening Price,Legs,Premium,Closing Price,Date Closed,Time Closed,Avg. Closing Cost,Reason For Close,P/L,No. of Contracts,Funds at Close,Margin Req.,Strategy
2024-01-15,09:30:00,4535.25,SPX 15JAN24 4500P/4450P,2.50,1.25,2024-01-15,15:45:00,1.25,Profit Target,125.00,1,10125.00,1000.00,Bull Put Spread
2024-01-16,10:15:00,4542.75,SPX 19JAN24 4600C/4650C,3.25,0.50,2024-01-18,14:30:00,0.50,Profit Target,275.00,1,10400.00,1200.00,Bear Call Spread`;

const MINIMAL_TEMPLATE_CSV = `Date Opened,Time Opened,Opening Price,Legs,Premium,Closing Price,Date Closed,Time Closed,Avg. Closing Cost,Reason For Close,P/L,No. of Contracts,Funds at Close,Margin Req.,Strategy
2024-01-15,09:30:00,4535.25,SPX 15JAN24 4500P/4450P,2.50,,,,,,125.00,1,10125.00,1000.00,Bull Put Spread
2024-01-16,09:30:00,4542.75,SPX 19JAN24 4600C/4650C,3.25,,,,,,275.00,1,10400.00,1200.00,Bear Call Spread`;

export default function BlockManagementPage() {
  const blocks = useBlockStore(state => state.blocks);
  const isInitialized = useBlockStore(state => state.isInitialized);
  const error = useBlockStore(state => state.error);
  const loadBlocks = useBlockStore(state => state.loadBlocks);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isEquityCurveDialogOpen, setIsEquityCurveDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"new" | "edit">("new");
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // No need for useEffect here since AppSidebar handles loading

  // Filter blocks based on search query
  const filteredBlocks = React.useMemo(() => {
    if (!searchQuery.trim()) return blocks;

    const query = searchQuery.toLowerCase();
    return blocks.filter(block =>
      block.name.toLowerCase().includes(query)
    );
  }, [blocks, searchQuery]);

  const handleNewBlock = () => {
    setDialogMode("new");
    setSelectedBlock(null);
    setIsBlockDialogOpen(true);
  };

  const handleNewEquityCurveBlock = () => {
    setIsEquityCurveDialogOpen(true);
  };

  const handleEquityCurveSuccess = (blockId: string) => {
    // Reload blocks to show the new generic block
    loadBlocks();
  };

  const handleEditBlock = (block: Block) => {
    setDialogMode("edit");
    setSelectedBlock(block);
    setIsBlockDialogOpen(true);
  };

  const handleDownloadTemplate = (type: 'complete' | 'minimal') => {
    const content = type === 'complete' ? COMPLETE_TEMPLATE_CSV : MINIMAL_TEMPLATE_CSV;
    const filename = type === 'complete'
      ? 'tradeblocks-template-complete.csv'
      : 'tradeblocks-template-minimal.csv';

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Search and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search blocks..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Template</span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => handleDownloadTemplate('minimal')}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Minimal Template</span>
                  <span className="text-xs text-muted-foreground">
                    Only required fields filled, closing fields empty
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadTemplate('complete')}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Complete Template</span>
                  <span className="text-xs text-muted-foreground">
                    All fields filled with example closed trades
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Block
                <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={handleNewBlock}>
                <Activity className="w-4 h-4 mr-2" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Trade-Based Block</span>
                  <span className="text-xs text-muted-foreground">
                    Upload Option Omega trade logs
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleNewEquityCurveBlock}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Equity Curve Block</span>
                  <span className="text-xs text-muted-foreground">
                    Upload generic equity curve CSV
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Blocks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trading Blocks</h2>
          <span className="text-sm text-muted-foreground">
            {!isInitialized
              ? "Loading..."
              : searchQuery.trim()
              ? `${filteredBlocks.length} of ${blocks.length} blocks`
              : `${blocks.length} blocks`}
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
        ) : filteredBlocks.length === 0 && searchQuery.trim() ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No blocks found</h3>
            <p className="text-muted-foreground mb-4">
              No blocks match &quot;{searchQuery}&quot;
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-12 max-w-2xl mx-auto">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No trading blocks yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first trading block to start analyzing your performance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button onClick={handleNewBlock}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Block
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                    <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-72">
                  <DropdownMenuItem onClick={() => handleDownloadTemplate('minimal')}>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Minimal Template</span>
                      <span className="text-xs text-muted-foreground">
                        Only required fields filled, closing fields empty
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadTemplate('complete')}>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Complete Template</span>
                      <span className="text-xs text-muted-foreground">
                        All fields filled with example closed trades
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Required CSV Fields</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    <span className="font-medium">Must have values:</span> Date Opened, Time Opened (HH:mm:ss), Opening Price, Legs, Premium, P/L, No. of Contracts, Funds at Close, Margin Req., Strategy
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    <span className="font-medium">Optional:</span> All closing fields can be empty for open trades
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlocks.map((block) => (
              <BlockCard key={block.id} block={block} onEdit={handleEditBlock} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBlocks.map((block) => (
              <BlockRow key={block.id} block={block} onEdit={handleEditBlock} />
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

      <EquityCurveUploadDialog
        open={isEquityCurveDialogOpen}
        onOpenChange={setIsEquityCurveDialogOpen}
        onSuccess={handleEquityCurveSuccess}
      />
    </div>
  );
}
