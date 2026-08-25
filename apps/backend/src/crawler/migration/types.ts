/**
 * Phase 17: Migration / Relaunch / Domain-Change SEO Intelligence — Core Data Models & Hardened Contracts.
 * Strict invariants: Evidence-backed URL mapping, versioned mapping identity, redirect equivalence safeguards,
 * staging vs production environment isolation, non-word-count parity, and safe causality language.
 */

import { SeoActionItem } from "../opportunity/types";

export type MigrationMode =
  | "DOMAIN_MIGRATION"
  | "HTTPS_MIGRATION"
  | "SUBDOMAIN_MIGRATION"
  | "SUBDIRECTORY_MIGRATION"
  | "CMS_MIGRATION"
  | "FRAMEWORK_REPLATFORM"
  | "SITE_REDESIGN"
  | "INFORMATION_ARCHITECTURE_RESTRUCTURE"
  | "URL_STRUCTURE_CHANGE"
  | "MERGER_CONSOLIDATION"
  | "PARTIAL_SECTION_MIGRATION"
  | "UNKNOWN_MIGRATION_TYPE";

export type MigrationStatus =
  | "PLANNING"
  | "PRE_LAUNCH_VALIDATION"
  | "LAUNCHED"
  | "POST_LAUNCH_MONITORING"
  | "COMPLETE"
  | "PAUSED";

export type MappingType =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY_REVIEW"
  | "MANY_TO_ONE"
  | "REMOVED_NO_REPLACEMENT"
  | "UNCHANGED"
  | "MANUAL_REVIEW";

export type MappingSource =
  | "CONFIGURED"
  | "DETERMINISTIC_EXACT"
  | "REDIRECT_DISCOVERED"
  | "CONTENT_SIMILARITY"
  | "SEMANTIC_CANDIDATE"
  | "MANUAL";

export type MappingConfidence =
  | "DETERMINISTIC"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "MANUAL_REVIEW";

export type MappingChangeType =
  | "MAPPING_UNCHANGED"
  | "MAPPING_CHANGED"
  | "MAPPING_ADDED"
  | "MAPPING_REMOVED"
  | "MAPPING_CONFIGURATION_CHANGED";

export type RedirectEquivalence =
  | "EXACT_REPLACEMENT"
  | "STRONG_EQUIVALENCE"
  | "PARTIAL_EQUIVALENCE"
  | "LOW_EQUIVALENCE"
  | "UNRELATED_HOMEPAGE"
  | "NO_EQUIVALENT_TARGET"
  | "MANUAL_REVIEW";

export type ContentParityState =
  | "CONTENT_PARITY_STRONG"
  | "CONTENT_PARITY_PARTIAL"
  | "CONTENT_PARITY_WEAK"
  | "CONTENT_PARITY_UNKNOWN";

export type LaunchBlockerState =
  | "LAUNCH_BLOCKER"
  | "HIGH_RISK_PRE_LAUNCH"
  | "REVIEW_BEFORE_LAUNCH"
  | "NON_BLOCKING";

export type RecoveryState =
  | "RECOVERY_NOT_YET_EVALUABLE"
  | "RECOVERY_IN_PROGRESS"
  | "RECOVERY_STABLE"
  | "RECOVERY_DECLINE_REVIEW"
  | "INSUFFICIENT_DATA";

export type GscPeriodComparability =
  | "COMPARABLE_PERIODS"
  | "SHORTER_POST_LAUNCH_PERIOD"
  | "PARTIAL_GSC_DATA"
  | "STALE_GSC_DATA"
  | "MISSING_GSC_DATA"
  | "PERIOD_WINDOW_MISMATCH";

export type MigrationReadinessState =
  | "READY_FOR_LAUNCH"
  | "READY_WITH_REVIEW_ITEMS"
  | "NOT_READY_FOR_LAUNCH"
  | "INSUFFICIENT_EVIDENCE";

export interface SourceUrlRecord {
  url: string;
  statusCode?: number;
  isIndexable: boolean;
  canonicalUrl?: string;
  inSitemap: boolean;
  internalLinkCount: number;
  gscClicks: number;
  gscImpressions: number;
  backlinkCount: number;
  referringDomainCount: number;
  isHighValue: boolean;
  importanceReasons: string[]; // e.g. ["GSC_TRAFFIC_LEADER", "BACKLINK_HUB", "CONFIGURED_WATCHLIST", "CORE_SERVICE_PAGE"]
  pageType?: string;
  locale?: string;
  title?: string;
  h1?: string;
  contentFingerprint?: string;
}

export interface DestinationUrlRecord {
  url: string;
  statusCode?: number;
  isIndexable: boolean;
  canonicalUrl?: string;
  inSitemap: boolean;
  internalLinkCount: number;
  pageType?: string;
  locale?: string;
  title?: string;
  h1?: string;
  hasSchema: boolean;
  ogUrl?: string;
  schemaUrls?: string[];
}

export interface UrlMappingEntry {
  mappingId: string;
  sourceUrl: string;
  destinationUrl?: string;
  mappingType: MappingType;
  mappingSource: MappingSource;
  mappingConfidence: MappingConfidence;
  mappingChangeType?: MappingChangeType;
  redirectEquivalence: RedirectEquivalence;
  sourceIsHighValue: boolean;
  sourceImportanceReasons: string[];
  observedRedirectStatus?: number;
  redirectHopCount?: number;
  finalResolvedUrl?: string;
  contentParity: ContentParityState;
  parityNotes?: string[];
  blockerState: LaunchBlockerState;
  notes: string;
}

export interface MigrationProject {
  migrationId: string;
  projectId: string;
  migrationType: MigrationMode;
  sourceOrigin: string;
  destinationOrigin: string;
  status: MigrationStatus;
  plannedLaunchAt?: string;
  actualLaunchAt?: string;
  scopeDescription: string;
  baselineSnapshotId?: string;
  stagingSnapshotId?: string;
  launchSnapshotId?: string;
}

export interface MigrationSnapshot {
  snapshotId: string;
  migrationId: string;
  projectId: string;
  stage: "PRE_MIGRATION" | "STAGING" | "LAUNCH" | "POST_LAUNCH";
  sourceUrlsCount: number;
  destinationUrlsCount: number;
  mappingsCount: number;
  readinessState: MigrationReadinessState;
  retrievalTimestamp: string;
  completeness: "MIGRATION_DATA_COMPLETE" | "MIGRATION_DATA_PARTIAL";
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface MigrationIntelligenceReport {
  generatedAt: string;
  migrationId: string;
  projectId: string;
  migrationType: MigrationMode;
  status: MigrationStatus;
  readinessState: MigrationReadinessState;
  readinessRationale: string;
  appliedPolicy: {
    policyName: string;
    selectionSource: string;
    highValueClickThreshold: number;
    highValueImpressionThreshold: number;
    highValueBacklinkThreshold: number;
    similarityThresholdForEquivalence: number;
    minDaysForRecoveryEvaluation: number;
  };
  scopeSummary: {
    totalSourceUrls: number;
    mappedUrlsCount: number;
    unchangedUrlsCount: number;
    intentionallyRemovedCount: number;
    unmappedUrlsCount: number;
    manualReviewCount: number;
    highValueUrlsCount: number;
    highValueMappedPercentage: number;
  };
  launchBlockers: Array<{
    issueType: string;
    url: string;
    description: string;
    blockerState: LaunchBlockerState;
    suggestedFix: string;
  }>;
  mappings: UrlMappingEntry[];
  redirectValidationSummary: {
    cleanPermanentRedirectsCount: number;
    temporaryRedirectsCount: number;
    redirectChainsCount: number;
    redirectLoopsCount: number;
    brokenTargetCount: number;
    nonIndexableTargetCount: number;
  };
  contentAndStructureParity: {
    strongParityCount: number;
    partialParityCount: number;
    weakParityCount: number;
    significantContentLossCount: number;
    schemaLossCount: number;
    stagingLeaksCount: number;
    staleCanonicalCount: number;
    legacyInternalLinksCount: number;
  };
  gscRecoveryTracking: {
    recoveryState: RecoveryState;
    periodComparability: GscPeriodComparability;
    preMigrationTotalClicks: number;
    postMigrationTotalClicks: number;
    observedClickTransferRatio: number;
    recoveryDetails: string;
  };
  governanceLimitations: string[];
  immutabilityStatement: string;
}
