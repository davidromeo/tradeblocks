"use client";

// PLCalendarPanel: Main component for the P/L Calendar feature
// Note: sizingMode now supports Kelly / Half-Kelly; keep this file as the single source of truth for sizing logic.
import { endOfWeek, format, getISOWeek, getISOWeekYear, getMonth, getYear, parseISO, startOfWeek } from "date-fns";
import { Check, ChevronDown, Download, Filter, Table as TableIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import { Trade } from "@/lib/models/trade";
import { cn } from "@/lib/utils";
import { getTradingDayKey } from "@/lib/utils/trading-day";

import { DailyDetailModal, DaySummary } from "./DayDetailModal";
import { MonthlyPLCalendar } from "./MonthlyPLCalendar";
import { WeekdayAlphaMap } from "./WeekdayAlphaMap";
import { YearHeatmap, YearlyCalendarSnapshot } from "./YearHeatmap";
import { CalendarBlockConfig, YearViewBlock } from "./YearViewBlock";

interface PLCalendarPanelProps {
  trades: Trade[];
}

const formatCompactUsd = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000)
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const getTradeLots = (trade: Trade) => {
  const raw = trade.numContracts ?? 1;
  const lots = Math.abs(raw);
  return lots > 0 ? lots : 1;
};

type SizingMode = "actual" | "normalized" | "kelly" | "halfKelly";
type CalendarMetric = "pl" | "rom" | "running";

const KELLY_MAX_FRACTION = 0.25;
const KELLY_BASE_EQUITY = 100_000;

const normalizeTradeDate = (trade: Trade): Date => {
  const base =
    trade.dateOpened instanceof Date
      ? new Date(trade.dateOpened.getTime())
      : new Date(trade.dateOpened);
  const [hRaw, mRaw, sRaw] = (trade.timeOpened || "").split(":");
  const h = hRaw !== undefined && hRaw !== "" ? Number(hRaw) : 12;
  const m = mRaw !== undefined && mRaw !== "" ? Number(mRaw) : 0;
  const s = sRaw !== undefined && sRaw !== "" ? Number(sRaw) : 0;
  base.setHours(isNaN(h) ? 12 : h, isNaN(m) ? 0 : m, isNaN(s) ? 0 : s, 0);
  return base;
};

const classifyRegime = (netPL: number, romPct: number | undefined): MarketRegime => {
  if (romPct !== undefined && romPct > 8) return "TREND_UP";
  if (romPct !== undefined && romPct < -8) return "TREND_DOWN";
  if (netPL > 0) return "TREND_UP";
  if (netPL < 0) return "TREND_DOWN";
  return "CHOPPY";
};

const computeKellyFractions = (trades: Trade[]): Map<string, number> => {
  const byStrategy = new Map<
    string,
    { wins: number; losses: number; winPL: number; lossPL: number }
  >();
  trades.forEach((t) => {
    const key = t.strategy || "Custom";
    const lots = getTradeLots(t);
    const perLotPL = t.pl / lots;
    if (!byStrategy.has(key)) {
      byStrategy.set(key, { wins: 0, losses: 0, winPL: 0, lossPL: 0 });
    }
    const bucket = byStrategy.get(key)!;
    if (perLotPL >= 0) {
      bucket.wins += 1;
      bucket.winPL += perLotPL;
    } else {
      bucket.losses += 1;
      bucket.lossPL += Math.abs(perLotPL);
    }
  });

  const fractions = new Map<string, number>();
  byStrategy.forEach((b, key) => {
    const total = b.wins + b.losses;
    if (total === 0 || b.lossPL === 0) {
      fractions.set(key, 0);
      return;
    }
    const winRate = b.wins / total;
    const avgWin = b.wins > 0 ? b.winPL / b.wins : 0;
    const avgLoss = b.losses > 0 ? b.lossPL / b.losses : 0;
    if (avgLoss === 0) {
      fractions.set(key, 0);
      return;
    }
    const R = avgWin / avgLoss;
    if (R === 0) {
      fractions.set(key, 0);
      return;
    }
    let f = winRate - (1 - winRate) / R;
    if (!isFinite(f) || f < 0) f = 0;
    if (f > KELLY_MAX_FRACTION) f = KELLY_MAX_FRACTION;
    fractions.set(key, f);
  });
  return fractions;
};

// Trading-day key helper: prefer the stored dayKey, fall back to canonical ET resolver.
const resolveDayKey = (trade: Trade): string => {
  if (trade.dayKey && trade.dayKey !== "1970-01-01") return trade.dayKey;
  return getTradingDayKey(trade.dateOpened, trade.timeOpened);
};

const computeSizedPLMap = (
  trades: Trade[],
  sizingMode: SizingMode,
  baseEquity: number,
  kellyFraction: number
): Map<Trade, number> => {
  const map = new Map<Trade, number>();
  if (sizingMode === "actual" || sizingMode === "normalized") {
    trades.forEach((t) => {
      const lots = getTradeLots(t);
      const sized =
        sizingMode === "actual" ? t.pl : lots > 0 ? t.pl / lots : t.pl;
      map.set(t, sized);
    });
    return map;
  }

  const fractions = computeKellyFractions(trades);
  const sorted = [...trades].sort((a, b) => {
    const da = normalizeTradeDate(a).getTime();
    const db = normalizeTradeDate(b).getTime();
    return da - db;
  });
  let equity = baseEquity;

  sorted.forEach((t) => {
    const lots = getTradeLots(t);
    const perLotPL = lots > 0 ? t.pl / lots : t.pl;
    const marginPerLot = lots > 0 ? (t.marginReq || 0) / lots : t.marginReq || 0;
    const kBase = kellyFraction > 0 ? kellyFraction : fractions.get(t.strategy || "Custom") ?? 0;
    const k =
      sizingMode === "kelly"
        ? kBase
        : sizingMode === "halfKelly"
        ? kBase * 0.5
        : 0;
    const contracts =
      k > 0 && marginPerLot > 0
        ? Math.max(1, Math.floor((equity * k) / marginPerLot))
        : 1;
    const sizedPL = perLotPL * contracts;
    equity += sizedPL;
    map.set(t, sizedPL);
  });

  return map;
};

interface WeekSummary extends DaySummary {
  endDate: Date;
  dominantRegime?: MarketRegime;
  regimeCounts?: Partial<Record<MarketRegime, number>>;
}

type MarketRegime =
  | "TREND_UP"
  | "TREND_DOWN"
  | "CHOPPY"
  | "HIGH_IV"
  | "LOW_IV";

export function PLCalendarPanel({ trades }: PLCalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "year">("month");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedWeekStats, setSelectedWeekStats] = useState<WeekSummary | null>(
    null
  );
  const [modalMode, setModalMode] = useState<"day" | "week">("day");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [drawdownThreshold, setDrawdownThreshold] = useState(10);
  const [weeklyMode] = useState<"trailing7" | "calendarWeek">("trailing7");
  const [heatmapMetric, setHeatmapMetric] = useState<CalendarMetric>("pl");
  const [sizingMode, setSizingMode] = useState<SizingMode>("actual");
  const [kellyFraction, setKellyFraction] = useState(0.05); // stored as fraction (5% default)
  const [yearBlocks, setYearBlocks] = useState<CalendarBlockConfig[]>(() => {
    if (typeof window === "undefined") {
      return [{ id: "block-1", isPrimary: true }];
    }

    const saved = window.localStorage.getItem("plCalendarYearBlocks");
    if (!saved) return [{ id: "block-1", isPrimary: true }];

    try {
      const parsed: CalendarBlockConfig[] = JSON.parse(saved);
      const hydrated = parsed.map((b) => {
        if (!b.trades) return b;
        const revived = (b.trades as Partial<Trade>[]).map((t) => {
          const dateOpened =
            t.dateOpened instanceof Date
              ? new Date(t.dateOpened.getTime())
              : typeof t.dateOpened === "string"
              ? new Date(t.dateOpened)
              : undefined;
          const dateClosed =
            t.dateClosed instanceof Date
              ? new Date(t.dateClosed.getTime())
              : typeof t.dateClosed === "string"
              ? new Date(t.dateClosed)
              : undefined;

          return {
            ...t,
            dateOpened,
            dateClosed,
          };
        }) as Trade[];
        return { ...b, trades: revived };
      });
      return [{ id: "block-1", isPrimary: true }, ...hydrated];
    } catch (err) {
      console.warn("Failed to restore year blocks", err);
      return [{ id: "block-1", isPrimary: true }];
    }
  });

  // Persist non-primary blocks (including uploaded trades) to localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toSave = yearBlocks.filter((b) => !b.isPrimary);
    const serialized = toSave.map((b) => ({
      ...b,
      trades: b.trades?.map((t) => ({
        ...t,
        dateOpened:
          t.dateOpened instanceof Date ? t.dateOpened.toISOString() : t.dateOpened,
        dateClosed:
          t.dateClosed instanceof Date ? t.dateClosed.toISOString() : t.dateClosed,
      })),
    }));
    window.localStorage.setItem("plCalendarYearBlocks", JSON.stringify(serialized));
  }, [yearBlocks]);

  const strategies = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.strategy) s.add(t.strategy);
      else s.add("Custom");
    });
    return Array.from(s).sort();
  }, [trades]);

  const addYearBlock = () => {
    setYearBlocks((prev) =>
      prev.length >= 4
        ? prev
        : [...prev, { id: `block-${prev.length + 1}`, isPrimary: false }]
    );
  };

  const removeYearBlock = (id: string) => {
    setYearBlocks((prev) =>
      prev.filter((b) => (b.isPrimary ? true : b.id !== id))
    );
  };

  const updateYearBlockTrades = (id: string, newTrades: Trade[], name?: string) => {
    setYearBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, trades: newTrades, name } : b))
    );
  };

  // Shared max drawdown + summary helper so active and uploaded blocks use an identical pipeline.
  const computeMaxDrawdownForTrades = useCallback(
    (inputTrades: Trade[]) => {
      if (inputTrades.length === 0) return 0;

      // If trades already carry drawdownPct (e.g., uploaded daily log), respect that directly so
      // uploaded blocks use the same drawdown series as Block Stats.
      const drawdownSeries = inputTrades
        .map((t) => t.drawdownPct)
        .filter((v): v is number => Number.isFinite(v));

      if (drawdownSeries.length > 0) {
        // Sanity Check: log drawdown values for the block being processed
        // This is to verify if the parser is actually populating drawdownPct
        if (process.env.NODE_ENV === "development") {
            const sample = drawdownSeries.slice(0, 5);
            console.log("Drawdown Series Check (first 5):", sample, "Total entries:", drawdownSeries.length);
        }
        return Math.max(...drawdownSeries.map((v) => Math.abs(v)));
      }

      // Apply sizing so DD respects the current sizing mode / Kelly fraction.
      const sizedPLMap = computeSizedPLMap(
        inputTrades,
        sizingMode,
        KELLY_BASE_EQUITY,
        kellyFraction
      );

      // Use the exact same calculator path that Block Stats uses. We only change P/L via sizing
      // and let the PortfolioStatsCalculator handle drawdown from the provided fundsAtClose
      // (when present) or its own legacy fallback.
      const sizedTrades: Trade[] = inputTrades.map((t) => ({
        ...t,
        pl: sizedPLMap.get(t) ?? t.pl ?? 0,
      }));

      const calculator = new PortfolioStatsCalculator();
      // Use the same public portfolio stats pipeline that Block Stats relies on.
      const stats = calculator.calculatePortfolioStats(sizedTrades, undefined, false);
      const ddFromCalculator = Math.abs(stats.maxDrawdown ?? 0);

      return Number.isFinite(ddFromCalculator) ? ddFromCalculator : 0;
    },
    [kellyFraction, sizingMode]
  );

  // Helper to compute per-block summary stats so uploaded logs get their own Net P/L / Trades / Win Rate / Max DD cards.
  const computeBlockSummary = useCallback(
    (inputTrades: Trade[]) => {
      const tradesForSummary =
        selectedStrategies.length === 0
          ? inputTrades
          : inputTrades.filter((t) =>
              selectedStrategies.includes(t.strategy || "Custom")
            );

      if (tradesForSummary.length === 0) {
        return { totalPL: 0, tradeCount: 0, winRate: 0, maxDrawdownPct: 0 };
      }

      const sizedPLMap = computeSizedPLMap(
        tradesForSummary,
        sizingMode,
        KELLY_BASE_EQUITY,
        kellyFraction
      );

      let totalPL = 0;
      let wins = 0;

      // 1. Calculate explicit Max Drawdown from populated drawdownPct (if available)
      // This corresponds to the user's request to use the column data directly if present.
      const explicitDdValues = tradesForSummary
        .map((t) => t.drawdownPct)
        .filter((v): v is number => Number.isFinite(v));
      const explicitMaxDd = explicitDdValues.length > 0 ? Math.max(...explicitDdValues.map(Math.abs)) : 0;

      // 2. Legacy Logic (99268ce): Calculate P/L curve-based Max DD as fallback/safety.
      const tradesSorted = [...tradesForSummary].sort((a, b) => {
        const da = new Date(a.dateClosed ?? a.dateOpened).getTime();
        const db = new Date(b.dateClosed ?? b.dateOpened).getTime();
        if (da !== db) return da - db;
        return (a.timeClosed ?? a.timeOpened ?? "").localeCompare(
          b.timeClosed ?? b.timeOpened ?? ""
        );
      });

      // Seed equity using funds baseline.
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
      let legacyMaxDdVar = 0;

      tradesSorted.forEach((t) => {
        const sizedPL = sizedPLMap.get(t) ?? t.pl ?? 0;
        totalPL += sizedPL;
        if (sizedPL > 0) wins += 1;
        
        equity += sizedPL;
        peak = Math.max(peak, equity);
        if (peak > 0) {
          const dd = (peak - equity) / peak;
          if (dd > legacyMaxDdVar) legacyMaxDdVar = dd;
        }
      });

      const tradeCount = tradesForSummary.length;
      const winRate = tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0;
      
      // Hybrid Decision:
      // If we have explicit positive drawdown data from the CSV, use it (exact).
      // Otherwise, use the legacy curve calculation (approximate but robust).
      const maxDrawdownPct = explicitMaxDd > 0 ? explicitMaxDd : (legacyMaxDdVar * 100);

      return { totalPL, tradeCount, winRate, maxDrawdownPct };
    },
    [selectedStrategies, sizingMode, kellyFraction]
  );

  const filteredTrades = useMemo(() => {
    if (selectedStrategies.length === 0) return trades;
    return trades.filter((t) =>
      selectedStrategies.includes(t.strategy || "Custom")
    );
  }, [trades, selectedStrategies]);

  // Debug helper: compare active vs first uploaded block trades to catch ordering/field mismatches that affect Max DD.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const uploaded = yearBlocks.find((b) => !b.isPrimary && b.trades && b.trades.length);
    if (!uploaded?.trades?.length) return;

    const activeTrades = filteredTrades;
    const uploadedTrades = uploaded.trades;

    const sortTrades = (arr: Trade[]) =>
      [...arr].sort((a, b) => {
        const da = new Date(a.dateClosed ?? a.dateOpened ?? 0).getTime();
        const db = new Date(b.dateClosed ?? b.dateOpened ?? 0).getTime();
        if (da !== db) return da - db;
        return (a.timeClosed ?? a.timeOpened ?? "").localeCompare(
          b.timeClosed ?? b.timeOpened ?? ""
        );
      });

    const sumPL = (arr: Trade[]) => {
      const sizedMap = computeSizedPLMap(arr, sizingMode, KELLY_BASE_EQUITY, kellyFraction);
      return arr.reduce((acc, t) => acc + (sizedMap.get(t) ?? t.pl ?? 0), 0);
    };

    const aSorted = sortTrades(activeTrades);
    const uSorted = sortTrades(uploadedTrades);

    console.groupCollapsed("P/L Calendar Debug: active vs uploaded trades");
    console.log("Active length", aSorted.length, "Uploaded length", uSorted.length);
    console.log("Active total PL (sized)", sumPL(aSorted));
    console.log("Uploaded total PL (sized)", sumPL(uSorted));
    console.log("First 5 active", aSorted.slice(0, 5).map((t) => ({
      closedOn: t.dateClosed ?? t.dateOpened,
      pl: t.pl,
      fundsAtClose: t.fundsAtClose,
    })));
    console.log("First 5 uploaded", uSorted.slice(0, 5).map((t) => ({
      closedOn: t.dateClosed ?? t.dateOpened,
      pl: t.pl,
      fundsAtClose: t.fundsAtClose,
    })));

    const n = Math.min(aSorted.length, uSorted.length);
    for (let i = 0; i < n; i++) {
      const a = aSorted[i];
      const u = uSorted[i];
      const sameDate =
        (a.dateClosed ?? a.dateOpened)?.toString() ===
        (u.dateClosed ?? u.dateOpened)?.toString();
      const samePL = (a.pl ?? 0) === (u.pl ?? 0);
      const sameFunds = (a.fundsAtClose ?? 0) === (u.fundsAtClose ?? 0);
      if (!sameDate || !samePL || !sameFunds) {
        console.warn("First mismatch at index", i, {
          active: {
            closedOn: a.dateClosed ?? a.dateOpened,
            pl: a.pl,
            fundsAtClose: a.fundsAtClose,
          },
          uploaded: {
            closedOn: u.dateClosed ?? u.dateOpened,
            pl: u.pl,
            fundsAtClose: u.fundsAtClose,
          },
        });
        break;
      }
    }
    console.groupEnd();
  }, [filteredTrades, kellyFraction, sizingMode, yearBlocks]);

  const totalPLAll = useMemo(() => {
    const sizedPLMap = computeSizedPLMap(filteredTrades, sizingMode, KELLY_BASE_EQUITY, kellyFraction);
    let total = 0;
    filteredTrades.forEach((t) => {
      total += sizedPLMap.get(t) ?? t.pl;
    });
    return total;
  }, [filteredTrades, sizingMode, kellyFraction]);

  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    filteredTrades.forEach((t) => {
      const key = resolveDayKey(t);
      if (!key || key === "1970-01-01") return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTrades]);

  // Persist sizing mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("plCalendarSizingMode");
    if (
      saved === "actual" ||
      saved === "normalized" ||
      saved === "kelly" ||
      saved === "halfKelly"
    ) {
      setSizingMode(saved);
    }
    const savedKelly = window.localStorage.getItem("plCalendarKellyPct");
    if (savedKelly) {
      const pct = Number(savedKelly);
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        setKellyFraction(pct / 100);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("plCalendarSizingMode", sizingMode);
  }, [sizingMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("plCalendarKellyPct", String(Math.round(kellyFraction * 100)));
  }, [kellyFraction]);

  // Aggregate trades by day
  // This useMemo calculates daily stats including win/loss counts and rolling metrics
  const dailyStats = useMemo(() => {
    const stats = new Map<string, DaySummary>();
    const sizedPLMap = computeSizedPLMap(filteredTrades, sizingMode, KELLY_BASE_EQUITY, kellyFraction);

    tradesByDay.forEach((dayTrades, dateKey) => {
      if (!dateKey || dateKey === "1970-01-01") return;
      const date = parseISO(dateKey);

      if (!stats.has(dateKey)) {
        stats.set(dateKey, {
          dayKey: dateKey,
          date: date,
          netPL: 0,
          tradeCount: 0,
          winRate: 0,
          winCount: 0,
          maxMargin: 0,
          marginUsed: 0,
          romPct: 0,
          trades: [],
        });
      }

      const dayStat = stats.get(dateKey)!;

      dayTrades.forEach((trade) => {
        const sizedPL = sizedPLMap.get(trade) ?? trade.pl;
        dayStat.netPL += sizedPL;
        dayStat.tradeCount += 1;
        if (trade.pl > 0) dayStat.winCount += 1;
        dayStat.maxMargin = Math.max(dayStat.maxMargin, trade.marginReq || 0);
        dayStat.marginUsed = (dayStat.marginUsed ?? 0) + (trade.marginReq || 0);
        
        // Map Trade to DailyTrade, keeping the actual opened timestamp (date + time).
        const marginUsed = trade.marginReq || 0;
        const romPct = marginUsed > 0 ? (sizedPL / marginUsed) * 100 : undefined;
        const openedAt = (() => {
          const [hRaw, mRaw, sRaw] = (trade.timeOpened || "").split(":");
          // Default to noon if no time to avoid TZ shifting the date backwards.
          const h = hRaw !== undefined && hRaw !== "" ? Number(hRaw) : 12;
          const m = mRaw !== undefined && mRaw !== "" ? Number(mRaw) : 0;
          const s = sRaw !== undefined && sRaw !== "" ? Number(sRaw) : 0;
          // Build a local timestamp string (no Z) to avoid timezone shifts when rendering
          const hh = String(isNaN(h) ? 12 : h).padStart(2, "0");
          const mm = String(isNaN(m) ? 0 : m).padStart(2, "0");
          const ss = String(isNaN(s) ? 0 : s).padStart(2, "0");
          return `${dateKey}T${hh}:${mm}:${ss}`;
        })();
        dayStat.trades.push({
          id: undefined, // Trade model doesn't have ID
          dateOpened: openedAt,
          strategy: trade.strategy || "Custom",
          legs: trade.legs || "",
          premium: trade.premium || 0,
          margin: marginUsed,
          pl: sizedPL,
          romPct,
        });
      });
    });
    
    // Calculate win rates
    stats.forEach((stat) => {
      const wins = stat.winCount;
      stat.winRate =
        stat.tradeCount > 0
          ? Math.round((wins / stat.tradeCount) * 100)
          : 0;
      const dayMargin = stat.marginUsed ?? 0;
      stat.romPct = dayMargin > 0 ? (stat.netPL / dayMargin) * 100 : 0;
    });

    // Compute cumulative equity and rolling drawdowns
    const sortedKeys = Array.from(stats.keys()).sort();
    let cumulative = 0;
    let peak = 0;
    const rollingWindow: string[] = [];
    const rollingWeeklyMap = new Map<string, number>();
    const weekMap = new Map<string, number>();
    let currentStreak = 0;
    sortedKeys.forEach((key) => {
      const stat = stats.get(key)!;
      cumulative += stat.netPL;
      peak = Math.max(peak, cumulative);
      const drawdownPct = peak > 0 ? ((cumulative - peak) / peak) * 100 : 0;
      stat.drawdownPct = drawdownPct;
      stat.cumulativePL = cumulative;

      // rolling 7-day return
      rollingWindow.push(key);
      while (rollingWindow.length > 0) {
        const first = parseISO(rollingWindow[0]);
        const current = parseISO(key);
        if ((current.getTime() - first.getTime()) / (1000 * 60 * 60 * 24) > 6) {
          rollingWindow.shift();
        } else {
          break;
        }
      }
      const rollingSum = rollingWindow.reduce((sum, k) => sum + (stats.get(k)?.netPL ?? 0), 0);
      rollingWeeklyMap.set(key, rollingSum);
      stat.rollingWeeklyPL = rollingSum;

      // calendar week aggregation
      const d = parseISO(key);
      const weekKey = `${getISOWeekYear(d)}-${getISOWeek(d)}`;
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + stat.netPL);

      // streaks across all days
      if (stat.netPL > 0) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
      } else if (stat.netPL < 0) {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
      } else {
        currentStreak = 0;
      }
      stat.streak = currentStreak;
      stat.regime = classifyRegime(stat.netPL, stat.romPct);
    });

    // assign calendarWeekPL
    sortedKeys.forEach((key) => {
      const stat = stats.get(key)!;
      const d = parseISO(key);
      const weekKey = `${getISOWeekYear(d)}-${getISOWeek(d)}`;
      stat.calendarWeekPL = weekMap.get(weekKey) ?? 0;
    });

    return stats;
  }, [tradesByDay, filteredTrades, sizingMode, kellyFraction]);

  const maxDrawdownPctAll = useMemo(() => {
    if (filteredTrades.length === 0) return 0;
    return computeMaxDrawdownForTrades(filteredTrades);
  }, [computeMaxDrawdownForTrades, filteredTrades]);

  // Calculate max margin for the current month to scale utilization bars
  const maxMarginForMonth = useMemo(() => {
    let max = 0;
    const currentMonthStr = format(currentDate, "yyyy-MM");
    
    dailyStats.forEach((stat, dateKey) => {
      if (dateKey.startsWith(currentMonthStr)) {
        max = Math.max(max, stat.maxMargin);
      }
    });
    
    return max;
  }, [dailyStats, currentDate]);

  const exportMonthCsv = () => {
    const currentMonthStr = format(currentDate, "yyyy-MM");
    const headers = ["Date", "NetPL", "Trades", "WinRate", "DrawdownPct", "RollingWeeklyPL"];
    const rows: string[] = [];
    dailyStats.forEach((stat, key) => {
      if (key.startsWith(currentMonthStr)) {
        rows.push(
          [
            key,
            stat.netPL,
            stat.tradeCount,
            stat.winRate,
            stat.drawdownPct ?? "",
            stat.rollingWeeklyPL ?? "",
          ].join(",")
        );
      }
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pl-calendar-${currentMonthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMonthPng = () => {
    window.print();
  };

  // Calculate period stats (Month or Year)
  const periodStats = useMemo(() => {
    let netPL = 0;
    let tradeCount = 0;
    let winCount = 0;
    let rolling7d = 0;

    if (view === "month") {
      const currentMonthStr = format(currentDate, "yyyy-MM");
      const keysInMonth = Array.from(dailyStats.keys())
        .filter((k) => k.startsWith(currentMonthStr))
        .sort();
      dailyStats.forEach((stat, dateKey) => {
        if (dateKey.startsWith(currentMonthStr)) {
          netPL += stat.netPL;
          tradeCount += stat.tradeCount;
          winCount += stat.winCount;
        }
      });
      // rolling 7d sum using last seven days in month
      const recentKeys = keysInMonth.slice(-7);
      rolling7d = recentKeys.reduce(
        (sum, key) => sum + (dailyStats.get(key)?.netPL ?? 0),
        0
      );
    } else {
      dailyStats.forEach((stat) => {
        netPL += stat.netPL;
        tradeCount += stat.tradeCount;
        winCount += stat.winCount;
      });
    }

    return {
      netPL,
      tradeCount,
      winRate: tradeCount > 0 ? Math.round((winCount / tradeCount) * 100) : 0,
      rolling7d,
    };
  }, [view, currentDate, dailyStats]);

  const weeklyStats = useMemo(() => {
    const weeks = new Map<string, WeekSummary>();
    const currentMonthStr = format(currentDate, "yyyy-MM");

    dailyStats.forEach((stat, dateKey) => {
      if (!dateKey.startsWith(currentMonthStr)) return;

      // Ensure week rows align with Monday-start calendar grid
      const weekStart = startOfWeek(stat.date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(stat.date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          date: weekStart,
          endDate: weekEnd,
          netPL: 0,
          tradeCount: 0,
          winRate: 0,
          winCount: 0,
          maxMargin: 0,
          marginUsed: 0,
          romPct: 0,
          trades: [],
          dailyBreakdown: [],
        });
      }

      const weekStat = weeks.get(weekKey)!;
      weekStat.netPL += stat.netPL;
      weekStat.tradeCount += stat.tradeCount;
      weekStat.winCount += stat.winCount;
      weekStat.maxMargin = Math.max(weekStat.maxMargin, stat.maxMargin);
      weekStat.marginUsed = (weekStat.marginUsed || 0) + (stat.marginUsed || 0);
        weekStat.trades.push(...stat.trades);
        weekStat.dailyBreakdown?.push({
          date: stat.date,
          netPL: stat.netPL,
          tradeCount: stat.tradeCount,
        winRate:
          stat.tradeCount > 0
            ? Math.round((stat.winCount / stat.tradeCount) * 100)
            : 0,
        premium: stat.trades.reduce((sum, t) => sum + (t.premium || 0), 0),
        margin: stat.trades.reduce((sum, t) => sum + (t.margin || 0), 0),
      });
      if (stat.regime) {
        weekStat.regime =
          weekStat.regime ??
          stat.regime; // set a default; we will finalize later with dominant regime
        weekStat.regimeCounts = weekStat.regimeCounts || {};
        const key = stat.regime as MarketRegime;
        weekStat.regimeCounts[key] = (weekStat.regimeCounts[key] || 0) + 1;
      }
    });

    weeks.forEach((week) => {
      week.winRate =
        week.tradeCount > 0
          ? Math.round((week.winCount / week.tradeCount) * 100)
          : 0;
      week.romPct =
        (week.marginUsed ?? 0) > 0
          ? (week.netPL / (week.marginUsed as number)) * 100
          : 0;
      if (week.regimeCounts) {
        const entries = Object.entries(week.regimeCounts);
        if (entries.length > 0) {
          const dominant = entries.sort((a, b) => b[1] - a[1])[0][0];
          week.dominantRegime = dominant as MarketRegime;
        }
      }
    });

    return Array.from(weeks.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    // Keep sizing deps so weekly stats refresh when P/L scaling changes.
  }, [dailyStats, currentDate, sizingMode, kellyFraction]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekdayAlpha = useMemo(() => {
    const buckets = Array.from({ length: 5 }, (_, idx) => ({
      weekday: idx,
      pl: 0,
      margin: 0,
      trades: 0,
      wins: 0,
      romPct: 0,
      winRate: 0,
    }));

    const sizedPLMap = computeSizedPLMap(filteredTrades, sizingMode, KELLY_BASE_EQUITY, kellyFraction);

    filteredTrades.forEach((t) => {
      const dateKey = resolveDayKey(t);
      if (!dateKey || dateKey === "1970-01-01") return;
      const d = parseISO(dateKey);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return; // skip weekends
      const idx = dow - 1; // Mon -> 0
      const lots = getTradeLots(t);
      const marginUsed =
        sizingMode === "normalized" && lots > 0
          ? (t.marginReq || 0) / lots
          : t.marginReq || 0;
      const sizedPL = sizedPLMap.get(t) ?? t.pl;
      const bucket = buckets[idx];
      bucket.pl += sizedPL;
      bucket.margin += Math.max(0, marginUsed);
      bucket.trades += 1;
      if (t.pl > 0) bucket.wins += 1;
    });

    buckets.forEach((b) => {
      b.romPct = b.margin > 0 ? (b.pl / b.margin) * 100 : 0;
      b.winRate = b.trades > 0 ? (b.wins / b.trades) * 100 : 0;
    });

    return buckets.filter((b) => b.trades > 0);
  }, [filteredTrades, sizingMode, kellyFraction]);

  const selectedSummary = useMemo(() => {
    if (modalMode === "week") return selectedWeekStats;
    if (selectedDayKey) return dailyStats.get(selectedDayKey) ?? null;
    return null;
  }, [modalMode, selectedWeekStats, selectedDayKey, dailyStats]);

  const handleDayClick = (dayKey: string) => {
    const stats = dailyStats.get(dayKey);
    if (!stats) return;
    setSelectedDayKey(dayKey);
    setSelectedWeekStats(null);
    setModalMode("day");
    setIsModalOpen(true);
  };

  const handleWeekClick = (stats: WeekSummary) => {
    setSelectedWeekStats(stats);
    setSelectedDayKey(null);
    setModalMode("week");
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedDayKey(null);
      setSelectedWeekStats(null);
    }
  };

  const years = useMemo(() => {
    const yearsSet = new Set<number>();
    trades.forEach((t) => {
        const key = resolveDayKey(t);
        if (key && key !== "1970-01-01") {
          yearsSet.add(getYear(parseISO(key)));
          return;
        }
        const fallback =
          t.dateOpened instanceof Date ? t.dateOpened : new Date(t.dateOpened);
        if (!isNaN(fallback.getTime())) yearsSet.add(getYear(fallback));
    });
    // Ensure current year is always available
    yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [trades]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "year" ? "Net P/L (All Data)" : "Monthly Net P/L"}
            </CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                (view === "year" ? totalPLAll : periodStats.netPL) >= 0
                  ? "text-emerald-500"
                  : "text-rose-500"
              )}
            >
              {formatCompactUsd(view === "year" ? totalPLAll : periodStats.netPL)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <TableIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.tradeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <div className="text-muted-foreground">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.winRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            <div className="text-muted-foreground">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {maxDrawdownPctAll.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "month" | "year")}
            className="w-[200px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Metric toggle: P/L, ROM%, Running (Running shown only in Year view) */}
          <div className="inline-flex items-center rounded-full border bg-muted/40 p-1 text-xs">
            <Button
              size="sm"
              variant={heatmapMetric === "pl" ? "default" : "ghost"}
              className="h-6 px-3 rounded-full"
              onClick={() => setHeatmapMetric("pl")}
            >
              P/L
            </Button>
            <Button
              size="sm"
              variant={heatmapMetric === "rom" ? "default" : "ghost"}
              className="h-6 px-3 rounded-full"
              onClick={() => setHeatmapMetric("rom")}
            >
              ROM%
            </Button>
            {view === "year" && (
              <Button
                size="sm"
                variant={heatmapMetric === "running" ? "default" : "ghost"}
                className="h-6 px-3 rounded-full"
                onClick={() => setHeatmapMetric("running")}
                title="Running / cumulative P&L over time"
              >
                Running
              </Button>
            )}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 p-1 text-xs">
            <span className="text-[11px] text-muted-foreground px-2">Sizing</span>
            <Button
              size="sm"
              variant={sizingMode === "actual" ? "default" : "ghost"}
              className="h-6 px-3 rounded-full"
              onClick={() => setSizingMode("actual")}
            >
              Actual
            </Button>
            <Button
              size="sm"
              variant={sizingMode === "normalized" ? "default" : "ghost"}
              className="h-6 px-3 rounded-full"
              onClick={() => setSizingMode("normalized")}
            >
              1-lot
            </Button>
            <Button
              size="sm"
              variant={sizingMode === "kelly" ? "default" : "ghost"}
              className="h-6 px-3 rounded-full"
              onClick={() => setSizingMode("kelly")}
              title="Kelly sizing based on strategy win/loss stats"
            >
              Kelly
            </Button>
            <Button
              size="sm"
              variant={sizingMode === "halfKelly" ? "default" : "ghost"}
              className="h-6 px-3 rounded-full"
              onClick={() => setSizingMode("halfKelly")}
              title="Half-Kelly sizing for more conservative allocation"
            >
              1/2 Kelly
            </Button>
            {sizingMode === "kelly" || sizingMode === "halfKelly" ? (
              <div className="flex items-center gap-1 pl-2">
                <span className="text-[11px] text-muted-foreground">k =</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={Math.round(kellyFraction * 100)}
                  onChange={(e) => {
                    const raw = Number(e.target.value || 0);
                    const clamped = Math.min(100, Math.max(1, raw));
                    setKellyFraction(clamped / 100);
                  }}
                  className="w-16 rounded-md border bg-background px-2 py-1 text-[11px] text-right"
                />
                <span className="text-[11px] text-muted-foreground">%</span>
              </div>
            ) : null}
          </div>

          <Select
            value={getYear(currentDate).toString()}
            onValueChange={(val) => {
              const newDate = new Date(currentDate);
              newDate.setFullYear(parseInt(val));
              setCurrentDate(newDate);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <StrategyMultiSelect
              strategies={strategies}
              value={selectedStrategies}
              onChange={setSelectedStrategies}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Drawdown &gt; %</label>
            <input
              type="number"
              className="w-20 rounded border bg-background px-2 py-1 text-sm"
              value={drawdownThreshold}
              onChange={(e) => setDrawdownThreshold(Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportMonthCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportMonthPng}>
              <TableIcon className="mr-2 h-4 w-4" />
              Print/PNG
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[500px]">
        {view === "month" ? (
          <div className="space-y-6">
            <MonthlyPLCalendar
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              dailyStats={dailyStats}
              onDayClick={handleDayClick}
              maxMarginForPeriod={maxMarginForMonth}
              drawdownThreshold={drawdownThreshold}
              weeklyMode={weeklyMode}
              heatmapMetric={heatmapMetric}
            />

            {weeklyStats.length > 0 && (
              <WeeklySummaryGrid
                weeks={weeklyStats}
                onWeekClick={handleWeekClick}
              />
            )}
            {weekdayAlpha.length > 0 && (
              <WeekdayAlphaMap stats={weekdayAlpha} sizingMode={sizingMode} />
            )}

          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">
                Yearly P/L Overview
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={addYearBlock}
                disabled={yearBlocks.length >= 4}
              >
                + Add block
              </Button>
            </div>

            <div className="space-y-4">
              {(() => {
                // Base summary from the active log (after current filters). If an uploaded
                // block has identical totals/win rate (i.e., it’s the same log), we will
                // reuse this Max DD so duplicate logs stay in sync.
                const baseSummary = computeBlockSummary(filteredTrades);
                return yearBlocks.map((block) => (
                  <YearViewBlock
                    key={block.id}
                    block={block}
                    baseTrades={trades}
                    onUpdateTrades={(newTrades, name) => updateYearBlockTrades(block.id, newTrades, name)}
                    onClose={() => removeYearBlock(block.id)}
                    renderContent={(blockTrades) => (
                      <div className="space-y-4">
                        {!block.isPrimary && (
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {(() => {
                              const summaryRaw = computeBlockSummary(blockTrades);
                              const summary =
                                summaryRaw.tradeCount === baseSummary.tradeCount &&
                                Math.abs(summaryRaw.totalPL - baseSummary.totalPL) < 1 &&
                                summaryRaw.winRate === baseSummary.winRate
                                  ? { ...summaryRaw, maxDrawdownPct: baseSummary.maxDrawdownPct }
                                  : summaryRaw;
                              return (
                                <>
                                  <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                      <CardTitle className="text-sm font-medium">
                                        Net P/L (All Data)
                                      </CardTitle>
                                      <span className="text-muted-foreground">$</span>
                                    </CardHeader>
                                    <CardContent>
                                      <div
                                        className={cn(
                                          "text-2xl font-bold",
                                          summary.totalPL >= 0 ? "text-emerald-500" : "text-rose-500"
                                        )}
                                      >
                                        {formatCompactUsd(summary.totalPL)}
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                      <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
                                      <TableIcon className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-2xl font-bold">{summary.tradeCount}</div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                      <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                                      <div className="text-muted-foreground">%</div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-2xl font-bold">{summary.winRate}%</div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                      <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                                      <div className="text-muted-foreground">%</div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-2xl font-bold text-rose-500">
                                        {summary.maxDrawdownPct.toFixed(2)}%
                                      </div>
                                    </CardContent>
                                  </Card>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        <YearlyPLOutput
                          trades={blockTrades}
                          selectedStrategies={selectedStrategies}
                          sizingMode={sizingMode}
                          kellyFraction={kellyFraction}
                          heatmapMetric={heatmapMetric}
                          onMonthClick={(year, monthIndex) => {
                            const newDate = new Date(currentDate);
                            newDate.setFullYear(year);
                            newDate.setMonth(monthIndex);
                            setCurrentDate(newDate);
                            setView("month");
                          }}
                        />
                      </div>
                    )}
                  />
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      <DailyDetailModal
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        summary={selectedSummary}
        mode={modalMode}
      />
    </div>
  );
}

function WeeklySummaryGrid({
  weeks,
  onWeekClick,
}: {
  weeks: WeekSummary[];
  onWeekClick: (week: WeekSummary) => void;
}) {
  const formatCompactUsd = (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Weekly summary</h3>
        <p className="text-xs text-muted-foreground">
          {weeks.length} week{weeks.length === 1 ? "" : "s"} in view
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {weeks.map((week) => {
          const rangeLabel = `${format(week.date, "MMM d")} – ${format(
            week.endDate ?? week.date,
            "MMM d"
          )}`;

          const tone =
            week.netPL > 0
              ? "from-emerald-500/20 to-emerald-500/5 border-emerald-900/40 text-emerald-100"
              : week.netPL < 0
              ? "from-rose-500/20 to-rose-500/5 border-rose-900/40 text-rose-100"
              : "from-zinc-700/10 to-zinc-800/10 border-zinc-700/40 text-zinc-200";

          return (
            <button
              key={week.date.toISOString()}
              onClick={() => onWeekClick(week)}
              className={cn(
                "min-w-[240px] flex-1 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                "bg-gradient-to-br",
                tone
              )}
              title={`P/L: ${formatCompactUsd(week.netPL)} • Trades: ${week.tradeCount} • Max Margin: ${formatCompactUsd(week.maxMargin)}`}
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                <span className="text-white/70">{rangeLabel}</span>
                <span className={week.netPL >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {week.netPL >= 0 ? "+" : "-"}
                  {formatCompactUsd(Math.abs(week.netPL))}
                </span>
              </div>

              {week.dominantRegime && (
                <div className="mt-1 text-[11px] text-white/70">
                  Regime: {week.dominantRegime.replaceAll("_", " ")}
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/80">
                <div className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">Trades</div>
                  <div className="text-sm font-semibold">{week.tradeCount}</div>
                </div>
                <div className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">Win Rate</div>
                  <div className="text-sm font-semibold">{week.winRate}%</div>
                </div>
                <div className="rounded-lg bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/50">Max Margin</div>
                <div className="text-sm font-semibold">
                  {formatCompactUsd(week.maxMargin)}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 px-3 py-2 col-span-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  Margin Used
                </div>
                <div className="text-sm font-semibold">
                  {formatCompactUsd(week.marginUsed || 0)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  ROM
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    (week.romPct || 0) >= 0 ? "text-emerald-300" : "text-rose-300"
                  )}
                >
                  {week.romPct !== undefined ? `${week.romPct.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
    </div>
  );
}

interface YearlyPLOutputProps {
  trades: Trade[];
  selectedStrategies: string[];
  sizingMode: SizingMode;
  kellyFraction: number;
  heatmapMetric: CalendarMetric;
  onMonthClick: (year: number, monthIndex: number) => void;
}

function YearlyPLOutput({
  trades,
  selectedStrategies,
  sizingMode,
  kellyFraction,
  heatmapMetric,
  onMonthClick,
}: YearlyPLOutputProps) {
  const filtered = useMemo(() => {
    if (selectedStrategies.length === 0) return trades;
    return trades.filter((t) => selectedStrategies.includes(t.strategy || "Custom"));
  }, [trades, selectedStrategies]);

  const yearlySnapshot = useMemo<YearlyCalendarSnapshot>(() => {
    const yearMap = new Map<
      number,
      Map<number, { netPL: number; trades: number; wins: number; margin: number }>
    >();
    const sizedPLMap = computeSizedPLMap(filtered, sizingMode, KELLY_BASE_EQUITY, kellyFraction);

    filtered.forEach((trade) => {
      const dayKey = resolveDayKey(trade);
      if (!dayKey || dayKey === "1970-01-01") return;
      const date = parseISO(dayKey);
      const y = getYear(date);
      const m = getMonth(date);

      if (!yearMap.has(y)) yearMap.set(y, new Map());
      const monthMap = yearMap.get(y)!;
      if (!monthMap.has(m)) monthMap.set(m, { netPL: 0, trades: 0, wins: 0, margin: 0 });
      const entry = monthMap.get(m)!;
      const sizedPL = sizedPLMap.get(trade) ?? trade.pl;
      entry.netPL += sizedPL;
      entry.trades += 1;
      if (trade.pl > 0) entry.wins += 1;
      entry.margin += trade.marginReq || 0;
    });

    const years = Array.from(yearMap.entries())
      .map(([year, monthsMap]) => {
        const sortedMonths = Array.from(monthsMap.entries()).sort((a, b) => a[0] - b[0]);
        let running = 0;
        const months = sortedMonths.map(([month, vals]) => {
          running += vals.netPL;
          return {
            month,
            netPL: vals.netPL,
            trades: vals.trades,
            winRate: vals.trades > 0 ? Math.round((vals.wins / vals.trades) * 100) : 0,
            romPct: vals.margin > 0 ? (vals.netPL / vals.margin) * 100 : 0,
            runningNetPL: running,
          };
        });

        const total = months.reduce(
          (acc, m) => {
            acc.netPL += m.netPL;
            acc.trades += m.trades;
            acc.wins += Math.round((m.winRate / 100) * m.trades);
            acc.margin += monthsMap.get(m.month)?.margin ?? 0;
            return acc;
          },
          { netPL: 0, trades: 0, wins: 0, margin: 0 }
        );

        return {
          year,
          months,
          total: {
            netPL: total.netPL,
            trades: total.trades,
            winRate: total.trades > 0 ? Math.round((total.wins / total.trades) * 100) : 0,
            romPct: total.margin > 0 ? (total.netPL / total.margin) * 100 : 0,
          },
        };
      })
      .sort((a, b) => b.year - a.year);

    return { years };
  }, [filtered, sizingMode, kellyFraction]);

  const averageMonthlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, () => ({
      sumPL: 0,
      sumRom: 0,
      count: 0,
    }));

    yearlySnapshot.years.forEach((y) => {
      y.months.forEach((m) => {
        const idx = m.month;
        if (idx < 0 || idx > 11) return;
        months[idx].sumPL += m.netPL;
        months[idx].sumRom += m.romPct ?? 0;
        months[idx].count += 1;
      });
    });

    return months.map((m) => ({
      avgPL: m.count > 0 ? m.sumPL / m.count : 0,
      avgRom: m.count > 0 ? m.sumRom / m.count : 0,
    }));
  }, [yearlySnapshot]);

  return (
    <>
      <YearHeatmap data={yearlySnapshot} metric={heatmapMetric} onMonthClick={onMonthClick} />
      <div className="space-y-2 mt-4">
        <h3 className="text-sm font-medium text-muted-foreground">Average Monthly P/L (across visible years)</h3>
        <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3 lg:grid-cols-6">
          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((label, idx) => {
            const stats = averageMonthlyStats[idx];
            const value =
              heatmapMetric === "rom"
                ? stats?.avgRom ?? 0
                : stats?.avgPL ?? 0;
            const positive = value >= 0;
            const formatted =
              heatmapMetric === "rom"
                ? `${value.toFixed(1)}%`
                : formatCompactUsd(value);
            return (
              <div
                key={label}
                className="rounded-md bg-muted/40 px-1.5 py-1 text-center"
              >
                <div className="mb-0.5 text-[10px] text-muted-foreground">{label}</div>
                <div className={positive ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                  {formatted}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function StrategyMultiSelect({
  strategies,
  value,
  onChange,
}: {
  strategies: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const summaryText =
    value.length === 0
      ? "All strategies"
      : value.length === 1
      ? value[0]
      : `${value.length} strategies`;

  const toggleStrategy = (name: string) => {
    if (value.includes(name)) {
      const next = value.filter((s) => s !== name);
      onChange(next.length === 0 ? [] : next);
    } else {
      onChange([...value, name]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-[240px] justify-between text-left"
        >
          <span className="truncate">{summaryText}</span>
          <div className="flex items-center gap-1">
            {value.length > 1 && (
              <Badge variant="secondary" className="text-[11px]">
                {value.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search strategies..." />
          <CommandList>
            <CommandGroup heading="All">
              <CommandItem
                onSelect={() => onChange([])}
                className="flex items-center gap-2"
              >
                <Checkbox checked={value.length === 0} />
                <span>All strategies</span>
                {value.length === 0 && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Strategies">
              {strategies.map((s) => {
                const isChecked = value.includes(s);
                return (
                  <CommandItem
                    key={s}
                    onSelect={() => toggleStrategy(s)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={isChecked} />
                    <span className="truncate">{s}</span>
                    {isChecked && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
