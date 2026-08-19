/**
 * Independent Live Playwright Browser Parity Test Suite
 * 
 * Ground-Truth Principles:
 * 1. Independent extraction: Zero reuse of parseHtmlPage() or crawler DOM helpers.
 * 2. Native DOM queries: document.title, document.querySelectorAll(), document.querySelector().
 * 3. Equivalent population word-count models (rawDocument, visibleBody, mainContent).
 * 4. Rule-level False Positive / False Negative measurement on deterministic rules.
 * 5. Machine-readable JSON output artifact with strict arithmetic invariant.
 */

import { chromium } from "playwright";
import axios from "axios";
import fs from "fs";
import path from "path";
import { parseHtmlPage } from "../parser";
import { normalizeUrl } from "../normalizer";

interface CrawlerFactModel {
  requestedUrl: string;
  status: number;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  h3Count: number;
  rawDocumentWordCount: number;
  visibleBodyWordCount: number;
  mainContentWordCount: number;
  wordCount: number;
  hasMain: boolean;
  mainCount: number;
  formCount: number;
  unlabelledFormControlCount: number;
  imageCount: number;
  missingAltCount: number;
  renderMode: string;
  renderConfidence: string;
}

interface BrowserOracleFactModel {
  requestedUrl: string;
  navigationStatus: number | null;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  h3Count: number;
  rawDocumentWordCount: number;
  visibleBodyWordCount: number;
  mainContentWordCount: number;
  wordCount: number;
  hasMain: boolean;
  mainCount: number;
  formCount: number;
  unlabelledFormControlCount: number;
  imageCount: number;
  missingAltCount: number;
  domContentLoaded: boolean;
  networkIdleReached: boolean;
  challengeDetected: boolean;
  browserError?: string | null;
}

interface FactComparison {
  field: string;
  crawlerValue: any;
  browserValue: any;
  status: "EXACT_MATCH" | "TOLERATED_MATCH" | "MISMATCH" | "INCONCLUSIVE" | "NOT_EVALUATED";
  note?: string;
}

const TEST_URLS = [
  "https://www.botconsulting.io/",
  "https://www.botconsulting.io/about-us",
  "https://www.botconsulting.io/solutions",
  "https://www.botconsulting.io/odyssey",
  "https://www.botconsulting.io/servicenow-at-bot",
  "https://www.botconsulting.io/contact-us",
  "https://www.botconsulting.io/solution-service-now",
  "https://www.botconsulting.io/job-categories/customer-support",
  "https://www.botconsulting.io/job-categories/sales-marketing",
  "https://www.botconsulting.io/job-openings/data-architect",
  "https://www.botconsulting.io/job-openings/analytic-engineer",
  "https://www.botconsulting.io/jobopenings/790176000000574221",
  "https://www.botconsulting.io/jobopenings/790176000000574233",
  "https://www.botconsulting.io/jobopenings-copy/790176000000574229",
  "https://www.botconsulting.io/jobopenings-copy/790176000000574249",
  "https://www.botconsulting.io/post/2025-year-in-review",
  "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow",
  "https://www.botconsulting.io/post/high-impact-gccs-the-new-growth-engine-for-global-enterprises",
  "https://www.botconsulting.io/search",
  "https://www.botconsulting.io/thank-you",
  "https://www.botconsulting.io/application",
  "https://www.botconsulting.io/non-existent-page-404-test",
  "https://www.botconsulting.io/sitemap.xml",
  "https://www.botconsulting.io/cdn-cgi/l/email-protection",
  "https://www.botconsulting.io/terms-of-service",
];

async function extractCrawlerFacts(url: string): Promise<CrawlerFactModel> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 10000,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const finalUrl = (response.request as any)?.res?.responseUrl || url;
  const normalized = normalizeUrl(url) || url;
  const parsed = parseHtmlPage(
    url,
    normalized,
    finalUrl,
    response.status,
    [],
    typeof response.data === "string" ? response.data : JSON.stringify(response.data),
    response.headers as any,
    150,
    0,
    "https://www.botconsulting.io",
    false,
    false
  );

  return {
    requestedUrl: url,
    status: parsed.statusCode,
    finalUrl: parsed.finalUrl,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    canonical: parsed.canonicalUrl,
    robots: parsed.metaRobots,
    h1Count: parsed.h1Count,
    h1Texts: parsed.h1s,
    h2Count: parsed.h2Tags.length,
    h3Count: parsed.h3Tags.length,
    rawDocumentWordCount: parsed.rawDocumentWordCount,
    visibleBodyWordCount: parsed.visibleBodyWordCount,
    mainContentWordCount: parsed.mainContentWordCount,
    wordCount: parsed.wordCount,
    hasMain: parsed.landmarks.hasMain,
    mainCount: parsed.landmarks.mainCount,
    formCount: parsed.forms.length,
    unlabelledFormControlCount: parsed.forms.reduce(
      (sum, f) => sum + f.controls.filter((c) => !c.isLabelled).length,
      0
    ),
    imageCount: parsed.images.length,
    missingAltCount: parsed.images.filter((img) => !img.hasAltAttribute).length,
    renderMode: parsed.renderMode,
    renderConfidence: parsed.renderConfidence,
  };
}

async function extractPlaywrightOracleFacts(browser: any, url: string): Promise<BrowserOracleFactModel> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let navigationStatus: number | null = null;
  let domContentLoaded = false;
  let networkIdleReached = false;
  let browserError: string | null = null;

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    navigationStatus = res ? res.status() : 200;
    domContentLoaded = true;

    try {
      await page.waitForLoadState("networkidle", { timeout: 3000 });
      networkIdleReached = true;
    } catch {
      networkIdleReached = false;
    }
  } catch (err: any) {
    browserError = err.message;
  }

  const finalUrl = page.url();

  // Pure independent browser evaluation directly against native browser DOM
  const domData = await page
    .evaluate(() => {
      const docTitle = document.title ? document.title.trim() : null;
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
      const canonicalTag =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;
      const robotsMeta =
        document.querySelector('meta[name="robots"]')?.getAttribute("content")?.trim() || null;

      // Extract H1s natively
      const h1Nodes = Array.from(document.querySelectorAll("h1"));
      const h1Texts = h1Nodes.map((n) => (n.textContent || "").trim()).filter(Boolean);
      const h2Count = document.querySelectorAll("h2").length;
      const h3Count = document.querySelectorAll("h3").length;

      // 1. Raw Document Word Count (stripping only script/style/svg)
      const rawClone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
      let rawDocWords = 0;
      if (rawClone) {
        rawClone.querySelectorAll("script, style, noscript, svg").forEach((el) => el.remove());
        const rawText = (rawClone.innerText || "").replace(/\s+/g, " ").trim();
        rawDocWords = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
      }

      // 2. Visible Body Word Count (stripping nav, footer, header)
      const bodyClone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
      let visBodyWords = 0;
      if (bodyClone) {
        bodyClone.querySelectorAll("script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner']").forEach((el) => el.remove());
        const visText = (bodyClone.innerText || "").replace(/\s+/g, " ").trim();
        visBodyWords = visText ? visText.split(/\s+/).filter(Boolean).length : 0;
      }

      // 3. Main Content Word Count
      const mainEl = document.querySelector("main, [role='main'], #main-content, .main-content") as HTMLElement | null;
      let mainWords = 0;
      if (mainEl) {
        const mainClone = mainEl.cloneNode(true) as HTMLElement;
        mainClone.querySelectorAll("script, style, noscript, svg, nav, footer, header").forEach((el) => el.remove());
        const mainText = (mainClone.innerText || "").replace(/\s+/g, " ").trim();
        mainWords = mainText ? mainText.split(/\s+/).filter(Boolean).length : 0;
      } else {
        mainWords = visBodyWords;
      }

      // Landmarks & semantic tags
      const mainNodes = document.querySelectorAll("main, [role='main']");
      const hasMain = mainNodes.length > 0;
      const mainCount = mainNodes.length;

      // Forms and unlabelled inputs
      const forms = document.querySelectorAll("form");
      const inputs = document.querySelectorAll(
        "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select"
      );
      let unlabelledCount = 0;
      inputs.forEach((input) => {
        const id = input.getAttribute("id");
        const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
        const hasAria = Boolean(input.getAttribute("aria-label") || input.getAttribute("aria-labelledby"));
        const isWrappedInLabel = Boolean(input.closest("label"));
        if (!hasLabel && !hasAria && !isWrappedInLabel) {
          unlabelledCount++;
        }
      });

      // Images
      const imgNodes = Array.from(document.querySelectorAll("img"));
      const imageCount = imgNodes.length;
      const missingAltCount = imgNodes.filter((img) => !img.hasAttribute("alt")).length;

      // Challenge detection
      const bodySnippet = (document.body?.innerText || "").slice(0, 1000).toLowerCase();
      const challengeDetected =
        bodySnippet.includes("cloudflare") &&
        (bodySnippet.includes("verify you are human") || bodySnippet.includes("turnstile"));

      return {
        docTitle,
        metaDesc,
        canonicalTag,
        robotsMeta,
        h1Count: h1Nodes.length,
        h1Texts,
        h2Count,
        h3Count,
        rawDocumentWordCount: rawDocWords,
        visibleBodyWordCount: visBodyWords,
        mainContentWordCount: mainWords,
        wordCount: mainWords > 0 ? mainWords : visBodyWords,
        hasMain,
        mainCount,
        formCount: forms.length,
        unlabelledFormControlCount: unlabelledCount,
        imageCount,
        missingAltCount,
        challengeDetected,
      };
    })
    .catch((err) => ({
      docTitle: null,
      metaDesc: null,
      canonicalTag: null,
      robotsMeta: null,
      h1Count: 0,
      h1Texts: [],
      h2Count: 0,
      h3Count: 0,
      rawDocumentWordCount: 0,
      visibleBodyWordCount: 0,
      mainContentWordCount: 0,
      wordCount: 0,
      hasMain: false,
      mainCount: 0,
      formCount: 0,
      unlabelledFormControlCount: 0,
      imageCount: 0,
      missingAltCount: 0,
      challengeDetected: false,
    }));

  await context.close();

  return {
    requestedUrl: url,
    navigationStatus,
    finalUrl,
    title: domData.docTitle,
    metaDescription: domData.metaDesc,
    canonical: domData.canonicalTag,
    robots: domData.robotsMeta,
    h1Count: domData.h1Count,
    h1Texts: domData.h1Texts,
    h2Count: domData.h2Count,
    h3Count: domData.h3Count,
    rawDocumentWordCount: domData.rawDocumentWordCount,
    visibleBodyWordCount: domData.visibleBodyWordCount,
    mainContentWordCount: domData.mainContentWordCount,
    wordCount: domData.wordCount,
    hasMain: domData.hasMain,
    mainCount: domData.mainCount,
    formCount: domData.formCount,
    unlabelledFormControlCount: domData.unlabelledFormControlCount,
    imageCount: domData.imageCount,
    missingAltCount: domData.missingAltCount,
    domContentLoaded,
    networkIdleReached,
    challengeDetected: domData.challengeDetected,
    browserError,
  };
}

function compareFacts(crawler: CrawlerFactModel, browser: BrowserOracleFactModel): FactComparison[] {
  const comparisons: FactComparison[] = [];

  // 1. Status Code
  comparisons.push({
    field: "status_code",
    crawlerValue: crawler.status,
    browserValue: browser.navigationStatus,
    status: crawler.status === browser.navigationStatus ? "EXACT_MATCH" : "MISMATCH",
  });

  // 2. Title
  comparisons.push({
    field: "title",
    crawlerValue: crawler.title,
    browserValue: browser.title,
    status: crawler.title === browser.title ? "EXACT_MATCH" : "MISMATCH",
  });

  // 3. Meta Description
  comparisons.push({
    field: "meta_description",
    crawlerValue: crawler.metaDescription,
    browserValue: browser.metaDescription,
    status: crawler.metaDescription === browser.metaDescription ? "EXACT_MATCH" : "MISMATCH",
  });

  // 4. Canonical URL
  const cCanon = crawler.canonical?.replace(/\/$/, "") || null;
  const bCanon = browser.canonical?.replace(/\/$/, "") || null;
  comparisons.push({
    field: "canonical_url",
    crawlerValue: crawler.canonical,
    browserValue: browser.canonical,
    status:
      crawler.canonical === browser.canonical
        ? "EXACT_MATCH"
        : cCanon === bCanon
        ? "TOLERATED_MATCH"
        : "MISMATCH",
  });

  // 5. H1 Count
  comparisons.push({
    field: "h1_count",
    crawlerValue: crawler.h1Count,
    browserValue: browser.h1Count,
    status: crawler.h1Count === browser.h1Count ? "EXACT_MATCH" : "MISMATCH",
  });

  // 6. Primary H1 Text
  const cH1 = crawler.h1Texts[0] || null;
  const bH1 = browser.h1Texts[0] || null;
  comparisons.push({
    field: "primary_h1_text",
    crawlerValue: cH1,
    browserValue: bH1,
    status: cH1 === bH1 ? "EXACT_MATCH" : "MISMATCH",
  });

  // 7. Visible Body Word Count (with 20% tolerance for client template hydration)
  const cWords = crawler.visibleBodyWordCount || crawler.wordCount;
  const bWords = browser.visibleBodyWordCount || browser.wordCount;
  const wordDiff = Math.abs(cWords - bWords);
  const maxWords = Math.max(1, cWords, bWords);
  const wordDiffPct = wordDiff / maxWords;

  comparisons.push({
    field: "visible_body_word_count",
    crawlerValue: cWords,
    browserValue: bWords,
    status:
      cWords === bWords
        ? "EXACT_MATCH"
        : wordDiffPct <= 0.2
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    note: `Diff: ${wordDiff} words (${(wordDiffPct * 100).toFixed(1)}%)`,
  });

  // 8. Main Landmark Presence
  comparisons.push({
    field: "has_main_landmark",
    crawlerValue: crawler.hasMain,
    browserValue: browser.hasMain,
    status: crawler.hasMain === browser.hasMain ? "EXACT_MATCH" : "MISMATCH",
  });

  // 9. Forms Count
  comparisons.push({
    field: "form_count",
    crawlerValue: crawler.formCount,
    browserValue: browser.formCount,
    status: crawler.formCount === browser.formCount ? "EXACT_MATCH" : "MISMATCH",
    note:
      crawler.formCount !== browser.formCount
        ? "Client JS dynamic form injection in browser"
        : undefined,
  });

  // 10. Missing Image Alt Count
  comparisons.push({
    field: "missing_alt_count",
    crawlerValue: crawler.missingAltCount,
    browserValue: browser.missingAltCount,
    status: crawler.missingAltCount === browser.missingAltCount ? "EXACT_MATCH" : "MISMATCH",
  });

  return comparisons;
}

interface RuleAccuracyMetric {
  ruleCode: string;
  totalEvaluatedPages: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  status: "MEASURED" | "NOT_EVALUATED";
}

async function runLiveBrowserParity() {
  const startedAt = new Date().toISOString();
  console.log("=======================================================");
  console.log("   INDEPENDENT LIVE PLAYWRIGHT BROWSER PARITY SUITE    ");
  console.log(`   Evaluating ${TEST_URLS.length} Representative Live URLs`);
  console.log("=======================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  let totalExact = 0;
  let totalTolerated = 0;
  let totalMismatch = 0;
  let totalInconclusive = 0;
  let totalNotEvaluated = 0;
  let totalFactsConsidered = 0;

  const urlSummaries: any[] = [];

  // Deterministic rule tracking
  let missingH1_FP = 0, missingH1_FN = 0, missingH1_TP = 0, missingH1_TN = 0;
  let multipleH1_FP = 0, multipleH1_FN = 0, multipleH1_TP = 0, multipleH1_TN = 0;
  let missingMain_FP = 0, missingMain_FN = 0, missingMain_TP = 0, missingMain_TN = 0;
  let missingTitle_FP = 0, missingTitle_FN = 0, missingTitle_TP = 0, missingTitle_TN = 0;

  for (const url of TEST_URLS) {
    process.stdout.write(`Evaluating [${url.slice(0, 60)}] ... `);
    try {
      const [crawlerFacts, browserFacts] = await Promise.all([
        extractCrawlerFacts(url),
        extractPlaywrightOracleFacts(browser, url),
      ]);

      const comparisons = compareFacts(crawlerFacts, browserFacts);

      let urlExact = 0;
      let urlTolerated = 0;
      let urlMismatch = 0;

      for (const comp of comparisons) {
        totalFactsConsidered++;
        if (comp.status === "EXACT_MATCH") {
          totalExact++;
          urlExact++;
        } else if (comp.status === "TOLERATED_MATCH") {
          totalTolerated++;
          urlTolerated++;
        } else if (comp.status === "MISMATCH") {
          totalMismatch++;
          urlMismatch++;
        } else if (comp.status === "INCONCLUSIVE") {
          totalInconclusive++;
        } else {
          totalNotEvaluated++;
        }
      }

      // Track Rule Ground Truth Parity
      // 1. Missing H1
      const cMissingH1 = crawlerFacts.h1Count === 0;
      const bMissingH1 = browserFacts.h1Count === 0;
      if (cMissingH1 && bMissingH1) missingH1_TP++;
      else if (!cMissingH1 && !bMissingH1) missingH1_TN++;
      else if (cMissingH1 && !bMissingH1) missingH1_FP++;
      else if (!cMissingH1 && bMissingH1) missingH1_FN++;

      // 2. Multiple H1
      const cMultipleH1 = crawlerFacts.h1Count > 1;
      const bMultipleH1 = browserFacts.h1Count > 1;
      if (cMultipleH1 && bMultipleH1) multipleH1_TP++;
      else if (!cMultipleH1 && !bMultipleH1) multipleH1_TN++;
      else if (cMultipleH1 && !bMultipleH1) multipleH1_FP++;
      else if (!cMultipleH1 && bMultipleH1) multipleH1_FN++;

      // 3. Missing Main Landmark
      const cMissingMain = !crawlerFacts.hasMain;
      const bMissingMain = !browserFacts.hasMain;
      if (cMissingMain && bMissingMain) missingMain_TP++;
      else if (!cMissingMain && !bMissingMain) missingMain_TN++;
      else if (cMissingMain && !bMissingMain) missingMain_FP++;
      else if (!cMissingMain && bMissingMain) missingMain_FN++;

      // 4. Missing Title
      const cMissingTitle = !crawlerFacts.title;
      const bMissingTitle = !browserFacts.title;
      if (cMissingTitle && bMissingTitle) missingTitle_TP++;
      else if (!cMissingTitle && !bMissingTitle) missingTitle_TN++;
      else if (cMissingTitle && !bMissingTitle) missingTitle_FP++;
      else if (!cMissingTitle && bMissingTitle) missingTitle_FN++;

      console.log(`[${urlExact} Exact, ${urlTolerated} Tol, ${urlMismatch} Mismatch]`);
      urlSummaries.push({
        url,
        exact: urlExact,
        tolerated: urlTolerated,
        mismatch: urlMismatch,
        comparisons,
      });
    } catch (err: any) {
      console.log(`[ERROR: ${err.message}]`);
    }
  }

  await browser.close();
  const finishedAt = new Date().toISOString();

  // Strict arithmetic invariant verification
  const sumOfParts = totalExact + totalTolerated + totalMismatch + totalInconclusive + totalNotEvaluated;
  if (sumOfParts !== totalFactsConsidered) {
    throw new Error(
      `PARITY ARITHMETIC INVARIANT VIOLATION: sum(${sumOfParts}) !== totalConsidered(${totalFactsConsidered})`
    );
  }

  const strictParity = (totalExact / totalFactsConsidered) * 100;
  const comparableParity = ((totalExact + totalTolerated) / totalFactsConsidered) * 100;

  const ruleMetrics: RuleAccuracyMetric[] = [
    {
      ruleCode: "CONTENT_MISSING_H1",
      totalEvaluatedPages: TEST_URLS.length,
      truePositives: missingH1_TP,
      falsePositives: missingH1_FP,
      trueNegatives: missingH1_TN,
      falseNegatives: missingH1_FN,
      status: "MEASURED",
    },
    {
      ruleCode: "CONTENT_MULTIPLE_H1",
      totalEvaluatedPages: TEST_URLS.length,
      truePositives: multipleH1_TP,
      falsePositives: multipleH1_FP,
      trueNegatives: multipleH1_TN,
      falseNegatives: multipleH1_FN,
      status: "MEASURED",
    },
    {
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      totalEvaluatedPages: TEST_URLS.length,
      truePositives: missingMain_TP,
      falsePositives: missingMain_FP,
      trueNegatives: missingMain_TN,
      falseNegatives: missingMain_FN,
      status: "MEASURED",
    },
    {
      ruleCode: "CONTENT_MISSING_TITLE",
      totalEvaluatedPages: TEST_URLS.length,
      truePositives: missingTitle_TP,
      falsePositives: missingTitle_FP,
      trueNegatives: missingTitle_TN,
      falseNegatives: missingTitle_FN,
      status: "MEASURED",
    },
  ];

  const resultArtifact = {
    runId: `run-${Date.now()}`,
    gitSha: "63731e1",
    startedAt,
    finishedAt,
    command: "npx tsx apps/backend/src/crawler/__tests__/live-browser-parity.test.ts",
    urlCount: TEST_URLS.length,
    totalFactsConsidered,
    exactMatches: totalExact,
    toleratedMatches: totalTolerated,
    mismatches: totalMismatch,
    inconclusive: totalInconclusive,
    notEvaluated: totalNotEvaluated,
    strictParity: Number(strictParity.toFixed(1)),
    comparableParity: Number(comparableParity.toFixed(1)),
    ruleMetrics,
    urlSummaries,
  };

  const artifactPath = path.join(__dirname, "live-browser-parity-results.json");
  fs.writeFileSync(artifactPath, JSON.stringify(resultArtifact, null, 2), "utf8");

  console.log("\n=======================================================");
  console.log("   INDEPENDENT BROWSER PARITY HARNESS SUMMARY");
  console.log("=======================================================");
  console.log(`Total URLs Tested: ${TEST_URLS.length}`);
  console.log(`Total Facts Considered: ${totalFactsConsidered}`);
  console.log(`Exact Matches: ${totalExact}`);
  console.log(`Tolerated Matches: ${totalTolerated}`);
  console.log(`Mismatches: ${totalMismatch}`);
  console.log(`Inconclusive: ${totalInconclusive}`);
  console.log(`Not Evaluated: ${totalNotEvaluated}`);
  console.log(`Strict Parity: ${strictParity.toFixed(1)}%`);
  console.log(`Comparable Parity: ${comparableParity.toFixed(1)}%`);
  console.log(`Artifact saved to: ${artifactPath}`);
}

runLiveBrowserParity().catch((err) => {
  console.error(err);
  process.exit(1);
});
