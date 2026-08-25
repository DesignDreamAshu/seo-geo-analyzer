/**
 * Phase 28F: AI Citation & Source Intelligence Data Contracts.
 * Pure observational intelligence regarding which sources AI engines cite and why those sources win.
 */

import { AIProviderId, CitationDomainType } from "../observation/types";
import { IntentTaxonomy, FunnelStage } from "../prompts/types";

export const AI_SOURCE_INTELLIGENCE_VERSION = "v28f-1.0";

export type SourceOwnershipType =
  | "OWN_DOMAIN"
  | "CONFIRMED_COMPETITOR"
  | "OBSERVED_COMPETITOR_CANDIDATE"
  | "THIRD_PARTY_AUTHORITY"
  | "DIRECTORY"
  | "NEWS"
  | "DOCUMENTATION"
  | "GOVERNMENT"
  | "EDUCATIONAL"
  | "COMMUNITY"
  | "SOCIAL"
  | "MARKETPLACE"
  | "OTHER"
  | "UNKNOWN";

export type SourcePageType =
  | "HOME"
  | "SERVICE"
  | "PRODUCT"
  | "CATEGORY"
  | "BLOG"
  | "GUIDE"
  | "CASE_STUDY"
  | "DOCUMENTATION"
  | "PARTNER_PAGE"
  | "DIRECTORY_PROFILE"
  | "NEWS_ARTICLE"
  | "RESEARCH"
  | "COMMUNITY_THREAD"
  | "OTHER"
  | "UNKNOWN";

export type CitationAttributionStatus = "SUPPORTED" | "PARTIAL" | "UNAVAILABLE" | "AMBIGUOUS";

export type SourceConsensusLevel = "SINGLE_PROVIDER_SOURCE" | "MULTI_PROVIDER_SOURCE" | "CROSS_PROVIDER_CONSENSUS_SOURCE";

export type CitationGapType =
  | "OWN_DOMAIN_ABSENT"
  | "COMPETITOR_FIRST_PARTY_DOMINANT"
  | "THIRD_PARTY_AUTHORITY_DOMINANT"
  | "CLUSTER_CITATION_GAP"
  | "OFFERING_CITATION_GAP"
  | "PROVIDER_SPECIFIC_CITATION_GAP"
  | "MENTION_WITHOUT_CITATION_GAP"
  | "CROSS_PROVIDER_SOURCE_GAP";

export interface CanonicalCitationSource {
  canonicalUrl: string;
  originalUrl: string;
  domain: string;
  hostname: string;
  subdomain: string | null;
  path: string;
  ownershipType: SourceOwnershipType;
  pageType: SourcePageType;
  isOwnDomain: boolean;
  isCompetitor: boolean;
  associatedEntityName: string | null;
}

export interface CitationUrlProfile {
  canonicalUrl: string;
  originalUrl: string;
  domain: string;
  path: string;
  ownershipType: SourceOwnershipType;
  pageType: SourcePageType;
  citationCount: number; // raw frequency
  responseCount: number; // response penetration numerator
  responsePenetrationRate: number; // response penetration %
  providers: AIProviderId[];
  consensusLevel: SourceConsensusLevel;
  promptCount: number;
  clusterIds: string[];
  associatedEntities: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface CitationDomainProfile {
  domain: string;
  ownershipType: SourceOwnershipType;
  citationCount: number;
  responseCount: number;
  responsePenetrationRate: number;
  uniqueUrlsCount: number;
  providers: AIProviderId[];
  consensusLevel: SourceConsensusLevel;
  promptCount: number;
  clusterIds: string[];
  associatedEntities: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface CitationGapEvidence {
  promptId: string;
  promptText: string;
  clusterId: string;
  providerId: AIProviderId;
  winningSourceUrl: string;
  winningDomain: string;
  winningOwnershipType: SourceOwnershipType;
  observationId: string;
}

export interface CitationGap {
  gapId: string;
  gapType: CitationGapType;
  targetScope: "CLUSTER" | "OFFERING" | "PROVIDER";
  scopeId: string;
  scopeName: string;
  ownDomainCitationRate: number; // %
  leaderCitationRate: number; // %
  gapMagnitudePp: number; // percentage points (Leader % - Own %)
  observationCount: number;
  leaderEntityOrDomain: string;
  winningDomains: string[];
  winningUrls: string[];
  confidence: "LOW_SAMPLE" | "DIRECTIONAL" | "MODERATE_EVIDENCE" | "STRONGER_EVIDENCE";
  evidence: CitationGapEvidence[];
}

export interface SourceWinningPattern {
  patternId: string;
  patternName: string;
  description: string;
  observedPageType: SourcePageType;
  observedOwnershipType: SourceOwnershipType;
  clusterId: string;
  clusterName: string;
  supportCount: number;
  observationCount: number;
  penetrationRate: number; // %
  topSourceUrls: string[];
  confidence: "LOW_SAMPLE" | "DIRECTIONAL" | "MODERATE_EVIDENCE" | "STRONGER_EVIDENCE";
}

export interface UncitedRelevantPage {
  url: string;
  path: string;
  title: string;
  offeringName: string;
  clusterIds: string[];
  reasonUncited: "OBSERVED_ZERO_CITATIONS_IN_RELEVANT_CLUSTER";
}

export interface CompetitorSourceProfile {
  competitorName: string;
  isConfirmed: boolean;
  citationResponsePenetration: number; // %
  firstPartySupportRate: number; // %
  thirdPartySupportRate: number; // %
  topFirstPartyUrls: string[];
  topThirdPartyDomains: string[];
  activeProviders: AIProviderId[];
  activeClusters: string[];
}

export interface ClusterSourceProfile {
  clusterId: string;
  clusterName: string;
  dominantIntent: IntentTaxonomy;
  observationsCount: number;
  ownDomainCitationRate: number; // %
  competitorLeaderCitationRate: number; // %
  thirdPartyAuthorityCitationRate: number; // %
  citationGapPp: number;
  topCitedDomains: string[];
  topCitedUrls: string[];
}

export interface OfferingSourceProfile {
  offeringId: string;
  offeringName: string;
  observationsCount: number;
  ownDomainCitationRate: number; // %
  leaderCitationRate: number; // %
  citationGapPp: number;
  topProjectCitedPage: string | null;
  topCompetitorDomain: string | null;
  topThirdPartyDomain: string | null;
}

export interface AISourceIntelligenceSnapshot {
  snapshotId: string;
  projectId: string;
  runId: string;
  generatedAt: string;
  version: string;
  certificationStatus: "PENDING" | "CERTIFIED" | "FAILED";
  isTestData: boolean;
  overview: {
    totalCitationsObserved: number;
    citationCapableObservationsCount: number;
    ownDomainCitationRate: number; // %
    ownUrlsCitedCount: number;
    crossProviderConsensusSourcesCount: number;
    mentionedNotCitedCount: number;
    topCompetitorCitationPenetration: number;
    topExternalCitationDomain: string;
  };
  ownSources: {
    citedPages: Array<{
      url: string;
      path: string;
      citationFrequency: number;
      responsePenetrationRate: number;
      providers: AIProviderId[];
      clusterNames: string[];
      firstObservedAt: string;
      lastObservedAt: string;
    }>;
    uncitedRelevantPages: UncitedRelevantPage[];
  };
  competitorSources: CompetitorSourceProfile[];
  externalSources: CitationDomainProfile[];
  topWinningUrls: CitationUrlProfile[];
  gaps: CitationGap[];
  patterns: SourceWinningPattern[];
  clusters: ClusterSourceProfile[];
  offerings: OfferingSourceProfile[];
  providerPreferences: {
    providerMatrix: Array<{
      sourceType: SourceOwnershipType;
      ratesByProvider: Record<string, number>;
    }>;
  };
}
