/**
 * Comprehensive Canonical, Staging Leak Matrix, and Robots/Noindex Environment Tests.
 * Proves isolation of staging leaks across canonical, hreflang, sitemaps, internal links, OG, schema,
 * and validates environment-aware robots/noindex rules.
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

describe("4. Canonical, Staging Leaks & Environment Isolation", () => {
  it("4.1. Staging leaks across canonical, hreflang, and sitemap are flagged as LAUNCH_BLOCKER in production", () => {
    const dest: DestinationUrlRecord = {
      url: "https://new.com/servicenow/cmdb",
      isIndexable: true,
      inSitemap: true,
      internalLinkCount: 5,
      canonicalUrl: "https://staging.new.com/servicenow/cmdb",
      hasSchema: true,
    };

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [dest],
      isProductionEnvironment: true,
      stagingDomain: "staging.new.com",
      sitemapUrls: ["https://staging.new.com/servicenow/cmdb"],
      hreflangUrls: [{ sourceUrl: "https://new.com/servicenow/cmdb", targetUrl: "https://staging.new.com/fr/cmdb" }],
    });

    expect(res.parityIssues.some((i) => i.issueType === "STAGING_CANONICAL_LEAK")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "STAGING_SITEMAP_LEAK")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "STAGING_HREFLANG_LEAK")).toBe(true);
  });

  it("4.2. Staging leaks in OG URL, schema, and internal links are captured with review priority", () => {
    const dest: DestinationUrlRecord = {
      url: "https://new.com/servicenow/itsm",
      isIndexable: true,
      inSitemap: true,
      internalLinkCount: 5,
      ogUrl: "https://staging.new.com/servicenow/itsm",
      schemaUrls: ["https://staging.new.com/schema/org"],
      hasSchema: true,
    };

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [dest],
      isProductionEnvironment: true,
      stagingDomain: "staging.new.com",
      internalLinks: [{ sourceUrl: "https://new.com/footer", targetUrl: "https://staging.new.com/privacy" }],
    });

    expect(res.parityIssues.some((i) => i.issueType === "STAGING_OG_URL_LEAK")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "STAGING_SCHEMA_URL_LEAK")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "STAGING_INTERNAL_LINK_LEAK")).toBe(true);
  });

  it("4.3. Production inherited noindex (meta, X-Robots-Tag, and robots.txt site-wide disallow) are LAUNCH_BLOCKER", () => {
    const dest: DestinationUrlRecord = {
      url: "https://new.com/service",
      isIndexable: false, // HTML meta robots noindex
      inSitemap: true,
      internalLinkCount: 5,
      hasSchema: true,
    };

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [dest],
      isProductionEnvironment: true,
      xRobotsNoindexUrls: ["https://new.com/api-docs"],
      robotsTxtDisallows: ["/"],
    });

    expect(res.parityIssues.some((i) => i.issueType === "PRODUCTION_INHERITED_NOINDEX")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "PRODUCTION_X_ROBOTS_NOINDEX")).toBe(true);
    expect(res.parityIssues.some((i) => i.issueType === "PRODUCTION_ROBOTS_TXT_DISALLOW")).toBe(true);
  });

  it("4.4. Staging environment noindex is recognized as valid pre-launch protection and NOT a blocker", () => {
    const dest: DestinationUrlRecord = {
      url: "https://staging.new.com/service",
      isIndexable: false, // Staging noindex is good practice
      inSitemap: true,
      internalLinkCount: 5,
      hasSchema: true,
    };

    const res = validateMigrationParity({
      mappings: [],
      destinationPages: [dest],
      isProductionEnvironment: false, // Staging environment context
    });

    expect(res.parityIssues.some((i) => i.issueType === "PRODUCTION_INHERITED_NOINDEX")).toBe(false);
  });
});
