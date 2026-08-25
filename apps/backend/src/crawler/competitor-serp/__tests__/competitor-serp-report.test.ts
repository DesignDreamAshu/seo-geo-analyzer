/**
 * Master Competitor & SERP Intelligence Report Serializer Tests.
 * Proves complete Markdown rendering of search competitors, SERP intent,
 * topic comparisons, and governance principles.
 */

import { analyzeCompetitorAndSerpIntelligence } from "../engine";
import { serializeCompetitorSerpReportMarkdown } from "../report-serializer";
import { QueryCluster } from "../../content-demand/types";

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

describe("8. Master Competitor & SERP Intelligence Report", () => {
  const mockClusters: QueryCluster[] = [
    {
      clusterId: "CLUST_cmdb_consulting",
      semanticFingerprint: "cmdb+consulting",
      representativeLabel: "ServiceNow CMDB Consulting",
      rawQueries: ["servicenow cmdb consulting"],
      totalObservedImpressions: 5000,
      totalClicks: 150,
      averageCtr: 3.0,
      averagePosition: 5.0,
      landingPages: ["https://www.botconsulting.io/services/cmdb"],
      dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
      primaryIntent: "COMMERCIAL_INVESTIGATION",
      allIntents: ["COMMERCIAL_INVESTIGATION"],
      intentConfidence: "HIGH_CONFIDENCE",
      clusteringConfidence: "HIGH_CONFIDENCE",
      clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
      lifecycleState: "CLUSTER_UNCHANGED",
      brandState: "NON_BRANDED",
      modifiers: ["consulting"],
      isQuestionDemand: false,
      isComparisonDemand: false,
      isCommercialDemand: true,
    },
  ];

  it("8.1. Generates structured Markdown report with all sections", async () => {
    const { report } = await analyzeCompetitorAndSerpIntelligence({
      projectId: "bot-consulting",
      queryClusters: mockClusters,
      configuredBusinessCompetitors: ["deloitte.com"],
      ownDomainAliases: ["botconsulting.io"],
      ownPagesMetadata: {
        "https://www.botconsulting.io/services/cmdb": {
          url: "https://www.botconsulting.io/services/cmdb",
          title: "ServiceNow CMDB Consulting",
          topics: ["automation", "ci-lifecycle"],
        },
      },
      competitorPageContents: [
        {
          url: "https://www.accenture.com/services/servicenow-cmdb",
          title: "Accenture ServiceNow CMDB",
          extractedTopics: ["csdm", "data-governance", "automation"],
        },
      ],
    });

    const md = serializeCompetitorSerpReportMarkdown(report);

    expect(md.includes("# COMPETITOR & SERP INTELLIGENCE")).toBe(true);
    expect(md.includes("Search Competitors")).toBe(true);
    expect(md.includes("SERP Intent & Result-Type Landscape")).toBe(true);
    expect(md.includes("Topic Coverage & Differentiation Analysis")).toBe(true);
    expect(md.includes("SERP Feature Opportunities")).toBe(true);
    expect(md.includes("Position History & SERP Volatility")).toBe(true);
    expect(md.includes("Data Limitations & Governance Principles")).toBe(true);
  });
});
