/**
 * Phase 11 Canonical Actions Bridge & Deduplication Tests.
 * Proves deduplication with technical rules, owner routing to Developer / SEO, and technical severity preservation.
 */

import { bridgeInternationalOpportunitiesToPhase11 } from "../phase-integrators";
import { HreflangCluster } from "../types";

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

describe("9. Phase 11 Integration & Action Deduplication", () => {
  it("9.1. Missing reciprocal return link emits TECHNICAL_FIX action and deduplicates", () => {
    const cluster: HreflangCluster = {
      clusterId: "cluster_101",
      pages: [{ url: "https://example.com/en-us", localeCode: "en-US", isIndexable: true }],
      declaredAlternates: [],
      xDefaultState: "X_DEFAULT_VALID",
      reciprocityState: "HREFLANG_RETURN_LINK_MISSING",
      hasDuplicateLocaleTargets: false,
      completenessState: "INCOMPLETE_CLUSTER",
      canonicalCompatibility: "HREFLANG_CANONICAL_ALIGNED",
      provenance: { sources: ["HTML"], evaluatedAt: "" },
    };

    const actions = bridgeInternationalOpportunitiesToPhase11("project-1", [cluster], [], [], []);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe("TECHNICAL_FIX");
    expect(actions[0].technicalSeverity).toBe("high");
    expect(actions[0].primaryOwner).toBe("Developer");

    // Deduplication check
    const dedup = bridgeInternationalOpportunitiesToPhase11("project-1", [cluster], [], [], actions);
    expect(dedup.length).toBe(0);
  });

  it("9.2. International canonical conflict emits CONTENT_STRUCTURE_OPPORTUNITY action", () => {
    const conflicts = [
      {
        url: "https://example.com/en-gb/pricing",
        locale: "en-GB",
        canonicalUrl: "https://example.com/en-us/pricing",
        conflictType: "HREFLANG_CANONICAL_CONFLICT" as const,
        details: "Conflicting canonical and hreflang signals.",
      },
    ];

    const actions = bridgeInternationalOpportunitiesToPhase11("project-1", [], [], conflicts, []);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe("CONTENT_STRUCTURE_OPPORTUNITY");
    expect(actions[0].primaryOwner).toBe("SEO");
  });
});
