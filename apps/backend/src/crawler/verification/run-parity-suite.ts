import { chromium } from "playwright";
import axios from "axios";
import { parseHtmlPage } from "../parser";
import { normalizeUrl } from "../normalizer";
import { processPageAuthoritatively } from "../page-processor";
import type {
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

async function extractRawFacts(url: string): Promise<EvaluatedFactModel> {
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
  };
}

async function extractProductionAuthoritativeFacts(url: string): Promise<{
  facts: EvaluatedFactModel;
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

  // Strict Field Metrics Invariant Reconciliation & Field Status
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

  // Measured Rule Confusion Matrices
  let missingH1_TP = 0, missingH1_TN = 0, missingH1_FP = 0, missingH1_FN = 0;
  let multipleH1_TP = 0, multipleH1_TN = 0, multipleH1_FP = 0, multipleH1_FN = 0;
  let missingMain_TP = 0, missingMain_TN = 0, missingMain_FP = 0, missingMain_FN = 0;
  let missingTitle_TP = 0, missingTitle_TN = 0, missingTitle_FP = 0, missingTitle_FN = 0;
  let thinContent_TP = 0, thinContent_TN = 0, thinContent_FP = 0, thinContent_FN = 0;
  let unlabelledForm_TP = 0, unlabelledForm_TN = 0, unlabelledForm_FP = 0, unlabelledForm_FN = 0;

  // Render Trigger Precision/Recall Trackers
  let trigger_TP = 0, trigger_TN = 0, trigger_FP = 0, trigger_FN = 0;

  for (const url of TEST_URLS) {
    const [rawFacts, authResult, browserFacts] = await Promise.all([
      extractRawFacts(url),
      extractProductionAuthoritativeFacts(url),
      extractPlaywrightOracleFacts(browser, url),
    ]);

    renderDecisionSamples.push(authResult.renderDecisionSample);

    const rawComps = compareFactModels(rawFacts, browserFacts);
    const authComps = compareFactModels(authResult.facts, browserFacts);

    rawComparisons.push({ url, comparisons: rawComps });
    authComparisons.push({ url, comparisons: authComps });

    // Render Trigger Ground Truth Evaluation
    const rawMateriallyDiffers =
      (rawFacts.visibleBodyWordCount < 50 && (browserFacts.visibleBodyWordCount || 0) >= 50) ||
      (rawFacts.h1Texts[0]?.toLowerCase() === "heading" && browserFacts.h1Texts[0]?.toLowerCase() !== "heading") ||
      (rawFacts.formCount === 0 && browserFacts.formCount > 0);

    const triggerAttempted = authResult.renderDecisionSample.attempted;

    if (triggerAttempted && rawMateriallyDiffers) trigger_TP++;
    else if (!triggerAttempted && !rawMateriallyDiffers) trigger_TN++;
    else if (triggerAttempted && !rawMateriallyDiffers) trigger_FP++;
    else if (!triggerAttempted && rawMateriallyDiffers) trigger_FN++;

    // Rule confusion matrix tracking (Authoritative facts vs Browser Oracle truth)
    const cMissingH1 = authResult.facts.h1Count === 0;
    const bMissingH1 = browserFacts.h1Count === 0;
    if (cMissingH1 && bMissingH1) missingH1_TP++;
    else if (!cMissingH1 && !bMissingH1) missingH1_TN++;
    else if (cMissingH1 && !bMissingH1) missingH1_FP++;
    else if (!cMissingH1 && bMissingH1) missingH1_FN++;

    const cMultipleH1 = authResult.facts.h1Count > 1;
    const bMultipleH1 = browserFacts.h1Count > 1;
    if (cMultipleH1 && bMultipleH1) multipleH1_TP++;
    else if (!cMultipleH1 && !bMultipleH1) multipleH1_TN++;
    else if (cMultipleH1 && !bMultipleH1) multipleH1_FP++;
    else if (!cMultipleH1 && bMultipleH1) multipleH1_FN++;

    const cMissingMain = !authResult.facts.hasMain;
    const bMissingMain = !browserFacts.hasMain;
    if (cMissingMain && bMissingMain) missingMain_TP++;
    else if (!cMissingMain && !bMissingMain) missingMain_TN++;
    else if (cMissingMain && !bMissingMain) missingMain_FP++;
    else if (!cMissingMain && bMissingMain) missingMain_FN++;

    const cMissingTitle = !authResult.facts.title;
    const bMissingTitle = !browserFacts.title;
    if (cMissingTitle && bMissingTitle) missingTitle_TP++;
    else if (!cMissingTitle && !bMissingTitle) missingTitle_TN++;
    else if (cMissingTitle && !bMissingTitle) missingTitle_FP++;
    else if (!cMissingTitle && bMissingTitle) missingTitle_FN++;

    const cThin = (authResult.facts.mainContentWordCount || 0) < 180;
    const bThin = (browserFacts.mainContentWordCount || 0) < 180;
    if (cThin && bThin) thinContent_TP++;
    else if (!cThin && !bThin) thinContent_TN++;
    else if (cThin && !bThin) thinContent_FP++;
    else if (!cThin && bThin) thinContent_FN++;

    const cUnlabelled = authResult.facts.unlabelledFormControlCount > 0;
    const bUnlabelled = browserFacts.unlabelledFormControlCount > 0;
    if (cUnlabelled && bUnlabelled) unlabelledForm_TP++;
    else if (!cUnlabelled && !bUnlabelled) unlabelledForm_TN++;
    else if (cUnlabelled && !bUnlabelled) unlabelledForm_FP++;
    else if (!cUnlabelled && bUnlabelled) unlabelledForm_FN++;
  }

  await browser.close();

  // Strict Initial Release Gates (Section 3)
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

  const precision =
    trigger_TP + trigger_FP > 0
      ? Number(((trigger_TP / (trigger_TP + trigger_FP)) * 100).toFixed(1))
      : 100.0;
  const recall =
    trigger_TP + trigger_FN > 0
      ? Number(((trigger_TP / (trigger_TP + trigger_FN)) * 100).toFixed(1))
      : 100.0;

  const renderTriggerAccuracy: RenderTriggerAccuracyMetric = {
    targetUrlsCount: TEST_URLS.length,
    truePositives: trigger_TP,
    trueNegatives: trigger_TN,
    falsePositives: trigger_FP,
    falseNegatives: trigger_FN,
    precisionPercent: precision,
    recallPercent: recall,
  };

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
    {
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      totalEvaluatedPages: TEST_URLS.length,
      truePositives: thinContent_TP,
      falsePositives: thinContent_FP,
      trueNegatives: thinContent_TN,
      falseNegatives: thinContent_FN,
      status: "MEASURED",
    },
    {
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      totalEvaluatedPages: TEST_URLS.length,
      truePositives: unlabelledForm_TP,
      falsePositives: unlabelledForm_FP,
      trueNegatives: unlabelledForm_TN,
      falseNegatives: unlabelledForm_FN,
      status: "MEASURED",
    },
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
  };

  console.log(
    `[Verify:Parity] Complete.\n  - Raw Comparable Parity:           ${rawExtractionParity.comparableParity}%\n  - Production Authoritative Parity: ${productionAuthoritativeParity.comparableParity}%\n  - Render Trigger Recall:           ${recall}% (Precision: ${precision}%)\n  - Accuracy Band:                   ${productionAuthoritativeParity.accuracyBand.toUpperCase()}`
  );
  return artifact;
}
