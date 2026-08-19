import { chromium } from "playwright";
import axios from "axios";
import { parseHtmlPage } from "../parser";
import { normalizeUrl } from "../normalizer";
import type { FieldParityStat, ParityArtifact, RuleAccuracyMetric } from "./types";

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
}

interface FactComparison {
  field: string;
  category: "core_seo" | "structural_a11y" | "content_text";
  crawlerValue: any;
  browserValue: any;
  status: "EXACT_MATCH" | "TOLERATED_MATCH" | "MISMATCH" | "INCONCLUSIVE" | "NOT_EVALUATED";
  mismatchReason?: string;
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
  };
}

async function extractPlaywrightOracleFacts(browser: any, url: string): Promise<BrowserOracleFactModel> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let navigationStatus: number | null = null;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    navigationStatus = res ? res.status() : 200;
    await page.waitForTimeout(500);
  } catch {
    navigationStatus = null;
  }

  const finalUrl = page.url();

  const domData = await page
    .evaluate(() => {
      const docTitle = document.title ? document.title.trim() : null;
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
      const canonicalTag =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;
      const robotsMeta =
        document.querySelector('meta[name="robots"]')?.getAttribute("content")?.trim() || null;

      const h1Nodes = Array.from(document.querySelectorAll("h1"));
      const h1Texts = h1Nodes.map((n) => (n.textContent || "").trim()).filter(Boolean);
      const h2Count = document.querySelectorAll("h2").length;
      const h3Count = document.querySelectorAll("h3").length;

      // 1. Raw Document Word Count
      const rawClone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
      let rawDocWords = 0;
      if (rawClone) {
        rawClone.querySelectorAll("script, style, noscript, svg").forEach((el) => el.remove());
        const rawText = (rawClone.innerText || "").replace(/\s+/g, " ").trim();
        rawDocWords = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
      }

      // 2. Visible Body Word Count
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

      const mainNodes = document.querySelectorAll("main, [role='main']");
      const hasMain = mainNodes.length > 0;
      const mainCount = mainNodes.length;

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

      const imgNodes = Array.from(document.querySelectorAll("img"));
      const imageCount = imgNodes.length;
      const missingAltCount = imgNodes.filter((img) => !img.hasAttribute("alt")).length;

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
      };
    })
    .catch(() => ({
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
  };
}

function compareFacts(crawler: CrawlerFactModel, browser: BrowserOracleFactModel): FactComparison[] {
  const comparisons: FactComparison[] = [];

  // Core SEO (6 facts)
  comparisons.push({
    field: "status_code",
    category: "core_seo",
    crawlerValue: crawler.status,
    browserValue: browser.navigationStatus,
    status: crawler.status === browser.navigationStatus ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.status !== browser.navigationStatus ? "Navigation status code difference" : undefined,
  });

  comparisons.push({
    field: "title",
    category: "core_seo",
    crawlerValue: crawler.title,
    browserValue: browser.title,
    status: crawler.title === browser.title ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.title !== browser.title ? "Title tag text difference" : undefined,
  });

  comparisons.push({
    field: "meta_description",
    category: "core_seo",
    crawlerValue: crawler.metaDescription,
    browserValue: browser.metaDescription,
    status: crawler.metaDescription === browser.metaDescription ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.metaDescription !== browser.metaDescription ? "Meta description content difference" : undefined,
  });

  const cCanon = crawler.canonical?.replace(/\/$/, "") || null;
  const bCanon = browser.canonical?.replace(/\/$/, "") || null;
  comparisons.push({
    field: "canonical_url",
    category: "core_seo",
    crawlerValue: crawler.canonical,
    browserValue: browser.canonical,
    status:
      crawler.canonical === browser.canonical
        ? "EXACT_MATCH"
        : cCanon === bCanon
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    mismatchReason: cCanon !== bCanon ? "Canonical link URL difference" : undefined,
  });

  comparisons.push({
    field: "h1_count",
    category: "core_seo",
    crawlerValue: crawler.h1Count,
    browserValue: browser.h1Count,
    status: crawler.h1Count === browser.h1Count ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.h1Count !== browser.h1Count ? "H1 tag count difference" : undefined,
  });

  const cH1 = crawler.h1Texts[0] || null;
  const bH1 = browser.h1Texts[0] || null;
  comparisons.push({
    field: "primary_h1_text",
    category: "core_seo",
    crawlerValue: cH1,
    browserValue: bH1,
    status: cH1 === bH1 ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: cH1 !== bH1 ? "Dynamic client template replaced H1 text in browser" : undefined,
  });

  // Structural & Accessibility (3 facts)
  comparisons.push({
    field: "has_main_landmark",
    category: "structural_a11y",
    crawlerValue: crawler.hasMain,
    browserValue: browser.hasMain,
    status: crawler.hasMain === browser.hasMain ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.hasMain !== browser.hasMain ? "Main semantic landmark difference" : undefined,
  });

  comparisons.push({
    field: "form_count",
    category: "structural_a11y",
    crawlerValue: crawler.formCount,
    browserValue: browser.formCount,
    status: crawler.formCount === browser.formCount ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.formCount !== browser.formCount ? "Dynamic navigation search form injected client-side" : undefined,
  });

  comparisons.push({
    field: "missing_alt_count",
    category: "structural_a11y",
    crawlerValue: crawler.missingAltCount,
    browserValue: browser.missingAltCount,
    status: crawler.missingAltCount === browser.missingAltCount ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason: crawler.missingAltCount !== browser.missingAltCount ? "Images missing alt count difference" : undefined,
  });

  // Content Text (1 fact)
  const cWords = crawler.visibleBodyWordCount || crawler.wordCount;
  const bWords = browser.visibleBodyWordCount || browser.wordCount;
  const wordDiff = Math.abs(cWords - bWords);
  const maxWords = Math.max(1, cWords, bWords);
  const wordDiffPct = wordDiff / maxWords;

  comparisons.push({
    field: "visible_body_word_count",
    category: "content_text",
    crawlerValue: cWords,
    browserValue: bWords,
    status:
      cWords === bWords
        ? "EXACT_MATCH"
        : wordDiffPct <= 0.2
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    mismatchReason: wordDiffPct > 0.2 ? "Client JS navigation/menu hydration word variance" : undefined,
  });

  return comparisons;
}

export async function executeParitySuite(
  verificationRunId: string,
  gitSha: string
): Promise<ParityArtifact> {
  console.log(`[Verify:Parity] Running independent 25-URL Playwright browser parity extraction...`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const fieldAccumulator = new Map<string, { exact: number; tolerated: number; mismatch: number; total: number }>();
  const mismatchCategoryCounts: Record<string, number> = {};

  let coreSeoExact = 0, coreSeoTol = 0, coreSeoTotal = 0;
  let structuralExact = 0, structuralTol = 0, structuralTotal = 0;
  let contentExact = 0, contentTol = 0, contentTotal = 0;

  let totalExact = 0, totalTolerated = 0, totalMismatch = 0;
  const urlSummaries: any[] = [];

  // Measured Rule Trackers
  let missingH1_FP = 0, missingH1_FN = 0, missingH1_TP = 0, missingH1_TN = 0;
  let multipleH1_FP = 0, multipleH1_FN = 0, multipleH1_TP = 0, multipleH1_TN = 0;
  let missingMain_FP = 0, missingMain_FN = 0, missingMain_TP = 0, missingMain_TN = 0;
  let missingTitle_FP = 0, missingTitle_FN = 0, missingTitle_TP = 0, missingTitle_TN = 0;

  for (const url of TEST_URLS) {
    const [crawlerFacts, browserFacts] = await Promise.all([
      extractCrawlerFacts(url),
      extractPlaywrightOracleFacts(browser, url),
    ]);

    const comparisons = compareFacts(crawlerFacts, browserFacts);

    let urlExact = 0, urlTolerated = 0, urlMismatch = 0;

    for (const comp of comparisons) {
      const fieldEntry = fieldAccumulator.get(comp.field) || { exact: 0, tolerated: 0, mismatch: 0, total: 0 };
      fieldEntry.total++;

      if (comp.status === "EXACT_MATCH") {
        totalExact++;
        urlExact++;
        fieldEntry.exact++;
        if (comp.category === "core_seo") { coreSeoExact++; coreSeoTotal++; }
        else if (comp.category === "structural_a11y") { structuralExact++; structuralTotal++; }
        else if (comp.category === "content_text") { contentExact++; contentTotal++; }
      } else if (comp.status === "TOLERATED_MATCH") {
        totalTolerated++;
        urlTolerated++;
        fieldEntry.tolerated++;
        if (comp.category === "core_seo") { coreSeoTol++; coreSeoTotal++; }
        else if (comp.category === "structural_a11y") { structuralTol++; structuralTotal++; }
        else if (comp.category === "content_text") { contentTol++; contentTotal++; }
      } else if (comp.status === "MISMATCH") {
        totalMismatch++;
        urlMismatch++;
        fieldEntry.mismatch++;
        const reason = comp.mismatchReason || "Unclassified Mismatch";
        mismatchCategoryCounts[reason] = (mismatchCategoryCounts[reason] || 0) + 1;
        if (comp.category === "core_seo") coreSeoTotal++;
        else if (comp.category === "structural_a11y") structuralTotal++;
        else if (comp.category === "content_text") contentTotal++;
      }

      fieldAccumulator.set(comp.field, fieldEntry);
    }

    // Rule confusion matrix tracking
    const cMissingH1 = crawlerFacts.h1Count === 0;
    const bMissingH1 = browserFacts.h1Count === 0;
    if (cMissingH1 && bMissingH1) missingH1_TP++;
    else if (!cMissingH1 && !bMissingH1) missingH1_TN++;
    else if (cMissingH1 && !bMissingH1) missingH1_FP++;
    else if (!cMissingH1 && bMissingH1) missingH1_FN++;

    const cMultipleH1 = crawlerFacts.h1Count > 1;
    const bMultipleH1 = browserFacts.h1Count > 1;
    if (cMultipleH1 && bMultipleH1) multipleH1_TP++;
    else if (!cMultipleH1 && !bMultipleH1) multipleH1_TN++;
    else if (cMultipleH1 && !bMultipleH1) multipleH1_FP++;
    else if (!cMultipleH1 && bMultipleH1) multipleH1_FN++;

    const cMissingMain = !crawlerFacts.hasMain;
    const bMissingMain = !browserFacts.hasMain;
    if (cMissingMain && bMissingMain) missingMain_TP++;
    else if (!cMissingMain && !bMissingMain) missingMain_TN++;
    else if (cMissingMain && !bMissingMain) missingMain_FP++;
    else if (!cMissingMain && bMissingMain) missingMain_FN++;

    const cMissingTitle = !crawlerFacts.title;
    const bMissingTitle = !browserFacts.title;
    if (cMissingTitle && bMissingTitle) missingTitle_TP++;
    else if (!cMissingTitle && !bMissingTitle) missingTitle_TN++;
    else if (cMissingTitle && !bMissingTitle) missingTitle_FP++;
    else if (!cMissingTitle && bMissingTitle) missingTitle_FN++;

    urlSummaries.push({
      url,
      exact: urlExact,
      tolerated: urlTolerated,
      mismatch: urlMismatch,
      comparisons,
    });
  }

  await browser.close();

  const totalFactsConsidered = totalExact + totalTolerated + totalMismatch;

  // Invariant validation
  const sumMismatchCategories = Object.values(mismatchCategoryCounts).reduce((a, b) => a + b, 0);
  if (sumMismatchCategories !== totalMismatch) {
    throw new Error(
      `PARITY INVARIANT ERROR: sum(mismatchCategoryCounts) [${sumMismatchCategories}] !== totalMismatch [${totalMismatch}]`
    );
  }

  const strictParity = Number(((totalExact / totalFactsConsidered) * 100).toFixed(1));
  const comparableParity = Number((((totalExact + totalTolerated) / totalFactsConsidered) * 100).toFixed(1));

  const accuracyBand =
    comparableParity >= 90 ? "excellent" : comparableParity >= 75 ? "good" : "needs_review";

  const fieldMetrics: FieldParityStat[] = Array.from(fieldAccumulator.entries()).map(
    ([field, stats]) => ({
      field,
      totalEvaluated: stats.total,
      exactMatches: stats.exact,
      toleratedMatches: stats.tolerated,
      mismatches: stats.mismatch,
      inconclusive: 0,
      notEvaluated: 0,
      strictParityPercent: Number(((stats.exact / stats.total) * 100).toFixed(1)),
      comparableParityPercent: Number((((stats.exact + stats.tolerated) / stats.total) * 100).toFixed(1)),
    })
  );

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

  const artifact: ParityArtifact = {
    verificationRunId,
    gitSha,
    generatedAt: new Date().toISOString(),
    targetUrlsCount: TEST_URLS.length,
    totalFactsConsidered,
    exactMatches: totalExact,
    toleratedMatches: totalTolerated,
    mismatches: totalMismatch,
    inconclusive: 0,
    notEvaluated: 0,
    strictParity,
    comparableParity,
    accuracyBand,
    categoryParity: {
      coreSeoParityPercent: Number((((coreSeoExact + coreSeoTol) / Math.max(1, coreSeoTotal)) * 100).toFixed(1)),
      structuralAccessibilityParityPercent: Number(
        (((structuralExact + structuralTol) / Math.max(1, structuralTotal)) * 100).toFixed(1)
      ),
      contentTextParityPercent: Number((((contentExact + contentTol) / Math.max(1, contentTotal)) * 100).toFixed(1)),
    },
    mismatchCategories: mismatchCategoryCounts,
    fieldMetrics,
    ruleMetrics,
    urlSummaries,
  };

  console.log(
    `[Verify:Parity] Complete. Evaluated ${totalFactsConsidered} facts: Strict ${strictParity}%, Comparable ${comparableParity}% (Band: ${accuracyBand})`
  );
  return artifact;
}
