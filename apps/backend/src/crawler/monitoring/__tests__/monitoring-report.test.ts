/**
 * Test Suite for Master Monitoring Report Serialization.
 */

import { auditSnapshotRegression } from "../engine";
import { serializeMonitoringReportMarkdown } from "../monitoring-report";

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

describe("Master Monitoring Report Serialization", () => {
  it("1. Markdown Report Generation: produces structured executive monitoring report", () => {
    const baseSnap: any = {
      snapshotId: "snap_01",
      projectId: "bot-consulting",
      rootDomain: "botconsulting.io",
      originUrl: "https://www.botconsulting.io",
      isComplete: true,
      pages: {
        "https://www.botconsulting.io/blog/post-1": { statusCode: 200 },
        "https://www.botconsulting.io/blog/post-2": { statusCode: 200 },
        "https://www.botconsulting.io/blog/post-3": { statusCode: 200 },
      },
      findings: [],
    };

    const currSnap: any = {
      ...baseSnap,
      snapshotId: "snap_02",
      findings: [
        { ruleCode: "SOCIAL_OG_IMAGE_MISSING", url: "https://www.botconsulting.io/blog/post-1", severity: "high", evidence: "OG image missing.", message: "Missing image." },
        { ruleCode: "SOCIAL_OG_IMAGE_MISSING", url: "https://www.botconsulting.io/blog/post-2", severity: "high", evidence: "OG image missing.", message: "Missing image." },
        { ruleCode: "SOCIAL_OG_IMAGE_MISSING", url: "https://www.botconsulting.io/blog/post-3", severity: "high", evidence: "OG image missing.", message: "Missing image." },
      ],
    };

    const auditRes = auditSnapshotRegression(currSnap, baseSnap);
    const md = serializeMonitoringReportMarkdown(auditRes);

    expect(md.includes("# SEO CHANGE & REGRESSION INTELLIGENCE REPORT")).toBe(true);
    expect(md.includes("New Regressions")).toBe(true);
    expect(md.includes("Systemic Template Regressions")).toBe(true);
    expect(md.includes("Estimated Real Changes:")).toBe(true);
    expect(md.includes("Webflow Designer")).toBe(true);
  });
});
