/**
 * Migration Report Serializer Tests.
 * Verifies generation of Planning, Pre-Launch, and Post-Launch Markdown reports.
 */

import { analyzeMigrationIntelligence } from "../engine";
import { serializeMigrationReportMarkdown } from "../report-serializer";

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

describe("8. Migration Report Serializer", () => {
  it("8.1. Generates structured Pre-Launch and Post-Launch Markdown reports", async () => {
    const { report } = await analyzeMigrationIntelligence({
      migrationProject: {
        migrationId: "mig_replatform_2026",
        projectId: "bot-consulting",
        migrationType: "FRAMEWORK_REPLATFORM",
        sourceOrigin: "old.botconsulting.io",
        destinationOrigin: "botconsulting.io",
        status: "PRE_LAUNCH_VALIDATION",
        scopeDescription: "Full domain and framework replatform to Next.js.",
      },
      sourceUrls: [
        { url: "https://old.botconsulting.io/services/cmdb", isIndexable: true, inSitemap: true, internalLinkCount: 5, gscClicks: 100, gscImpressions: 1000, backlinkCount: 10, referringDomainCount: 5, isHighValue: true, importanceReasons: ["GSC_SEARCH_TRAFFIC_LEADER"] },
      ],
      destinationUrls: [
        { url: "https://botconsulting.io/servicenow/cmdb", isIndexable: true, inSitemap: true, internalLinkCount: 5, hasSchema: true },
      ],
      configuredMappings: [
        { sourceUrl: "https://old.botconsulting.io/services/cmdb", destinationUrl: "https://botconsulting.io/servicenow/cmdb" },
      ],
      preMigrationGscData: [{ url: "https://old.botconsulting.io/services/cmdb", clicks: 100, impressions: 1000 }],
      postMigrationGscData: [{ url: "https://botconsulting.io/servicenow/cmdb", clicks: 95, impressions: 1050 }],
      daysSinceLaunch: 14,
    });

    const preLaunchMd = serializeMigrationReportMarkdown(report, "PRE_LAUNCH");
    expect(preLaunchMd.includes("# PRE-LAUNCH SEO MIGRATION VALIDATION REPORT")).toBe(true);
    expect(preLaunchMd.includes("## 1. Executive Summary & Migration Scope")).toBe(true);
    expect(preLaunchMd.includes("## 3. 🔀 Redirect Validation Summary")).toBe(true);

    const postLaunchMd = serializeMigrationReportMarkdown(report, "POST_LAUNCH");
    expect(postLaunchMd.includes("# POST-LAUNCH SEO RECOVERY & MONITORING REPORT")).toBe(true);
    expect(postLaunchMd.includes("## 5. 📈 Post-Launch GSC Recovery Tracking")).toBe(true);
  });
});
