/**
 * Strategy Profile Types
 *
 * TypeScript interfaces for strategy profiles stored in DuckDB.
 * Profiles capture the full definition of a trading strategy including
 * structure, greeks bias, legs, entry/exit rules, and performance benchmarks.
 */

export interface PositionSizing {
  method: string;              // "pct_of_portfolio" | "fixed_contracts" | "fixed_dollar" | "discretionary"
  allocationPct?: number;      // e.g., 2, 10
  maxContracts?: number;       // hard cap per trade
  maxAllocationDollar?: number; // hard dollar cap per trade
  maxOpenPositions?: number;   // concurrency limit
  description?: string;        // free text for anything unusual
}

export interface StrategyProfile {
  blockId: string;
  strategyName: string;
  structureType: string;        // e.g., "iron_condor", "calendar_spread", "reverse_iron_condor"
  greeksBias: string;           // e.g., "theta_positive", "vega_negative", "delta_neutral"
  thesis: string;               // Free-text description of the strategy thesis
  legs: LegDetail[];            // Structured leg descriptions
  entryFilters: EntryFilter[];  // Conditions for entry
  exitRules: ExitRule[];        // Exit criteria
  expectedRegimes: string[];    // Market regimes this strategy targets
  keyMetrics: KeyMetrics;       // Performance benchmarks
  positionSizing?: PositionSizing; // Per-block position sizing rules
  createdAt: Date;
  updatedAt: Date;
}

export interface LegDetail {
  type: string;     // "long_put", "short_call", etc.
  strike: string;   // Relative description: "ATM", "5-delta", "30-delta"
  expiry: string;   // Relative: "same-day", "weekly", "45-DTE"
  quantity: number; // Positive = long, negative = short
}

export interface EntryFilter {
  field: string;       // e.g., "VIX_Close", "RSI_14", "Vol_Regime"
  operator: string;    // ">", "<", ">=", "<=", "==", "between", "in"
  value: string | number | (string | number)[];
  description?: string;
}

export interface ExitRule {
  type: string;        // "stop_loss", "profit_target", "time_exit", "conditional"
  trigger: string;     // e.g., "200% of credit", "50% of max profit", "15:00 ET"
  description?: string;
}

export interface KeyMetrics {
  expectedWinRate?: number;     // 0-1
  targetPremium?: number;       // Dollar amount
  maxLoss?: number;             // Dollar amount per contract
  profitTarget?: number;        // Dollar amount or percentage
  [key: string]: unknown;       // Extensible for strategy-specific metrics
}

/**
 * Row type matching DuckDB column layout (for internal DB operations).
 * JSON columns are stored as strings, timestamps as Date objects.
 */
export interface StrategyProfileRow {
  block_id: string;
  strategy_name: string;
  structure_type: string;
  greeks_bias: string;
  thesis: string;
  legs: string;             // JSON string
  entry_filters: string;    // JSON string
  exit_rules: string;       // JSON string
  expected_regimes: string; // JSON string
  key_metrics: string;      // JSON string
  position_sizing: string;  // JSON string
  created_at: Date;
  updated_at: Date;
}
