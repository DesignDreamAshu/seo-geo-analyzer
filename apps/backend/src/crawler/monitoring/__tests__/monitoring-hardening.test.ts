/**
 * Phase 10 Certification Hardening Invariant Test Suite.
 * Covers Finding Identity, URL Removal Semantics, CHANGED lifecycle, Rule Semantic Versioning,
 * Production Rule Inventory Safety, Multi-Signal Comparability, Performance Lab Inconclusive Guards,
 * Change Burst Safeguards, and Storage Immutability.
 */

import { CrawlSnapshot, SnapshotDiagnosticFinding } from "../types";
import { auditSnapshotRegression } from "../engine";
import { buildStableFindingIdentity } from "../finding-identity";
import { SnapshotStore, ImmutableSnapshotError } from "../snapshot-store";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../verification/rule-inventory";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("Phase 10 Hardened Invariant & Edge Case Suite", () => {
  const createMockSnapshot = (
    id: string,
    findings: any[] = [],
    pages: Record<string, any> = {},
    ruleSetVer = "1.0.0"
  ): CrawlSnapshot => ({
    snapshotId: id,
    projectId: "bot-consulting",
    rootDomain: "botconsulting.io",
    originUrl: "https://www.botconsulting.io",
    startedAt: "2026-08-20T10:00:00Z",
    completedAt: "2026-08-20T10:05:00Z",
    crawlerVersion: "1.0.0",
    ruleSetVersion: ruleSetVer,
    productionRuleCount: 95,
    crawlScope: "full_site",
    isComplete: true,
    pages,
    findings,
  });

  // 1. STABLE FINDING IDENTITY
  it("1. Finding Identity: broken link moving DOM position remains PERSISTING without churn", () => {
    const f1: SnapshotDiagnosticFinding = {
      ruleCode: "LINK_BROKEN_INTERNAL",
      url: "https://www.botconsulting.io/about",
      severity: "high",
      targetHref: "https://www.botconsulting.io/dead-link",
      targetElementSelector: "div.header > a.cta",
      evidence: "Broken link to /dead-link",
    };
    const f2: SnapshotDiagnosticFinding = {
      ...f1,
      targetElementSelector: "footer.site-footer > a.footer-link", // Moved to footer during layout refactor!
    };

    expect(buildStableFindingIdentity(f1)).toBe(buildStableFindingIdentity(f2));

    const snap1 = createMockSnapshot("s1", [f1], { "https://www.botconsulting.io/about": { statusCode: 200 } });
    const snap2 = createMockSnapshot("s2", [f2], { "https://www.botconsulting.io/about": { statusCode: 200 } });

    const res = auditSnapshotRegression(snap2, snap1);
    expect(res.findingChanges.length).toBe(1);
    expect(res.findingChanges[0].lifecycle).toBe("PERSISTING"); // No false RESOLVED + NEW churn!
  });

  it("2. Finding Identity: broken link target A changed to target B treated as distinct finding", () => {
    const fA: SnapshotDiagnosticFinding = {
      ruleCode: "LINK_BROKEN_INTERNAL",
      url: "https://www.botconsulting.io/about",
      severity: "high",
      targetHref: "https://www.botconsulting.io/old-404",
      evidence: "Broken link to /old-404",
    };
    const fB: SnapshotDiagnosticFinding = {
      ruleCode: "LINK_BROKEN_INTERNAL",
      url: "https://www.botconsulting.io/about",
      severity: "high",
      targetHref: "https://www.botconsulting.io/new-404",
      evidence: "Broken link to /new-404",
    };

    expect(buildStableFindingIdentity(fA) !== buildStableFindingIdentity(fB)).toBe(true);
  });

  // 2. URL REMOVAL POSITIVE EVIDENCE
  it("3. URL Removal: absent from internal links but direct probe = 200 is NO_LONGER_DISCOVERED (not REMOVED_CONFIRMED)", () => {
    const base = createMockSnapshot("s1", [], { "https://www.botconsulting.io/unlinked-post": { statusCode: 200 } });
    const curr = createMockSnapshot("s2", [], {}); // absent from traversal

    const directProbes = {
      "https://www.botconsulting.io/unlinked-post": { url: "https://www.botconsulting.io/unlinked-post", statusCode: 200 },
    };

    const res = auditSnapshotRegression(curr, base, "PREVIOUS_SUCCESSFUL", [], directProbes);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/unlinked-post");
    expect(pChange?.lifecycle).toBe("NO_LONGER_DISCOVERED");
  });

  it("4. URL Removal: absent from discovery + direct probe = 404 is REMOVED_CONFIRMED", () => {
    const base = createMockSnapshot("s1", [], { "https://www.botconsulting.io/deleted-post": { statusCode: 200 } });
    const curr = createMockSnapshot("s2", [], {});

    const directProbes = {
      "https://www.botconsulting.io/deleted-post": { url: "https://www.botconsulting.io/deleted-post", statusCode: 404 },
    };

    const res = auditSnapshotRegression(curr, base, "PREVIOUS_SUCCESSFUL", [], directProbes);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/deleted-post");
    expect(pChange?.lifecycle).toBe("REMOVED_CONFIRMED");
  });

  it("5. URL Removal: absent from discovery + direct probe = 301 is REDIRECTED_CONFIRMED", () => {
    const base = createMockSnapshot("s1", [], { "https://www.botconsulting.io/migrated-post": { statusCode: 200 } });
    const curr = createMockSnapshot("s2", [], {});

    const directProbes = {
      "https://www.botconsulting.io/migrated-post": { url: "https://www.botconsulting.io/migrated-post", statusCode: 301, redirectTarget: "/new-post" },
    };

    const res = auditSnapshotRegression(curr, base, "PREVIOUS_SUCCESSFUL", [], directProbes);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/migrated-post");
    expect(pChange?.lifecycle).toBe("REDIRECTED_CONFIRMED");
  });

  // 3. CHANGED LIFECYCLE
  it("6. CHANGED Lifecycle: same finding with material evidence alteration classified as CHANGED", () => {
    const f1: SnapshotDiagnosticFinding = {
      ruleCode: "STATUS_4XX",
      url: "https://www.botconsulting.io/error-page",
      severity: "critical",
      evidence: "HTTP status 404 Not Found",
    };
    const f2: SnapshotDiagnosticFinding = {
      ruleCode: "STATUS_4XX",
      url: "https://www.botconsulting.io/error-page",
      severity: "critical",
      evidence: "HTTP status 410 Gone",
    };

    const base = createMockSnapshot("s1", [f1], { "https://www.botconsulting.io/error-page": { statusCode: 404 } });
    const curr = createMockSnapshot("s2", [f2], { "https://www.botconsulting.io/error-page": { statusCode: 410 } });

    const res = auditSnapshotRegression(curr, base);
    expect(res.findingChanges[0].lifecycle).toBe("CHANGED");
    expect(res.summary.totalChangedFindings).toBe(1);
  });

  // 4. PRODUCTION RULE INVENTORY INVARIANT
  it("7. Production Rule Safety: all reported ruleCode exist in IMPLEMENTED_DIAGNOSTIC_RULES", () => {
    const productionRuleCodes = new Set(IMPLEMENTED_DIAGNOSTIC_RULES.map((r) => r.ruleCode));
    expect(productionRuleCodes.size).toBe(95);

    const f: SnapshotDiagnosticFinding = {
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      monitoringSignalCode: "OG_IMAGE_BECAME_MISSING",
      url: "https://www.botconsulting.io/blog/post-1",
      severity: "high",
      evidence: "Missing og:image",
    };

    const snap = createMockSnapshot("s1", [f], { "https://www.botconsulting.io/blog/post-1": { statusCode: 200 } });
    const res = auditSnapshotRegression(snap, null);

    for (const fc of res.findingChanges) {
      expect(productionRuleCodes.has(fc.ruleCode as any)).toBe(true);
    }
  });

  // 5. RULE SEMANTIC VERSIONING
  it("8. Rule Semantic Versioning: changed rule diagnostic signature is NEWLY_DETECTABLE, not site regression", () => {
    const f1: SnapshotDiagnosticFinding = {
      ruleCode: "SCHEMA_JSON_LD_MALFORMED",
      url: "https://www.botconsulting.io/contact",
      severity: "high",
      ruleSemanticVersion: "1.0.0",
      evidence: "Syntax error",
    };
    const f2: SnapshotDiagnosticFinding = {
      ruleCode: "SCHEMA_JSON_LD_MALFORMED",
      url: "https://www.botconsulting.io/contact",
      severity: "high",
      ruleSemanticVersion: "2.0.0", // Rule logic updated!
      evidence: "New semantic strictness violation",
    };

    const base = createMockSnapshot("s1", [], {}, "1.0.0");
    base.ruleSignatures = { SCHEMA_JSON_LD_MALFORMED: "1.0.0" };

    const curr = createMockSnapshot("s2", [f2], {}, "1.0.0");
    curr.ruleSignatures = { SCHEMA_JSON_LD_MALFORMED: "2.0.0" };

    const res = auditSnapshotRegression(curr, base);
    expect(res.summary.totalNewlyDetectable).toBe(1);
    expect(res.summary.totalNewRegressions).toBe(0);
    expect(res.findingChanges[0].monitoringSignalCode).toBe("RULE_SEMANTICS_UPDATED");
  });

  // 6. RESOLUTION BY REDIRECT
  it("9. Rule-Aware Resolution: 404 issue confirmed resolved via valid 301 direct probe", () => {
    const f: SnapshotDiagnosticFinding = {
      ruleCode: "STATUS_4XX",
      url: "https://www.botconsulting.io/old-landing",
      severity: "critical",
      evidence: "HTTP 404",
    };

    const base = createMockSnapshot("s1", [f], { "https://www.botconsulting.io/old-landing": { statusCode: 404 } });
    const curr = createMockSnapshot("s2", [], {});

    const directProbes = {
      "https://www.botconsulting.io/old-landing": { url: "https://www.botconsulting.io/old-landing", statusCode: 301, redirectTarget: "/new-landing" },
    };

    const res = auditSnapshotRegression(curr, base, "PREVIOUS_SUCCESSFUL", [], directProbes);
    expect(res.summary.totalResolvedFindings).toBe(1);
    expect(res.findingChanges[0].lifecycle).toBe("RESOLVED");
    expect(res.findingChanges[0].currentEvidence?.includes("Verified resolved via redirect")).toBe(true);
  });

  // 7. PERFORMANCE LAB INCONCLUSIVE GUARD
  it("10. Performance Lab Inconclusive Guard: flags inconclusive when lab device configuration differs", () => {
    const base = createMockSnapshot("s1", [], {
      "https://www.botconsulting.io/home": {
        statusCode: 200,
        lcpMs: 1200,
        labConfig: { device: "desktop", throttling: "fast_4g", viewport: "1920x1080" },
      },
    });
    const curr = createMockSnapshot("s2", [], {
      "https://www.botconsulting.io/home": {
        statusCode: 200,
        lcpMs: 3800,
        labConfig: { device: "mobile", throttling: "slow_4g", viewport: "375x812" }, // Device changed!
      },
    });

    const res = auditSnapshotRegression(curr, base);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/home");
    expect(pChange?.performanceRegression?.type).toBe("PERFORMANCE_COMPARISON_INCONCLUSIVE");
  });

  // 8. CHANGE BURST SAFEGUARDS
  it("11. Change Burst Safeguard: suppresses change burst when current crawl is incomplete", () => {
    const findings: SnapshotDiagnosticFinding[] = Array.from({ length: 30 }, (_, i) => ({
      ruleCode: "CONTENT_MISSING_H1",
      url: `https://www.botconsulting.io/page-${i}`,
      severity: "high",
      evidence: "Missing H1",
    }));

    const base = createMockSnapshot("s1", [], {});
    const curr = createMockSnapshot("s2", findings, {});
    curr.isComplete = false; // Incomplete crawl traversal!

    const res = auditSnapshotRegression(curr, base);
    expect(res.changeBurst.burstStatus).toBe("SUPPRESSED_CRAWL_INCOMPLETE");
    expect(res.changeBurst.isChangeBurst).toBe(false);
  });

  // 9. SNAPSHOT IMMUTABILITY STORAGE ENFORCEMENT
  it("12. Snapshot Immutability: attempting to mutate or overwrite a finalized snapshot throws ImmutableSnapshotError", () => {
    const store = new SnapshotStore();
    const snap = createMockSnapshot("snap_certified_01", [], { "https://www.botconsulting.io": { statusCode: 200 } });

    const saved = store.saveSnapshot(snap);

    // 1. Deep freeze enforcement
    let mutationError = false;
    try {
      (saved as any).ruleSetVersion = "2.0.0";
    } catch {
      mutationError = true;
    }
    expect(mutationError || Object.isFrozen(saved)).toBe(true);

    // 2. Storage overwrite prevention
    let overwriteError = false;
    try {
      store.saveSnapshot(snap);
    } catch (err: any) {
      if (err instanceof ImmutableSnapshotError) {
        overwriteError = true;
      }
    }
    expect(overwriteError).toBe(true);
  });
});
