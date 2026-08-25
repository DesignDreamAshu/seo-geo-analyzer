/**
 * Comprehensive Redirect Validation Tests.
 * Separate tests for 301, 308, 302, 307, meta refresh, JS, chains, loops,
 * 404, 410, noindex, canonicalized-away, wrong locale, and wrong branch.
 */

import { validateMigrationRedirects } from "../redirect-validator";
import { UrlMappingEntry } from "../types";

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

describe("2. Comprehensive Redirect Validation & Edge Cases", () => {
  it("2.1. 301 and 308 permanent redirects pass without temporary warnings", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/p1", destinationUrl: "https://new.com/p1", mappingType: "ONE_TO_ONE", mappingSource: "REDIRECT_DISCOVERED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], observedRedirectStatus: 301, contentParity: "CONTENT_PARITY_STRONG", blockerState: "NON_BLOCKING", notes: "" },
      { mappingId: "m2", sourceUrl: "https://old.com/p2", destinationUrl: "https://new.com/p2", mappingType: "ONE_TO_ONE", mappingSource: "REDIRECT_DISCOVERED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], observedRedirectStatus: 308, contentParity: "CONTENT_PARITY_STRONG", blockerState: "NON_BLOCKING", notes: "" },
    ];

    const issues = validateMigrationRedirects(mappings, new Map());
    expect(issues.length).toBe(0);
  });

  it("2.2. 302 and 307 temporary redirects emit MIGRATION_TEMPORARY_REDIRECT_REVIEW", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/p1", destinationUrl: "https://new.com/p1", mappingType: "ONE_TO_ONE", mappingSource: "REDIRECT_DISCOVERED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], observedRedirectStatus: 302, contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
      { mappingId: "m2", sourceUrl: "https://old.com/p2", destinationUrl: "https://new.com/p2", mappingType: "ONE_TO_ONE", mappingSource: "REDIRECT_DISCOVERED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], observedRedirectStatus: 307, contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
    ];

    const issues = validateMigrationRedirects(mappings, new Map());
    expect(issues.length).toBe(2);
    expect(issues[0].issueType).toBe("MIGRATION_TEMPORARY_REDIRECT_REVIEW");
    expect(issues[1].issueType).toBe("MIGRATION_TEMPORARY_REDIRECT_REVIEW");
  });

  it("2.3. Meta refresh and JavaScript redirects are flagged", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/p1", destinationUrl: "https://new.com/p1", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
      { mappingId: "m2", sourceUrl: "https://old.com/p2", destinationUrl: "https://new.com/p2", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
    ];

    const crawlMap = new Map([
      ["https://new.com/p1", { redirectMethod: "META_REFRESH" }],
      ["https://new.com/p2", { redirectMethod: "JAVASCRIPT" }],
    ]);

    const issues = validateMigrationRedirects(mappings, crawlMap as any);
    expect(issues.some((i) => i.issueType === "MIGRATION_META_REFRESH_REDIRECT")).toBe(true);
    expect(issues.some((i) => i.issueType === "MIGRATION_JAVASCRIPT_REDIRECT")).toBe(true);
  });

  it("2.4. Redirect loop and multi-hop chain are detected accurately", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/loop", destinationUrl: "https://old.com/loop", mappingType: "ONE_TO_ONE", mappingSource: "REDIRECT_DISCOVERED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "LAUNCH_BLOCKER", notes: "" },
      { mappingId: "m2", sourceUrl: "https://old.com/chain", destinationUrl: "https://old.com/step2", mappingType: "ONE_TO_ONE", mappingSource: "REDIRECT_DISCOVERED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], redirectHopCount: 3, finalResolvedUrl: "https://new.com/final", contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
    ];

    const issues = validateMigrationRedirects(mappings, new Map());
    expect(issues.some((i) => i.issueType === "MIGRATION_REDIRECT_LOOP")).toBe(true);
    expect(issues.some((i) => i.issueType === "MIGRATION_REDIRECT_CHAIN")).toBe(true);
  });

  it("2.5. Broken targets (404 and 410) and noindex targets are flagged", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/p1", destinationUrl: "https://new.com/404", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "LAUNCH_BLOCKER", notes: "" },
      { mappingId: "m2", sourceUrl: "https://old.com/p2", destinationUrl: "https://new.com/410", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "LAUNCH_BLOCKER", notes: "" },
      { mappingId: "m3", sourceUrl: "https://old.com/p3", destinationUrl: "https://new.com/noindex", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "LAUNCH_BLOCKER", notes: "" },
    ];

    const crawlMap = new Map([
      ["https://new.com/404", { statusCode: 404 }],
      ["https://new.com/410", { statusCode: 410 }],
      ["https://new.com/noindex", { statusCode: 200, isNoindex: true }],
    ]);

    const issues = validateMigrationRedirects(mappings, crawlMap as any);
    expect(issues.some((i) => i.issueType === "MIGRATION_REDIRECT_TARGET_BROKEN")).toBe(true);
    expect(issues.some((i) => i.issueType === "MIGRATION_REDIRECT_TARGET_410")).toBe(true);
    expect(issues.some((i) => i.issueType === "MIGRATION_REDIRECT_TARGET_NON_INDEXABLE")).toBe(true);
  });

  it("2.6. Canonicalized-away target is flagged with direct destination recommendation", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/service", destinationUrl: "https://new.com/service-alias", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
    ];

    const crawlMap = new Map([
      ["https://new.com/service-alias", { statusCode: 200, canonicalUrl: "https://new.com/master-service" }],
    ]);

    const issues = validateMigrationRedirects(mappings, crawlMap as any);
    expect(issues.some((i) => i.issueType === "MIGRATION_REDIRECT_TARGET_CANONICAL_MISMATCH")).toBe(true);
  });

  it("2.7. Wrong locale and wrong branch location mapping are flagged cleanly", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/fr/consulting", destinationUrl: "https://new.com/en/consulting", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
      { mappingId: "m2", sourceUrl: "https://old.com/jaipur-office", destinationUrl: "https://new.com/delhi-office", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "HIGH", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "REVIEW_BEFORE_LAUNCH", notes: "" },
    ];

    const issues = validateMigrationRedirects(mappings, new Map());
    expect(issues.some((i) => i.issueType === "MIGRATION_LOCALE_MAPPING_CONFLICT")).toBe(true);
    expect(issues.some((i) => i.issueType === "MIGRATION_BRANCH_MAPPING_CONFLICT")).toBe(true);
  });
});
