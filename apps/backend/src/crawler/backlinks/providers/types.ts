/**
 * Backlink Provider Interface & Request Contracts.
 * Ensures zero dependency on full-web scraping by establishing authorized provider contracts.
 */

import { BacklinkSnapshot, BacklinkProviderType, BacklinkDatasetStatus, BacklinkRecord } from "../types";

export interface BacklinkDomainRequest {
  targetDomain: string;
  projectId: string;
  rowLimit?: number;
  indexType?: "LIVE" | "FRESH" | "HISTORIC" | "MOCK";
}

export interface BacklinkProviderResult {
  status: BacklinkDatasetStatus;
  snapshot?: BacklinkSnapshot;
  rawRecords?: BacklinkRecord[];
  errorMessage?: string;
}

export interface BacklinkProvider {
  providerType: BacklinkProviderType;
  providerVersion: string;
  isConfigured(): boolean;
  fetchDomainBacklinks(request: BacklinkDomainRequest, ownDomainAliases?: string[]): Promise<BacklinkProviderResult>;
}
