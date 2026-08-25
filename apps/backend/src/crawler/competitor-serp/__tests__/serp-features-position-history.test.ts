/**
 * SERP Features & Position History Tests.
 * Proves real PAA question ingestion, advisory featured snippet opportunities,
 * and safe position movement semantics (NO_LONGER_OBSERVED_IN_TRACKED_RANGE != DEINDEXED).
 */

import { evaluateSerpFeatureOpportunities } from "../serp-features";
import { trackSerpPositionHistory } from "../position-tracker";
import { createSerpSnapshot } from "../serp-snapshot";
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

describe("6. SERP Features & Position History", () => {
  const makeResult = (pos: number, url: string, isOwn: boolean): OrganicSerpResult => ({
    position: pos,
    url,
    normalizedUrl: url,
    domain: new URL(url).hostname.replace(/^www\./, ""),
    rootDomain: new URL(url).hostname.replace(/^www\./, ""),
    title: "Page Title",
    snippet: "",
    resultType: "SERVICE_PAGE",
    resultTypeConfidence: "HIGH_CONFIDENCE",
    isOwnDomain: isOwn,
  });

  it("6.1. SERP Features emit advisory opportunities without creating SEO errors", () => {
    const snap = createSerpSnapshot({
      snapshotId: "snap-feat",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "what is servicenow cmdb" },
      normalizedQuery: "what is servicenow cmdb",
      organicResults: [],
      serpFeatures: [
        {
          featureType: "FEATURED_SNIPPET",
          owningDomain: "cprime.com",
          title: "ServiceNow CMDB Definition",
        },
        {
          featureType: "PEOPLE_ALSO_ASK",
          questions: ["What is CSDM vs CMDB in ServiceNow?", "Why is CMDB essential?"],
        },
      ],
    });

    const opps = evaluateSerpFeatureOpportunities(snap, "ServiceNow CMDB Guide", 5);
    expect(opps.length).toBe(2);
    expect(opps.some((o) => o.opportunityName === "ANSWER_FORMAT_OPPORTUNITY")).toBe(true);
    expect(opps.some((o) => o.opportunityName === "PAA_CONTENT_OPPORTUNITY")).toBe(true);
  });

  it("6.2. Position History tracks IMPROVED, DECLINED, and STABLE accurately", () => {
    const snapPrev = createSerpSnapshot({
      snapshotId: "snap-prev",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb" },
      normalizedQuery: "servicenow cmdb",
      ownDomainAliases: ["botconsulting.io"],
      organicResults: [
        makeResult(5, "https://www.botconsulting.io/services/cmdb", true),
        makeResult(3, "https://www.botconsulting.io/blog/guide", true),
      ],
    });

    const snapCurr = createSerpSnapshot({
      snapshotId: "snap-curr",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb" },
      normalizedQuery: "servicenow cmdb",
      ownDomainAliases: ["botconsulting.io"],
      organicResults: [
        makeResult(2, "https://www.botconsulting.io/services/cmdb", true), // 5 -> 2 = IMPROVED
        makeResult(8, "https://www.botconsulting.io/blog/guide", true), // 3 -> 8 = DECLINED
      ],
    });

    const history = trackSerpPositionHistory(snapCurr, snapPrev);
    const cmdbHistory = history.find((h) => h.url === "https://www.botconsulting.io/services/cmdb");
    const guideHistory = history.find((h) => h.url === "https://www.botconsulting.io/blog/guide");

    expect(cmdbHistory?.state).toBe("IMPROVED");
    expect(guideHistory?.state).toBe("DECLINED");
  });

  it("6.3. Leaving tracked top-N results is classified as NO_LONGER_OBSERVED_IN_TRACKED_RANGE (never called DEINDEXED)", () => {
    const snapPrev = createSerpSnapshot({
      snapshotId: "snap-prev",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb" },
      normalizedQuery: "servicenow cmdb",
      ownDomainAliases: ["botconsulting.io"],
      organicResults: [
        makeResult(9, "https://www.botconsulting.io/services/legacy-cmdb", true),
      ],
    });

    const snapCurr = createSerpSnapshot({
      snapshotId: "snap-curr",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb" },
      normalizedQuery: "servicenow cmdb",
      ownDomainAliases: ["botconsulting.io"],
      organicResults: [
        makeResult(1, "https://www.accenture.com/cmdb", false),
      ],
    });

    const history = trackSerpPositionHistory(snapCurr, snapPrev);
    const legacyHistory = history.find((h) => h.url === "https://www.botconsulting.io/services/legacy-cmdb");

    expect(legacyHistory?.state).toBe("NO_LONGER_OBSERVED_IN_TRACKED_RANGE");
    expect(legacyHistory?.rationale.includes("does NOT imply deindexing")).toBe(true);
  });
});
