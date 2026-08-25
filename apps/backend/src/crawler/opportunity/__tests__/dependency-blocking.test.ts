/**
 * Test Suite for Action Dependency & Blocking Engine.
 */

import { SeoActionItem } from "../types";
import { resolveActionDependencies } from "../dependency-engine";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("Action Dependency & Blocking Engine", () => {
  it("1. Upstream Indexability Defect Blocks Downstream CTR Opportunity: marks CTR action as BLOCKED", () => {
    const indexAction: SeoActionItem = {
      actionId: "ACT_INDEX_001",
      projectId: "bot-consulting",
      type: "INDEXABILITY_FIX",
      nature: "DETERMINISTIC_FIX",
      title: "Remove accidental noindex on /services",
      description: "Page is noindexed",
      underlyingRuleCodes: ["INDEXABILITY_NOINDEX"],
      monitoringSignals: [],
      sourceSignals: [],
      affectedUrls: ["https://www.botconsulting.io/services"],
      representativeUrls: ["https://www.botconsulting.io/services"],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "critical",
      actionPriority: "CRITICAL",
      whyThisPriority: ["Critical indexability defect"],
      effort: "LOW",
      effortRationale: "Remove noindex tag",
      primaryOwner: "Developer",
      secondaryOwners: ["SEO"],
      owners: ["Developer", "SEO"],
      ownerRoutingConfidence: "CONFIRMED_OWNER",
      pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
      isQuickWin: false,
      timelineBucket: "DO_NOW",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "Page Settings",
      recommendedAction: "Remove noindex",
      verificationInstructions: "Recrawl",
      actionStatus: "OPEN",
      statusHistory: [],
    };

    const ctrAction: SeoActionItem = {
      actionId: "ACT_CTR_002",
      projectId: "bot-consulting",
      type: "CTR_OPPORTUNITY",
      nature: "CONTENT_RECOMMENDATION",
      title: "Optimize title snippet for 'consulting services'",
      description: "Low CTR on query",
      underlyingRuleCodes: [],
      monitoringSignals: [],
      sourceSignals: [],
      affectedUrls: ["https://www.botconsulting.io/services"],
      representativeUrls: ["https://www.botconsulting.io/services"],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "info",
      actionPriority: "MEDIUM",
      whyThisPriority: ["Growth opportunity"],
      effort: "LOW",
      effortRationale: "Snippet copy edit",
      primaryOwner: "SEO",
      secondaryOwners: ["Content"],
      owners: ["SEO", "Content"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
      pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
      isQuickWin: true,
      timelineBucket: "DO_NEXT",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "Title tag",
      recommendedAction: "Rewrite title",
      verificationInstructions: "Track CTR",
      actionStatus: "OPEN",
      statusHistory: [],
    };

    const resolved = resolveActionDependencies([indexAction, ctrAction]);

    const resolvedCtr = resolved.find((a) => a.actionId === "ACT_CTR_002");
    expect(resolvedCtr?.actionStatus).toBe("BLOCKED");
    expect(resolvedCtr?.blockedByActionIds.includes("ACT_INDEX_001")).toBe(true);
    expect(resolvedCtr?.caution?.includes("Blocked by upstream indexability")).toBe(true);
  });
});
