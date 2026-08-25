/**
 * Local Business Provider Interface & Request Contracts.
 * Defines authorized business profile retrieval contracts without fabricating API availability.
 */

import {
  BusinessProfileDataset,
  BusinessProfileProviderType,
  LocalDatasetStatus,
  CitationRecord,
} from "../types";

export interface LocalBusinessProfileRequest {
  projectId: string;
  locationId: string;
  targetDomain: string;
}

export interface LocalBusinessProviderResult {
  status: LocalDatasetStatus;
  profiles?: BusinessProfileDataset[];
  citations?: CitationRecord[];
  errorMessage?: string;
}

export interface LocalBusinessProvider {
  providerType: BusinessProfileProviderType;
  providerVersion: string;
  isConfigured(): boolean;
  fetchBusinessProfiles(request: { projectId: string; targetDomain: string }): Promise<LocalBusinessProviderResult>;
}
