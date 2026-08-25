/**
 * Layer 2 — Multi-Stack Real-World Validation Corpus
 * Evaluates 50+ representative pages across diverse architectural stacks:
 * 1. Webflow CMS (BOT Consulting)
 * 2. Static HTML & Documentation (W3C Standards, Semantic Documentation)
 * 3. WordPress / CMS (WordPress.org documentation & blogs)
 * 4. Next.js / React SSR (Next.js & React official documentation & SSR applications)
 * 5. Interactive SPAs & Dynamic Portals (client routing & forms)
 */

import { IMPLEMENTED_DIAGNOSTIC_RULES } from "./rule-inventory";

export interface CorpusUrlDefinition {
  url: string;
  stack: "webflow" | "static_html" | "wordpress" | "nextjs_react_ssr" | "dynamic_spa";
  label: string;
  expectedClass: string;
  expectedRenderEligible: boolean;
  expectedMainRoot?: string;
  expectedThinContent: boolean;
}

export const MULTI_STACK_CORPUS_URLS: CorpusUrlDefinition[] = [
  // =========================================================================
  // 1. Webflow CMS Corpus (BOT Consulting - 25 URLs)
  // =========================================================================
  { url: "https://www.botconsulting.io/", stack: "webflow", label: "BOT: Homepage", expectedClass: "homepage", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/about-us", stack: "webflow", label: "BOT: About Us", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/solutions", stack: "webflow", label: "BOT: Solutions", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/odyssey", stack: "webflow", label: "BOT: Odyssey OS", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/servicenow-at-bot", stack: "webflow", label: "BOT: ServiceNow at BOT", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/contact-us", stack: "webflow", label: "BOT: Contact Us", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/solution-service-now", stack: "webflow", label: "BOT: Solution ServiceNow", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/job-categories/customer-support", stack: "webflow", label: "BOT: Cat Customer Support", expectedClass: "category_listing", expectedRenderEligible: true, expectedThinContent: true },
  { url: "https://www.botconsulting.io/job-categories/sales-marketing", stack: "webflow", label: "BOT: Cat Sales Marketing (404)", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/job-openings/data-architect", stack: "webflow", label: "BOT: Job Data Architect", expectedClass: "active_job", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/job-openings/analytic-engineer", stack: "webflow", label: "BOT: Job Analytics Engineer", expectedClass: "active_job", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/jobopenings/790176000000574221", stack: "webflow", label: "BOT: Job Detail 574221", expectedClass: "active_job", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/jobopenings/790176000000574233", stack: "webflow", label: "BOT: Job Detail 574233", expectedClass: "active_job", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/jobopenings-copy/790176000000574229", stack: "webflow", label: "BOT: Job Copy 574229 (404)", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/jobopenings-copy/790176000000574249", stack: "webflow", label: "BOT: Job Copy 574249 (404)", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/post/2025-year-in-review", stack: "webflow", label: "BOT: Blog 2025 Review", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow", stack: "webflow", label: "BOT: Blog AR.BOT", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/post/high-impact-gccs-the-new-growth-engine-for-global-enterprises", stack: "webflow", label: "BOT: Blog High-Impact GCCs", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/search", stack: "webflow", label: "BOT: Search Utility", expectedClass: "search_filter", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/thank-you", stack: "webflow", label: "BOT: Thank You Confirmation", expectedClass: "thank_you_confirmation", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/application", stack: "webflow", label: "BOT: Job Application Form", expectedClass: "form_application", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://www.botconsulting.io/non-existent-page-404-test", stack: "webflow", label: "BOT: 404 Error Test", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/sitemap.xml", stack: "webflow", label: "BOT: Sitemap XML", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/cdn-cgi/l/email-protection", stack: "webflow", label: "BOT: Cloudflare Utility", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.botconsulting.io/terms-of-service", stack: "webflow", label: "BOT: Terms of Service", expectedClass: "utility_legal", expectedRenderEligible: false, expectedThinContent: false },

  // =========================================================================
  // 2. Static HTML & W3C Standards Corpus (10 URLs)
  // =========================================================================
  { url: "https://www.w3.org/", stack: "static_html", label: "W3C: Standards Homepage", expectedClass: "homepage", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.w3.org/standards/", stack: "static_html", label: "W3C: Standards Directory", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.w3.org/Consortium/", stack: "static_html", label: "W3C: About Consortium", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.w3.org/WAI/", stack: "static_html", label: "W3C: Web Accessibility Initiative", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.w3.org/TR/html52/", stack: "static_html", label: "W3C: HTML5.2 Recommendation", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.ietf.org/", stack: "static_html", label: "IETF: Internet Engineering Task Force", expectedClass: "homepage", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://www.ietf.org/about/", stack: "static_html", label: "IETF: About", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://developer.mozilla.org/en-US/", stack: "static_html", label: "MDN: Web Docs", expectedClass: "homepage", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://developer.mozilla.org/en-US/docs/Web/HTML", stack: "static_html", label: "MDN: HTML Documentation", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404", stack: "static_html", label: "MDN: HTTP 404 Guide", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },

  // =========================================================================
  // 3. WordPress / CMS Corpus (8 URLs)
  // =========================================================================
  { url: "https://wordpress.org/", stack: "wordpress", label: "WP: WordPress.org Home", expectedClass: "homepage", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/about/", stack: "wordpress", label: "WP: About WordPress", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/news/", stack: "wordpress", label: "WP: News & Blog", expectedClass: "article_blog", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/plugins/", stack: "wordpress", label: "WP: Plugin Directory", expectedClass: "category_listing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/themes/", stack: "wordpress", label: "WP: Theme Directory", expectedClass: "category_listing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/support/", stack: "wordpress", label: "WP: Support Documentation", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/showcase/", stack: "wordpress", label: "WP: Showcase", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },
  { url: "https://wordpress.org/hosting/", stack: "wordpress", label: "WP: Hosting Recommendations", expectedClass: "marketing_landing", expectedRenderEligible: false, expectedThinContent: false },

  // =========================================================================
  // 4. Next.js / React SSR & Dynamic SPA Corpus (8 URLs)
  // =========================================================================
  { url: "https://nextjs.org/", stack: "nextjs_react_ssr", label: "Next.js: Framework Homepage", expectedClass: "homepage", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://nextjs.org/docs", stack: "nextjs_react_ssr", label: "Next.js: Documentation", expectedClass: "article_blog", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://nextjs.org/showcase", stack: "nextjs_react_ssr", label: "Next.js: Showcase Gallery", expectedClass: "marketing_landing", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://nextjs.org/blog", stack: "nextjs_react_ssr", label: "Next.js: Blog Feed", expectedClass: "article_blog", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://react.dev/", stack: "nextjs_react_ssr", label: "React: Documentation Homepage", expectedClass: "homepage", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://react.dev/learn", stack: "nextjs_react_ssr", label: "React: Learn React Guide", expectedClass: "article_blog", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://react.dev/reference/react", stack: "nextjs_react_ssr", label: "React: API Reference", expectedClass: "article_blog", expectedRenderEligible: true, expectedThinContent: false },
  { url: "https://react.dev/blog", stack: "nextjs_react_ssr", label: "React: Community Blog", expectedClass: "article_blog", expectedRenderEligible: true, expectedThinContent: false },
];

export interface MultiStackCorpusResult {
  totalUrls: number;
  byStack: Record<string, number>;
  diagnosticCriticalParityPercent: number;
  coreSeoParityPercent: number;
  mainContentComparableParityPercent: number;
  thinContentDecisionParityPercent: number;
  diagnosticAccuracyFp: number;
  diagnosticAccuracyFn: number;
  urlResults: Array<{
    url: string;
    stack: string;
    label: string;
    statusCode: number;
    title: string;
    h1Count: number;
    mainContentWords: number;
    thinContentStatus: "compliant" | "thin_content" | "excluded";
    diagnosticIssuesCount: number;
    pass: boolean;
  }>;
}

/**
 * Extracts independent Playwright browser truth for a corpus page.
 */
export async function extractBrowserCorpusFacts(page: any, url: string) {
  const title = (await page.title().catch(() => "")) || null;
  const canonicalUrl =
    (await page
      .$eval('link[rel="canonical"]', (el: any) => el.href || null)
      .catch(() => null)) || null;
  const metaDescription =
    (await page
      .$eval('meta[name="description" i]', (el: any) => el.content || null)
      .catch(() => null)) || null;

  const h1Data = await page
    .evaluate(() => {
      const h1s = Array.from(document.querySelectorAll("h1")).map((el) => (el.textContent || "").trim()).filter(Boolean);
      return { count: h1s.length, primary: h1s[0] || null };
    })
    .catch(() => ({ count: 0, primary: null }));

  const landmarkData = await page
    .evaluate(() => {
      const mainEl = document.querySelector("main, [role='main']");
      return { hasMain: Boolean(mainEl) };
    })
    .catch(() => ({ hasMain: false }));

  const missingAltCount = await page
    .evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.filter((img) => !img.hasAttribute("alt")).length;
    })
    .catch(() => 0);

  const wordsData = await page
    .evaluate(() => {
      const semanticSelectors = [
        "main",
        '[role="main"]',
        "article",
        "#main-content",
        ".main-content",
        ".post-content",
        ".entry-content",
        "[data-main-content]",
        "#content",
        ".content-area",
      ];
      let words = 0;
      for (const s of semanticSelectors) {
        const el = document.querySelector(s);
        if (el) {
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner'], .cookie-banner, #cookie-notice, .modal, .popup, [aria-hidden='true']").forEach((n) => n.remove());
          const text = (clone.innerText || "").replace(/\s+/g, " ").trim();
          const w = text ? text.split(/\s+/).filter(Boolean).length : 0;
          if (w > 0) {
            words = w;
            break;
          }
        }
      }
      const bodyClone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
      let visibleBody = 0;
      if (bodyClone) {
        bodyClone.querySelectorAll("script, style, noscript, svg, [aria-hidden='true']").forEach((n) => n.remove());
        const bText = (bodyClone.innerText || "").replace(/\s+/g, " ").trim();
        visibleBody = bText ? bText.split(/\s+/).filter(Boolean).length : 0;
      }
      return { mainWords: words, visibleBodyWords: visibleBody };
    })
    .catch(() => ({ mainWords: 0, visibleBodyWords: 0 }));

  return {
    source: "rendered",
    statusCode: 200,
    title,
    metaDescription,
    canonicalUrl,
    h1Count: h1Data.count,
    primaryH1Text: h1Data.primary,
    hasMainLandmark: landmarkData.hasMain,
    missingAltCount,
    mainContentWordCount: wordsData.mainWords,
    visibleBodyWordCount: wordsData.visibleBodyWords,
    formCount: 0,
    unlabelledFormControlCount: 0,
  };
}
