/**
 * Test Suite for Content Demand Coverage & Decision Engine.
 */

import { assessContentCoverage } from "../coverage-engine";
import { QueryCluster } from "../types";

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
  };
}

describe("Content Demand Coverage & Decision Engine", () => {
  const baseCluster: QueryCluster = {
    clusterId: "CLUST_servicenow_cmdb",
    semanticFingerprint: "servicenow+cmdb+assessment",
    representativeLabel: "ServiceNow CMDB Assessment",
    rawQueries: ["servicenow cmdb assessment"],
    totalObservedImpressions: 8420,
    totalClicks: 210,
    averageCtr: 2.49,
    averagePosition: 6.2,
    landingPages: ["https://www.botconsulting.io/services/cmdb"],
    dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["assessment", "services"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("1. Improve Existing Page: existing dedicated page is recommended for expansion rather than duplicate page creation", () => {
    const pageMeta = {
      url: "https://www.botconsulting.io/services/cmdb",
      title: "ServiceNow CMDB Consulting | BOT Consulting",
      h1: "Enterprise CMDB Architecture",
    };

    const res = assessContentCoverage(baseCluster, pageMeta, ["https://www.botconsulting.io/services/cmdb"]);

    expect(res.decision).toBe("IMPROVE_EXISTING_PAGE");
    expect(res.coverageState).toBe("PARTIALLY_SERVED");
    expect(res.decisionRationale.includes("Expand topic depth")).toBe(true);
  });

  it("2. Create New Page Candidate: high demand commercial cluster with validated business relevance and zero dedicated coverage on site", () => {
    const unservedCluster: QueryCluster = {
      ...baseCluster,
      dominantLandingPage: "https://www.botconsulting.io/",
      landingPages: ["https://www.botconsulting.io/"],
    };

    const homepageMeta = {
      url: "https://www.botconsulting.io/",
      title: "IT Consulting Services | BOT Consulting",
      h1: "Enterprise Tech Partners",
    };

    const res = assessContentCoverage(unservedCluster, homepageMeta, ["https://www.botconsulting.io/"], undefined, undefined, true);

    expect(res.decision).toBe("CREATE_NEW_PAGE_CANDIDATE");
    expect(res.coverageState).toBe("UNSERVED_CANDIDATE");
    expect(res.decisionRationale.toLowerCase().includes("no dedicated page")).toBe(true);
  });
});
