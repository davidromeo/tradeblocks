# Web Platform Integration Guide

Connect TradeBlocks MCP to web-based AI platforms for trading analysis from your browser.

## Overview

Web AI platforms like ChatGPT, Google AI Studio, and Julius require **remote MCP server URLs** - they cannot connect to servers running on localhost. TradeBlocks MCP runs locally to keep your backtest data on your machine.

**Solution:** Use an ngrok tunnel to expose your local MCP server as a remote URL. This approach:
- Keeps your trading data on your local machine
- Allows web platforms to connect via secure HTTPS
- Requires no cloud deployment or data uploads

## Platform Compatibility

| Platform | MCP Support | Plan Required | Setup Complexity |
|----------|-------------|---------------|------------------|
| ChatGPT | Developer Mode | Pro/Plus/Business/Enterprise/Edu | Medium |
| Google AI Studio | Native | Free | Easy |
| Julius AI | Native | Free tier available | Easy |

## Prerequisites

Before setting up any web platform:

1. **Node.js 18+** - Required for TradeBlocks MCP
2. **ngrok account** - Free tier works ([sign up at ngrok.com](https://ngrok.com))
3. **TradeBlocks MCP installed**:
   ```bash
   npm install -g tradeblocks-mcp
   ```
4. **Backtest data directory** - Folder with your strategy CSV files

## Quick Start (All Platforms)

**Terminal 1:** Start MCP server with HTTP transport:
```bash
npx tradeblocks-mcp --http --port 3100 ~/Trading/backtests
```

**Terminal 2:** Expose via ngrok:
```bash
ngrok http 3100
```

Note the ngrok URL (e.g., `https://abc123.ngrok.io`) - you'll need this for platform setup.

---

