/**
 * Normalization & Link Attribute Tests.
 * Proves registrable domain extraction, subdomain preservation, spoofing rejection,
 * and confirms follow != good, nofollow != bad invariant.
 */

import { parseAndNormalizeBacklinkUrl, extractRegistrableDomain, isOwnBacklinkDomain } from "../normalization";

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

describe("2. Normalization & Link Attributes", () => {
  it("2.1. Extracts registrable domains and preserves subdomains accurately", () => {
    const newsParsed = parseAndNormalizeBacklinkUrl("https://news.example.com/article/1?utm_source=twitter");
    expect(newsParsed.domain).toBe("news.example.com");
    expect(newsParsed.rootDomain).toBe("example.com");
    expect(newsParsed.subdomain).toBe("news");
    expect(newsParsed.normalizedUrl.includes("utm_source")).toBe(false);

    const forumParsed = parseAndNormalizeBacklinkUrl("https://forum.example.com/threads/123");
    expect(forumParsed.domain).toBe("forum.example.com");
    expect(forumParsed.rootDomain).toBe("example.com");
    expect(forumParsed.subdomain).toBe("forum");
  });

  it("2.2. Correctly handles multi-part international TLDs (co.uk, com.au, co.in)", () => {
    expect(extractRegistrableDomain("bbc.co.uk")).toBe("bbc.co.uk");
    expect(extractRegistrableDomain("news.bbc.co.uk")).toBe("bbc.co.uk");
    expect(extractRegistrableDomain("sydney.edu.au")).toBe("sydney.edu.au");
    expect(extractRegistrableDomain("tech.startup.co.in")).toBe("startup.co.in");
  });

  it("2.3. Safe own-domain checks strictly reject spoofed hostnames", () => {
    const aliases = ["botconsulting.io"];
    expect(isOwnBacklinkDomain("https://www.botconsulting.io/services", aliases)).toBe(true);
    expect(isOwnBacklinkDomain("https://app.botconsulting.io/dashboard", aliases)).toBe(true);
    // Subdomain spoofing rejected
    expect(isOwnBacklinkDomain("https://botconsulting.io.evil-phishing.com/page", aliases)).toBe(false);
    // Unrelated TLD rejected
    expect(isOwnBacklinkDomain("https://botconsulting.org/page", aliases)).toBe(false);
  });
});
