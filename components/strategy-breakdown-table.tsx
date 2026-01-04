"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

interface StrategyData {
  strategy: string;
  trades: number;
  totalPL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  kellyFactor?: number;
}

interface StrategyBreakdownTableProps {
  data?: StrategyData[];
  className?: string;
}

const mockData: StrategyData[] = [
  {
    strategy: "It's ORBin time!",
    trades: 72,
    totalPL: 13773,
    winRate: 44.4,
    avgWin: 7842,
    avgLoss: -5929,
    profitFactor: 1.06,
    kellyFactor: 2.5,
  },
  {
    strategy: "McRib w Lettuce, Pickles, & Special Sauce",
    trades: 128,
    totalPL: 428825,
    winRate: 38.3,
    avgWin: 24042,
    avgLoss: -9484,
    profitFactor: 1.57,
    kellyFactor: 12.8,
  },
  {
    strategy: "The Overnight SPY Who Loved Me",
    trades: 25,
    totalPL: 68226,
    winRate: 68.0,
    avgWin: 5222,
    avgLoss: -2568,
    profitFactor: 4.32,
    kellyFactor: 45.2,
  },
  {
    strategy: "Hump Day, Half-Baked Calendar - 1/2",
    trades: 32,
    totalPL: 133943,
    winRate: 59.4,
    avgWin: 12505,
    avgLoss: -7973,
    profitFactor: 2.29,
    kellyFactor: 28.7,
  },
  {
    strategy: "Theta Tuesday Calendar - 2/3",
    trades: 34,
    totalPL: 117140,
    winRate: 52.9,
    avgWin: 14187,
    avgLoss: -8639,
    profitFactor: 1.85,
    kellyFactor: 18.3,
  },
];

type SortField = keyof StrategyData;
type SortDirection = "asc" | "desc";

export function StrategyBreakdownTable({
  data = mockData,
  className,
}: StrategyBreakdownTableProps) {
  const [sortField, setSortField] = useState<SortField>("totalPL");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    // Handle undefined values: always sort them to the end
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1; // undefined goes to end
    if (bValue === undefined) return -1; // undefined goes to end

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const formatKellyFactor = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "-";
    }
    return `${value.toFixed(1)}%`;
  };

  const getProfitFactorColor = (value: number) => {
    if (value >= 2) return "text-green-600 dark:text-green-400";
    if (value >= 1.5) return "text-green-500 dark:text-green-500";
    if (value >= 1) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPLColor = (value: number) => {
    return value >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  };

  interface TooltipContent {
    flavor: string;
    detailed: string;
  }

  const SortButton = ({
    field,
    children,
    tooltip,
  }: {
    field: SortField;
    children: React.ReactNode;
    tooltip?: TooltipContent;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 p-0 hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {tooltip && (
          <HoverCard>
            <HoverCardTrigger asChild>
              <span className="inline-flex pointer-events-auto">
                <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 p-0 overflow-hidden">
              <div className="space-y-3">
                <div className="bg-primary/5 border-b px-4 py-3">
                  <h4 className="text-sm font-semibold text-primary">
                    {children}
                  </h4>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {tooltip.flavor}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tooltip.detailed}
                  </p>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
        )}
      </div>
    </Button>
  );

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <CardTitle className="text-lg">Strategy Breakdown</CardTitle>
          <Badge variant="outline" className="text-xs">
            POSITION-SIZE DEPENDENT
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md border-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/20">
                <TableHead className="font-semibold">
                  <SortButton field="strategy">Strategy</SortButton>
                </TableHead>
                <TableHead className="text-center font-semibold">
                  <SortButton field="trades">Trades</SortButton>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <SortButton field="totalPL">Total P/L</SortButton>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <SortButton field="winRate">Win Rate</SortButton>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <SortButton field="avgWin">Avg Win</SortButton>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <SortButton field="avgLoss">Avg Loss</SortButton>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <SortButton
                    field="profitFactor"
                    tooltip={{
                      flavor:
                        "Construction efficiency ratio - total building value divided by total rebuilding costs.",
                      detailed:
                        "Profit Factor divides total winnings by total losses. Values above 1.0 mean profits exceed losses, while below 1.0 indicates net losses. A profit factor of 2.0 means you made $2 in profits for every $1 lost. This metric helps evaluate strategy profitability independent of win rate.",
                    }}
                  >
                    Profit Factor
                  </SortButton>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <SortButton
                    field="kellyFactor"
                    tooltip={{
                      flavor:
                        "Optimal position sizing percentage based on the Kelly Criterion formula using margin-based returns.",
                      detailed:
                        "Kelly Factor (Kelly Percentage) calculates the optimal percentage of capital to allocate per trade based on win rate and return-on-margin ratio. This calculation uses percentage returns relative to margin requirements rather than absolute dollar amounts, making it more appropriate for position sizing. A value of 15% means you should allocate 15% of your capital per trade for maximum growth. Values above 25% are considered aggressive, and the Kelly Criterion assumes infinite capital and perfect knowledge of win probabilities. Many traders use fractional Kelly (e.g., 1/2 Kelly or 1/4 Kelly) to reduce volatility.",
                    }}
                  >
                    Kelly Factor
                  </SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="truncate" title={row.strategy}>
                      {row.strategy}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      {row.trades}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      getPLColor(row.totalPL)
                    )}
                  >
                    {formatCurrency(row.totalPL)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentage(row.winRate)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 dark:text-green-400">
                    {formatCurrency(row.avgWin)}
                  </TableCell>
                  <TableCell className="text-right text-red-600 dark:text-red-400">
                    {formatCurrency(row.avgLoss)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      getProfitFactorColor(row.profitFactor)
                    )}
                  >
                    {row.profitFactor.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatKellyFactor(row.kellyFactor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
