/**
 * Test Suite for Quick-Win Classification & Safeguards.
 */

import { SeoActionItem } from "../types";
import { evaluateQuickWin } from "../quick-win-evaluator";

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

describe("Quick-Win Classification & Safeguards", () => {
  const baseAction: SeoActionItem = {
    actionId: "ACT_001",
    projectId: "bot-consulting",
    type: "SYSTEMIC_TEMPLATE_FIX",
    nature: "DETERMINISTIC_FIX",
    title: "Repair Blog CMS Open Graph binding",
    description: "Fix OG image on 57 blog pages",
    underlyingRuleCodes: ["SOCIAL_INCOMPLETE_OG"],
    monitoringSignals: [],
    sourceSignals: [],
    affectedUrls: Array.from({ length: 57 }, (_, i) => `https://www.botconsulting.io/blog/post-${i}`),
    representativeUrls: ["https://www.botconsulting.io/blog/post-1"],
    affectedUrlsCount: 57,
    estimatedRealEdits: 1,
    technicalSeverity: "high",
    actionPriority: "HIGH",
    whyThisPriority: ["Systemic template regression"],
    effort: "LOW",
    effortRationale: "Single template edit in Webflow Designer",
    primaryOwner: "CMS Editor",
    secondaryOwners: ["SEO"],
    owners: ["CMS Editor", "SEO"],
    ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
    gscExposure: { totalImpressions: 42000, totalClicks: 1100, averageCtr: 2.6, averagePosition: 8.4, topQueries: [], dataQuality: "FRESH_COMPLETE" },
    isQuickWin: false,
    timelineBucket: "DO_NOW",
    blockedByActionIds: [],
    blockingActionIds: [],
    whereToFix: "Webflow Blog Collection Template",
    recommendedAction: "Bind OG image field",
    verificationInstructions: "Recrawl",
    actionStatus: "OPEN",
    statusHistory: [],
  };

  it("1. High-Leverage Systemic Fix: classified as QUICK WIN (High Priority + Low Effort)", () => {
    const res = evaluateQuickWin(baseAction);
    expect(res.isQuickWin).toBe(true);
    expect(res.quickWinRationale?.includes("57 affected pages")).toBe(true);
  });

  it("2. Low-Effort Low-Priority Finding: NOT classified as quick win (prevents trivial noise)", () => {
    const lowPriorityAction: SeoActionItem = {
      ...baseAction,
      type: "TECHNICAL_FIX",
      title: "Add decorative ALT to footer icon on unvisited utility page",
      affectedUrlsCount: 1,
      actionPriority: "LOW",
      effort: "TRIVIAL",
      gscExposure: undefined,
    };

    const res = evaluateQuickWin(lowPriorityAction);
    expect(res.isQuickWin).toBe(false); // Disqualified because priority is LOW!
  });
});
