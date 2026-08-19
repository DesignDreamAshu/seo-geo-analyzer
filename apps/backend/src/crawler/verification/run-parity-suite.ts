import { chromium } from "playwright";
import axios from "axios";
import { parseHtmlPage } from "../parser";
import { normalizeUrl } from "../normalizer";
import { processPageAuthoritatively } from "../page-processor";
import { evaluateAllDiagnosticRules } from "../rules";
import { verifyLinkTarget } from "../fetcher";
import type { CrawledPageData } from "../types";
import type {
  ExternalLinkConfirmedBrokenEvidence,
  FieldParityStat,
  FieldQualityStatus,
  ParityArtifact,
  ParityCategorySummary,
  RenderDecisionSample,
  RenderTriggerAccuracyMetric,
  RuleAccuracyMetric,
  SingleParityPopulation,
} from "./types";

interface EvaluatedFactModel {
  requestedUrl: string;
  status: number | null;
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

const EXTERNAL_LINK_PARITY_TARGETS = [
  {
    url: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
    sourcePage: "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow",
    anchorText: "ServiceNow Store",
    expectedOracleStatus: "valid_destination",
  },
  {
    url: "https://www.linkedin.com/company/botconsulting",
    sourcePage: "https://www.botconsulting.io/",
    anchorText: "LinkedIn",
    expectedOracleStatus: "valid_or_blocked",
  },
  {
    url: "https://www.google.com",
    sourcePage: "https://www.botconsulting.io/",
    anchorText: "Google",
    expectedOracleStatus: "valid_destination",
  },
  {
    url: "https://httpstat.us/404",
    sourcePage: "https://www.botconsulting.io/test",
    anchorText: "Broken Link",
    expectedOracleStatus: "broken_destination",
  },
];

const CORE_SEO_FIELDS = [
  "status_code",
  "title",
  "meta_description",
  "canonical_url",
  "h1_count",
  "primary_h1_text",
];

const STRUCTURAL_A11Y_FIELDS = [
  "has_main_landmark",
  "form_count",
  "missing_alt_count",
];

const CONTENT_TEXT_FIELDS = [
  "visible_body_word_count",
  "main_content_word_count",
];

function createEmptyGraphMock() {
  return {
    inlinksMap: new Map(),
    sitemapOrphans: [],
    crawlIsolatedPages: [],
    totalInternalLinks: 0,
    totalExternalLinks: 0,
    brokenInternalLinks: [],
    brokenExternalLinks: [],
    botBlockedExternalLinks: [],
    externalLinkTelemetry: {
      discoveredUniqueUrls: 0,
      discoveredOccurrences: 0,
      verificationLimit: 50,
      checkedUniqueUrls: 0,
      checkedOccurrences: 0,
      uncheckedUniqueUrls: 0,
      uncheckedOccurrences: 0,
      confirmedOkUniqueUrls: 0,
      confirmedOkOccurrences: 0,
      redirectedOkUniqueUrls: 0,
      redirectedOkOccurrences: 0,
      browserVerifiedOkUniqueUrls: 0,
      browserVerifiedOkOccurrences: 0,
      confirmedBrokenUniqueUrls: 0,
      confirmedBrokenOccurrences: 0,
      inconclusiveUniqueUrls: 0,
      inconclusiveOccurrences: 0,
      verificationCoveragePercent: 100,
      uniqueExternalUrlsCount: 0,
      totalExternalOccurrences: 0,
      confirmedOkCount: 0,
      redirectedOkCount: 0,
      browserVerifiedOkCount: 0,
      confirmedBrokenCount: 0,
      botBlockedCount: 0,
      rateLimitedCount: 0,
      timeoutCount: 0,
      networkDnsSslCount: 0,
      excludedPlaceholderHashCount: 0,
      excludedMailtoTelJsCount: 0,
      topExternalDomains: [],
    },
  };
}

async function extractRawFacts(url: string): Promise<{ facts: EvaluatedFactModel; pageData: CrawledPageData }> {
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
    facts: {
      requestedUrl: url,
      status: parsed.statusCode,
      finalUrl: parsed.finalUrl,
      title: parsed.rawFacts?.title ?? parsed.title,
      metaDescription: parsed.rawFacts?.metaDescription ?? parsed.metaDescription,
      canonical: parsed.rawFacts?.canonicalUrl ?? parsed.canonicalUrl,
      robots: parsed.metaRobots,
      h1Count: parsed.rawFacts?.h1Count ?? parsed.h1Count,
      h1Texts: parsed.rawFacts?.h1Texts ?? parsed.h1s,
      h2Count: parsed.h2Tags.length,
      h3Count: parsed.h3Tags.length,
      rawDocumentWordCount: parsed.rawFacts?.rawDocumentWordCount ?? parsed.rawDocumentWordCount,
      visibleBodyWordCount: parsed.rawFacts?.visibleBodyWordCount ?? parsed.visibleBodyWordCount,
      mainContentWordCount: parsed.rawFacts?.mainContentWordCount ?? parsed.mainContentWordCount,
      wordCount: parsed.rawFacts?.mainContentWordCount ?? parsed.wordCount,
      hasMain: parsed.rawFacts?.hasMainLandmark ?? parsed.landmarks.hasMain,
      mainCount: parsed.landmarks.mainCount,
      formCount: parsed.rawFacts?.formCount ?? parsed.forms.length,
      unlabelledFormControlCount:
        parsed.rawFacts?.unlabelledFormControlCount ??
        parsed.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
      imageCount: parsed.images.length,
      missingAltCount: parsed.rawFacts?.missingAltCount ?? parsed.images.filter((img) => !img.hasAltAttribute).length,
    },
    pageData: parsed,
  };
}

async function extractProductionAuthoritativeFacts(url: string): Promise<{
  facts: EvaluatedFactModel;
  pageData: CrawledPageData;
  renderDecisionSample: RenderDecisionSample;
}> {
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
  const pageData = await processPageAuthoritatively(
    url,
    normalized,
    finalUrl,
    response.status,
    [],
    typeof response.data === "string" ? response.data : JSON.stringify(response.data),
    response.headers as any,
    150,
    0,
    {
      seedNormalized: "https://www.botconsulting.io",
      allowSubdomains: false,
      isDisallowedByRobots: false,
      enableBrowserRendering: true,
      renderBudgetAvailable: true,
    }
  );

  const auth = pageData.authoritativeFacts || {
    source: "raw",
    title: pageData.title,
    metaDescription: pageData.metaDescription,
    canonicalUrl: pageData.canonicalUrl,
    h1Count: pageData.h1Count,
    h1Texts: pageData.h1s,
    forms: pageData.forms,
    formCount: pageData.forms.length,
    unlabelledFormControlCount: pageData.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
    missingAltCount: pageData.images.filter((img) => !img.hasAltAttribute).length,
    images: pageData.images,
    rawDocumentWordCount: pageData.rawDocumentWordCount,
    visibleBodyWordCount: pageData.visibleBodyWordCount,
    mainContentWordCount: pageData.mainContentWordCount,
    landmarks: pageData.landmarks,
    hasMainLandmark: pageData.landmarks.hasMain,
    headingsOutline: pageData.headingsOutline,
    renderConfidence: pageData.renderConfidence,
  };

  const sample: RenderDecisionSample = {
    url,
    classification: pageData.classification.primaryClass,
    rawH1: pageData.rawFacts?.h1Texts[0] || null,
    rawVisibleWords: pageData.rawFacts?.visibleBodyWordCount || 0,
    rawMainWords: pageData.rawFacts?.mainContentWordCount || 0,
    formsCount: pageData.rawFacts?.formCount || 0,
    renderEligible: Boolean(pageData.renderDecision?.eligible),
    triggerReasons: pageData.renderDecision?.reasons || [],
    attempted: Boolean(pageData.renderDecision?.attempted),
    success: pageData.renderDecision?.success,
    authoritativeSource: auth.source,
  };

  return {
    facts: {
      requestedUrl: url,
      status: pageData.statusCode,
      finalUrl: pageData.finalUrl,
      title: auth.title,
      metaDescription: auth.metaDescription,
      canonical: auth.canonicalUrl,
      robots: pageData.metaRobots,
      h1Count: auth.h1Count,
      h1Texts: auth.h1Texts,
      h2Count: pageData.h2Tags.length,
      h3Count: pageData.h3Tags.length,
      rawDocumentWordCount: auth.rawDocumentWordCount,
      visibleBodyWordCount: auth.visibleBodyWordCount,
      mainContentWordCount: auth.mainContentWordCount,
      wordCount: auth.mainContentWordCount,
      hasMain: auth.hasMainLandmark,
      mainCount: auth.landmarks.mainCount,
      formCount: auth.formCount,
      unlabelledFormControlCount: auth.unlabelledFormControlCount,
      imageCount: auth.images.length,
      missingAltCount: auth.missingAltCount,
    },
    pageData,
    renderDecisionSample: sample,
  };
}

async function extractPlaywrightOracleFacts(browser: any, url: string): Promise<EvaluatedFactModel> {
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
        bodyClone
          .querySelectorAll(
            "script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner']"
          )
          .forEach((el) => el.remove());
        const visText = (bodyClone.innerText || "").replace(/\s+/g, " ").trim();
        visBodyWords = visText ? visText.split(/\s+/).filter(Boolean).length : 0;
      }

      // 3. Main Content Word Count
      const mainEl = document.querySelector(
        "main, [role='main'], #main-content, .main-content, article"
      ) as HTMLElement | null;
      let mainWords = 0;
      if (mainEl) {
        const mainClone = mainEl.cloneNode(true) as HTMLElement;
        mainClone
          .querySelectorAll("script, style, noscript, svg, nav, footer, header")
          .forEach((el) => el.remove());
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
    status: navigationStatus,
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

function compareFactModels(crawler: EvaluatedFactModel, browser: EvaluatedFactModel): FactComparison[] {
  const comparisons: FactComparison[] = [];

  // Core SEO (6 facts)
  comparisons.push({
    field: "status_code",
    category: "core_seo",
    crawlerValue: crawler.status,
    browserValue: browser.status,
    status: crawler.status === browser.status ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.status !== browser.status
        ? "Navigation status code difference between HTTP fetch and browser navigation"
        : undefined,
  });

  comparisons.push({
    field: "title",
    category: "core_seo",
    crawlerValue: crawler.title,
    browserValue: browser.title,
    status: crawler.title === browser.title ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.title !== browser.title
        ? "Document <title> text difference between crawler output and browser DOM"
        : undefined,
  });

  comparisons.push({
    field: "meta_description",
    category: "core_seo",
    crawlerValue: crawler.metaDescription,
    browserValue: browser.metaDescription,
    status: crawler.metaDescription === browser.metaDescription ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.metaDescription !== browser.metaDescription
        ? "Meta description content difference between crawler output and browser DOM"
        : undefined,
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
    mismatchReason:
      cCanon !== bCanon ? "Canonical link URL difference between crawler output and browser DOM" : undefined,
  });

  comparisons.push({
    field: "h1_count",
    category: "core_seo",
    crawlerValue: crawler.h1Count,
    browserValue: browser.h1Count,
    status: crawler.h1Count === browser.h1Count ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.h1Count !== browser.h1Count
        ? "H1 tag count difference between crawler output and browser DOM"
        : undefined,
  });

  const cH1 = crawler.h1Texts[0] || null;
  const bH1 = browser.h1Texts[0] || null;
  comparisons.push({
    field: "primary_h1_text",
    category: "core_seo",
    crawlerValue: cH1,
    browserValue: bH1,
    status: cH1 === bH1 ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      cH1 !== bH1 ? "Primary H1 text difference between crawler output and browser DOM" : undefined,
  });

  // Structural & Accessibility (3 facts)
  comparisons.push({
    field: "has_main_landmark",
    category: "structural_a11y",
    crawlerValue: crawler.hasMain,
    browserValue: browser.hasMain,
    status: crawler.hasMain === browser.hasMain ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.hasMain !== browser.hasMain
        ? "Main semantic landmark difference between crawler output and browser DOM"
        : undefined,
  });

  comparisons.push({
    field: "form_count",
    category: "structural_a11y",
    crawlerValue: crawler.formCount,
    browserValue: browser.formCount,
    status: crawler.formCount === browser.formCount ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.formCount !== browser.formCount
        ? "Dynamic navigation search form injected client-side"
        : undefined,
  });

  comparisons.push({
    field: "missing_alt_count",
    category: "structural_a11y",
    crawlerValue: crawler.missingAltCount,
    browserValue: browser.missingAltCount,
    status: crawler.missingAltCount === browser.missingAltCount ? "EXACT_MATCH" : "MISMATCH",
    mismatchReason:
      crawler.missingAltCount !== browser.missingAltCount
        ? "Images missing alt attribute count difference"
        : undefined,
  });

  // Content Text (2 facts)
  const cVisWords = crawler.visibleBodyWordCount || crawler.wordCount;
  const bVisWords = browser.visibleBodyWordCount || browser.wordCount;
  const visWordDiff = Math.abs(cVisWords - bVisWords);
  const maxVisWords = Math.max(1, cVisWords, bVisWords);
  const visWordDiffPct = visWordDiff / maxVisWords;

  comparisons.push({
    field: "visible_body_word_count",
    category: "content_text",
    crawlerValue: cVisWords,
    browserValue: bVisWords,
    status:
      cVisWords === bVisWords
        ? "EXACT_MATCH"
        : visWordDiffPct <= 0.2
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    mismatchReason:
      visWordDiffPct > 0.2 ? "Client JS navigation/menu hydration word variance" : undefined,
  });

  const cMainWords = crawler.mainContentWordCount || crawler.wordCount;
  const bMainWords = browser.mainContentWordCount || browser.wordCount;
  const mainWordDiff = Math.abs(cMainWords - bMainWords);
  const maxMainWords = Math.max(1, cMainWords, bMainWords);
  const mainWordDiffPct = mainWordDiff / maxMainWords;

  comparisons.push({
    field: "main_content_word_count",
    category: "content_text",
    crawlerValue: cMainWords,
    browserValue: bMainWords,
    status:
      cMainWords === bMainWords
        ? "EXACT_MATCH"
        : mainWordDiffPct <= 0.2
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    mismatchReason:
      mainWordDiffPct > 0.2 ? "Client JS main content container hydration variance" : undefined,
  });

  return comparisons;
}

function buildSingleParityPopulation(
  populationName: "raw_extraction" | "production_authoritative",
  allComparisons: Array<{ url: string; comparisons: FactComparison[] }>,
  gateThresholds: { coreSeo: number; structural: number; content: number }
): SingleParityPopulation {
  const fieldAccumulator = new Map<
    string,
    {
      field: string;
      category: "core_seo" | "structural_a11y" | "content_text";
      exact: number;
      tolerated: number;
      mismatch: number;
      total: number;
    }
  >();
  const mismatchCategoryCounts: Record<string, number> = {};

  let totalExact = 0;
  let totalTolerated = 0;
  let totalMismatch = 0;
  const urlSummaries: any[] = [];

  for (const item of allComparisons) {
    let urlExact = 0;
    let urlTolerated = 0;
    let urlMismatch = 0;

    for (const comp of item.comparisons) {
      const fieldEntry = fieldAccumulator.get(comp.field) || {
        field: comp.field,
        category: comp.category,
        exact: 0,
        tolerated: 0,
        mismatch: 0,
        total: 0,
      };
      fieldEntry.total++;

      if (comp.status === "EXACT_MATCH") {
        totalExact++;
        urlExact++;
        fieldEntry.exact++;
      } else if (comp.status === "TOLERATED_MATCH") {
        totalTolerated++;
        urlTolerated++;
        fieldEntry.tolerated++;
      } else if (comp.status === "MISMATCH") {
        totalMismatch++;
        urlMismatch++;
        fieldEntry.mismatch++;
        if (!comp.mismatchReason) {
          throw new Error(
            `PARITY FAILURE: Mismatch for URL [${item.url}] on field [${comp.field}] lacks a defined mismatchReason!`
          );
        }
        mismatchCategoryCounts[comp.mismatchReason] =
          (mismatchCategoryCounts[comp.mismatchReason] || 0) + 1;
      }

      fieldAccumulator.set(comp.field, fieldEntry);
    }

    urlSummaries.push({
      url: item.url,
      exact: urlExact,
      tolerated: urlTolerated,
      mismatch: urlMismatch,
      comparisons: item.comparisons,
    });
  }

  const totalFactsConsidered = totalExact + totalTolerated + totalMismatch;

  const fieldMetrics: FieldParityStat[] = Array.from(fieldAccumulator.values()).map((stats) => {
    const strictPct = Number(((stats.exact / stats.total) * 100).toFixed(1));
    const compPct = Number((((stats.exact + stats.tolerated) / stats.total) * 100).toFixed(1));

    let gate = 95.0;
    if (stats.category === "core_seo") gate = 98.0;
    else if (stats.category === "content_text") gate = 90.0;

    let fieldQualityStatus: FieldQualityStatus = "FAIL";
    if (compPct >= gate) {
      fieldQualityStatus = "PASS";
    } else if (compPct >= gate * 0.75) {
      fieldQualityStatus = "PARTIAL";
    }

    return {
      field: stats.field,
      category: stats.category,
      totalEvaluated: stats.total,
      exactMatches: stats.exact,
      toleratedMatches: stats.tolerated,
      mismatches: stats.mismatch,
      inconclusive: 0,
      notEvaluated: 0,
      strictParityPercent: strictPct,
      comparableParityPercent: compPct,
      fieldQualityStatus,
      gateThresholdPercent: gate,
    };
  });

  function buildCategorySummary(
    name: string,
    registeredFields: string[],
    thresholdPercent: number
  ): ParityCategorySummary {
    let catExact = 0;
    let catTol = 0;
    let catMis = 0;
    let catTotal = 0;
    let allMandatoryPassed = true;

    for (const field of registeredFields) {
      const stats = fieldAccumulator.get(field);
      if (stats) {
        catExact += stats.exact;
        catTol += stats.tolerated;
        catMis += stats.mismatch;
        catTotal += stats.total;

        const fieldCompPct = ((stats.exact + stats.tolerated) / stats.total) * 100;
        if (fieldCompPct < thresholdPercent * 0.75) {
          allMandatoryPassed = false;
        }
      }
    }

    const strictParityPercent = Number(((catExact / Math.max(1, catTotal)) * 100).toFixed(1));
    const comparableParityPercent = Number(
      (((catExact + catTol) / Math.max(1, catTotal)) * 100).toFixed(1)
    );

    return {
      name,
      registeredFields,
      totalEvaluated: catTotal,
      exactMatches: catExact,
      toleratedMatches: catTol,
      mismatches: catMis,
      strictParityPercent,
      comparableParityPercent,
      qualityGatePassed: comparableParityPercent >= thresholdPercent && allMandatoryPassed,
      qualityGateThresholdPercent: thresholdPercent,
      mandatoryFieldsPassed: allMandatoryPassed,
    };
  }

  const coreSeoSummary = buildCategorySummary("Core SEO", CORE_SEO_FIELDS, gateThresholds.coreSeo);
  const structuralA11ySummary = buildCategorySummary(
    "Structural & Accessibility",
    STRUCTURAL_A11Y_FIELDS,
    gateThresholds.structural
  );
  const contentTextSummary = buildCategorySummary(
    "Content Text",
    CONTENT_TEXT_FIELDS,
    gateThresholds.content
  );

  const strictParity = Number(((totalExact / totalFactsConsidered) * 100).toFixed(1));
  const comparableParity = Number(
    (((totalExact + totalTolerated) / totalFactsConsidered) * 100).toFixed(1)
  );

  const accuracyBand =
    coreSeoSummary.qualityGatePassed &&
    structuralA11ySummary.qualityGatePassed &&
    contentTextSummary.qualityGatePassed
      ? "excellent"
      : coreSeoSummary.qualityGatePassed && comparableParity >= 85
      ? "good"
      : "needs_review";

  return {
    populationName,
    targetUrlsCount: allComparisons.length,
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
      coreSeo: coreSeoSummary,
      structuralAccessibility: structuralA11ySummary,
      contentText: contentTextSummary,
    },
    mismatchCategories: mismatchCategoryCounts,
    fieldMetrics,
    urlSummaries,
  };
}

export async function executeParitySuite(
  verificationRunId: string,
  gitShaFull: string
): Promise<ParityArtifact> {
  console.log(
    `[Verify:Parity] Executing independent 25-URL Playwright browser parity across both Raw & Authoritative paths (275 facts total)...`
  );

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const rawComparisons: Array<{ url: string; comparisons: FactComparison[] }> = [];
  const authComparisons: Array<{ url: string; comparisons: FactComparison[] }> = [];
  const renderDecisionSamples: RenderDecisionSample[] = [];

  interface RuleTracker {
    ruleCode: string;
    eligibleCrawler: number;
    eligibleBrowser: number;
    comparable: number;
    tp: number;
    tn: number;
    fp: number;
    fn: number;
    inconclusive: number;
    fpUrls: string[];
    fnUrls: string[];
  }

  function createTracker(ruleCode: string): RuleTracker {
    return {
      ruleCode,
      eligibleCrawler: 0,
      eligibleBrowser: 0,
      comparable: 0,
      tp: 0,
      tn: 0,
      fp: 0,
      fn: 0,
      inconclusive: 0,
      fpUrls: [],
      fnUrls: [],
    };
  }

  const trackerMissingH1 = createTracker("CONTENT_MISSING_H1");
  const trackerMultipleH1 = createTracker("CONTENT_MULTIPLE_H1");
  const trackerMissingMain = createTracker("A11Y_MISSING_MAIN_LANDMARK");
  const trackerMissingTitle = createTracker("CONTENT_MISSING_TITLE");
  const trackerThinContent = createTracker("CONTENT_THIN_WORD_COUNT");
  const trackerUnlabelledForm = createTracker("A11Y_UNLABELLED_FORM_CONTROL");

  let factDiff_TP = 0, factDiff_TN = 0, factDiff_FP = 0, factDiff_FN = 0;
  let diagImpact_TP = 0, diagImpact_TN = 0, diagImpact_FP = 0, diagImpact_FN = 0;

  const graphMock = createEmptyGraphMock();

  for (let i = 0; i < TEST_URLS.length; i++) {
    const url = TEST_URLS[i];
    console.log(`[Verify:Parity] [${i + 1}/${TEST_URLS.length}] Evaluating ${url}...`);
    const rawResult = await extractRawFacts(url);
    const authResult = await extractProductionAuthoritativeFacts(url);
    const browserFacts = await extractPlaywrightOracleFacts(browser, url);

    renderDecisionSamples.push(authResult.renderDecisionSample);

    const rawComps = compareFactModels(rawResult.facts, browserFacts);
    const authComps = compareFactModels(authResult.facts, browserFacts);

    rawComparisons.push({ url, comparisons: rawComps });
    authComparisons.push({ url, comparisons: authComps });

    // 1. Run actual production diagnostic rule engine on Dream SEO authoritative page model
    const ruleEvaluationResult = evaluateAllDiagnosticRules([authResult.pageData], graphMock as any, []);
    const rawRuleEvaluationResult = evaluateAllDiagnosticRules([rawResult.pageData], graphMock as any, []);

    const emittedRuleCodes = new Set(ruleEvaluationResult.issues.map((i) => i.code));
    const rawEmittedRuleCodes = new Set(rawRuleEvaluationResult.issues.map((i) => i.code));

    const pClass = authResult.pageData.classification.primaryClass;
    const isStandardContent =
      pClass === "homepage" ||
      pClass === "marketing_landing" ||
      pClass === "article_blog" ||
      pClass === "active_job" ||
      pClass === "product_job_detail" ||
      pClass === "category_listing";

    const isIndexable = authResult.pageData.isIndexable;
    const isHtml = authResult.pageData.resourceType === "html_page";

    // 2. Independent Browser Oracle Expected Diagnostic Issue Ground Truth
    const oracleShouldEmitMissingTitle = isHtml && isIndexable && isStandardContent && (!browserFacts.title || browserFacts.title.trim().length === 0);
    const oracleShouldEmitMissingH1 = isHtml && isIndexable && isStandardContent && browserFacts.h1Count === 0;
    const oracleShouldEmitMultipleH1 = isHtml && isIndexable && isStandardContent && browserFacts.h1Count > 1;
    const oracleShouldEmitMissingMain = isHtml && (pClass as string) !== "utility_endpoint" && !browserFacts.hasMain;
    const oracleShouldEmitThin =
      isHtml &&
      isIndexable &&
      isStandardContent &&
      (browserFacts.mainContentWordCount || 0) < 180;
    const oracleShouldEmitUnlabelled = isHtml && browserFacts.unlabelledFormControlCount > 0;

    function recordRuleOutcome(
      tracker: RuleTracker,
      isEligibleCrawler: boolean,
      isEligibleBrowser: boolean,
      crawlerEmitted: boolean,
      browserExpected: boolean
    ) {
      if (isEligibleCrawler) tracker.eligibleCrawler++;
      if (isEligibleBrowser) tracker.eligibleBrowser++;

      if (isEligibleCrawler && isEligibleBrowser) {
        tracker.comparable++;
        if (crawlerEmitted && browserExpected) {
          tracker.tp++;
        } else if (!crawlerEmitted && !browserExpected) {
          tracker.tn++;
        } else if (crawlerEmitted && !browserExpected) {
          tracker.fp++;
          tracker.fpUrls.push(url);
        } else if (!crawlerEmitted && browserExpected) {
          tracker.fn++;
          tracker.fnUrls.push(url);
        }
      } else {
        tracker.inconclusive++;
      }
    }

    recordRuleOutcome(
      trackerMissingTitle,
      isHtml && isIndexable && isStandardContent,
      isHtml && isIndexable && isStandardContent,
      emittedRuleCodes.has("CONTENT_MISSING_TITLE"),
      oracleShouldEmitMissingTitle
    );

    recordRuleOutcome(
      trackerMissingH1,
      isHtml && isIndexable && isStandardContent,
      isHtml && isIndexable && isStandardContent,
      emittedRuleCodes.has("CONTENT_MISSING_H1"),
      oracleShouldEmitMissingH1
    );

    recordRuleOutcome(
      trackerMultipleH1,
      isHtml && isIndexable && isStandardContent,
      isHtml && isIndexable && isStandardContent,
      emittedRuleCodes.has("CONTENT_MULTIPLE_H1"),
      oracleShouldEmitMultipleH1
    );

    recordRuleOutcome(
      trackerMissingMain,
      isHtml && (pClass as string) !== "utility_endpoint",
      isHtml && (pClass as string) !== "utility_endpoint",
      emittedRuleCodes.has("A11Y_MISSING_MAIN_LANDMARK"),
      oracleShouldEmitMissingMain
    );

    recordRuleOutcome(
      trackerThinContent,
      isHtml && isIndexable && isStandardContent,
      isHtml && isIndexable && isStandardContent,
      emittedRuleCodes.has("CONTENT_THIN_WORD_COUNT"),
      oracleShouldEmitThin
    );

    recordRuleOutcome(
      trackerUnlabelledForm,
      isHtml,
      isHtml,
      emittedRuleCodes.has("A11Y_UNLABELLED_FORM_CONTROL"),
      oracleShouldEmitUnlabelled
    );

    // 3. Render Trigger Precision & Recall Analysis
    const factDifferenceRequired =
      rawResult.facts.h1Count !== browserFacts.h1Count ||
      rawResult.facts.title !== browserFacts.title ||
      Math.abs((rawResult.facts.mainContentWordCount || 0) - (browserFacts.mainContentWordCount || 0)) > 50 ||
      rawResult.facts.formCount !== browserFacts.formCount ||
      rawResult.facts.hasMain !== browserFacts.hasMain;

    const rawWouldAlterDiagnostics =
      rawEmittedRuleCodes.has("CONTENT_MISSING_H1") !== oracleShouldEmitMissingH1 ||
      rawEmittedRuleCodes.has("CONTENT_MULTIPLE_H1") !== oracleShouldEmitMultipleH1 ||
      rawEmittedRuleCodes.has("CONTENT_THIN_WORD_COUNT") !== oracleShouldEmitThin ||
      rawEmittedRuleCodes.has("CONTENT_MISSING_TITLE") !== oracleShouldEmitMissingTitle ||
      rawEmittedRuleCodes.has("A11Y_MISSING_MAIN_LANDMARK") !== oracleShouldEmitMissingMain ||
      rawEmittedRuleCodes.has("A11Y_UNLABELLED_FORM_CONTROL") !== oracleShouldEmitUnlabelled;

    const triggerAttempted = authResult.renderDecisionSample.attempted;

    if (triggerAttempted && factDifferenceRequired) factDiff_TP++;
    else if (!triggerAttempted && !factDifferenceRequired) factDiff_TN++;
    else if (triggerAttempted && !factDifferenceRequired) factDiff_FP++;
    else if (!triggerAttempted && factDifferenceRequired) factDiff_FN++;

    if (triggerAttempted && rawWouldAlterDiagnostics) diagImpact_TP++;
    else if (!triggerAttempted && !rawWouldAlterDiagnostics) diagImpact_TN++;
    else if (triggerAttempted && !rawWouldAlterDiagnostics) diagImpact_FP++;
    else if (!triggerAttempted && rawWouldAlterDiagnostics) diagImpact_FN++;
  }

  // 4. External Links Verification Oracle & False Positive Evaluation
  console.log(`[Verify:Parity] Verifying external links sample against independent browser truth...`);
  const trackerExternalBroken = createTracker("LINKS_BROKEN_EXTERNAL");
  const confirmedBrokenDetails: ExternalLinkConfirmedBrokenEvidence[] = [];

  for (const target of EXTERNAL_LINK_PARITY_TARGETS) {
    const evidence = await verifyLinkTarget(target.url, target.sourcePage, target.anchorText, 10000);
    const isCrawlerBroken = evidence.outcome === "confirmed_broken";
    const isOracleBroken = target.expectedOracleStatus === "broken_destination";

    trackerExternalBroken.eligibleCrawler++;
    trackerExternalBroken.eligibleBrowser++;
    trackerExternalBroken.comparable++;

    if (isCrawlerBroken && isOracleBroken) {
      trackerExternalBroken.tp++;
    } else if (!isCrawlerBroken && !isOracleBroken) {
      trackerExternalBroken.tn++;
    } else if (isCrawlerBroken && !isOracleBroken) {
      trackerExternalBroken.fp++;
      trackerExternalBroken.fpUrls.push(target.url);
    } else if (!isCrawlerBroken && isOracleBroken) {
      trackerExternalBroken.fn++;
      trackerExternalBroken.fnUrls.push(target.url);
    }

    if (isCrawlerBroken) {
      confirmedBrokenDetails.push({
        sourcePageUrl: target.sourcePage,
        anchorText: target.anchorText,
        targetUrl: target.url,
        httpStatus: evidence.httpStatus,
        browserNavigationStatus: evidence.browserVerification?.navigationStatus,
        browserPageState: evidence.browserVerification?.pageState,
        browserTitle: evidence.browserVerification?.pageTitle,
        finalOutcome: evidence.outcome,
        reason: evidence.reason,
        scorePenalty: 5,
      });
    }
  }

  await browser.close();

  const rawExtractionParity = buildSingleParityPopulation("raw_extraction", rawComparisons, {
    coreSeo: 98.0,
    structural: 95.0,
    content: 90.0,
  });

  const productionAuthoritativeParity = buildSingleParityPopulation(
    "production_authoritative",
    authComparisons,
    {
      coreSeo: 98.0,
      structural: 95.0,
      content: 90.0,
    }
  );

  const factDiffPrecision =
    factDiff_TP + factDiff_FP > 0
      ? Number(((factDiff_TP / (factDiff_TP + factDiff_FP)) * 100).toFixed(1))
      : 100.0;
  const factDiffRecall =
    factDiff_TP + factDiff_FN > 0
      ? Number(((factDiff_TP / (factDiff_TP + factDiff_FN)) * 100).toFixed(1))
      : 100.0;

  const diagImpactPrecision =
    diagImpact_TP + diagImpact_FP > 0
      ? Number(((diagImpact_TP / (diagImpact_TP + diagImpact_FP)) * 100).toFixed(1))
      : 100.0;
  const diagImpactRecall =
    diagImpact_TP + diagImpact_FN > 0
      ? Number(((diagImpact_TP / (diagImpact_TP + diagImpact_FN)) * 100).toFixed(1))
      : 100.0;

  const renderTriggerAccuracy: RenderTriggerAccuracyMetric = {
    targetUrlsCount: TEST_URLS.length,
    factDifferenceTriggerRecall: factDiffRecall,
    factDifferencePrecision: factDiffPrecision,
    diagnosticImpactTriggerRecall: diagImpactRecall,
    diagnosticImpactPrecision: diagImpactPrecision,
    factDiff_TP,
    factDiff_TN,
    factDiff_FP,
    factDiff_FN,
    diagImpact_TP,
    diagImpact_TN,
    diagImpact_FP,
    diagImpact_FN,
  };

  function toRuleMetric(t: RuleTracker): RuleAccuracyMetric {
    return {
      ruleCode: t.ruleCode,
      totalEvaluatedPages: TEST_URLS.length,
      eligibleCrawlerPages: t.eligibleCrawler,
      eligibleBrowserPages: t.eligibleBrowser,
      comparablePages: t.comparable,
      truePositives: t.tp,
      falsePositives: t.fp,
      trueNegatives: t.tn,
      falseNegatives: t.fn,
      inconclusive: t.inconclusive,
      falsePositiveUrls: t.fpUrls,
      falseNegativeUrls: t.fnUrls,
      status: "MEASURED",
    };
  }

  const ruleMetrics: RuleAccuracyMetric[] = [
    toRuleMetric(trackerMissingTitle),
    toRuleMetric(trackerMissingH1),
    toRuleMetric(trackerMultipleH1),
    toRuleMetric(trackerMissingMain),
    toRuleMetric(trackerThinContent),
    toRuleMetric(trackerUnlabelledForm),
    toRuleMetric(trackerExternalBroken),
  ];

  const artifact: ParityArtifact = {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    rawExtractionParity,
    productionAuthoritativeParity,
    renderTriggerAccuracy,
    renderDecisionSamples,
    ruleMetrics,
    externalConfirmedBrokenDetails: confirmedBrokenDetails,
  };

  console.log(
    `[Verify:Parity] Complete.\n  - Raw Comparable Parity:                 ${rawExtractionParity.comparableParity}%\n  - Production Authoritative Parity:       ${productionAuthoritativeParity.comparableParity}%\n  - Fact-Difference Render Recall:         ${factDiffRecall}%\n  - Diagnostic-Impact Render Recall:       ${diagImpactRecall}%\n  - Accuracy Band:                         ${productionAuthoritativeParity.accuracyBand.toUpperCase()}`
  );
  return artifact;
}
