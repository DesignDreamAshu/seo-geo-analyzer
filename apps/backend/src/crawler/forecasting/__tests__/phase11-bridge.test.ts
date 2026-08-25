/**
 * Phase 11 Canonical Action Decision Bridge Tests.
 * Proves that Phase 20 enriches actions while preserving Phase 11 action IDs and priority authority.
 */

import { enrichPhase11ActionsWithForecast } from "../phase11-bridge";
import { SeoActionItem } from "../../opportunity/types";
import { SeoImpactEstimate } from "../types";

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

describe("6. Phase 11 Canonical Action Decision Bridge", () => {
  it("6.1. Enriches Phase 11 actions with observed exposure while preserving action ID and priority", () => {
    const rawAction: SeoActionItem = {
      actionId: "ACT_FIX_NOINDEX_1",
      projectId: "p1",
      type: "TECHNICAL_FIX",
      title: "Remove Accidental Noindex on /services/cmdb",
      description: "Page contains noindex directive blocking search visibility.",
      nature: "DETERMINISTIC_FIX",
      underlyingRuleCodes: ["META_ROBOTS_NOINDEX"],
      monitoringSignals: [],
      sourceSignals: [],
      affectedUrls: ["https://example.com/services/cmdb"],
      representativeUrls: ["https://example.com/services/cmdb"],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "critical",
      actionPriority: "CRITICAL",
      whyThisPriority: ["Direct search exclusion blocker"],
      effort: "LOW",
      effortRationale: "Remove meta tag",
      primaryOwner: "Developer",
      secondaryOwners: ["SEO"],
      owners: ["Developer", "SEO"],
      ownerRoutingConfidence: "CONFIRMED_OWNER",
      pageImportanceStatus: "PAGE_IMPORTANCE_CONFIGURED",
      isWatchlistedPage: true,
      isQuickWin: true,
      timelineBucket: "DO_NOW",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "HTML Head",
      recommendedAction: "Remove noindex tag",
      verificationInstructions: "Verify 200 OK and inspect in GSC",
      actionStatus: "OPEN",
      statusHistory: [],
    };

    const estimate: SeoImpactEstimate = {
      actionId: "ACT_FIX_NOINDEX_1",
      projectId: "p1",
      title: "Remove Accidental Noindex on /services/cmdb",
      impactNature: "CONDITIONAL_SCENARIO_RANGE",
      forecastability: "HIGHLY_FORECASTABLE",
      quantificationSupported: true,
      scenarioMethod: "SAME_URL_HISTORICAL_DISTRIBUTION",
      affectedUrls: ["https://example.com/services/cmdb"],
      overlapState: "INDEPENDENT",
      observedExposure: {
        historicalMonthlyImpressions: 18400,
        historicalMonthlyClicks: 1220,
        historicalAverageCtr: 6.63,
        affectedUrlsCount: 1,
        affectedQueryClustersCount: 42,
        evidencePeriodRange: "Last 28d",
      },
      baselineType: "PRE_REGRESSION_WINDOW",
      seasonalComparability: "STRONG",
      isBaselineAnomalyFree: true,
      confidence: "HIGH",
      uncertaintyReasons: [],
      downsideRisk: "LOW_RISK",
      reversibility: "HIGHLY_REVERSIBLE",
      dependencyBlockedByActionIds: [],
      isIndexationDependent: false,
      modelVersion: "1.0.0",
      policyVersion: "1.0.0",
    };

    const enriched = enrichPhase11ActionsWithForecast([rawAction], [estimate]);

    expect(enriched[0].actionId).toBe("ACT_FIX_NOINDEX_1");
    expect(enriched[0].actionPriority).toBe("CRITICAL");
    expect(enriched[0].primaryOwner).toBe("Developer");
    expect(enriched[0].gscExposure?.totalClicks).toBe(1220);
    expect(enriched[0].gscExposure?.totalImpressions).toBe(18400);
  });
});
