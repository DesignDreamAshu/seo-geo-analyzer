import * as cheerio from "cheerio";
import { normalizeUrl, isUrlInScope, classifyResourceType, resolveAbsoluteHref, classifyLinkType } from "./normalizer";
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
      const type = $ctrl.attr("type")?.toLowerCase() || (tag === "textarea" ? "textarea" : "text");
      const name = $ctrl.attr("name");
      const id = $ctrl.attr("id");

      // Skip hidden or submit inputs from unlabelled warnings
      if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "reset") {
        return;
      }

      let accessibleName: string | null = null;
      let isLabelled = false;

      // 1. aria-label or aria-labelledby
      const ariaLabel = $ctrl.attr("aria-label")?.trim();
      if (ariaLabel) {
        accessibleName = ariaLabel;
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
      if (!isLabelled) {
        const title = $ctrl.attr("title")?.trim();
        if (title) {
          accessibleName = title;
          isLabelled = true;
        } else {
          const placeholder = $ctrl.attr("placeholder")?.trim();
          if (placeholder) {
            accessibleName = placeholder;
          }
        }
      }

      controls.push({
        tag,
        type,
        name,
        id,
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
}

/**
 * Extracts clean text populations: raw document, visible body (excluding chrome), and main content container.
 */
export function extractDetailedWordCounts($: cheerio.CheerioAPI): WordCountBreakdown {
  // 1. Raw Document Text (stripping only non-content machine tags)
  const rawClone = $.load($.html());
  rawClone("script, style, noscript, svg").remove();
  const rawDocText = rawClone("body").text().replace(/\s+/g, " ").trim();
  const rawDocWords = rawDocText ? rawDocText.split(/\s+/).filter(Boolean).length : 0;

  // 2. Visible Body Text (stripping nav, footer, header chrome)
  const bodyClone = $.load($.html());
  bodyClone("script, style, noscript, svg, nav, footer, header, [role='navigation'], [role='banner'], .cookie-banner, #cookie-notice, .modal, .popup").remove();
  const visBodyText = bodyClone("body").text().replace(/\s+/g, " ").trim();
  const visBodyWords = visBodyText ? visBodyText.split(/\s+/).filter(Boolean).length : 0;

  // 3. Main Content Text (focusing on <main> or [role='main'] or #main-content)
  let mainText = "";
  let mainWords = 0;
  const mainEl = $("main, [role='main'], #main-content, .main-content");
  if (mainEl.length > 0) {
    const mainClone = $.load(mainEl.first().html() || "");
    mainClone("script, style, noscript, svg, nav, footer, header").remove();
    mainText = mainClone.text().replace(/\s+/g, " ").trim();
    mainWords = mainText ? mainText.split(/\s+/).filter(Boolean).length : 0;
  } else {
    mainText = visBodyText;
    mainWords = visBodyWords;
  }

  return {
    rawDocumentText: rawDocText,
    rawDocumentWordCount: rawDocWords,
    visibleBodyText: visBodyText,
    visibleBodyWordCount: visBodyWords,
    mainContentText: mainText,
    mainContentWordCount: mainWords,
    wordCount: mainWords > 0 ? mainWords : visBodyWords,
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
  if (path.includes("sitemap") || path.endsWith(".xml")) {
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

  // 6. Form / Application
  if (path.includes("apply") || path.includes("application") || path.includes("register") || path.includes("signup") || path.includes("login")) {
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
 * Validates the heading hierarchy in the DOM context and extracts outline with evidence.
 */
export function extractAndValidateHeadings($: cheerio.CheerioAPI): {
  h1s: string[];
  outline: HeadingOutlineItem[];
  valid: boolean;
  issues: string[];
  skippedTransitions: Array<{ fromLevel: number; toLevel: number; fromText: string; toText: string; selector?: string }>;
} {
  const issues: string[] = [];
  const h1s: string[] = [];
  const outline: HeadingOutlineItem[] = [];
  const skippedTransitions: Array<{ fromLevel: number; toLevel: number; fromText: string; toText: string; selector?: string }> = [];

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tagName = (el as any).tagName?.toLowerCase() || "h1";
    const level = parseInt(tagName.replace("h", ""), 10) || 1;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;

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

  // Check skipped levels in main content only (avoiding nav/footer false positives)
  const mainHeadings = outline.filter((h) => h.inMainContent);
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
    h1s,
    outline,
    valid: issues.length === 0,
    issues,
    skippedTransitions,
  };
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
  const metaDescription = $('meta[name="description" i]').attr("content")?.trim() || null;
  const canonicalHref = $('link[rel="canonical" i]').attr("href")?.trim() || null;
  const normalizedCanonical = canonicalHref ? normalizeUrl(canonicalHref, finalUrl) : null;

  const isCanonicalSelfReferencing = Boolean(
    normalizedCanonical && (normalizedCanonical === normalizedUrl || normalizedCanonical === normalizeUrl(finalUrl))
  );

  // Meta Robots & X-Robots-Tag
  const metaRobots = $('meta[name="robots" i]').attr("content")?.trim() || null;
  const rawXRobots = headers["x-robots-tag"];
  const xRobotsTag = Array.isArray(rawXRobots) ? rawXRobots.join(", ") : (rawXRobots ? String(rawXRobots) : null);

  const combinedRobotsDirectives = `${metaRobots || ""} ${xRobotsTag || ""}`.toLowerCase();
  const hasNoindex = combinedRobotsDirectives.includes("noindex");

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

  // Outlinks with Accessible Name & Link Classification
  const outlinks: OutlinkEntry[] = [];
  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href")?.trim();
    if (!rawHref) return;

    const resolvedAbsoluteHref = resolveAbsoluteHref(rawHref, finalUrl) || rawHref;
    const normalizedTarget = normalizeUrl(rawHref, finalUrl);
    const linkClassification = classifyLinkType(rawHref, resolvedAbsoluteHref, seedUrl, allowSubdomains);
    const anchorText = $(el).text().replace(/\s+/g, " ").trim();
    const accessibleName = calculateAccessibleName($(el), $);
    const rel = $(el).attr("rel")?.toLowerCase() || "";
    const isInternal = linkClassification === "internal_navigation";
    const isNofollow = rel.includes("nofollow");

    outlinks.push({
      targetUrl: rawHref,
      rawHref,
      resolvedAbsoluteHref,
      normalizedTargetUrl: normalizedTarget || resolvedAbsoluteHref,
      anchorText,
      accessibleName,
      hasAccessibleName: accessibleName.length > 0,
      linkClassification,
      rel,
      isInternal,
      isNofollow,
    });
  });

  // Open Graph
  const openGraph = {
    title: $('meta[property="og:title" i]').attr("content")?.trim() || null,
    description: $('meta[property="og:description" i]').attr("content")?.trim() || null,
    image: $('meta[property="og:image" i]').attr("content")?.trim() || null,
    url: $('meta[property="og:url" i]').attr("content")?.trim() || null,
    type: $('meta[property="og:type" i]').attr("content")?.trim() || null,
  };

  // Twitter Card
  const twitterCard = {
    card: $('meta[name="twitter:card" i]').attr("content")?.trim() || null,
    title: $('meta[name="twitter:title" i]').attr("content")?.trim() || null,
    description: $('meta[name="twitter:description" i]').attr("content")?.trim() || null,
    image: $('meta[name="twitter:image" i]').attr("content")?.trim() || null,
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
    },
    renderedFacts: {
      attempted: false,
      success: false,
    },
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
      landmarks,
      hasMainLandmark: landmarks.hasMain,
      headingsOutline: headingResult.outline,
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
  };
}


