/**
 * Hardened Sitemap and Internal Link Migration Matrix Tests.
 * Proves detection of stale legacy sitemap URLs, staging sitemap leaks,
 * internal links pointing to old domains/staging, and orphaning detection.
 */

import { validateMigrationParity } from "../parity-validator";
import { DestinationUrlRecord } from "../types";

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

describe("5. Sitemap & Internal Link Migration Matrices", () => {
  it("5.1. Stale legacy domain URL and staging URL in sitemap are detected cleanly", () => {
    const sitemap = [
      "https://new.com/page-1",
      "https://old-domain.com/old-page",
      "https://staging.new.com/staging-page",
    ];

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [],
      isProductionEnvironment: true,
      legacyDomain: "old-domain.com",
      stagingDomain: "staging.new.com",
      sitemapUrls: sitemap,
    });

    expect(res.parityIssues.some((i) => i.issueType === "MIGRATION_STALE_SITEMAP_URL")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "STAGING_SITEMAP_LEAK")).toBe(true);
  });

  it("5.2. Internal link pointing to old domain or staging domain is flagged", () => {
    const links = [
      { sourceUrl: "https://new.com/about", targetUrl: "https://old-domain.com/contact" },
      { sourceUrl: "https://new.com/header", targetUrl: "https://staging.new.com/login" },
    ];

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [],
      isProductionEnvironment: true,
      legacyDomain: "old-domain.com",
      stagingDomain: "staging.new.com",
      internalLinks: links,
    });

    expect(res.parityIssues.some((i) => i.issueType === "MIGRATION_INTERNAL_LINK_TO_LEGACY_URL")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "STAGING_INTERNAL_LINK_LEAK")).toBe(true);
  });

  it("5.3. Destination URL with 0 incoming internal links is flagged as POST_MIGRATION_ORPHAN_CANDIDATE", () => {
    const dest: DestinationUrlRecord = {
      url: "https://new.com/orphaned-service",
      isIndexable: true,
      inSitemap: true,
      internalLinkCount: 0,
      hasSchema: false,
    };

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [dest],
      isProductionEnvironment: true,
    });

    expect(res.parityIssues.some((i) => i.issueType === "POST_MIGRATION_ORPHAN_CANDIDATE")).toBe(true);
  });
});
