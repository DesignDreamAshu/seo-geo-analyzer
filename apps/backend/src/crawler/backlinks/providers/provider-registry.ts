/**
 * Backlink Provider Registry & Support Matrix.
 * Distinguishes IMPLEMENTED_AND_TESTED, ARCHITECTURE_READY, and NOT_CONFIGURED.
 */

import { BacklinkProvider } from "./types";
import { MockBacklinkProvider } from "./mock-provider";
import { BacklinkProviderType, BacklinkProviderImplementationState } from "../types";

const BACKLINK_PROVIDER_STATUS: Record<BacklinkProviderType, BacklinkProviderImplementationState> = {
  MOCK_BACKLINK_PROVIDER: "IMPLEMENTED_AND_TESTED",
  AHREFS: "ARCHITECTURE_READY",
  SEMRUSH: "ARCHITECTURE_READY",
  MOZ: "ARCHITECTURE_READY",
  MAJESTIC: "ARCHITECTURE_READY",
  DATAFORSEO: "ARCHITECTURE_READY",
  MANUAL_DATASET: "ARCHITECTURE_READY",
  UNCONFIGURED: "NOT_CONFIGURED",
};

let defaultGlobalBacklinkProvider: BacklinkProvider = new MockBacklinkProvider(true);

export function getActiveBacklinkProvider(): BacklinkProvider {
  return defaultGlobalBacklinkProvider;
}

export function setActiveBacklinkProvider(provider: BacklinkProvider) {
  defaultGlobalBacklinkProvider = provider;
}

export function getBacklinkProviderImplementationState(providerType: BacklinkProviderType): BacklinkProviderImplementationState {
  return BACKLINK_PROVIDER_STATUS[providerType] || "NOT_CONFIGURED";
}

export function getBacklinkProviderSupportMatrix(): Record<
  BacklinkProviderType,
  { state: BacklinkProviderImplementationState; description: string }
> {
  return {
    MOCK_BACKLINK_PROVIDER: {
      state: "IMPLEMENTED_AND_TESTED",
      description: "Fully implemented deterministic fixture provider with comprehensive contract tests.",
    },
    AHREFS: {
      state: "ARCHITECTURE_READY",
      description: "Ahrefs API v3 backlink normalization schema ready for live API credentials.",
    },
    SEMRUSH: {
      state: "ARCHITECTURE_READY",
      description: "Semrush Backlink Analytics API normalization schema ready for live API credentials.",
    },
    MOZ: {
      state: "ARCHITECTURE_READY",
      description: "Moz Links API v2 schema ready for live API credentials.",
    },
    MAJESTIC: {
      state: "ARCHITECTURE_READY",
      description: "Majestic Historic/Fresh Index API schema ready for live API credentials.",
    },
    DATAFORSEO: {
      state: "ARCHITECTURE_READY",
      description: "DataForSEO Backlinks API normalization pipeline ready for live API credentials.",
    },
    MANUAL_DATASET: {
      state: "ARCHITECTURE_READY",
      description: "Static JSON backlink dataset ingestion contract ready.",
    },
    UNCONFIGURED: {
      state: "NOT_CONFIGURED",
      description: "No provider configured. Degrades gracefully to BACKLINK_DATA_NOT_CONFIGURED.",
    },
  };
}
