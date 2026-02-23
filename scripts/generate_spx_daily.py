#!/usr/bin/env python3
"""
Generate spx_daily.csv for TradeBlocks market data table.
Uses Yahoo Finance for SPX, VIX, VIX9D (^VIX9D), VIX3M (^VIX3M).
"""

import argparse
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import yfinance as yf

DEFAULT_START = "2022-01-01"
DEFAULT_OUTPUT = "/home/tradeblocks/data/_marketdata/spx_daily.csv"
TICKER_SPX  = "^GSPC"
TICKER_VIX  = "^VIX"
TICKER_VIX9D = "^VIX9D"
TICKER_VIX3M = "^VIX3M"

def download(ticker, start, end):
    df = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"No data for {ticker}")
    df.index = pd.to_datetime(df.index).normalize()
    df.index.name = "date"
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df[["Open","High","Low","Close"]].copy()

def rsi(s, n=14):
    d = s.diff()
    g = d.clip(lower=0).ewm(com=n-1,min_periods=n).mean()
    l = (-d.clip(upper=0)).ewm(com=n-1,min_periods=n).mean()
    return 100 - 100/(1 + g/l.replace(0,np.nan))

def atr(h,l,c,n=14):
    pc = c.shift(1)
    tr = pd.concat([h-l,(h-pc).abs(),(l-pc).abs()],axis=1).max(axis=1)
    return tr.ewm(com=n-1,min_periods=n).mean()

def ema(s,n): return s.ewm(span=n,adjust=False).mean()
def sma(s,n): return s.rolling(n).mean()

def bollinger(c,w=20,ns=2):
    m=c.rolling(w).mean(); s=c.rolling(w).std()
    return ((c-m+ns*s)/(2*ns*s)).clip(0,1)

def trend_score(c):
    e21=ema(c,21); e50=ema(c,50); e200=ema(c,200)
    slope=e21.diff(5)/e21.shift(5)*100
    sc = np.sign(c-e21)+np.sign(c-e50)+np.sign(c-e200)
    sc += np.where(slope>0.5,1,0)+np.where(slope<-0.5,-1,0)
    return pd.Series(sc,index=c.index).round().astype(int).clip(-5,5)

def vol_regime(v):
    return pd.cut(v,bins=[-np.inf,12,15,20,25,35,np.inf],labels=[1,2,3,4,5,6]).astype(float).astype("Int64")

def term_state(r9d, rvx3m):
    s = pd.Series(0,index=r9d.index)
    s[(r9d<=1)&(rvx3m<=1)] = 1
    s[(r9d>1)&(rvx3m>1)] = -1
    return s

def consec(ret):
    res=[]; streak=0
    for r in ret:
        if pd.isna(r): streak=0
        elif r>0: streak=max(streak+1,1)
        elif r<0: streak=min(streak-1,-1)
        else: streak=0
        res.append(streak)
    return pd.Series(res,index=ret.index)

def is_opex(idx):
    res=pd.Series(0,index=idx)
    for dt in idx:
        f=dt.replace(day=1)
        ff=f+timedelta(days=(4-f.weekday())%7)
        tf=ff+timedelta(weeks=2)
        if dt.date()==tf.date(): res[dt]=1
    return res

def vix_pct(v,w=252): return v.rolling(w,min_periods=20).rank(pct=True)*100

def build(start, output):
    ws = (pd.Timestamp(start)-pd.Timedelta(days=400)).strftime("%Y-%m-%d")
    end = (datetime.today()+timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"Downloading SPX..."); spx = download(TICKER_SPX, ws, end)
    print(f"Downloading VIX..."); vix = download(TICKER_VIX, ws, end)
    print(f"Downloading VIX9D...")
    try: vix9d = download(TICKER_VIX9D, ws, end)
    except: print("  VIX9D unavailable"); vix9d = pd.DataFrame(index=spx.index,columns=["Open","Close"],dtype=float)
    print(f"Downloading VIX3M...")
    try: vix3m = download(TICKER_VIX3M, ws, end)
    except: print("  VIX3M unavailable"); vix3m = pd.DataFrame(index=spx.index,columns=["Open","Close"],dtype=float)

    idx = spx.index
    vix=vix.reindex(idx); vix9d=vix9d.reindex(idx); vix3m=vix3m.reindex(idx)

    df=pd.DataFrame(index=idx); df.index.name="date"
    df["ticker"]="SPX"; df["date"]=df.index.strftime("%Y-%m-%d")
    import pytz; eastern=pytz.timezone("America/New_York")
    df["time"]=df.index.map(lambda d: int(eastern.localize(d.to_pydatetime().replace(hour=16)).timestamp()))
    df["Prior_Close"]=spx["Close"].shift(1)
    df["open"]=spx["Open"]; df["high"]=spx["High"]; df["low"]=spx["Low"]; df["close"]=spx["Close"]
    df["Intraday_High"]=spx["High"]; df["Intraday_Low"]=spx["Low"]

    df["Gap_Pct"]=(df["open"]-df["Prior_Close"])/df["Prior_Close"]*100
    df["Intraday_Range_Pct"]=(df["high"]-df["low"])/df["open"]*100
    df["Intraday_Return_Pct"]=(df["close"]-df["open"])/df["open"]*100
    df["Total_Return_Pct"]=(df["close"]-df["Prior_Close"])/df["Prior_Close"]*100
    df["Close_Position_In_Range"]=((df["close"]-df["low"])/(df["high"]-df["low"])).clip(0,1)
    df["Gap_Filled"]=((df["Gap_Pct"]>0)&(df["low"]<=df["Prior_Close"])|(df["Gap_Pct"]<0)&(df["high"]>=df["Prior_Close"])).astype(int)
    df["Return_5D"]=spx["Close"].pct_change(5)*100; df["Return_20D"]=spx["Close"].pct_change(20)*100
    df["Prev_Return_Pct"]=df["Total_Return_Pct"].shift(1)
    df["Consecutive_Days"]=consec(df["Total_Return_Pct"])

    df["RSI_14"]=rsi(spx["Close"]); a=atr(spx["High"],spx["Low"],spx["Close"])
    df["ATR_Pct"]=a/spx["Close"]*100
    df["Price_vs_EMA21_Pct"]=(spx["Close"]/ema(spx["Close"],21)-1)*100
    df["Price_vs_SMA50_Pct"]=(spx["Close"]/sma(spx["Close"],50)-1)*100
    df["BB_Position"]=bollinger(spx["Close"]); df["Trend_Score"]=trend_score(spx["Close"])
    df["Day_of_Week"]=df.index.dayofweek+2; df["Month"]=df.index.month; df["Is_Opex"]=is_opex(df.index)

    df["VIX_Open"]=vix["Open"]; df["VIX_Close"]=vix["Close"]
    df["VIX_High"]=vix["High"]; df["VIX_Low"]=vix["Low"]
    df["VIX_Change_Pct"]=vix["Close"].pct_change()*100
    df["VIX_Gap_Pct"]=(vix["Open"]-vix["Close"].shift(1))/vix["Close"].shift(1)*100
    df["VIX_Spike_Pct"]=(vix["High"]-vix["Open"])/vix["Open"]*100
    df["VIX_Percentile"]=vix_pct(vix["Close"])

    df["VIX9D_Open"]=vix9d.get("Open",pd.Series(dtype=float)).reindex(idx)
    df["VIX9D_Close"]=vix9d.get("Close",pd.Series(dtype=float)).reindex(idx)
    df["VIX9D_Change_Pct"]=df["VIX9D_Close"].pct_change()*100
    df["VIX3M_Open"]=vix3m.get("Open",pd.Series(dtype=float)).reindex(idx)
    df["VIX3M_Close"]=vix3m.get("Close",pd.Series(dtype=float)).reindex(idx)
    df["VIX3M_Change_Pct"]=df["VIX3M_Close"].pct_change()*100

    df["VIX9D_VIX_Ratio"]=df["VIX9D_Close"]/df["VIX_Close"]
    df["VIX_VIX3M_Ratio"]=df["VIX_Close"]/df["VIX3M_Close"]
    df["Vol_Regime"]=vol_regime(df["VIX_Close"])
    df["Term_Structure_State"]=term_state(df["VIX9D_VIX_Ratio"],df["VIX_VIX3M_Ratio"])

    for c in ["High_Time","Low_Time","High_Before_Low","High_In_First_Hour","Low_In_First_Hour",
              "High_In_Last_Hour","Low_In_Last_Hour","Reversal_Type","High_Low_Spread","Early_Extreme","Late_Extreme"]:
        df[c]=np.nan

    df=df[df.index>=pd.Timestamp(start)]
    cols=["time","ticker","date","Prior_Close","open","high","low","close",
          "Gap_Pct","Intraday_Range_Pct","Intraday_Return_Pct","Total_Return_Pct",
          "Close_Position_In_Range","Gap_Filled",
          "VIX_Open","VIX_Close","VIX_Change_Pct","VIX_Spike_Pct","VIX_Percentile","Vol_Regime",
          "VIX9D_Open","VIX9D_Close","VIX9D_Change_Pct",
          "VIX3M_Open","VIX3M_Close","VIX3M_Change_Pct",
          "VIX9D_VIX_Ratio","VIX_VIX3M_Ratio","Term_Structure_State",
          "ATR_Pct","RSI_14","Price_vs_EMA21_Pct","Price_vs_SMA50_Pct","Trend_Score","BB_Position",
          "Return_5D","Return_20D","Consecutive_Days","Day_of_Week","Month","Is_Opex","Prev_Return_Pct",
          "High_Time","Low_Time","High_Before_Low","High_In_First_Hour","Low_In_First_Hour",
          "High_In_Last_Hour","Low_In_Last_Hour","Reversal_Type","High_Low_Spread","Early_Extreme","Late_Extreme",
          "Intraday_High","Intraday_Low","VIX_High","VIX_Low","VIX_Gap_Pct"]
    df=df.reindex(columns=cols)

    import os; os.makedirs(os.path.dirname(output),exist_ok=True)
    df.to_csv(output,index=False,float_format="%.6f")
    print(f"\n✅  {len(df)} rows → {output}")
    print(f"   Range: {df['date'].iloc[0]} → {df['date'].iloc[-1]}")
    # Check VIX9D/VIX3M availability
    n9d = df["VIX9D_Close"].notna().sum()
    n3m = df["VIX3M_Close"].notna().sum()
    print(f"   VIX9D rows: {n9d}, VIX3M rows: {n3m}")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--start",default=DEFAULT_START)
    p.add_argument("--output",default=DEFAULT_OUTPUT)
    a=p.parse_args()
    build(a.start,a.output)
