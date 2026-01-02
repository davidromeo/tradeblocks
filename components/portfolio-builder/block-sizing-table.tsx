"use client";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { HelpCircle } from "lucide-react";
import { SizingConfig, BlockSizingStats } from "@/lib/models/mega-block";
import { calculateBlockScaleFactor } from "@/lib/services/mega-block";
import { useCallback, useState } from "react";

export interface BlockWithSizing {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
}

interface BlockSizingTableProps {
  blocks: BlockWithSizing[];
  portfolioCapital: number;
  onSizingChange: (blockId: string, config: SizingConfig) => void;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

export function BlockSizingTable({
  blocks,
  portfolioCapital,
  onSizingChange,
}: BlockSizingTableProps) {
  // Track input values as strings for better UX
  const [inputValues, setInputValues] = useState<
    Record<string, { allocationPct?: string; maxContracts?: string; maxAllocation?: string }>
  >({});

  const getInputValue = useCallback(
    (blockId: string, field: keyof SizingConfig): string => {
      const inputVal = inputValues[blockId]?.[field];
      if (inputVal !== undefined) return inputVal;

      const block = blocks.find((b) => b.blockId === blockId);
      const val = block?.sizingConfig?.[field];
      return val !== undefined ? String(val) : "";
    },
    [inputValues, blocks]
  );

  const handleInputChange = useCallback(
    (blockId: string, field: keyof SizingConfig, value: string) => {
      setInputValues((prev) => ({
        ...prev,
        [blockId]: {
          ...prev[blockId],
          [field]: value,
        },
      }));
    },
    []
  );

  const handleInputBlur = useCallback(
    (blockId: string, field: keyof SizingConfig) => {
      const value = inputValues[blockId]?.[field];
      const block = blocks.find((b) => b.blockId === blockId);
      if (!block) return;

      let newValue: number | undefined = undefined;

      if (value !== undefined && value !== "") {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed > 0) {
          newValue = parsed;
        }
      }

      // Update the sizing config
      const newConfig: SizingConfig = {
        ...block.sizingConfig,
        [field]: newValue,
      };

      // Clear the input tracking so it reflects the new config
      setInputValues((prev) => {
        const updated = { ...prev };
        if (updated[blockId]) {
          delete updated[blockId][field];
          if (Object.keys(updated[blockId]).length === 0) {
            delete updated[blockId];
          }
        }
        return updated;
      });

      onSizingChange(blockId, newConfig);
    },
    [inputValues, blocks, onSizingChange]
  );

  // Calculate total allocation across all blocks
  const totalAllocation = blocks.reduce((sum, block) => {
    if (block.stats && block.sizingConfig.allocationPct) {
      const scaleFactor = calculateBlockScaleFactor(
        block.stats,
        portfolioCapital,
        block.sizingConfig
      );
      // Effective allocation = scaleFactor * avgMargin / portfolioCapital * 100
      return sum + (scaleFactor * block.stats.avgMargin / portfolioCapital) * 100;
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">Position Sizing</span>
        <HoverCard>
          <HoverCardTrigger asChild>
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
          </HoverCardTrigger>
          <HoverCardContent className="w-96 p-0 overflow-hidden">
            <div className="space-y-3">
              <div className="bg-primary/5 border-b px-4 py-3">
                <h4 className="text-sm font-semibold text-primary">
                  Position Sizing Controls
                </h4>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  Scale each strategy based on your intended position sizing.
                </p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    <strong>Margin/Ct:</strong> Average margin per contract, normalized
                    to allow fair comparison between blocks tested with different sizes.
                  </p>
                  <p>
                    <strong>Allocation %:</strong> Target margin as % of portfolio capital.
                    E.g., 10% of $100k = $10k max margin per trade.
                  </p>
                  <p>
                    <strong>Max Contracts:</strong> Cap contracts per trade.
                    Scales based on historical average contracts.
                  </p>
                  <p>
                    <strong>Max Allocation $:</strong> Cap margin in dollars per trade.
                  </p>
                  <p className="pt-1 border-t">
                    When multiple constraints are set, the most restrictive (smallest
                    scale factor) wins.
                  </p>
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Block</TableHead>
              <TableHead className="text-right w-[70px]">Win%</TableHead>
              <TableHead className="text-right w-[80px]">Avg RoM</TableHead>
              <TableHead className="text-right w-[90px]">Margin/Ct</TableHead>
              <TableHead className="text-center w-[100px]">Alloc %</TableHead>
              <TableHead className="text-center w-[90px]">Max Cts</TableHead>
              <TableHead className="text-center w-[110px]">Max Alloc $</TableHead>
              <TableHead className="text-right w-[80px]">Scale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocks.map((block) => {
              const scaleFactor =
                block.stats && Object.values(block.sizingConfig).some((v) => v !== undefined)
                  ? calculateBlockScaleFactor(block.stats, portfolioCapital, block.sizingConfig)
                  : 1.0;

              return (
                <TableRow key={block.blockId}>
                  <TableCell className="font-medium truncate max-w-[180px]">
                    {block.name}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {block.stats ? formatPercent(block.stats.winRate) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {block.stats ? `${formatNumber(block.stats.avgRoM)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {block.stats ? formatCurrency(block.stats.avgMargin) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={getInputValue(block.blockId, "allocationPct")}
                      onChange={(e) =>
                        handleInputChange(block.blockId, "allocationPct", e.target.value)
                      }
                      onBlur={() => handleInputBlur(block.blockId, "allocationPct")}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleInputBlur(block.blockId, "allocationPct")
                      }
                      placeholder="—"
                      className="h-7 w-16 text-center text-sm mx-auto"
                      min={0.1}
                      max={100}
                      step={0.5}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={getInputValue(block.blockId, "maxContracts")}
                      onChange={(e) =>
                        handleInputChange(block.blockId, "maxContracts", e.target.value)
                      }
                      onBlur={() => handleInputBlur(block.blockId, "maxContracts")}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleInputBlur(block.blockId, "maxContracts")
                      }
                      placeholder="—"
                      className="h-7 w-14 text-center text-sm mx-auto"
                      min={1}
                      step={1}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={getInputValue(block.blockId, "maxAllocation")}
                      onChange={(e) =>
                        handleInputChange(block.blockId, "maxAllocation", e.target.value)
                      }
                      onBlur={() => handleInputBlur(block.blockId, "maxAllocation")}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleInputBlur(block.blockId, "maxAllocation")
                      }
                      placeholder="—"
                      className="h-7 w-20 text-center text-sm mx-auto"
                      min={100}
                      step={100}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {scaleFactor !== 1.0 ? `${formatNumber(scaleFactor, 2)}x` : "1x"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer with total allocation indicator */}
      {totalAllocation > 0 && (
        <div className="flex justify-end text-xs text-muted-foreground">
          <span>
            Est. total margin allocation:{" "}
            <span
              className={
                totalAllocation > 100
                  ? "text-destructive font-medium"
                  : totalAllocation > 80
                  ? "text-yellow-600 font-medium"
                  : ""
              }
            >
              {formatNumber(totalAllocation, 1)}%
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
