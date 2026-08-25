/**
 * SERP Provider Interface & Types.
 * Ensures zero dependency on direct uncontrolled HTML scraping.
 */

import { SerpRequest, SerpSnapshot, SerpProviderType, SerpProviderStatus } from "../types";

export interface SerpProviderResult {
  status: SerpProviderStatus;
  snapshot?: SerpSnapshot;
  errorMessage?: string;
}

export interface SerpProvider {
  providerType: SerpProviderType;
  providerVersion: string;
  isConfigured(): boolean;
  fetchSerp(request: SerpRequest, projectId: string, ownDomainAliases?: string[]): Promise<SerpProviderResult>;
}
