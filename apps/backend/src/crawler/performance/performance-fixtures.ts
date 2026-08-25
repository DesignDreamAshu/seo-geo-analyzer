/**
 * Deterministic Ground-Truth Fixtures for Phase 7 Performance & Core Web Vitals Rules.
 * Every rule has exactly 6 deterministic fixtures (True Positive, True Negative, Boundary, Exclusion).
 */

import { PagePerformanceFacts, PerformanceProfile } from "./types";

export interface PerformanceTestCase {
  id: string;
  ruleCode: string;
  fixtureType: "true_positive" | "true_negative" | "boundary" | "exclusion";
  description: string;
  url: string;
  facts: PagePerformanceFacts;
  expectedFinding: boolean;
}

function createBaseFact(url: string, mobileProfilePartial?: Partial<PerformanceProfile>): PagePerformanceFacts {
  const profile: PerformanceProfile = {
    strategy: "mobile",
    performanceScore: 75,
    lab: {
      fcpMs: 1500,
      lcpMs: 2200,
      cls: 0.05,
      tbtMs: 150,
      speedIndexMs: 2500,
      ttfbMs: 350,
    },
    field: {
      lcpP75Ms: 2200,
      inpP75Ms: 150,
      clsP75: 0.05,
      fcpP75Ms: 1400,
      ttfbP75Ms: 300,
      sampleAvailable: true,
      fieldDataScope: "URL",
      overallCategory: "GOOD",
    },
    opportunities: [],
    diagnostics: [],
    resources: [],
    thirdParties: [],
    fetchedAt: "2026-08-20T12:00:00Z",
    ...mobileProfilePartial,
  };

  return {
    url,
    normalizedUrl: url,
    crawlerSignals: {
      ttfbMs: 350,
      htmlPayloadBytes: 25000,
    },
    evaluationStatus: "EVALUATED",
    mobile: profile,
  };
}

export function buildPerformanceRuleFixtures(): PerformanceTestCase[] {
  const fixtures: PerformanceTestCase[] = [];

  // =========================================================================
  // 1. FIELD_LCP_POOR
  // =========================================================================
  fixtures.push(
    {
      id: "FIELD_LCP_POOR_TP_1",
      ruleCode: "FIELD_LCP_POOR",
      fixtureType: "true_positive",
      description: "CrUX URL-level p75 LCP = 4500ms (> 4.0s)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        field: { lcpP75Ms: 4500, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_LCP_POOR_TP_2",
      ruleCode: "FIELD_LCP_POOR",
      fixtureType: "true_positive",
      description: "CrUX Origin fallback p75 LCP = 5200ms (> 4.0s)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        field: { lcpP75Ms: 5200, sampleAvailable: true, fieldDataScope: "ORIGIN" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_LCP_POOR_TN_1",
      ruleCode: "FIELD_LCP_POOR",
      fixtureType: "true_negative",
      description: "CrUX p75 LCP = 2100ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        field: { lcpP75Ms: 2100, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_LCP_POOR_TN_2",
      ruleCode: "FIELD_LCP_POOR",
      fixtureType: "true_negative",
      description: "CrUX p75 LCP = 3200ms (Needs Improvement, not Poor)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        field: { lcpP75Ms: 3200, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_LCP_POOR_EXC_1",
      ruleCode: "FIELD_LCP_POOR",
      fixtureType: "exclusion",
      description: "No CrUX field data available (Lab LCP = 5000ms)",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        field: { sampleAvailable: false, fieldDataScope: "NONE" },
        lab: { lcpMs: 5000 },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_LCP_POOR_EDGE_1",
      ruleCode: "FIELD_LCP_POOR",
      fixtureType: "boundary",
      description: "CrUX p75 LCP = 4000ms (Exact Needs Improvement boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        field: { lcpP75Ms: 4000, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 2. FIELD_INP_POOR
  // =========================================================================
  fixtures.push(
    {
      id: "FIELD_INP_POOR_TP_1",
      ruleCode: "FIELD_INP_POOR",
      fixtureType: "true_positive",
      description: "CrUX p75 INP = 650ms (> 500ms)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        field: { inpP75Ms: 650, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_INP_POOR_TP_2",
      ruleCode: "FIELD_INP_POOR",
      fixtureType: "true_positive",
      description: "CrUX p75 INP = 850ms (> 500ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        field: { inpP75Ms: 850, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_INP_POOR_TN_1",
      ruleCode: "FIELD_INP_POOR",
      fixtureType: "true_negative",
      description: "CrUX p75 INP = 120ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        field: { inpP75Ms: 120, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_INP_POOR_TN_2",
      ruleCode: "FIELD_INP_POOR",
      fixtureType: "true_negative",
      description: "CrUX p75 INP = 350ms (Needs Improvement, not Poor)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        field: { inpP75Ms: 350, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_INP_POOR_EXC_1",
      ruleCode: "FIELD_INP_POOR",
      fixtureType: "exclusion",
      description: "No CrUX field data available (Lab TBT = 900ms)",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        field: { sampleAvailable: false, fieldDataScope: "NONE" },
        lab: { tbtMs: 900 },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_INP_POOR_EDGE_1",
      ruleCode: "FIELD_INP_POOR",
      fixtureType: "boundary",
      description: "CrUX p75 INP = 500ms (Exact boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        field: { inpP75Ms: 500, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 3. FIELD_CLS_POOR
  // =========================================================================
  fixtures.push(
    {
      id: "FIELD_CLS_POOR_TP_1",
      ruleCode: "FIELD_CLS_POOR",
      fixtureType: "true_positive",
      description: "CrUX p75 CLS = 0.35 (> 0.25)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        field: { clsP75: 0.35, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_CLS_POOR_TP_2",
      ruleCode: "FIELD_CLS_POOR",
      fixtureType: "true_positive",
      description: "CrUX p75 CLS = 0.42 (> 0.25)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        field: { clsP75: 0.42, sampleAvailable: true, fieldDataScope: "ORIGIN" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_CLS_POOR_TN_1",
      ruleCode: "FIELD_CLS_POOR",
      fixtureType: "true_negative",
      description: "CrUX p75 CLS = 0.05 (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        field: { clsP75: 0.05, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_CLS_POOR_TN_2",
      ruleCode: "FIELD_CLS_POOR",
      fixtureType: "true_negative",
      description: "CrUX p75 CLS = 0.18 (Needs Improvement, not Poor)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        field: { clsP75: 0.18, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_CLS_POOR_EXC_1",
      ruleCode: "FIELD_CLS_POOR",
      fixtureType: "exclusion",
      description: "No CrUX field data available (Lab CLS = 0.40)",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        field: { sampleAvailable: false, fieldDataScope: "NONE" },
        lab: { cls: 0.40 },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_CLS_POOR_EDGE_1",
      ruleCode: "FIELD_CLS_POOR",
      fixtureType: "boundary",
      description: "CrUX p75 CLS = 0.25 (Exact boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        field: { clsP75: 0.25, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 4. FIELD_LCP_NEEDS_IMPROVEMENT
  // =========================================================================
  fixtures.push(
    {
      id: "FIELD_LCP_NEEDS_IMP_TP_1",
      ruleCode: "FIELD_LCP_NEEDS_IMPROVEMENT",
      fixtureType: "true_positive",
      description: "CrUX p75 LCP = 2800ms (2.5s–4.0s)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        field: { lcpP75Ms: 2800, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_LCP_NEEDS_IMP_TP_2",
      ruleCode: "FIELD_LCP_NEEDS_IMPROVEMENT",
      fixtureType: "true_positive",
      description: "CrUX p75 LCP = 3900ms (2.5s–4.0s)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        field: { lcpP75Ms: 3900, sampleAvailable: true, fieldDataScope: "ORIGIN" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_LCP_NEEDS_IMP_TN_1",
      ruleCode: "FIELD_LCP_NEEDS_IMPROVEMENT",
      fixtureType: "true_negative",
      description: "CrUX p75 LCP = 2200ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        field: { lcpP75Ms: 2200, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_LCP_NEEDS_IMP_TN_2",
      ruleCode: "FIELD_LCP_NEEDS_IMPROVEMENT",
      fixtureType: "true_negative",
      description: "CrUX p75 LCP = 4500ms (Poor)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        field: { lcpP75Ms: 4500, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_LCP_NEEDS_IMP_EXC_1",
      ruleCode: "FIELD_LCP_NEEDS_IMPROVEMENT",
      fixtureType: "exclusion",
      description: "No CrUX field data",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        field: { sampleAvailable: false, fieldDataScope: "NONE" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_LCP_NEEDS_IMP_EDGE_1",
      ruleCode: "FIELD_LCP_NEEDS_IMPROVEMENT",
      fixtureType: "boundary",
      description: "CrUX p75 LCP = 2500ms (Good boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        field: { lcpP75Ms: 2500, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 5. FIELD_INP_NEEDS_IMPROVEMENT
  // =========================================================================
  fixtures.push(
    {
      id: "FIELD_INP_NEEDS_IMP_TP_1",
      ruleCode: "FIELD_INP_NEEDS_IMPROVEMENT",
      fixtureType: "true_positive",
      description: "CrUX p75 INP = 280ms (200ms–500ms)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        field: { inpP75Ms: 280, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_INP_NEEDS_IMP_TP_2",
      ruleCode: "FIELD_INP_NEEDS_IMPROVEMENT",
      fixtureType: "true_positive",
      description: "CrUX p75 INP = 450ms (200ms–500ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        field: { inpP75Ms: 450, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_INP_NEEDS_IMP_TN_1",
      ruleCode: "FIELD_INP_NEEDS_IMPROVEMENT",
      fixtureType: "true_negative",
      description: "CrUX p75 INP = 150ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        field: { inpP75Ms: 150, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_INP_NEEDS_IMP_TN_2",
      ruleCode: "FIELD_INP_NEEDS_IMPROVEMENT",
      fixtureType: "true_negative",
      description: "CrUX p75 INP = 600ms (Poor)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        field: { inpP75Ms: 600, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_INP_NEEDS_IMP_EXC_1",
      ruleCode: "FIELD_INP_NEEDS_IMPROVEMENT",
      fixtureType: "exclusion",
      description: "No CrUX field data",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        field: { sampleAvailable: false, fieldDataScope: "NONE" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_INP_NEEDS_IMP_EDGE_1",
      ruleCode: "FIELD_INP_NEEDS_IMPROVEMENT",
      fixtureType: "boundary",
      description: "CrUX p75 INP = 200ms (Good boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        field: { inpP75Ms: 200, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 6. FIELD_CLS_NEEDS_IMPROVEMENT
  // =========================================================================
  fixtures.push(
    {
      id: "FIELD_CLS_NEEDS_IMP_TP_1",
      ruleCode: "FIELD_CLS_NEEDS_IMPROVEMENT",
      fixtureType: "true_positive",
      description: "CrUX p75 CLS = 0.15 (0.10–0.25)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        field: { clsP75: 0.15, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_CLS_NEEDS_IMP_TP_2",
      ruleCode: "FIELD_CLS_NEEDS_IMPROVEMENT",
      fixtureType: "true_positive",
      description: "CrUX p75 CLS = 0.22 (0.10–0.25)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        field: { clsP75: 0.22, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: true,
    },
    {
      id: "FIELD_CLS_NEEDS_IMP_TN_1",
      ruleCode: "FIELD_CLS_NEEDS_IMPROVEMENT",
      fixtureType: "true_negative",
      description: "CrUX p75 CLS = 0.04 (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        field: { clsP75: 0.04, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_CLS_NEEDS_IMP_TN_2",
      ruleCode: "FIELD_CLS_NEEDS_IMPROVEMENT",
      fixtureType: "true_negative",
      description: "CrUX p75 CLS = 0.32 (Poor)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        field: { clsP75: 0.32, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_CLS_NEEDS_IMP_EXC_1",
      ruleCode: "FIELD_CLS_NEEDS_IMPROVEMENT",
      fixtureType: "exclusion",
      description: "No CrUX field data",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        field: { sampleAvailable: false, fieldDataScope: "NONE" },
      }),
      expectedFinding: false,
    },
    {
      id: "FIELD_CLS_NEEDS_IMP_EDGE_1",
      ruleCode: "FIELD_CLS_NEEDS_IMPROVEMENT",
      fixtureType: "boundary",
      description: "CrUX p75 CLS = 0.10 (Good boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        field: { clsP75: 0.10, sampleAvailable: true, fieldDataScope: "URL" },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 7. LAB_LCP_POOR
  // =========================================================================
  fixtures.push(
    {
      id: "LAB_LCP_POOR_TP_1",
      ruleCode: "LAB_LCP_POOR",
      fixtureType: "true_positive",
      description: "Simulated Lab LCP = 4800ms (> 4.0s)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        lab: { lcpMs: 4800 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_LCP_POOR_TP_2",
      ruleCode: "LAB_LCP_POOR",
      fixtureType: "true_positive",
      description: "Simulated Lab LCP = 5500ms (> 4.0s)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        lab: { lcpMs: 5500 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_LCP_POOR_TN_1",
      ruleCode: "LAB_LCP_POOR",
      fixtureType: "true_negative",
      description: "Simulated Lab LCP = 2200ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        lab: { lcpMs: 2200 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_LCP_POOR_TN_2",
      ruleCode: "LAB_LCP_POOR",
      fixtureType: "true_negative",
      description: "Simulated Lab LCP = 3400ms (Needs Improvement)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        lab: { lcpMs: 3400 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_LCP_POOR_EXC_1",
      ruleCode: "LAB_LCP_POOR",
      fixtureType: "exclusion",
      description: "Lab LCP is undefined",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        lab: { lcpMs: undefined },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_LCP_POOR_EDGE_1",
      ruleCode: "LAB_LCP_POOR",
      fixtureType: "boundary",
      description: "Simulated Lab LCP = 4000ms (Needs Improvement boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        lab: { lcpMs: 4000 },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 8. LAB_CLS_POOR
  // =========================================================================
  fixtures.push(
    {
      id: "LAB_CLS_POOR_TP_1",
      ruleCode: "LAB_CLS_POOR",
      fixtureType: "true_positive",
      description: "Simulated Lab CLS = 0.35 (> 0.25)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        lab: { cls: 0.35 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_CLS_POOR_TP_2",
      ruleCode: "LAB_CLS_POOR",
      fixtureType: "true_positive",
      description: "Simulated Lab CLS = 0.50 (> 0.25)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        lab: { cls: 0.50 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_CLS_POOR_TN_1",
      ruleCode: "LAB_CLS_POOR",
      fixtureType: "true_negative",
      description: "Simulated Lab CLS = 0.05 (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        lab: { cls: 0.05 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_CLS_POOR_TN_2",
      ruleCode: "LAB_CLS_POOR",
      fixtureType: "true_negative",
      description: "Simulated Lab CLS = 0.15 (Needs Improvement)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        lab: { cls: 0.15 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_CLS_POOR_EXC_1",
      ruleCode: "LAB_CLS_POOR",
      fixtureType: "exclusion",
      description: "Lab CLS is undefined",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        lab: { cls: undefined },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_CLS_POOR_EDGE_1",
      ruleCode: "LAB_CLS_POOR",
      fixtureType: "boundary",
      description: "Simulated Lab CLS = 0.25 (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        lab: { cls: 0.25 },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 9. LAB_TBT_HIGH
  // =========================================================================
  fixtures.push(
    {
      id: "LAB_TBT_HIGH_TP_1",
      ruleCode: "LAB_TBT_HIGH",
      fixtureType: "true_positive",
      description: "Simulated Lab TBT = 750ms (> 600ms)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        lab: { tbtMs: 750 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_TBT_HIGH_TP_2",
      ruleCode: "LAB_TBT_HIGH",
      fixtureType: "true_positive",
      description: "Simulated Lab TBT = 920ms (> 600ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        lab: { tbtMs: 920 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_TBT_HIGH_TN_1",
      ruleCode: "LAB_TBT_HIGH",
      fixtureType: "true_negative",
      description: "Simulated Lab TBT = 150ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        lab: { tbtMs: 150 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_TBT_HIGH_TN_2",
      ruleCode: "LAB_TBT_HIGH",
      fixtureType: "true_negative",
      description: "Simulated Lab TBT = 450ms (Moderate)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        lab: { tbtMs: 450 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_TBT_HIGH_EXC_1",
      ruleCode: "LAB_TBT_HIGH",
      fixtureType: "exclusion",
      description: "Lab TBT is undefined",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        lab: { tbtMs: undefined },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_TBT_HIGH_EDGE_1",
      ruleCode: "LAB_TBT_HIGH",
      fixtureType: "boundary",
      description: "Simulated Lab TBT = 600ms (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        lab: { tbtMs: 600 },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 10. LAB_TTFB_SLOW
  // =========================================================================
  fixtures.push(
    {
      id: "LAB_TTFB_SLOW_TP_1",
      ruleCode: "LAB_TTFB_SLOW",
      fixtureType: "true_positive",
      description: "Simulated Lab TTFB = 2200ms (> 1800ms)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        lab: { ttfbMs: 2200 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_TTFB_SLOW_TP_2",
      ruleCode: "LAB_TTFB_SLOW",
      fixtureType: "true_positive",
      description: "Simulated Lab TTFB = 2900ms (> 1800ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        lab: { ttfbMs: 2900 },
      }),
      expectedFinding: true,
    },
    {
      id: "LAB_TTFB_SLOW_TN_1",
      ruleCode: "LAB_TTFB_SLOW",
      fixtureType: "true_negative",
      description: "Simulated Lab TTFB = 450ms (Good)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        lab: { ttfbMs: 450 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_TTFB_SLOW_TN_2",
      ruleCode: "LAB_TTFB_SLOW",
      fixtureType: "true_negative",
      description: "Simulated Lab TTFB = 1200ms (Moderate)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        lab: { ttfbMs: 1200 },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_TTFB_SLOW_EXC_1",
      ruleCode: "LAB_TTFB_SLOW",
      fixtureType: "exclusion",
      description: "Lab TTFB is undefined",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        lab: { ttfbMs: undefined },
      }),
      expectedFinding: false,
    },
    {
      id: "LAB_TTFB_SLOW_EDGE_1",
      ruleCode: "LAB_TTFB_SLOW",
      fixtureType: "boundary",
      description: "Simulated Lab TTFB = 1800ms (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        lab: { ttfbMs: 1800 },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 11. PERF_RENDER_BLOCKING_RESOURCES
  // =========================================================================
  fixtures.push(
    {
      id: "RENDER_BLOCK_TP_1",
      ruleCode: "PERF_RENDER_BLOCKING_RESOURCES",
      fixtureType: "true_positive",
      description: "Render blocking savings = 450ms (> 300ms)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        opportunities: [{ id: "render-blocking-resources", title: "Render blocking", description: "test", savingsMs: 450, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: true,
    },
    {
      id: "RENDER_BLOCK_TP_2",
      ruleCode: "PERF_RENDER_BLOCKING_RESOURCES",
      fixtureType: "true_positive",
      description: "Render blocking savings = 800ms (> 300ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        opportunities: [{ id: "render-blocking-resources", title: "Render blocking", description: "test", savingsMs: 800, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: true,
    },
    {
      id: "RENDER_BLOCK_TN_1",
      ruleCode: "PERF_RENDER_BLOCKING_RESOURCES",
      fixtureType: "true_negative",
      description: "Render blocking savings = 0ms",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        opportunities: [{ id: "render-blocking-resources", title: "Render blocking", description: "test", savingsMs: 0, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: false,
    },
    {
      id: "RENDER_BLOCK_TN_2",
      ruleCode: "PERF_RENDER_BLOCKING_RESOURCES",
      fixtureType: "true_negative",
      description: "Render blocking savings = 150ms",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        opportunities: [{ id: "render-blocking-resources", title: "Render blocking", description: "test", savingsMs: 150, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: false,
    },
    {
      id: "RENDER_BLOCK_EXC_1",
      ruleCode: "PERF_RENDER_BLOCKING_RESOURCES",
      fixtureType: "exclusion",
      description: "No render-blocking opportunity",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        opportunities: [],
      }),
      expectedFinding: false,
    },
    {
      id: "RENDER_BLOCK_EDGE_1",
      ruleCode: "PERF_RENDER_BLOCKING_RESOURCES",
      fixtureType: "boundary",
      description: "Render blocking savings = 300ms (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        opportunities: [{ id: "render-blocking-resources", title: "Render blocking", description: "test", savingsMs: 300, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 12. PERF_LCP_IMAGE_UNOPTIMIZED
  // =========================================================================
  fixtures.push(
    {
      id: "LCP_IMG_UNOPT_TP_1",
      ruleCode: "PERF_LCP_IMAGE_UNOPTIMIZED",
      fixtureType: "true_positive",
      description: "LCP hero image has isLazyLoaded = true",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        lcpDiagnosis: {
          metricValueMs: 3200,
          resourceType: "image",
          resourceUrl: "https://example.com/hero.jpg",
          isLazyLoaded: true,
          likelyCauses: ["Lazy loaded LCP"],
          confidence: "confirmed",
          evidenceSource: "PSI_LAB",
        },
      }),
      expectedFinding: true,
    },
    {
      id: "LCP_IMG_UNOPT_TP_2",
      ruleCode: "PERF_LCP_IMAGE_UNOPTIMIZED",
      fixtureType: "true_positive",
      description: "LCP hero image with slow lab LCP (3200ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        lab: { lcpMs: 3200 },
        lcpDiagnosis: {
          metricValueMs: 3200,
          resourceType: "image",
          resourceUrl: "https://example.com/hero.jpg",
          isLazyLoaded: false,
          likelyCauses: ["Heavy hero image"],
          confidence: "likely",
          evidenceSource: "PSI_LAB",
        },
      }),
      expectedFinding: true,
    },
    {
      id: "LCP_IMG_UNOPT_TN_1",
      ruleCode: "PERF_LCP_IMAGE_UNOPTIMIZED",
      fixtureType: "true_negative",
      description: "LCP hero image eager loaded with fast lab LCP (1800ms)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        lab: { lcpMs: 1800 },
        lcpDiagnosis: {
          metricValueMs: 1800,
          resourceType: "image",
          resourceUrl: "https://example.com/hero.webp",
          isLazyLoaded: false,
          likelyCauses: [],
          confidence: "confirmed",
          evidenceSource: "PSI_LAB",
        },
      }),
      expectedFinding: false,
    },
    {
      id: "LCP_IMG_UNOPT_TN_2",
      ruleCode: "PERF_LCP_IMAGE_UNOPTIMIZED",
      fixtureType: "true_negative",
      description: "LCP element is a text heading block (not an image)",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        lab: { lcpMs: 1900 },
        lcpDiagnosis: {
          metricValueMs: 1900,
          resourceType: "text",
          isLazyLoaded: false,
          likelyCauses: [],
          confidence: "confirmed",
          evidenceSource: "PSI_LAB",
        },
      }),
      expectedFinding: false,
    },
    {
      id: "LCP_IMG_UNOPT_EXC_1",
      ruleCode: "PERF_LCP_IMAGE_UNOPTIMIZED",
      fixtureType: "exclusion",
      description: "No LCP diagnosis available",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        lcpDiagnosis: undefined,
      }),
      expectedFinding: false,
    },
    {
      id: "LCP_IMG_UNOPT_EDGE_1",
      ruleCode: "PERF_LCP_IMAGE_UNOPTIMIZED",
      fixtureType: "boundary",
      description: "LCP hero image with Lab LCP = 2500ms (Good boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        lab: { lcpMs: 2500 },
        lcpDiagnosis: {
          metricValueMs: 2500,
          resourceType: "image",
          isLazyLoaded: false,
          likelyCauses: [],
          confidence: "likely",
          evidenceSource: "PSI_LAB",
        },
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 13. PERF_UNUSED_JAVASCRIPT_HIGH
  // =========================================================================
  fixtures.push(
    {
      id: "UNUSED_JS_TP_1",
      ruleCode: "PERF_UNUSED_JAVASCRIPT_HIGH",
      fixtureType: "true_positive",
      description: "Unused JS savings = 250KB (> 100KB)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        opportunities: [{ id: "unused-javascript", title: "Unused JS", description: "test", savingsBytes: 250 * 1024, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: true,
    },
    {
      id: "UNUSED_JS_TP_2",
      ruleCode: "PERF_UNUSED_JAVASCRIPT_HIGH",
      fixtureType: "true_positive",
      description: "Unused JS savings = 450KB (> 100KB)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        opportunities: [{ id: "unused-javascript", title: "Unused JS", description: "test", savingsBytes: 450 * 1024, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: true,
    },
    {
      id: "UNUSED_JS_TN_1",
      ruleCode: "PERF_UNUSED_JAVASCRIPT_HIGH",
      fixtureType: "true_negative",
      description: "Unused JS savings = 20KB",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        opportunities: [{ id: "unused-javascript", title: "Unused JS", description: "test", savingsBytes: 20 * 1024, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: false,
    },
    {
      id: "UNUSED_JS_TN_2",
      ruleCode: "PERF_UNUSED_JAVASCRIPT_HIGH",
      fixtureType: "true_negative",
      description: "Unused JS savings = 60KB",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        opportunities: [{ id: "unused-javascript", title: "Unused JS", description: "test", savingsBytes: 60 * 1024, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: false,
    },
    {
      id: "UNUSED_JS_EXC_1",
      ruleCode: "PERF_UNUSED_JAVASCRIPT_HIGH",
      fixtureType: "exclusion",
      description: "No unused JS opportunity",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        opportunities: [],
      }),
      expectedFinding: false,
    },
    {
      id: "UNUSED_JS_EDGE_1",
      ruleCode: "PERF_UNUSED_JAVASCRIPT_HIGH",
      fixtureType: "boundary",
      description: "Unused JS savings = 100KB (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        opportunities: [{ id: "unused-javascript", title: "Unused JS", description: "test", savingsBytes: 100 * 1024, source: "PSI_LAB", ownership: "FRONTEND" }],
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 14. PERF_DOM_SIZE_EXCESSIVE
  // =========================================================================
  fixtures.push(
    {
      id: "DOM_SIZE_TP_1",
      ruleCode: "PERF_DOM_SIZE_EXCESSIVE",
      fixtureType: "true_positive",
      description: "DOM size = 1850 elements (> 1400)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        diagnostics: [{ id: "dom-size", title: "DOM Size", description: "test", displayValue: "1,850 elements", source: "PSI_LAB" }],
      }),
      expectedFinding: true,
    },
    {
      id: "DOM_SIZE_TP_2",
      ruleCode: "PERF_DOM_SIZE_EXCESSIVE",
      fixtureType: "true_positive",
      description: "DOM size = 2400 elements (> 1400)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        diagnostics: [{ id: "dom-size", title: "DOM Size", description: "test", displayValue: "2,400 elements", source: "PSI_LAB" }],
      }),
      expectedFinding: true,
    },
    {
      id: "DOM_SIZE_TN_1",
      ruleCode: "PERF_DOM_SIZE_EXCESSIVE",
      fixtureType: "true_negative",
      description: "DOM size = 450 elements",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        diagnostics: [{ id: "dom-size", title: "DOM Size", description: "test", displayValue: "450 elements", source: "PSI_LAB" }],
      }),
      expectedFinding: false,
    },
    {
      id: "DOM_SIZE_TN_2",
      ruleCode: "PERF_DOM_SIZE_EXCESSIVE",
      fixtureType: "true_negative",
      description: "DOM size = 950 elements",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        diagnostics: [{ id: "dom-size", title: "DOM Size", description: "test", displayValue: "950 elements", source: "PSI_LAB" }],
      }),
      expectedFinding: false,
    },
    {
      id: "DOM_SIZE_EXC_1",
      ruleCode: "PERF_DOM_SIZE_EXCESSIVE",
      fixtureType: "exclusion",
      description: "No DOM size diagnostic",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        diagnostics: [],
      }),
      expectedFinding: false,
    },
    {
      id: "DOM_SIZE_EDGE_1",
      ruleCode: "PERF_DOM_SIZE_EXCESSIVE",
      fixtureType: "boundary",
      description: "DOM size = 1400 elements (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        diagnostics: [{ id: "dom-size", title: "DOM Size", description: "test", displayValue: "1,400 elements", source: "PSI_LAB" }],
      }),
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 15. PERF_THIRD_PARTY_BLOCKING
  // =========================================================================
  fixtures.push(
    {
      id: "THIRD_PARTY_TP_1",
      ruleCode: "PERF_THIRD_PARTY_BLOCKING",
      fixtureType: "true_positive",
      description: "Third-party main thread blocking time = 650ms (> 400ms)",
      url: "https://example.com/page-1",
      facts: createBaseFact("https://example.com/page-1", {
        thirdParties: [
          { entityName: "Google Tag Manager", category: "tag_manager", domain: "googletagmanager.com", transferBytes: 50000, mainThreadBlockingTimeMs: 400, resourceCount: 2 },
          { entityName: "Intercom Chat", category: "chat", domain: "intercom.io", transferBytes: 150000, mainThreadBlockingTimeMs: 250, resourceCount: 4 },
        ],
      }),
      expectedFinding: true,
    },
    {
      id: "THIRD_PARTY_TP_2",
      ruleCode: "PERF_THIRD_PARTY_BLOCKING",
      fixtureType: "true_positive",
      description: "Third-party main thread blocking time = 850ms (> 400ms)",
      url: "https://example.com/page-2",
      facts: createBaseFact("https://example.com/page-2", {
        thirdParties: [
          { entityName: "Hotjar", category: "analytics", domain: "hotjar.com", transferBytes: 80000, mainThreadBlockingTimeMs: 850, resourceCount: 3 },
        ],
      }),
      expectedFinding: true,
    },
    {
      id: "THIRD_PARTY_TN_1",
      ruleCode: "PERF_THIRD_PARTY_BLOCKING",
      fixtureType: "true_negative",
      description: "Third-party main thread blocking time = 120ms (< 400ms)",
      url: "https://example.com/page-3",
      facts: createBaseFact("https://example.com/page-3", {
        thirdParties: [
          { entityName: "Google Analytics", category: "analytics", domain: "google-analytics.com", transferBytes: 20000, mainThreadBlockingTimeMs: 120, resourceCount: 1 },
        ],
      }),
      expectedFinding: false,
    },
    {
      id: "THIRD_PARTY_TN_2",
      ruleCode: "PERF_THIRD_PARTY_BLOCKING",
      fixtureType: "true_negative",
      description: "Zero third-party scripts loaded",
      url: "https://example.com/page-4",
      facts: createBaseFact("https://example.com/page-4", {
        thirdParties: [],
      }),
      expectedFinding: false,
    },
    {
      id: "THIRD_PARTY_EXC_1",
      ruleCode: "PERF_THIRD_PARTY_BLOCKING",
      fixtureType: "exclusion",
      description: "Third-party fonts (non-blocking)",
      url: "https://example.com/page-5",
      facts: createBaseFact("https://example.com/page-5", {
        thirdParties: [
          { entityName: "Google Fonts", category: "fonts", domain: "fonts.googleapis.com", transferBytes: 15000, mainThreadBlockingTimeMs: 0, resourceCount: 2 },
        ],
      }),
      expectedFinding: false,
    },
    {
      id: "THIRD_PARTY_EDGE_1",
      ruleCode: "PERF_THIRD_PARTY_BLOCKING",
      fixtureType: "boundary",
      description: "Third-party blocking time = 400ms (Boundary)",
      url: "https://example.com/page-6",
      facts: createBaseFact("https://example.com/page-6", {
        thirdParties: [
          { entityName: "HubSpot", category: "marketing", domain: "hubspot.com", transferBytes: 60000, mainThreadBlockingTimeMs: 400, resourceCount: 2 },
        ],
      }),
      expectedFinding: false,
    }
  );

  return fixtures;
}
