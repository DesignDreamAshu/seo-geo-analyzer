/**
 * Fix Strategy for Hyperlinks, Anchors, and Site Architecture.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class LinksArchitectureStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return (
      ruleCode.startsWith("LINKS_") ||
      ruleCode === "CODE_PLACEHOLDER_ANCHOR" ||
      ruleCode === "ORPHAN_INDEXABLE_PAGE" ||
      ruleCode === "PAGES_DEEP_CRAWL_DEPTH" ||
      ruleCode === "INTERNAL_LINK_TO_NOINDEX" ||
      ruleCode === "URL_NON_NORMALIZED_INTERNAL_LINK"
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

    // 1. LINKS_BROKEN_INTERNAL
    if (ruleCode === "LINKS_BROKEN_INTERNAL") {
      priority = "critical";
      whyItMatters =
        "Internal broken links (4xx/5xx) frustrate users, waste search engine crawl budget, and stop PageRank/authority flow across your site.";
      objective = `Update the broken hyperlink on ${affectedUrl || "the source page"} to point to an active, valid destination, or remove the link if no replacement exists.`;
      steps.push({
        stepNumber: 1,
        action: "Locate the broken anchor element on the source page.",
        location: `${affectedUrl || "Source Page"} → DOM / CMS Template`,
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Identify the correct active URL.",
        location: "Internal Site Search / Sitemap",
        details: `If the target page was moved, update href to the new URL. If permanently removed, remove the hyperlink wrapper or update the anchor text.`,
      });
      cautions.push("Do NOT invent a fake destination URL; confirm the target page exists and returns HTTP 200 before applying.");
    }

    // 2. LINKS_INTERNAL_TO_REDIRECT
    else if (ruleCode === "LINKS_INTERNAL_TO_REDIRECT") {
      priority = "low";
      whyItMatters =
        "Linking internally through 3xx redirects forces users and crawlers through extra network hops, adding latency to page transitions.";
      objective = `Update internal anchor href attribute to point directly to the destination URL (${targetUrl || "destination URL"}) instead of the redirecting URL.`;
      steps.push({
        stepNumber: 1,
        action: "Locate the hyperlink pointing to the redirect.",
        location: affectedUrl || "Source Page",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Update href directly to the final destination.",
        location: "Page Editor / Component",
        details: `Change href to "${targetUrl || "https://example.com/final-page"}"`,
      });
      if (targetUrl) {
        exampleBefore = codeSnippet || '<a href="/old-url">Link Text</a>';
        exampleAfter = `<a href="${targetUrl}">Link Text</a>`;
        recommendedChange = `Update href to "${targetUrl}"`;
      }
    }

    // 3. LINKS_BROKEN_EXTERNAL
    else if (ruleCode === "LINKS_BROKEN_EXTERNAL") {
      priority = "medium";
      confidence = "high_confidence";
      whyItMatters =
        "Outbound links pointing to broken external resources harm user credibility and user experience.";
      objective = `Inspect external URL (${targetUrl || "external link"}). If broken or dead, replace with an updated reference or remove the link.`;
      steps.push({
        stepNumber: 1,
        action: "Check external link target in browser.",
        location: affectedUrl || "Source Page",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Replace or remove broken external hyperlink.",
        location: "Page Editor",
        details: "Update the href attribute to a working external citation or remove the link.",
      });
      cautions.push("Verify whether the external site is truly broken or temporarily blocking automated crawlers (e.g. Cloudflare shield).");
    }

    // 4. LINKS_EMPTY_ANCHOR
    else if (ruleCode === "LINKS_EMPTY_ANCHOR") {
      priority = "medium";
      whyItMatters =
        "Search engines and screen readers require accessible link text to understand the context and purpose of the destination URL.";
      objective = "Provide an accessible name for the anchor element using visible text, an aria-label, or descriptive child image alt text.";
      steps.push({
        stepNumber: 1,
        action: "Locate the empty anchor tag.",
        location: affectedUrl || "Source Page",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Add descriptive text or an aria-label.",
        location: "Page Canvas / Component",
        details: "Add visible text inside <a>, or add aria-label='[Descriptive Action]' if it is an icon button.",
      });
      exampleBefore = '<a href="/contact"></a>';
      exampleAfter = '<a href="/contact" aria-label="Contact Us"></a>\n<!-- or <a href="/contact">Contact Us</a> -->';
    }

    // 5. LINKS_NON_DESCRIPTIVE_ANCHOR
    else if (ruleCode === "LINKS_NON_DESCRIPTIVE_ANCHOR") {
      priority = "low";
      confidence = "heuristic";
      whyItMatters =
        "Generic anchor text like 'click here' or 'read more' passes weak keyword relevance to the target page and offers poor usability for screen reader users.";
      objective = "Replace generic words with phrasing that describes the specific destination content or topic.";
      steps.push({
        stepNumber: 1,
        action: "Rewrite anchor text to be descriptive.",
        location: affectedUrl || "Source Page",
        details: observed,
      });
      exampleBefore = '<a href="/services/cloud-migration">Read more</a>';
      exampleAfter = '<a href="/services/cloud-migration">Learn about our Cloud Migration services</a>';
    }

    // 6. CODE_PLACEHOLDER_ANCHOR
    else if (ruleCode === "CODE_PLACEHOLDER_ANCHOR") {
      priority = "low";
      whyItMatters =
        "Using <a href='#'> for JavaScript triggers is an anti-pattern that can cause unexpected page jumps and creates meaningless empty links for search crawlers.";
      objective = "Convert interactive script triggers from <a> tags to semantic <button type='button'> elements, or provide a valid URL.";
      steps.push({
        stepNumber: 1,
        action: "Convert placeholder hash link to native button.",
        location: affectedUrl || "Template / Component",
        details: observed,
      });
      exampleBefore = '<a href="#" class="btn" onclick="openModal()">Open Modal</a>';
      exampleAfter = '<button type="button" class="btn" onclick="openModal()">Open Modal</button>';
    }

    // 7. ORPHAN_INDEXABLE_PAGE
    else if (ruleCode === "ORPHAN_INDEXABLE_PAGE") {
      priority = "high";
      safety = "REVIEW_REQUIRED";
      effort = "small";
      whyItMatters =
        "Orphan pages have 0 internal inbound links in your site navigation or body content, making them hard for search engines to discover and depriving them of internal PageRank.";
      objective = `Add internal links pointing to ${affectedUrl || "this page"} from relevant hub pages, category listings, or related articles.`;
      steps.push({
        stepNumber: 1,
        action: "Identify parent or related topic pages.",
        location: "Site Navigation / Related Hubs",
        details: `Determine where ${affectedUrl || "this page"} fits logically into the site architecture.`,
      });
      steps.push({
        stepNumber: 2,
        action: "Add contextual internal hyperlinks.",
        location: "Parent Page / Navigation Menu / Footer",
        details: `Insert an internal link with descriptive anchor text pointing to ${affectedUrl || "the orphan URL"}.`,
      });
      cautions.push("If the page is an obsolete or duplicate page that should not exist, consider 301 redirecting it or adding a noindex tag.");
    }

    // 8. INTERNAL_LINK_TO_NOINDEX
    else if (ruleCode === "INTERNAL_LINK_TO_NOINDEX") {
      priority = "high";
      effort = "quick";
      safety = "SAFE";
      whyItMatters = "Internal links to noindex pages waste crawl budget and pass internal authority to non-ranking URLs.";
      objective = "Remove internal links pointing to noindexed utility pages or make the destination page indexable.";
      steps.push({
        stepNumber: 1,
        action: "Update or remove internal hyperlink.",
        location: "Page Body / Navigation",
        details: "Remove the link or update its href to an indexable canonical destination.",
      });
    }

    // 9. URL_NON_NORMALIZED_INTERNAL_LINK
    else if (ruleCode === "URL_NON_NORMALIZED_INTERNAL_LINK") {
      priority = "medium";
      effort = "quick";
      safety = "SAFE";
      whyItMatters = "Un-normalized internal links (uppercase characters, double slashes, /index.html) split crawl equity and cause redirect hops.";
      objective = "Standardize internal links to use lowercase canonical URLs without default filenames.";
      steps.push({
        stepNumber: 1,
        action: "Update internal link href to clean canonical path.",
        location: "HTML Template / CMS Content",
        details: "Convert mixed-case hrefs to lowercase and remove /index.html suffixes.",
      });
    }

    // 10. PAGES_DEEP_CRAWL_DEPTH
    else {
      priority = "medium";
      effort = "medium";
      whyItMatters = "Pages located > 3 clicks from the homepage receive less crawl frequency and lower internal authority.";
      objective = "Flatten site architecture by adding category links or featured section shortcuts.";
      steps.push({
        stepNumber: 1,
        action: "Add higher-level navigation or breadcrumb links to shorten crawl depth.",
        location: "Main Navigation / Category Pages",
        details: observed,
      });
    }


    const platformGuidance = getPlatformRemediationGuidance(
      context.platform,
      ruleCode,
      issue.category,
      { isCmsPage: context.isCmsPage, templateName: context.templateName }
    );

    const isGlobalComponent = issue.componentGuess === "navbar" || issue.componentGuess === "footer";

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
      classification: isGlobalComponent
        ? "SYSTEMIC_FIX"
        : isSystemic
        ? "SYSTEMIC_FIX"
        : ruleCode === "LINKS_BROKEN_INTERNAL"
        ? "HIGH_IMPACT"
        : "QUICK_WIN",
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
        method: `Re-crawl ${affectedUrl || "source page"} and verify link targets with Dream SEO.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isGlobalComponent ? "global_component" : isSystemic ? "template" : "page",
        confidence: 0.9,
        reason: isGlobalComponent
          ? "Shared navigation or footer component"
          : isSystemic
          ? "Shared template component"
          : "Page-level hyperlink",
        targetComponentOrTemplate: issue.componentGuess,
      },
      canAutoFix: false,
    };
  }
}
