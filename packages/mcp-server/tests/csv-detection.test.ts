/**
 * CSV type detection tests (ISS-006 fix verification)
 *
 * These tests verify that the flexible CSV discovery works correctly
 * for non-standard filenames by detecting file type based on column headers.
 *
 * Run `npm run build` before running tests if you've made source changes.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import from built bundle (test-exports.js has @lib dependencies bundled)
// @ts-expect-error - importing from bundled output
import { listBlocks, loadBlock } from '../dist/test-exports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('CSV type detection', () => {
  describe('trade log detection by columns', () => {
    it('should detect tradelog by P/L and date columns', async () => {
      // The nonstandard-name folder has my-custom-trades.csv
      // Detection should identify it as a tradelog based on column headers
      const blocks = await listBlocks(FIXTURES_DIR);
      const block = blocks.find(b => b.blockId === 'nonstandard-name');

      expect(block).toBeDefined();
      expect(block?.tradeCount).toBe(2);
    });

    it('should load trades from detected tradelog', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'nonstandard-name');

      expect(block.trades.length).toBe(2);
      expect(block.trades[0].pl).toBe(160);
      expect(block.trades[1].pl).toBe(230);
    });
  });

  describe('daily log detection by columns', () => {
    it('should detect dailylog alongside tradelog', async () => {
      const blocks = await listBlocks(FIXTURES_DIR);
      const mockBlock = blocks.find(b => b.blockId === 'mock-block');

      expect(mockBlock).toBeDefined();
      expect(mockBlock?.hasDailyLog).toBe(true);
    });

    it('should load daily logs when present', async () => {
      const block = await loadBlock(FIXTURES_DIR, 'mock-block');

      expect(block.dailyLogs).toBeDefined();
      expect(block.dailyLogs!.length).toBe(7);
      expect(block.dailyLogs![0].netLiquidity).toBe(10200);
    });
  });

  describe('unrecognized CSV handling', () => {
    it('should skip folders with only unrecognized CSVs', async () => {
      const blocks = await listBlocks(FIXTURES_DIR);

      // unrecognized-csv folder should be skipped
      const unrecognized = blocks.find(b => b.blockId === 'unrecognized-csv');
      expect(unrecognized).toBeUndefined();
    });

    it('should not include random data as trades', async () => {
      // Trying to load unrecognized-csv as a block should fail
      await expect(
        loadBlock(FIXTURES_DIR, 'unrecognized-csv')
      ).rejects.toThrow(/not found|missing tradelog/i);
    });
  });

  describe('CSV mappings caching', () => {
    it('should create block.json with csvMappings for non-standard files', async () => {
      // First call listBlocks to trigger metadata creation
      await listBlocks(FIXTURES_DIR);

      // Check if metadata was created for nonstandard-name block
      const metadataPath = path.join(FIXTURES_DIR, 'nonstandard-name', 'block.json');

      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);

      // Verify csvMappings exists and has the non-standard filename
      expect(metadata.csvMappings).toBeDefined();
      expect(metadata.csvMappings.tradelog).toBe('my-custom-trades.csv');
    });
  });
});
