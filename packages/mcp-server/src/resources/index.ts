/**
 * MCP Resources
 *
 * Provides documentation and guides as MCP resources that Claude can read.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const OPTIONOMEGA_GUIDE = `# Option Omega Backtest Setup for TradeBlocks

## Supported Assets
SPY, SPX (afternoon expirations only), QQQ, IWM, AAPL, TSLA
- Historical data from January 1, 2013 through previous trading day
- Data updates overnight (3-5am ET), available before market open

## Strategy Configuration

### Strike Selection Methods
- **Delta**: Select strikes by delta value (default)
- **Percentage OTM**: Target specific out-of-the-money distances
- **Fixed Premium**: Choose strikes nearest a specified price
- **Strike Offset**: Position relative to parent legs (for linked legs)

### Option Legs
- Up to 8 legs per backtest
- Linked legs for dependent strike selections
- Round strikes to nearest multiples for liquidity

## Entry Configuration

### Timing
- Entry window: 9:32am - 3:59pm ET (1-minute intervals)
- Frequency: Daily, Weekly (specific days), Monthly (specific dates), or Specific Dates

### Entry Filters (Optional)
- VIX levels (min/max), VIX movement
- Technical indicators: RSI (14-day), SMA, EMA
- Opening Range Breakout (ORB)
- Gap conditions, intraday movement
- SqueezeMetrics: DIX, GEX, GXV

## Exit Conditions

### Profit/Loss Targets
- Percentage-based
- Fixed dollar amount
- Closing order price

### Stop Loss Options
- Fixed stop loss
- Trailing stop (recalculated or fixed)
- 0-DTE intra-minute stops (SPX/SPY only)
- Per-leg stop loss

### Time-Based Exits
- By DTE remaining
- Days in trade
- Minutes in trade

### Other Exits
- Technical indicator triggers
- Delta-based (position or leg level)
- Short tested / underlying movement

## Risk Controls (The Punisher)
- Commission/fee modeling (per contract)
- Slippage adjustments (entry, exit, stop loss)
- Bid-ask spread filter (default: 10,000 bps max)
- Consecutive hits requirement (2 intervals at target/stop)
- Min/max entry premium filters
- Blackout days
- Re-entry delays after exits

## Data Quality Notes
- Uses mid-price from OPRA bid/ask data
- 1-minute resolution (open price for signals)
- RTH only (9:30-4:00 market time)
- SPX uses standard EOD contracts only (no AM expirations)
- Calendar days for DTE calculations
- March 2020 / Spring 2025 show unusual volatility

## Exporting for TradeBlocks

1. Run your backtest in Option Omega
2. Go to Results -> Trade Log
3. Click Export/Download CSV
4. Create a new folder in your Trading Data Directory (e.g., \`my-strategy-2024\`)
5. Save the CSV as \`tradelog.csv\` in that folder
6. Run \`list_blocks\` to see your new block

TradeBlocks expects these columns (Option Omega exports them automatically):
- Date Opened, Time Opened
- Date Closed, Time Closed
- P/L, Strategy, Legs
- No. of Contracts, Premium
- Opening/Closing Prices
- Reason For Close

**Note**: The visual context from Option Omega's trade log (replay, charts) is lost in CSV export. TradeBlocks provides its own analysis tools to compensate.
`;

/**
 * Register MCP resources
 */
export function registerResources(server: McpServer): void {
  // Resource: Option Omega Guide
  server.resource(
    "optionomega-guide",
    "tradeblocks://guides/optionomega",
    {
      description:
        "Guide for setting up Option Omega backtests that export clean data for TradeBlocks analysis. " +
        "Covers supported assets, strike selection, entry/exit conditions, risk controls, and export instructions.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "tradeblocks://guides/optionomega",
          mimeType: "text/markdown",
          text: OPTIONOMEGA_GUIDE,
        },
      ],
    })
  );
}
