/**
 * Test Suite for Answer Readiness, Intent Classification, and Magic-Number Safeguards.
 */

import { parsePageHtml } from "../../parser";
import { evaluateAnswerReadiness } from "../answer-readiness";
import { inspectLlmsTxt } from "../llms-txt-inspector";

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

describe("Answer Readiness, Intent Classification & Heuristic Safeguards", () => {
  it("1. 70-Word Direct Answer Safeguard: accepts 70-word definition without arbitrary 60-word cutoff rejection", () => {
    const definitionText =
      "A Configuration Management Database (CMDB) is a centralized architectural database that stores comprehensive information about hardware assets, software systems, virtual infrastructure, network nodes, and facilities across an entire enterprise. By capturing the precise operational relationships between these technical components, it provides IT service leaders with complete transparency into digital infrastructure, simplifies root-cause incident resolution, ensures compliance readiness, and accelerates automated workflow delivery across modern cloud and hybrid environments.";

    const wordCount = definitionText.split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(68);

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Understanding CMDB | BOT Insights</title></head>
        <body>
          <main>
            <h1>Understanding CMDB</h1>
            <h2>What is ServiceNow CMDB?</h2>
            <p>${definitionText}</p>
          </main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/blog/understanding-cmdb");
    const res = evaluateAnswerReadiness(parsed);

    expect(res.pageIntent.primaryClass).toBe("article_blog");
    expect(res.hasConciseDefinition).toBe(true);
    expect(res.candidates.length).toBeGreaterThanOrEqual(1);
    expect(res.candidates[0].wordCount).toBe(wordCount);
    // Verifies valid CSS/DOM locator without pseudo-selectors
    expect(res.candidates[0].domLocation.includes(":contains")).toBe(false);
  });

  it("2. Intent Heuristic Suppression: Case Study intent suppresses mandatory FAQ/definition requirements", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Global Logistics ServiceNow Migration | Case Study</title></head>
        <body>
          <main>
            <h1>Global Logistics Transformation</h1>
            <p>How we modernized 1,200 server nodes across 14 distribution centers.</p>
          </main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/case-studies/logistics");
    const res = evaluateAnswerReadiness(parsed);

    expect(res.pageIntent.primaryClass).toBe("case_study");
    expect(res.pageIntent.applicableHeuristics.faqStructureExpected).toBe(false);
    expect(res.pageIntent.applicableHeuristics.answerFirstDefinitionExpected).toBe(false);
    expect(res.advisorySuggestions.length).toBe(0);
  });

  it("3. Contact & About Page Intent Classification: correctly recognizes contact and about pages", () => {
    const contactHtml = `<!DOCTYPE html><html><head><title>Contact Us</title></head><body><main><form><input type="email"></form></main></body></html>`;
    const parsedContact = parsePageHtml(contactHtml, "https://www.botconsulting.io/contact");
    const resContact = evaluateAnswerReadiness(parsedContact);
    expect(resContact.pageIntent.primaryClass).toBe("contact");

    const aboutHtml = `<!DOCTYPE html><html><head><title>About Our Leadership</title></head><body><main><h1>Leadership Team</h1></main></body></html>`;
    const parsedAbout = parsePageHtml(aboutHtml, "https://www.botconsulting.io/about");
    const resAbout = evaluateAnswerReadiness(parsedAbout);
    expect(resAbout.pageIntent.primaryClass).toBe("about");
    expect(resAbout.pageIntent.applicableHeuristics.entityIdentityExpected).toBe(true);
  });

  it("4. Comparison Page Intent: recognizes comparison intent and expects comparison tables", () => {
    const html = `<!DOCTYPE html><html><head><title>ServiceNow vs Jira Service Management</title></head><body><main><h1>ServiceNow vs Jira</h1></main></body></html>`;
    const parsed = parsePageHtml(html, "https://www.botconsulting.io/servicenow-vs-jira");
    const res = evaluateAnswerReadiness(parsed);

    expect(res.pageIntent.primaryClass).toBe("comparison");
    expect(res.pageIntent.applicableHeuristics.comparisonTableExpected).toBe(true);
  });

  it("5. LLMs.txt Advisory: reports NOT_PRESENT as informational status without reducing score or erroring", async () => {
    const report = await inspectLlmsTxt(new URL("https://www.example-domain-advisory-check.com"));
    expect(report.status).toBe("NOT_PRESENT");
    expect(report.hasLlmsTxt).toBe(false);
    expect(report.advisoryNote.includes("does NOT affect traditional SEO Health")).toBe(true);
  });
});
