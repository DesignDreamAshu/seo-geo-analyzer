/**
 * Local Business Provider Registry & Support Matrix.
 * Distinguishes IMPLEMENTED_AND_TESTED, ARCHITECTURE_READY, and NOT_CONFIGURED.
 */

import { LocalBusinessProvider } from "./types";
import { MockLocalBusinessProvider } from "./mock-provider";
import { BusinessProfileProviderType, LocalProviderImplementationState } from "../types";

const LOCAL_PROVIDER_STATUS: Record<BusinessProfileProviderType, LocalProviderImplementationState> = {
  MOCK_LOCAL_PROVIDER: "IMPLEMENTED_AND_TESTED",
  GOOGLE_BUSINESS_PROFILE: "ARCHITECTURE_READY",
  GOOGLE_PLACES_API: "ARCHITECTURE_READY",
  DATAFORSEO_LOCAL: "ARCHITECTURE_READY",
  MANUAL_VERIFIED_DATASET: "ARCHITECTURE_READY",
  UNCONFIGURED: "NOT_CONFIGURED",
};

let defaultGlobalLocalProvider: LocalBusinessProvider = new MockLocalBusinessProvider(true);

export function getActiveLocalProvider(): LocalBusinessProvider {
  return defaultGlobalLocalProvider;
}

export function setActiveLocalProvider(provider: LocalBusinessProvider) {
  defaultGlobalLocalProvider = provider;
}

export function getLocalProviderImplementationState(providerType: BusinessProfileProviderType): LocalProviderImplementationState {
  return LOCAL_PROVIDER_STATUS[providerType] || "NOT_CONFIGURED";
}

export function getLocalProviderSupportMatrix(): Record<
  BusinessProfileProviderType,
  { state: LocalProviderImplementationState; description: string }
> {
  return {
    MOCK_LOCAL_PROVIDER: {
      state: "IMPLEMENTED_AND_TESTED",
      description: "Fully implemented deterministic fixture provider with comprehensive contract tests.",
    },
    GOOGLE_BUSINESS_PROFILE: {
      state: "ARCHITECTURE_READY",
      description: "Google Business Profile API v4 OAuth normalization pipeline ready for live client credentials.",
    },
    GOOGLE_PLACES_API: {
      state: "ARCHITECTURE_READY",
      description: "Google Places API (New) Place Details normalization schema ready for live API credentials.",
    },
    DATAFORSEO_LOCAL: {
      state: "ARCHITECTURE_READY",
      description: "DataForSEO Google Business Data API normalization schema ready for live API credentials.",
    },
    MANUAL_VERIFIED_DATASET: {
      state: "ARCHITECTURE_READY",
      description: "Static JSON local business profile and citation dataset ingestion contract ready.",
    },
    UNCONFIGURED: {
      state: "NOT_CONFIGURED",
      description: "No local provider configured. Degrades gracefully to LOCAL_DATA_NOT_CONFIGURED.",
    },
  };
}
