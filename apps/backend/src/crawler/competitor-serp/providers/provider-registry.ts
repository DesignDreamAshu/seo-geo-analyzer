/**
 * SERP Provider Registry & Implementation State Matrix.
 * Accurately reports whether a provider adapter is IMPLEMENTED_AND_TESTED,
 * ARCHITECTURE_READY, or NOT_CONFIGURED.
 */

import { SerpProvider } from "./types";
import { MockSerpProvider } from "./mock-provider";
import { SerpProviderType, ProviderImplementationState } from "../types";

const PROVIDER_IMPLEMENTATION_STATUS: Record<SerpProviderType, ProviderImplementationState> = {
  MOCK_PROVIDER: "IMPLEMENTED_AND_TESTED",
  DATAFORSEO: "ARCHITECTURE_READY",
  SERPAPI: "ARCHITECTURE_READY",
  GOOGLE_CUSTOM_SEARCH: "ARCHITECTURE_READY",
  MANUAL_DATASET: "ARCHITECTURE_READY",
  UNCONFIGURED: "NOT_CONFIGURED",
};

let defaultGlobalProvider: SerpProvider = new MockSerpProvider(true);

export function getActiveSerpProvider(): SerpProvider {
  return defaultGlobalProvider;
}

export function setActiveSerpProvider(provider: SerpProvider) {
  defaultGlobalProvider = provider;
}

export function getProviderImplementationState(providerType: SerpProviderType): ProviderImplementationState {
  return PROVIDER_IMPLEMENTATION_STATUS[providerType] || "NOT_CONFIGURED";
}

export function getProviderSupportMatrix(): Record<SerpProviderType, { state: ProviderImplementationState; description: string }> {
  return {
    MOCK_PROVIDER: {
      state: "IMPLEMENTED_AND_TESTED",
      description: "Fully implemented deterministic fixture provider with contract certification.",
    },
    DATAFORSEO: {
      state: "ARCHITECTURE_READY",
      description: "Provider schema and normalization contracts ready for live API credentials.",
    },
    SERPAPI: {
      state: "ARCHITECTURE_READY",
      description: "Provider schema and normalization contracts ready for live API credentials.",
    },
    GOOGLE_CUSTOM_SEARCH: {
      state: "ARCHITECTURE_READY",
      description: "Provider schema and normalization contracts ready for CSE API credentials.",
    },
    MANUAL_DATASET: {
      state: "ARCHITECTURE_READY",
      description: "Static JSON SERP snapshot ingestion contract ready.",
    },
    UNCONFIGURED: {
      state: "NOT_CONFIGURED",
      description: "No provider configured. Degrades gracefully to SERP_DATA_NOT_CONFIGURED.",
    },
  };
}
