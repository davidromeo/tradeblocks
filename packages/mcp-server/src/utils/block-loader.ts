/**
 * Block Data Loader
 *
 * Utilities for loading and managing block data from folder-based structure.
 * Blocks are directories containing tradelog.csv (required) and optional dailylog.csv.
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { Trade } from "@lib/models/trade";
import type { DailyLogEntry } from "@lib/models/daily-log";
import type { ReportingTrade } from "@lib/models/reporting-trade";
import { REPORTING_TRADE_COLUMN_ALIASES } from "@lib/models/reporting-trade";

/**
 * Block metadata stored in .block.json
 */
export interface BlockMetadata {
  blockId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tradeCount: number;
  dailyLogCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  strategies: string[];
  cachedStats?: {
    totalPl: number;
    netPl: number;
    winRate: number;
    sharpeRatio?: number;
    maxDrawdown: number;
    calculatedAt: string;
  };
}

/**
 * Block info summary for listing
 */
export interface BlockInfo {
  blockId: string;
  name: string;
  tradeCount: number;
  hasDailyLog: boolean;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  strategies: string[];
  totalPl: number;
  netPl: number;
}

/**
 * Loaded block data
 */
export interface LoadedBlock {
  blockId: string;
  trades: Trade[];
  dailyLogs?: DailyLogEntry[];
  metadata?: BlockMetadata;
}

/**
 * Parse a YYYY-MM-DD date string preserving the calendar date.
 * Same approach as lib/processing for consistency.
 */
function parseDatePreservingCalendarDay(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return new Date(dateStr);
}

/**
 * Parse numeric value from CSV string
 */
function parseNumber(
  value: string | undefined,
  defaultValue?: number
): number {
  if (!value || value.trim() === "" || value.toLowerCase() === "nan") {
    if (defaultValue !== undefined) return defaultValue;
    return 0;
  }
  const cleaned = value.replace(/[$,%]/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue ?? 0 : parsed;
}

/**
 * Parse CSV content into array of record objects
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || "";
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Convert raw CSV record to Trade object
 */
function convertToTrade(raw: Record<string, string>): Trade | null {
  try {
    const dateOpened = parseDatePreservingCalendarDay(raw["Date Opened"]);
    if (isNaN(dateOpened.getTime())) return null;

    const dateClosed = raw["Date Closed"]
      ? parseDatePreservingCalendarDay(raw["Date Closed"])
      : undefined;

    const strategy = (raw["Strategy"] || "").trim() || "Unknown";

    const rawPremium = (raw["Premium"] || "").replace(/[$,]/g, "").trim();
    const premiumPrecision: Trade["premiumPrecision"] =
      rawPremium && !rawPremium.includes(".") ? "cents" : "dollars";

    return {
      dateOpened,
      timeOpened: raw["Time Opened"] || "00:00:00",
      openingPrice: parseNumber(raw["Opening Price"]),
      legs: raw["Legs"] || "",
      premium: parseNumber(raw["Premium"]),
      premiumPrecision,
      closingPrice: raw["Closing Price"]
        ? parseNumber(raw["Closing Price"])
        : undefined,
      dateClosed,
      timeClosed: raw["Time Closed"] || undefined,
      avgClosingCost: raw["Avg. Closing Cost"]
        ? parseNumber(raw["Avg. Closing Cost"])
        : undefined,
      reasonForClose: raw["Reason For Close"] || undefined,
      pl: parseNumber(raw["P/L"]),
      numContracts: Math.round(parseNumber(raw["No. of Contracts"], 1)),
      fundsAtClose: parseNumber(raw["Funds at Close"]),
      marginReq: parseNumber(raw["Margin Req."]),
      strategy,
      openingCommissionsFees: parseNumber(
        raw["Opening Commissions + Fees"] || raw["Opening comms & fees"],
        0
      ),
      closingCommissionsFees: parseNumber(
        raw["Closing Commissions + Fees"] || raw["Closing comms & fees"],
        0
      ),
      openingShortLongRatio: parseNumber(raw["Opening Short/Long Ratio"], 0),
      closingShortLongRatio: raw["Closing Short/Long Ratio"]
        ? parseNumber(raw["Closing Short/Long Ratio"])
        : undefined,
      openingVix: raw["Opening VIX"]
        ? parseNumber(raw["Opening VIX"])
        : undefined,
      closingVix: raw["Closing VIX"]
        ? parseNumber(raw["Closing VIX"])
        : undefined,
      gap: raw["Gap"] ? parseNumber(raw["Gap"]) : undefined,
      movement: raw["Movement"] ? parseNumber(raw["Movement"]) : undefined,
      maxProfit: raw["Max Profit"]
        ? parseNumber(raw["Max Profit"])
        : undefined,
      maxLoss: raw["Max Loss"] ? parseNumber(raw["Max Loss"]) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Convert raw CSV record to DailyLogEntry object
 */
function convertToDailyLogEntry(
  raw: Record<string, string>,
  blockId?: string
): DailyLogEntry | null {
  try {
    const date = parseDatePreservingCalendarDay(raw["Date"]);
    if (isNaN(date.getTime())) return null;

    return {
      date,
      netLiquidity: parseNumber(raw["Net Liquidity"]),
      currentFunds: parseNumber(raw["Current Funds"]),
      withdrawn: parseNumber(raw["Withdrawn"], 0),
      tradingFunds: parseNumber(raw["Trading Funds"]),
      dailyPl: parseNumber(raw["P/L"]),
      dailyPlPct: parseNumber(raw["P/L %"]),
      drawdownPct: parseNumber(raw["Drawdown %"]),
      blockId,
    };
  } catch {
    return null;
  }
}

/**
 * Load trades from tradelog.csv
 */
async function loadTrades(blockPath: string): Promise<Trade[]> {
  const tradelogPath = path.join(blockPath, "tradelog.csv");
  const content = await fs.readFile(tradelogPath, "utf-8");
  const records = parseCSV(content);

  const trades: Trade[] = [];
  for (const record of records) {
    const trade = convertToTrade(record);
    if (trade) {
      trades.push(trade);
    }
  }

  // Sort by date and time
  trades.sort((a, b) => {
    const dateCompare =
      new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.timeOpened.localeCompare(b.timeOpened);
  });

  return trades;
}

/**
 * Load daily logs from dailylog.csv (optional)
 */
async function loadDailyLogs(
  blockPath: string,
  blockId: string
): Promise<DailyLogEntry[] | undefined> {
  const dailylogPath = path.join(blockPath, "dailylog.csv");

  try {
    await fs.access(dailylogPath);
    const content = await fs.readFile(dailylogPath, "utf-8");
    const records = parseCSV(content);

    const entries: DailyLogEntry[] = [];
    for (const record of records) {
      const entry = convertToDailyLogEntry(record, blockId);
      if (entry) {
        entries.push(entry);
      }
    }

    // Sort by date
    entries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return entries.length > 0 ? entries : undefined;
  } catch {
    // Daily log doesn't exist - that's fine
    return undefined;
  }
}

/**
 * Load block metadata from .block.json
 */
export async function loadMetadata(
  blockPath: string
): Promise<BlockMetadata | undefined> {
  const metadataPath = path.join(blockPath, ".block.json");

  try {
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content) as BlockMetadata;
  } catch {
    return undefined;
  }
}

/**
 * Save block metadata to .block.json
 */
export async function saveMetadata(
  blockPath: string,
  metadata: BlockMetadata
): Promise<void> {
  const metadataPath = path.join(blockPath, ".block.json");
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}

/**
 * Load a complete block (trades + optional daily logs)
 */
export async function loadBlock(
  baseDir: string,
  blockId: string
): Promise<LoadedBlock> {
  const blockPath = path.join(baseDir, blockId);

  // Verify block exists and has tradelog.csv
  const tradelogPath = path.join(blockPath, "tradelog.csv");
  try {
    await fs.access(tradelogPath);
  } catch {
    throw new Error(`Block not found or missing tradelog.csv: ${blockId}`);
  }

  const trades = await loadTrades(blockPath);
  const dailyLogs = await loadDailyLogs(blockPath, blockId);
  const metadata = await loadMetadata(blockPath);

  return {
    blockId,
    trades,
    dailyLogs,
    metadata,
  };
}

/**
 * List all valid blocks in the base directory
 */
export async function listBlocks(baseDir: string): Promise<BlockInfo[]> {
  const blocks: BlockInfo[] = [];

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue; // Skip hidden folders

      const blockPath = path.join(baseDir, entry.name);
      const tradelogPath = path.join(blockPath, "tradelog.csv");
      const dailylogPath = path.join(blockPath, "dailylog.csv");

      // Check if tradelog.csv exists (required)
      try {
        await fs.access(tradelogPath);
      } catch {
        continue; // Not a valid block folder
      }

      // Check if dailylog.csv exists (optional)
      let hasDailyLog = false;
      try {
        await fs.access(dailylogPath);
        hasDailyLog = true;
      } catch {
        // No daily log - that's fine
      }

      // Try to load metadata first for cached info
      const metadata = await loadMetadata(blockPath);

      if (metadata) {
        blocks.push({
          blockId: entry.name,
          name: metadata.name || entry.name,
          tradeCount: metadata.tradeCount,
          hasDailyLog,
          dateRange: {
            start: metadata.dateRange.start
              ? new Date(metadata.dateRange.start)
              : null,
            end: metadata.dateRange.end
              ? new Date(metadata.dateRange.end)
              : null,
          },
          strategies: metadata.strategies,
          totalPl: metadata.cachedStats?.totalPl ?? 0,
          netPl: metadata.cachedStats?.netPl ?? 0,
        });
      } else {
        // Load trades to get basic info
        try {
          const trades = await loadTrades(blockPath);
          const strategies = Array.from(
            new Set(trades.map((t) => t.strategy))
          ).sort();
          const dates = trades.map((t) => new Date(t.dateOpened).getTime());
          const totalPl = trades.reduce((sum, t) => sum + t.pl, 0);
          const totalCommissions = trades.reduce(
            (sum, t) =>
              sum + t.openingCommissionsFees + t.closingCommissionsFees,
            0
          );

          blocks.push({
            blockId: entry.name,
            name: entry.name,
            tradeCount: trades.length,
            hasDailyLog,
            dateRange: {
              start: dates.length > 0 ? new Date(Math.min(...dates)) : null,
              end: dates.length > 0 ? new Date(Math.max(...dates)) : null,
            },
            strategies,
            totalPl,
            netPl: totalPl - totalCommissions,
          });
        } catch (error) {
          console.error(`Error loading block ${entry.name}:`, error);
        }
      }
    }

    // Sort by name
    blocks.sort((a, b) => a.name.localeCompare(b.name));

    return blocks;
  } catch (error) {
    throw new Error(`Failed to list blocks: ${(error as Error).message}`);
  }
}

/**
 * Normalize header names using column aliases
 */
function normalizeRecordHeaders(
  raw: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = { ...raw };
  Object.entries(REPORTING_TRADE_COLUMN_ALIASES).forEach(
    ([alias, canonical]) => {
      if (normalized[alias] !== undefined) {
        normalized[canonical] = normalized[alias];
        delete normalized[alias];
      }
    }
  );
  return normalized;
}

/**
 * Convert raw CSV record to ReportingTrade object
 */
function convertToReportingTrade(
  raw: Record<string, string>
): ReportingTrade | null {
  try {
    const normalized = normalizeRecordHeaders(raw);

    const dateOpened = parseDatePreservingCalendarDay(normalized["Date Opened"]);
    if (isNaN(dateOpened.getTime())) return null;

    const dateClosed = normalized["Date Closed"]
      ? parseDatePreservingCalendarDay(normalized["Date Closed"])
      : undefined;

    const strategy = (normalized["Strategy"] || "").trim() || "Unknown";

    return {
      strategy,
      dateOpened,
      timeOpened: normalized["Time Opened"] || undefined,
      openingPrice: parseNumber(normalized["Opening Price"]),
      legs: normalized["Legs"] || "",
      initialPremium: parseNumber(normalized["Initial Premium"]),
      numContracts: parseNumber(normalized["No. of Contracts"], 1),
      pl: parseNumber(normalized["P/L"]),
      closingPrice: normalized["Closing Price"]
        ? parseNumber(normalized["Closing Price"])
        : undefined,
      dateClosed,
      timeClosed: normalized["Time Closed"] || undefined,
      avgClosingCost: normalized["Avg. Closing Cost"]
        ? parseNumber(normalized["Avg. Closing Cost"])
        : undefined,
      reasonForClose: normalized["Reason For Close"] || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Load reporting log (actual trades) from reportinglog.csv
 * @throws Error if reportinglog.csv does not exist
 */
export async function loadReportingLog(
  baseDir: string,
  blockId: string
): Promise<ReportingTrade[]> {
  const blockPath = path.join(baseDir, blockId);
  const reportingLogPath = path.join(blockPath, "reportinglog.csv");

  // Check if file exists - throw if not
  try {
    await fs.access(reportingLogPath);
  } catch {
    throw new Error(`reportinglog.csv not found in block: ${blockId}`);
  }

  const content = await fs.readFile(reportingLogPath, "utf-8");
  const records = parseCSV(content);

  const trades: ReportingTrade[] = [];
  for (const record of records) {
    const trade = convertToReportingTrade(record);
    if (trade) {
      trades.push(trade);
    }
  }

  // Sort by date
  trades.sort(
    (a, b) =>
      new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
  );

  return trades;
}

/**
 * Import CSV result
 */
export interface ImportCsvResult {
  blockId: string;
  name: string;
  recordCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  strategies: string[];
  blockPath: string;
}

/**
 * Import CSV options
 */
export interface ImportCsvOptions {
  /** Absolute path to the CSV file (for local filesystem access) */
  csvPath?: string;
  /** CSV content as a string (for sandboxed environments) */
  csvContent?: string;
  /** Custom name for the block */
  blockName?: string;
  /** Type of CSV data */
  csvType?: "tradelog" | "dailylog" | "reportinglog";
}

/**
 * Convert a string to kebab-case for blockId
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2") // camelCase to kebab-case
    .replace(/[\s_]+/g, "-") // spaces and underscores to hyphens
    .replace(/[^a-zA-Z0-9-]/g, "") // remove special characters
    .toLowerCase()
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

/**
 * Validate CSV has required columns for the specified type
 */
function validateCsvColumns(
  records: Record<string, string>[],
  csvType: "tradelog" | "dailylog" | "reportinglog"
): { valid: boolean; error?: string } {
  if (records.length === 0) {
    return { valid: false, error: "CSV file is empty or has no data rows" };
  }

  const headers = Object.keys(records[0]);

  switch (csvType) {
    case "tradelog": {
      // Required columns for trade log
      const required = ["Date Opened", "P/L"];
      const missing = required.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        return {
          valid: false,
          error: `Missing required columns for tradelog: ${missing.join(", ")}. Expected columns include: Date Opened, P/L, Strategy, Legs, etc.`,
        };
      }
      break;
    }
    case "dailylog": {
      // Required columns for daily log
      const required = ["Date", "Net Liquidity"];
      const missing = required.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        return {
          valid: false,
          error: `Missing required columns for dailylog: ${missing.join(", ")}. Expected columns include: Date, Net Liquidity, P/L, etc.`,
        };
      }
      break;
    }
    case "reportinglog": {
      // Required columns for reporting log (with aliases)
      const dateOpenedAliases = ["Date Opened", "date_opened"];
      const plAliases = ["P/L", "pl"];
      const hasDateOpened = dateOpenedAliases.some((col) =>
        headers.includes(col)
      );
      const hasPl = plAliases.some((col) => headers.includes(col));
      const missing: string[] = [];
      if (!hasDateOpened) missing.push("Date Opened");
      if (!hasPl) missing.push("P/L");
      if (missing.length > 0) {
        return {
          valid: false,
          error: `Missing required columns for reportinglog: ${missing.join(", ")}. Expected columns include: Date Opened (or date_opened), P/L (or pl), Strategy, etc.`,
        };
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * Import a CSV file into the blocks directory
 *
 * Supports two modes:
 * - csvPath: Read from local filesystem (for Claude Desktop, Claude Code)
 * - csvContent: Accept CSV string directly (for sandboxed environments like Claude.ai, Cowork)
 *
 * @param baseDir - Base directory for blocks
 * @param options - Import options including csvPath OR csvContent, blockName, csvType
 * @returns Import result with block info
 */
export async function importCsv(
  baseDir: string,
  options: ImportCsvOptions = {}
): Promise<ImportCsvResult> {
  const { csvPath, csvContent, blockName, csvType = "tradelog" } = options;

  // Validate that either csvPath or csvContent is provided
  if (!csvPath && !csvContent) {
    throw new Error(
      "Either csvPath or csvContent is required. Use csvContent when working in sandboxed environments."
    );
  }

  // Get CSV content - either from file or directly provided
  let content: string;
  let derivedFilename: string;

  if (csvPath) {
    // Mode 1: Read from filesystem
    try {
      await fs.access(csvPath);
    } catch {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    content = await fs.readFile(csvPath, "utf-8");
    derivedFilename = path.basename(csvPath, path.extname(csvPath));
  } else {
    // Mode 2: Content provided directly
    content = csvContent!;
    derivedFilename = ""; // Will require blockName
  }

  // Parse the CSV content
  const records = parseCSV(content);

  // Validate CSV has required columns
  const validation = validateCsvColumns(records, csvType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Derive blockId from blockName or filename
  const name = blockName || derivedFilename;
  if (!name) {
    throw new Error(
      "blockName is required when using csvContent (no filename to derive name from)"
    );
  }
  const blockId = toKebabCase(name);

  if (!blockId) {
    throw new Error(
      "Could not derive a valid block ID from the filename or provided name"
    );
  }

  // Check if block already exists
  const blockPath = path.join(baseDir, blockId);
  try {
    await fs.access(blockPath);
    throw new Error(
      `Block "${blockId}" already exists. Use a different blockName or delete the existing block first.`
    );
  } catch (error) {
    // Directory doesn't exist - good, we can create it
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error; // Re-throw if it's not a "not found" error
    }
  }

  // Create block directory
  await fs.mkdir(blockPath, { recursive: true });

  // Determine target filename
  const targetFilename =
    csvType === "tradelog"
      ? "tradelog.csv"
      : csvType === "dailylog"
        ? "dailylog.csv"
        : "reportinglog.csv";

  // Write CSV to block directory (either copy file or write content)
  const targetPath = path.join(blockPath, targetFilename);
  if (csvPath) {
    await fs.copyFile(csvPath, targetPath);
  } else {
    await fs.writeFile(targetPath, content, "utf-8");
  }

  // Extract metadata based on CSV type
  let dateRange: { start: string | null; end: string | null } = {
    start: null,
    end: null,
  };
  let strategies: string[] = [];

  if (csvType === "tradelog") {
    // Parse trades to extract metadata
    const trades: Trade[] = [];
    for (const record of records) {
      const trade = convertToTrade(record);
      if (trade) trades.push(trade);
    }

    if (trades.length > 0) {
      const dates = trades.map((t) => new Date(t.dateOpened).getTime());
      dateRange = {
        start: new Date(Math.min(...dates)).toISOString(),
        end: new Date(Math.max(...dates)).toISOString(),
      };
      strategies = Array.from(new Set(trades.map((t) => t.strategy))).sort();

      // Create and save .block.json metadata
      const metadata: BlockMetadata = {
        blockId,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tradeCount: trades.length,
        dailyLogCount: 0,
        dateRange,
        strategies,
      };
      await saveMetadata(blockPath, metadata);
    }
  } else if (csvType === "dailylog") {
    // Parse daily logs to extract date range
    const entries: DailyLogEntry[] = [];
    for (const record of records) {
      const entry = convertToDailyLogEntry(record, blockId);
      if (entry) entries.push(entry);
    }

    if (entries.length > 0) {
      const dates = entries.map((e) => new Date(e.date).getTime());
      dateRange = {
        start: new Date(Math.min(...dates)).toISOString(),
        end: new Date(Math.max(...dates)).toISOString(),
      };
    }
    // Note: dailylog-only blocks won't have a .block.json created here
    // They would typically be added to an existing tradelog block
  } else if (csvType === "reportinglog") {
    // Parse reporting trades to extract metadata
    const trades: ReportingTrade[] = [];
    for (const record of records) {
      const trade = convertToReportingTrade(record);
      if (trade) trades.push(trade);
    }

    if (trades.length > 0) {
      const dates = trades.map((t) => new Date(t.dateOpened).getTime());
      dateRange = {
        start: new Date(Math.min(...dates)).toISOString(),
        end: new Date(Math.max(...dates)).toISOString(),
      };
      strategies = Array.from(new Set(trades.map((t) => t.strategy))).sort();
    }
  }

  return {
    blockId,
    name,
    recordCount: records.length,
    dateRange,
    strategies,
    blockPath,
  };
}
