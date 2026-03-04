/**
 * Strategy Profile Schema Definitions
 *
 * Creates and manages the `profiles` schema and `profiles.strategy_profiles` table
 * in the analytics DuckDB database. Provides CRUD utilities for strategy profile storage.
 *
 * Schema: profiles
 * Table: profiles.strategy_profiles
 * Primary Key: (block_id, strategy_name) — composite key allows multiple strategies per block
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import type { StrategyProfile } from "../models/strategy-profile.js";

/**
 * Ensure the profiles schema and strategy_profiles table exist.
 * Safe to call multiple times (CREATE IF NOT EXISTS semantics).
 *
 * @param conn - Active DuckDB connection
 */
export async function ensureProfilesSchema(conn: DuckDBConnection): Promise<void> {
  await conn.run("CREATE SCHEMA IF NOT EXISTS profiles");
  await conn.run(`
    CREATE TABLE IF NOT EXISTS profiles.strategy_profiles (
      block_id VARCHAR NOT NULL,
      strategy_name VARCHAR NOT NULL,
      structure_type VARCHAR NOT NULL,
      greeks_bias VARCHAR NOT NULL,
      thesis TEXT NOT NULL DEFAULT '',
      legs JSON,
      entry_filters JSON,
      exit_rules JSON,
      expected_regimes JSON,
      key_metrics JSON,
      created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
      updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
      PRIMARY KEY (block_id, strategy_name)
    )
  `);
}

/**
 * Escape a single-quoted string for safe inclusion in DuckDB SQL.
 * Doubles any embedded single quotes.
 */
function escSql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Convert a DuckDB row value to a JS Date.
 * DuckDB timestamps may come back as numbers (microseconds since epoch) or Date objects.
 */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "bigint") {
    // DuckDB timestamps are microseconds since Unix epoch
    return new Date(Number(value) / 1000);
  }
  if (typeof value === "number") {
    // May be microseconds or milliseconds depending on DuckDB version
    // Values larger than ~9e12 are likely microseconds
    return value > 9e12 ? new Date(value / 1000) : new Date(value);
  }
  if (typeof value === "string") {
    return new Date(value);
  }
  return new Date();
}

/**
 * Map a DuckDB row array to a StrategyProfile object.
 * Column order must match the SELECT in query functions.
 *
 * Column order: block_id, strategy_name, structure_type, greeks_bias, thesis,
 *               legs, entry_filters, exit_rules, expected_regimes, key_metrics,
 *               created_at, updated_at
 */
function rowToProfile(row: unknown[]): StrategyProfile {
  const parseJson = (v: unknown) => {
    if (v === null || v === undefined) return [];
    if (typeof v === "string") return JSON.parse(v);
    return v; // DuckDB may auto-parse JSON columns
  };

  const parseJsonObj = (v: unknown) => {
    if (v === null || v === undefined) return {};
    if (typeof v === "string") return JSON.parse(v);
    return v;
  };

  return {
    blockId: row[0] as string,
    strategyName: row[1] as string,
    structureType: row[2] as string,
    greeksBias: row[3] as string,
    thesis: row[4] as string,
    legs: parseJson(row[5]),
    entryFilters: parseJson(row[6]),
    exitRules: parseJson(row[7]),
    expectedRegimes: parseJson(row[8]),
    keyMetrics: parseJsonObj(row[9]),
    createdAt: toDate(row[10]),
    updatedAt: toDate(row[11]),
  };
}

const SELECT_COLUMNS = `
  block_id, strategy_name, structure_type, greeks_bias, thesis,
  legs, entry_filters, exit_rules, expected_regimes, key_metrics,
  created_at, updated_at
`.trim();

/**
 * Upsert a strategy profile.
 * If a profile with the same (block_id, strategy_name) exists, it is overwritten.
 * created_at is preserved on update; updated_at is set to the current timestamp.
 *
 * @param conn - Active DuckDB connection
 * @param profile - Profile to insert or update (createdAt/updatedAt are managed by DB)
 * @returns The stored profile with DB-assigned timestamps
 */
export async function upsertProfile(
  conn: DuckDBConnection,
  profile: Omit<StrategyProfile, "createdAt" | "updatedAt">
): Promise<StrategyProfile> {
  const legsJson = escSql(JSON.stringify(profile.legs));
  const entryFiltersJson = escSql(JSON.stringify(profile.entryFilters));
  const exitRulesJson = escSql(JSON.stringify(profile.exitRules));
  const expectedRegimesJson = escSql(JSON.stringify(profile.expectedRegimes));
  const keyMetricsJson = escSql(JSON.stringify(profile.keyMetrics));

  const nowTs = new Date().toISOString().replace("T", " ").replace("Z", "");

  await conn.run(`
    INSERT INTO profiles.strategy_profiles
      (block_id, strategy_name, structure_type, greeks_bias, thesis,
       legs, entry_filters, exit_rules, expected_regimes, key_metrics,
       created_at, updated_at)
    VALUES (
      '${escSql(profile.blockId)}',
      '${escSql(profile.strategyName)}',
      '${escSql(profile.structureType)}',
      '${escSql(profile.greeksBias)}',
      '${escSql(profile.thesis)}',
      '${legsJson}'::JSON,
      '${entryFiltersJson}'::JSON,
      '${exitRulesJson}'::JSON,
      '${expectedRegimesJson}'::JSON,
      '${keyMetricsJson}'::JSON,
      TIMESTAMPTZ '${nowTs}',
      TIMESTAMPTZ '${nowTs}'
    )
    ON CONFLICT (block_id, strategy_name) DO UPDATE SET
      structure_type = excluded.structure_type,
      greeks_bias = excluded.greeks_bias,
      thesis = excluded.thesis,
      legs = excluded.legs,
      entry_filters = excluded.entry_filters,
      exit_rules = excluded.exit_rules,
      expected_regimes = excluded.expected_regimes,
      key_metrics = excluded.key_metrics,
      updated_at = TIMESTAMPTZ '${nowTs}'
  `);

  const stored = await getProfile(conn, profile.blockId, profile.strategyName);
  if (!stored) {
    throw new Error(
      `Failed to retrieve profile after upsert: ${profile.blockId}/${profile.strategyName}`
    );
  }
  return stored;
}

/**
 * Retrieve a single strategy profile by block_id and strategy_name.
 *
 * @param conn - Active DuckDB connection
 * @param blockId - Block identifier
 * @param strategyName - Strategy name
 * @returns The profile, or null if not found
 */
export async function getProfile(
  conn: DuckDBConnection,
  blockId: string,
  strategyName: string
): Promise<StrategyProfile | null> {
  const result = await conn.runAndReadAll(`
    SELECT ${SELECT_COLUMNS}
    FROM profiles.strategy_profiles
    WHERE block_id = '${escSql(blockId)}'
      AND strategy_name = '${escSql(strategyName)}'
  `);
  const rows = result.getRows();
  if (rows.length === 0) return null;
  return rowToProfile(rows[0]);
}

/**
 * List strategy profiles.
 *
 * @param conn - Active DuckDB connection
 * @param blockId - Optional filter; if provided, only profiles for that block are returned
 * @returns Array of matching profiles
 */
export async function listProfiles(
  conn: DuckDBConnection,
  blockId?: string
): Promise<StrategyProfile[]> {
  const whereClause = blockId
    ? `WHERE block_id = '${escSql(blockId)}'`
    : "";

  const result = await conn.runAndReadAll(`
    SELECT ${SELECT_COLUMNS}
    FROM profiles.strategy_profiles
    ${whereClause}
    ORDER BY block_id, strategy_name
  `);

  return result.getRows().map(rowToProfile);
}

/**
 * Delete a strategy profile by block_id and strategy_name.
 *
 * @param conn - Active DuckDB connection
 * @param blockId - Block identifier
 * @param strategyName - Strategy name
 * @returns true if a row was deleted, false if no matching row existed
 */
export async function deleteProfile(
  conn: DuckDBConnection,
  blockId: string,
  strategyName: string
): Promise<boolean> {
  // Check existence before delete so we can return accurate boolean
  const existing = await getProfile(conn, blockId, strategyName);
  if (!existing) return false;

  await conn.run(`
    DELETE FROM profiles.strategy_profiles
    WHERE block_id = '${escSql(blockId)}'
      AND strategy_name = '${escSql(strategyName)}'
  `);

  return true;
}
