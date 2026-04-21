import {
  MassiveProvider,
  ThetaDataProvider,
  resolveMassiveDataTier,
  resolveProviderCapabilities,
} from '../../src/test-exports.js';

describe('resolveMassiveDataTier', () => {
  test('defaults to ohlc when MASSIVE_DATA_TIER is unset', () => {
    expect(resolveMassiveDataTier({} as NodeJS.ProcessEnv)).toBe('ohlc');
  });

  test('accepts explicit ohlc tier', () => {
    expect(resolveMassiveDataTier({ MASSIVE_DATA_TIER: 'ohlc' })).toBe('ohlc');
  });

  test('accepts explicit trades tier', () => {
    expect(resolveMassiveDataTier({ MASSIVE_DATA_TIER: 'trades' })).toBe('trades');
  });

  test('accepts explicit quotes tier', () => {
    expect(resolveMassiveDataTier({ MASSIVE_DATA_TIER: 'quotes' })).toBe('quotes');
  });

  test('normalizes MASSIVE_DATA_TIER case', () => {
    expect(resolveMassiveDataTier({ MASSIVE_DATA_TIER: 'QUOTES' })).toBe('quotes');
  });

  test('falls back to ohlc for invalid tiers', () => {
    expect(resolveMassiveDataTier({ MASSIVE_DATA_TIER: 'premium' })).toBe('ohlc');
  });
});

describe('resolveProviderCapabilities', () => {
  test('Massive defaults to ohlc tier and no quote hydration', () => {
    const capabilities = resolveProviderCapabilities(
      new MassiveProvider(),
      {} as NodeJS.ProcessEnv,
    );

    expect(capabilities.providerName).toBe('massive');
    expect(capabilities.massiveDataTier).toBe('ohlc');
    expect(capabilities.quoteHydration).toBe(false);
    expect(capabilities.flatFiles).toBe(true);
    expect(capabilities.contractList).toBe(true);
  });

  test('Massive trades tier preserves tier but still disables quote hydration', () => {
    const capabilities = resolveProviderCapabilities(
      new MassiveProvider(),
      { MASSIVE_DATA_TIER: 'trades' },
    );

    expect(capabilities.massiveDataTier).toBe('trades');
    expect(capabilities.quoteHydration).toBe(false);
  });

  test('Massive quotes tier enables quote hydration', () => {
    const capabilities = resolveProviderCapabilities(
      new MassiveProvider(),
      { MASSIVE_DATA_TIER: 'quotes' },
    );

    expect(capabilities.massiveDataTier).toBe('quotes');
    expect(capabilities.quoteHydration).toBe(true);
  });

  test('ThetaData passes through provider capabilities and has no Massive tier', () => {
    const capabilities = resolveProviderCapabilities(
      new ThetaDataProvider(),
      {} as NodeJS.ProcessEnv,
    );

    expect(capabilities.providerName).toBe('thetadata');
    expect(capabilities.massiveDataTier).toBeNull();
    expect(capabilities.quoteHydration).toBe(true);
    expect(capabilities.flatFiles).toBe(false);
    expect(capabilities.contractList).toBe(true);
  });
});
