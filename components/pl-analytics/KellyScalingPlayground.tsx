"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { computeAdvancedKelly } from "@/lib/kelly/computeAdvancedKelly";
import type { KellyScaleResult } from "@/lib/kelly/kellyOptimizerV2";

type StrategyRow = {
  name: string;
  avgFundsPerTrade: number; // Avg % Funds / Trade from realized allocation (baseline)
  pf?: number;
  rom?: number;
  maxMarginUsed?: number;
  clusterCorrelation?: number;
};

interface KellyScalingPlaygroundProps {
  strategies: StrategyRow[];
  baselineMaxDD: number;
  kellyResults?: KellyScaleResult[]; // optional precomputed equity/DD per scale
}

const DEFAULT_SCALES = [0.55, 0.8, 0.85, 0.9, 1];

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function KellyScalingPlayground({ strategies, baselineMaxDD, kellyResults }: KellyScalingPlaygroundProps) {
  // baselineDd is still user-editable; seeded from real equity DD
  const [baselineDd, setBaselineDd] = useState<number>(baselineMaxDD || 0);
  const [selectedScales, setSelectedScales] = useState<number[]>(DEFAULT_SCALES);
  const [customScale, setCustomScale] = useState<string>("0.55");
  const [useAdvancedKelly, setUseAdvancedKelly] = useState(false);

  const parsedCustom = useMemo(() => {
    const n = parseFloat(customScale);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [customScale]);

  const scales = useMemo(() => {
    const merged = [...selectedScales];
    if (parsedCustom !== undefined) merged.push(parsedCustom);
    return Array.from(new Set(merged)).sort((a, b) => a - b);
  }, [parsedCustom, selectedScales]);

  // Baseline weights sourced from realized Avg % Funds / Trade (spec requirement).
  const baselineWeights = useMemo(() => {
    return strategies.reduce<Record<string, number>>((acc, s) => {
      acc[s.name] = s.avgFundsPerTrade ?? 0;
      return acc;
    }, {});
  }, [strategies]);

  // Advanced Kelly weights driven by PF/ROM/margin/correlation (normalized, sum to 100).
  const advancedWeights = useMemo(
    () =>
      computeAdvancedKelly(
        strategies.map((s) => ({
          name: s.name,
          pf: s.pf,
          rom: s.rom,
          maxMarginUsed: s.maxMarginUsed,
          clusterCorrelation: s.clusterCorrelation,
        }))
      ),
    [strategies]
  );

  const activeWeights = useMemo(
    () => (useAdvancedKelly ? advancedWeights : baselineWeights),
    [advancedWeights, baselineWeights, useAdvancedKelly]
  );

  const rows = useMemo(() => {
    return strategies.map((s) => ({
      name: s.name,
      baseline: activeWeights[s.name] ?? 0,
      scaled: scales.map((k) => ({ k, value: (activeWeights[s.name] ?? 0) * k })),
    }));
  }, [activeWeights, scales, strategies]);

  // Use provided Kelly/DD results when available; otherwise fall back to scaled-baseline approximation.
  const kellyRows = useMemo(() => {
    if (kellyResults && kellyResults.length > 0) {
      // Filter to active scales so the table matches the toggle set.
      const allowed = new Set(scales.map((s) => Number(s.toFixed(4))));
      return kellyResults
        .filter((r) => allowed.has(Number(r.scale.toFixed(4))))
        .map((r) => ({
          k: r.scale,
          portfolioKellyPct: r.portfolioKellyPct,
          estMaxDD: r.estMaxDdPct,
        }));
    }
    // Fallback: linear DD scaling from user-entered baseline.
    return scales.map((k) => ({
      k,
      portfolioKellyPct: k * 100,
      estMaxDD: baselineDd * k,
    }));
  }, [baselineDd, kellyResults, scales]);

  const recommendation = useMemo(() => {
    const ddLookup = (k: number) =>
      kellyRows.find((r) => Math.abs(r.k - k) < 1e-6)?.estMaxDD ?? baselineDd * k;

    const hasSweetSpot = scales.some((k) => k >= 0.55 && k <= 0.6);
    if (hasSweetSpot) {
      return `Target Kelly ≈ 0.55–0.60× (Portfolio Kelly 55–60%), expected Max DD ≈ ${fmtPct(
        ddLookup(0.55)
      )} – ${fmtPct(ddLookup(0.6))}.`;
    }
    const smallest = Math.min(...scales);
    return `Safest option: ${smallest.toFixed(2)}× (Portfolio Kelly ${fmtPct(
      smallest * 100
    )}), estimated Max DD ≈ ${fmtPct(ddLookup(smallest))}.`;
  }, [baselineDd, kellyRows, scales]);

  const toggleScale = (k: number) => {
    setSelectedScales((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <CardTitle>Kelly Scaling Playground</CardTitle>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-muted/60"
            title="We treat current realized allocation as 1.0× Kelly and show how allocations and Max DD change when scaling Kelly."
          >
            ?
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Explore how scaling Kelly down changes allocations and drawdown. Baseline is the realized allocation above (1.0×).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Baseline Max DD %</span>
            <Input
              type="number"
              value={baselineDd}
              onChange={(e) => setBaselineDd(Number(e.target.value) || 0)}
              className="h-8 w-24 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Kelly scales</span>
            {DEFAULT_SCALES.map((k) => (
              <Button
                key={k}
                size="sm"
                variant={selectedScales.includes(k) ? "default" : "outline"}
                onClick={() => toggleScale(k)}
              >
                {k.toFixed(2)}×
              </Button>
            ))}
            <Input
              type="number"
              step="0.05"
              value={customScale}
              onChange={(e) => setCustomScale(e.target.value)}
              className="h-8 w-20 text-sm"
              placeholder="0.55"
              title="Add a custom Kelly scale"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Advanced Kelly (PF/ROM/Margin/Correlation)</span>
            <Switch checked={useAdvancedKelly} onCheckedChange={setUseAdvancedKelly} />
          </div>
          <div className="text-xs text-muted-foreground">{recommendation}</div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px] rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="text-muted-foreground">
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right">Baseline (1.0×)</TableHead>
                  {scales.map((k) => (
                    <TableHead key={k} className="text-right">
                      {k.toFixed(2)}×
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtPct(row.baseline)}</TableCell>
                    {row.scaled.map((s) => (
                      <TableCell key={s.k} className="text-right font-mono text-xs">
                        {fmtPct(s.value)}
                      </TableCell>
                    ))}
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
                <TableHead>Kelly scale</TableHead>
                <TableHead className="text-right">Portfolio Kelly</TableHead>
                <TableHead className="text-right">Est. Max DD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kellyRows.map((row) => (
                <TableRow key={row.k}>
                  <TableCell className="font-mono text-xs">{row.k.toFixed(2)}×</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtPct(row.portfolioKellyPct)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtPct(row.estMaxDD)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
