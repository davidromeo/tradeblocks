"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type KellyOptimizerRow = {
  strategy: string;
  portfolioShare: number;
  pf: number;
  rom: number;
  maxCapitalUsed: number;
};

interface KellyOptimizerProps {
  strategies: KellyOptimizerRow[];
  baselineMaxDD: number; // %
}

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function KellyOptimizer({ strategies, baselineMaxDD }: KellyOptimizerProps) {
  const [portfolioKelly, setPortfolioKelly] = useState<number>(0.55); // 55%
  const [baseMaxDd, setBaseMaxDd] = useState<number>(baselineMaxDD || 0);

  // Simple heuristic multipliers based on PF and ROM% + margin spike penalty
  const rows = useMemo(() => {
    return strategies.map((s) => {
      const pfScore = Math.max(0.4, Math.min(1.4, s.pf / 1.8)); // normalize PF around 1.8
      const romScore = Math.max(0.4, Math.min(1.4, s.rom / 20)); // normalize ROM around 20%
      const baseKelly = 0.08 * (pfScore + romScore); // around 8% when both are ~1.0

      // Margin spike penalty: if max capital used is >10% of funds, taper down
      const marginPenalty = s.maxCapitalUsed > 0 ? Math.max(0.4, Math.min(1, 1 - s.maxCapitalUsed / 200000)) : 1;

      const effectiveKelly = baseKelly * marginPenalty;
      const finalKelly = effectiveKelly * portfolioKelly; // apply portfolio Kelly fraction

      return {
        ...s,
        baseKelly: baseKelly * 100,
        effectiveKelly: effectiveKelly * 100,
        finalKelly: finalKelly * 100,
      };
    });
  }, [portfolioKelly, strategies]);

  const portfolioDd = useMemo(() => ({
    current: baseMaxDd,
    scaled: baseMaxDd * portfolioKelly,
  }), [baseMaxDd, portfolioKelly]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <CardTitle>Kelly Optimizer (Advanced)</CardTitle>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-muted/60"
            title="Incorporates PF, ROM%, and margin spikes to suggest Kelly multipliers per strategy. Then applies a portfolio Kelly fraction."
          >
            ?
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          PF and ROM% drive the raw Kelly. Margin spikes taper it down. Portfolio Kelly scales all strategies together.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Baseline Max DD %</span>
            <Input
              type="number"
              value={baseMaxDd}
              onChange={(e) => setBaseMaxDd(Number(e.target.value) || 0)}
              className="h-8 w-24 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Portfolio Kelly</span>
            <Input
              type="number"
              step="0.05"
              value={portfolioKelly}
              onChange={(e) => setPortfolioKelly(Number(e.target.value) || 0)}
              className="h-8 w-24 text-sm"
              title="Portfolio Kelly fraction (e.g., 0.55 = 55%)"
            />
            <span className="text-xs text-muted-foreground">
              Est. Max DD ≈ {fmtPct(portfolioDd.scaled)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[860px] rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="text-muted-foreground">
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">ROM%</TableHead>
                  <TableHead className="text-right">Margin spike</TableHead>
                  <TableHead className="text-right">Base Kelly</TableHead>
                  <TableHead className="text-right">After margin</TableHead>
                  <TableHead className="text-right">Final (portfolio Kelly)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.strategy}>
                    <TableCell className="font-medium">{row.strategy}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.pf === Infinity ? "∞" : row.pf.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.rom.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtPct(Math.min(100, (row.maxCapitalUsed / 1000000) * 100))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtPct(row.baseKelly)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtPct(row.effectiveKelly)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", row.finalKelly >= 0 ? "text-emerald-300" : "")}>
                      {fmtPct(row.finalKelly)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="text-muted-foreground">
                <TableHead>Portfolio Kelly</TableHead>
                <TableHead className="text-right">Est. Max DD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">{fmtPct(portfolioKelly * 100)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmtPct(portfolioDd.scaled)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
