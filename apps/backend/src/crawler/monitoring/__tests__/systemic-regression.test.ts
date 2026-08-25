import { CrawlSnapshot, SnapshotDiagnosticFinding } from "../types";
import { auditSnapshotRegression } from "../engine";

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

describe("Systemic Regression & Change Burst Detection", () => {
  const createBlogPageSet = (count: number, hasOgImage = true) => {
    const pages: Record<string, any> = {};
    const findings: any[] = [];

    for (let i = 1; i <= count; i++) {
      const url = `https://www.botconsulting.io/blog/post-${i}`;
      pages[url] = {
        url,
        statusCode: 200,
        isIndexable: true,
        ogImage: hasOgImage ? "https://cdn.prod.website-files.com/img.png" : null,
        ogImageFetchState: hasOgImage ? "FETCH_CONFIRMED" : null,
      };

      if (!hasOgImage) {
        findings.push({
          ruleCode: "SOCIAL_OG_IMAGE_MISSING",
          url,
          severity: "high",
          evidence: "Missing og:image tag.",
          message: "OG image missing.",
          remediationBlueprint: { summary: "Set og:image in CMS Collection Template." },
        });
      }
    }

    return { pages, findings };
  };

  it("1. BOT 57-Page OG Image Regression Case: consolidates 57 blog failures into 1 systemic group with ~1 real edit", () => {
    const baseData = createBlogPageSet(57, true);
    const currData = createBlogPageSet(57, false);

    const baseSnapshot: any = {
      snapshotId: "snap_bot_prev_clean",
      projectId: "bot-consulting",
      rootDomain: "botconsulting.io",
      originUrl: "https://www.botconsulting.io",
      startedAt: "2026-08-10T10:00:00Z",
      completedAt: "2026-08-10T10:05:00Z",
      crawlerVersion: "1.0.0",
      ruleSetVersion: "1.0.0",
      productionRuleCount: 95,
      crawlScope: "full_site",
      isComplete: true,
      pages: baseData.pages,
      findings: baseData.findings,
      robotsTxtContent: "User-agent: *\nAllow: /",
      sitemapUrls: [],
    };

    const currSnapshot: any = {
      ...baseSnapshot,
      snapshotId: "snap_bot_current_regression",
      pages: currData.pages,
      findings: currData.findings,
    };

    const auditRes = auditSnapshotRegression(currSnapshot, baseSnapshot);

    expect(auditRes.summary.totalNewRegressions).toBe(57);
    expect(auditRes.summary.totalSystemicGroups).toBe(1);

    const sysGroup = auditRes.systemicRegressions[0];
    expect(sysGroup.ruleCode).toBe("SOCIAL_OG_IMAGE_MISSING");
    expect(sysGroup.affectedUrlsCount).toBe(57);
    expect(sysGroup.estimatedRealEdits).toBe(1); // 1 single template edit fixes all 57 pages
    expect(sysGroup.templateOrRoutePattern).toBe("/blog/*");
    expect(sysGroup.whereToFix.includes("Webflow Designer")).toBe(true);

    // Verify Change Burst Detection
    expect(auditRes.changeBurst.isChangeBurst).toBe(true);
    expect(auditRes.changeBurst.burstStatus).toBe("CHANGE_BURST_REVIEW");
  });
});
