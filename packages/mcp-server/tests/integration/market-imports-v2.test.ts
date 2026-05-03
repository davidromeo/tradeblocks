/**
 * Wave D Plan 04-07 — INGEST-01 integration test scaffold.
 *
 * Exercises the rewritten `import_market_csv` and `import_from_database` MCP
 * tool handlers after `target_table` is dropped from the Zod schema (D-22) and
 * the auto-enrich composition (D-23) is wired at the tool-handler level.
 *
 * Pattern (mirrors tests/integration/wave-c-enrichment-contract.test.ts):
 *   - `buildStoreFixture({ parquetMode: false })` — builds an in-memory
 *     DuckDB-mode store bundle. The store's conn is INDEPENDENT of the
 *     singleton connection in src/db/connection.ts, so the tool handler's
 *     `upgradeToReadWrite` / `downgradeToReadOnly` lifecycle (which acts on
 *     `<dataDir>/analytics.duckdb`) does not invalidate the store's conn.
 *   - Tool-handler capture via `makeServer()` mirrors the harness in
 *     `tests/integration/data-pipeline-tools.test.ts:21-31`.
 *
 * The legacy test at `tests/integration/market-import.test.ts` calls the
 * importer functions directly (`importMarketCsvFile(conn, ...)`); this file
 * exercises the MCP tool surface end-to-end so we catch handler-level
 * regressions (RW lifecycle, Zod rejection, auto-enrich composition).
 */
import * as fs from "fs/promises";
import * as path from "path";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import { registerMarketImportTools } from "../../src/tools/market-imports.js";
import {
  closeConnection,
  createMarketStores,
} from "../../src/test-exports.js";
import {
  buildStoreFixture,
  type FixtureHandle,
} from "../fixtures/market-stores/build-fixture.js";
import type { MarketStores } from "../../src/market/stores/index.js";

// ---------------------------------------------------------------------------
// Tool-handler capture harness — same pattern as data-pipeline-tools.test.ts
// ---------------------------------------------------------------------------

interface ToolRegistration {
  inputSchema?: { parse?: (input: unknown) => unknown };
  [k: string]: unknown;
}

type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: Array<
    | { type: "text"; text: string }
    | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }
  >;
  isError?: boolean;
}>;

interface CapturedTool {
  config: ToolRegistration;
  handler: ToolHandler;
}

function makeServer() {
  const tools = new Map<string, CapturedTool>();
  return {
    tools,
    server: {
      registerTool(name: string, config: ToolRegistration, handler: ToolHandler) {
        tools.set(name, { config, handler });
      },
    },
  };
}

function parseToolJson(output: Awaited<ReturnType<ToolHandler>>) {
  const resource = output.content.find((item) => item.type === "resource");
  if (!resource || resource.type !== "resource") {
    // Fall back to text — auto-enrich tools may use plain text + isError
    const text = output.content.find((item) => item.type === "text");
    if (text && text.type === "text") {
      try { return JSON.parse(text.text); } catch { return { text: text.text }; }
    }
    throw new Error("Expected JSON resource payload");
  }
  return JSON.parse(resource.resource.text);
}

function shapeOf(captured: CapturedTool): Record<string, unknown> {
  const schema = captured.config.inputSchema as unknown as {
    shape?: Record<string, unknown>;
    _def?: { shape?: () => Record<string, unknown> };
  };
  const shape =
    schema?.shape ??
    (typeof schema?._def?.shape === "function" ? schema._def.shape() : undefined);
  if (!shape) throw new Error("Could not extract Zod schema shape");
  return shape;
}

// ---------------------------------------------------------------------------
// Fixture CSV — 3 minute bars on 2025-01-02 ET
// ---------------------------------------------------------------------------

const FIXTURE_CSV =
  "date,time,open,high,low,close,volume\n" +
  "2025-01-02,09:30,4700,4705,4699,4702,1000\n" +
  "2025-01-02,09:31,4702,4706,4701,4704,1200\n" +
  "2025-01-02,16:00,4750,4751,4748,4749,1500\n";

const COLUMN_MAPPING_FULL: Record<string, string> = {
  date: "date",
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
};

// ---------------------------------------------------------------------------
// 1. import_market_csv (INGEST-01)
// ---------------------------------------------------------------------------

describe("import_market_csv (INGEST-01)", () => {
  let fixture: FixtureHandle;
  let stores: MarketStores;
  let csvPath: string;

  beforeEach(async () => {
    await closeConnection();
    fixture = await buildStoreFixture({ parquetMode: false });
    stores = createMarketStores(fixture.ctx);
    csvPath = path.join(fixture.ctx.dataDir, "spx.csv");
    await fs.writeFile(csvPath, FIXTURE_CSV);
  });

  afterEach(async () => {
    await closeConnection();
    fixture.cleanup();
  });

  it("Test 1.1 — writes SPX bars via stores.spot (no target_table)", async () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);

    const captured = tools.get("import_market_csv");
    expect(captured).toBeDefined();

    const out = await captured!.handler({
      file_path: csvPath,
      ticker: "SPX",
      column_mapping: COLUMN_MAPPING_FULL,
      dry_run: false,
      skip_enrichment: true, // isolate the spot-write assertion
    });
    if (out.isError) {
      console.error("Test 1.1 unexpected isError:", out.content);
    }
    expect(out.isError).toBeFalsy();

    const coverage = await stores.spot.getCoverage(
      "SPX",
      "2025-01-02",
      "2025-01-02",
    );
    expect(coverage.totalDates).toBe(1);
    expect(coverage.earliest).toBe("2025-01-02");
    expect(coverage.latest).toBe("2025-01-02");

    const bars = await stores.spot.readBars("SPX", "2025-01-02", "2025-01-02");
    expect(bars.length).toBe(3);
  });

  it("Test 1.2 — auto-enrich SPX after import (skip_enrichment=false)", async () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);
    const captured = tools.get("import_market_csv")!;

    const out = await captured.handler({
      file_path: csvPath,
      ticker: "SPX",
      column_mapping: COLUMN_MAPPING_FULL,
      dry_run: false,
      skip_enrichment: false,
    });
    if (out.isError) {
      console.error("Test 1.2 unexpected isError:", out.content);
    }
    expect(out.isError).toBeFalsy();

    const coverage = await stores.spot.getCoverage(
      "SPX",
      "2025-01-02",
      "2025-01-02",
    );
    expect(coverage.totalDates).toBe(1);

    const data = parseToolJson(out);
    expect(data.enrichment).toBeDefined();
    expect(data.enrichment).not.toBeNull();
  });

  it("Test 1.3 — VIX ticker triggers enriched.computeContext", async () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);
    const captured = tools.get("import_market_csv")!;

    const vixCsvPath = path.join(fixture.ctx.dataDir, "vix.csv");
    await fs.writeFile(
      vixCsvPath,
      "date,time,open,high,low,close,volume\n" +
        "2025-01-02,09:30,15.0,15.5,14.9,15.2,0\n" +
        "2025-01-02,16:00,15.3,15.4,15.1,15.2,0\n",
    );

    const out = await captured.handler({
      file_path: vixCsvPath,
      ticker: "VIX",
      column_mapping: COLUMN_MAPPING_FULL,
      dry_run: false,
      skip_enrichment: false,
    });
    if (out.isError) {
      console.error("Test 1.3 unexpected isError:", out.content);
    }
    expect(out.isError).toBeFalsy();

    const data = parseToolJson(out);
    expect(data.enrichment).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. import_market_csv rejects target_table (Zod schema D-22)
// ---------------------------------------------------------------------------

describe("import_market_csv rejects target_table (D-22)", () => {
  let fixture: FixtureHandle;
  let stores: MarketStores;

  beforeEach(async () => {
    await closeConnection();
    fixture = await buildStoreFixture({ parquetMode: false });
    stores = createMarketStores(fixture.ctx);
  });

  afterEach(async () => {
    await closeConnection();
    fixture.cleanup();
  });

  it("Test 2.1 — Zod schema has no `target_table` field for import_market_csv", () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);

    const captured = tools.get("import_market_csv");
    expect(captured).toBeDefined();
    expect(Object.keys(shapeOf(captured!))).not.toContain("target_table");
  });

  it("Test 2.2 — import_from_database also drops target_table", () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);

    const captured = tools.get("import_from_database");
    expect(captured).toBeDefined();
    expect(Object.keys(shapeOf(captured!))).not.toContain("target_table");
  });

});

// ---------------------------------------------------------------------------
// 3. import_from_database (INGEST-01)
// ---------------------------------------------------------------------------

describe("import_from_database (INGEST-01)", () => {
  let fixture: FixtureHandle;
  let stores: MarketStores;
  let extDbPath: string;

  beforeEach(async () => {
    await closeConnection();
    fixture = await buildStoreFixture({ parquetMode: false });
    stores = createMarketStores(fixture.ctx);

    extDbPath = path.join(fixture.ctx.dataDir, "external.duckdb");
    const extInst = await DuckDBInstance.create(extDbPath);
    const extConn = await extInst.connect();
    await extConn.run(
      `CREATE TABLE spx_minute
         (trade_date VARCHAR, trade_time VARCHAR,
          spx_open DOUBLE, spx_high DOUBLE, spx_low DOUBLE, spx_close DOUBLE)`,
    );
    await extConn.run(
      `INSERT INTO spx_minute VALUES
         ('2025-01-02', '09:30', 4700, 4705, 4699, 4702),
         ('2025-01-02', '09:31', 4702, 4706, 4701, 4704),
         ('2025-01-02', '16:00', 4750, 4751, 4748, 4749)`,
    );
    extConn.closeSync();
  });

  afterEach(async () => {
    await closeConnection();
    fixture.cleanup();
  });

  it("Test 3.1 — writes via stores.spot (no target_table)", async () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);

    const captured = tools.get("import_from_database");
    expect(captured).toBeDefined();

    const out = await captured!.handler({
      db_path: extDbPath,
      query:
        "SELECT trade_date, trade_time, spx_open, spx_high, spx_low, spx_close FROM ext_import_source.spx_minute",
      ticker: "SPX",
      column_mapping: {
        trade_date: "date",
        trade_time: "time",
        spx_open: "open",
        spx_high: "high",
        spx_low: "low",
        spx_close: "close",
      },
      dry_run: false,
      skip_enrichment: true,
    });
    if (out.isError) {
      console.error("Test 3.1 unexpected isError:", out.content);
    }
    expect(out.isError).toBeFalsy();

    const coverage = await stores.spot.getCoverage(
      "SPX",
      "2025-01-02",
      "2025-01-02",
    );
    expect(coverage.totalDates).toBe(1);
  });

  it("Test 3.2 — auto-enrich runs after a database import", async () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);
    const captured = tools.get("import_from_database")!;

    const out = await captured.handler({
      db_path: extDbPath,
      query:
        "SELECT trade_date, trade_time, spx_open, spx_high, spx_low, spx_close FROM ext_import_source.spx_minute",
      ticker: "SPX",
      column_mapping: {
        trade_date: "date",
        trade_time: "time",
        spx_open: "open",
        spx_high: "high",
        spx_low: "low",
        spx_close: "close",
      },
      dry_run: false,
      skip_enrichment: false,
    });
    if (out.isError) {
      console.error("Test 3.2 unexpected isError:", out.content);
    }
    expect(out.isError).toBeFalsy();

    const data = parseToolJson(out);
    expect(data.enrichment).toBeDefined();
    expect(data.enrichment).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. dry_run preserves behavior (no writes)
// ---------------------------------------------------------------------------

describe("dry_run preserves behavior", () => {
  let fixture: FixtureHandle;
  let stores: MarketStores;
  let csvPath: string;

  beforeEach(async () => {
    await closeConnection();
    fixture = await buildStoreFixture({ parquetMode: false });
    stores = createMarketStores(fixture.ctx);
    csvPath = path.join(fixture.ctx.dataDir, "spx.csv");
    await fs.writeFile(csvPath, FIXTURE_CSV);
  });

  afterEach(async () => {
    await closeConnection();
    fixture.cleanup();
  });

  it("Test 4.1 — dry_run=true writes nothing; coverage remains empty", async () => {
    const { server, tools } = makeServer();
    registerMarketImportTools(server as never, fixture.ctx.dataDir, stores);
    const captured = tools.get("import_market_csv")!;

    const out = await captured.handler({
      file_path: csvPath,
      ticker: "SPX",
      column_mapping: COLUMN_MAPPING_FULL,
      dry_run: true,
      skip_enrichment: false,
    });
    if (out.isError) {
      console.error("Test 4.1 unexpected isError:", out.content);
    }
    expect(out.isError).toBeFalsy();

    const coverage = await stores.spot.getCoverage(
      "SPX",
      "2025-01-02",
      "2025-01-02",
    );
    expect(coverage.totalDates).toBe(0);
    expect(coverage.earliest).toBeNull();
    expect(coverage.latest).toBeNull();
  });
});
