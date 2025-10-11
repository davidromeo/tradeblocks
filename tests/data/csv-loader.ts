import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Trade } from '@/lib/models/trade';
import { DailyLogEntry } from '@/lib/models/daily-log';
import { DataLoader } from '@/lib/processing/data-loader';

/**
 * CSV Test Data Loader
 *
 * Loads test data from CSV files if available, falls back to mock data
 * Place test files in tests/data/:
 * - tradelog.csv
 * - dailylog.csv
 */
export class CsvTestDataLoader {
  private static readonly TEST_DATA_DIR = join(process.cwd(), 'tests', 'data');
  private static readonly TRADE_LOG_FILE = 'tradelog.csv';
  private static readonly DAILY_LOG_FILE = 'dailylog.csv';

  private static dataLoader = DataLoader.createForTesting({ useMemoryStorage: true });

  /**
   * Load trades from CSV file or return mock data
   */
  static async loadTrades(): Promise<{ trades: Trade[]; source: 'csv' | 'mock' }> {
    const csvPath = join(this.TEST_DATA_DIR, this.TRADE_LOG_FILE);

    if (existsSync(csvPath)) {
      try {
        console.log(`Loading trades from CSV: ${csvPath}`);
        const csvContent = readFileSync(csvPath, 'utf-8');

        const result = await this.dataLoader.loadTrades(csvContent);

        if (result.data && result.data.length > 0) {
          console.log(`Loaded ${result.data.length} trades from CSV`);
          return { trades: result.data, source: 'csv' };
        } else {
          console.warn('No trades found in CSV, falling back to mock data');
          if (result.errors.length > 0) {
            console.warn('Errors:', result.errors);
          }
          return this.getMockTrades();
        }
      } catch (error) {
        console.warn('Error loading CSV file, falling back to mock data:', error);
        return this.getMockTrades();
      }
    } else {
      console.log('No CSV trade file found, using mock data');
      return this.getMockTrades();
    }
  }

  /**
   * Load daily logs from CSV file or return mock data
   */
  static async loadDailyLogs(): Promise<{ dailyLogs: DailyLogEntry[]; source: 'csv' | 'mock' }> {
    const csvPath = join(this.TEST_DATA_DIR, this.DAILY_LOG_FILE);

    if (existsSync(csvPath)) {
      try {
        console.log(`Loading daily logs from CSV: ${csvPath}`);
        const csvContent = readFileSync(csvPath, 'utf-8');

        const result = await this.dataLoader.loadDailyLogs(csvContent);

        if (result.data && result.data.length > 0) {
          console.log(`Loaded ${result.data.length} daily log entries from CSV`);
          return { dailyLogs: result.data, source: 'csv' };
        } else {
          console.warn('No daily logs found or not implemented, falling back to mock data');
          return this.getMockDailyLogs();
        }
      } catch (error) {
        console.warn('Error loading CSV file, falling back to mock data:', error);
        return this.getMockDailyLogs();
      }
    } else {
      console.log('No CSV daily log file found, using mock data');
      return this.getMockDailyLogs();
    }
  }

  /**
   * Get mock trades
   */
  private static getMockTrades(): { trades: Trade[]; source: 'mock' } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockTrades } = require('./mock-trades');
    return { trades: mockTrades, source: 'mock' };
  }

  /**
   * Get mock daily logs
   */
  private static getMockDailyLogs(): { dailyLogs: DailyLogEntry[]; source: 'mock' } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockDailyLogs } = require('./mock-daily-logs');
    return { dailyLogs: mockDailyLogs, source: 'mock' };
  }

  /**
   * Load both trades and daily logs
   */
  static async loadTestData(): Promise<{
    trades: Trade[];
    dailyLogs: DailyLogEntry[];
    sources: { trades: 'csv' | 'mock'; dailyLogs: 'csv' | 'mock' };
  }> {
    const [tradesResult, dailyLogsResult] = await Promise.all([
      this.loadTrades(),
      this.loadDailyLogs(),
    ]);

    return {
      trades: tradesResult.trades,
      dailyLogs: dailyLogsResult.dailyLogs,
      sources: {
        trades: tradesResult.source,
        dailyLogs: dailyLogsResult.source,
      },
    };
  }

  /**
   * Load and store test data with a test block ID
   */
  static async loadAndStoreTestData(blockId: string = 'test-block'): Promise<{
    trades: Trade[];
    dailyLogs: DailyLogEntry[];
    blockId: string;
  }> {
    const csvPath = join(this.TEST_DATA_DIR, this.TRADE_LOG_FILE);
    const dailyLogPath = join(this.TEST_DATA_DIR, this.DAILY_LOG_FILE);

    let tradeContent: string;
    let dailyLogContent: string | undefined;

    // Load trade CSV or use mock data
    if (existsSync(csvPath)) {
      tradeContent = readFileSync(csvPath, 'utf-8');
    } else {
      // Convert mock trades to CSV format
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockTrades } = require('./mock-trades');
      tradeContent = this.tradesToCSV(mockTrades);
    }

    // Load daily log CSV if exists
    if (existsSync(dailyLogPath)) {
      dailyLogContent = readFileSync(dailyLogPath, 'utf-8');
    }

    // Load and store using data loader
    const result = await this.dataLoader.loadBlockData(blockId, tradeContent, dailyLogContent);

    return {
      trades: result.trades.data,
      dailyLogs: result.dailyLogs?.data || [],
      blockId,
    };
  }

  /**
   * Get stored test data for a block
   */
  static async getStoredTestData(blockId: string = 'test-block'): Promise<{
    trades: Trade[];
    dailyLogs: DailyLogEntry[];
  } | null> {
    return this.dataLoader.getBlockData(blockId);
  }

  /**
   * Clear stored test data
   */
  static async clearStoredTestData(blockId: string = 'test-block'): Promise<void> {
    await this.dataLoader.clearBlockData(blockId);
  }

  /**
   * Convert trades to CSV format for testing
   */
  private static tradesToCSV(trades: Trade[]): string {
    const headers = [
      'Date Opened', 'Time Opened', 'Opening Price', 'Legs', 'Premium',
      'Closing Price', 'Date Closed', 'Time Closed', 'Avg. Closing Cost',
      'Reason For Close', 'P/L', 'No. of Contracts', 'Funds at Close',
      'Margin Req.', 'Strategy', 'Opening Commissions + Fees',
      'Closing Commissions + Fees', 'Opening Short/Long Ratio',
      'Closing Short/Long Ratio', 'Opening VIX', 'Closing VIX',
      'Gap', 'Movement', 'Max Profit', 'Max Loss'
    ];

    const rows = trades.map(trade => [
      trade.dateOpened instanceof Date ? trade.dateOpened.toISOString().split('T')[0] : trade.dateOpened,
      trade.timeOpened,
      trade.openingPrice,
      `"${trade.legs}"`,
      trade.premium,
      trade.closingPrice || '',
      trade.dateClosed instanceof Date ? trade.dateClosed.toISOString().split('T')[0] : (trade.dateClosed || ''),
      trade.timeClosed || '',
      trade.avgClosingCost || '',
      trade.reasonForClose || '',
      trade.pl,
      trade.numContracts,
      trade.fundsAtClose,
      trade.marginReq,
      trade.strategy,
      trade.openingCommissionsFees,
      trade.closingCommissionsFees,
      trade.openingShortLongRatio,
      trade.closingShortLongRatio || '',
      trade.openingVix || '',
      trade.closingVix || '',
      trade.gap || '',
      trade.movement || '',
      trade.maxProfit || '',
      trade.maxLoss || ''
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Create README for test data
   */
  static getTestDataReadme(): string {
    return `
# Test Data Directory

This directory contains test data for portfolio calculations.

## Mock Data (Default)
- mock-trades.ts: Predefined trade data with known expected results
- mock-daily-logs.ts: Corresponding daily portfolio values

## CSV Data (Optional)
Place your test CSV files here to test against real data:

### tradelog.csv
Should contain columns matching the Trade model:
- Date Opened, Time Opened, Opening Price, Legs, Premium
- Closing Price, Date Closed, Time Closed, Avg. Closing Cost
- Reason For Close, P/L, No. of Contracts, Funds at Close
- Margin Req., Strategy, Opening Commissions + Fees
- Closing Commissions + Fees, etc.

### dailylog.csv
Should contain columns matching the DailyLogEntry model:
- Date, Net Liquidity, Current Funds, Withdrawn
- Trading Funds, Daily P/L, Daily P/L%, Drawdown%

## Usage
Tests will automatically:
1. Check for CSV files first
2. Fall back to mock data if CSV files don't exist or fail to parse
3. Report which data source is being used

This allows for both automated testing with predictable results (mock)
and validation against real trading data (CSV).
    `.trim();
  }
}

/**
 * Convenience function for loading test data
 */
export async function loadTestData() {
  return await CsvTestDataLoader.loadTestData();
}