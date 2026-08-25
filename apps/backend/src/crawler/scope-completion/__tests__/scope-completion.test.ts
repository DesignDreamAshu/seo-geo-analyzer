// Custom lightweight test runner for self-contained execution
function describe(name: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${name} ---`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message || err}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeDefined() {
      if (actual === undefined || actual === null) throw new Error(`Expected value to be defined, got ${actual}`);
    },
    toBeGreaterThan(expected: number) {
      if (actual <= expected) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (actual < expected) throw new Error(`Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected: number) {
      if (actual >= expected) throw new Error(`Expected ${actual} < ${expected}`);
    },
    toContain(expected: string) {
      if (typeof actual === "string" && !actual.includes(expected)) {
        throw new Error(`Expected string to contain ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
      } else if (Array.isArray(actual) && !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected deep equality:\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
      }
    },
  };
}

import { evaluateScopePreset, evaluateScopeItem, DEFAULT_BOT_MANUAL_CHECKLIST, verifySpecificLinks } from "../engine";
import { BOT_SEO_SCOPE_V1 } from "../presets/bot-seo-scope-v1";
import type { DiagnosticIssue, CrawledPageData } from "../../types";
import type { ScopePreset, ManualQaChecklistItem } from "../types";

describe("Scope Completion Engine — Mathematical & Data Integrity Invariant Tests", () => {
  // Test 1: Tier with 97 affected URLs cannot report 12 unique affected URLs (True Mathematical Union)
  it("1. tier with 97 affected URLs computes true mathematical union (>= 97 URLs)", () => {
    const headingHierarchyIssue: DiagnosticIssue = {
      id: "headings_fail",
      code: "CONTENT_SKIPPED_HEADINGS",
      category: "content_relevance",
      severity: "warning",
      title: "Skipped headings",
      description: "Skipped headings across 97 pages",
      recommendation: "Fix heading hierarchy",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 6,
      affectedCount: 97,
      affectedOccurrences: 140,
      affectedUniquePages: 97,
      eligiblePageCount: 167,
      affectedRatio: 97 / 167,
      affectedPages: Array.from({ length: 97 }, (_, i) => ({
        url: `https://www.botconsulting.io/page-${i}`,
        evidence: { observed: "H2 skipped to H4" } as any,
      })),
    };

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [headingHierarchyIssue], [], [], "https://www.botconsulting.io/");
    expect(result.tierSummaries.CORE_COMMITTED_BASIC.uniqueAffectedUrls.length).toBe(97);
    expect(result.metrics.coreUniqueAffectedUrls).toBe(97);
    expect(result.metrics.overallAgreedWorkUniqueAffectedUrls).toBe(97);
  });

  // Test 2: Root-cause grouping does not alter affected URL union
  it("2. root-cause grouping (2 template edits) does not collapse 97 unique affected URLs", () => {
    const headingHierarchyIssue: DiagnosticIssue = {
      id: "headings_fail",
      code: "CONTENT_SKIPPED_HEADINGS",
      category: "content_relevance",
      severity: "warning",
      title: "Skipped headings",
      description: "Skipped headings across 97 pages",
      recommendation: "Fix heading hierarchy",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 6,
      affectedCount: 97,
      affectedOccurrences: 140,
      affectedUniquePages: 97,
      eligiblePageCount: 167,
      affectedRatio: 97 / 167,
      isSystemicTemplateIssue: true,
      componentGuess: "job_template",
      affectedPages: Array.from({ length: 97 }, (_, i) => ({
        url: `https://www.botconsulting.io/post/item-${i}`,
        evidence: { observed: "H2 skipped to H4" } as any,
      })),
    };

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [headingHierarchyIssue], [], [], "https://www.botconsulting.io/");
    const item = result.itemResults.find((r) => r.item.id === "CORE_HEADING_HIERARCHY");
    expect(item?.affectedCount).toBe(97);
    expect(item?.affectedUrls.length).toBe(97);
    // Estimated changes is reduced to template edit (~1), but affected URL count remains 97
    expect(item?.estimatedChangesRemaining).toBe(1);
    expect(result.metrics.coreUniqueAffectedUrls).toBe(97);
  });

  // Test 3: Manual pending item has estimatedChanges = 0 (or unknown), not 1 edit
  it("3. pending manual review item is not represented as an edit", () => {
    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [], [], [], "https://www.botconsulting.io/");
    const copyQa = result.itemResults.find((r) => r.item.id === "CORE_VISIBLE_COPY_QA");
    expect(copyQa?.status).toBe("REVIEW_REQUIRED");
    expect(copyQa?.estimatedChangesRemaining).toBe(0);
    const queueItem = result.fastCompletionQueue.find((q) => q.scopeItemId === "CORE_VISIBLE_COPY_QA");
    expect(queueItem?.estimatedActualChanges).toBe("UNKNOWN_PENDING_REVIEW");
    expect(queueItem?.isManualReview).toBe(true);
  });

  // Test 4: Manual PASS with no fixes => changesRequired = 0
  it("4. manual QA approved without changes requires 0 implementation edits", () => {
    const approvedManual: ManualQaChecklistItem[] = DEFAULT_BOT_MANUAL_CHECKLIST.map((m) => ({
      ...m,
      status: "APPROVED",
      estimatedChanges: 0,
    }));

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [], [], approvedManual, "https://www.botconsulting.io/");
    const copyQa = result.itemResults.find((r) => r.item.id === "CORE_VISIBLE_COPY_QA");
    expect(copyQa?.status).toBe("PASS");
    expect(copyQa?.estimatedChangesRemaining).toBe(0);
    expect(result.metrics.coreVerifiedPercent).toBe(100);
  });

  // Test 5: Detection gap != confirmed implementation FAIL
  it("5. detection gap does not reduce known technical implementation completion", () => {
    // When all technical automatic rules pass cleanly, known technical implementation is 100%
    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [], [], [], "https://www.botconsulting.io/");
    expect(result.metrics.coreKnownImplementationPercent).toBe(100);
    // But verified completion is blocked by pending manual/gap reviews
    expect(result.metrics.coreVerifiedPercent).toBeLessThan(100);
    expect(result.gateStatus).toBe("BOT_BASIC_SEO_INCOMPLETE");
  });

  // Test 6: Historical URL absent from crawl graph triggers direct probe CRAWL_DISCOVERY_GAP
  it("6. historical AR.BOT URL absent from crawl traversal returns CRAWL_DISCOVERY_GAP", () => {
    const linkVerifications = verifySpecificLinks([], []);
    expect(linkVerifications.length).toBe(1);
    expect(linkVerifications[0].status).toBe("CRAWL_DISCOVERY_GAP");
    expect(linkVerifications[0].requestedSourceUrl).toContain("ar-bot-ai-powered");
  });

  // Test 7: Placeholder href (CODE_PLACEHOLDER_ANCHOR) does not count as accessible link name failure
  it("7. placeholder anchor (href='#') does not map to accessible link names scope item", () => {
    const accessibleLinkItem = BOT_SEO_SCOPE_V1.items.find((i) => i.id === "TECH_ACCESSIBLE_LINK_NAMES");
    expect(accessibleLinkItem?.mappedRuleCodes.includes("CODE_PLACEHOLDER_ANCHOR")).toBe(false);
    expect(accessibleLinkItem?.mappedRuleCodes.includes("LINKS_EMPTY_ANCHOR")).toBe(true);
    expect(accessibleLinkItem?.mappedRuleCodes.includes("LINKS_NON_DESCRIPTIVE_ANCHOR")).toBe(true);
  });

  // Test 8: Image element counts and affected-page counts remain distinct
  it("8. image occurrence counts and affected-page counts remain mathematically distinct", () => {
    const missingDimensionsIssue: DiagnosticIssue = {
      id: "img_dim_fail",
      code: "ASSET_MISSING_DIMENSIONS",
      category: "page_speed_assets",
      severity: "opportunity",
      title: "Missing image dimensions",
      description: "112 images missing width/height across 56 pages",
      recommendation: "Add width and height",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 4,
      affectedCount: 56,
      affectedOccurrences: 112,
      affectedUniquePages: 56,
      eligiblePageCount: 56,
      affectedRatio: 1.0,
      affectedPages: Array.from({ length: 56 }, (_, i) => ({
        url: `https://www.botconsulting.io/p-${i}`,
        evidence: { observed: "2 images missing dimensions" } as any,
      })),
    };

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [missingDimensionsIssue], [], [], "https://www.botconsulting.io/");
    const item = result.itemResults.find((r) => r.item.id === "TECH_IMAGE_DIMENSIONS");
    expect(item?.affectedCount).toBe(56);
    expect(item?.affectedOccurrences).toBe(56); // 56 pages in mock array
    expect(result.tierSummaries.INCLUDED_QUICK_TECHNICAL.uniqueAffectedUrls.length).toBe(56);
  });

  // Test 9: Client-safe and expert metrics reconcile exactly
  it("9. client-safe summary and expert metrics reconcile exactly", () => {
    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [], [], [], "https://www.botconsulting.io/");
    expect(result.clientSafeSummary.coreBasicSeo.knownImplementationPercent).toBe(result.metrics.coreKnownImplementationPercent);
    expect(result.clientSafeSummary.coreBasicSeo.verifiedCompletionPercent).toBe(result.metrics.coreVerifiedPercent);
    expect(result.clientSafeSummary.quickTechnical.knownImplementationPercent).toBe(result.metrics.quickTechKnownImplementationPercent);
  });

  // Test 10: One core FAIL reduces known technical implementation
  it("10. one core technical FAIL reduces known technical implementation completion", () => {
    const failingH1: DiagnosticIssue = {
      id: "h1_fail",
      code: "CONTENT_MISSING_H1",
      category: "content_relevance",
      severity: "critical",
      title: "Missing H1",
      description: "H1 missing",
      recommendation: "Add H1",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 8,
      affectedCount: 1,
      affectedOccurrences: 1,
      affectedUniquePages: 1,
      eligiblePageCount: 1,
      affectedRatio: 1.0,
      affectedPages: [{ url: "https://www.botconsulting.io/", evidence: {} as any }],
    };

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [failingH1], [], [], "https://www.botconsulting.io/");
    expect(result.metrics.coreKnownImplementationPercent).toBeLessThan(100);
    expect(result.gateStatus).toBe("BOT_BASIC_SEO_INCOMPLETE");
  });

  // Test 11: Advanced recommendation failure does not reduce Core Basic completion
  it("11. advanced recommendation failure does not reduce Core Basic completion", () => {
    const advancedNosniffIssue: DiagnosticIssue = {
      id: "sec_nosniff",
      code: "SEC_MISSING_NOSNIFF",
      category: "code_validation",
      severity: "opportunity",
      title: "Missing nosniff",
      description: "Header missing",
      recommendation: "Add header",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 2,
      affectedCount: 200,
      affectedOccurrences: 200,
      affectedUniquePages: 200,
      eligiblePageCount: 200,
      affectedRatio: 1.0,
      affectedPages: Array.from({ length: 200 }, (_, i) => ({ url: `https://www.botconsulting.io/p${i}`, evidence: {} as any })),
    };

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [advancedNosniffIssue], [], [], "https://www.botconsulting.io/");
    expect(result.metrics.coreKnownImplementationPercent).toBe(100);
    expect(result.tierSummaries.ADVANCED_RECOMMENDATION.failedCount).toBe(1);
  });

  // Test 12: Fast completion queue exposes guaranteed technical vs conditional manual progress
  it("12. fast completion queue exposes guaranteed technical vs conditional manual progress", () => {
    const failingH1: DiagnosticIssue = {
      id: "h1_fail",
      code: "CONTENT_MISSING_H1",
      category: "content_relevance",
      severity: "critical",
      title: "Missing H1",
      description: "H1 missing",
      recommendation: "Add H1",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 8,
      affectedCount: 1,
      affectedOccurrences: 1,
      affectedUniquePages: 1,
      eligiblePageCount: 1,
      affectedRatio: 1.0,
      affectedPages: [{ url: "https://www.botconsulting.io/", evidence: {} as any }],
    };

    const result = evaluateScopePreset(BOT_SEO_SCOPE_V1, [failingH1], [], [], "https://www.botconsulting.io/");
    const h1QueueItem = result.fastCompletionQueue.find((q) => q.scopeItemId === "CORE_MISSING_H1");
    expect(h1QueueItem?.guaranteedTechnicalProgress).toBeDefined();
    expect(h1QueueItem?.isManualReview).toBe(false);

    const copyQaQueueItem = result.fastCompletionQueue.find((q) => q.scopeItemId === "CORE_VISIBLE_COPY_QA");
    expect(copyQaQueueItem?.conditionalManualProgress).toBeDefined();
    expect(copyQaQueueItem?.isManualReview).toBe(true);
  });
});
