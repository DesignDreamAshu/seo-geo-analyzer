/**
 * Master Coordinator for Phase 17 Migration & Relaunch SEO Intelligence.
 * Orchestrates mapping, redirect validation, structural parity, GSC recovery, and Phase 11 actions.
 */

import {
  MigrationProject,
  SourceUrlRecord,
  DestinationUrlRecord,
  MigrationIntelligenceReport,
  MigrationSnapshot,
  MigrationReadinessState,
  LaunchBlockerState,
} from "./types";
import { DEFAULT_MIGRATION_POLICY, MigrationPolicy } from "./config";
import { buildUrlMappings, RawMappingInput } from "./mapping-engine";
import { validateMigrationRedirects } from "./redirect-validator";
import { validateMigrationParity } from "./parity-validator";
import { evaluateGscMigrationRecovery, GscPagePerformanceSample } from "./gsc-recovery";
import { createMigrationSnapshot } from "./snapshots";
import { bridgeMigrationOpportunitiesToPhase11 } from "./phase-integrators";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeMigrationParams {
  migrationProject: MigrationProject;
  sourceUrls: SourceUrlRecord[];
  destinationUrls: DestinationUrlRecord[];
  configuredMappings?: RawMappingInput[];
  discoveredRedirects?: Map<string, { targetUrl: string; statusCode: number; hopCount?: number }>;
  semanticCandidates?: Map<string, { candidateUrl: string; similarity: number }>;
  crawlMetadataMap?: Map<string, { statusCode?: number; isNoindex?: boolean; canonicalUrl?: string; redirectChain?: string[]; redirectMethod?: string; detectedLocale?: string; branchLocationId?: string }>;
  isProductionEnvironment?: boolean;
  sitemapUrls?: string[];
  hreflangUrls?: Array<{ sourceUrl: string; targetUrl: string }>;
  internalLinks?: Array<{ sourceUrl: string; targetUrl: string }>;
  robotsTxtDisallows?: string[];
  xRobotsNoindexUrls?: string[];
  preMigrationGscData?: GscPagePerformanceSample[];
  postMigrationGscData?: GscPagePerformanceSample[];
  daysSinceLaunch?: number;
  prePeriodDays?: number;
  postPeriodDays?: number;
  isPartialPostPeriod?: boolean;
  isStaleData?: boolean;
  isInventoryIncomplete?: boolean;
  existingActions?: SeoActionItem[];
  configuredWatchlist?: Set<string>;
  policy?: MigrationPolicy;
}

export interface AnalyzeMigrationResult {
  report: MigrationIntelligenceReport;
  currentSnapshot: MigrationSnapshot;
  actions: SeoActionItem[];
}

export async function analyzeMigrationIntelligence(
  params: AnalyzeMigrationParams
): Promise<AnalyzeMigrationResult> {
  const policy = params.policy || DEFAULT_MIGRATION_POLICY;
  const isProduction = params.isProductionEnvironment ?? true;
  const crawlMap = params.crawlMetadataMap || new Map();

  // 1. Build Mappings
  const mappings = buildUrlMappings({
    sourceUrls: params.sourceUrls,
    destinationUrls: params.destinationUrls,
    configuredMappings: params.configuredMappings,
    discoveredRedirects: params.discoveredRedirects,
    semanticCandidates: params.semanticCandidates,
    configuredWatchlist: params.configuredWatchlist,
    policy,
  });

  // 2. Validate Redirects
  const redirectIssues = validateMigrationRedirects(mappings, crawlMap);

  // 3. Validate Parity & Structural Integrity
  const parityRes = validateMigrationParity({
    mappings,
    destinationPages: params.destinationUrls,
    isProductionEnvironment: isProduction,
    legacyDomain: params.migrationProject.sourceOrigin,
    stagingDomain: "staging.",
    sitemapUrls: params.sitemapUrls,
    hreflangUrls: params.hreflangUrls,
    internalLinks: params.internalLinks,
    robotsTxtDisallows: params.robotsTxtDisallows,
    xRobotsNoindexUrls: params.xRobotsNoindexUrls,
  });

  // 4. Calculate Launch Blockers
  const launchBlockers: MigrationIntelligenceReport["launchBlockers"] = [];

  for (const rIssue of redirectIssues) {
    if (rIssue.blockerState === "LAUNCH_BLOCKER" || rIssue.blockerState === "HIGH_RISK_PRE_LAUNCH") {
      launchBlockers.push({
        issueType: rIssue.issueType,
        url: rIssue.sourceUrl,
        description: rIssue.details,
        blockerState: rIssue.blockerState,
        suggestedFix: rIssue.suggestedFix,
      });
    }
  }

  for (const pIssue of parityRes.parityIssues) {
    if (pIssue.blockerState === "LAUNCH_BLOCKER" || pIssue.blockerState === "HIGH_RISK_PRE_LAUNCH") {
      launchBlockers.push({
        issueType: pIssue.issueType,
        url: pIssue.url,
        description: pIssue.details,
        blockerState: pIssue.blockerState,
        suggestedFix: pIssue.suggestedFix,
      });
    }
  }

  // 5. Calculate Scope Metrics
  const mappedCount = mappings.filter((m) => m.destinationUrl && m.mappingType !== "UNCHANGED").length;
  const unchangedCount = mappings.filter((m) => m.mappingType === "UNCHANGED").length;
  const removedCount = mappings.filter((m) => m.mappingType === "REMOVED_NO_REPLACEMENT").length;
  const unmappedCount = mappings.filter((m) => m.mappingType === "MANUAL_REVIEW").length;
  const highValueUrls = params.sourceUrls.filter((s) => s.isHighValue);
  const highValueMapped = mappings.filter((m) => m.sourceIsHighValue && m.mappingType !== "MANUAL_REVIEW").length;
  const highValueRatio = highValueUrls.length > 0 ? (highValueMapped / highValueUrls.length) * 100 : 100;

  // 6. Calculate Readiness with Strict Safety
  let readinessState: MigrationReadinessState = "READY_FOR_LAUNCH";
  let readinessRationale = "All evaluated URLs are mapped to healthy, indexable destinations with zero critical blockers.";

  const hasLaunchBlocker = launchBlockers.some((b) => b.blockerState === "LAUNCH_BLOCKER");
  const hasHighRisk = launchBlockers.some((b) => b.blockerState === "HIGH_RISK_PRE_LAUNCH");

  if (params.isInventoryIncomplete) {
    readinessState = "INSUFFICIENT_EVIDENCE";
    readinessRationale = "Source or destination crawl dataset is incomplete. Launch readiness cannot be certified.";
  } else if (hasLaunchBlocker) {
    readinessState = "NOT_READY_FOR_LAUNCH";
    readinessRationale = `${launchBlockers.filter((b) => b.blockerState === "LAUNCH_BLOCKER").length} critical launch blockers detected. Launching now will cause severe indexing or traffic loss.`;
  } else if (hasHighRisk || unmappedCount > 0) {
    readinessState = "READY_WITH_REVIEW_ITEMS";
    readinessRationale = "No fatal blockers detected, but several high-risk mappings or unmapped URLs require review before launch.";
  }

  // 7. GSC Recovery Tracking
  const gscRes = evaluateGscMigrationRecovery({
    mappings,
    preMigrationGscData: params.preMigrationGscData || [],
    postMigrationGscData: params.postMigrationGscData || [],
    daysSinceLaunch: params.daysSinceLaunch ?? 0,
    prePeriodDays: params.prePeriodDays,
    postPeriodDays: params.postPeriodDays,
    isPartialPostPeriod: params.isPartialPostPeriod,
    isStaleData: params.isStaleData,
    policy,
  });

  // 8. Bridge Actions to Phase 11
  const actions = bridgeMigrationOpportunitiesToPhase11(
    params.migrationProject.projectId,
    params.migrationProject.migrationId,
    redirectIssues,
    parityRes.parityIssues,
    mappings,
    params.existingActions || []
  );

  // 9. Create Snapshot
  const snapshotId = `SNAP_MIG_${params.migrationProject.migrationId}_${Date.now().toString(36)}`;
  const currentSnapshot = createMigrationSnapshot({
    snapshotId,
    migrationId: params.migrationProject.migrationId,
    projectId: params.migrationProject.projectId,
    stage: params.migrationProject.status === "LAUNCHED" ? "POST_LAUNCH" : "PRE_MIGRATION",
    sourceUrlsCount: params.sourceUrls.length,
    destinationUrlsCount: params.destinationUrls.length,
    mappingsCount: mappings.length,
    readinessState,
    completeness: params.isInventoryIncomplete ? "MIGRATION_DATA_PARTIAL" : "MIGRATION_DATA_COMPLETE",
  });

  const report: MigrationIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    migrationId: params.migrationProject.migrationId,
    projectId: params.migrationProject.projectId,
    migrationType: params.migrationProject.migrationType,
    status: params.migrationProject.status,
    readinessState,
    readinessRationale,
    appliedPolicy: {
      policyName: policy.policyName,
      selectionSource: policy.selectionSource,
      highValueClickThreshold: policy.highValueClickThreshold,
      highValueImpressionThreshold: policy.highValueImpressionThreshold,
      highValueBacklinkThreshold: policy.highValueBacklinkThreshold,
      similarityThresholdForEquivalence: policy.similarityThresholdForEquivalence,
      minDaysForRecoveryEvaluation: policy.minDaysForRecoveryEvaluation,
    },
    scopeSummary: {
      totalSourceUrls: params.sourceUrls.length,
      mappedUrlsCount: mappedCount,
      unchangedUrlsCount: unchangedCount,
      intentionallyRemovedCount: removedCount,
      unmappedUrlsCount: unmappedCount,
      manualReviewCount: mappings.filter((m) => m.mappingConfidence === "MANUAL_REVIEW").length,
      highValueUrlsCount: highValueUrls.length,
      highValueMappedPercentage: Math.round(highValueRatio),
    },
    launchBlockers,
    mappings,
    redirectValidationSummary: {
      cleanPermanentRedirectsCount: mappings.filter((m) => m.observedRedirectStatus === 301 || m.observedRedirectStatus === 308).length,
      temporaryRedirectsCount: redirectIssues.filter((i) => i.issueType === "MIGRATION_TEMPORARY_REDIRECT_REVIEW").length,
      redirectChainsCount: redirectIssues.filter((i) => i.issueType === "MIGRATION_REDIRECT_CHAIN").length,
      redirectLoopsCount: redirectIssues.filter((i) => i.issueType === "MIGRATION_REDIRECT_LOOP").length,
      brokenTargetCount: redirectIssues.filter((i) => i.issueType === "MIGRATION_REDIRECT_TARGET_BROKEN" || i.issueType === "MIGRATION_REDIRECT_TARGET_410").length,
      nonIndexableTargetCount: redirectIssues.filter((i) => i.issueType === "MIGRATION_REDIRECT_TARGET_NON_INDEXABLE" || i.issueType === "MIGRATION_REDIRECT_TARGET_CANONICAL_MISMATCH").length,
    },
    contentAndStructureParity: {
      strongParityCount: parityRes.strongParityCount,
      partialParityCount: parityRes.partialParityCount,
      weakParityCount: parityRes.weakParityCount,
      significantContentLossCount: parityRes.parityIssues.filter((i) => i.issueType === "MIGRATION_SIGNIFICANT_CONTENT_LOSS").length,
      schemaLossCount: parityRes.schemaLossCount,
      stagingLeaksCount: parityRes.stagingLeaksCount,
      staleCanonicalCount: parityRes.staleCanonicalCount,
      legacyInternalLinksCount: parityRes.legacyInternalLinksCount,
    },
    gscRecoveryTracking: gscRes,
    governanceLimitations: [
      "URL mapping validation evaluates technical and structural parity; it does not guarantee absolute keyword ranking recovery.",
      "100% URL mapping coverage does not prevent traffic fluctuations if user intent or page layouts change fundamentally.",
      "Migration SEO intelligence strictly reuses the certified 95-rule technical SEO inventory without mutating baseline SEO health.",
    ],
    immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  return {
    report,
    currentSnapshot,
    actions,
  };
}
