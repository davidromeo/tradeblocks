#!/usr/bin/env python3
"""
generate_indicators.py — Custom indicator generator for TradeBlocks 0DTE strategies.

OUTPUT COLUMNS
--------------
  date            Trading date
  VIX_MA20_Ratio  Regime filter based on VIX level
  VRP_daily       Daily Volatility Risk Premium (annualised %)
  VRP_MA20        20-day MA of VRP_daily
  MRP_realized    Daily Move Risk Premium (dollars, ex-post)
  MRP_MA20        20-day MA of MRP_realized  ← primary regime signal

════════════════════════════════════════════════════════════════════
VRP — Volatility Risk Premium  (annualised %)
════════════════════════════════════════════════════════════════════
VRP_daily = IV − RV

  IV  (Implied Volatility, annualised %)
  ───────────────────────────────────────
  Derived by inverting the Black-Scholes ATM straddle formula:

      Straddle_price = BS_Call(S, K, T, σ) + BS_Put(S, K, T, σ)

  where:
      S  = SPX price at 09:45 (Opening Price from tradelog)
      K  = Strike (nearest integer, from Legs field)
      T  = 375 / 390 / 252  (trading minutes remaining / mins per day / days per year)
           = 0.003816 years  (09:45 → 16:00 = 375 trading minutes)
      σ  = solved numerically via Brent's method → this is IV (annualised)

  ATM approximation (for intuition):
      Straddle_price ≈ S · σ · √T · √(2/π)   [factor √(2/π) ≈ 0.7979]
      Implied move   = S · σ · √T             [≈ Straddle_price · 1.2533]

  Note: IV is annualised (like VIX). To get today's expected move in %:
      σ_today = IV · √T = IV · √(375/390/252)

  RV  (Realised Volatility, intraday-only Garman-Klass, annualised %)
  ────────────────────────────────────────────────────────────────────
  Uses only the intraday components of the Garman-Klass estimator:

      var = 0.5 · ln(H/L)²  −  (2·ln2 − 1) · ln(C/O)²
      RV  = √(var · 252) · 100

  where O/H/L/C are the SPX daily OHLC bars (from yfinance ^GSPC).

  IMPORTANT — overnight gap excluded intentionally:
  The full GK estimator also includes the overnight gap ln(O/C_prev)²,
  which adds ~4 pp annualised to RV on average. A 0DTE straddle entered
  at 09:45 carries NO overnight gap risk (the gap has already occurred),
  so including it would create a spurious negative VRP bias. Only the
  intraday components (H/L range and O-to-C move) are comparable to IV.

  VRP interpretation:
      VRP > 0  →  IV > RV  →  options overpriced vs realised vol  →  good for short premium
      VRP_MA20 used as regime filter (sustained premium environment)
      Typical range: −5% to +15%, median ~1.4% annualised

════════════════════════════════════════════════════════════════════
MRP — Move Risk Premium  (dollars, ex-post)
════════════════════════════════════════════════════════════════════
MRP_realized = Straddle_entry_price − |SPX_close − Strike|

  where:
      Straddle_entry_price  = Premium / 100  (tradelog Premium is in cents × 100)
                            = implied move priced by market at 09:45
      |SPX_close − Strike|  = intrinsic value at expiry
                            = realized move (distance close landed from strike)

  MRP_realized is the ex-post dollar profit per share of the short straddle
  (before commissions), assuming held to expiry at 16:00.
  Relationship to P&L:  P&L = MRP_realized × 100  (1 contract = 100 shares)

  Correlation with daily P&L: ~0.9998 (near-perfect by construction)

  MRP_MA20 interpretation:
      MRP_MA20 > 0  →  market systematically overestimates daily moves
                     →  move risk premium is being harvested  →  good regime
      MRP_MA20 < 0  →  realized moves exceed implied  →  avoid or reduce size
      Typical range: −$10 to +$15, median ~$4 per share

  Difference from VRP:
      VRP measures vol premium in annualised % space  (signal, forward-looking feel)
      MRP measures dollar premium actually earned     (P&L attribution, ex-post)
      Correlation between VRP_MA20 and MRP_MA20: ~0.47 (related but distinct)
      They diverge when intraday path vol is high but close lands near strike.

════════════════════════════════════════════════════════════════════
Usage
════════════════════════════════════════════════════════════════════
# Only VIX_MA20_Ratio (no tradelog needed):
python generate_indicators.py --output custom_indicators.csv

# With VRP + MRP (requires OptionOmega tradelog):
python generate_indicators.py --tradelog /path/to/tradelog.csv --output custom_indicators.csv

# With local SPX OHLC CSV instead of yfinance download:
python generate_indicators.py --tradelog /path/to/tradelog.csv --spx /path/to/spx_daily.csv
"""

import argparse
import re
from datetime import datetime
from math import erfc
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

# ── Constants ────────────────────────────────────────────────────────────────

DEFAULT_START = "2022-01-01"
DEFAULT_OUTPUT = "custom_indicators.csv"
DEFAULT_TRADELOG = "/home/tradeblocks/data/Straddle-multi/tradelog.csv"

TRADING_MINS_PER_DAY = 390   # 09:30–16:00 ET
TRADING_DAYS_PER_YEAR = 252
ENTRY_TIME = "09:45:00"      # VRP snapshot time (OptionOmega)


# ── Black-Scholes helpers ────────────────────────────────────────────────────

def _norm_cdf(x):
    return 0.5 * erfc(-x / 1.4142135623730951)


def _bs_call(S, K, T, sigma):
    if T <= 0 or sigma <= 0:
        return max(S - K, 0.0)
    d1 = (np.log(S / K) + 0.5 * sigma**2 * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return S * _norm_cdf(d1) - K * _norm_cdf(d2)


def _bs_put(S, K, T, sigma):
    return _bs_call(S, K, T, sigma) - S + K


def _bs_straddle(S, K, T, sigma):
    return _bs_call(S, K, T, sigma) + _bs_put(S, K, T, sigma)


def _iv_from_straddle(S, K, T, straddle_price):
    """Invert BS straddle price → annualised IV (%) via Brent's method."""
    from scipy.optimize import brentq

    if T <= 0 or straddle_price <= 0 or S <= 0 or K <= 0:
        return np.nan
    if straddle_price <= abs(S - K):
        return np.nan
    try:
        sigma = brentq(
            lambda s: _bs_straddle(S, K, T, s) - straddle_price,
            1e-4, 20.0, xtol=1e-6, maxiter=100,
        )
        return sigma * 100.0  # vol-points (%)
    except (ValueError, RuntimeError):
        return np.nan


# ── Garman-Klass realised volatility (intraday only, no overnight gap) ─────

def _gk_rv(O, H, L, C):
    """Annualised intraday-only Garman-Klass RV (%).

    Uses only H/L range and C/O (open-to-close) components.
    Deliberately excludes the overnight gap (O / C_prev) so that RV is
    directly comparable to the IV implied from a 0DTE straddle entered at
    09:45, which carries no overnight gap risk. Including the gap inflates
    RV by ~4 pp annualised, creating a spurious negative VRP bias.

    Formula:  var = 0.5 * ln(H/L)^2  -  (2*ln2 - 1) * ln(C/O)^2
    """
    hl = np.log(H / L)
    co = np.log(C / O)
    var = 0.5 * hl**2 - (2 * np.log(2) - 1) * co**2
    return np.sqrt(max(var, 0) * TRADING_DAYS_PER_YEAR) * 100.0


# ── OptionOmega tradelog helpers ─────────────────────────────────────────────

def _parse_strike(legs_str):
    m = re.search(r'\b(\d{4,5})\s+[PC]\s+STO\b', str(legs_str))
    return float(m.group(1)) if m else np.nan


def _load_vrp_snapshots(tradelog_path):
    df = pd.read_csv(tradelog_path)
    df.columns = df.columns.str.strip()
    df["Time Opened"] = df["Time Opened"].astype(str).str.strip()
    snap = df[df["Time Opened"] == ENTRY_TIME].copy()

    snap["date"] = pd.to_datetime(snap["Date Opened"]).dt.normalize()
    snap["S"] = pd.to_numeric(snap["Opening Price"], errors="coerce")
    snap["K"] = snap["Legs"].apply(_parse_strike)
    snap["straddle_price"] = pd.to_numeric(snap["Premium"], errors="coerce") / 100.0

    entry_dt = pd.to_datetime("09:45", format="%H:%M")
    close_dt = pd.to_datetime("16:00", format="%H:%M")
    mins_remaining = (close_dt - entry_dt).seconds / 60  # 375
    snap["T"] = mins_remaining / TRADING_MINS_PER_DAY / TRADING_DAYS_PER_YEAR

    snap = snap.dropna(subset=["S", "K", "straddle_price"])
    snap = snap.drop_duplicates(subset=["date"], keep="last")
    return snap.set_index("date")[["S", "K", "straddle_price", "T"]]


# ── Core computation ─────────────────────────────────────────────────────────

def _download_vix(start, end):
    raw = yf.download("^VIX", start=start, end=end, auto_adjust=True, progress=False)
    if raw.empty:
        raise RuntimeError("Could not download VIX data from yfinance")
    raw.index = pd.to_datetime(raw.index).normalize()
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    return raw["Close"].rename("VIX")


def _compute_vrp(tradelog_path, spx_source=None):
    """Return (vrp_series, mrp_series).

    VRP_daily    = IV (annualised %) - GK Intraday RV (annualised %)
    MRP_realized = straddle_entry_price - |SPX_close - Strike|  (dollars)
                   ex-post: known only after market close.
                   MRP_MA20 > 0 over time signals a harvestabl move risk premium.
    """
    snaps = _load_vrp_snapshots(tradelog_path)
    empty = pd.Series(dtype=float), pd.Series(dtype=float)
    if snaps.empty:
        print("  [VRP] No 09:45 snapshots found — skipping VRP/MRP")
        return empty

    print(f"  [VRP] {len(snaps)} snapshots "
          f"({snaps.index.min().date()} → {snaps.index.max().date()})")

    if spx_source and Path(spx_source).exists():
        spx = pd.read_csv(spx_source, parse_dates=["date"], index_col="date")
        spx.index = spx.index.normalize()
        spx = spx[["open", "high", "low", "close"]]
    else:
        buf_start = (snaps.index.min() - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
        buf_end = (snaps.index.max() + pd.Timedelta(days=2)).strftime("%Y-%m-%d")
        raw = yf.download("^GSPC", start=buf_start, end=buf_end,
                          auto_adjust=True, progress=False)
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        raw.index = pd.to_datetime(raw.index).normalize()
        spx = raw[["Open", "High", "Low", "Close"]].rename(columns=str.lower)

    vrp_results = {}
    mrp_results = {}
    for date, row in snaps.iterrows():
        if date not in spx.index:
            continue
        ohlc = spx.loc[date]
        rv  = _gk_rv(ohlc["open"], ohlc["high"], ohlc["low"], ohlc["close"])
        iv  = _iv_from_straddle(row["S"], row["K"], row["T"], row["straddle_price"])
        if not np.isnan(iv):
            vrp_results[date] = iv - rv
        # MRP: straddle entry price minus realized move (dollars, ex-post)
        spx_close = float(ohlc["close"])
        realized_move = abs(spx_close - row["K"])
        mrp_results[date] = row["straddle_price"] - realized_move

    vrp = pd.Series(vrp_results, name="VRP_daily").sort_index()
    mrp = pd.Series(mrp_results, name="MRP_realized").sort_index()
    print(f"  [VRP] {len(vrp)} values  mean={vrp.mean():.2f}  median={vrp.median():.2f}")
    print(f"  [MRP] {len(mrp)} values  mean={mrp.mean():.2f}  median={mrp.median():.2f}")
    return vrp, mrp


def build(start, end, ma_window=20, tradelog_path=None, spx_source=None):
    print(f"[1] Downloading VIX ({start} → {end}) ...")
    vix = _download_vix(start, end)

    print("[2] Computing VIX_MA20_Ratio ...")
    ma = vix.rolling(ma_window).mean()
    ratio = (vix / ma).round(4)

    df = pd.DataFrame({"VIX_MA20_Ratio": ratio})
    df.index.name = "date"
    df["VRP_daily"]    = np.nan
    df["VRP_MA20"]     = np.nan
    df["MRP_realized"] = np.nan
    df["MRP_MA20"]     = np.nan

    if tradelog_path:
        print("[3] Computing VRP (IV − Garman-Klass Intraday RV) and MRP (implied − realized move) ...")
        vrp, mrp = _compute_vrp(tradelog_path, spx_source=spx_source)
        df["VRP_daily"]    = vrp.round(4)
        df["VRP_MA20"]     = df["VRP_daily"].rolling(ma_window).mean().round(4)
        df["MRP_realized"] = mrp.round(4)
        df["MRP_MA20"]     = df["MRP_realized"].rolling(ma_window).mean().round(4)

    print(f"[done] {len(df)} rows, {df['VIX_MA20_Ratio'].notna().sum()} valid ratio values")
    return df


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--start", default=DEFAULT_START,
                        help="Start date YYYY-MM-DD (default: %(default)s)")
    parser.add_argument("--end", default=datetime.today().strftime("%Y-%m-%d"),
                        help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--tradelog", default=None,
                        help="Path to OptionOmega tradelog CSV (enables VRP computation)")
    parser.add_argument("--spx", default=None,
                        help="Path to local spx_daily.csv (skips SPX yfinance download)")
    parser.add_argument("--output", default=DEFAULT_OUTPUT,
                        help="Output CSV path (default: %(default)s)")
    args = parser.parse_args()

    df = build(
        start=args.start,
        end=args.end,
        tradelog_path=args.tradelog,
        spx_source=args.spx,
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path)
    print(f"Saved → {out_path}")


if __name__ == "__main__":
    main()
