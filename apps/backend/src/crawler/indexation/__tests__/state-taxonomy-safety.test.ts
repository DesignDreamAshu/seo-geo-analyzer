/**
 * Indexation State Taxonomy & Semantic Separation Safety Tests.
 * Proves separation of: TECHNICALLY_INDEXABLE ≠ CRAWLED ≠ GOOGLE_REPORTED_INDEX_STATE ≠ INDEXED ≠ SEARCH_VISIBLE
 */

import { analyzeIndexationIntelligence } from "../engine";

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

describe("2. Indexation State Taxonomy & Semantic Separation", () => {
  it("2.1. URL can be technically indexable and crawled by Googlebot without being indexed", async () => {
    const { records } = await analyzeIndexationIntelligence({
      projectId: "p1",
      universeInputs: { crawlerUrls: ["https://example.com/item-1"] },
      inspectionPayloads: [
        {
          inspectionUrl: "https://example.com/item-1",
          inspectionTimestamp: "2026-08-20T10:00:00Z",
          coverageState: "Crawled - currently not indexed",
          verdict: "NEUTRAL",
        },
      ],
      knownUrlMetadata: new Map([
        [
          "https://example.com/item-1",
          {
            technicalIndexability: "INDEXABLE",
            serverLogCrawlCount: 15,
          },
        ],
      ]),
    });

    const rec = records[0];
    expect(rec.technicalIndexability).toBe("INDEXABLE");
    expect(rec.serverLogCrawlCount).toBe(15);
    expect(rec.googleIndexState).toBe("NOT_INDEXED");
    expect(rec.googleDetailedReason).toBe("CRAWLED_CURRENTLY_NOT_INDEXED");
  });

  it("2.2. Absence of inspection payload leaves index state strictly as UNKNOWN (never NOT_INDEXED)", async () => {
    const { records } = await analyzeIndexationIntelligence({
      projectId: "p1",
      universeInputs: { crawlerUrls: ["https://example.com/uninspected"] },
    });

    const rec = records[0];
    expect(rec.googleIndexState).toBe("UNKNOWN");
    expect(rec.confidence).toBe("UNKNOWN");
  });

  it("2.3. Indexed URL with zero search impressions is valid and not an indexation failure", async () => {
    const { records } = await analyzeIndexationIntelligence({
      projectId: "p1",
      universeInputs: { crawlerUrls: ["https://example.com/new-post"] },
      inspectionPayloads: [
        {
          inspectionUrl: "https://example.com/new-post",
          inspectionTimestamp: "2026-08-20T10:00:00Z",
          verdict: "PASS",
          coverageState: "Submitted and indexed",
        },
      ],
      knownUrlMetadata: new Map([
        [
          "https://example.com/new-post",
          {
            technicalIndexability: "INDEXABLE",
            gscImpressions28d: 0,
          },
        ],
      ]),
    });

    const rec = records[0];
    expect(rec.googleIndexState).toBe("INDEXED");
    expect(rec.gscImpressions28d).toBe(0);
  });
});
