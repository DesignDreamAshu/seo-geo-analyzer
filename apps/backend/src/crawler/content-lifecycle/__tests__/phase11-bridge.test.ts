/**
 * Phase 21: Phase 11 Canonical Action Integration Bridge Tests.
 * Proves enrichment of Phase 11 action items while preserving canonical action ID and priority authority.
 */

import { enrichPhase11ActionsWithLifecycle } from "../phase11-bridge";
import { SeoActionItem } from "../../opportunity/types";
import { ContentLifecycleAssessment } from "../types";

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
  it("6.1. Enriches Phase 11 action with lifecycle state while preserving canonical action ID and priority", () => {
    const mockAction: SeoActionItem = {
      actionId: "ACT_CONTENT_REFRESH_CMDB",
      projectId: "p1",
      type: "CONTENT_REFRESH_OPPORTUNITY",
      title: "Update & Expand CMDB Service Guide",
      description: "Expand content to regain lost query cluster visibility.",
      nature: "REVIEW_RECOMMENDED",
      underlyingRuleCodes: [],
      monitoringSignals: [],
      sourceSignals: [],
      affectedUrls: ["https://example.com/services/cmdb"],
      representativeUrls: ["https://example.com/services/cmdb"],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "medium",
      actionPriority: "HIGH",
      whyThisPriority: ["High impression query cluster with declining traffic"],
      effort: "MEDIUM",
      effortRationale: "Content update",
      primaryOwner: "Content",
      secondaryOwners: ["SEO"],
      owners: ["Content", "SEO"],
      ownerRoutingConfidence: "CONFIRMED_OWNER",
      pageImportanceStatus: "PAGE_IMPORTANCE_CONFIGURED",
      isWatchlistedPage: true,
      isQuickWin: false,
      timelineBucket: "DO_NEXT",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "CMS Editor",
      recommendedAction: "Refresh stale sections and cover missing commercial subtopics",
      verificationInstructions: "Verify rendered content in browser",
      actionStatus: "OPEN",
      statusHistory: [],
    };

    const mockAssessment: ContentLifecycleAssessment = {
      projectId: "p1",
      url: "https://example.com/services/cmdb",
      pageType: "service_page",
      freshnessSensitivity: "LOW_FRESHNESS_SENSITIVITY",
      lifecycleState: "CONFIRMED_DECAY",
      primaryAction: "REFRESH",
      changeRisk: "MODERATE_CHANGE_RISK",
      trendShape: "GRADUAL_DECLINE",
      observedSignals: [],
      recentPerformance: { periodRange: "90d", monthlyImpressions: 5000, monthlyClicks: 150, averageCtr: 3.0, rankingQueryClustersCount: 5, topRankingClusterIds: ["c1"] },
      queryClusterShifts: [],
      isTechnicalBlocked: false,
      isGoogleIndexBlocked: false,
      isMigrationTransition: false,
      isSeasonallyDriven: false,
      isDemandDriven: false,
      isSerpCompetitorDriven: false,
      isSerpLayoutConfounded: false,
      isCannibalizationPressure: false,
      isComplianceProtected: false,
      confidence: "HIGH",
      uncertaintyReasons: [],
      policySelected: "Default Policy",
      thresholdsUsed: {},
      policySource: "SYSTEM_DEFAULT",
      reasonClassificationTriggered: "Confirmed progressive decay",
      modelVersion: "1.0.0",
      policyVersion: "1.0.0",
    };

    const enriched = enrichPhase11ActionsWithLifecycle([mockAction], [mockAssessment]);

    expect(enriched[0].actionId).toBe("ACT_CONTENT_REFRESH_CMDB");
    expect(enriched[0].actionPriority).toBe("HIGH");
    expect(enriched[0].primaryOwner).toBe("Content");
    expect(enriched[0].whyThisPriority?.some((w) => w.includes("CONFIRMED_DECAY"))).toBe(true);
  });
});
