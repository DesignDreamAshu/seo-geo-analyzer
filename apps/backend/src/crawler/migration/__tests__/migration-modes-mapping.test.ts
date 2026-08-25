/**
 * Hardened Migration Modes & URL Mapping Certification Tests.
 * Named tests for ONE_TO_ONE, UNCHANGED, MANY_TO_ONE, ONE_TO_MANY_REVIEW,
 * REMOVED_NO_REPLACEMENT, MANUAL_REVIEW, semantic candidate safety, and versioning.
 */

import { buildUrlMappings, evaluateSourceUrlImportance } from "../mapping-engine";
import { SourceUrlRecord, DestinationUrlRecord, UrlMappingEntry } from "../types";
import { DEFAULT_MIGRATION_POLICY } from "../config";

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

describe("1. Hardened URL Mapping Engine & Modes", () => {
  it("1.1. ONE_TO_ONE: direct equivalent destination mapped cleanly", () => {
    const src: SourceUrlRecord = { url: "https://old.com/services/cmdb", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 100, gscImpressions: 1000, backlinkCount: 10, referringDomainCount: 5, isHighValue: true, importanceReasons: ["GSC_SEARCH_TRAFFIC_LEADER"] };
    const dest: DestinationUrlRecord = { url: "https://new.com/servicenow/cmdb", isIndexable: true, inSitemap: true, internalLinkCount: 5, hasSchema: true };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [dest],
      configuredMappings: [{ sourceUrl: "https://old.com/services/cmdb", destinationUrl: "https://new.com/servicenow/cmdb" }],
    });

    expect(mappings[0].mappingType).toBe("ONE_TO_ONE");
    expect(mappings[0].mappingConfidence).toBe("DETERMINISTIC");
    expect(mappings[0].redirectEquivalence).toBe("STRONG_EQUIVALENCE");
  });

  it("1.2. UNCHANGED: preserved URL path classified as UNCHANGED and EXACT_REPLACEMENT", () => {
    const src: SourceUrlRecord = { url: "https://brand.com/about", isIndexable: true, inSitemap: true, internalLinkCount: 10, gscClicks: 20, gscImpressions: 200, backlinkCount: 2, referringDomainCount: 1, isHighValue: false, importanceReasons: [] };
    const dest: DestinationUrlRecord = { url: "https://brand.com/about", isIndexable: true, inSitemap: true, internalLinkCount: 10, hasSchema: false };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [dest],
    });

    expect(mappings[0].mappingType).toBe("UNCHANGED");
    expect(mappings[0].redirectEquivalence).toBe("EXACT_REPLACEMENT");
  });

  it("1.3. MANY_TO_ONE: multiple old pages consolidating into single destination are detected", () => {
    const src1: SourceUrlRecord = { url: "https://old.com/blog/2021/post-a", isIndexable: true, inSitemap: true, internalLinkCount: 2, gscClicks: 10, gscImpressions: 100, backlinkCount: 1, referringDomainCount: 1, isHighValue: false, importanceReasons: [] };
    const src2: SourceUrlRecord = { url: "https://old.com/blog/2022/post-b", isIndexable: true, inSitemap: true, internalLinkCount: 2, gscClicks: 15, gscImpressions: 150, backlinkCount: 1, referringDomainCount: 1, isHighValue: false, importanceReasons: [] };

    const mappings = buildUrlMappings({
      sourceUrls: [src1, src2],
      destinationUrls: [],
      configuredMappings: [
        { sourceUrl: "https://old.com/blog/2021/post-a", destinationUrl: "https://new.com/blog/comprehensive-guide" },
        { sourceUrl: "https://old.com/blog/2022/post-b", destinationUrl: "https://new.com/blog/comprehensive-guide" },
      ],
    });

    expect(mappings[0].mappingType).toBe("MANY_TO_ONE");
    expect(mappings[1].mappingType).toBe("MANY_TO_ONE");
  });

  it("1.4. ONE_TO_MANY_REVIEW: source page split into multiple destinations requires human decision", () => {
    const src: SourceUrlRecord = { url: "https://old.com/mega-service-bundle", isIndexable: true, inSitemap: true, internalLinkCount: 10, gscClicks: 300, gscImpressions: 4000, backlinkCount: 20, referringDomainCount: 10, isHighValue: true, importanceReasons: ["GSC_SEARCH_TRAFFIC_LEADER"] };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [],
      configuredMappings: [
        { sourceUrl: "https://old.com/mega-service-bundle", destinationUrl: "https://new.com/service-1", isMultiDestination: true },
      ],
    });

    expect(mappings[0].mappingType).toBe("ONE_TO_MANY_REVIEW");
    expect(mappings[0].mappingConfidence).toBe("MANUAL_REVIEW");
    expect(mappings[0].blockerState).toBe("REVIEW_BEFORE_LAUNCH");
  });

  it("1.5. REMOVED_NO_REPLACEMENT: deliberately retired content is NON_BLOCKING", () => {
    const src: SourceUrlRecord = { url: "https://old.com/discontinued-feature", isIndexable: true, inSitemap: false, internalLinkCount: 0, gscClicks: 0, gscImpressions: 0, backlinkCount: 0, referringDomainCount: 0, isHighValue: false, importanceReasons: [] };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [],
      configuredMappings: [{ sourceUrl: "https://old.com/discontinued-feature", isRemoved: true }],
    });

    expect(mappings[0].mappingType).toBe("REMOVED_NO_REPLACEMENT");
    expect(mappings[0].blockerState).toBe("NON_BLOCKING");
  });

  it("1.6. Configured explicit mapping overrides semantic candidate and discovered redirect", () => {
    const src: SourceUrlRecord = { url: "https://old.com/pricing", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 100, gscImpressions: 1000, backlinkCount: 5, referringDomainCount: 2, isHighValue: true, importanceReasons: [] };
    const destExact: DestinationUrlRecord = { url: "https://old.com/pricing", isIndexable: true, inSitemap: true, internalLinkCount: 5, hasSchema: false };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [destExact],
      configuredMappings: [{ sourceUrl: "https://old.com/pricing", destinationUrl: "https://new.com/plans-and-pricing" }],
      discoveredRedirects: new Map([["https://old.com/pricing", { targetUrl: "https://new.com/generic-pricing", statusCode: 301 }]]),
      semanticCandidates: new Map([["https://old.com/pricing", { candidateUrl: "https://new.com/cost", similarity: 0.95 }]]),
    });

    expect(mappings[0].destinationUrl).toBe("https://new.com/plans-and-pricing");
    expect(mappings[0].mappingSource).toBe("CONFIGURED");
  });

  it("1.7. Semantic candidate remains SEMANTIC_CANDIDATE and requires review before confirmation", () => {
    const src: SourceUrlRecord = { url: "https://old.com/knowledge-hub", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 80, gscImpressions: 800, backlinkCount: 5, referringDomainCount: 2, isHighValue: true, importanceReasons: [] };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [],
      semanticCandidates: new Map([["https://old.com/knowledge-hub", { candidateUrl: "https://new.com/resources", similarity: 0.88 }]]),
    });

    expect(mappings[0].mappingSource).toBe("SEMANTIC_CANDIDATE");
    expect(mappings[0].mappingType).toBe("MANUAL_REVIEW");
    expect(mappings[0].blockerState).toBe("REVIEW_BEFORE_LAUNCH");
  });

  it("1.8. Low-equivalence homepage mapping is classified as UNRELATED_HOMEPAGE and flagged", () => {
    const src: SourceUrlRecord = { url: "https://old.com/enterprise/servicenow/cmdb-audit", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 200, gscImpressions: 2000, backlinkCount: 15, referringDomainCount: 8, isHighValue: true, importanceReasons: ["GSC_SEARCH_TRAFFIC_LEADER"] };

    const mappings = buildUrlMappings({
      sourceUrls: [src],
      destinationUrls: [],
      configuredMappings: [{ sourceUrl: "https://old.com/enterprise/servicenow/cmdb-audit", destinationUrl: "https://new.com/" }],
    });

    expect(mappings[0].redirectEquivalence).toBe("UNRELATED_HOMEPAGE");
    expect(mappings[0].blockerState).toBe("REVIEW_BEFORE_LAUNCH");
  });

  it("1.9. Mapping change detection classifies MAPPING_UNCHANGED vs MAPPING_CHANGED vs MAPPING_ADDED", () => {
    const src1: SourceUrlRecord = { url: "https://old.com/p1", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 0, gscImpressions: 0, backlinkCount: 0, referringDomainCount: 0, isHighValue: false, importanceReasons: [] };
    const src2: SourceUrlRecord = { url: "https://old.com/p2", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 0, gscImpressions: 0, backlinkCount: 0, referringDomainCount: 0, isHighValue: false, importanceReasons: [] };

    const previousMappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/p1", destinationUrl: "https://new.com/p1-old", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "DETERMINISTIC", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: false, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "NON_BLOCKING", notes: "" },
    ];

    const currentMappings = buildUrlMappings({
      sourceUrls: [src1, src2],
      destinationUrls: [],
      configuredMappings: [
        { sourceUrl: "https://old.com/p1", destinationUrl: "https://new.com/p1-new" }, // Changed
        { sourceUrl: "https://old.com/p2", destinationUrl: "https://new.com/p2" }, // Added
      ],
      previousMappings,
    });

    expect(currentMappings[0].mappingChangeType).toBe("MAPPING_CHANGED");
    expect(currentMappings[1].mappingChangeType).toBe("MAPPING_ADDED");
  });
});
