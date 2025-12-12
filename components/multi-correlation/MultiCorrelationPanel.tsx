"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";

import {
  analyzeMultiCorrelation,
  CorrelationMethod,
  MultiCorrelationResult,
  StrategySeries,
} from "@/lib/analytics/multi-correlation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MultiCorrelationPanelProps {
  series: StrategySeries[];
  initialMethod?: CorrelationMethod;
}

const formatPercent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

const getCorrelationBadge = (corr: number) => {
  const abs = Math.abs(corr);
  if (abs < 0.3) return { label: "Low", variant: "secondary" as const };
  if (abs < 0.6) return { label: "Moderate", variant: "outline" as const };
  return { label: "High", variant: "destructive" as const };
};

const correlationToColor = (value: number, isDark: boolean) => {
  const v = Math.max(-1, Math.min(1, value));
  const lerp = (start: number[], end: number[], t: number) =>
    start.map((s, i) => Math.round(s + (end[i] - s) * t));

  if (v === 0) {
    const neutral = isDark ? [31, 41, 55] : [241, 245, 249];
    return `rgba(${neutral[0]}, ${neutral[1]}, ${neutral[2]}, 0.95)`;
  }

  if (v < 0) {
    const t = Math.abs(v);
    const start = isDark ? [59, 130, 246] : [224, 242, 254]; // blue-500 vs light blue
    const end = isDark ? [30, 64, 175] : [37, 99, 235]; // blue-800 vs blue-600
    const [r, g, b] = lerp(start, end, t);
    return `rgba(${r}, ${g}, ${b}, 0.95)`;
  }

  const t = v;
  const start = isDark ? [248, 113, 113] : [254, 226, 226]; // red-400 vs light red
  const end = isDark ? [127, 29, 29] : [185, 28, 28]; // deep red
  const [r, g, b] = lerp(start, end, t);
  return `rgba(${r}, ${g}, ${b}, 0.95)`;
};

const scoreBarClass = "h-2 rounded-full bg-muted overflow-hidden";

const renderScoreBar = (score: number) => (
  <div className={scoreBarClass}>
    <div
      className="h-full bg-emerald-500"
      style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
    />
  </div>
);

const WarningList = ({ warnings }: { warnings: string[] }) => {
  if (warnings.length === 0) return null;
  return (
    <Alert variant="destructive" className="space-y-2">
      <AlertTitle>Warnings</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {warnings.map((w, idx) => (
            <li key={idx}>{w}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

const MetricsRow = ({ result }: { result: MultiCorrelationResult }) => {
  const corrBadge = getCorrelationBadge(result.portfolioCorrelation);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Portfolio Correlation</div>
          <Badge variant={corrBadge.variant}>{corrBadge.label}</Badge>
        </div>
        <div className="mt-2 text-2xl font-semibold">
          {formatPercent(result.portfolioCorrelation * 100, 1)}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Diversification Score</div>
          <Badge variant="secondary">{result.diversificationScore.toFixed(0)} / 100</Badge>
        </div>
        <div className="mt-3">{renderScoreBar(result.diversificationScore)}</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">Clusters</div>
        <div className="mt-2 text-2xl font-semibold">{result.clusters.length}</div>
      </div>
    </div>
  );
};

const CorrelationMatrixTable = ({ result }: { result: MultiCorrelationResult }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { strategies, correlationMatrix } = result;
  if (strategies.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 text-sm font-medium">Multi Correlation Matrix</div>
      <div className="overflow-auto">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-muted-foreground">Strategy</th>
              {strategies.map((s) => (
                <th
                  key={s}
                  className="min-w-[90px] p-2 text-center align-bottom text-muted-foreground"
                >
                  <div className="origin-bottom-left -rotate-45 whitespace-nowrap text-[11px] leading-4">
                    {s}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategies.map((rowStrategy, i) => (
              <tr key={rowStrategy} className="border-t">
                <td className="p-2 text-left font-medium">{rowStrategy}</td>
                {strategies.map((colStrategy, j) => {
                  if (i === j) {
                    return (
                      <td key={colStrategy} className="p-2 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  const value = correlationMatrix[i][j] ?? 0;
                  const bg = correlationToColor(value, isDark);
                  const textClass = isDark ? "text-white" : "text-slate-900";
                  return (
                    <td key={colStrategy} className="p-1 text-center">
                      <div
                        className={`rounded px-2 py-1 ${textClass}`}
                        style={{ backgroundColor: bg }}
                        title={`${rowStrategy} ↔ ${colStrategy}: ${value.toFixed(2)}`}
                      >
                        {value.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ClusterTable = ({ result }: { result: MultiCorrelationResult }) => {
  if (result.clusters.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">No clusters detected.</div>
      </div>
    );
  }

  const riskBadge = (weightPct: number, meanCorr: number) => {
    if (weightPct > 35 || meanCorr > 0.6) return <Badge variant="destructive">High</Badge>;
    if (weightPct > 25 || meanCorr > 0.4) return <Badge variant="outline">Watch</Badge>;
    return <Badge variant="secondary">Safe</Badge>;
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 text-sm font-medium">Cluster Exposure</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cluster</TableHead>
            <TableHead>Strategies</TableHead>
            <TableHead>Total Weight</TableHead>
            <TableHead>Mean |corr|</TableHead>
            <TableHead>Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.clusterExposures.map((c) => (
            <TableRow key={c.clusterId}>
              <TableCell className="font-medium">{c.clusterId}</TableCell>
              <TableCell className="whitespace-normal text-xs">
                {c.strategyIds.join(", ")}
              </TableCell>
              <TableCell>{formatPercent(c.totalWeightPct, 1)}</TableCell>
              <TableCell>{c.meanCorrelation.toFixed(2)}</TableCell>
              <TableCell>{riskBadge(c.totalWeightPct, c.meanCorrelation)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export function MultiCorrelationPanel({ series, initialMethod }: MultiCorrelationPanelProps) {
  const [method, setMethod] = useState<CorrelationMethod>(initialMethod ?? "pearson");
  const [clusterThreshold, setClusterThreshold] = useState(0.4);

  const result = useMemo(
    () => analyzeMultiCorrelation(series, { method, clusterThreshold }),
    [series, method, clusterThreshold]
  );

  const thresholdDisplay = clusterThreshold.toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Correlation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Correlation Method</div>
            <Select value={method} onValueChange={(val) => setMethod(val as CorrelationMethod)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pearson">Pearson</SelectItem>
                <SelectItem value="kendall">Kendall</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Cluster Threshold</span>
              <span className="text-muted-foreground">{thresholdDisplay}</span>
            </div>
            <Slider
              min={0.2}
              max={0.8}
              step={0.05}
              value={[clusterThreshold]}
              onValueChange={(vals) => setClusterThreshold(vals[0])}
            />
          </div>
        </div>

        <MetricsRow result={result} />

        <div className="space-y-4">
          <CorrelationMatrixTable result={result} />
          <ClusterTable result={result} />
        </div>

        <WarningList warnings={result.warnings} />
      </CardContent>
    </Card>
  );
}

export default MultiCorrelationPanel;
