import {
  getProvider,
  type MarketDataProvider,
  type ProviderCapabilities,
} from "./market-provider.js";
import {
  resolveMassiveDataTier,
  type MassiveDataTier,
} from "./massive-tier.js";

export interface ResolvedProviderCapabilities extends ProviderCapabilities {
  provider: MarketDataProvider;
  providerName: string;
  massiveDataTier: MassiveDataTier | null;
  quoteHydration: boolean;
  contractList: boolean;
}

export function resolveProviderCapabilities(
  provider: MarketDataProvider = getProvider(),
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProviderCapabilities {
  const base = provider.capabilities();
  const massiveDataTier = provider.name === "massive" ? resolveMassiveDataTier(env) : null;
  const quoteHydration =
    provider.name === "massive"
      ? massiveDataTier === "quotes" && typeof provider.fetchQuotes === "function"
      : base.quotes && typeof provider.fetchQuotes === "function";

  return {
    ...base,
    provider,
    providerName: provider.name,
    massiveDataTier,
    quoteHydration,
    contractList: typeof provider.fetchContractList === "function",
  };
}

export function getResolvedProviderCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProviderCapabilities {
  return resolveProviderCapabilities(getProvider(), env);
}

export { resolveMassiveDataTier };
export type { MassiveDataTier };
