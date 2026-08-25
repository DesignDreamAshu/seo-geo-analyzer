/**
 * Test Suite for Action Validation & Verification.
 */

import { SeoActionItem } from "../types";
import { markActionCompleted, validateActionAgainstRecrawl } from "../action-validator";

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

describe("Action Validation & Verification", () => {
  const baseAction: SeoActionItem = {
    actionId: "ACT_001",
    projectId: "bot-consulting",
    type: "TECHNICAL_FIX",
    nature: "DETERMINISTIC_FIX",
    title: "Fix H1 on /about",
    description: "Add H1",
    underlyingRuleCodes: ["CONTENT_MISSING_H1"],
    monitoringSignals: [],
    sourceSignals: [],
    affectedUrls: ["https://www.botconsulting.io/about"],
    representativeUrls: ["https://www.botconsulting.io/about"],
    affectedUrlsCount: 1,
    estimatedRealEdits: 1,
    technicalSeverity: "high",
    actionPriority: "HIGH",
    whyThisPriority: ["Missing H1"],
    effort: "TRIVIAL",
    effortRationale: "Edit H1 in Designer",
    primaryOwner: "CMS Editor",
    secondaryOwners: ["SEO"],
    owners: ["CMS Editor", "SEO"],
    ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
    isQuickWin: true,
    timelineBucket: "DO_NOW",
    blockedByActionIds: [],
    blockingActionIds: [],
    whereToFix: "Webflow Page",
    recommendedAction: "Add H1",
    verificationInstructions: "Recrawl",
    actionStatus: "OPEN",
    statusHistory: [],
  };

  it("1. User marks action complete: transitions to IMPLEMENTATION_MARKED_COMPLETE", () => {
    const updated = markActionCompleted(baseAction, "Fixed in Webflow Designer");
    expect(updated.actionStatus).toBe("IMPLEMENTATION_MARKED_COMPLETE");
  });

  it("2. Recrawl Confirms Resolution: transitions to VERIFIED_RESOLVED", () => {
    const mockCrawlClean: any = {
      pages: { "https://www.botconsulting.io/about": { statusCode: 200 } },
      findings: [], // Clean crawl!
    };

    const marked = markActionCompleted(baseAction);
    const { validatedAction, resolutionConfirmed } = validateActionAgainstRecrawl(marked, mockCrawlClean);

    expect(resolutionConfirmed).toBe(true);
    expect(validatedAction.actionStatus).toBe("VERIFIED_RESOLVED");
  });

  it("3. Recrawl Detects Persisting Defect: transitions to VALIDATION_FAILED", () => {
    const mockCrawlFailing: any = {
      pages: { "https://www.botconsulting.io/about": { statusCode: 200 } },
      findings: [
        {
          ruleCode: "CONTENT_MISSING_H1",
          url: "https://www.botconsulting.io/about",
          severity: "high",
        },
      ],
    };

    const marked = markActionCompleted(baseAction);
    const { validatedAction, resolutionConfirmed } = validateActionAgainstRecrawl(marked, mockCrawlFailing);

    expect(resolutionConfirmed).toBe(false);
    expect(validatedAction.actionStatus).toBe("VALIDATION_FAILED");
  });
});
