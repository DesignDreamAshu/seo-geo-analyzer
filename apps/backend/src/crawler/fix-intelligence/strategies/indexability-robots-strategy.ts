/**
 * Fix Strategy for Indexability, Robots, Sitemaps, and Crawl Directives.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class IndexabilityRobotsStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return (
      ruleCode === "INDEX_NOINDEX" ||
      ruleCode === "INDEX_ROBOTS_CONFLICT" ||
      ruleCode === "INDEX_MISSING_CANONICAL" ||
      ruleCode === "INDEX_SITEMAP_ORPHAN" ||
      ruleCode.startsWith("SITEMAP_") ||
      ruleCode.startsWith("ROBOTS_") ||
      ruleCode.startsWith("RENDER_")
    );
  }

  buildFixIntelligence(issue: DiagnosticIssue, context: FixContext): SeoFixIntelligence {
    const ruleCode = issue.code;
    const firstAff = issue.affectedPages[0];
    const affectedUrl = firstAff?.url;
    const observed = firstAff?.evidence?.observed || issue.description;
    const isSystemic = issue.isSystemicTemplateIssue ?? false;

    let whyItMatters = "";
    let objective = "";
    const steps: FixStep[] = [];
    const cautions: string[] = [];
    let exampleBefore: string | undefined;
    let exampleAfter: string | undefined;
    let recommendedChange: string | undefined;

    let safety: SeoFixIntelligence["safety"] = "HIGH_RISK";
    let effort: SeoFixIntelligence["effort"] = "quick";
    let priority: SeoFixIntelligence["priority"] = issue.severity === "critical" ? "critical" : "high";
    let confidence: SeoFixIntelligence["confidence"] = "confirmed";

    // 1. INDEX_NOINDEX
    if (ruleCode === "INDEX_NOINDEX") {
      whyItMatters =
        "The 'noindex' directive instructs search engine crawlers (Googlebot, Bingbot) to completely drop the page from the search index, eliminating all organic search visibility.";
      objective =
        "Verify intended indexing status. If this page is a public landing page or editorial article, remove the 'noindex' directive. If it is an intentional utility/staging page, retain noindex and exclude from XML sitemaps.";
      
      const isHeader = observed.toLowerCase().includes("header") || observed.toLowerCase().includes("x-robots-tag");
      steps.push({
        stepNumber: 1,
        action: "Establish indexation intent for this URL.",
        location: affectedUrl || "Page Configuration",
        details: "Confirm whether this URL should be searchable by the public or kept private (e.g. staging, internal search, thank-you).",
      });

      if (isHeader) {
        steps.push({
          stepNumber: 2,
          action: "Remove X-Robots-Tag from server / CDN response headers.",
          location: "Server HTTP Headers / CDN Edge Config",
          details: "Update server configuration (Nginx, Cloudflare, Netlify headers) to stop sending 'X-Robots-Tag: noindex' for this path.",
        });
        exampleBefore = "HTTP/1.1 200 OK\nX-Robots-Tag: noindex";
        exampleAfter = "HTTP/1.1 200 OK\n(X-Robots-Tag removed or set to index)";
      } else {
        steps.push({
          stepNumber: 2,
          action: "Remove <meta name='robots' content='noindex'> from document <head>.",
          location: context.platform === "webflow" ? "Webflow Page Settings → Inside <head> Tag / SEO Settings" : "HTML <head> section",
          details: "Change meta robots directive to 'index, follow' or remove the meta robots tag entirely (default is indexable).",
        });
        exampleBefore = '<meta name="robots" content="noindex, nofollow">';
        exampleAfter = '<meta name="robots" content="index, follow">';
      }

      cautions.push("HIGH RISK: Do NOT remove noindex on staging environments, internal administration portals, or private search filter pages.");
      cautions.push("Do not add 'meta robots=index' while leaving an HTTP 'X-Robots-Tag: noindex' header; the restrictive header will take precedence.");
    }

    // 2. INDEX_ROBOTS_CONFLICT
    else if (ruleCode === "INDEX_ROBOTS_CONFLICT") {
      whyItMatters =
        "Contradictory directives (such as HTML declaring 'index' while HTTP headers declare 'noindex') create crawl ambiguity. Googlebot enforces the most restrictive directive, preventing indexation.";
      objective = "Align HTTP response headers and HTML meta robots tags so they declare identical indexing instructions.";
      steps.push({
        stepNumber: 1,
        action: "Inspect both HTTP header and HTML meta robots configurations.",
        location: "Server HTTP Headers & HTML <head>",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Unify the directives.",
        location: "Server & Template Settings",
        details: "Ensure both layers agree on either 'index, follow' or 'noindex, nofollow'.",
      });
      cautions.push("Never attempt to override an HTTP noindex header using an HTML meta tag; search engines prioritize restrictive headers.");
    }

    // 3. INDEX_MISSING_CANONICAL
    else if (ruleCode === "INDEX_MISSING_CANONICAL") {
      safety = "REVIEW_REQUIRED";
      effort = "quick";
      whyItMatters =
        "Pages without an explicit self-referencing canonical tag leave URL selection to search engine heuristics, risking indexation of query parameter duplicates, trailing-slash variants, or HTTP/HTTPS mismatches.";
      objective = "Add an explicit self-referencing canonical link element to the <head> of this indexable page.";
      steps.push({
        stepNumber: 1,
        action: "Add a canonical link tag inside the document <head>.",
        location: context.platform === "webflow" ? "Webflow Project Settings → SEO → Global Canonical Tag URL" : "HTML <head>",
        details: `Add <link rel="canonical" href="${affectedUrl || "https://example.com/canonical-url"}">`,
      });
      exampleBefore = "<head>\n  <title>Page Title</title>\n</head>";
      exampleAfter = `<head>\n  <title>Page Title</title>\n  <link rel="canonical" href="${affectedUrl || "https://example.com/canonical-url"}">\n</head>`;
      cautions.push("Ensure the canonical URL uses the preferred HTTPS protocol, correct domain, and standardized trailing-slash structure.");
    }

    // 4. SITEMAP_URL_4XX
    else if (ruleCode === "SITEMAP_URL_4XX") {
      safety = "SAFE";
      effort = "quick";
      whyItMatters =
        "XML sitemaps should only include valid, 200 OK indexable URLs. Listing 404 client error pages wastes search crawler budget and signals poor site health.";
      objective = "Remove the broken 4xx URL from the XML sitemap, or restore/redirect the page if it was mistakenly deleted.";
      steps.push({
        stepNumber: 1,
        action: "Locate the broken URL entry inside the sitemap.",
        location: "XML Sitemap generator / sitemap.xml",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Remove the entry or update sitemap generation query.",
        location: "CMS / Sitemap Settings",
        details: "If the page was permanently deleted, remove its <url> block. If moved, update the entry to the new active 200 destination URL.",
      });
      cautions.push("Do not leave deleted pages in XML sitemaps; search engines re-crawl sitemap URLs with high priority.");
    }

    // 5. SITEMAP_URL_REDIRECT
    else if (ruleCode === "SITEMAP_URL_REDIRECT") {
      safety = "SAFE";
      effort = "quick";
      whyItMatters =
        "Including URLs that return 301/302 redirects in sitemaps introduces unnecessary redirect hops for search engine crawlers.";
      objective = "Update the sitemap entry to point directly to the final 200 OK destination URL.";
      steps.push({
        stepNumber: 1,
        action: "Replace redirecting URL in XML sitemap with final destination.",
        location: "XML Sitemap (sitemap.xml)",
        details: observed,
      });
      cautions.push("Ensure the replacement destination is indexable and returns HTTP 200.");
    }

    // 6. SITEMAP_URL_NOINDEX
    else if (ruleCode === "SITEMAP_URL_NOINDEX") {
      safety = "REVIEW_REQUIRED";
      effort = "quick";
      whyItMatters =
        "Sitemaps are an explicit request for indexing. Including a URL with a 'noindex' directive sends directly conflicting signals to search engines.";
      objective = "Resolve the conflict: either remove 'noindex' if the page is intended for search, or remove the URL from the sitemap if it should remain private.";
      steps.push({
        stepNumber: 1,
        action: "Determine whether the page should be indexed.",
        location: affectedUrl || "Page Settings",
        details: "Option A: If page should be indexed, remove noindex tag. Option B: If page should be private, remove from sitemap.",
      });
      cautions.push("Do NOT blindly remove noindex without confirming the page is ready for public search indexation.");
    }

    // 7. ROBOTS_HEADER_META_CONFLICT
    else if (ruleCode === "ROBOTS_HEADER_META_CONFLICT") {
      safety = "HIGH_RISK";
      effort = "quick";
      priority = "critical";
      whyItMatters = "Contradictory indexing directives between HTTP headers and HTML meta tags cause severe indexation ambiguity.";
      objective = "Align HTML meta robots and HTTP X-Robots-Tag to deliver consistent indexing instructions.";
      steps.push({
        stepNumber: 1,
        action: "Establish single authoritative directive source.",
        location: "Server Headers vs HTML <head>",
        details: "Remove conflicting X-Robots-Tag or HTML meta robots directive.",
      });
      cautions.push("Never output conflicting noindex directives.");
    }

    // 8. ROBOTS_BLOCKED_IMPORTANT_RESOURCE
    else if (ruleCode === "ROBOTS_BLOCKED_IMPORTANT_RESOURCE") {
      safety = "SAFE";
      effort = "quick";
      priority = "critical";
      whyItMatters = "Googlebot renders pages like a browser; disallowing CSS or JS resources prevents accurate layout and mobile evaluation.";
      objective = "Update robots.txt to permit crawler access to all CSS and JavaScript rendering assets.";
      steps.push({
        stepNumber: 1,
        action: "Remove Disallow rules for asset directories.",
        location: "robots.txt",
        details: "Allow access to /css/, /js/, /assets/ directories in robots.txt.",
      });
    }

    // 9. ROBOTS_SITEMAP_MISSING
    else if (ruleCode === "ROBOTS_SITEMAP_MISSING") {
      safety = "SAFE";
      effort = "quick";
      priority = "low";
      whyItMatters = "Declaring sitemap location in robots.txt provides discovery assistance for web crawlers. If the sitemap is submitted via Search Console or discoverable elsewhere, this is optional discovery assistance rather than a blocking indexability defect.";
      objective = "Consider declaring the sitemap in robots.txt where appropriate (e.g. Sitemap: https://example.com/sitemap.xml).";
      steps.push({
        stepNumber: 1,
        action: "Optionally add Sitemap declaration to robots.txt.",
        location: "robots.txt",
        details: "Append: Sitemap: https://yourdomain.com/sitemap.xml",
      });
    }

    // 10. SITEMAP_URL_BLOCKED_BY_ROBOTS
    else if (ruleCode === "SITEMAP_URL_BLOCKED_BY_ROBOTS") {
      safety = "SAFE";
      effort = "quick";
      priority = "critical";
      whyItMatters = "Submitting a URL in the XML sitemap while disallowing it in robots.txt sends contradictory signals.";
      objective = "Remove blocked URLs from sitemap or allow crawler access in robots.txt.";
      steps.push({
        stepNumber: 1,
        action: "Reconcile sitemap inclusion with robots.txt rules.",
        location: "sitemap.xml / robots.txt",
        details: "Either remove the disallowed URL from sitemap.xml or remove the Disallow line in robots.txt.",
      });
    }

    // 11. SITEMAP_URL_NON_CANONICAL
    else if (ruleCode === "SITEMAP_URL_NON_CANONICAL") {
      safety = "SAFE";
      effort = "quick";
      priority = "high";
      whyItMatters = "XML sitemaps must only contain self-canonical URLs to prevent search engines from receiving mixed canonical signals.";
      objective = "Update sitemap to include only authoritative canonical destination URLs.";
      steps.push({
        stepNumber: 1,
        action: "Replace non-canonical URLs in sitemap with their target canonical URLs.",
        location: "sitemap.xml generator",
        details: "Configure CMS sitemap to output only canonical URLs.",
      });
    }

    // 12. SITEMAP_URL_DUPLICATE
    else if (ruleCode === "SITEMAP_URL_DUPLICATE") {
      safety = "SAFE";
      effort = "quick";
      priority = "medium";
      whyItMatters = "Duplicate sitemap entries bloat XML file size and waste search crawler parser limits.";
      objective = "Remove redundant duplicate <url> declarations from XML sitemap.";
      steps.push({
        stepNumber: 1,
        action: "Deduplicate sitemap entries.",
        location: "sitemap.xml generator",
        details: "Ensure each canonical URL is listed exactly once in the sitemap.",
      });
    }

    // 13. RENDER_CRITICAL_METADATA_DISCREPANCY
    else if (ruleCode === "RENDER_CRITICAL_METADATA_DISCREPANCY") {
      safety = "HIGH_RISK";
      effort = "medium";
      priority = "critical";
      whyItMatters = "Search engine raw HTML parsers see different indexing signals (title, canonical, robots) than rendered DOM parsers.";
      objective = "Render critical SEO tags directly into server-side HTML rather than modifying them client-side via JavaScript.";
      steps.push({
        stepNumber: 1,
        action: "Move metadata rendering to server-side template / SSR.",
        location: context.platform === "webflow" ? "Webflow Page Settings" : "Server Template / SSR / Next.js <Head>",
        details: "Output exact canonical and title in initial HTML response without relying on client-side JS mutation.",
      });
      cautions.push("Do not use client-side JavaScript to rewrite canonical URLs or meta robots tags.");
    }

    // 14. SITEMAP_MALFORMED_XML / INDEX_SITEMAP_ORPHAN
    else {
      safety = "REVIEW_REQUIRED";
      effort = "small";
      whyItMatters = "Sitemap validity and internal discovery ensure all canonical pages are crawled efficiently.";
      objective = "Fix XML formatting errors or link orphan pages from site navigation.";
      steps.push({
        stepNumber: 1,
        action: "Review sitemap syntax and page link architecture.",
        location: "sitemap.xml / Site Navigation",
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
      subCategory: "INDEXABILITY_CRITICAL",
      title: issue.title,
      summary: issue.description,
      priority,
      confidence,
      safety,
      effort,
      classification: isSystemic ? "SYSTEMIC_FIX" : safety === "HIGH_RISK" ? "MANUAL_REVIEW" : "QUICK_WIN",
      fixLeverageScore: Math.round(((issue.impactScore || 5) * issue.affectedPages.length * 1.0) / (effort === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl ${affectedUrl || "site"} via Dream SEO and verify HTTP status/headers.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : ruleCode.startsWith("SITEMAP_") ? "site_configuration" : "page",
        confidence: 0.95,
        reason: isSystemic ? "Shared across multiple URLs with identical directive pattern" : "Page-level or site-level configuration",
      },
      canAutoFix: false,
    };
  }
}
