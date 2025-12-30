"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { Layers, Plus, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

interface SelectedBlock {
  blockId: string;
  name: string;
  weight: number;
}

export default function PortfolioBuilderPage() {
  const blocks = useBlockStore((state) => state.blocks);
  const isInitialized = useBlockStore((state) => state.isInitialized);

  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [megaBlockName, setMegaBlockName] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Filter out mega blocks from available blocks
  const availableBlocks = useMemo(() => {
    // For now, just filter by name not containing "Mega" - we'll improve this
    // once we have the full ProcessedBlock data with isMegaBlock
    return blocks.filter((block) => {
      // Check if already selected
      const isSelected = selectedBlocks.some((sb) => sb.blockId === block.id);
      return !isSelected;
    });
  }, [blocks, selectedBlocks]);

  const handleAddBlock = useCallback((block: Block) => {
    setSelectedBlocks((prev) => [
      ...prev,
      { blockId: block.id, name: block.name, weight: 1.0 },
    ]);
    setIsAddDialogOpen(false);
  }, []);

  const handleRemoveBlock = useCallback((blockId: string) => {
    setSelectedBlocks((prev) => prev.filter((b) => b.blockId !== blockId));
  }, []);

  const handleWeightChange = useCallback((blockId: string, weight: number) => {
    setSelectedBlocks((prev) =>
      prev.map((b) => (b.blockId === blockId ? { ...b, weight } : b))
    );
  }, []);

  const canCreate = selectedBlocks.length >= 2 && megaBlockName.trim().length > 0;

  const handleCreateMegaBlock = useCallback(async () => {
    if (!canCreate) return;

    // TODO: Implement actual creation
    console.log("Creating Mega Block:", {
      name: megaBlockName,
      blocks: selectedBlocks,
    });
  }, [canCreate, megaBlockName, selectedBlocks]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading blocks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Builder</h1>
        <p className="text-muted-foreground">
          Combine multiple strategy blocks into a Mega Block for portfolio analysis
        </p>
      </div>

      {/* Top Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Selected Blocks */}
            <div className="space-y-2">
              <Label>Selected Blocks</Label>
              <div className="flex flex-wrap items-center gap-2">
                {selectedBlocks.map((block) => (
                  <Badge
                    key={block.blockId}
                    variant="secondary"
                    className="flex items-center gap-2 py-1.5 px-3"
                  >
                    <span className="font-medium">{block.name}</span>
                    <button
                      onClick={() => handleRemoveBlock(block.blockId)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Block
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Block to Portfolio</DialogTitle>
                      <DialogDescription>
                        Select a block to include in your Mega Block
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {availableBlocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No more blocks available to add
                        </p>
                      ) : (
                        availableBlocks.map((block) => (
                          <button
                            key={block.id}
                            onClick={() => handleAddBlock(block)}
                            className="w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors"
                          >
                            <div className="font-medium">{block.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {block.tradeLog.rowCount} trades
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Weights */}
            {selectedBlocks.length > 0 && (
              <div className="space-y-2">
                <Label>Weights</Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedBlocks.map((block) => (
                    <div
                      key={block.blockId}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
                    >
                      <span className="flex-1 text-sm font-medium truncate">
                        {block.name}
                      </span>
                      <Input
                        type="number"
                        value={block.weight}
                        onChange={(e) =>
                          handleWeightChange(
                            block.blockId,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 h-8 text-center"
                        min={0.1}
                        max={10}
                        step={0.1}
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1">
                <Input
                  placeholder="Mega Block name..."
                  value={megaBlockName}
                  onChange={(e) => setMegaBlockName(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button
                onClick={handleCreateMegaBlock}
                disabled={!canCreate}
                className="gap-2"
              >
                <Layers className="h-4 w-4" />
                Create Mega Block
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs - only show when blocks are selected */}
      {selectedBlocks.length >= 2 && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
            <TabsTrigger value="equity">Equity Curves</TabsTrigger>
            <TabsTrigger value="tail-risk">Tail Risk</TabsTrigger>
            <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Side-by-side metrics table and combined preview coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="correlation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Strategy correlation heatmap coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Equity Curves</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Overlaid equity curves coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tail-risk" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tail Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Tail risk analysis coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drawdowns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Drawdown Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Drawdown overlap analysis coming soon...
                </p>
              </CardContent>
            </Card>
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
