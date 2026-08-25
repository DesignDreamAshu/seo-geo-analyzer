/**
 * SEO Impact & Decision Intelligence Report Serializer Tests.
 * Proves rendering of all report sections.
 */

import { analyzeSeoImpactIntelligence } from "../engine";
import { serializeSeoImpactReportMarkdown } from "../report-serializer";
import { SeoActionItem } from "../../opportunity/types";

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

describe("7. SEO Impact & Decision Intelligence Report Serializer", () => {
  it("7.1. Serializes complete Markdown report with all essential sections", async () => {
    const mockAction: SeoActionItem = {
      actionId: "ACT_CMDB_CTR",
      projectId: "dream-seo-corp",
      type: "CTR_OPPORTUNITY",
      title: "Improve Title & Meta CTR on /services/cmdb",
      description: "Optimize title tag to improve snippet engagement.",
      nature: "REVIEW_RECOMMENDED",
      underlyingRuleCodes: [],
      monitoringSignals: [],
      sourceSignals: [],
      affectedUrls: ["https://example.com/services/cmdb"],
      representativeUrls: ["https://example.com/services/cmdb"],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "medium",
      actionPriority: "HIGH",
      whyThisPriority: ["High impression query cluster with below-average CTR"],
      effort: "LOW",
      effortRationale: "Edit meta title",
      primaryOwner: "Content",
      secondaryOwners: ["SEO"],
      owners: ["Content", "SEO"],
      ownerRoutingConfidence: "CONFIRMED_OWNER",
      pageImportanceStatus: "PAGE_IMPORTANCE_CONFIGURED",
      isWatchlistedPage: true,
      isQuickWin: true,
      timelineBucket: "DO_NOW",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "CMS Editor",
      recommendedAction: "Rewrite title tag with compelling value proposition",
      verificationInstructions: "Verify rendered title in browser",
      actionStatus: "OPEN",
      statusHistory: [],
    };

    const { report } = await analyzeSeoImpactIntelligence({
      projectId: "dream-seo-corp",
      actionInputs: [
        {
          action: mockAction,
          historicalImpressions: 20000,
          historicalClicks: 240,
          sameSiteBenchmarkCtrPercent: 2.2,
        },
      ],
      businessEconomics: {
        funnel: {
          funnelType: "SAAS",
          currency: "USD",
          stage1ConversionRatePercent: 2.5,
          stage2ConversionRatePercent: 40.0,
          averageOrderValueOrLtv: 2000,
        },
        costs: {
          customImplementationCost: 500,
        },
      },
    });

    const md = serializeSeoImpactReportMarkdown(report);

    expect(md.includes("# 📈 SEO IMPACT & DECISION INTELLIGENCE REPORT")).toBe(true);
    expect(md.includes("## 1. 📊 Evidence Quality & Baseline Context")).toBe(true);
    expect(md.includes("## 2. 🎯 Forecastability Overview")).toBe(true);
    expect(md.includes("## 3. 🔍 Highest Observed Search Exposure [OBSERVED]")).toBe(true);
    expect(md.includes("## 4. 🧮 Portfolio Scenario Forecasts [CONDITIONAL SCENARIOS]")).toBe(true);
    expect(md.includes("## 6. 💼 Business Economics & Revenue Ranges [CONDITIONAL SCENARIOS]")).toBe(true);
    expect(md.includes("## 7. ℹ️ Data Limitations & Governance Principles")).toBe(true);
  });
});
