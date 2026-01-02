"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { saveMegaBlock, getBlockSizingStats, calculateBlockScaleFactor } from "@/lib/services/mega-block";
import { SizingConfig, BlockSizingStats } from "@/lib/models/mega-block";
import { HelpCircle, Layers, Loader2, Plus, X } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BlockStatsTab } from "@/components/portfolio-builder/tabs/block-stats-tab";
import { PerformanceTab } from "@/components/portfolio-builder/tabs/performance-tab";
import { CorrelationTab } from "@/components/portfolio-builder/tabs/correlation-tab";
import { TailRiskTab } from "@/components/portfolio-builder/tabs/tail-risk-tab";
import { BlockSizingTable, BlockWithSizing } from "@/components/portfolio-builder/block-sizing-table";

interface SelectedBlock {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
}

export default function PortfolioBuilderPage() {
  const router = useRouter();
  const blocks = useBlockStore((state) => state.blocks);
  const isInitialized = useBlockStore((state) => state.isInitialized);
  const addBlock = useBlockStore((state) => state.addBlock);

  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [megaBlockName, setMegaBlockName] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [startingCapital, setStartingCapital] = useState<number>(100000);
  const [startingCapitalInput, setStartingCapitalInput] = useState<string>("100000");

  const handleToggleBlock = useCallback((block: Block, checked: boolean) => {
    if (checked) {
      setSelectedBlocks((prev) => [
        ...prev,
        { blockId: block.id, name: block.name, sizingConfig: {} },
      ]);
    } else {
      setSelectedBlocks((prev) => prev.filter((b) => b.blockId !== block.id));
    }
  }, []);

  const handleRemoveBlock = useCallback((blockId: string) => {
    setSelectedBlocks((prev) => prev.filter((b) => b.blockId !== blockId));
  }, []);

  const isBlockSelected = useCallback(
    (blockId: string) => selectedBlocks.some((b) => b.blockId === blockId),
    [selectedBlocks]
  );

  const handleSizingChange = useCallback((blockId: string, config: SizingConfig) => {
    setSelectedBlocks((prev) =>
      prev.map((b) => (b.blockId === blockId ? { ...b, sizingConfig: config } : b))
    );
  }, []);

  // Load block stats when blocks are selected
  useEffect(() => {
    const loadStats = async () => {
      const blocksWithoutStats = selectedBlocks.filter((b) => !b.stats);
      if (blocksWithoutStats.length === 0) return;

      const statsPromises = blocksWithoutStats.map((b) => getBlockSizingStats(b.blockId));
      const statsResults = await Promise.all(statsPromises);

      const statsMap = new Map<string, BlockSizingStats>();
      blocksWithoutStats.forEach((b, i) => {
        statsMap.set(b.blockId, statsResults[i]);
      });

      setSelectedBlocks((prev) =>
        prev.map((b) => {
          const stats = statsMap.get(b.blockId);
          return stats ? { ...b, stats } : b;
        })
      );
    };

    loadStats();
  }, [selectedBlocks]);

  const handleStartingCapitalBlur = useCallback(() => {
    const val = parseInt(startingCapitalInput, 10);
    if (!isNaN(val) && val >= 1000) {
      setStartingCapital(val);
      setStartingCapitalInput(val.toLocaleString());
    } else {
      setStartingCapitalInput(startingCapital.toLocaleString());
    }
  }, [startingCapitalInput, startingCapital]);

  const canCreate =
    selectedBlocks.length >= 2 && megaBlockName.trim().length > 0 && !isCreating;

  const handleCreateMegaBlock = useCallback(async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      // Compute scale factors from sizing configs
      const sourceBlocksWithWeights = selectedBlocks.map((b) => {
        let weight = 1.0;
        if (b.stats && Object.values(b.sizingConfig).some((v) => v !== undefined)) {
          weight = calculateBlockScaleFactor(b.stats, startingCapital, b.sizingConfig);
        }
        return { blockId: b.blockId, weight };
      });

      const createdBlock = await saveMegaBlock({
        name: megaBlockName.trim(),
        sourceBlocks: sourceBlocksWithWeights,
      });

      // Add the created block to the store for immediate UI update
      await addBlock({
        id: createdBlock.id,
        name: createdBlock.name,
        description: createdBlock.description,
        isActive: false,
        lastModified: createdBlock.lastModified,
        tradeLog: {
          fileName: createdBlock.tradeLog.fileName,
          rowCount: createdBlock.tradeLog.processedRowCount,
          fileSize: createdBlock.tradeLog.fileSize,
        },
        dateRange: createdBlock.dateRange
          ? {
              start: new Date(createdBlock.dateRange.start),
              end: new Date(createdBlock.dateRange.end),
            }
          : undefined,
        stats: {
          totalPnL: 0,
          winRate: 0,
          totalTrades: createdBlock.tradeLog.processedRowCount,
          avgWin: 0,
          avgLoss: 0,
        },
      });

      // Navigate to the blocks page to see the new mega block
      router.push(`/blocks?highlight=${createdBlock.id}`);
    } catch (error) {
      console.error("Failed to create Mega Block:", error);
      setCreateError(
        error instanceof Error ? error.message : "Failed to create Mega Block"
      );
      setIsCreating(false);
    }
  }, [canCreate, megaBlockName, selectedBlocks, startingCapital, addBlock, router]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading blocks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Mega Block Name - at top */}
            <div className="space-y-2">
              <Label htmlFor="mega-block-name">Mega Block Name</Label>
              <Input
                id="mega-block-name"
                placeholder="e.g., Combined SPX Strategies"
                value={megaBlockName}
                onChange={(e) => setMegaBlockName(e.target.value)}
                className="max-w-md"
              />
            </div>

            {/* Source Blocks - Pills with multi-select dialog */}
            <div className="space-y-2">
              <Label>Source Blocks</Label>
              <div className="flex flex-wrap items-center gap-2">
                {selectedBlocks.map((block) => (
                  <Badge
                    key={block.blockId}
                    variant="secondary"
                    className="flex items-center gap-2 py-1.5 px-3"
                  >
                    <span className="font-medium">{block.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlock(block.blockId)}
                      className="hover:text-destructive transition-colors"
                      title={`Remove ${block.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      {selectedBlocks.length === 0 ? "Add Blocks" : "Edit"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Select Blocks</DialogTitle>
                      <DialogDescription>
                        Choose blocks to include in your Mega Block
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {blocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No blocks available. Upload blocks in Block Management first.
                        </p>
                      ) : (
                        blocks.map((block) => {
                          const isSelected = isBlockSelected(block.id);
                          return (
                            <label
                              key={block.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-accent"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleToggleBlock(block, checked === true)
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{block.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {block.tradeLog.rowCount} trades
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Position Sizing Table */}
            {selectedBlocks.length > 0 && (
              <BlockSizingTable
                blocks={selectedBlocks as BlockWithSizing[]}
                portfolioCapital={startingCapital}
                onSizingChange={handleSizingChange}
              />
            )}

            {/* Starting Capital & Sizing Mode */}
            {selectedBlocks.length > 0 && (
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="starting-capital">Starting Capital</Label>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Starting Capital
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              The initial portfolio value for combined statistics.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Used to calculate percentage-based metrics like CAGR, Max
                              Drawdown, and risk-adjusted ratios for the combined portfolio.
                              Set this to your intended total allocation across all strategies.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      id="starting-capital"
                      type="text"
                      value={startingCapitalInput}
                      onChange={(e) => setStartingCapitalInput(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={handleStartingCapitalBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleStartingCapitalBlur()}
                      className="w-32"
                      placeholder="100,000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="flex items-center justify-end gap-4 pt-2 border-t">
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Button
                onClick={handleCreateMegaBlock}
                disabled={!canCreate}
                className="gap-2"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                {isCreating ? "Creating..." : "Create Mega Block"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs - only show when blocks are selected */}
      {selectedBlocks.length >= 2 && (
        <Tabs defaultValue="block-stats">
          <TabsList>
            <TabsTrigger value="block-stats">Block Stats</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
            <TabsTrigger value="tail-risk">Tail Risk</TabsTrigger>
          </TabsList>

          <TabsContent value="block-stats" className="mt-4">
            <BlockStatsTab
              selectedBlocks={selectedBlocks}
              startingCapital={startingCapital}
            />
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <PerformanceTab
              selectedBlocks={selectedBlocks}
              startingCapital={startingCapital}
            />
          </TabsContent>

          <TabsContent value="correlation" className="mt-4">
            <CorrelationTab selectedBlocks={selectedBlocks} />
          </TabsContent>

          <TabsContent value="tail-risk" className="mt-4">
            <TailRiskTab selectedBlocks={selectedBlocks} />
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state */}
      {selectedBlocks.length < 2 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Select at least 2 blocks</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Add blocks using the button above to see comparison tools and create
              a Mega Block for portfolio analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
