/**
 * Phase 28C: Prompt Priority Scoring, Budget Controls & Monitoring Tier Selector.
 * Selects representative monitoring sets and computes universe health and coverage metrics.
 */

import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptCandidate, PromptCluster, PromptHealthMetrics, MonitoringTier } from "./types";

export interface PrioritySelectionResult {
  allCandidates: PromptCandidate[];
  monitoringSet: PromptCandidate[];
  health: PromptHealthMetrics;
}

export function selectMonitoringPrompts(
  candidates: PromptCandidate[],
  clusters: PromptCluster[],
  profile: ProjectKnowledgeProfile
): PrioritySelectionResult {
  const primaryOfferingNames = new Set(
    profile.offerings.filter((o) => o.importance === "PRIMARY").map((o) => o.name.toLowerCase())
  );

  // 1. Calculate Priority Scores (0 - 100)
  for (const c of candidates) {
    let score = 50;

    // Commercial intent weight
    if (c.intents.includes("VENDOR_DISCOVERY") || c.intents.includes("RECOMMENDATION")) score += 25;
    if (c.intents.includes("PURCHASE_SELECTION") || c.intents.includes("COMPARISON")) score += 20;

    // Core offering weight
    const offName = c.evidenceTrace.derivedFromOfferingName?.toLowerCase();
    if (offName && primaryOfferingNames.has(offName)) score += 20;

    // Funnel stage weight
    if (c.funnelStage === "CONSIDERATION" || c.funnelStage === "DECISION") score += 10;

    // Specificity / Long Context
    if (c.specificity === "SPECIFIC" || c.specificity === "LONG_CONTEXT") score += 10;

    // User pin
    if (c.isPinned) score = 100;

    c.priorityScore = Math.min(100, Math.max(0, score));
  }

  // 2. Classify Monitoring Tiers
  // Ensure each cluster has at least one representative Tier 1 prompt
  const clusterRepMap = new Map<string, string>();
  for (const cl of clusters) {
    clusterRepMap.set(cl.id, cl.representativePromptId);
  }

  for (const c of candidates) {
    if (c.isExcluded) {
      c.monitoringTier = "TIER_3_EXPERIMENTAL";
    } else if (c.isPinned || clusterRepMap.get(c.clusterId) === c.id || c.priorityScore >= 80) {
      c.monitoringTier = "TIER_1_CORE";
    } else if (c.priorityScore >= 60) {
      c.monitoringTier = "TIER_2_EXPANDED";
    } else {
      c.monitoringTier = "TIER_3_EXPERIMENTAL";
    }
  }

  // 3. Construct Monitoring Set (Tier 1 + Pinned, excluding user-excluded)
  const monitoringSet = candidates.filter((c) => !c.isExcluded && (c.monitoringTier === "TIER_1_CORE" || c.isPinned));

  // 4. Calculate Health & Coverage Metrics
  const tier1Count = candidates.filter((c) => c.monitoringTier === "TIER_1_CORE").length;
  const tier2Count = candidates.filter((c) => c.monitoringTier === "TIER_2_EXPANDED").length;
  const tier3Count = candidates.filter((c) => c.monitoringTier === "TIER_3_EXPERIMENTAL").length;
  const pinnedCount = candidates.filter((c) => c.isPinned).length;
  const excludedCount = candidates.filter((c) => c.isExcluded).length;
  const manualCount = candidates.filter((c) => c.isManual).length;

  // Check Core Offering Coverage
  const coveredOfferings = new Set(
    monitoringSet.map((c) => c.evidenceTrace.derivedFromOfferingName).filter(Boolean)
  );
  const totalOfferings = profile.offerings.length;
  const coveredOfferingsCount = profile.offerings.filter((o) => coveredOfferings.has(o.name)).length;

  // Check Commercial Intent Coverage
  const commercialIntents = ["VENDOR_DISCOVERY", "RECOMMENDATION", "PURCHASE_SELECTION", "COMPARISON"];
  const coveredIntents = new Set(
    monitoringSet.flatMap((c) => c.intents).filter((i) => commercialIntents.includes(i))
  );

  // Check Coverage Gaps
  const coverageGaps: PromptHealthMetrics["coverageGaps"] = [];
  for (const off of profile.offerings) {
    if (!coveredOfferings.has(off.name)) {
      coverageGaps.push({
        category: "OFFERING",
        name: off.name,
        remedy: `Add at least 1 Tier-1 vendor discovery prompt for offering: ${off.name}`,
      });
    }
  }

  const health: PromptHealthMetrics = {
    totalCandidates: candidates.length,
    deduplicatedCount: candidates.length,
    representativeCount: monitoringSet.length,
    tier1Count,
    tier2Count,
    tier3Count,
    pinnedCount,
    excludedCount,
    manualCount,
    clustersCount: clusters.length,
    coreOfferingCoverage: {
      covered: coveredOfferingsCount,
      total: totalOfferings,
      ratio: totalOfferings > 0 ? coveredOfferingsCount / totalOfferings : 1.0,
    },
    coreTopicCoverage: {
      covered: Math.min(profile.topics.length, clusters.length),
      total: Math.max(1, profile.topics.length),
      ratio: profile.topics.length > 0 ? Math.min(1.0, clusters.length / profile.topics.length) : 1.0,
    },
    commercialIntentCoverage: {
      covered: coveredIntents.size,
      total: commercialIntents.length,
      ratio: coveredIntents.size / commercialIntents.length,
    },
    coverageGaps,
  };

  return {
    allCandidates: candidates,
    monitoringSet,
    health,
  };
}
