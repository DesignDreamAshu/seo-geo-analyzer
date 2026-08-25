/**
 * Test Suite for Content Extractability, Entity Legal Normalization, and FAQ Verification.
 */

import { parsePageHtml } from "../../parser";
import { evaluateContentExtractability } from "../extractability";
import { evaluateEntityConsistency } from "../entity-consistency";

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

describe("Extractability, Entity Legal Normalization & FAQ Verification", () => {
  it("1. Content Extractability: identifies semantic landmarks, tables, and structured lists", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>ServiceNow Pricing Guide</title></head>
        <body>
          <main>
            <h1>ServiceNow Pricing Guide</h1>
            <p>Comprehensive breakdown of licensing tiers for enterprise cloud transformation.</p>
            <table>
              <tr><th>Tier</th><th>Features</th><th>Price</th></tr>
              <tr><td>Standard</td><td>Core ITSM</td><td>Custom</td></tr>
            </table>
            <ul>
              <li>IT Service Management</li>
              <li>IT Operations Management</li>
            </ul>
          </main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/pricing");
    const res = evaluateContentExtractability(parsed);

    expect(res.hasSemanticMain).toBe(true);
    expect(res.hasClearH1).toBe(true);
    expect(res.structuredElements.tablesCount).toBe(1);
    expect(res.structuredElements.listsCount).toBe(1);
    expect(res.rawHtmlPrimaryContentPresent).toBe(true);
  });

  it("2. Legal Suffix Normalization: matches 'BOT Consulting' in logo to 'BOT Consulting LLC' in schema without false discrepancy", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>BOT Consulting | Enterprise Transformation</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "BOT Consulting LLC",
              "url": "https://www.botconsulting.io"
            }
          </script>
        </head>
        <body>
          <header><div class="logo">BOT Consulting</div></header>
          <main><h1>Enterprise Transformation</h1></main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io");
    const entityReport = evaluateEntityConsistency(parsed);

    expect(entityReport.isOrganizationConsistent).toBe(true);
    expect(entityReport.discrepancies.length).toBe(0);
    expect(entityReport.normalizationNotes.length).toBeGreaterThanOrEqual(1);
  });

  it("3. Genuine Entity Conflict: flags clear brand discrepancy between visible header and declared schema", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Apex Global Partners</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Acme Widgets Corporation",
              "url": "https://www.acmewidgets.com"
            }
          </script>
        </head>
        <body>
          <header><div class="logo">Apex Global Partners</div></header>
          <main><h1>Advisory Services</h1></main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.apexpartners.com");
    const entityReport = evaluateEntityConsistency(parsed);

    expect(entityReport.isOrganizationConsistent).toBe(false);
    expect(entityReport.discrepancies.length).toBeGreaterThanOrEqual(1);
  });

  it("4. FAQ Schema Hidden Question Detection: flags FAQ question declared in JSON-LD that is missing from visible body text", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>FAQ Guide</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is the typical deployment timeline for ServiceNow ITSM?",
                  "acceptedAnswer": { "@type": "Answer", "text": "Deployments typically take 8 to 12 weeks." }
                }
              ]
            }
          </script>
        </head>
        <body>
          <main>
            <h1>General FAQ</h1>
            <p>We provide consulting services worldwide.</p>
          </main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/faq");
    const entityReport = evaluateEntityConsistency(parsed);

    expect(entityReport.discrepancies.length).toBeGreaterThanOrEqual(1);
    expect(entityReport.discrepancies[0].includes("FAQ schema declares question")).toBe(true);
  });
});
