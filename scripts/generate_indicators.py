#!/usr/bin/env python3
"""
generate_indicators.py — Minimal custom indicator generator for TradeBlocks.

Produces a CSV with three columns:
  date, VIX_MA20_Ratio, VRP_daily, VRP_MA20

VIX_MA20_Ratio  = VIX / 20-day rolling mean of VIX
VRP_daily       = Implied Volatility − Garman-Klass Realised Volatility
VRP_MA20        = 20-day rolling mean of VRP_daily

Usage
-----
# Only VIX_MA20_Ratio (no tradelog needed):
python generate_indicators.py --output custom_indicators.csv

# With VRP (requires OptionOmega tradelog):
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


# ── Garman-Klass realised volatility ────────────────────────────────────────

def _gk_rv(O, H, L, C):
    """Annualised Garman-Klass RV (%)."""
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
    snaps = _load_vrp_snapshots(tradelog_path)
    if snaps.empty:
        print("  [VRP] No 09:45 snapshots found — skipping VRP")
        return pd.Series(dtype=float)

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

    results = {}
    for date, row in snaps.iterrows():
        if date not in spx.index:
            continue
        ohlc = spx.loc[date]
        rv = _gk_rv(ohlc["open"], ohlc["high"], ohlc["low"], ohlc["close"])
        iv = _iv_from_straddle(row["S"], row["K"], row["T"], row["straddle_price"])
        if not np.isnan(iv):
            results[date] = iv - rv

    vrp = pd.Series(results, name="VRP_daily").sort_index()
    print(f"  [VRP] {len(vrp)} values (mean={vrp.mean():.2f}, median={vrp.median():.2f})")
    return vrp


def build(start, end, ma_window=20, tradelog_path=None, spx_source=None):
    print(f"[1] Downloading VIX ({start} → {end}) ...")
    vix = _download_vix(start, end)

    print("[2] Computing VIX_MA20_Ratio ...")
    ma = vix.rolling(ma_window).mean()
    ratio = (vix / ma).round(4)

    df = pd.DataFrame({"VIX_MA20_Ratio": ratio})
    df.index.name = "date"
    df["VRP_daily"] = np.nan
    df["VRP_MA20"] = np.nan

    if tradelog_path:
        print("[3] Computing VRP (IV − Garman-Klass RV) ...")
        vrp = _compute_vrp(tradelog_path, spx_source=spx_source)
        df["VRP_daily"] = vrp.round(4)
        df["VRP_MA20"] = df["VRP_daily"].rolling(ma_window).mean().round(4)

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
