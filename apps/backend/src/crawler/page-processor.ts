import { parseHtmlPage, validateHeadingOutlineHierarchy } from "./parser";
import { sharedBrowserPool } from "./fetcher";
import type {
  AuthoritativePageFacts,
  CrawledPageData,
  FormFact,
  HeadingOutlineItem,
  ImageAsset,
  LandmarkFacts,
  RawPageFacts,
  RenderDecision,
  RenderedPageFacts,
} from "./types";

export interface PageProcessorOptions {
  seedNormalized: string;
  allowSubdomains?: boolean;
  isDisallowedByRobots?: boolean;
  enableBrowserRendering?: boolean;
  renderBudgetAvailable?: boolean;
}

export function evaluateRenderEligibility(
  page: CrawledPageData,
  renderBudgetAvailable = true
): RenderDecision {
  if (page.resourceType !== "html_page" || page.statusCode !== 200) {
    return {
      evaluated: true,
      eligible: false,
      triggered: false,
      reasons: [],
      skippedReason: "non_html_or_non_200",
      attempted: false,
    };
  }

  const reasons: string[] = [];
  const urlLower = page.url.toLowerCase();
  const pClass = page.classification.primaryClass;
  const rawMainWords = page.mainContentWordCount || page.wordCount;
  const rawVisWords = page.visibleBodyWordCount || page.wordCount;
  const firstH1 = page.h1s[0]?.toLowerCase().trim();

  // 1. Low Main Content on Content Pages / Dynamic CMS routes
  const isContentPage =
    pClass === "marketing_landing" ||
    pClass === "article_blog" ||
    pClass === "active_job" ||
    urlLower.includes("/job-openings/") ||
    urlLower.includes("/servicenow-at-bot") ||
    urlLower.includes("/odyssey") ||
    urlLower.includes("/post/");

  if (isContentPage && (rawMainWords < 80 || rawVisWords < 50)) {
    reasons.push("low_content_dynamic_job");
  }

  // 2. Generic Placeholder or Empty H1 on content pages
  if (firstH1 === "heading" || firstH1 === "title" || firstH1 === "untitled" || firstH1 === "h1") {
    reasons.push("placeholder_h1");
  }

  // 3. Interactive Form Shells where raw DOM has 0 forms
  const isFormPage = pClass === "form_application" || urlLower.includes("/application") || urlLower.includes("/contact");
  if (isFormPage && page.forms.length === 0) {
    reasons.push("application_form_shell");
  }

  // 4. Dynamic CMS Framework Markers with low raw text
  const lowerHtml = (page.html || "").toLowerCase();
  if ((lowerHtml.includes("w-dyn-list") || lowerHtml.includes("__next_data__") || lowerHtml.includes("jobposting")) && rawMainWords < 120) {
    reasons.push("dynamic_cms_shell");
  }

  // 5. Bot Challenge / WAF Interception detection
  const titleLower = (page.title || "").toLowerCase().trim();
  if (titleLower === "access denied" || titleLower.includes("cloudflare") || titleLower.includes("just a moment")) {
    reasons.push("bot_challenge_interception");
  }

  const eligible = reasons.length > 0;

  if (!eligible) {
    return {
      evaluated: true,
      eligible: false,
      triggered: false,
      reasons: [],
      skippedReason: "static_complete",
      attempted: false,
    };
  }

  if (!renderBudgetAvailable) {
    return {
      evaluated: true,
      eligible: true,
      triggered: false,
      reasons,
      skippedReason: "budget_exhausted",
      attempted: false,
    };
  }

  return {
    evaluated: true,
    eligible: true,
    triggered: true,
    reasons,
    attempted: false,
  };
}

/**
 * Unified Authoritative Page Processor used by both real audit crawl and verification parity.
 */
export async function processPageAuthoritatively(
  url: string,
  normalizedUrl: string,
  finalUrl: string,
  statusCode: number,
  redirectHops: any[],
  html: string,
  headers: Record<string, string | string[] | undefined>,
  responseTimeMs: number,
  depth: number,
  options: PageProcessorOptions
): Promise<CrawledPageData> {
  // 1. Initial Raw HTML Parsing
  const pageData = parseHtmlPage(
    url,
    normalizedUrl,
    finalUrl,
    statusCode,
    redirectHops,
    html,
    headers,
    responseTimeMs,
    depth,
    options.seedNormalized,
    options.allowSubdomains || false,
    options.isDisallowedByRobots || false
  );

  // 2. Build Immutable Raw Facts Snapshot
  const rawFacts: RawPageFacts = {
    title: pageData.title,
    metaDescription: pageData.metaDescription,
    canonicalUrl: pageData.canonicalUrl,
    h1Count: pageData.h1Count,
    h1Texts: [...pageData.h1s],
    forms: JSON.parse(JSON.stringify(pageData.forms)),
    formCount: pageData.forms.length,
    unlabelledFormControlCount: pageData.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
    missingAltCount: pageData.images.filter((img) => !img.hasAltAttribute).length,
    images: JSON.parse(JSON.stringify(pageData.images)),
    rawDocumentWordCount: pageData.rawDocumentWordCount || pageData.rawWordCount,
    visibleBodyWordCount: pageData.visibleBodyWordCount || pageData.wordCount,
    mainContentWordCount: pageData.mainContentWordCount || pageData.wordCount,
    landmarks: { ...pageData.landmarks },
    hasMainLandmark: pageData.landmarks.hasMain,
    headingsOutline: JSON.parse(JSON.stringify(pageData.headingsOutline || [])),
  };
  pageData.rawFacts = rawFacts;

  // 3. Evaluate Render Decision
  const renderDecision = evaluateRenderEligibility(pageData, options.renderBudgetAvailable !== false);
  pageData.renderDecision = renderDecision;

  if (renderDecision.triggered && options.enableBrowserRendering !== false) {
    renderDecision.attempted = true;

    try {
      const browser = await sharedBrowserPool.getBrowser();
      if (browser) {
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        });
        let renderedDom: any;
        try {
          const pwPage = await context.newPage();
          await pwPage.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
          await pwPage.waitForTimeout(300);

          renderedDom = await pwPage.evaluate(() => {
            const docTitle = document.title ? document.title.trim() : null;
            const metaDesc =
              document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
            const canonicalTag =
              document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;

            const h1Nodes = Array.from(document.querySelectorAll("h1"));
            const h1Texts = h1Nodes.map((n) => (n.textContent || "").trim()).filter(Boolean);

            const hOutline: Array<{ level: number; text: string; inMainContent: boolean; context: "main" | "nav" | "header" | "footer" | "aside" | "component" }> = [];
            document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
              const level = parseInt(el.tagName.substring(1), 10);
              const text = (el.textContent || "").trim();
              const inMain = Boolean(el.closest("main, [role='main'], article"));
              if (text) hOutline.push({ level, text, inMainContent: inMain, context: inMain ? "main" : "component" });
            });

            // Main content words
            const mainEl = document.querySelector("main, [role='main'], #main-content, .main-content, article") as HTMLElement | null;
            const bodyClone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
            let visWords = 0;
            if (bodyClone) {
              bodyClone.querySelectorAll("script, style, noscript, svg, nav, footer, header").forEach((el) => el.remove());
              const t = (bodyClone.innerText || "").replace(/\s+/g, " ").trim();
              visWords = t ? t.split(/\s+/).filter(Boolean).length : 0;
            }
            let mainWords = visWords;
            if (mainEl) {
              const mc = mainEl.cloneNode(true) as HTMLElement;
              mc.querySelectorAll("script, style, noscript, svg, nav, footer, header").forEach((el) => el.remove());
              const mt = (mc.innerText || "").replace(/\s+/g, " ").trim();
              mainWords = mt ? mt.split(/\s+/).filter(Boolean).length : visWords;
            }

            const forms = Array.from(document.querySelectorAll("form")).map((f) => {
              const isInsideNavOrFooter = Boolean(f.closest("nav, footer, header, [role='navigation'], [role='banner']"));
              const formClass = isInsideNavOrFooter ? "global_template_form" : "page_primary_form";
              const inputs = Array.from(
                f.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select")
              );
              let unlabelled = 0;
              inputs.forEach((input) => {
                const id = input.getAttribute("id");
                const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
                const hasAria = Boolean(input.getAttribute("aria-label") || input.getAttribute("aria-labelledby"));
                const isWrapped = Boolean(input.closest("label"));
                if (!hasLabel && !hasAria && !isWrapped) unlabelled++;
              });
              return {
                id: f.id || undefined,
                action: f.action || undefined,
                method: f.method || undefined,
                controlCount: inputs.length,
                unlabelledCount: unlabelled,
                formClassification: formClass as any,
                controls: inputs.map((c) => ({
                  tag: c.tagName.toLowerCase(),
                  type: c.getAttribute("type") || undefined,
                  name: c.getAttribute("name") || undefined,
                  id: c.getAttribute("id") || undefined,
                  accessibleName: c.getAttribute("aria-label") || null,
                  isLabelled: Boolean(
                    c.getAttribute("aria-label") ||
                      (c.id && document.querySelector(`label[for="${c.id}"]`)) ||
                      c.closest("label")
                  ),
                })),
              };
            });

            const imgNodes = Array.from(document.querySelectorAll("img"));
            const missingAlt = imgNodes.filter((img) => !img.hasAttribute("alt")).length;
            const images = imgNodes.map((img) => ({
              url: img.src || "",
              src: img.src || "",
              rawSrc: img.getAttribute("src") || "",
              alt: img.getAttribute("alt") || null,
              altText: img.getAttribute("alt") || null,
              hasAltAttribute: img.hasAttribute("alt"),
              altState: (img.hasAttribute("alt")
                ? (img.getAttribute("alt")?.trim() ? "descriptive_alt_present" : "empty_alt_decorative")
                : "missing_alt_attribute") as any,
              width: null,
              height: null,
              isLazyLoaded: img.getAttribute("loading") === "lazy",
              isExternal: false,
              isDecorative: img.hasAttribute("alt") && !img.getAttribute("alt")?.trim(),
              isLinked: Boolean(img.closest("a")),
            }));

            const mainNodes = document.querySelectorAll("main, [role='main']");
            const hasMain = mainNodes.length > 0;
            const landmarks = {
              hasMain,
              mainCount: mainNodes.length,
              navCount: document.querySelectorAll("nav, [role='navigation']").length,
              footerCount: document.querySelectorAll("footer, [role='contentinfo']").length,
              headerCount: document.querySelectorAll("header, [role='banner']").length,
              asideCount: document.querySelectorAll("aside, [role='complementary']").length,
            };

            return {
              docTitle,
              metaDesc,
              canonicalTag,
              h1Texts,
              hOutline,
              visWords,
              mainWords,
              forms,
              images,
              missingAlt,
              landmarks,
            };
          });
        } finally {
          await context.close().catch(() => {});
        }

        renderDecision.success = true;

        const renderedFacts: RenderedPageFacts = {
          attempted: true,
          success: true,
          renderedAt: new Date().toISOString(),
          renderReason: renderDecision.reasons.join(", "),
          renderConfidence: "high",
          title: renderedDom.docTitle,
          metaDescription: renderedDom.metaDesc,
          canonicalUrl: renderedDom.canonicalTag,
          h1Count: renderedDom.h1Texts.length,
          h1Texts: renderedDom.h1Texts,
          forms: renderedDom.forms,
          formCount: renderedDom.forms.length,
          unlabelledFormControlCount: renderedDom.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
          missingAltCount: renderedDom.missingAlt,
          images: renderedDom.images,
          visibleBodyWordCount: renderedDom.visWords,
          mainContentWordCount: renderedDom.mainWords,
          landmarks: renderedDom.landmarks,
          hasMainLandmark: renderedDom.landmarks.hasMain,
          headingsOutline: renderedDom.hOutline,
        };
        pageData.renderedFacts = renderedFacts;

        // Unconditionally set Authoritative Facts from Rendered DOM (No length > 0 conditionals)
        const authoritativeFacts: AuthoritativePageFacts = {
          source: "rendered",
          title: renderedDom.docTitle,
          metaDescription: renderedDom.metaDesc || rawFacts.metaDescription,
          canonicalUrl: renderedDom.canonicalTag || rawFacts.canonicalUrl,
          h1Count: renderedDom.h1Texts.length,
          h1Texts: renderedDom.h1Texts,
          forms: renderedDom.forms,
          formCount: renderedDom.forms.length,
          unlabelledFormControlCount: renderedDom.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
          missingAltCount: renderedDom.missingAlt,
          images: renderedDom.images,
          rawDocumentWordCount: rawFacts.rawDocumentWordCount,
          visibleBodyWordCount: renderedDom.visWords,
          mainContentWordCount: renderedDom.mainWords,
          landmarks: renderedDom.landmarks,
          hasMainLandmark: renderedDom.landmarks.hasMain,
          headingsOutline: renderedDom.hOutline,
          renderReason: renderDecision.reasons.join(", "),
          renderConfidence: "high",
        };
        pageData.authoritativeFacts = authoritativeFacts;

        // Unconditionally Synchronize Top-Level Compatibility Properties
        pageData.sourceMode = "rendered_playwright";
        pageData.renderMode = "playwright_rendered";
        pageData.renderReason = renderDecision.reasons.join(", ");
        pageData.renderConfidence = "high";
        pageData.title = authoritativeFacts.title;
        pageData.titleLength = authoritativeFacts.title ? authoritativeFacts.title.length : 0;
        pageData.h1s = [...authoritativeFacts.h1Texts];
        pageData.h1Count = authoritativeFacts.h1Count;
        pageData.h1Tags = [...authoritativeFacts.h1Texts];
        pageData.forms = authoritativeFacts.forms;
        pageData.landmarks = authoritativeFacts.landmarks;
        pageData.images = authoritativeFacts.images;
        pageData.visibleBodyWordCount = authoritativeFacts.visibleBodyWordCount;
        pageData.mainContentWordCount = authoritativeFacts.mainContentWordCount;
        pageData.wordCount = authoritativeFacts.mainContentWordCount > 0 ? authoritativeFacts.mainContentWordCount : authoritativeFacts.visibleBodyWordCount;
        pageData.headingsOutline = authoritativeFacts.headingsOutline;

        // Re-validate heading hierarchy against authoritative rendered outline
        const renderedHeadingValidation = validateHeadingOutlineHierarchy(authoritativeFacts.headingsOutline);
        pageData.headingsHierarchyValid = renderedHeadingValidation.valid;
        pageData.headingsHierarchyIssues = renderedHeadingValidation.issues;
      }
    } catch {
      renderDecision.success = false;
      pageData.renderedFacts = {
        attempted: true,
        success: false,
        renderReason: renderDecision.reasons.join(", "),
        renderConfidence: "manual_review",
      };
      // Fallback authoritative facts to raw facts if render failed
      pageData.authoritativeFacts = {
        source: "raw",
        title: rawFacts.title,
        metaDescription: rawFacts.metaDescription,
        canonicalUrl: rawFacts.canonicalUrl,
        h1Count: rawFacts.h1Count,
        h1Texts: [...rawFacts.h1Texts],
        forms: rawFacts.forms,
        formCount: rawFacts.formCount,
        unlabelledFormControlCount: rawFacts.unlabelledFormControlCount,
        missingAltCount: rawFacts.missingAltCount,
        images: rawFacts.images,
        rawDocumentWordCount: rawFacts.rawDocumentWordCount,
        visibleBodyWordCount: rawFacts.visibleBodyWordCount,
        mainContentWordCount: rawFacts.mainContentWordCount,
        landmarks: rawFacts.landmarks,
        hasMainLandmark: rawFacts.hasMainLandmark,
        headingsOutline: rawFacts.headingsOutline,
        renderReason: renderDecision.reasons.join(", "),
        renderConfidence: "manual_review",
      };
    }
  } else {
    // Standard Static HTML: Authoritative Facts are Raw Facts
    pageData.authoritativeFacts = {
      source: "raw",
      title: rawFacts.title,
      metaDescription: rawFacts.metaDescription,
      canonicalUrl: rawFacts.canonicalUrl,
      h1Count: rawFacts.h1Count,
      h1Texts: [...rawFacts.h1Texts],
      forms: rawFacts.forms,
      formCount: rawFacts.formCount,
      unlabelledFormControlCount: rawFacts.unlabelledFormControlCount,
      missingAltCount: rawFacts.missingAltCount,
      images: rawFacts.images,
      rawDocumentWordCount: rawFacts.rawDocumentWordCount,
      visibleBodyWordCount: rawFacts.visibleBodyWordCount,
      mainContentWordCount: rawFacts.mainContentWordCount,
      landmarks: rawFacts.landmarks,
      hasMainLandmark: rawFacts.hasMainLandmark,
      headingsOutline: rawFacts.headingsOutline,
      renderReason: "static_complete",
      renderConfidence: "high",
    };
    pageData.renderReason = "static_complete";
    pageData.renderConfidence = "high";
  }

  // 4. Bot Challenge / WAF Interception Isolation
  const finalTitleLower = (pageData.title || "").toLowerCase().trim();
  if (finalTitleLower === "access denied" || finalTitleLower.includes("attention required! | cloudflare") || finalTitleLower.includes("just a moment")) {
    pageData.resourceType = "error";
    pageData.indexabilityStatus = "unknown_manual_review";
    pageData.isIndexable = false;
    pageData.renderReason = "bot_challenge_interception";
    pageData.renderConfidence = "manual_review";
  }

  return pageData;
}
