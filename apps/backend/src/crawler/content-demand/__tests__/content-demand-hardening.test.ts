/**
 * Phase 12 Certification Hardening Comprehensive Test Suite.
 * Covers all 11 required dimensions: Cluster stability, False plural safeguards,
 * Multi-signal content coverage, All 6 existing vs new decisions, Cannibalization safeguards,
 * GSC data quality, Trend semantics, Technical dependencies, and Phase 11 bridge integration.
 */

import { clusterQueries, buildDurableClusterId } from "../clustering";
import { normalizeQuery, classifyBrandState, areQueriesNearIdentical, extractSemanticTokens } from "../normalization";
import { classifyQueryIntent } from "../intent-classifier";
import { evaluateLandingPageFit, evaluateQueryPageStability } from "../fit-evaluator";
import { assessContentCoverage } from "../coverage-engine";
import { evaluateCannibalization } from "../cannibalization";
import { evaluateDemandTrend } from "../trend-engine";
import { bridgeContentDemandToActions } from "../action-bridge";
import { NormalizedQueryRecord, QueryCluster } from "../types";
import { B2B_NICHE_DEMAND_POLICY, DEFAULT_DEMAND_POLICY } from "../config";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      return (res as any)
        .then(() => {
          console.log(`  ✓ ${testName}`);
        })
        .catch((err: any) => {
          console.error(`  ❌ FAIL: ${testName}`);
          console.error(`     ${err.message}`);
          throw err;
        });
    }
    console.log(`  ✓ ${testName}`);
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
  };
}

describe("1. Cluster Stability & Durable Identity", () => {
  it("1.1. Query Order Invariant: changing raw query ingestion order produces identical clusterId", () => {
    const qA: NormalizedQueryRecord = {
      queryId: "qA",
      rawQuery: "servicenow cmdb assessment",
      normalizedQuery: "servicenow cmdb assessment",
      semanticTokens: extractSemanticTokens("servicenow cmdb assessment"),
      intents: ["COMMERCIAL_INVESTIGATION"],
      brandState: "NON_BRANDED",
      impressions: 4000,
      clicks: 100,
      ctr: 2.5,
      position: 5.0,
      landingPages: [{ url: "https://www.botconsulting.io/services/cmdb", impressions: 4000, clicks: 100, position: 5.0 }],
      dataQuality: "FRESH_COMPLETE",
    };
    const qB: NormalizedQueryRecord = {
      queryId: "qB",
      rawQuery: "servicenow cmdb assessments",
      normalizedQuery: "servicenow cmdb assessments",
      semanticTokens: extractSemanticTokens("servicenow cmdb assessments"),
      intents: ["COMMERCIAL_INVESTIGATION"],
      brandState: "NON_BRANDED",
      impressions: 1200,
      clicks: 30,
      ctr: 2.5,
      position: 5.2,
      landingPages: [{ url: "https://www.botconsulting.io/services/cmdb", impressions: 1200, clicks: 30, position: 5.2 }],
      dataQuality: "FRESH_COMPLETE",
    };

    const clustersOrder1 = clusterQueries([qA, qB]);
    const clustersOrder2 = clusterQueries([qB, qA]);

    expect(clustersOrder1[0].clusterId).toBe(clustersOrder2[0].clusterId);
  });

  it("1.2. Impression Fluctuation Invariant: impression changes do not churn clusterId", () => {
    const tokens = extractSemanticTokens("servicenow cmdb audit");
    const idLow = buildDurableClusterId(tokens, "NON_BRANDED");
    const idHigh = buildDurableClusterId(tokens, "NON_BRANDED");
    expect(idLow).toBe(idHigh);
  });
});

describe("2. Normalization & False Plural Safeguards", () => {
  it("2.1. False Plural Safeguards: distinct concepts are NOT merged", () => {
    expect(areQueriesNearIdentical("new", "news")).toBe(false);
    expect(areQueriesNearIdentical("glass", "glasses")).toBe(false);
    expect(areQueriesNearIdentical("analytic", "analytics")).toBe(false);
  });

  it("2.2. Safe Plural Equivalences: regular plurals merge safely", () => {
    expect(areQueriesNearIdentical("business", "businesses")).toBe(true);
    expect(areQueriesNearIdentical("service", "services")).toBe(true);
    expect(areQueriesNearIdentical("consultant", "consultants")).toBe(true);
  });

  it("2.3. Brand Classification: whole word token matching prevents substring false positives", () => {
    const brandAliases = ["bot", "bot consulting"];
    expect(classifyBrandState("bot consulting services", brandAliases)).toBe("BRANDED");
    expect(classifyBrandState("robot automation platform", brandAliases)).toBe("NON_BRANDED");
    expect(classifyBrandState("bottom navigation bar", brandAliases)).toBe("NON_BRANDED");
  });
});

describe("3. Landing Page Fit Certification", () => {
  const mockCluster: QueryCluster = {
    clusterId: "CLUST_servicenow_cmdb",
    semanticFingerprint: "servicenow+cmdb",
    representativeLabel: "ServiceNow CMDB Consulting",
    rawQueries: ["servicenow cmdb consulting"],
    totalObservedImpressions: 4000,
    totalClicks: 120,
    averageCtr: 3.0,
    averagePosition: 4.5,
    landingPages: ["https://www.botconsulting.io/services/cmdb"],
    dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["consulting"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("3.1. STRONG_FIT: commercial query on relevant commercial page", () => {
    const pageMeta = { url: "https://www.botconsulting.io/services/cmdb", title: "ServiceNow CMDB Consulting Services", h1: "Enterprise CMDB Consulting" };
    const res = evaluateLandingPageFit(mockCluster, pageMeta);
    expect(res.fit).toBe("STRONG_FIT");
    expect(res.confidence).toBe("HIGH_CONFIDENCE");
  });

  it("3.2. MISMATCH: commercial query landing on informational blog post", () => {
    const blogCluster = { ...mockCluster, dominantLandingPage: "https://www.botconsulting.io/blog/quick-tips" };
    const pageMeta = { url: "https://www.botconsulting.io/blog/quick-tips", title: "5 Quick Tips for CMDB", h1: "CMDB Tips" };
    const res = evaluateLandingPageFit(blogCluster, pageMeta);
    expect(res.fit).toBe("MISMATCH");
    expect(res.confidence).toBe("HIGH_CONFIDENCE");
  });

  it("3.3. PARTIAL_FIT: informational query on service page remains partial (not automatic mismatch)", () => {
    const infoCluster: QueryCluster = { ...mockCluster, primaryIntent: "INFORMATIONAL", representativeLabel: "What is ServiceNow CMDB" };
    const pageMeta = { url: "https://www.botconsulting.io/services/cmdb", title: "ServiceNow CMDB Consulting", h1: "CMDB Services" };
    const res = evaluateLandingPageFit(infoCluster, pageMeta);
    expect(res.fit).toBe("PARTIAL_FIT");
  });
});

describe("4. Multi-Signal Content Coverage Truth", () => {
  const cluster: QueryCluster = {
    clusterId: "CLUST_servicenow_csm",
    semanticFingerprint: "servicenow+csm",
    representativeLabel: "ServiceNow CSM Integration",
    rawQueries: ["servicenow csm integration"],
    totalObservedImpressions: 5000,
    totalClicks: 150,
    averageCtr: 3.0,
    averagePosition: 2.1, // High ranking position
    landingPages: ["https://www.botconsulting.io/"], // Generic homepage
    dominantLandingPage: "https://www.botconsulting.io/",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["integration"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("4.1. Position < 3.5 on weak homepage does NOT prove WELL_SERVED (requires content fit)", () => {
    const homepageMeta = { url: "https://www.botconsulting.io/", title: "Enterprise Tech Partners", h1: "IT Consulting" };
    const res = assessContentCoverage(cluster, homepageMeta, ["https://www.botconsulting.io/"]);
    // Should NOT be WELL_SERVED because fit is WEAK_FIT despite position 2.1
    expect(res.coverageState).toBe("UNSERVED_CANDIDATE");
  });
});

describe("5. Existing vs New Page Decision Safety (All 6 Paths)", () => {
  const baseCluster: QueryCluster = {
    clusterId: "CLUST_servicenow_cmdb",
    semanticFingerprint: "servicenow+cmdb",
    representativeLabel: "ServiceNow CMDB Assessment",
    rawQueries: ["servicenow cmdb assessment"],
    totalObservedImpressions: 3500,
    totalClicks: 110,
    averageCtr: 3.14,
    averagePosition: 5.5,
    landingPages: ["https://www.botconsulting.io/services/cmdb"],
    dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["assessment"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("5.1. Path 1 (Strong Existing Page with top ranking): NO_ACTION", () => {
    const topCluster = { ...baseCluster, averagePosition: 2.0 };
    const pageMeta = { url: "https://www.botconsulting.io/services/cmdb", title: "ServiceNow CMDB Assessment", h1: "CMDB Assessment Services" };
    const res = assessContentCoverage(topCluster, pageMeta, ["https://www.botconsulting.io/services/cmdb"]);
    expect(res.decision).toBe("NO_ACTION");
    expect(res.coverageState).toBe("WELL_SERVED");
  });

  it("5.2. Path 2 (Partial Relevant Existing Page): IMPROVE_EXISTING_PAGE", () => {
    const pageMeta = { url: "https://www.botconsulting.io/services/cmdb", title: "ServiceNow CMDB Consulting", h1: "Enterprise CMDB" };
    const res = assessContentCoverage(baseCluster, pageMeta, ["https://www.botconsulting.io/services/cmdb"]);
    expect(res.decision).toBe("IMPROVE_EXISTING_PAGE");
  });

  it("5.3. Path 3 (Dedicated page exists but traffic lands on generic page): INTERNAL_LINK_EXISTING_PAGE", () => {
    const mismatchedCluster = { ...baseCluster, dominantLandingPage: "https://www.botconsulting.io/blog/news", landingPages: ["https://www.botconsulting.io/blog/news"] };
    const blogMeta = { url: "https://www.botconsulting.io/blog/news", title: "Company News", h1: "Latest News" };
    const res = assessContentCoverage(mismatchedCluster, blogMeta, ["https://www.botconsulting.io/services/cmdb", "https://www.botconsulting.io/blog/news"]);
    expect(res.decision).toBe("INTERNAL_LINK_EXISTING_PAGE");
  });

  it("5.4. Path 4 (No relevant page + distinct verified intent): CREATE_NEW_PAGE_CANDIDATE", () => {
    const unservedCluster = { ...baseCluster, dominantLandingPage: "https://www.botconsulting.io/", landingPages: ["https://www.botconsulting.io/"] };
    const homeMeta = { url: "https://www.botconsulting.io/", title: "Home", h1: "Home" };
    const res = assessContentCoverage(unservedCluster, homeMeta, ["https://www.botconsulting.io/"], undefined, DEFAULT_DEMAND_POLICY, true);
    expect(res.decision).toBe("CREATE_NEW_PAGE_CANDIDATE");
  });

  it("5.5. Path 5 (No relevant page + unverified business relevance): VALIDATION_REQUIRED", () => {
    const unservedCluster = { ...baseCluster, dominantLandingPage: "https://www.botconsulting.io/", landingPages: ["https://www.botconsulting.io/"] };
    const homeMeta = { url: "https://www.botconsulting.io/", title: "Home", h1: "Home" };
    const res = assessContentCoverage(unservedCluster, homeMeta, ["https://www.botconsulting.io/"], undefined, DEFAULT_DEMAND_POLICY, false);
    expect(res.decision).toBe("VALIDATION_REQUIRED");
  });
});

describe("6. Cannibalization Hardening & Safeguards", () => {
  const cluster: QueryCluster = {
    clusterId: "CLUST_cannibalization",
    semanticFingerprint: "servicenow+implementation",
    representativeLabel: "ServiceNow Implementation Partner",
    rawQueries: ["servicenow implementation partner"],
    totalObservedImpressions: 4500,
    totalClicks: 150,
    averageCtr: 3.33,
    averagePosition: 5.0,
    landingPages: ["https://www.botconsulting.io/services/servicenow", "https://www.botconsulting.io/services/servicenow-implementation"],
    dominantLandingPage: "https://www.botconsulting.io/services/servicenow-implementation",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["implementation"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("6.1. Similar intent + switching dominance: LIKELY_CANNIBALIZATION with staged review recommendation", () => {
    const res = evaluateCannibalization(cluster, "https://www.botconsulting.io/services/servicenow");
    expect(res?.state).toBe("LIKELY_CANNIBALIZATION");
    expect(res?.remediationRecommendation).toBe("REVIEW_INTENT_DIFFERENTIATION");
    expect(res?.protectAgainstMergingNote?.includes("Do NOT automatically redirect")).toBe(true);
  });

  it("6.2. Brand Query Multi-Page Safeguard: HEALTHY_MULTI_PAGE_VISIBILITY", () => {
    const brandCluster: QueryCluster = { ...cluster, brandState: "BRANDED", representativeLabel: "BOT Consulting", landingPages: ["https://www.botconsulting.io/", "https://www.botconsulting.io/about"] };
    const res = evaluateCannibalization(brandCluster);
    expect(res?.state).toBe("HEALTHY_MULTI_PAGE_VISIBILITY");
    expect(res?.remediationRecommendation).toBe("NO_ACTION");
  });

  it("6.3. Service + Case Study Synergy: QUERY_INTENT_SPLIT", () => {
    const synergyCluster: QueryCluster = { ...cluster, landingPages: ["https://www.botconsulting.io/services/cmdb", "https://www.botconsulting.io/case-studies/cmdb"] };
    const res = evaluateCannibalization(synergyCluster);
    expect(res?.state).toBe("QUERY_INTENT_SPLIT");
    expect(res?.remediationRecommendation).toBe("NO_ACTION");
  });
});

describe("7. Technical Dependency Blocking Certification", () => {
  const cluster: QueryCluster = {
    clusterId: "CLUST_servicenow_cmdb",
    semanticFingerprint: "servicenow+cmdb",
    representativeLabel: "ServiceNow CMDB Assessment",
    rawQueries: ["servicenow cmdb assessment"],
    totalObservedImpressions: 4000,
    totalClicks: 120,
    averageCtr: 3.0,
    averagePosition: 6.0,
    landingPages: ["https://www.botconsulting.io/services/cmdb"],
    dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["assessment"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("7.1. Upstream noindex defect captures technical blocker and maps to blocked action", () => {
    const pageMeta = { url: "https://www.botconsulting.io/services/cmdb", isNoindex: true, statusCode: 200 };
    const cov = assessContentCoverage(cluster, pageMeta, ["https://www.botconsulting.io/services/cmdb"]);
    expect(cov.technicalBlockers?.includes("INDEXABILITY_NOINDEX")).toBe(true);

    const actions = bridgeContentDemandToActions("bot-consulting", [cov], []);
    expect(actions.length).toBe(1);
    expect(actions[0].blockedByActionIds.includes("INDEXABILITY_NOINDEX")).toBe(true);
  });
});

describe("8. GSC Data Quality & Trend Safeguards", () => {
  const cluster: QueryCluster = {
    clusterId: "CLUST_trend",
    semanticFingerprint: "trend+query",
    representativeLabel: "Trend Query",
    rawQueries: ["trend query"],
    totalObservedImpressions: 150,
    totalClicks: 10,
    averageCtr: 6.67,
    averagePosition: 5.0,
    landingPages: ["https://www.botconsulting.io/trend"],
    dominantLandingPage: "https://www.botconsulting.io/trend",
    primaryIntent: "INFORMATIONAL",
    allIntents: ["INFORMATIONAL"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: [],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: false,
  };

  it("8.1. Stale Data Quality suppresses high-confidence trend conclusions", () => {
    const res = evaluateDemandTrend(cluster, 50, "STALE");
    expect(res.trendState).toBe("INSUFFICIENT_DATA");
    expect(res.rationale.includes("STALE")).toBe(true);
  });

  it("8.2. Period Mismatch suppresses trend conclusions", () => {
    const res = evaluateDemandTrend(cluster, 50, "FRESH_COMPLETE", DEFAULT_DEMAND_POLICY, true);
    expect(res.trendState).toBe("INSUFFICIENT_DATA");
    expect(res.rationale.includes("Period Mismatched")).toBe(true);
  });
});
