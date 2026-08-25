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
  MainContentComparabilityItem,
  ParityArtifact,
  ParityCategorySummary,
  RenderDecisionSample,
  RenderTriggerAccuracyMetric,
  RuleAccuracyMetric,
  SingleParityPopulation,
} from "./types";

export type FactCertificationClass = "diagnostic_critical" | "diagnostic_critical_when_comparable" | "observational";

export interface FactPolicyDefinition {
  field: string;
  category: "core_seo" | "structural_a11y" | "content_text";
  certificationClass: FactCertificationClass;
  diagnosticRulesAffected: string[];
  justification: string;
}

export const FACT_CERTIFICATION_POLICY: Record<string, FactPolicyDefinition> = {
  status_code: {
    field: "status_code",
    category: "core_seo",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["HTTP_STATUS_ERROR", "INDEXABILITY"],
    justification: "Directly determines HTTP fetchability and indexable crawl status",
  },
  title: {
    field: "title",
    category: "core_seo",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["CONTENT_MISSING_TITLE", "CONTENT_TITLE_LENGTH"],
    justification: "Primary on-page ranking and indexability title tag signal",
  },
  meta_description: {
    field: "meta_description",
    category: "core_seo",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["CONTENT_MISSING_META_DESC", "CONTENT_META_DESC_LENGTH"],
    justification: "Search snippet generation and CTR ranking signal",
  },
  canonical_url: {
    field: "canonical_url",
    category: "core_seo",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["CANONICAL_MISMATCH", "INDEXABILITY"],
    justification: "Authoritative URL consolidation directive",
  },
  h1_count: {
    field: "h1_count",
    category: "core_seo",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["CONTENT_MISSING_H1", "CONTENT_MULTIPLE_H1"],
    justification: "Primary content outline hierarchy and topical focus signal",
  },
  primary_h1_text: {
    field: "primary_h1_text",
    category: "core_seo",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["CONTENT_H1_RELEVANCE"],
    justification: "Topical keyword alignment and heading text content",
  },
  has_main_landmark: {
    field: "has_main_landmark",
    category: "structural_a11y",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["A11Y_MISSING_MAIN_LANDMARK"],
    justification: "WCAG 2.1 landmark and main document segmentation",
  },
  missing_alt_count: {
    field: "missing_alt_count",
    category: "structural_a11y",
    certificationClass: "diagnostic_critical",
    diagnosticRulesAffected: ["A11Y_MISSING_IMAGE_ALT"],
    justification: "Image accessibility and screen reader perception",
  },
  main_content_word_count: {
    field: "main_content_word_count",
    category: "content_text",
    certificationClass: "diagnostic_critical_when_comparable",
    diagnosticRulesAffected: ["CONTENT_THIN_WORD_COUNT"],
    justification: "Primary substantive content volume determining Thin Content audit rules",
  },
  form_count: {
    field: "form_count",
    category: "structural_a11y",
    certificationClass: "observational",
    diagnosticRulesAffected: [],
    justification: "Webflow & client JS inject search/newsletter forms client-side into navigation chrome; form accessibility rules evaluate dedicated forms independently",
  },
  visible_body_word_count: {
    field: "visible_body_word_count",
    category: "content_text",
    certificationClass: "observational",
    diagnosticRulesAffected: [],
    justification: "Whole-DOM text counts vary due to hydrated mobile drawers, mega-menus, and footer widgets without changing SEO diagnosis",
  },
};

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
  },
  {
    url: "https://www.linkedin.com/company/botconsulting",
    sourcePage: "https://www.botconsulting.io/",
    anchorText: "LinkedIn",
  },
  {
    url: "https://www.google.com",
    sourcePage: "https://www.botconsulting.io/",
    anchorText: "Google",
  },
  {
    url: "https://www.google.com/non-existent-page-404-test-xyz",
    sourcePage: "https://www.botconsulting.io/test",
    anchorText: "Broken Link",
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
      let visText = "";
      if (bodyClone) {
        bodyClone
          .querySelectorAll(
            "script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner']"
          )
          .forEach((el) => el.remove());
        visText = (bodyClone.innerText || "").replace(/\s+/g, " ").trim();
        visBodyWords = visText ? visText.split(/\s+/).filter(Boolean).length : 0;
      }

      // 3. Main Content Semantic Root Hierarchy
      let mainText = "";
      let mainWords = 0;
      let mainRootSelector: string | undefined = undefined;

      const semanticSelectors = [
        "main",
        "[role='main']",
        "article",
        "#main-content",
        ".main-content",
        ".post-content",
        ".entry-content",
        "[data-main-content]",
        "#content",
        ".content-area",
      ];

      for (const sel of semanticSelectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          const clone = el.cloneNode(true) as HTMLElement;
          clone
            .querySelectorAll(
              "script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner'], .cookie-banner, #cookie-notice, .modal, .popup, [aria-hidden='true']"
            )
            .forEach((n) => n.remove());
          const text = (clone.innerText || "").replace(/\s+/g, " ").trim();
          const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
          if (words > 0) {
            mainText = text;
            mainWords = words;
            mainRootSelector = sel;
            break;
          }
        }
      }

      if (!mainRootSelector) {
        mainText = visText;
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
      inputs.forEach((input: any) => {
        const id = input.getAttribute("id");
        const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
        const hasLabel = Boolean(labelEl && (labelEl.textContent || "").trim());
        const ariaLabel = (input.getAttribute("aria-label") || "").trim();
        const ariaLabelledBy = input.getAttribute("aria-labelledby");
        const title = (input.getAttribute("title") || "").trim();
        const hasAria = Boolean(ariaLabel || ariaLabelledBy || title);
        const wrappingLabel = input.closest("label");
        const isWrappedInLabel = Boolean(wrappingLabel && (wrappingLabel.textContent || "").trim());
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

  const cH1 = crawler.h1Texts[0] ? crawler.h1Texts[0].replace(/\s+/g, " ").trim() : null;
  const bH1 = browser.h1Texts[0] ? browser.h1Texts[0].replace(/\s+/g, " ").trim() : null;
  comparisons.push({
    field: "primary_h1_text",
    category: "core_seo",
    crawlerValue: cH1,
    browserValue: bH1,
    status:
      cH1 === bH1
        ? "EXACT_MATCH"
        : cH1 && bH1 && cH1.toLowerCase() === bH1.toLowerCase()
        ? "TOLERATED_MATCH"
        : "MISMATCH",
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
        : visWordDiffPct <= 0.2 || visWordDiff <= 30
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    mismatchReason:
      visWordDiffPct > 0.2 && visWordDiff > 30 ? "Client JS navigation/menu hydration word variance" : undefined,
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
        : mainWordDiffPct <= 0.2 || mainWordDiff <= 30
        ? "TOLERATED_MATCH"
        : "MISMATCH",
    mismatchReason:
      mainWordDiffPct > 0.2 && mainWordDiff > 30 ? "Client JS main content container hydration variance" : undefined,
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

  // Calculate Diagnostic-Critical Parity
  let diagCriticalExact = 0;
  let diagCriticalTolerated = 0;
  let diagCriticalMismatch = 0;
  let diagCriticalTotal = 0;

  for (const item of allComparisons) {
    for (const comp of item.comparisons) {
      const policy = FACT_CERTIFICATION_POLICY[comp.field];
      if (!policy) {
        throw new Error(
          `REGISTRY VIOLATION: Field [${comp.field}] evaluated in parity suite but lacks declaration in FACT_CERTIFICATION_POLICY!`
        );
      }

      if (policy.certificationClass === "diagnostic_critical") {
        diagCriticalTotal++;
        if (comp.status === "EXACT_MATCH") diagCriticalExact++;
        else if (comp.status === "TOLERATED_MATCH") diagCriticalTolerated++;
        else if (comp.status === "MISMATCH") diagCriticalMismatch++;
      }
    }
  }

  const diagnosticCriticalParityPercent = Number(
    (((diagCriticalExact + diagCriticalTolerated) / Math.max(1, diagCriticalTotal)) * 100).toFixed(1)
  );
  const diagnosticCriticalStrictPercent = Number(
    ((diagCriticalExact / Math.max(1, diagCriticalTotal)) * 100).toFixed(1)
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
    diagnosticCriticalParityPercent,
    diagnosticCriticalStrictPercent,
    diagnosticCriticalTotalFacts: diagCriticalTotal,
    diagnosticCriticalMatches: diagCriticalExact + diagCriticalTolerated,
    observationalParityPercent: comparableParity,
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
  const mainContentComparabilityBreakdown: MainContentComparabilityItem[] = [];

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

async function evaluateIndependentExternalOracle(url: string, browser: any): Promise<{
  oracleOutcome: "verified_valid" | "verified_broken" | "inconclusive" | "soft_404";
  navStatus: number | null;
  finalUrl: string;
  pageTitle: string;
  headings: string[];
  wordCount: number;
  snippet: string;
  challengeDetected: boolean;
}> {
  async function runStandaloneProbe(timeoutMs: number, waitMs = 1500) {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    try {
      let navStatus: number | null = null;
      try {
        const resp = await page.goto(url, {
          timeout: timeoutMs,
          waitUntil: "domcontentloaded",
        });
        navStatus = resp ? resp.status() : null;
        await page.waitForLoadState("networkidle", { timeout: Math.min(2500, waitMs) }).catch(() => {});
        await page.waitForTimeout(500);
      } catch {
        // navigation timeout or network failure
      }

      const pageTitle = (await page.title().catch(() => "")) || "";
      const finalUrl = page.url() || url;
      const bodyText = (await page.evaluate(() => (document.body ? document.body.innerText : "")).catch(() => "")) || "";
      const words = bodyText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const snippet = bodyText.slice(0, 300);

      const headings = await page
        .evaluate(() => {
          return Array.from(document.querySelectorAll("h1, h2, h3"))
            .map((h) => (h.textContent || "").trim())
            .filter(Boolean);
        })
        .catch(() => []);

      const titleLower = pageTitle.toLowerCase().trim();
      const combined = `${titleLower} ${headings.join(" ").toLowerCase()} ${bodyText.toLowerCase()}`;

      // 1. Independent Challenge Detection
      const challengeDetected =
        (combined.includes("cloudflare") &&
          (combined.includes("verify you are human") ||
            combined.includes("turnstile") ||
            combined.includes("attention required"))) ||
        combined.includes("security check") ||
        combined.includes("bot detection") ||
        navStatus === 999;

      // 2. Independent Explicit 404 / Gone Detection
      const isExplicitNotFound =
        titleLower.includes("404 not found") ||
        titleLower === "page not found" ||
        titleLower === "not found" ||
        titleLower.includes("404 - ") ||
        headings.some((h) => {
          const hl = h.toLowerCase().trim();
          return hl === "page not found" || hl === "404 not found" || hl === "error 404" || hl === "404 error";
        }) ||
        ((combined.includes("page not found") || combined.includes("404")) && wordCount < 30);

      const hasMeaningfulContent = wordCount >= 30 || (wordCount >= 10 && pageTitle.length > 5);

      let outcome: "verified_valid" | "verified_broken" | "inconclusive" | "soft_404" = "inconclusive";
      if (challengeDetected || navStatus === null || (navStatus === 403 && wordCount < 50)) {
        outcome = "inconclusive";
      } else if (isExplicitNotFound) {
        outcome = navStatus === 200 ? "soft_404" : "verified_broken";
      } else if (hasMeaningfulContent) {
        outcome = "verified_valid";
      } else {
        outcome = navStatus && navStatus >= 400 ? "verified_broken" : "inconclusive";
      }

      await context.close();
      return {
        outcome,
        navStatus,
        finalUrl,
        pageTitle,
        headings,
        wordCount,
        snippet,
        challengeDetected,
      };
    } catch (e) {
      await context.close().catch(() => {});
      throw e;
    }
  }

  const p1 = await runStandaloneProbe(15000, 1500).catch(() => null);
  if (!p1) {
    return {
      oracleOutcome: "inconclusive",
      navStatus: null,
      finalUrl: url,
      pageTitle: "",
      headings: [],
      wordCount: 0,
      snippet: "",
      challengeDetected: false,
    };
  }

  // If Probe 1 indicates not found or 404/410, run Probe 2 in fresh context with extended stabilization
  if (p1.outcome === "verified_broken" || p1.navStatus === 404 || p1.navStatus === 410) {
    try {
      const p2 = await runStandaloneProbe(18000, 3000);
      if (p1.outcome !== p2.outcome) {
        if (p1.outcome === "verified_valid" || p2.outcome === "verified_valid") {
          return {
            oracleOutcome: "inconclusive",
            navStatus: p2.navStatus || p1.navStatus,
            finalUrl: p2.finalUrl || p1.finalUrl,
            pageTitle: p2.pageTitle || p1.pageTitle,
            headings: p2.headings || p1.headings,
            wordCount: p2.wordCount || p1.wordCount,
            snippet: p2.snippet || p1.snippet,
            challengeDetected: p1.challengeDetected || p2.challengeDetected,
          };
        }
      }
      return {
        oracleOutcome: p2.outcome,
        navStatus: p2.navStatus,
        finalUrl: p2.finalUrl,
        pageTitle: p2.pageTitle,
        headings: p2.headings,
        wordCount: p2.wordCount,
        snippet: p2.snippet,
        challengeDetected: p2.challengeDetected,
      };
    } catch {
      // Fall back to probe 1
    }
  }

  return {
    oracleOutcome: p1.outcome,
    navStatus: p1.navStatus,
    finalUrl: p1.finalUrl,
    pageTitle: p1.pageTitle,
    headings: p1.headings,
    wordCount: p1.wordCount,
    snippet: p1.snippet,
    challengeDetected: p1.challengeDetected,
  };
}

  const trackerMissingH1 = createTracker("CONTENT_MISSING_H1");
  const trackerMultipleH1 = createTracker("CONTENT_MULTIPLE_H1");
  const trackerMissingMain = createTracker("A11Y_MISSING_MAIN_LANDMARK");
  const trackerMissingTitle = createTracker("CONTENT_MISSING_TITLE");
  const trackerMissingMeta = createTracker("CONTENT_MISSING_META_DESC");
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

    // 2. Independent Browser Oracle Expected Diagnostic Issue Ground Truth (Uses ONLY browser facts)
    const oracleShouldEmitMissingTitle =
      isHtml && isIndexable && isStandardContent && (!browserFacts.title || browserFacts.title.trim().length === 0);
    const oracleShouldEmitMissingMeta =
      isHtml &&
      isIndexable &&
      isStandardContent &&
      (!browserFacts.metaDescription || browserFacts.metaDescription.trim().length === 0);
    const oracleShouldEmitMissingH1 = isHtml && isIndexable && isStandardContent && browserFacts.h1Count === 0;
    const oracleShouldEmitMultipleH1 = isHtml && isIndexable && isStandardContent && browserFacts.h1Count > 1;
    const oracleShouldEmitMissingMain = isHtml && (pClass as string) !== "utility_endpoint" && !browserFacts.hasMain;
    const oracleShouldEmitThin =
      isHtml &&
      isIndexable &&
      isStandardContent &&
      (browserFacts.mainContentWordCount || 0) < 180;
    const isDedicatedFormPage =
      pClass === "form_application" ||
      url.includes("/contact") ||
      url.includes("/application");

    const browserFormRuleEligible = isHtml && isDedicatedFormPage && browserFacts.formCount > 0;
    const oracleShouldEmitUnlabelled = browserFormRuleEligible && browserFacts.unlabelledFormControlCount > 0;

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
      trackerMissingMeta,
      isHtml && isIndexable && isStandardContent,
      isHtml && isIndexable && isStandardContent,
      emittedRuleCodes.has("CONTENT_MISSING_META_DESC"),
      oracleShouldEmitMissingMeta
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

    const isCrawlerFormEligible = isHtml && isDedicatedFormPage && authResult.pageData.forms.length > 0;
    recordRuleOutcome(
      trackerUnlabelledForm,
      isCrawlerFormEligible,
      browserFormRuleEligible,
      emittedRuleCodes.has("A11Y_UNLABELLED_FORM_CONTROL"),
      oracleShouldEmitUnlabelled
    );

    // Track Main Content Comparability Item
    const authMainComp = authComps.find((c) => c.field === "main_content_word_count");
    let evaluation: "comparable" | "not_comparable" | "heuristic" | "render_required" = "comparable";
    let nonComparableReason: string | undefined = undefined;

    if (!isHtml || (pClass as string) === "utility_endpoint" || !authResult.pageData.isIndexable) {
      evaluation = "not_comparable";
      nonComparableReason = "Non-indexable, non-HTML or utility resource";
    } else if (authResult.renderDecisionSample.attempted && !authResult.renderDecisionSample.success) {
      evaluation = "render_required";
      nonComparableReason = "Client-rendered SPA page where rendering timed out";
    } else if (rawResult.facts.mainContentWordCount === 0 && browserFacts.mainContentWordCount > 0) {
      evaluation = "render_required";
      nonComparableReason = "Dynamic client-rendered template without static HTML content";
    } else if (!rawResult.facts.hasMain && !browserFacts.hasMain) {
      evaluation = "heuristic";
      nonComparableReason = "Page lacks semantic main landmark; resolved via section container heuristic";
    }

    const isMatch = authMainComp ? authMainComp.status === "EXACT_MATCH" || authMainComp.status === "TOLERATED_MATCH" : false;

    mainContentComparabilityBreakdown.push({
      url,
      pageClass: pClass,
      rawSelectorUsed: rawResult.facts.hasMain ? "main" : "heuristic_body",
      browserSelectorUsed: browserFacts.hasMain ? "main" : "heuristic_body",
      rawMainWords: rawResult.facts.mainContentWordCount,
      authoritativeMainWords: authResult.facts.mainContentWordCount,
      browserMainWords: browserFacts.mainContentWordCount,
      renderEligible: authResult.renderDecisionSample.renderEligible,
      renderAttempted: authResult.renderDecisionSample.attempted,
      renderSuccess: authResult.renderDecisionSample.success ?? true,
      thinContentCrawler: emittedRuleCodes.has("CONTENT_THIN_WORD_COUNT"),
      thinContentBrowser: oracleShouldEmitThin,
      mainContentEvaluation: evaluation,
      nonComparableReason,
      isNumericMatch: isMatch,
    });

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
      rawEmittedRuleCodes.has("CONTENT_MISSING_META_DESC") !== oracleShouldEmitMissingMeta ||
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
    const oracleResult = await evaluateIndependentExternalOracle(target.url, browser);
    const crawlerEvidence = await verifyLinkTarget(target.url, target.sourcePage, target.anchorText, 10000);

    const isCrawlerBroken = crawlerEvidence.outcome === "confirmed_broken";
    const isOracleBroken = oracleResult.oracleOutcome === "verified_broken" || oracleResult.oracleOutcome === "soft_404";
    const isOracleInconclusive = oracleResult.oracleOutcome === "inconclusive" || oracleResult.challengeDetected;

    trackerExternalBroken.eligibleCrawler++;
    if (!isOracleInconclusive) {
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
    } else {
      trackerExternalBroken.inconclusive++;
    }

    if (isCrawlerBroken) {
      confirmedBrokenDetails.push({
        sourcePageUrl: target.sourcePage,
        anchorText: target.anchorText,
        targetUrl: target.url,
        httpStatus: crawlerEvidence.httpStatus,
        browserNavigationStatus: crawlerEvidence.browserVerification?.navigationStatus,
        browserPageState: crawlerEvidence.browserVerification?.pageState,
        browserTitle: crawlerEvidence.browserVerification?.pageTitle,
        finalOutcome: crawlerEvidence.outcome,
        reason: crawlerEvidence.reason,
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
    toRuleMetric(trackerMissingMeta),
    toRuleMetric(trackerMissingH1),
    toRuleMetric(trackerMultipleH1),
    toRuleMetric(trackerMissingMain),
    toRuleMetric(trackerThinContent),
    toRuleMetric(trackerUnlabelledForm),
    toRuleMetric(trackerExternalBroken),
  ];

  const comparableItems = mainContentComparabilityBreakdown.filter(
    (item) => item.mainContentEvaluation === "comparable"
  );
  const comparableNumericMatches = comparableItems.filter((item) => item.isNumericMatch).length;
  const mainContentNumericParity = Number(
    ((comparableNumericMatches / Math.max(1, comparableItems.length)) * 100).toFixed(1)
  );

  const thinContentAgreements = mainContentComparabilityBreakdown.filter(
    (item) => item.thinContentCrawler === item.thinContentBrowser
  ).length;
  const thinContentDecisionParityPercent = Number(
    ((thinContentAgreements / mainContentComparabilityBreakdown.length) * 100).toFixed(1)
  );

  const artifact: ParityArtifact = {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    rawExtractionParity,
    productionAuthoritativeParity,
    diagnosticCriticalFactParityPercent: productionAuthoritativeParity.diagnosticCriticalParityPercent,
    mainContentNumericParity,
    thinContentDecisionParityPercent,
    mainContentComparabilityBreakdown,
    factCertificationPolicy: FACT_CERTIFICATION_POLICY,
    renderTriggerAccuracy,
    renderDecisionSamples,
    ruleMetrics,
    externalConfirmedBrokenDetails: confirmedBrokenDetails,
  };

  console.log(
    `[Verify:Parity] Complete.\n  - Raw Comparable Parity:                 ${rawExtractionParity.comparableParity}%\n  - Production Authoritative Parity:       ${productionAuthoritativeParity.comparableParity}%\n  - Diagnostic-Critical Fact Parity:       ${productionAuthoritativeParity.diagnosticCriticalParityPercent}%\n  - Main Content Comparable Parity:        ${mainContentNumericParity}%\n  - Thin Content Decision Parity:          ${thinContentDecisionParityPercent}%\n  - Diagnostic-Impact Render Recall:       ${diagImpactRecall}%\n  - Accuracy Band:                         ${productionAuthoritativeParity.accuracyBand.toUpperCase()}`
  );
  return artifact;
}
