/**
 * SERP Intent & Result-Type Landscape Tests.
 * Proves dominant intent calculation, intent disagreement with Phase 12,
 * and page format mismatch discovery.
 */

import { classifyResultType, analyzeSerpIntentDistribution, analyzeResultTypeDistribution } from "../intent-result-type";
import { OrganicSerpResult } from "../types";

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

describe("4. SERP Intent & Result-Type Distribution", () => {
  it("4.1. Classifies page result types accurately", () => {
    expect(classifyResultType("https://example.com/", "Home", "").resultType).toBe("HOMEPAGE");
    expect(classifyResultType("https://example.com/services/cmdb", "ServiceNow CMDB Consulting", "").resultType).toBe("SERVICE_PAGE");
    expect(classifyResultType("https://example.com/blog/what-is-cmdb", "What is CMDB Guide", "").resultType).toBe("ARTICLE_GUIDE");
    expect(classifyResultType("https://docs.servicenow.com/bundle/cmdb", "CMDB Architecture", "").resultType).toBe("DOCUMENTATION");
    expect(classifyResultType("https://reddit.com/r/servicenow/comments/1", "CMDB Discussion", "").resultType).toBe("FORUM_COMMUNITY");
    expect(classifyResultType("https://example.com/servicenow-vs-jira", "ServiceNow vs Jira Comparison", "").resultType).toBe("COMPARISON_PAGE");
  });

  it("4.2. Computes dominant SERP intent across top 10 results", () => {
    const mockResults: OrganicSerpResult[] = [
      { position: 1, url: "https://a.com/guide-1", normalizedUrl: "https://a.com/guide-1", domain: "a.com", rootDomain: "a.com", title: "Guide 1", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
      { position: 2, url: "https://b.com/guide-2", normalizedUrl: "https://b.com/guide-2", domain: "b.com", rootDomain: "b.com", title: "Guide 2", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
      { position: 3, url: "https://c.com/guide-3", normalizedUrl: "https://c.com/guide-3", domain: "c.com", rootDomain: "c.com", title: "Guide 3", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
      { position: 4, url: "https://d.com/service-1", normalizedUrl: "https://d.com/service-1", domain: "d.com", rootDomain: "d.com", title: "Service 1", snippet: "", resultType: "SERVICE_PAGE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
    ];

    const res = analyzeSerpIntentDistribution(mockResults);
    expect(res.dominantIntent).toBe("INFORMATIONAL");
    expect(res.confidence).toBe("HIGH_CONFIDENCE");
  });

  it("4.3. Detects intent disagreement with Phase 12 (INTENT_ALIGNMENT_REVIEW)", () => {
    const mockResults: OrganicSerpResult[] = [
      { position: 1, url: "https://a.com/guide-1", normalizedUrl: "https://a.com/guide-1", domain: "a.com", rootDomain: "a.com", title: "Guide 1", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
      { position: 2, url: "https://b.com/guide-2", normalizedUrl: "https://b.com/guide-2", domain: "b.com", rootDomain: "b.com", title: "Guide 2", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
      { position: 3, url: "https://c.com/guide-3", normalizedUrl: "https://c.com/guide-3", domain: "c.com", rootDomain: "c.com", title: "Guide 3", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
      { position: 4, url: "https://d.com/guide-4", normalizedUrl: "https://d.com/guide-4", domain: "d.com", rootDomain: "d.com", title: "Guide 4", snippet: "", resultType: "ARTICLE_GUIDE", resultTypeConfidence: "HIGH_CONFIDENCE", isOwnDomain: false },
    ];

    const res = analyzeSerpIntentDistribution(mockResults, "COMMERCIAL_INVESTIGATION");
    expect(res.intentDisagreementWithPhase12?.finding).toBe("INTENT_ALIGNMENT_REVIEW");
    expect(res.intentDisagreementWithPhase12?.observedSerpDominantIntent).toBe("INFORMATIONAL");
  });

  it("4.4. Detects page format mismatch when own page is generic but SERP is dedicated service assets", () => {
    const mockResults: OrganicSerpResult[] = Array(6).fill(null).map((_, i) => ({
      position: i + 1,
      url: `https://comp${i}.com/services/cmdb-assessment`,
      normalizedUrl: `https://comp${i}.com/services/cmdb-assessment`,
      domain: `comp${i}.com`,
      rootDomain: `comp${i}.com`,
      title: "CMDB Assessment Services",
      snippet: "",
      resultType: "SERVICE_PAGE",
      resultTypeConfidence: "HIGH_CONFIDENCE",
      isOwnDomain: false,
    }));

    const dist = analyzeResultTypeDistribution(mockResults, "HOMEPAGE");
    expect(dist.formatMismatchCandidate?.finding).toBe("OWN_PAGE_FORMAT_MISMATCH_CANDIDATE");
    expect(dist.formatMismatchCandidate?.dominantSerpType).toBe("SERVICE_PAGE");
  });
});
