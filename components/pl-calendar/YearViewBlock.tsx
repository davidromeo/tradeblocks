import { format, parse } from "date-fns";
import React, { useCallback } from "react";
import { DateRange } from "react-day-picker";

import { Trade } from "@/lib/models/trade";

export type CalendarBlockConfig = {
  id: string;
  isPrimary: boolean;
  trades?: Trade[];
  name?: string;
};

interface YearViewBlockProps {
  block: CalendarBlockConfig;
  baseTrades: Trade[];
  dateRange?: DateRange;
  onUpdateTrades: (tradesForBlock: Trade[], name?: string) => void;
  onClose: () => void;
  renderContent: (trades: Trade[]) => React.ReactNode;
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  // Strip currency/percent symbols and commas
  let cleaned = raw.replace(/[$,%]/g, "").trim();
  // Handle parenthesis for negatives, e.g. "(1,234.50)"
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    cleaned = `-${cleaned.slice(1, -1)}`;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Basic CSV split that respects quoted commas.
function splitCsvLine(line: string, delimiter: string = ","): string[] {
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
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((c) => c.trim());
}

function detectDelimiter(line: string): string {
    const candidates = [",", ";", "\t", "|"];
    let best = ",";
    let maxCount = 0;
    for (const d of candidates) {
        const count = line.split(d).length;
        if (count > maxCount) {
            maxCount = count;
            best = d;
        }
    }
    return best;
}

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const candidates = [
    "EEE, MMM d, yyyy h:mm a",
    "EEE, MMM d, yyyy, h:mm a",
    "MMM d, yyyy h:mm a",
    "MMMM d, yyyy h:mm a",
    "M/d/yyyy h:mm a",
    "M/d/yy h:mm a",
    "M/d/yyyy",
    "M/d/yy",
    "yyyy-MM-dd",
    "yyyy/MM/dd",
    "EEE, MMM d, yyyy HH:mm:ss",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
  ];
  for (const fmt of candidates) {
    const parsed = parse(raw, fmt, new Date());
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback;
}

/**
 * Minimal Option Omega CSV parser for ad-hoc uploads in the Year view.
 * Tolerant: missing fields fall back to safe defaults so we can satisfy Trade.
 */
function parseOptionOmegaCsv(csvText: string): { trades: Trade[]; detectedMaxDrawdown: number | null } {
  // 1. Universal line splitting
  const lines = csvText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return { trades: [], detectedMaxDrawdown: null };

  // 2. Auto-detect delimiter
  const delimiter = detectDelimiter(lines[0]);
  console.log("[CSV Parser] Detected Delimiter:", JSON.stringify(delimiter));

  const headers = splitCsvLine(lines[0], delimiter);
  // Normalize headers: lowercase, trim, remove BOM
  const normalizedHeader = headers.map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());

  // Debug: log normalized headers to see exactly what we have
  console.log("[CSV Parser] Normalized Headers:", normalizedHeader);

  const findIndex = (candidates: string[]) => {
    for (const label of candidates) {
      const idx = normalizedHeader.indexOf(label.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Support both Trade Log ("Opened On", "Date Opened") and Daily Log ("Date")
  const idxOpenedOn = findIndex(["Opened On", "Date Opened", "Date"]);
  
  // Use indices for standard fields for performance, but we'll use object scanning for robust Drawdown detection
  const idxOpeningPrice = findIndex(["Opening Price"]);
  const idxLegs = findIndex(["Legs"]);
  const idxPremium = findIndex(["Premium"]);
  const idxClosingPrice = findIndex(["Closing Price"]);
  const idxClosedOn = findIndex(["Closed On", "Date Closed"]);
  const idxAvgClosingCost = findIndex(["Closing Cost", "Avg. Closing Cost"]);
  const idxReasonForClose = findIndex(["Reason for Close", "Reason For Close"]);
  const idxPL = findIndex(["P/L", "PL", "Net P/L", "Net PL", "Daily P/L"]);
  const idxContracts = findIndex(["No. of Contracts", "Contracts"]);
  const idxFundsAtClose = findIndex(["Funds at Close", "Net Liquidity"]);
  const idxMarginReq = findIndex(["Margin Req.", "Margin Req", "Initial Margin", "Init Margin", "Margin"]);
  const idxStrategy = findIndex(["Strategy"]);
  const idxOpeningFees = findIndex(["Opening Commissions + Fees"]);
  const idxClosingFees = findIndex(["Closing Commissions + Fees"]);
  const idxOpeningSLR = findIndex(["Opening S/L Ratio", "Opening Short/Long Ratio"]);
  const idxClosingSLR = findIndex(["Closing S/L Ratio", "Closing Short/Long Ratio"]);
  const idxOpeningVix = findIndex(["Opening VIX"]);
  const idxClosingVix = findIndex(["Closing VIX"]);
  const idxGap = findIndex(["Gap"]);
  const idxMovement = findIndex(["Movement"]);
  const idxMaxProfit = findIndex(["Max Profit"]);
  const idxMaxLoss = findIndex(["Max Loss"]);

  const trades: Trade[] = [];
  const detectedMaxDrawdownValues: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = splitCsvLine(row, delimiter);
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : "");

    // Construct row object
    const rowObj: Record<string, string> = {};
    headers.forEach((h, k) => {
        rowObj[h] = cols[k] || "";
    });

    // 1. Log the CSV headers as the parser sees them (User requested debug)
    if (i === 1 && typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (!win.__loggedHeaders) {
            win.__loggedHeaders = true;
            console.log(
                "OO uploaded log headers (detailed):",
                Object.keys(rowObj).map((h) => ({
                    raw: h,
                    length: h.length,
                    chars: Array.from(h).map((c) => c.charCodeAt(0)),
                }))
            );
        }
    }

    let drawdownPct: number | undefined;

    // Use User's requested logic:
    // Iterate entries to find Drawdown key dynamically for this row's data
    for (const [rawKey, rawVal] of Object.entries(rowObj)) {
        const key = String(rawKey)
            .replace(/^\uFEFF/, "") // strip BOM if present
            .trim()
            .toLowerCase();

        if (
            key === "drawdown %" ||
            key === "drawdown%" ||
            key === "drawdown pct" ||
            key === "drawdownpct" ||
            key === "drawdown" ||
            key === "dd %" ||
            key === "dd"
        ) {
            if (rawVal === null || rawVal === undefined || rawVal === "") continue;

            const n = parseNumber(String(rawVal));
            // parseNumber returns 0 if invalid or 0.
            if (Number.isFinite(n)) {
                drawdownPct = n; // Found it.
                // Collect for direct max calc
                detectedMaxDrawdownValues.push(Math.abs(n));
                break; // Stop looking.
            }
        }
    }

    // Debug first row
    if (i === 1) {
        console.log("[CSV Parser] Row 1 Drawdown Scan Result:", {
            found: drawdownPct,
            rowKeys: Object.keys(rowObj)
        });
    }

    const openedOnRaw = get(idxOpenedOn);
    const openedOn = parseDate(openedOnRaw);
    const closedOnRaw = get(idxClosedOn);
    const closedOn = parseDate(closedOnRaw);

    // Skip if we couldn't parse any meaningful date; avoids 1969/1970 buckets.
    // Allow if only matching "Date" (Daily Log style) where closedOn might be empty
    if (!openedOn && !closedOn) continue;

    const strategy = get(idxStrategy) || "Unknown";
    
    let marginReqVal = parseNumber(get(idxMarginReq));
    const fundsAtCloseVal = parseNumber(get(idxFundsAtClose));

    // Heuristic Check: If Margin Req is suspiciously large and close to Funds At Close
    // (likely detecting Account Balance as Margin), then ignore it to avoid skewing ROM.
    if (
        marginReqVal > 1_000_000 && 
        fundsAtCloseVal > 1_000_000 && 
        Math.abs(marginReqVal - fundsAtCloseVal) / (fundsAtCloseVal || 1) < 0.2
    ) {
        // likely account balance mapped to margin, or margin column contains bal
        marginReqVal = 0;
    }

    const trade: Trade = {
      dateOpened: openedOn ?? new Date("1970-01-01"),
      timeOpened: "",
      dayKey: openedOn ? format(openedOn, "yyyy-MM-dd") : undefined,
      openingPrice: parseNumber(get(idxOpeningPrice)),
      legs: get(idxLegs) || "",
      premium: parseNumber(get(idxPremium)),
      closingPrice: parseNumber(get(idxClosingPrice)),
      dateClosed: closedOn,
      timeClosed: "",
      avgClosingCost: parseNumber(get(idxAvgClosingCost)),
      reasonForClose: get(idxReasonForClose) || undefined,
      pl: parseNumber(get(idxPL)),
      numContracts: parseNumber(get(idxContracts)),
      fundsAtClose: fundsAtCloseVal,
      marginReq: marginReqVal,
      strategy,
      openingCommissionsFees: parseNumber(get(idxOpeningFees)),
      closingCommissionsFees: parseNumber(get(idxClosingFees)),
      openingShortLongRatio: parseNumber(get(idxOpeningSLR)),
      closingShortLongRatio: parseNumber(get(idxClosingSLR)),
      openingVix: parseNumber(get(idxOpeningVix)),
      closingVix: parseNumber(get(idxClosingVix)),
      gap: parseNumber(get(idxGap)),
      movement: parseNumber(get(idxMovement)),
      maxProfit: parseNumber(get(idxMaxProfit)),
      maxLoss: parseNumber(get(idxMaxLoss)),
      // IMPORTANT: set this on the same object the calendar uses for Max DD
      drawdownPct: drawdownPct ?? 0,
    } as Trade;
    
    if (i === 1) {
        console.log("[CSV Parser] Row 1 Entry:", trade);
    }

    trades.push(trade);
  }

  const detectedMaxDrawdown = detectedMaxDrawdownValues.length > 0 
      ? Math.max(...detectedMaxDrawdownValues) 
      : null;

  return { trades, detectedMaxDrawdown };
}

// Restoration of 99268ce "legacy" logic for Max Drawdown
function computeLegacyMaxDrawdown(trades: Trade[]): number {
  if (!trades || trades.length === 0) return 0;
  
  // Sort by date/time
  const tradesSorted = [...trades].sort((a, b) => {
    const da = new Date(a.dateClosed ?? a.dateOpened).getTime();
    const db = new Date(b.dateClosed ?? b.dateOpened).getTime();
    if (da !== db) return da - db;
    return (a.timeClosed ?? a.timeOpened ?? "").localeCompare(
      b.timeClosed ?? b.timeOpened ?? ""
    );
  });

  // Seed equity using funds baseline.
  // This logic matches 99268ce exactly.
  const first = tradesSorted[0];
  const baseFromFunds =
    typeof first.fundsAtClose === "number" && typeof first.pl === "number"
      ? first.fundsAtClose - first.pl
      : undefined;
  
  let equity =
    typeof baseFromFunds === "number" && baseFromFunds > 0
      ? baseFromFunds
      : 100_000;
  
  let peak = equity;
  let maxDd = 0;

  tradesSorted.forEach((t) => {
    // For uploaded logs fallback, we assume "Actual" sizing (just PL)
    const sizedPL = t.pl; 
    equity += sizedPL;
    peak = Math.max(peak, equity);
    if (peak > 0) {
      const dd = (peak - equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  });

  return maxDd * 100; // Return as percentage (0-100)
}


// 2. Different algorithm matching Option Omega's likely equity-based approach
function maxDrawdownFromEquity(equity: number[]): number {
  if (!equity.length) return 0;

  let peak = -Infinity;
  let maxDd = 0;

  for (const value of equity) {
    if (!Number.isFinite(value)) continue;

    if (value > peak) {
      peak = value;
    }

    if (peak > 0) {
      // Drawdown is percentage drop from peak
      const dd = (value / peak - 1) * 100;
      if (dd < maxDd) {
        maxDd = dd;
      }
    }
  }

  return Math.abs(maxDd);
}

export function YearViewBlock({
  block,
  baseTrades,
  onUpdateTrades,
  onClose,
  renderContent,
  dateRange, // Added dateRange to destructuring
}: YearViewBlockProps) {
  const { isPrimary, name, trades } = block; // Restored id for logging
  const [uploadedTrades, setUploadedTrades] = React.useState<Trade[]>([]);
  // Store the explicit Max DD found in CSV, if any
  const [uploadedMaxDrawdown, setUploadedMaxDrawdown] = React.useState<number | null>(null);

  // Helper to check if a date is within the specified range
  const isWithinRange = React.useCallback((date: Date | string | number, range?: DateRange) => {
    if (!range?.from || !range?.to || !date) return true;
    const d = date instanceof Date ? date : new Date(date);
    return d >= range.from && d <= range.to;
  }, []);

  const effectiveTrades = React.useMemo(
    () => {
      // Primary block: always use baseTrades (passed from parent, already filtered)
      if (isPrimary) {
        return baseTrades;
      }

      // Uploaded/Secondary block:
      // 1. Determine raw source (uploaded > block.trades > empty)
      // CRITICAL FIX: Do NOT fallback to baseTrades, or else it duplicates the active block!
      const rawTrades = uploadedTrades.length > 0 ? uploadedTrades : (trades ?? []);

      // 2. Apply date range filter (parent filters baseTrades, but we must filter our own)
      if (!dateRange?.from || !dateRange?.to) {
        return rawTrades;
      }

      const filtered = rawTrades.filter(t => isWithinRange(t.dateClosed ?? t.dateOpened, dateRange));
      return filtered;
    },
    [baseTrades, isPrimary, uploadedTrades, trades, dateRange, isWithinRange]
  );
  const hasData = isPrimary || (effectiveTrades && effectiveTrades.length > 0);

  // Helper to inspect parsed drawdown percentages from uploaded logs
  const parsedMaxAbsDrawdown = React.useMemo(() => {
    // 1. New Strategy: Compute Max DD from the "Net Liquidity" / "Funds at Close" series specifically.
    // This is likely the "truth" series Option Omega uses.
    const fundsSeries = effectiveTrades
        .map(t => t.fundsAtClose)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v !== 0);
    
    // We need a decent number of data points to trust this series (e.g. > 50% of trades have funds recorded)
    if (fundsSeries.length > 0 && fundsSeries.length >= effectiveTrades.length * 0.5) {
        return maxDrawdownFromEquity(fundsSeries);
    }

    // 2. Fallback: If "Drawdown %" column was explicitly found, use that.
    if (!isPrimary && uploadedMaxDrawdown !== null) {
        return uploadedMaxDrawdown;
    }

    // 3. Last Resort: Use legacy 99268ce logic (P/L curve simulation)
    if (effectiveTrades.length === 0) return 0;
    return computeLegacyMaxDrawdown(effectiveTrades);
  }, [effectiveTrades, isPrimary, uploadedMaxDrawdown]);

  const handleExport = useCallback(() => {
    if (!effectiveTrades.length) return;

    const header = [
      "Date Opened",
      "Date Closed",
      "Strategy",
      "P/L",
      "Margin Req.",
      "Funds at Close",
      "Premium",
      "Contracts",
    ];

    const rows = effectiveTrades.map((t) => [
      t.dateOpened ? format(t.dateOpened, "yyyy-MM-dd") : "",
      t.dateClosed ? format(t.dateClosed, "yyyy-MM-dd") : "",
      t.strategy ?? "Custom",
      t.pl ?? 0,
      t.marginReq ?? 0,
      t.fundsAtClose ?? 0,
      t.premium ?? 0,
      t.numContracts ?? 0,
    ]);

    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const value = typeof cell === "number" ? cell.toString() : cell;
            return `"${value?.toString().replace(/"/g, '""') ?? ""}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isPrimary
      ? "pl-calendar-active-log.csv"
      : `pl-calendar-upload-${block.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [effectiveTrades, isPrimary, block.id]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        if (text) {
          const { trades: parsedTrades, detectedMaxDrawdown } = parseOptionOmegaCsv(text);
          
          // Update local state for rendering
          setUploadedTrades(parsedTrades);
          setUploadedMaxDrawdown(detectedMaxDrawdown);
          
          // Also update parent so it persists in the block config if needed
          onUpdateTrades(parsedTrades, file.name);
        }
      } catch (err) {
        console.error("Failed to parse uploaded log", err);
      } finally {
        event.target.value = "";
      }
    },
    [onUpdateTrades]
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {isPrimary ? "Active log" : name ? `Uploaded log: ${name}` : "Uploaded log"}
          </span>
          {!isPrimary && parsedMaxAbsDrawdown !== null && (
            <span className="text-[10px] text-slate-500">

            </span>
          )}
          {!isPrimary && (
            <label className="cursor-pointer text-xs text-sky-400 underline hover:text-sky-300">
              Upload Option Omega log
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!hasData}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            Export CSV
          </button>
          {!isPrimary && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {!hasData && !isPrimary ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
          Upload an Option Omega log above to view yearly P/L.
        </div>
      ) : (
        renderContent(effectiveTrades)
      )}
    </section>
  );
}

export default YearViewBlock;
