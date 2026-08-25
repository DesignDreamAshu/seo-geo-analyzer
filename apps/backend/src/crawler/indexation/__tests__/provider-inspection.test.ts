/**
 * Provider URL Inspection & Raw State Mapping Tests.
 * Proves auditable normalization of raw Google Inspection states.
 */

import { mapRawGoogleCoverageState } from "../provider/raw-mapper";
import { parseGscUrlInspectionPayload } from "../provider/gsc-url-inspection";
import { InspectionRecordCache } from "../provider/cache";
import { prioritizeInspectionQueue } from "../provider/queue";

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

describe("1. Provider URL Inspection & Raw State Mapping", () => {
  it("1.1. Maps 'Crawled - currently not indexed' preserving raw status", () => {
    const res = mapRawGoogleCoverageState("Crawled - currently not indexed");
    expect(res.rawStatus).toBe("Crawled - currently not indexed");
    expect(res.normalizedState).toBe("NOT_INDEXED");
    expect(res.detailedReason).toBe("CRAWLED_CURRENTLY_NOT_INDEXED");
  });

  it("1.2. Maps 'Discovered - currently not indexed' accurately", () => {
    const res = mapRawGoogleCoverageState("Discovered - currently not indexed");
    expect(res.normalizedState).toBe("NOT_INDEXED");
    expect(res.detailedReason).toBe("DISCOVERED_CURRENTLY_NOT_INDEXED");
  });

  it("1.3. Maps 'Duplicate, Google chose different canonical than user'", () => {
    const res = mapRawGoogleCoverageState("Duplicate, Google chose different canonical than user");
    expect(res.normalizedState).toBe("NOT_INDEXED");
    expect(res.detailedReason).toBe("DUPLICATE_GOOGLE_CHOSE_DIFFERENT_CANONICAL");
  });

  it("1.4. Ingests full GSC payload and calculates canonical alignment", () => {
    const record = parseGscUrlInspectionPayload({
      projectId: "p1",
      payload: {
        inspectionUrl: "https://example.com/page",
        inspectionTimestamp: "2026-08-20T10:00:00Z",
        verdict: "PASS",
        coverageState: "Submitted and indexed",
        userCanonical: "https://example.com/page",
        googleCanonical: "https://example.com/page",
      },
      technicalIndexability: "INDEXABLE",
    });

    expect(record.googleIndexState).toBe("INDEXED");
    expect(record.canonicalAlignment).toBe("CANONICAL_MATCH");
    expect(record.evidenceSource).toBe("GSC_URL_INSPECTION_API");
  });

  it("1.5. Inspection cache enforces project isolation", () => {
    InspectionRecordCache.clearAll();
    const rec1 = parseGscUrlInspectionPayload({
      projectId: "proj-alpha",
      payload: { inspectionUrl: "https://example.com/p1", inspectionTimestamp: "2026-08-20T10:00:00Z", verdict: "PASS" },
    });
    InspectionRecordCache.set("proj-alpha", rec1);

    expect(InspectionRecordCache.get("proj-alpha", "https://example.com/p1") !== null).toBe(true);
    expect(InspectionRecordCache.get("proj-beta", "https://example.com/p1")).toBe(null);
  });

  it("1.6. Queue prioritizes watchlist and migrated URLs under quota constraint", () => {
    const candidates = [
      { url: "https://example.com/c1", normalizedUrl: "https://example.com/c1", isImportant: false },
      { url: "https://example.com/c2", normalizedUrl: "https://example.com/c2", isImportant: true },
      { url: "https://example.com/c3", normalizedUrl: "https://example.com/c3", isImportant: false, isMigratedOrChanged: true },
    ];

    const { prioritized, samplingMode } = prioritizeInspectionQueue(candidates, 2);
    expect(prioritized.length).toBe(2);
    expect(prioritized[0].url).toBe("https://example.com/c2"); // Important first
    expect(prioritized[1].url).toBe("https://example.com/c3"); // Migrated second
    expect(samplingMode).toBe("TARGETED_INSPECTION");
  });
});
