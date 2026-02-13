import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";

// @ts-expect-error - importing from bundled output
import {
  closeConnection,
  getConnection,
  syncAllBlocks,
  syncMarketData,
} from "../../dist/test-exports.js";

const TRADE_HEADERS =
  "Date Opened,Time Opened,Date Closed,Time Closed,Opening Price,Closing Price,Legs,Premium,No. of Contracts,P/L,Strategy,Opening Commissions + Fees,Closing Commissions + Fees,Reason For Close,Funds at Close,Margin Req.";

const TS_2024_01_02 = Math.floor(
  new Date("2024-01-02T15:30:00-05:00").getTime() / 1000
);

async function writeCsv(
  baseDir: string,
  relativePath: string,
  header: string,
  rows: string[]
): Promise<void> {
  const filePath = path.join(baseDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, [header, ...rows].join("\n"));
}

describe("Market Sync Multi-Ticker", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), "market-multi-"));
  });

  afterEach(async () => {
    await closeConnection();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("syncs multiple ticker market files into ticker+date keyed tables", async () => {
    await writeCsv(
      testDir,
      "_marketdata/spx_daily.csv",
      "time,open,close,Gap_Pct",
      [`${TS_2024_01_02},4700,4720,0.2`]
    );
    await writeCsv(
      testDir,
      "_marketdata/msft_daily.csv",
      "time,open,close,Gap_Pct",
      [`${TS_2024_01_02},390,392,0.4`]
    );
    await writeCsv(
      testDir,
      "_marketdata/spx_15min.csv",
      "time,open,close,P_0930,P_0945",
      [`${TS_2024_01_02},4700,4720,4701,4705`]
    );
    await writeCsv(
      testDir,
      "_marketdata/msft_15min.csv",
      "time,open,close,P_0930,P_0945",
      [`${TS_2024_01_02},390,392,390.5,391`]
    );
    await writeCsv(
      testDir,
      "_marketdata/vix_intraday.csv",
      "time,open,close,VIX_0930,VIX_1000",
      [`${TS_2024_01_02},15,16,15.1,15.3`]
    );

    const syncResult = await syncMarketData(testDir);
    expect(syncResult.filesProcessed).toBe(5);
    expect(syncResult.filesSynced).toBe(5);
    expect(syncResult.errors).toHaveLength(0);

    const conn = await getConnection(testDir);

    const dailyRows = await conn.runAndReadAll(`
      SELECT ticker, date
      FROM market.spx_daily
      ORDER BY ticker, date
    `);
    expect(dailyRows.getRows()).toEqual([
      ["MSFT", "2024-01-02"],
      ["SPX", "2024-01-02"],
    ]);

    const intradayRows = await conn.runAndReadAll(`
      SELECT ticker, date
      FROM market.spx_15min
      ORDER BY ticker, date
    `);
    expect(intradayRows.getRows()).toEqual([
      ["MSFT", "2024-01-02"],
      ["SPX", "2024-01-02"],
    ]);

    const vixTickers = await conn.runAndReadAll(`
      SELECT DISTINCT ticker
      FROM market.vix_intraday
      ORDER BY ticker
    `);
    expect(vixTickers.getRows()).toEqual([["ALL"]]);
  });

  it("infers trade tickers from explicit Ticker column during block sync", async () => {
    await writeCsv(
      testDir,
      "mixed-block/tradelog.csv",
      `${TRADE_HEADERS},Ticker`,
      [
        "2024-01-02,09:35:00,2024-01-02,15:30:00,2.50,0.50,SPX 4800P/4750P,250,1,200,Strat A,1.50,1.50,Target,10200,5000,SPX",
        "2024-01-03,09:35:00,2024-01-03,15:30:00,3.00,0.70,MSFT 400P/390P,300,1,230,Strat B,1.50,1.50,Target,10430,10000,MSFT",
      ]
    );

    const blockSyncResult = await syncAllBlocks(testDir);
    expect(blockSyncResult.blocksSynced).toBe(1);
    expect(blockSyncResult.errors).toHaveLength(0);

    const conn = await getConnection(testDir);
    const tickers = await conn.runAndReadAll(`
      SELECT DISTINCT ticker
      FROM trades.trade_data
      WHERE block_id = 'mixed-block'
      ORDER BY ticker
    `);

    expect(tickers.getRows()).toEqual([["MSFT"], ["SPX"]]);
  });

  it("uses explicit Ticker column when legs do not include underlying symbol", async () => {
    await writeCsv(
      testDir,
      "ticker-column-block/tradelog.csv",
      `${TRADE_HEADERS},Ticker`,
      [
        "2024-01-02,09:35:00,2024-01-02,15:30:00,414.21,398.51,1 Feb 6 405 P STO 2.00 | 1 Feb 11 405 P BTO 3.35,-230,1,14.76,,1.50,1.50,Target,10200,5000,MSFT",
      ]
    );

    const blockSyncResult = await syncAllBlocks(testDir);
    expect(blockSyncResult.blocksSynced).toBe(1);
    expect(blockSyncResult.errors).toHaveLength(0);

    const conn = await getConnection(testDir);
    const tickers = await conn.runAndReadAll(`
      SELECT DISTINCT ticker
      FROM trades.trade_data
      WHERE block_id = 'ticker-column-block'
      ORDER BY ticker
    `);

    expect(tickers.getRows()).toEqual([["MSFT"]]);
  });

  it("uses explicit Symbol column and normalizes M/D/YY dates", async () => {
    await writeCsv(
      testDir,
      "symbol-column-block/tradelog.csv",
      `${TRADE_HEADERS},Symbol`,
      [
        "2/3/26,09:35:00,2/5/26,15:30:00,414.21,398.51,1 Feb 6 405 P STO 2.00 | 1 Feb 11 405 P BTO 3.35,-230,1,14.76,,1.50,1.50,Target,10200,5000,MSFT",
      ]
    );

    const blockSyncResult = await syncAllBlocks(testDir);
    expect(blockSyncResult.blocksSynced).toBe(1);
    expect(blockSyncResult.errors).toHaveLength(0);

    const conn = await getConnection(testDir);
    const tickers = await conn.runAndReadAll(`
      SELECT DISTINCT ticker
      FROM trades.trade_data
      WHERE block_id = 'symbol-column-block'
      ORDER BY ticker
    `);
    const dates = await conn.runAndReadAll(`
      SELECT CAST(MIN(date_opened) AS VARCHAR), CAST(MAX(date_closed) AS VARCHAR)
      FROM trades.trade_data
      WHERE block_id = 'symbol-column-block'
    `);

    expect(tickers.getRows()).toEqual([["MSFT"]]);
    expect(dates.getRows()).toEqual([["2026-02-03", "2026-02-05"]]);
  });

  it("ignores numeric Symbol contract prefixes when inferring ticker", async () => {
    await writeCsv(
      testDir,
      "symbol-contract-prefix-block/tradelog.csv",
      `${TRADE_HEADERS},Symbol`,
      [
        "2024-01-02,09:35:00,2024-01-02,15:30:00,414.21,398.51,1 Feb 6 405 P STO 2.00 | 1 Feb 11 405 P BTO 3.35,-230,1,14.76,,1.50,1.50,Target,10200,5000,1 Feb 6 405 P STO 2.00 | 1 Feb 11 405 P BTO 3.35",
      ]
    );

    const blockSyncResult = await syncAllBlocks(testDir);
    expect(blockSyncResult.blocksSynced).toBe(1);
    expect(blockSyncResult.errors).toHaveLength(0);

    const conn = await getConnection(testDir);
    const tickers = await conn.runAndReadAll(`
      SELECT DISTINCT ticker
      FROM trades.trade_data
      WHERE block_id = 'symbol-contract-prefix-block'
      ORDER BY ticker
    `);

    expect(tickers.getRows()).toEqual([["SPX"]]);
  });

  it("falls back to SPX when neither ticker columns nor legs provide a symbol", async () => {
    await writeCsv(
      testDir,
      "no-symbol-block/tradelog.csv",
      TRADE_HEADERS,
      [
        "2024-01-02,09:35:00,2024-01-02,15:30:00,414.21,398.51,1 Feb 6 405 P STO 2.00 | 1 Feb 11 405 P BTO 3.35,-230,1,14.76,,1.50,1.50,Target,10200,5000",
      ]
    );

    const blockSyncResult = await syncAllBlocks(testDir);
    expect(blockSyncResult.blocksSynced).toBe(1);
    expect(blockSyncResult.errors).toHaveLength(0);

    const conn = await getConnection(testDir);
    const tickers = await conn.runAndReadAll(`
      SELECT DISTINCT ticker
      FROM trades.trade_data
      WHERE block_id = 'no-symbol-block'
      ORDER BY ticker
    `);

    expect(tickers.getRows()).toEqual([["SPX"]]);
  });
});
