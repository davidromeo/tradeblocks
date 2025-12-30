// tests/unit/mega-block-helpers.test.ts
import { ProcessedBlock } from '@/lib/models/block';
import {
  isMegaBlock,
  getMegaBlockSourceIds,
  getMegaBlockTotalWeight,
} from '@/lib/models/mega-block';

describe('Mega Block Helpers', () => {
  const megaBlock: ProcessedBlock = {
    id: 'mega-1',
    name: 'Combined',
    isActive: false,
    created: new Date(),
    lastModified: new Date(),
    tradeLog: {
      fileName: 'materialized.csv',
      fileSize: 0,
      originalRowCount: 0,
      processedRowCount: 100,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-mega-1' },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
    isMegaBlock: true,
    megaBlockConfig: {
      sourceBlocks: [
        { blockId: 'a', weight: 2.0 },
        { blockId: 'b', weight: 1.5 },
      ],
      lastMaterializedAt: new Date(),
      sourceBlockVersions: { a: 1000, b: 2000 },
    },
  };

  const regularBlock: ProcessedBlock = {
    id: 'regular-1',
    name: 'Single',
    isActive: false,
    created: new Date(),
    lastModified: new Date(),
    tradeLog: {
      fileName: 'trades.csv',
      fileSize: 1000,
      originalRowCount: 50,
      processedRowCount: 50,
      uploadedAt: new Date(),
    },
    processingStatus: 'completed',
    dataReferences: { tradesStorageKey: 'trades-regular-1' },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
  };

  describe('isMegaBlock', () => {
    it('returns true for mega blocks', () => {
      expect(isMegaBlock(megaBlock)).toBe(true);
    });

    it('returns false for regular blocks', () => {
      expect(isMegaBlock(regularBlock)).toBe(false);
    });
  });

  describe('getMegaBlockSourceIds', () => {
    it('returns source block IDs', () => {
      expect(getMegaBlockSourceIds(megaBlock)).toEqual(['a', 'b']);
    });

    it('returns empty array for regular blocks', () => {
      expect(getMegaBlockSourceIds(regularBlock)).toEqual([]);
    });
  });

  describe('getMegaBlockTotalWeight', () => {
    it('returns sum of weights', () => {
      expect(getMegaBlockTotalWeight(megaBlock)).toBe(3.5);
    });

    it('returns 0 for regular blocks', () => {
      expect(getMegaBlockTotalWeight(regularBlock)).toBe(0);
    });
  });
});
