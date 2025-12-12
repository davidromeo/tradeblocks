import { WithdrawalDailyRow } from "@/lib/models/withdrawal-log";
import { parse } from "date-fns";

function normalizeHeader(h: string | undefined): string {
  if (!h) return "";
  // Remove BOM, quotes, trim whitespace, and lowercase
  return h
    .replace(/^\uFEFF/, "")
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();
}

function findHeader(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  const wanted = candidates.map((c) => c.trim().toLowerCase());
  return normalized.findIndex((h) => wanted.includes(h));
}

function parseNumber(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  // Remove quotes, $, %, and commas
  const cleaned = value.replace(/["'$%,]/g, "").trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  // Remove quotes
  const v = value.replace(/["']/g, "").trim();
  if (!v) return null;

  const fmts = ["yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy"];
  for (const fmt of fmts) {
    try {
      const d = parse(v, fmt, new Date());
      if (!Number.isNaN(d.getTime())) return d;
    } catch {}
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Helper to split CSV line handling quotes
function splitCsvLine(line: string): string[] {
  const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
  return matches
    ? matches.map((m) => m.replace(/^"|"$/g, "").trim())
    : line.split(",");
}

export function parseWithdrawalDailyCsv(
  csvContent: string
): WithdrawalDailyRow[] {
  // Robust split handling \r\n, \n, and \r
  const lines = csvContent
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headerLine = lines[0];
  // naive comma split might fail if fields have commas inside quotes,
  // but OO logs usually don't quote numbers unless formatted.
  // Ideally use a real CSV parser, but for now we'll try to be robust.
  // If we assume standard comma separation:
  const headerRow = headerLine.split(",");

  const headers = headerRow.map((h) => h.trim());
  console.log("[WithdrawalDailyCsv] headers:", headers);

  const dateIdx = findHeader(headers, ["Date"]);
  const plIdx = findHeader(headers, ["P/L", "PL"]);
  const plPctIdx = findHeader(headers, ["P/L %", "PL %", "P/L%", "PL%"]);
  const ddIdx = findHeader(headers, ["Drawdown %", "Drawdown"]);

  console.log("[WithdrawalDailyCsv] column indexes:", {
    dateIdx,
    plIdx,
    plPctIdx,
    ddIdx,
  });

  const currentFundsIdx = findHeader(headers, [
    "current funds",
    "currentfunds",
  ]);
  const withdrawnIdx = findHeader(headers, ["withdrawn", "totalwithdrawn"]);

  const rows: WithdrawalDailyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values if present
    // A simple split(',') is risky if numbers have commas (e.g. "1,234.56")
    // But OO CSVs usually don't use thousands separators in raw exports, or quote them.
    // Our split logic:
    const cols = splitCsvLine(line);

    if (cols.length <= Math.max(dateIdx, plIdx || 0, plPctIdx || 0)) {
      continue;
    }

    const dateStr = cols[dateIdx];
    const date = parseDate(dateStr);

    if (!date) {
      continue;
    }

    const row: WithdrawalDailyRow = {
      date,
    };

    if (plIdx !== -1) {
      row.pl = parseNumber(cols[plIdx]);
    }
    if (plPctIdx !== -1) {
      row.plPct = parseNumber(cols[plPctIdx]);
    }
    if (ddIdx !== -1) {
      row.drawdownPct = parseNumber(cols[ddIdx]);
    }
    if (currentFundsIdx !== -1) {
      row.currentFunds = parseNumber(cols[currentFundsIdx]);
    }
    if (withdrawnIdx !== -1) {
      row.totalWithdrawn = parseNumber(cols[withdrawnIdx]);
    }

    // Filter out rows with absolutely no data
    if (
      row.pl === undefined &&
      row.plPct === undefined &&
      row.currentFunds === undefined
    ) {
      continue;
    }

    rows.push(row);
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  console.log("[WithdrawalDailyCsv] parsed rows:", rows.length);
  return rows;
}
