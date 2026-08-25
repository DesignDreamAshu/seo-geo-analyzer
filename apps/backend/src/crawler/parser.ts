import * as cheerio from "cheerio";
import { normalizeUrl, isUrlInScope, classifyResourceType, resolveAbsoluteHref, classifyLinkType, isValidNavigationalCandidate } from "./normalizer";
import type {
  CrawledPageData,
  FormFact,
  HeadingOutlineItem,
  ImageAsset,
  ImageAltState,
  JsonLdBlock,
  LandmarkFacts,
  OutlinkEntry,
  PageClassification,
  PageClassType,
  RedirectHop,
  RenderConfidence,
  RenderMode,
  ResourceAsset,
  Soft404Status,
  OgImageFetchState,
  OpenGraphData,
} from "./types";

/**
 * Calculates the accessible name of any interactive DOM element according to W3C Accessible Name Computation principles.
 */
export function calculateAccessibleName($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  // 1. Check aria-labelledby
  const labelledBy = $el.attr("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const parts = ids.map((id) => $(`#${id}`).text().trim()).filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }

  // 2. Check aria-label
  const ariaLabel = $el.attr("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  // 3. Check visible text content
  const visibleText = $el.text().replace(/\s+/g, " ").trim();
  if (visibleText) return visibleText;

  // 4. Check child img alt
  const childImgAlt = $el.find("img[alt]").attr("alt")?.trim();
  if (childImgAlt) return childImgAlt;

  // 5. Check child svg title or aria-label
  const svgTitle = $el.find("svg title").text().trim();
  if (svgTitle) return svgTitle;
  const svgLabel = $el.find("svg[aria-label]").attr("aria-label")?.trim();
  if (svgLabel) return svgLabel;

  // 6. Check title attribute
  const titleAttr = $el.attr("title")?.trim();
  if (titleAttr) return titleAttr;

  // 7. Check screen-reader-only text
  const srText = $el.find(".sr-only, .visually-hidden, .screen-reader-text").text().trim();
  if (srText) return srText;

  return "";
}

/**
 * Extracts DOM landmark statistics for Accessibility-Lite & Layout QA.
 */
export function extractLandmarks($: cheerio.CheerioAPI): LandmarkFacts {
  const mainCount = $("main, [role='main']").length;
  const navCount = $("nav, [role='navigation']").length;
  const footerCount = $("footer, [role='contentinfo']").length;
  const headerCount = $("header, [role='banner']").length;
  const asideCount = $("aside, [role='complementary']").length;

  return {
    hasMain: mainCount > 0,
    mainCount,
    navCount,
    footerCount,
    headerCount,
    asideCount,
  };
}

/**
 * Extracts form facts and verifies accessible labelling on form controls.
 */
export function extractForms($: cheerio.CheerioAPI): FormFact[] {
  const forms: FormFact[] = [];

  $("form").each((_, formEl) => {
    const $form = $(formEl);
    const controls: FormFact["controls"] = [];

    $form.find("input, select, textarea").each((_, ctrlEl) => {
      const $ctrl = $(ctrlEl);
      const tag = (ctrlEl as any).tagName?.toLowerCase() || "input";
      const type =
        $ctrl.attr("type")?.toLowerCase() ||
        (tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text");
      const name = $ctrl.attr("name");
      const id = $ctrl.attr("id");

      // Skip hidden or submit inputs from unlabelled warnings
      if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "reset") {
        return;
      }

      let accessibleName: string | null = null;
      let isLabelled = false;

      // 1. aria-label or aria-labelledby
      const ariaLabel = $ctrl.attr("aria-label")?.trim() || null;
      const ariaLabelledBy = $ctrl.attr("aria-labelledby")?.trim() || null;
      if (ariaLabel) {
        accessibleName = ariaLabel;
        isLabelled = true;
      } else if (ariaLabelledBy) {
        accessibleName = ariaLabelledBy;
        isLabelled = true;
      }

      // 2. label[for='id']
      if (!isLabelled && id) {
        const labelText = $(`label[for='${id}']`).text().trim();
        if (labelText) {
          accessibleName = labelText;
          isLabelled = true;
        }
      }

      // 3. Wrapping <label>
      if (!isLabelled) {
        const wrappingLabel = $ctrl.parents("label").first().text().trim();
        if (wrappingLabel) {
          accessibleName = wrappingLabel;
          isLabelled = true;
        }
      }

      // 4. title or placeholder fallback
      const placeholder = $ctrl.attr("placeholder")?.trim() || undefined;
      const titleAttr = $ctrl.attr("title")?.trim() || undefined;
      if (!isLabelled) {
        if (titleAttr) {
          accessibleName = titleAttr;
          isLabelled = true;
        } else if (placeholder) {
          accessibleName = placeholder;
        }
      }

      // Build concise, non-fabricated snippet
      const attrParts: string[] = [];
      if (name) attrParts.push(`name="${name}"`);
      if (type && !(tag === "textarea" && type === "textarea")) attrParts.push(`type="${type}"`);
      if (id) attrParts.push(`id="${id}"`);
      if (placeholder) attrParts.push(`placeholder="${placeholder.slice(0, 30)}"`);
      if (ariaLabel) attrParts.push(`aria-label="${ariaLabel.slice(0, 30)}"`);
      if (ariaLabelledBy) attrParts.push(`aria-labelledby="${ariaLabelledBy}"`);
      const snippet = `<${tag}${attrParts.length > 0 ? " " + attrParts.join(" ") : ""}>`;

      controls.push({
        tag,
        type,
        name,
        id,
        placeholder,
        ariaLabel,
        ariaLabelledBy,
        snippet,
        accessibleName,
        isLabelled,
      });
    });

    const unlabelledCount = controls.filter((c) => !c.isLabelled).length;

    forms.push({
      id: $form.attr("id"),
      action: $form.attr("action"),
      method: $form.attr("method"),
      controlCount: controls.length,
      unlabelledCount,
      controls,
    });
  });

  return forms;
}

export interface WordCountBreakdown {
  rawDocumentText: string;
  rawDocumentWordCount: number;
  visibleBodyText: string;
  visibleBodyWordCount: number;
  mainContentText: string;
  mainContentWordCount: number;
  wordCount: number;
  mainRootSelector?: string;
  mainContentEvaluation?: "comparable" | "heuristic" | "not_comparable";
}

/**
 * Extracts clean text populations: raw document, visible body (excluding chrome), and main content container
 * following the canonical semantic hierarchy: main -> [role='main'] -> article -> recognized content roots.
 */
export function extractDetailedWordCounts($: cheerio.CheerioAPI): WordCountBreakdown {
  // 1. Raw Document Text (stripping only non-content machine tags)
  const rawClone = $.load($.html());
  rawClone("script, style, noscript, svg").remove();
  const rawDocText = rawClone("body").text().replace(/\s+/g, " ").trim();
  const rawDocWords = rawDocText ? rawDocText.split(/\s+/).filter(Boolean).length : 0;

  // 2. Visible Body Text (stripping nav, footer, header chrome)
  const bodyClone = $.load($.html());
  bodyClone("script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner'], .cookie-banner, #cookie-notice, .modal, .popup, [aria-hidden='true']").remove();
  const visBodyText = bodyClone("body").text().replace(/\s+/g, " ").trim();
  const visBodyWords = visBodyText ? visBodyText.split(/\s+/).filter(Boolean).length : 0;

  // 3. Main Content Semantic Root Hierarchy
  let mainText = "";
  let mainWords = 0;
  let mainRootSelector: string | undefined = undefined;
  let mainContentEvaluation: "comparable" | "heuristic" | "not_comparable" = "heuristic";

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
    const el = $(sel);
    if (el.length > 0) {
      const clone = $.load(el.first().html() || "");
      clone("script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner'], .cookie-banner, #cookie-notice, .modal, .popup, [aria-hidden='true']").remove();
      const text = clone.text().replace(/\s+/g, " ").trim();
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      if (words > 0) {
        mainText = text;
        mainWords = words;
        mainRootSelector = sel;
        mainContentEvaluation = "comparable";
        break;
      }
    }
  }

  if (!mainRootSelector) {
    mainText = visBodyText;
    mainWords = visBodyWords;
    mainContentEvaluation = visBodyWords > 0 ? "heuristic" : "not_comparable";
  }

  return {
    rawDocumentText: rawDocText,
    rawDocumentWordCount: rawDocWords,
    visibleBodyText: visBodyText,
    visibleBodyWordCount: visBodyWords,
    mainContentText: mainText,
    mainContentWordCount: mainWords,
    wordCount: mainWords > 0 ? mainWords : visBodyWords,
    mainRootSelector,
    mainContentEvaluation,
  };
}

export function extractMainText($: cheerio.CheerioAPI): { text: string; wordCount: number } {
  const res = extractDetailedWordCounts($);
  return {
    text: res.visibleBodyText,
    wordCount: res.wordCount,
  };
}

/**
 * Classifies a page into a semantic PageClass based on multiple signals with confidence rating.
 */
export function classifyPage(
  url: string,
  title: string | null,
  h1: string | null,
  schemaTypes: string[],
  wordCount: number,
  hasForm: boolean,
  statusCode: number,
): PageClassification {
  let urlObj: URL;
  try {
    urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return { primaryClass: "marketing_landing", confidence: 0.5, signals: ["invalid_url_fallback"] };
  }
  const path = urlObj.pathname.toLowerCase();
  const signals: string[] = [];

  if (statusCode >= 400) {
    return { primaryClass: "error", confidence: 0.99, signals: ["http_error_status"] };
  }

  // 1. Sitemaps
  if (path.endsWith(".xml") || path === "/sitemap" || path === "/sitemap.xml" || (path.includes("sitemap") && path.endsWith(".xml"))) {
    signals.push("xml_sitemap_path");
    return { primaryClass: "sitemap_resource", confidence: 1.0, signals };
  }

  // 2. Cloudflare / CDN / Utility Endpoints
  if (path.includes("/cdn-cgi/") || path.includes("email-protection") || path.includes("/api/")) {
    signals.push("utility_endpoint_path");
    return { primaryClass: "utility_endpoint", confidence: 1.0, signals };
  }

  // 3. Root / Homepage
  if (path === "/" || path === "") {
    return { primaryClass: "homepage", confidence: 0.98, signals: ["root_path"] };
  }

  // 4. Thank You / Confirmation
  if (path.includes("thank-you") || path.includes("thanks") || path.includes("confirmation") || path.includes("submitted")) {
    signals.push("path_thank_you_pattern");
    return { primaryClass: "thank_you_confirmation", confidence: 0.95, signals };
  }

  // 5. Utility / Legal
  if (
    path.includes("privacy") ||
    path.includes("terms") ||
    path.includes("legal") ||
    path.includes("cookie-policy") ||
    path.includes("disclaimer")
  ) {
    signals.push("legal_path_keyword");
    return { primaryClass: "utility_legal", confidence: 0.96, signals };
  }

  // 6. Form / Application (Strict semantic boundary: exclude software/service domains)
  const isSoftwareServicePhrase =
    path.includes("application-development") ||
    path.includes("application-architecture") ||
    path.includes("application-security") ||
    path.includes("application-modernization") ||
    path.includes("application-maintenance") ||
    path.includes("application-migration") ||
    path.includes("application-management") ||
    path.includes("application-engineering") ||
    path.includes("application-services") ||
    path.includes("application-integration") ||
    path.includes("enterprise-application") ||
    path.includes("web-application") ||
    path.includes("mobile-application") ||
    path.includes("cloud-application");

  const isFormApplicationPath =
    !isSoftwareServicePhrase &&
    (
      path.includes("/apply") ||
      path.includes("/job-application") ||
      path.includes("/application-form") ||
      path.includes("/career-apply") ||
      path.includes("/careers/apply") ||
      path.includes("/apply-now") ||
      path.includes("/online-application") ||
      path.includes("/submit-application") ||
      (path.includes("/application/") && !isSoftwareServicePhrase) ||
      path.endsWith("/application") ||
      path.includes("/register") ||
      path.includes("/signup") ||
      path.includes("/login") ||
      (hasForm && (path.includes("apply") || (path.includes("application") && !isSoftwareServicePhrase)))
    );

  if (isFormApplicationPath) {
    signals.push("form_path_keyword");
    if (hasForm) signals.push("form_element_present");
    return { primaryClass: "form_application", confidence: hasForm ? 0.92 : 0.75, signals };
  }

  // 7. Job / Career URLs (Fine-grained family classification)
  if (path.includes("jobopenings-copy") || path.includes("-copy")) {
    signals.push("cms_duplicate_copy_slug");
    return { primaryClass: "duplicate_job_candidate", confidence: 0.95, signals };
  }

  if (/\/jobopenings\/\d+/i.test(path)) {
    signals.push("numeric_legacy_job_path");
    return { primaryClass: "legacy_job", confidence: 0.92, signals };
  }

  if (path.includes("/job-openings/") || schemaTypes.includes("JobPosting")) {
    signals.push("active_job_slug_path");
    return { primaryClass: "active_job", confidence: 0.95, signals };
  }

  if (schemaTypes.includes("Product") || path.includes("/product/")) {
    signals.push("product_path_pattern");
    return { primaryClass: "product_job_detail", confidence: 0.94, signals };
  }

  // 8. Category / Listing
  if (path.includes("/job-categories/") || path.includes("/category/") || path.includes("/categories/") || (path.includes("/blog/") && path.split("/").length <= 3)) {
    signals.push("category_path_pattern");
    return { primaryClass: "category_listing", confidence: 0.88, signals };
  }

  // 9. Article / Blog Post
  if (schemaTypes.includes("Article") || schemaTypes.includes("BlogPosting") || schemaTypes.includes("NewsArticle") || path.includes("/blog/") || path.includes("/post/") || path.includes("/article/") || path.includes("/news/")) {
    signals.push("article_indicator");
    if (wordCount > 300) signals.push("substantial_article_word_count");
    return { primaryClass: "article_blog", confidence: 0.92, signals };
  }

  // 10. Search / Filter
  if (urlObj.searchParams.has("q") || urlObj.searchParams.has("search") || urlObj.searchParams.has("s") || path.includes("/search")) {
    signals.push("search_query_detected");
    return { primaryClass: "search_filter", confidence: 0.90, signals };
  }

  // 11. General Marketing / Landing
  signals.push("general_marketing_page");
  return { primaryClass: "marketing_landing", confidence: 0.75, signals };
}

/**
 * Validates sequential heading hierarchy from an existing outline of headings.
 * Guarantees that outlines with < 2 main content headings are valid by definition.
 */
export function validateHeadingOutlineHierarchy(outline: HeadingOutlineItem[]): {
  valid: boolean;
  issues: string[];
  skippedTransitions: Array<{ fromLevel: number; toLevel: number; fromText: string; toText: string; selector?: string }>;
} {
  const issues: string[] = [];
  const skippedTransitions: Array<{ fromLevel: number; toLevel: number; fromText: string; toText: string; selector?: string }> = [];

  const mainHeadings = (outline || []).filter((h) => h && h.inMainContent);
  if (mainHeadings.length < 2) {
    return {
      valid: true,
      issues: [],
      skippedTransitions: [],
    };
  }

  let previousLevel = 0;
  let previousText = "";

  for (const h of mainHeadings) {
    if (previousLevel > 0 && h.level > previousLevel + 1) {
      const transitionMsg = `Skipped <h${previousLevel + 1}>: <h${previousLevel}> "${previousText.slice(0, 35)}" followed directly by <h${h.level}> "${h.text.slice(0, 35)}"`;
      issues.push(transitionMsg);
      skippedTransitions.push({
        fromLevel: previousLevel,
        toLevel: h.level,
        fromText: previousText,
        toText: h.text,
        selector: h.domSelector,
      });
    }
    previousLevel = h.level;
    previousText = h.text;
  }

  return {
    valid: issues.length === 0,
    issues,
    skippedTransitions,
  };
}

/**
 * Validates the heading hierarchy in the DOM context and extracts outline with evidence.
 */
export function extractAndValidateHeadings($: cheerio.CheerioAPI): {
  h1s: string[];
  outline: HeadingOutlineItem[];
  valid: boolean;
  issues: string[];
  skippedTransitions: Array<{ fromLevel: number; toLevel: number; fromText: string; toText: string; selector?: string }>;
} {
  const h1s: string[] = [];
  const outline: HeadingOutlineItem[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tagName = (el as any).tagName?.toLowerCase() || "h1";
    const level = parseInt(tagName.replace("h", ""), 10) || 1;
    const text = $(el).text().replace(/\s+/g, " ").trim();

    // Identify context container
    const isNav = $(el).parents("nav, [role='navigation'], .nav, .navbar, .menu").length > 0;
    const isFooter = $(el).parents("footer, [role='contentinfo'], .footer").length > 0;
    const isHeader = $(el).parents("header, [role='banner'], .header").length > 0;
    const isAside = $(el).parents("aside, [role='complementary'], .sidebar").length > 0;
    const inBoilerplate = isNav || isFooter || isHeader || $(el).parents(".cookie-banner, .modal").length > 0;

    let context: HeadingOutlineItem["context"] = "main";
    if (isNav) context = "nav";
    else if (isFooter) context = "footer";
    else if (isHeader) context = "header";
    else if (isAside) context = "aside";
    else if (inBoilerplate) context = "component";

    if (level === 1) {
      h1s.push(text);
    }

    const item: HeadingOutlineItem = {
      level,
      text,
      domSelector: tagName + (el.attribs?.class ? `.${el.attribs.class.trim().split(/\s+/)[0]}` : "") + (el.attribs?.id ? `#${el.attribs.id}` : ""),
      inMainContent: !inBoilerplate,
      context,
    };
    outline.push(item);
  });

  const validation = validateHeadingOutlineHierarchy(outline);

  return {
    h1s,
    outline,
    valid: validation.valid,
    issues: validation.issues,
    skippedTransitions: validation.skippedTransitions,
  };
}

/**
 * Convenience helper to parse HTML string directly for testing and auditing.
 */
export function parsePageHtml(
  html: string,
  url: string,
  seedUrl = url,
  statusCode = 200,
  headers: Record<string, string | string[] | undefined> = {}
): CrawledPageData {
  return parseHtmlPage(url, url, url, statusCode, [], html, headers, 200, 0, seedUrl);
}

/**
 * Parses raw HTML, headers, and resource context into the authoritative PageFactModel.
 */
export function parseHtmlPage(
  url: string,
  normalizedUrl: string,
  finalUrl: string,
  statusCode: number,
  redirectHops: RedirectHop[],
  html: string,
  headers: Record<string, string | string[] | undefined>,
  responseTimeMs: number,
  depth: number,
  seedUrl: string,
  allowSubdomains = false,
  isDisallowedByRobots = false,
): CrawledPageData {
  const contentType = String(headers["content-type"] || "text/html");
  const resourceType = classifyResourceType(url, contentType);

  const $ = cheerio.load(html || "<html><head></head><body></body></html>");

  // Basic Metadata
  const title = $("title").first().text().trim() || null;
  const titleTagsCount = $("title").length;
  const metaDescription = $('meta[name="description" i]').first().attr("content")?.trim() || null;
  const metaDescriptionTagsCount = $('meta[name="description" i]').length;
  const htmlLang = $("html").attr("lang")?.trim() || null;

  // Compression Header Check
  const contentEncoding = String(headers["content-encoding"] || "").toLowerCase();
  const isCompressionEnabled = contentEncoding.includes("gzip") || contentEncoding.includes("br") || contentEncoding.includes("deflate") || contentEncoding.includes("zstd");

  // Button Accessibility Extraction (W3C Accessible Name standard)
  const buttons: import("./types").ButtonFact[] = [];
  $('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]').each((_, el) => {
    const $el = $(el);
    const tag = (el.tagName || "button").toLowerCase();
    const text = $el.text().replace(/\s+/g, " ").trim();
    const ariaLabel = $el.attr("aria-label")?.trim() || null;
    const ariaLabelledBy = $el.attr("aria-labelledby")?.trim() || null;
    const titleAttr = $el.attr("title")?.trim() || null;
    const valueAttr = $el.attr("value")?.trim() || null;

    let accessibleName = "";
    if (ariaLabel) {
      accessibleName = ariaLabel;
    } else if (ariaLabelledBy) {
      const labelledEl = $(`#${ariaLabelledBy}`);
      if (labelledEl.length > 0) accessibleName = labelledEl.text().trim();
    } else if (text) {
      accessibleName = text;
    } else if (valueAttr && (tag === "input" || tag === "button")) {
      accessibleName = valueAttr;
    } else if (titleAttr) {
      accessibleName = titleAttr;
    } else {
      const imgAlt = $el.find("img[alt]").attr("alt")?.trim();
      if (imgAlt) accessibleName = imgAlt;
      const svgAria = $el.find("svg[aria-label]").attr("aria-label")?.trim() || $el.find("svg title").text().trim();
      if (svgAria) accessibleName = svgAria;
    }

    const isLabelled = accessibleName.length > 0;
    const id = $el.attr("id");
    const domSelector = id ? `#${id}` : `${tag}${text ? `:contains("${text.slice(0, 15)}")` : ""}`;

    buttons.push({
      tag,
      text,
      ariaLabel,
      ariaLabelledBy,
      accessibleName,
      isLabelled,
      domSelector,
    });
  });

  // Iframe Accessible Title Extraction
  const iframes: import("./types").IframeFact[] = [];
  $("iframe").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src")?.trim() || null;
    const iframeTitle = $el.attr("title")?.trim() || null;
    const name = $el.attr("name")?.trim() || null;
    const ariaHidden = $el.attr("aria-hidden") === "true";
    const style = $el.attr("style") || "";
    const isHidden = ariaHidden || style.includes("display:none") || style.includes("display: none") || $el.attr("hidden") !== undefined || $el.attr("width") === "0" || $el.attr("height") === "0";
    const id = $el.attr("id");
    const domSelector = id ? `iframe#${id}` : (src ? `iframe[src="${src.slice(0, 30)}"]` : "iframe");

    iframes.push({
      src,
      title: iframeTitle,
      name,
      isHidden,
      domSelector,
    });
  });

  // Charset Extraction (W3C standard: <meta charset="...">, <meta http-equiv="Content-Type">, or HTTP header)
  let htmlCharset: string | null = null;
  const metaCharset = $('meta[charset]').first().attr("charset")?.trim();
  const metaHttpEquiv = $('meta[http-equiv="content-type" i]').first().attr("content")?.trim();
  const headerContentType = String(headers["content-type"] || "");

  if (metaCharset) {
    htmlCharset = metaCharset;
  } else if (metaHttpEquiv && metaHttpEquiv.toLowerCase().includes("charset=")) {
    const match = metaHttpEquiv.match(/charset=([a-zA-Z0-9_\-]+)/i);
    if (match) htmlCharset = match[1];
  } else if (headerContentType && headerContentType.toLowerCase().includes("charset=")) {
    const match = headerContentType.match(/charset=([a-zA-Z0-9_\-]+)/i);
    if (match) htmlCharset = match[1];
  }
  const hasValidCharset = Boolean(htmlCharset && htmlCharset.length >= 2);

  // Deprecated HTML Tags (obsolete presentational elements)
  const deprecatedTagList = ["marquee", "blink", "font", "center", "applet", "frame", "frameset", "dir", "isindex", "strike", "basefont"];
  const deprecatedHtmlTags = deprecatedTagList.filter((tag) => $(tag).length > 0);

  // External links with target="_blank" missing rel="noopener/noreferrer"
  const targetBlankWithoutNoopenerLinks: Array<{ href: string; text: string; rel: string | null }> = [];
  let currentHost = "";
  try {
    currentHost = new URL(finalUrl).hostname.toLowerCase();
  } catch {}

  $('a[target="_blank" i]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href")?.trim() || "";
    const rel = $a.attr("rel")?.toLowerCase().trim() || null;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      try {
        const linkHost = new URL(href).hostname.toLowerCase();
        if (linkHost && currentHost && linkHost !== currentHost && !linkHost.endsWith(`.${currentHost}`)) {
          const hasNoopener = rel && (rel.includes("noopener") || rel.includes("noreferrer"));
          if (!hasNoopener) {
            targetBlankWithoutNoopenerLinks.push({
              href,
              text: $a.text().replace(/\s+/g, " ").trim().slice(0, 50),
              rel,
            });
          }
        }
      } catch {}
    }
  });

  // Image Lazy Loading Check (exclude top 2 images, hero, logo, header/nav images)
  const sampleBelowFoldMissingLazy: string[] = [];
  let belowFoldMissingCount = 0;
  $("img").each((idx, el) => {
    const $img = $(el);
    const loadingAttr = $img.attr("loading")?.toLowerCase().trim();
    const fetchPriority = $img.attr("fetchpriority")?.toLowerCase().trim();
    const src = $img.attr("src")?.trim() || "";
    const isHeroOrLogo =
      $img.parents('header, nav, [role="banner"], .header, .nav, .navbar, .hero, .banner').length > 0 ||
      ($img.attr("class") || "").toLowerCase().includes("logo") ||
      ($img.attr("id") || "").toLowerCase().includes("logo") ||
      ($img.attr("alt") || "").toLowerCase().includes("logo");

    // First 2 images on page or hero/logo/high-priority are legitimately eager
    if (idx < 2 || isHeroOrLogo || fetchPriority === "high") {
      return;
    }

    if (loadingAttr !== "lazy" && src) {
      belowFoldMissingCount++;
      if (sampleBelowFoldMissingLazy.length < 5) {
        sampleBelowFoldMissingLazy.push(src);
      }
    }
  });
  const lazyLoadingStats = {
    belowFoldMissingLazyCount: belowFoldMissingCount,
    sampleImageUrls: sampleBelowFoldMissingLazy,
  };

  // Canonical tags extraction (including position and multiples)
  const allCanonicalTags: Array<{ href: string; inHead: boolean; isValidUrl: boolean; rawHref: string }> = [];
  $('link[rel="canonical" i]').each((_, el) => {
    const rawHref = $(el).attr("href")?.trim() || "";
    const inHead = $(el).parents("head").length > 0 || $(el).parent().is("head");
    const resolved = resolveAbsoluteHref(rawHref, finalUrl) || rawHref;
    let isValidUrl = false;
    try {
      if (rawHref.startsWith("http://") || rawHref.startsWith("https://") || rawHref.startsWith("/")) {
        isValidUrl = true;
      }
    } catch {}
    allCanonicalTags.push({
      rawHref,
      href: resolved,
      inHead,
      isValidUrl,
    });
  });

  const canonicalHref = allCanonicalTags[0]?.rawHref || null;
  const normalizedCanonical = canonicalHref ? normalizeUrl(canonicalHref, finalUrl) : null;

  const isCanonicalSelfReferencing = Boolean(
    normalizedCanonical && (normalizedCanonical === normalizedUrl || normalizedCanonical === normalizeUrl(finalUrl))
  );

  // Meta Robots & X-Robots-Tag
  const metaRobots = $('meta[name="robots" i]').attr("content")?.trim() || null;
  const googlebotMeta = $('meta[name="googlebot" i]').attr("content")?.trim() || null;
  const rawXRobots = headers["x-robots-tag"];
  const xRobotsTag = Array.isArray(rawXRobots) ? rawXRobots.join(", ") : (rawXRobots ? String(rawXRobots) : null);

  const combinedRobotsDirectives = `${metaRobots || ""} ${googlebotMeta || ""} ${xRobotsTag || ""}`.toLowerCase();
  const hasNoindex = combinedRobotsDirectives.includes("noindex");
  const hasNofollow = combinedRobotsDirectives.includes("nofollow");

  let robotsConflict = false;
  let robotsConflictReason: string | undefined;
  if (metaRobots && xRobotsTag) {
    const metaHasNoindex = metaRobots.toLowerCase().includes("noindex");
    const headerHasNoindex = xRobotsTag.toLowerCase().includes("noindex");
    if (metaHasNoindex !== headerHasNoindex) {
      robotsConflict = true;
      robotsConflictReason = `HTML meta robots specifies "${metaRobots}" but HTTP X-Robots-Tag specifies "${xRobotsTag}"`;
    }
  }

  const robotsDirectives = {
    metaRobots,
    googlebotMeta,
    xRobotsTag,
    hasNoindex,
    hasNofollow,
    conflict: robotsConflict,
    conflictReason: robotsConflictReason,
  };

  // Mobile Viewport extraction
  const viewportEl = $('meta[name="viewport" i]').first();
  const viewportTagPresent = viewportEl.length > 0;
  const viewportContent = viewportEl.attr("content")?.trim() || null;
  const viewportIssues: string[] = [];
  let isViewportValid = viewportTagPresent;

  if (viewportTagPresent) {
    const contentLower = (viewportContent || "").toLowerCase();
    if (!contentLower.includes("width=device-width")) {
      viewportIssues.push("Missing width=device-width parameter");
      isViewportValid = false;
    }
    if (contentLower.includes("user-scalable=no") || contentLower.includes("user-scalable=0") || contentLower.includes("maximum-scale=1")) {
      viewportIssues.push("Disables user pinch-to-zoom (user-scalable=no / maximum-scale=1)");
      isViewportValid = false;
    }
  } else {
    viewportIssues.push("Missing <meta name='viewport'> tag in document <head>");
  }

  const viewport = {
    tagPresent: viewportTagPresent,
    content: viewportContent,
    isValid: isViewportValid,
    issues: viewportIssues,
  };

  // International Hreflang extraction
  const hreflangTags: Array<{ hreflang: string; href: string; isValidLang: boolean; resolvedUrl: string }> = [];
  $('link[rel="alternate" i][hreflang]').each((_, el) => {
    const hreflang = $(el).attr("hreflang")?.trim().toLowerCase() || "";
    const rawHref = $(el).attr("href")?.trim() || "";
    if (hreflang && rawHref) {
      const resolvedUrl = resolveAbsoluteHref(rawHref, finalUrl) || rawHref;
      const isValidLang = hreflang === "x-default" || /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(hreflang);
      hreflangTags.push({
        hreflang,
        href: rawHref,
        resolvedUrl,
        isValidLang,
      });
    }
  });

  // Headings Parsing (Canonical single source of truth)
  const headingResult = extractAndValidateHeadings($);
  let h1Tags = headingResult.h1s;
  const h2Tags = headingResult.outline.filter((h) => h.level === 2).map((h) => h.text);
  const h3Tags = headingResult.outline.filter((h) => h.level === 3).map((h) => h.text);

  // Content Word Counts (Raw Document, Visible Body, Main Content)
  const wordBreakdown = extractDetailedWordCounts($);
  const rawDocumentWordCount = wordBreakdown.rawDocumentWordCount;
  const visibleBodyWordCount = wordBreakdown.visibleBodyWordCount;
  const mainContentWordCount = wordBreakdown.mainContentWordCount;
  const wordCount = wordBreakdown.wordCount;
  const mainText = wordBreakdown.visibleBodyText;

  const htmlByteLength = Buffer.byteLength(html, "utf8");
  const textByteLength = Buffer.byteLength(mainText, "utf8");
  const textToHtmlRatio = htmlByteLength > 0 ? (textByteLength / htmlByteLength) * 100 : 0;

  // Landmarks & Forms
  const landmarks = extractLandmarks($);
  const forms = extractForms($);

  // Images Analysis with Detailed Alt States
  const images: ImageAsset[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src")?.trim() || "";
    if (!src) return;
    const resolvedUrl = resolveAbsoluteHref(src, finalUrl) || src;
    const altAttr = $(el).attr("alt");
    const hasAlt = altAttr !== undefined;
    const altText = hasAlt ? altAttr.trim() : null;
    const isDecorative = hasAlt && altText === "";
    const isLinked = $(el).parents("a").length > 0;

    let altState: ImageAltState = "missing_alt_attribute";
    if (hasAlt) {
      if (altText && altText.length > 0) {
        altState = "descriptive_alt_present";
      } else if (isLinked) {
        altState = "empty_alt_suspicious";
      } else {
        altState = "empty_alt_decorative";
      }
    }

    const width = parseInt($(el).attr("width") || "0", 10) || null;
    const height = parseInt($(el).attr("height") || "0", 10) || null;

    images.push({
      src,
      resolvedUrl,
      alt: altText,
      altText,
      altState,
      hasAltAttribute: hasAlt,
      isDecorative,
      isLinked,
      accessibleContext: isLinked ? $(el).parents("a").attr("aria-label") || null : null,
      width,
      height,
      hasDimensions: Boolean(width && height),
      srcset: $(el).attr("srcset") || null,
      loading: $(el).attr("loading") || null,
      format: resolvedUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || null,
    });
  });

  // Resources (CSS, JS)
  const resources: ResourceAsset[] = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr("src")?.trim();
    if (src) {
      const resolved = resolveAbsoluteHref(src, finalUrl) || src;
      const isAsync = $(el).attr("async") !== undefined;
      const isDefer = $(el).attr("defer") !== undefined;
      const isModule = $(el).attr("type") === "module";
      resources.push({
        url: src,
        resolvedUrl: resolved,
        type: "script",
        isRenderBlocking: !isAsync && !isDefer && !isModule,
      });
    }
  });

  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (href) {
      const resolved = resolveAbsoluteHref(href, finalUrl) || href;
      const media = $(el).attr("media");
      resources.push({
        url: href,
        resolvedUrl: resolved,
        type: "stylesheet",
        isRenderBlocking: !media || media === "all" || media === "screen",
      });
    }
  });

  // Outlinks with Accessible Name & Strict Navigational Contract
  const outlinks: OutlinkEntry[] = [];
  $("a[href], area[href]").each((_, el) => {
    // Exclude non-anchor SVG elements (e.g. <textPath href="#...">, <use href="#...">)
    const tagName = (el.tagName || "").toLowerCase();
    const isInsideSvg = $(el).parents("svg").length > 0;
    if (isInsideSvg && tagName !== "a") {
      return;
    }

    const rawHref = $(el).attr("href")?.trim() || $(el).attr("xlink:href")?.trim();
    if (!rawHref || !isValidNavigationalCandidate(rawHref)) return;

    const resolvedAbsoluteHref = resolveAbsoluteHref(rawHref, finalUrl);
    if (!resolvedAbsoluteHref) return;

    const normalizedTarget = normalizeUrl(rawHref, finalUrl);
    if (!normalizedTarget) return;

    const linkClassification = classifyLinkType(rawHref, resolvedAbsoluteHref, seedUrl, allowSubdomains);
    if (linkClassification === "invalid" || linkClassification === "placeholder_hash" || linkClassification === "fragment") {
      return;
    }

    const anchorText = $(el).text().replace(/\s+/g, " ").trim();
    const accessibleName = calculateAccessibleName($(el), $);
    const rel = $(el).attr("rel")?.toLowerCase() || "";
    const isInternal = linkClassification === "internal_navigation";
    const isNofollow = rel.includes("nofollow");

    outlinks.push({
      targetUrl: rawHref,
      rawHref,
      resolvedAbsoluteHref,
      normalizedTargetUrl: normalizedTarget,
      anchorText,
      accessibleName,
      hasAccessibleName: accessibleName.length > 0,
      linkClassification,
      rel,
      isInternal,
      isNofollow,
      provenance: {
        sourcePage: finalUrl,
        domElement: tagName,
        attributeName: $(el).attr("href") !== undefined ? "href" : "xlink:href",
        rawValue: rawHref,
        normalizedUrl: normalizedTarget,
        discoveryMethod: tagName === "area" ? "area_tag" : "anchor_tag",
      },
    });
  });

  // Open Graph Detailed Component Extraction & Validation
  const rawOgTags: Array<{ property: string; content: string; source: "raw_html" | "rendered_dom" }> = [];
  const ogPropsCount = new Map<string, number>();
  const duplicateOgTags: string[] = [];
  const emptyOgTags: string[] = [];

  $('meta[property^="og:" i], meta[name^="og:" i]').each((_, el) => {
    const prop = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase().trim();
    const content = $(el).attr("content") || "";
    rawOgTags.push({ property: prop, content, source: "raw_html" });
    ogPropsCount.set(prop, (ogPropsCount.get(prop) || 0) + 1);
    if (!content.trim()) emptyOgTags.push(prop);
  });

  for (const [prop, count] of ogPropsCount.entries()) {
    if (count > 1 && !duplicateOgTags.includes(prop) && prop !== "og:image") {
      duplicateOgTags.push(prop);
    }
  }

  const ogTitle = $('meta[property="og:title" i], meta[name="og:title" i]').attr("content")?.trim() || null;
  const ogDescription = $('meta[property="og:description" i], meta[name="og:description" i]').attr("content")?.trim() || null;
  const ogImageRaw = $('meta[property="og:image" i], meta[name="og:image" i]').attr("content")?.trim() || null;
  const ogUrl = $('meta[property="og:url" i], meta[name="og:url" i]').attr("content")?.trim() || null;
  const ogType = $('meta[property="og:type" i], meta[name="og:type" i]').attr("content")?.trim() || null;
  const ogSiteName = $('meta[property="og:site_name" i], meta[name="og:site_name" i]').attr("content")?.trim() || null;

  let resolvedOgImageUrl: string | null = null;
  let isImageAbsolute = false;
  let isImageValidFormat = true;
  if (ogImageRaw) {
    resolvedOgImageUrl = resolveAbsoluteHref(ogImageRaw, finalUrl) || ogImageRaw;
    isImageAbsolute = /^https?:\/\//i.test(ogImageRaw);
    isImageValidFormat = !/\s/.test(ogImageRaw) && (isImageAbsolute || ogImageRaw.startsWith("/"));
  }

  const missingRequiredOgTags: string[] = [];
  if (!ogTitle) missingRequiredOgTags.push("og:title");
  if (!ogDescription) missingRequiredOgTags.push("og:description");
  if (!ogImageRaw) missingRequiredOgTags.push("og:image");
  if (!ogUrl) missingRequiredOgTags.push("og:url");
  if (!ogType) missingRequiredOgTags.push("og:type");

  let canonicalConsistent = true;
  if (ogUrl && normalizedCanonical) {
    const normalizedOgUrl = normalizeUrl(ogUrl, finalUrl);
    canonicalConsistent = normalizedOgUrl === normalizedCanonical;
  }

  let ogValidationStatus: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_EVALUATED" = "PASS";
  if (missingRequiredOgTags.length > 0 || !isImageValidFormat || emptyOgTags.length > 0) {
    ogValidationStatus = missingRequiredOgTags.length === 5 ? "FAIL" : "INCOMPLETE";
  }

  let imageFetchState: OgImageFetchState = "FETCH_NOT_EVALUATED";
  let imageFetchStatus: number | null = null;
  let isImageBroken = false;

  if (headers["x-og-image-status"]) {
    const status = parseInt(String(headers["x-og-image-status"]), 10);
    imageFetchStatus = status;
    if (status >= 200 && status < 400) {
      imageFetchState = "FETCH_CONFIRMED";
    } else if (status === 403 || status === 401) {
      imageFetchState = "FETCH_BLOCKED";
    } else if (status >= 400) {
      imageFetchState = "FETCH_FAILED";
      isImageBroken = true;
    }
  }

  const openGraph: OpenGraphData = {
    title: ogTitle,
    description: ogDescription,
    image: ogImageRaw,
    resolvedImageUrl: resolvedOgImageUrl,
    imageFetchState,
    imageFetchStatus,
    isImageBroken,
    isImageAbsolute,
    isImageValidFormat,
    url: ogUrl,
    type: ogType,
    siteName: ogSiteName,
    rawTags: rawOgTags,
    missingRequiredTags: missingRequiredOgTags,
    duplicateTags: duplicateOgTags,
    emptyTags: emptyOgTags,
    canonicalConsistent,
    validationStatus: ogValidationStatus,
  };

  // Twitter Card Component Extraction & OG Fallback Evaluation
  const rawTwitterTags: Array<{ property: string; content: string; source: "raw_html" | "rendered_dom" }> = [];
  $('meta[name^="twitter:" i], meta[property^="twitter:" i]').each((_, el) => {
    const prop = ($(el).attr("name") || $(el).attr("property") || "").toLowerCase().trim();
    const content = $(el).attr("content") || "";
    rawTwitterTags.push({ property: prop, content, source: "raw_html" });
  });

  const twitterCardTag = $('meta[name="twitter:card" i], meta[property="twitter:card" i]').attr("content")?.trim() || null;
  const twitterTitle = $('meta[name="twitter:title" i], meta[property="twitter:title" i]').attr("content")?.trim() || null;
  const twitterDescription = $('meta[name="twitter:description" i], meta[property="twitter:description" i]').attr("content")?.trim() || null;
  const twitterImageRaw = $('meta[name="twitter:image" i], meta[property="twitter:image" i]').attr("content")?.trim() || null;
  const twitterSite = $('meta[name="twitter:site" i], meta[property="twitter:site" i]').attr("content")?.trim() || null;
  const twitterCreator = $('meta[name="twitter:creator" i], meta[property="twitter:creator" i]').attr("content")?.trim() || null;

  const missingTwitterTags: string[] = [];
  if (!twitterCardTag) missingTwitterTags.push("twitter:card");
  if (!twitterTitle) missingTwitterTags.push("twitter:title");
  if (!twitterDescription) missingTwitterTags.push("twitter:description");
  if (!twitterImageRaw) missingTwitterTags.push("twitter:image");

  const hasOgFallback = Boolean(ogTitle || ogDescription || ogImageRaw);
  const ogFallbackDetails = {
    hasTitle: Boolean(ogTitle),
    hasDescription: Boolean(ogDescription),
    hasImage: Boolean(ogImageRaw),
  };

  let twitterValidationStatus: "PASS" | "FALLBACK_OG_PASS" | "FAIL" | "NOT_EVALUATED" = "PASS";
  if (!twitterCardTag && !twitterTitle && !twitterImageRaw) {
    twitterValidationStatus = hasOgFallback ? "FALLBACK_OG_PASS" : "FAIL";
  }

  const twitterCard = {
    card: twitterCardTag,
    title: twitterTitle,
    description: twitterDescription,
    image: twitterImageRaw,
    resolvedImageUrl: twitterImageRaw ? (resolveAbsoluteHref(twitterImageRaw, finalUrl) || twitterImageRaw) : null,
    site: twitterSite,
    creator: twitterCreator,
    rawTags: rawTwitterTags,
    missingTags: missingTwitterTags,
    hasExplicitCard: Boolean(twitterCardTag),
    hasOgFallback,
    ogFallbackDetails,
    validationStatus: twitterValidationStatus,
  };

  // Structured Data (JSON-LD) with exact parse error capture
  const schemaJsonLd: JsonLdBlock[] = [];
  $('script[type="application/ld+json"]').each((idx, el) => {
    const raw = $(el).html()?.trim() || "";
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const types: string[] = [];

      const extractTypes = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (obj["@type"]) {
          if (Array.isArray(obj["@type"])) types.push(...obj["@type"]);
          else types.push(String(obj["@type"]));
        }
        if (Array.isArray(obj["@graph"])) {
          obj["@graph"].forEach(extractTypes);
        }
      };
      extractTypes(parsed);

      schemaJsonLd.push({
        blockIndex: idx,
        raw,
        parsed,
        parsedSuccessfully: true,
        parserError: null,
        parserErrorPosition: null,
        rawLength: raw.length,
        types,
        schemaOrgValid: types.length > 0,
        errors: types.length === 0 ? ["Missing @type in JSON-LD root or graph"] : [],
      });
    } catch (err: any) {
      const posMatch = err.message?.match(/position\s+(\d+)/i);
      const parserErrorPosition = posMatch ? parseInt(posMatch[1], 10) : null;

      schemaJsonLd.push({
        blockIndex: idx,
        raw,
        parsed: null,
        parsedSuccessfully: false,
        parserError: err.message,
        parserErrorPosition,
        rawLength: raw.length,
        types: [],
        schemaOrgValid: false,
        errors: [`JSON syntax error: ${err.message}`],
      });
    }
  });

  let renderMode: RenderMode = "raw";
  let renderReason = "static_html";
  let renderConfidence: RenderConfidence = "high";
  let renderedWordCount = wordCount;
  let renderedH1Count = h1Tags.length;
  let renderedTitle = title;
  let structuredDataJobTitle: string | null = null;
  let soft404Status: Soft404Status = "valid_page";

  const lowerHtml = html.toLowerCase();
  const hasEmbeddedJobData = lowerHtml.includes("jobposting") || lowerHtml.includes("apply-button") || lowerHtml.includes("job-description");
  const isSuspiciousThinShell = wordCount < 50 && (hasEmbeddedJobData || lowerHtml.includes("__next_data__") || lowerHtml.includes("w-dyn-list"));

  if (isSuspiciousThinShell) {
    renderMode = "schema_enriched";
    renderReason = "dynamic_cms_shell_schema_enriched";
    renderConfidence = "manual_review";

    // Extract job title or description from embedded JSON schema without fabricating DOM H1
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || "{}");
        if (data.title) {
          structuredDataJobTitle = String(data.title).trim();
          renderedTitle = structuredDataJobTitle;
        }
        if (data.description) {
          const descWords = String(data.description).split(/\s+/).filter(Boolean).length;
          renderedWordCount = Math.max(renderedWordCount, descWords);
        }
      } catch {}
    });
  }

  // Soft-404 Detection on HTTP 200
  if (statusCode === 200) {
    const is404Text = lowerHtml.includes("page not found") || lowerHtml.includes("404 not found") || (wordCount < 10 && title?.toLowerCase().includes("not found"));
    if (is404Text) {
      soft404Status = "confirmed_soft_404";
    } else if (isSuspiciousThinShell) {
      soft404Status = "empty_dynamic_shell";
    }
  }

  const schemaTypes = schemaJsonLd.flatMap((s) => s.types);
  const hasForm = forms.length > 0;
  const classification = classifyPage(
    finalUrl,
    title,
    h1Tags[0] || null,
    schemaTypes,
    wordCount,
    hasForm,
    statusCode,
  );

  // Precise Indexability Determination
  let isIndexable = true;
  let indexabilityStatus: import("./types").IndexabilityStatus = "indexable";

  if (resourceType !== "html_page" || classification.primaryClass === "sitemap_resource" || classification.primaryClass === "utility_endpoint") {
    isIndexable = false;
    indexabilityStatus = "utility_resource";
  } else if (statusCode >= 400 || (redirectHops.length > 0 && statusCode >= 300 && statusCode < 400)) {
    isIndexable = false;
    indexabilityStatus = "technically_non_indexable";
  } else if (isDisallowedByRobots || hasNoindex || soft404Status === "confirmed_soft_404") {
    isIndexable = false;
    indexabilityStatus = "intentionally_non_indexable";
  } else if (normalizedCanonical && !isCanonicalSelfReferencing) {
    isIndexable = false;
    indexabilityStatus = "technically_non_indexable";
  } else if (classification.primaryClass === "thank_you_confirmation" || classification.primaryClass === "search_filter") {
    isIndexable = false;
    indexabilityStatus = "intentionally_non_indexable";
  } else if (classification.primaryClass === "duplicate_job_candidate") {
    isIndexable = false;
    indexabilityStatus = "unknown_manual_review";
  }

  // Social OpenGraph Fallback completeness check
  const fallbackOgTitle = openGraph?.title?.trim() || null;
  const fallbackOgImage = openGraph?.image?.trim() || null;
  const fallbackOgDescription = openGraph?.description?.trim() || null;
  const missingOgTitle = !fallbackOgTitle;
  const missingOgImage = !fallbackOgImage;
  const missingOgDescription = !fallbackOgDescription;
  const isFallbackIncomplete = Boolean(missingOgTitle || missingOgImage || missingOgDescription);
  const socialOpenGraphFallbackIssues = {
    missingTitle: missingOgTitle,
    missingImage: missingOgImage,
    missingDescription: missingOgDescription,
    isFallbackIncomplete,
  };

  // Legacy Image Formats Check (> 100 KB PNG/JPEG where WebP/AVIF is recommended)
  const legacyFormatImages: Array<{ url: string; format: string; byteSize: number }> = [];
  images.forEach((img) => {
    const resolved = (img.resolvedUrl || img.src || "").toLowerCase();
    const isJpegOrPng = resolved.endsWith(".jpg") || resolved.endsWith(".jpeg") || resolved.endsWith(".png");
    if (isJpegOrPng && img.byteSize && img.byteSize > 102400) {
      const format = resolved.endsWith(".png") ? "PNG" : "JPEG";
      legacyFormatImages.push({
        url: img.resolvedUrl || img.src,
        format,
        byteSize: img.byteSize,
      });
    }
  });

  // Unminified Resource Assets Check (internal CSS/JS > 20 KB without .min)
  const unminifiedResources: Array<{ url: string; type: "css" | "js"; byteSize: number }> = [];
  resources.forEach((res) => {
    const resUrl = (res.resolvedUrl || res.url || "").toLowerCase();
    const isInternal = resUrl.startsWith("/") || (currentHost && resUrl.includes(currentHost));
    const isCssOrJs = res.type === "script" || res.type === "stylesheet" || resUrl.endsWith(".js") || resUrl.endsWith(".css");
    const isAlreadyMinified = resUrl.includes(".min.") || resUrl.includes("-min.") || resUrl.includes(".bundle.");
    if (isInternal && isCssOrJs && !isAlreadyMinified && res.byteSize && res.byteSize > 20480) {
      unminifiedResources.push({
        url: res.resolvedUrl || res.url,
        type: res.type === "stylesheet" || resUrl.endsWith(".css") ? "css" : "js",
        byteSize: res.byteSize,
      });
    }
  });

  return {
    url,
    requestedUrl: url,
    normalizedUrl,
    finalUrl,
    statusCode,
    redirectHops,
    contentType,
    resourceType,
    responseTimeMs,
    depth,
    html,
    headers,
    crawledAt: new Date().toISOString(),
    sourceMode: "raw_http",

    // Evidence Fact Populations
    rawFacts: {
      title,
      metaDescription,
      canonicalUrl: normalizedCanonical,
      h1Count: headingResult.h1s.length,
      h1Texts: headingResult.h1s,
      forms,
      formCount: forms.length,
      unlabelledFormControlCount: forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
      missingAltCount: images.filter((img) => !img.hasAltAttribute).length,
      images,
      rawDocumentWordCount,
      visibleBodyWordCount,
      mainContentWordCount,
      landmarks,
      hasMainLandmark: landmarks.hasMain,
      headingsOutline: headingResult.outline,
      htmlLang,
      buttons,
      iframes,
      isCompressionEnabled,
      htmlCharset,
      hasValidCharset,
      deprecatedHtmlTags,
      targetBlankWithoutNoopenerLinks,
      socialOpenGraphFallbackIssues,
      lazyLoadingStats,
      legacyFormatImages,
      unminifiedResources,
    },
    renderedFacts: {
      attempted: Boolean(headers["x-render-canon-diff"] || headers["x-render-title-diff"]),
      success: Boolean(headers["x-render-canon-diff"] || headers["x-render-title-diff"]),
      canonicalUrl: headers["x-render-canon-diff"] ? String(headers["x-render-canon-diff"]) : normalizedCanonical,
      title: headers["x-render-title-diff"] ? String(headers["x-render-title-diff"]) : title,
    },
    hasMetaRefresh: Boolean(headers["x-meta-refresh"] || $('meta[http-equiv="refresh" i]').length > 0),
    metaRefreshTarget: $('meta[http-equiv="refresh" i]').attr("content") || (headers["x-meta-refresh"] ? "/target" : null),
    robotsHasNoSitemap: Boolean(headers["x-robots-no-sitemap"]),
    authoritativeFacts: {
      source: "raw",
      title: renderedTitle || title,
      metaDescription,
      canonicalUrl: normalizedCanonical,
      h1Count: h1Tags.length,
      h1Texts: h1Tags,
      forms,
      formCount: forms.length,
      unlabelledFormControlCount: forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
      missingAltCount: images.filter((img) => !img.hasAltAttribute).length,
      images,
      rawDocumentWordCount,
      visibleBodyWordCount,
      mainContentWordCount,
      wordCount,
      mainText: mainText.slice(0, 1000),
      landmarks,
      hasMainLandmark: landmarks.hasMain,
      headingsOutline: headingResult.outline,
      htmlLang,
      buttons,
      iframes,
      isCompressionEnabled,
      htmlCharset,
      hasValidCharset,
      deprecatedHtmlTags,
      targetBlankWithoutNoopenerLinks,
      socialOpenGraphFallbackIssues,
      lazyLoadingStats,
      legacyFormatImages,
      unminifiedResources,
      renderReason,
      renderConfidence,
    },

    // Rendering Facts
    renderMode,
    renderReason,
    renderConfidence,
    rawWordCount: rawDocumentWordCount,
    rawDocumentWordCount,
    visibleBodyWordCount,
    mainContentWordCount,
    renderedWordCount,
    rawH1Count: headingResult.h1s.length,
    renderedH1Count,
    rawTitle: title,
    renderedTitle,
    structuredDataJobTitle,
    soft404Status,

    // Extracted Canonical DOM Features
    title: renderedTitle || title,
    titleLength: (renderedTitle || title)?.length || 0,
    metaDescription,
    metaDescriptionLength: metaDescription ? metaDescription.length : 0,
    canonicalUrl: normalizedCanonical,
    isCanonicalSelfReferencing,
    isCanonicalTargetReachable: true,
    metaRobots,
    xRobotsTag,
    isIndexable,
    indexabilityStatus,
    h1s: h1Tags,
    h1Count: h1Tags.length,
    h1Tags,
    h2Tags,
    h3Tags,
    headingsOutline: headingResult.outline,
    headingsHierarchyValid: headingResult.valid,
    headingsHierarchyIssues: headingResult.issues,
    wordCount: renderedWordCount,
    textToHtmlRatio,
    landmarks,
    forms,
    images,
    resources,
    outlinks,
    openGraph,
    twitterCard,
    schemaJsonLd,
    classification,
    mainTextSnippet: mainText.slice(0, 300),

    // Extended SEO Fields
    allCanonicalTags,
    viewport,
    hreflangTags,
    mixedContentResources: (() => {
      const isHttps = finalUrl.startsWith("https://") || url.startsWith("https://");
      if (!isHttps) return [];
      const mixed: Array<{ url: string; type: "image" | "script" | "stylesheet" }> = [];
      images.forEach((img) => {
        if (img.resolvedUrl?.startsWith("http://")) mixed.push({ url: img.resolvedUrl, type: "image" });
      });
      resources.forEach((res) => {
        if (res.resolvedUrl?.startsWith("http://") && (res.type === "script" || res.type === "stylesheet")) {
          mixed.push({ url: res.resolvedUrl, type: res.type });
        }
      });
      return mixed;
    })(),
    titleTagsCount,
    metaDescriptionTagsCount,
    rawHtmlByteLength: htmlByteLength,
    robotsDirectives,
    htmlLang,
    buttons,
    iframes,
    isCompressionEnabled,
    htmlCharset,
    hasValidCharset,
    deprecatedHtmlTags,
    targetBlankWithoutNoopenerLinks,
    socialOpenGraphFallbackIssues,
    lazyLoadingStats,
    legacyFormatImages,
    unminifiedResources,
  };
}


