/**
 * Strategy Definition Types
 *
 * TypeScript type re-exports for strategy definitions used by the backtesting engine.
 * The authoritative Zod schemas (and their inferred types) live in utils/strategy-schema.ts.
 * This module re-exports them at the model layer for convenient imports across the codebase.
 *
 * @see utils/strategy-schema.ts for Zod schema definitions
 */

export type {
  StrategyDefinition,
  LegDefinition,
  StrikeSpec,
  PositionSizing,
  EntryRules,
} from "../utils/strategy-schema.js";
