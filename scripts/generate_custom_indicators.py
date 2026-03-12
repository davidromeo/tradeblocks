#!/usr/bin/env python3
import argparse
import re
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf

DEFAULT_START       = "2022-01-01"
DEFAULT_OUTPUT      = "custom_indicators.csv"
DEFAULT_TRADELOG    = "/home/tradeblocks/data/Straddle-multi/tradelog.csv"
VIX_MA_BINS         = [0.0, 0.80, 0.95, 1.05, 1.20, np.inf]
VIX_MA_LABELS       = ["depressed", "declining", "neutral", "elevated", "spiking"]

TRADING_MINS_PER_DAY = 390          # 9:30–16:00 ET
TRADING_DAYS_PER_YEAR = 252
ENTRY_TIME = "09:45:00"             # VRP reference snapshot time

BIN_COLORS = {1: "#4fc3f7", 2: "#81c784", 3: "#fff176", 4: "#ffb74d", 5: "#e57373"}
BIN_NAMES  = {1: "depressed", 2: "declining", 3: "neutral", 4: "elevated", 5: "spiking"}
BIN_RANGES = {1: "< 0.80", 2: "0.80–0.95", 3: "0.95–1.05", 4: "1.05–1.20", 5: "> 1.20"}


# ── Black-Scholes helpers ─────────────────────────────────────────────────────

def _norm_cdf(x):
    from math import erfc
    return 0.5 * erfc(-x / 1.4142135623730951)


def _bs_call(S, K, T, sigma):
    """Black-Scholes call price (r=0, q=0)."""
    if T <= 0 or sigma <= 0:
        return max(S - K, 0.0)
    d1 = (np.log(S / K) + 0.5 * sigma ** 2 * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return S * _norm_cdf(d1) - K * _norm_cdf(d2)


def _bs_put(S, K, T, sigma):
    """Black-Scholes put price via put-call parity (r=0, q=0)."""
    return _bs_call(S, K, T, sigma) - S + K


def _bs_straddle(S, K, T, sigma):
    return _bs_call(S, K, T, sigma) + _bs_put(S, K, T, sigma)


def _iv_from_straddle(S, K, T, straddle_price):
    """
    Invert Black-Scholes straddle price to σ (annualised) via Brent's method.
    Returns NaN if inversion fails or inputs are degenerate.
    """
    from scipy.optimize import brentq

    if T <= 0 or straddle_price <= 0 or S <= 0 or K <= 0:
        return np.nan
    intrinsic = abs(S - K)
    if straddle_price <= intrinsic:
        return np.nan
    try:
        sigma = brentq(
            lambda s: _bs_straddle(S, K, T, s) - straddle_price,
            1e-4, 20.0, xtol=1e-6, maxiter=100
        )
        return sigma * 100.0          # convert to vol-points (%)
    except (ValueError, RuntimeError):
        return np.nan


# ── OptionOmega tradelog helpers ──────────────────────────────────────────────

def _parse_strike(legs_str):
    """Extract first strike from Legs string like '1 Feb 20 6865 P STO 22.00 | ...'"""
    m = re.search(r'\b(\d{4,5})\s+[PC]\s+STO\b', str(legs_str))
    return float(m.group(1)) if m else np.nan


def load_vrp_snapshots(tradelog_path):
    """
    Load OptionOmega tradelog and return one row per trading day at ENTRY_TIME (09:45).
    Returns DataFrame indexed by date with columns: S, K, straddle_price, T
    """
    df = pd.read_csv(tradelog_path)
    df.columns = df.columns.str.strip()

    # Normalise time column
    df["Time Opened"] = df["Time Opened"].astype(str).str.strip()
    snap = df[df["Time Opened"] == ENTRY_TIME].copy()

    snap["date"] = pd.to_datetime(snap["Date Opened"]).dt.normalize()
    snap["S"] = pd.to_numeric(snap["Opening Price"], errors="coerce")
    snap["K"] = snap["Legs"].apply(_parse_strike)
    snap["straddle_price"] = pd.to_numeric(snap["Premium"], errors="coerce") / 100.0

    # T = fraction of trading year remaining until 16:00
    # At 09:45 → 375 minutes remaining in the session
    entry_dt = pd.to_datetime("09:45", format="%H:%M")
    close_dt = pd.to_datetime("16:00", format="%H:%M")
    mins_remaining = (close_dt - entry_dt).seconds / 60  # 375.0
    snap["T"] = mins_remaining / TRADING_MINS_PER_DAY / TRADING_DAYS_PER_YEAR

    snap = snap.dropna(subset=["S", "K", "straddle_price"])
    snap = snap.drop_duplicates(subset=["date"], keep="last")
    snap = snap.set_index("date")[["S", "K", "straddle_price", "T"]]
    return snap


# ── Garman-Klass realised volatility ─────────────────────────────────────────

def _gk_rv(O, H, L, C):
    """
    Garman-Klass annualised daily RV (%).
    σ²_GK = 0.5·[ln(H/L)]² − (2ln2−1)·[ln(C/O)]²
    RV_GK = sqrt(σ²_GK × 252) × 100
    """
    with np.errstate(divide="ignore", invalid="ignore"):
        hl = np.log(H / L)
        co = np.log(C / O)
    var = 0.5 * hl ** 2 - (2 * np.log(2) - 1) * co ** 2
    rv = np.sqrt(np.maximum(var, 0) * TRADING_DAYS_PER_YEAR) * 100.0
    return rv


def compute_vrp(tradelog_path, spx_source=None):
    """
    Compute VRP_daily = IV − RV_GK for each day in the OptionOmega tradelog.

    Parameters
    ----------
    tradelog_path : path to OptionOmega tradelog CSV
    spx_source    : path to spx_daily.csv (if None, downloads via yfinance)

    Returns
    -------
    pd.Series indexed by date, values = VRP_daily (vol-points, float)
    """
    snaps = load_vrp_snapshots(tradelog_path)
    if snaps.empty:
        print("  [VRP] No 09:45 snapshots found in tradelog")
        return pd.Series(dtype=float)

    date_min = snaps.index.min().strftime("%Y-%m-%d")
    date_max = snaps.index.max().strftime("%Y-%m-%d")
    print(f"  [VRP] {len(snaps)} 09:45 snapshots ({date_min} → {date_max})")

    # ── SPX OHLC ─────────────────────────────────────────────────────────────
    if spx_source and Path(spx_source).exists():
        spx = pd.read_csv(spx_source, parse_dates=["date"], index_col="date")
        spx.index = spx.index.normalize()
        spx = spx[["open", "high", "low", "close"]]
    else:
        # Buffer by 5 days for rolling data; extra days dropped later
        raw = yf.download(
            "^GSPC",
            start=(snaps.index.min() - pd.Timedelta(days=5)).strftime("%Y-%m-%d"),
            end=(snaps.index.max() + pd.Timedelta(days=2)).strftime("%Y-%m-%d"),
            auto_adjust=True, progress=False
        )
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        raw.index = pd.to_datetime(raw.index).normalize()
        spx = raw[["Open", "High", "Low", "Close"]].rename(columns=str.lower)

    # ── Per-day VRP ───────────────────────────────────────────────────────────
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
    print(f"  [VRP] Computed {len(vrp)} VRP values "
          f"(mean={vrp.mean():.2f}, median={vrp.median():.2f} vol-pts)")
    return vrp


def download_vix(start, end):
    raw = yf.download("^VIX", start=start, end=end, auto_adjust=True, progress=False)
    if raw.empty:
        raise RuntimeError("Could not download VIX data")
    raw.index = pd.to_datetime(raw.index).normalize()
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    return raw["Close"].rename("VIX")


def build(start, end, ma_window=20, tradelog_path=None, spx_source=None):
    print(f"[1/3] Downloading VIX ({start} -> {end}) ...")
    vix   = download_vix(start, end)
    print("[2/3] Computing VIX/MA regime ...")
    ma    = vix.rolling(ma_window).mean()
    ratio = (vix / ma).round(4)
    regime = pd.cut(ratio, bins=VIX_MA_BINS, labels=[1,2,3,4,5]).astype("Int64")
    label  = pd.cut(ratio, bins=VIX_MA_BINS, labels=VIX_MA_LABELS).astype(str)
    df = pd.DataFrame({
        "VIX_MA_Ratio":  ratio,
        "VIX_MA_Regime": regime,
        "VIX_MA_Label":  label,
        "VRP_daily":  np.nan,
        "VRP_MA20":   np.nan,
    })
    df.index.name = "date"
    # ── EXTENSION POINT ──
    if tradelog_path:
        print("[2b/3] Computing VRP (IV − RV_GK) ...")
        vrp = compute_vrp(tradelog_path, spx_source=spx_source)
        df["VRP_daily"] = vrp
        df["VRP_MA20"]  = df["VRP_daily"].rolling(20).mean().round(4)
        df["VRP_daily"] = df["VRP_daily"].round(4)
    # ── END EXTENSION POINT ──
    print(f"[3/3] Built {len(df)} rows")
    return df


def analyze_regime_performance(
    trades_csv,
    indicators_csv,
    block_id=None,
    output_png="vix_regime_analysis.png",
    pl_col="pl",
    date_col="date_opened",
):
    """
    Joins a TradeBlocks trade CSV with custom_indicators.csv on date,
    then produces:
      1. Scatter plot  – VIX_MA_Ratio vs per-trade P&L with regime colour bands
      2. Summary table – Baseline row + one row per VIX_MA_Regime bin (1-5)
         Columns: Regime | VIX/MA Range | Trades | Win% | Avg P&L | Median P&L | Sharpe
         Win% and Sharpe cells are colour-coded green/red vs baseline.

    Parameters
    ----------
    trades_csv      : path to TradeBlocks tradelog CSV (date_opened, pl, ...)
    indicators_csv  : path produced by generate_custom_indicators.py
    block_id        : optional filter on 'block_id' column in trades CSV
    output_png      : output file path for the combined figure
    pl_col          : P&L column name in trades CSV (default: 'pl')
    date_col        : trade entry date column in trades CSV (default: 'date_opened')

    Returns
    -------
    pd.DataFrame with one row per bin (+ baseline) and columns:
        regime, range, n, win_rate, avg_pl, median_pl, total_pl, sharpe
    """
    import matplotlib.pyplot as plt
    import matplotlib.gridspec as gridspec
    from matplotlib.patches import FancyBboxPatch
    from scipy import stats

    # ── 1. Load & join ────────────────────────────────────────────────────────
    trades = pd.read_csv(trades_csv, parse_dates=[date_col])
    if block_id:
        trades = trades[trades["block_id"] == block_id]
    trades["_date"] = trades[date_col].dt.normalize()

    ind = pd.read_csv(indicators_csv, parse_dates=["date"], index_col="date")
    ind.index = ind.index.normalize()

    df = trades.merge(
        ind[["VIX_MA_Ratio", "VIX_MA_Regime", "VIX_MA_Label"]],
        left_on="_date", right_index=True, how="left",
    )
    df = df.dropna(subset=["VIX_MA_Ratio", "VIX_MA_Regime", pl_col])
    print(f"  Matched {len(df)} trades with indicator data")

    # ── 2. Summary statistics ─────────────────────────────────────────────────
    def _stats(subset):
        pl = subset[pl_col]
        return dict(
            n        = len(subset),
            win_rate = (pl > 0).mean() * 100,
            avg_pl   = pl.mean(),
            median_pl= pl.median(),
            total_pl = pl.sum(),
            sharpe   = (pl.mean() / pl.std() * np.sqrt(252)) if pl.std() > 0 else np.nan,
        )

    baseline = _stats(df)
    rows = [{"regime": "ALL (baseline)", "range": "—", "color": "#aaaaaa", **baseline}]
    for regime in [1, 2, 3, 4, 5]:
        sub = df[df["VIX_MA_Regime"] == regime]
        if len(sub) == 0:
            continue
        rows.append({
            "regime": f"Bin {regime} – {BIN_NAMES[regime]}",
            "range":  BIN_RANGES[regime],
            "color":  BIN_COLORS[regime],
            **_stats(sub),
        })
    summary = pd.DataFrame(rows)

    # ── 3. Figure: scatter (top 60%) + table (bottom 40%) ────────────────────
    fig = plt.figure(figsize=(13, 11), facecolor="#1e1e1e")
    gs  = gridspec.GridSpec(2, 1, figure=fig, height_ratios=[1.6, 1.0], hspace=0.05)

    # ── 3a. Scatter ───────────────────────────────────────────────────────────
    ax = fig.add_subplot(gs[0])
    ax.set_facecolor("#1e1e1e")

    for regime, color in BIN_COLORS.items():
        sub = df[df["VIX_MA_Regime"] == regime]
        if len(sub) == 0:
            continue
        ax.scatter(sub["VIX_MA_Ratio"], sub[pl_col],
                   c=color, alpha=0.45, s=18,
                   label=f"Bin {regime} – {BIN_NAMES[regime]}")

    # Regression line
    slope, intercept, r, p, _ = stats.linregress(df["VIX_MA_Ratio"], df[pl_col])
    x_line = np.linspace(df["VIX_MA_Ratio"].min(), df["VIX_MA_Ratio"].max(), 200)
    ax.plot(x_line, slope * x_line + intercept,
            color="#ff8a80", linewidth=1.8, linestyle="--",
            label=f"Regression  r={r:.3f}  p={p:.3f}")

    ax.axhline(0,   color="#555555", linewidth=0.8, linestyle=":")
    ax.axvline(1.0, color="#888888", linewidth=0.8, linestyle=":", alpha=0.6)

    # Subtle background shading per bin
    for lo, hi, color in zip(VIX_MA_BINS[:-1], VIX_MA_BINS[1:], BIN_COLORS.values()):
        hi_clip = min(hi, df["VIX_MA_Ratio"].max() + 0.05)
        ax.axvspan(lo, hi_clip, alpha=0.07, color=color, linewidth=0)

    ax.set_xlabel("VIX / 20d-MA  (VIX_MA_Ratio)", color="#cccccc", fontsize=10)
    ax.set_ylabel("Trade P&L ($)", color="#cccccc", fontsize=10)
    ax.set_title("VIX/MA Regime vs Trade P&L", color="#ffffff", fontsize=13, pad=10)
    ax.tick_params(colors="#aaaaaa")
    for spine in ax.spines.values():
        spine.set_edgecolor("#444444")
    ax.legend(fontsize=8, framealpha=0.3, labelcolor="#cccccc",
              facecolor="#2a2a2a", edgecolor="#444444")

    # ── 3b. Summary table ─────────────────────────────────────────────────────
    ax2 = fig.add_subplot(gs[1])
    ax2.set_facecolor("#1e1e1e")
    ax2.axis("off")

    col_labels = ["Regime", "VIX/MA Range", "Trades", "Win%", "Avg P&L", "Median P&L", "Sharpe"]
    col_widths  = [0.23, 0.13, 0.09, 0.10, 0.13, 0.14, 0.10]
    col_x       = list(np.cumsum([0] + col_widths[:-1]))
    n_rows      = len(summary) + 1          # +1 header
    row_h       = 0.92 / n_rows             # leave 8% margin at top

    def _cell(x, y, w, h, text, fc, bold=False, align="left", text_color=None):
        rect = FancyBboxPatch((x, y), w, h,
                              boxstyle="square,pad=0",
                              transform=ax2.transAxes,
                              facecolor=fc, edgecolor="#333333",
                              linewidth=0.5, clip_on=False)
        ax2.add_patch(rect)
        tc = text_color or ("#ffffff" if bold else "#d0d0d0")
        xp = x + w / 2 if align == "center" else x + 0.009
        ax2.text(xp, y + h / 2, text,
                 transform=ax2.transAxes,
                 ha=align, va="center", fontsize=8.5,
                 fontweight="bold" if bold else "normal",
                 color=tc, family="monospace")

    # Header row
    y_hdr = 1.0 - row_h
    for label, cx, cw in zip(col_labels, col_x, col_widths):
        _cell(cx, y_hdr, cw, row_h, label, "#2a2a2a", bold=True, align="center")

    # Data rows
    for i, row in enumerate(summary.itertuples()):
        y_row = 1.0 - (i + 2) * row_h
        fc_bg = "#242424" if i % 2 == 0 else "#2e2e2e"

        # ── Regime label cell (with colour dot) ──
        _cell(col_x[0], y_row, col_widths[0], row_h,
              f"  {row.regime}", fc_bg, bold=(i == 0))
        ax2.text(col_x[0] + 0.006, y_row + row_h / 2, "●",
                 transform=ax2.transAxes, va="center",
                 fontsize=9, color=row.color, family="monospace")

        # ── Remaining cells ──
        cell_data = [
            (row.range,   fc_bg,  None),
            (f"{row.n:,}", fc_bg,  None),
        ]
        # Win% – colour vs baseline
        if i == 0:
            cell_data.append((f"{row.win_rate:.1f}%", fc_bg, None))
        else:
            wc = "#1a3a1a" if row.win_rate >= baseline["win_rate"] else "#3a1a1a"
            cell_data.append((f"{row.win_rate:.1f}%", wc, None))

        cell_data.append((f"${row.avg_pl:+.1f}",    fc_bg, None))
        cell_data.append((f"${row.median_pl:+.1f}", fc_bg, None))

        # Sharpe – colour vs baseline
        sh_str = f"{row.sharpe:.2f}" if not np.isnan(row.sharpe) else "—"
        if i == 0 or np.isnan(row.sharpe):
            cell_data.append((sh_str, fc_bg, None))
        else:
            sc = "#1a3a1a" if row.sharpe >= baseline["sharpe"] else "#3a1a1a"
            cell_data.append((sh_str, sc, None))

        for j, ((val, fc, tc), cx, cw) in enumerate(
                zip(cell_data, col_x[1:], col_widths[1:])):
            _cell(cx, y_row, cw, row_h, val, fc, align="center", text_color=tc)

    title_block = "  " + (block_id if block_id else "all blocks")
    ax2.text(0.5, 1.0 - row_h * 0.35,
             f"Performance by VIX/MA Regime  –  {title_block}",
             transform=ax2.transAxes, ha="center", va="center",
             fontsize=9, color="#aaaaaa", family="monospace")

    plt.savefig(output_png, dpi=160, bbox_inches="tight", facecolor="#1e1e1e")
    plt.close(fig)
    print(f"✓ Figure saved -> {output_png}")

    # ── 4. Correlation figure ─────────────────────────────────────────────────
    corr_png = output_png.replace(".png", "_correlation.png")
    _plot_correlation(df, summary, baseline, corr_png, pl_col)
    return summary


def _plot_correlation(df, summary, baseline, output_png, pl_col="pl"):
    """
    3-panel correlation figure:
      Left  : Box plot of P&L per regime bin
      Middle: Pearson + Spearman bars + lagged correlations
      Right : Key statistics table (r, p-value, ANOVA, eta², Kruskal-Wallis)
    """
    import matplotlib.pyplot as plt
    import matplotlib.gridspec as gridspec
    from scipy import stats

    fig = plt.figure(figsize=(16, 7), facecolor="#1e1e1e")
    gs  = gridspec.GridSpec(1, 3, figure=fig, width_ratios=[1.2, 1.0, 1.1], wspace=0.35)
    DARK, LIGHT = "#1e1e1e", "#d0d0d0"

    def style_ax(ax, title):
        ax.set_facecolor("#262626")
        ax.set_title(title, color="#ffffff", fontsize=10, pad=8)
        ax.tick_params(colors="#aaaaaa", labelsize=8)
        for sp in ax.spines.values():
            sp.set_edgecolor("#444444")

    # ── Panel 1: Box plot ─────────────────────────────────────────────────────
    ax1 = fig.add_subplot(gs[0])
    style_ax(ax1, "P&L Distribution by VIX/MA Regime")
    bins_present = sorted(df["VIX_MA_Regime"].dropna().unique())
    plot_data    = [df[df["VIX_MA_Regime"] == b][pl_col].dropna().values for b in bins_present]
    labels       = [f"Bin {int(b)}\n{BIN_NAMES[int(b)]}" for b in bins_present]
    colors       = [BIN_COLORS[int(b)] for b in bins_present]
    bp = ax1.boxplot(plot_data, patch_artist=True,
                     medianprops=dict(color="#ffffff", linewidth=1.5),
                     whiskerprops=dict(color="#888888"), capprops=dict(color="#888888"),
                     flierprops=dict(marker="o", markersize=2, markerfacecolor="#666666", alpha=0.4))
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color); patch.set_alpha(0.65)
    ax1.axhline(0, color="#555555", linewidth=0.8, linestyle=":")
    ax1.axhline(baseline["avg_pl"], color="#ff8a80", linewidth=1.0, linestyle="--",
                alpha=0.7, label=f"Baseline avg ${baseline['avg_pl']:+.1f}")
    ax1.set_xticklabels(labels, color="#aaaaaa", fontsize=7.5)
    ax1.set_ylabel("P&L ($)", color=LIGHT, fontsize=9)
    ax1.legend(fontsize=7.5, framealpha=0.3, labelcolor=LIGHT, facecolor="#2a2a2a", edgecolor="#444444")

    # ── Panel 2: Correlation bars ─────────────────────────────────────────────
    ax2 = fig.add_subplot(gs[1])
    style_ax(ax2, "Correlation: VIX/MA_Ratio → P&L")
    ratio = df["VIX_MA_Ratio"]; pl = df[pl_col]
    pearson_r,  pearson_p  = stats.pearsonr(ratio, pl)
    spearman_r, spearman_p = stats.spearmanr(ratio, pl)
    df2 = df[["VIX_MA_Ratio", pl_col]].copy().dropna()
    df2["ratio_lag1"] = df2["VIX_MA_Ratio"].shift(1)
    df2["ratio_lag2"] = df2["VIX_MA_Ratio"].shift(2)
    df2 = df2.dropna()
    lag1_r, lag1_p = stats.pearsonr(df2["ratio_lag1"], df2[pl_col])
    lag2_r, lag2_p = stats.pearsonr(df2["ratio_lag2"], df2[pl_col])
    bar_labels = ["Pearson\n(same day)", "Spearman\n(same day)", "Pearson\n(lag 1d)", "Pearson\n(lag 2d)"]
    bar_vals   = [pearson_r, spearman_r, lag1_r, lag2_r]
    bar_ps     = [pearson_p, spearman_p, lag1_p, lag2_p]
    bar_colors = ["#4fc3f7" if v >= 0 else "#e57373" for v in bar_vals]
    bars = ax2.barh(bar_labels, bar_vals, color=bar_colors, alpha=0.75, height=0.5)
    ax2.axvline(0, color="#555555", linewidth=0.8)
    for bar, val, pv in zip(bars, bar_vals, bar_ps):
        sig  = "***" if pv < 0.001 else "**" if pv < 0.01 else "*" if pv < 0.05 else ""
        xoff = 0.008 if val >= 0 else -0.008
        ha   = "left" if val >= 0 else "right"
        ax2.text(val + xoff, bar.get_y() + bar.get_height() / 2,
                 f"{val:+.3f}{sig}", va="center", ha=ha, color="#ffffff", fontsize=8.5, family="monospace")
    ax2.set_xlabel("Correlation coefficient", color=LIGHT, fontsize=9)
    ax2.set_xlim(-0.5, 0.5)
    ax2.text(0.02, 0.04, "* p<.05  ** p<.01  *** p<.001",
             transform=ax2.transAxes, fontsize=7, color="#888888", ha="left", va="bottom")

    # ── Panel 3: Key Statistics table ────────────────────────────────────────
    ax3 = fig.add_subplot(gs[2])
    style_ax(ax3, "Key Statistics")
    ax3.axis("off")
    groups    = [df[df["VIX_MA_Regime"] == b][pl_col].dropna().values
                 for b in bins_present if len(df[df["VIX_MA_Regime"] == b]) >= 5]
    f_stat, anova_p = stats.f_oneway(*groups) if len(groups) >= 2 else (np.nan, np.nan)
    grand_mean = pl.mean()
    ss_between = sum(len(g) * (g.mean() - grand_mean) ** 2 for g in groups)
    ss_total   = sum((pl - grand_mean) ** 2)
    eta_sq     = ss_between / ss_total if ss_total > 0 else np.nan
    kw_stat, kw_p = stats.kruskal(*groups) if len(groups) >= 2 else (np.nan, np.nan)
    stats_rows = [
        ("CORRELATION (ratio vs P&L)", "", True),
        ("Pearson r",          f"{pearson_r:+.4f}", False),
        ("Pearson p-value",    f"{pearson_p:.4f}",  False),
        ("Spearman ρ",         f"{spearman_r:+.4f}", False),
        ("Spearman p-value",   f"{spearman_p:.4f}", False),
        ("", "", False),
        ("REGIME GROUP TESTS", "", True),
        ("ANOVA F-stat",       f"{f_stat:.3f}" if not np.isnan(f_stat) else "—", False),
        ("ANOVA p-value",      f"{anova_p:.4f}" if not np.isnan(anova_p) else "—", False),
        ("Eta² (effect size)", f"{eta_sq:.4f}" if not np.isnan(eta_sq) else "—", False),
        ("Kruskal-Wallis H",   f"{kw_stat:.3f}" if not np.isnan(kw_stat) else "—", False),
        ("KW p-value",         f"{kw_p:.4f}" if not np.isnan(kw_p) else "—", False),
        ("", "", False),
        ("DATA OVERVIEW", "", True),
        ("Total trades",       f"{len(df):,}", False),
        ("Date range",         f"{df.index.min().strftime('%Y-%m-%d')}", False),
        ("  →",                f"{df.index.max().strftime('%Y-%m-%d')}", False),
    ]
    for b in bins_present:
        n = int((df["VIX_MA_Regime"] == b).sum())
        stats_rows.append((f"  Bin {int(b)} N", f"{n:,}", False))
    row_h = 1.0 / (len(stats_rows) + 1)
    for i, (label, value, header) in enumerate(stats_rows):
        y = 1.0 - (i + 1) * row_h
        if header:
            ax3.text(0.02, y + row_h * 0.4, label, transform=ax3.transAxes,
                     fontsize=8, fontweight="bold", color="#4fc3f7", family="monospace", va="center")
        else:
            ax3.text(0.02, y + row_h * 0.4, label, transform=ax3.transAxes,
                     fontsize=8.2, color="#aaaaaa", family="monospace", va="center")
            ax3.text(0.98, y + row_h * 0.4, value, transform=ax3.transAxes,
                     fontsize=8.2, color="#ffffff", family="monospace", va="center", ha="right")
    fig.suptitle("VIX/MA Regime – Correlation & Statistical Analysis",
                 color="#ffffff", fontsize=12, y=1.01)
    plt.savefig(output_png, dpi=160, bbox_inches="tight", facecolor=DARK)
    plt.close(fig)
    print(f"✓ Correlation figure saved -> {output_png}")


def merge_with_existing(new_df, path):
    existing = pd.read_csv(path, parse_dates=["date"], index_col="date")
    builtin  = ["VIX_MA_Ratio", "VIX_MA_Regime", "VIX_MA_Label"]
    prop     = existing.drop(columns=[c for c in builtin if c in existing.columns], errors="ignore")
    return new_df.combine_first(prop).sort_index()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start",     default=DEFAULT_START)
    p.add_argument("--end",       default=None)
    p.add_argument("--output",    default=DEFAULT_OUTPUT)
    p.add_argument("--merge",     action="store_true")
    p.add_argument("--ma-window", type=int, default=20)
    # ── VRP mode ──
    p.add_argument("--vrp",    action="store_true",
                   help="Compute VRP_daily + VRP_MA20 from OptionOmega straddle log")
    p.add_argument("--trades", default=DEFAULT_TRADELOG, metavar="TRADELOG_CSV",
                   help=f"OptionOmega straddle tradelog CSV (default: {DEFAULT_TRADELOG})")
    p.add_argument("--spx",    default=None, metavar="SPX_CSV",
                   help="Optional path to spx_daily.csv for RV calculation (else yfinance)")
    # ── Analysis mode ──
    p.add_argument("--analyze",     metavar="TRADES_CSV",
                   help="Run regime analysis against a TradeBlocks tradelog CSV")
    p.add_argument("--block-id",    default=None,
                   help="Filter trades to this block_id")
    p.add_argument("--plot-output", default="vix_regime_analysis.png",
                   help="Output PNG for regime analysis plot")
    args = p.parse_args()

    end = args.end or datetime.today().strftime("%Y-%m-%d")
    out = Path(args.output)
    tradelog = args.trades if args.vrp else None
    df  = build(args.start, end, ma_window=args.ma_window,
                tradelog_path=tradelog, spx_source=args.spx)

    if args.merge and out.exists():
        print(f"Merging with {out} ...")
        df = merge_with_existing(df, out)

    df.index = df.index.strftime("%Y-%m-%d")
    df.to_csv(out, index=True, index_label="date")
    print(f"✓ Written {len(df)} rows -> {out}")

    if args.analyze:
        print(f"\nRunning regime analysis: {args.analyze}")
        summary = analyze_regime_performance(
            trades_csv     = args.analyze,
            indicators_csv = str(out),
            block_id       = args.block_id,
            output_png     = args.plot_output,
        )
        print("\n" + summary.to_string(index=False))


if __name__ == "__main__":
    main()
