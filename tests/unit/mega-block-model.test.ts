// tests/unit/mega-block-model.test.ts
import { ProcessedBlock } from '@/lib/models/block';

describe('Mega Block Model', () => {
  it('should have isMegaBlock discriminator field', () => {
    const megaBlock: ProcessedBlock = {
      id: 'test-mega',
      name: 'Combined Portfolio',
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
      dataReferences: {
        tradesStorageKey: 'trades-test-mega',
      },
      analysisConfig: {
        riskFreeRate: 2.0,
        useBusinessDaysOnly: true,
        annualizationFactor: 252,
        confidenceLevel: 0.95,
      },
      // Mega Block specific fields
      isMegaBlock: true,
      megaBlockConfig: {
        sourceBlocks: [
          { blockId: 'block-a', weight: 2.0 },
          { blockId: 'block-b', weight: 1.0 },
        ],
        lastMaterializedAt: new Date(),
        sourceBlockVersions: {
          'block-a': 1706600000000,
          'block-b': 1706500000000,
        },
      },
    };

    expect(megaBlock.isMegaBlock).toBe(true);
    expect(megaBlock.megaBlockConfig?.sourceBlocks).toHaveLength(2);
  });

  it('should allow regular blocks without mega block fields', () => {
    const regularBlock: ProcessedBlock = {
      id: 'test-regular',
      name: 'Single Strategy',
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
      dataReferences: {
        tradesStorageKey: 'trades-test-regular',
      },
      analysisConfig: {
        riskFreeRate: 2.0,
        useBusinessDaysOnly: true,
        annualizationFactor: 252,
        confidenceLevel: 0.95,
      },
    };

    expect(regularBlock.isMegaBlock).toBeUndefined();
    expect(regularBlock.megaBlockConfig).toBeUndefined();
  });
});
