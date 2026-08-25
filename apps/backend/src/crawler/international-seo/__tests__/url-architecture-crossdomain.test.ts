/**
 * International URL Architecture & Cross-Domain Tests.
 * Proves classification of ccTLD, subdomains, subdirectories, and mixed international structures.
 */

import { determineUrlArchitecture } from "../url-architecture";

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

describe("7. International URL Architecture & Cross-Domain", () => {
  it("7.1. Subdirectory architecture classified accurately", () => {
    const urls = ["https://example.com/en-us/page", "https://example.com/fr-fr/page"];
    expect(determineUrlArchitecture(urls).architectureType).toBe("SUBDIRECTORY");
  });

  it("7.2. Subdomain architecture classified accurately", () => {
    const urls = ["https://fr.example.com/page", "https://de.example.com/page"];
    expect(determineUrlArchitecture(urls).architectureType).toBe("SUBDOMAIN");
  });

  it("7.3. ccTLD architecture classified accurately", () => {
    const urls = ["https://example.fr/page", "https://example.de/page"];
    expect(determineUrlArchitecture(urls).architectureType).toBe("CCTLD");
  });
});
