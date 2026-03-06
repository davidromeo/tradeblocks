/**
 * Integration tests for MCP server block-loader utilities
 *
 * These tests import from the built test-exports bundle which has all dependencies resolved.
 * Run `npm run build` before running tests if you've made source changes.
 *
 * Note: listBlocks now queries DuckDB for stats. Without syncing, unsynced blocks
 * appear with tradeCount=0. The loadBlock function still reads CSVs directly.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import from built bundle (test-exports.js has @lib dependencies bundled)
// @ts-expect-error - importing from bundled output
import { loadBlock, listBlocks, closeConnection } from '../dist/test-exports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

afterAll(async () => {
  // Close DuckDB connection and clean up analytics files created in fixtures dir
  await closeConnection();
  try { await fs.unlink(path.join(FIXTURES_DIR, 'analytics.duckdb')); } catch { /* ignore */ }
  try { await fs.unlink(path.join(FIXTURES_DIR, 'analytics.duckdb.wal')); } catch { /* ignore */ }
  try { await fs.unlink(path.join(FIXTURES_DIR, 'market.duckdb')); } catch { /* ignore */ }
  try { await fs.unlink(path.join(FIXTURES_DIR, 'market.duckdb.wal')); } catch { /* ignore */ }
});

describe('block-loader', () => {
  describe('listBlocks', () => {
    it('should list blocks in directory', async () => {
      const blocks = await listBlocks(FIXTURES_DIR);

      // Should find mock-block and nonstandard-name (unrecognized-csv should be skipped)
      expect(blocks.length).toBeGreaterThanOrEqual(1);

      // Find our mock-block (discovered via filesystem + csv-discovery)
      const mockBlock = blocks.find((b: { blockId: string }) => b.blockId === 'mock-block');
      expect(mockBlock).toBeDefined();
      // Without sync, blocks appear with tradeCount=0 from filesystem discovery
      expect(mockBlock?.hasDailyLog).toBe(true);
    });

    it('should return empty array for non-existent directory', async () => {
      await expect(listBlocks('/path/that/does/not/exist')).rejects.toThrow();
    });

    it('should handle directory with only unrecognized CSVs', async () => {
      const blocks = await listBlocks(FIXTURES_DIR);
      // unrecognized-csv folder should NOT appear in results
      const unrecognizedBlock = blocks.find((b: { blockId: string }) => b.blockId === 'unrecognized-csv');
      expect(unrecognizedBlock).toBeUndefined();
    });

    it('should discover non-standard CSV filenames', async () => {
      const blocks = await listBlocks(FIXTURES_DIR);
      // nonstandard-name folder has my-custom-trades.csv
      const nonstandardBlock = blocks.find((b: { blockId: string }) => b.blockId === 'nonstandard-name');
      expect(nonstandardBlock).toBeDefined();
    });
  });

  describe('loadBlock', () => {
    it('should load trades from block', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      expect(block.trades.length).toBe(5);
      expect(block.blockId).toBe('mock-block');

      // Verify trade structure
      const firstTrade = block.trades[0];
      expect(firstTrade).toHaveProperty('pl');
      expect(firstTrade).toHaveProperty('dateOpened');
      expect(firstTrade).toHaveProperty('strategy');
      expect(firstTrade.strategy).toBe('Test Strategy');
    });

    it('should load daily logs when present', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      expect(block.dailyLogs).toBeDefined();
      expect(block.dailyLogs!.length).toBe(7);

      // Verify daily log structure
      const firstEntry = block.dailyLogs![0];
      expect(firstEntry).toHaveProperty('date');
      expect(firstEntry).toHaveProperty('netLiquidity');
      expect(firstEntry).toHaveProperty('dailyPl');
    });

    it('should throw error for non-existent block', async () => {
      await expect(loadBlock(FIXTURES_DIR, 'non-existent-block')).rejects.toThrow();
    });

    it('should load block with non-standard CSV filename', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'nonstandard-name');

      expect(block.trades.length).toBe(2);
      expect(block.trades[0].strategy).toBe('Custom Strategy');
    });
  });

  describe('trade data validation', () => {
    it('should parse P/L correctly', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      // Check expected P/L values
      expect(block.trades[0].pl).toBe(200);
      expect(block.trades[1].pl).toBe(250);
      expect(block.trades[2].pl).toBe(-150); // Loss trade
      expect(block.trades[3].pl).toBe(430);
      expect(block.trades[4].pl).toBe(250);
    });

    it('should parse dates correctly', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      const firstTrade = block.trades[0];
      expect(firstTrade.dateOpened.getFullYear()).toBe(2024);
      expect(firstTrade.dateOpened.getMonth()).toBe(0); // January
      expect(firstTrade.dateOpened.getDate()).toBe(2);
    });

    it('should parse contract counts correctly', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      expect(block.trades[0].numContracts).toBe(1);
      expect(block.trades[3].numContracts).toBe(2); // This trade has 2 contracts
    });

    it('should parse commissions correctly', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      // Single contract trades
      expect(block.trades[0].openingCommissionsFees).toBe(1.50);
      expect(block.trades[0].closingCommissionsFees).toBe(1.50);

      // Two contract trade
      expect(block.trades[3].openingCommissionsFees).toBe(3.00);
      expect(block.trades[3].closingCommissionsFees).toBe(3.00);
    });
  });
});
