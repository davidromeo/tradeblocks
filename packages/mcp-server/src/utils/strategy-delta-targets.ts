import type { StrategyDefinition, StrikeSpec } from "./strategy-schema.js";

export function getLegStrikeSpec(
  leg: StrategyDefinition["legs"][number],
): StrikeSpec | null {
  return ((leg as unknown as {
    strike_spec?: StrikeSpec;
    strike_selection?: StrikeSpec;
  }).strike_spec
    ?? (leg as unknown as {
      strike_spec?: StrikeSpec;
      strike_selection?: StrikeSpec;
    }).strike_selection
    ?? null);
}

export function deltaTargetBasisPoints(value: number): number {
  return Math.max(1, Math.min(99, Math.round(Math.abs(value) * 100)));
}

export function strategyHasDeltaLegs(strategy: StrategyDefinition): boolean {
  return strategy.legs.some((leg) => getLegStrikeSpec(leg)?.method === "delta");
}

export function collectStrategyDeltaTargetBps(strategy: StrategyDefinition): number[] {
  const targets = new Set<number>();
  for (const leg of strategy.legs) {
    const strikeSpec = getLegStrikeSpec(leg);
    if (strikeSpec?.method !== "delta") continue;
    targets.add(deltaTargetBasisPoints(strikeSpec.target));
  }
  return [...targets].sort((a, b) => a - b);
}

export function collectStrategiesDeltaTargetBps(strategies: StrategyDefinition[]): number[] {
  const targets = new Set<number>();
  for (const strategy of strategies) {
    for (const target of collectStrategyDeltaTargetBps(strategy)) {
      targets.add(target);
    }
  }
  return [...targets].sort((a, b) => a - b);
}
