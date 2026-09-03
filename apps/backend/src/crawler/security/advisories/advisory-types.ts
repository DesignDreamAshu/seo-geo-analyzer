/**
 * Security Advisory Provider Interface & Contracts (SECURITY S6).
 * Defines provider-independent vulnerability lookup contracts for client-side dependencies.
 */

export type VersionConfidence = "CONFIRMED_VERSION" | "LIKELY_VERSION" | "UNKNOWN_VERSION";

export interface PackageVulnerabilityAdvisory {
  advisoryId: string;
  cveId?: string | null;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  vulnerableVersionRange: string;
  patchedVersion?: string | null;
  source: string;
  referenceUrl?: string | null;
  publishedAt?: string | null;
}

export interface SecurityAdvisoryLookupResult {
  packageName: string;
  observedVersion: string;
  confidence: VersionConfidence;
  hasVulnerabilities: boolean;
  advisories: PackageVulnerabilityAdvisory[];
  checkedAt: string;
  sourceAttribution: string;
}

export interface SecurityAdvisoryProvider {
  providerId: string;
  providerName: string;
  isAvailable(): boolean;
  lookupPackageVersion(packageName: string, version: string): Promise<SecurityAdvisoryLookupResult | null>;
  getLastUpdated(): string | null;
}

/**
 * Null / Standby Provider used when no external advisory provider is configured.
 */
export class NullSecurityAdvisoryProvider implements SecurityAdvisoryProvider {
  providerId = "none";
  providerName = "Standby (No External Advisory Provider Configured)";

  isAvailable(): boolean {
    return false;
  }

  async lookupPackageVersion(_packageName: string, _version: string): Promise<SecurityAdvisoryLookupResult | null> {
    return null;
  }

  getLastUpdated(): string | null {
    return null;
  }
}
