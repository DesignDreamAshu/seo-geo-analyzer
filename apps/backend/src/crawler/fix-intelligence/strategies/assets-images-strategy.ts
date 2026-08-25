/**
 * Fix Strategy for Images, Assets, Media Alt Tags, Dimensions, and Broken Scripts.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class AssetsImagesStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return (
      ruleCode.startsWith("ASSET_") ||
      ruleCode.startsWith("IMAGE_") ||
      ruleCode.startsWith("RESOURCE_")
    );
  }

  buildFixIntelligence(issue: DiagnosticIssue, context: FixContext): SeoFixIntelligence {
    const ruleCode = issue.code;
    const firstAff = issue.affectedPages[0];
    const affectedUrl = firstAff?.url;
    const observed = firstAff?.evidence?.observed || issue.description;
    const targetUrl = firstAff?.evidence?.targetUrl;
    const codeSnippet = firstAff?.evidence?.codeSnippet;
    const isSystemic = issue.isSystemicTemplateIssue ?? false;

    let whyItMatters = "";
    let objective = "";
    const steps: FixStep[] = [];
    const cautions: string[] = [];
    let exampleBefore: string | undefined;
    let exampleAfter: string | undefined;
    let recommendedChange: string | undefined;

    let safety: SeoFixIntelligence["safety"] = "SAFE";
    let effort: SeoFixIntelligence["effort"] = "quick";
    let priority: SeoFixIntelligence["priority"] = "medium";
    let confidence: SeoFixIntelligence["confidence"] = "confirmed";

    // 1. ASSET_MISSING_ALT / IMAGE_LINK_MISSING_ALT
    if (ruleCode === "ASSET_MISSING_ALT" || ruleCode === "IMAGE_LINK_MISSING_ALT") {
      const isLinked = ruleCode === "IMAGE_LINK_MISSING_ALT";
      whyItMatters = isLinked
        ? "When an image is wrapped in a hyperlink without visible text, screen readers and search bots use the image's alt attribute as the link text. Missing alt text leaves the link unlabelled."
        : "Image alt text describes visual content to search engine crawlers and enables image search indexation while providing essential accessibility for screen reader users.";
      objective = isLinked
        ? "Add descriptive alt text to the linked image describing the destination or action."
        : "Add concise, descriptive alt text to informative images, or use alt='' for purely decorative graphics.";

      steps.push({
        stepNumber: 1,
        action: "Locate the <img> element in the template or canvas.",
        location: affectedUrl || "Page DOM / Media Library",
        details: observed,
        codeSnippet,
      });

      if (isLinked) {
        steps.push({
          stepNumber: 2,
          action: "Provide an accessible name describing the link destination or action (Functional / Linked Image).",
          location: "Image Settings / Element Settings",
          details: "Set alt='[Destination Description]' on the <img> or add aria-label to the parent <a> tag.",
        });
        exampleBefore = '<a href="/contact"><img src="/icon.svg"></a>';
        exampleAfter = '<a href="/contact"><img src="/icon.svg" alt="Contact BOT Consulting"></a>';
      } else {
        steps.push({
          stepNumber: 2,
          action: "Classify image role and apply appropriate alt attribute:",
          location: "Image Settings Panel",
          details: "1. Informative Image: Write concise contextual description (e.g. alt='Team collaborating on ServiceNow architecture'). 2. Decorative Image: Use alt='' (empty string) so assistive tech bypasses it. 3. Functional/Icon Image: Describe the action or destination. 4. Unknown Image: Conduct manual editorial review.",
        });
        exampleBefore = '<img src="/hero.jpg">';
        exampleAfter = '<img src="/hero.jpg" alt="Team collaborating on ServiceNow implementation">';
      }

      cautions.push("Decorative Images: Set alt='' for abstract shapes, dividers, and background patterns. Do not write 'decorative' or filler text.");
      cautions.push("Do NOT keyword-stuff alt text; keep descriptions natural, accurate, and concise (< 125 characters).");
    }

    // 2. ASSET_MISSING_DIMENSIONS
    else if (ruleCode === "ASSET_MISSING_DIMENSIONS") {
      priority = "low";
      whyItMatters =
        "Images without explicit width and height attributes cause Cumulative Layout Shift (CLS) as images load asynchronously, degrading Google Core Web Vitals.";
      objective = "Add explicit width and height attributes (or aspect-ratio CSS) to all image elements.";
      steps.push({
        stepNumber: 1,
        action: "Add width and height attributes matching the intrinsic aspect ratio.",
        location: affectedUrl || "HTML / Image Component",
        details: observed,
        codeSnippet,
      });
      exampleBefore = '<img src="/logo.png">';
      exampleAfter = '<img src="/logo.png" width="300" height="80">';
      cautions.push("Adding width and height in HTML does not break responsiveness when paired with CSS 'height: auto; max-width: 100%'.");
    }

    // 3. IMAGE_BROKEN
    else if (ruleCode === "IMAGE_BROKEN") {
      priority = "high";
      whyItMatters =
        "Broken image requests return 404 client errors, causing broken visual placeholder icons and wasted HTTP requests.";
      objective = `Fix image src URL or replace the missing file (${targetUrl || "image src"}).`;
      steps.push({
        stepNumber: 1,
        action: "Verify the image asset URL path.",
        location: affectedUrl || "Image Element",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Re-upload missing asset or update src attribute.",
        location: "Media Library / CDN",
        details: "Ensure the file exists on the hosting server/CDN and returns HTTP 200.",
      });
    }

    // 4. IMAGE_OVERSIZED_FILE
    else if (ruleCode === "IMAGE_OVERSIZED_FILE") {
      priority = "medium";
      whyItMatters =
        "Large image files exceeding 250 KB significantly increase page load times, delay Largest Contentful Paint (LCP), and consume excessive mobile user data.";
      objective = "Compress, resize, or convert the image to modern formats like WebP or AVIF.";
      steps.push({
        stepNumber: 1,
        action: "Locate and download the unoptimized image file.",
        location: affectedUrl || "Image Element / Media Library",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Resize dimensions to match display container and convert to WebP/AVIF.",
        location: "Image Optimization Tool / CDN (e.g. Squoosh, TinyPNG, Cloudinary)",
        details: "Target a file size below 100-200 KB while preserving visual fidelity.",
      });
      exampleBefore = '<img src="/hero-banner.png"> (Size: 1.4 MB)';
      exampleAfter = '<img src="/hero-banner.webp"> (Size: 120 KB)';
      cautions.push("Ensure responsive <picture> or srcset attributes are used to serve smaller images to mobile devices.");
    }

    // 4b. IMAGE_LEGACY_FORMAT
    else if (ruleCode === "IMAGE_LEGACY_FORMAT") {
      priority = "low";
      whyItMatters =
        "Large legacy image formats (PNG/JPEG > 100 KB) consume significantly more bandwidth than next-generation WebP or AVIF compression formats.";
      objective = "Convert large legacy PNG/JPEG images to modern WebP or AVIF formats for 25–35% file size savings.";
      steps.push({
        stepNumber: 1,
        action: "Locate large PNG or JPEG images.",
        location: affectedUrl || "Image Element / Media Library",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Convert to WebP or AVIF and update HTML references or CDN auto-format transforms.",
        location: "Asset Pipeline / CDN",
        details: "Use WebP/AVIF with fallback <picture> tags or enable automatic format negotiation (e.g. Cloudflare Polish / Webflow auto WebP).",
      });
      exampleBefore = '<img src="/illustration.png">';
      exampleAfter = '<img src="/illustration.webp">';
    }

    // 4c. ASSET_LAZY_LOADING_MISSING
    else if (ruleCode === "ASSET_LAZY_LOADING_MISSING") {
      priority = "low";
      whyItMatters =
        "Loading all content images eagerly delays page rendering and downloads off-screen images that mobile users may never scroll to.";
      objective = "Add loading='lazy' to below-the-fold content images.";
      steps.push({
        stepNumber: 1,
        action: "Locate below-the-fold <img> elements.",
        location: affectedUrl || "Page Body Content",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Add loading='lazy' attribute to image tags.",
        location: "Image Component / HTML Template",
        details: "Ensure hero and above-the-fold images remain loading='eager' to preserve LCP.",
      });
      exampleBefore = '<img src="/footer-graphic.jpg">';
      exampleAfter = '<img src="/footer-graphic.jpg" loading="lazy">';
      cautions.push("Never add loading='lazy' to the primary hero image or top-of-page logos, as this can degrade LCP.");
    }

    // 4d. ASSET_UNMINIFIED_RESOURCE
    else if (ruleCode === "ASSET_UNMINIFIED_RESOURCE") {
      priority = "low";
      whyItMatters =
        "Unminified CSS and JavaScript assets contain unnecessary whitespace and comments, increasing network payload size and delaying DOM parsing.";
      objective = "Minify production CSS and JavaScript bundles during deployment build steps.";
      steps.push({
        stepNumber: 1,
        action: "Inspect unminified script or stylesheet asset.",
        location: affectedUrl || "Static Assets / Bundler",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Configure asset bundler (Vite, Webpack, esbuild) or CDN auto-minify to produce compressed production builds (.min.js / .min.css).",
        location: "Build Configuration / CDN Settings",
        details: "Enable Terser/esbuild minification in production build configs.",
      });
      exampleBefore = '<script src="/js/app.js"></script> (Unminified with comments)';
      exampleAfter = '<script src="/js/app.min.js"></script> (Minified production build)';
    }

    // 5. RESOURCE_BROKEN_SCRIPT / RESOURCE_BROKEN_STYLESHEET
    else if (ruleCode === "RESOURCE_BROKEN_SCRIPT" || ruleCode === "RESOURCE_BROKEN_STYLESHEET") {
      priority = "high";
      whyItMatters =
        "Broken JavaScript or CSS files (4xx/5xx) can break client-side interactivity, layout rendering, and critical page functionality.";
      objective = `Update resource path or remove reference to non-existent asset (${targetUrl || "resource src"}).`;
      steps.push({
        stepNumber: 1,
        action: "Inspect the broken script/stylesheet link tag.",
        location: affectedUrl || "HTML <head> / Scripts",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Fix asset path or remove unused reference.",
        location: "Custom Code / Build Config",
        details: "Remove obsolete plugin scripts or fix file path in bundle configuration.",
      });
    }

    // 5. IMAGE_ABOVE_FOLD_LAZY_LOADED
    else if (ruleCode === "IMAGE_ABOVE_FOLD_LAZY_LOADED" || ruleCode === "IMAGE_ORPHAN_ABOVE_THE_FOLD_LAZY") {
      priority = "low";
      safety = "SAFE";
      whyItMatters = "Applying loading='lazy' to primary above-the-fold images (hero banner, header logo) can delay Largest Contentful Paint (LCP).";
      objective = "Remove loading='lazy' or set loading='eager' on the primary above-the-fold hero image where appropriate.";
      steps.push({
        stepNumber: 1,
        action: "Update image loading attribute to eager or remove lazy.",
        location: context.platform === "webflow" ? "Webflow Designer → Hero Image Settings" : "HTML <img> Tag",
        details: "Set loading='eager' or remove the loading='lazy' attribute from the first prominent hero image.",
      });
      exampleBefore = '<img src="hero.jpg" loading="lazy">';
      exampleAfter = '<img src="hero.jpg" loading="eager" fetchpriority="high">';
    }

    // 6. Default fallback
    else {
      priority = "low";
      whyItMatters = "Asset and media optimization ensures fast page rendering.";
      objective = "Review image and resource configuration.";
      steps.push({
        stepNumber: 1,
        action: "Inspect image asset properties.",
        location: affectedUrl || "Page DOM",
        details: observed,
      });
    }



    const platformGuidance = getPlatformRemediationGuidance(
      context.platform,
      ruleCode,
      issue.category,
      { isCmsPage: context.isCmsPage, templateName: context.templateName }
    );

    return {
      id: `fix_${ruleCode}_${Buffer.from(affectedUrl || "site").toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`,
      ruleCode,
      category: issue.category,
      subCategory: "CORE_SEO",
      title: issue.title,
      summary: issue.description,
      priority,
      confidence,
      safety,
      effort,
      classification: isSystemic ? "SYSTEMIC_FIX" : "QUICK_WIN",
      fixLeverageScore: Math.round(((issue.impactScore || 4) * issue.affectedPages.length * 1.0) / (effort === "quick" ? 1 : 2) * 10) / 10,
      affectedUrl,
      affectedCount: issue.affectedPages.length,
      problem: {
        observed,
        explanation: issue.description,
      },
      evidence: {
        source: firstAff?.evidence?.sourceMode || "raw_http",
        details: (firstAff?.evidence as any) || {},
      },
      whyItMatters,
      fix: {
        objective,
        steps,
        recommendedChange,
        exampleBefore,
        exampleAfter,
        platformGuidance,
      },
      cautions,
      verification: {
        method: `Re-crawl ${affectedUrl || "page"} and verify image alt/dimensions and HTTP status codes.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "cms_content",
        confidence: 0.9,
        reason: isSystemic ? "Template image element or shared asset" : "CMS record image field or static image",
      },
      canAutoFix: false,
    };
  }
}
