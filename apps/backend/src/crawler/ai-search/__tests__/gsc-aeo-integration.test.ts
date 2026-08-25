import { parsePageHtml } from "../../parser";
import { evaluateAnswerReadiness } from "../answer-readiness";
import { findGscAeoOpportunities } from "../gsc-aeo-prioritizer";
import { PageGscMetrics } from "../../gsc/types";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("GSC Performance Demand × AEO Opportunity Prioritization", () => {
  it("1. High Impression Informational Query Deficit: surfaces opportunity when informational query has no definition", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>ServiceNow CMDB Overview</title></head>
        <body>
          <main>
            <h1>ServiceNow CMDB Overview</h1>
            <p>A broad high-level narrative that does not define CMDB concisely.</p>
          </main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/cmdb-overview");
    const answerEval = evaluateAnswerReadiness(parsed);

    const mockGscData: PageGscMetrics = {
      gscUrl: "https://www.botconsulting.io/cmdb-overview",
      normalizedGscUrl: "https://www.botconsulting.io/cmdb-overview",
      matchedCrawlUrl: "https://www.botconsulting.io/cmdb-overview",
      matchMethod: "EXACT",
      matchConfidence: 1.0,
      currentPeriod: { clicks: 45, impressions: 1200, ctr: 0.0375, averagePosition: 8.4, isComplete: true, daysCount: 28 },
      topQueries: [
        {
          query: "what is servicenow cmdb",
          currentPeriod: { clicks: 30, impressions: 850, ctr: 0.035, averagePosition: 7.8, isComplete: true, daysCount: 28 },
          associatedPages: ["https://www.botconsulting.io/cmdb-overview"],
        },
        {
          query: "servicenow consulting",
          currentPeriod: { clicks: 15, impressions: 350, ctr: 0.042, averagePosition: 9.1, isComplete: true, daysCount: 28 },
          associatedPages: ["https://www.botconsulting.io/cmdb-overview"],
        },
      ],
      isDeclining: false,
      hasCtrOpportunity: false,
      hasRankingOpportunity: true,
    };

    const opps = findGscAeoOpportunities(parsed.url, mockGscData, answerEval);

    expect(opps.length).toBeGreaterThanOrEqual(1);
    expect(opps[0].opportunityType).toBe("HIGH_IMPRESSION_INFORMATIONAL_DEFICIT");
    expect(opps[0].query).toBe("what is servicenow cmdb");
    expect(opps[0].impressions).toBe(850);
  });

  it("2. No GSC Data Safeguard: handles missing GSC data gracefully without throwing or creating false errors", () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test</h1></body></html>`;
    const parsed = parsePageHtml(html, "https://www.botconsulting.io/test");
    const answerEval = evaluateAnswerReadiness(parsed);

    const opps = findGscAeoOpportunities(parsed.url, null, answerEval);
    expect(opps.length).toBe(0);
  });
});
