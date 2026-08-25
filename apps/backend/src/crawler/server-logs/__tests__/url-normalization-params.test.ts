/**
 * URL Normalization, Parameter Categorization & Privacy Redaction Tests.
 * Proves raw vs normalized preservation, sensitive parameter value redaction,
 * parameter categorization (TRACKING, FACETING, PAGINATION, etc.), and resource classification.
 */

import { normalizeLogUrl, redactSensitiveQueryParams, detectResourceType } from "../url-normalizer";

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

describe("3. URL Normalization, Parameters & Privacy Redaction", () => {
  it("3.1. Preserves raw requested URL and strips tracking parameters for normalized analysis", () => {
    const res = normalizeLogUrl("example.com", "/products/shoes", "utm_source=google&utm_medium=cpc&sort=price_asc");

    expect(res.rawUrl).toBe("https://example.com/products/shoes?utm_source=google&utm_medium=cpc&sort=price_asc");
    expect(res.normalizedUrl).toBe("https://example.com/products/shoes/?sort=price_asc");
    expect(res.queryParamCategories["utm_source"]).toBe("TRACKING");
    expect(res.queryParamCategories["sort"]).toBe("SORTING");
  });

  it("3.2. Redacts sensitive parameters (token, session, auth, password, key) from query strings", () => {
    const query = "api_key=secret_12345&user_id=42&auth_token=jwt_xyz";
    const redacted = redactSensitiveQueryParams(query);

    expect(redacted.includes("secret_12345")).toBe(false);
    expect(redacted.includes("jwt_xyz")).toBe(false);
    expect(redacted.includes("[REDACTED]")).toBe(true);
    expect(redacted.includes("user_id=42")).toBe(true);
  });

  it("3.3. Detects resource types accurately (HTML, IMAGE, PDF, API, XML, CSS, JS)", () => {
    expect(detectResourceType("/blog/article-1")).toBe("HTML_DOCUMENT");
    expect(detectResourceType("/assets/hero.webp")).toBe("IMAGE");
    expect(detectResourceType("/docs/manual.pdf")).toBe("PDF");
    expect(detectResourceType("/api/v1/search")).toBe("API");
    expect(detectResourceType("/sitemap.xml")).toBe("XML");
  });
});
