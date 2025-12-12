"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiCorrelationResult } from "@/lib/analytics/multi-correlation";

const formatPercent = (value: number, digits = 1) =>
  `${value.toFixed(digits)}%`;

export function ClusterExposureTable({
  result,
}: {
  result: MultiCorrelationResult;
}) {
  if (!result.clusters || result.clusters.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">
          No correlation clusters detected.
        </div>
      </div>
    );
  }

  const riskBadge = (weightPct: number, meanCorr: number) => {
    if (weightPct > 35 || meanCorr > 0.6)
      return <Badge variant="destructive">High</Badge>;
    if (weightPct > 25 || meanCorr > 0.4)
      return <Badge variant="outline">Watch</Badge>;
    return <Badge variant="secondary">Safe</Badge>;
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 text-sm font-medium">Cluster Exposure Analysis</div>
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
              <TableCell>
                {riskBadge(c.totalWeightPct, c.meanCorrelation)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
