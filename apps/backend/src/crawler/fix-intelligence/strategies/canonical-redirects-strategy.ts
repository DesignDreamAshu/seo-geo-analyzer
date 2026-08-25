/**
 * Fix Strategy for Canonical Tags and 3xx Redirects.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class CanonicalRedirectsStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return ruleCode.startsWith("CANONICAL_") || ruleCode.startsWith("REDIRECT_");
  }

  buildFixIntelligence(issue: DiagnosticIssue, context: FixContext): SeoFixIntelligence {
    const ruleCode = issue.code;
    const firstAff = issue.affectedPages[0];
    const affectedUrl = firstAff?.url;
    const observed = firstAff?.evidence?.observed || issue.description;
    const targetUrl = firstAff?.evidence?.targetUrl;
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

    // 1. CANONICAL_POINTS_TO_REDIRECT
    if (ruleCode === "CANONICAL_POINTS_TO_REDIRECT") {
      whyItMatters =
        "A canonical tag that points to a redirecting URL forces search engines through an intermediate hop, diluting link equity and introducing crawl latency.";
      objective = `Update the canonical href on ${affectedUrl || "this page"} to point directly to the final 200 OK canonical destination URL (${targetUrl || "final target"}).`;
      steps.push({
        stepNumber: 1,
        action: "Identify the final 200 destination URL.",
        location: "Redirect Trace",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Update the canonical link href attribute.",
        location: context.platform === "webflow" ? "Webflow Page Settings → Inside <head> Tag" : "HTML <head>",
        details: `Change canonical href from the redirecting URL to the final destination URL: ${targetUrl || "https://example.com/final-canonical"}`,
      });
      if (targetUrl) {
        exampleBefore = `<link rel="canonical" href="[Redirecting URL]">\n<!-- Returns 301/302 -->`;
        exampleAfter = `<link rel="canonical" href="${targetUrl}">\n<!-- Returns HTTP 200 OK -->`;
        recommendedChange = `Update canonical href to "${targetUrl}"`;
      }
      cautions.push("Ensure the final target URL returns HTTP 200 and does NOT redirect further.");
    }

    // 2. CANONICAL_POINTS_TO_4XX
    else if (ruleCode === "CANONICAL_POINTS_TO_4XX") {
      whyItMatters =
        "Pointing a canonical tag to a non-existent 4xx error page signals that the authority of this page should be transferred to a broken URL, causing search engines to disregard the canonical tag.";
      objective = "Update the canonical tag to point to a valid, live 200 OK URL, or make it self-referencing.";
      steps.push({
        stepNumber: 1,
        action: "Locate the broken canonical reference.",
        location: "HTML <head>",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Replace with the correct live URL.",
        location: "Page Settings / Template",
        details: `Update href to point to ${affectedUrl || "the active live URL"}.`,
      });
      cautions.push("Never leave a canonical tag pointing to a dead or 404 URL.");
    }

    // 3. CANONICAL_POINTS_TO_NOINDEX
    else if (ruleCode === "CANONICAL_POINTS_TO_NOINDEX") {
      whyItMatters =
        "A canonical tag pointing to a noindexed target creates an impossible contradiction: the canonical declares the target as authoritative, but the target tells search engines not to index it.";
      objective = "Ensure the canonical target is indexable, or change the canonical reference to an active indexable version.";
      steps.push({
        stepNumber: 1,
        action: "Inspect the canonical target's indexing directives.",
        location: targetUrl || "Target Page",
        details: observed,
      });
      cautions.push("HIGH RISK: Confirm whether the target page should have its noindex removed, or if the source page should canonicalize elsewhere.");
    }

    // 4. CANONICAL_MULTIPLE
    else if (ruleCode === "CANONICAL_MULTIPLE") {
      whyItMatters =
        "Declaring multiple <link rel='canonical'> tags in a single document causes search engines to ignore ALL canonical tags on the page and fall back to algorithmic heuristics.";
      objective = "Remove duplicate canonical declarations so exactly one canonical link tag remains in the document <head>.";
      steps.push({
        stepNumber: 1,
        action: "Search for all canonical tags across page templates, plugins, and custom code.",
        location: "HTML <head> & Plugins",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Keep the single intended canonical tag and delete extra tags.",
        location: "Template / Header custom code",
        details: "Ensure plugins (e.g. SEO plugin, theme header, custom embed) are not injecting redundant canonicals.",
      });
      exampleBefore = '<link rel="canonical" href="https://example.com/page">\n<link rel="canonical" href="https://example.com/page?ref=1">';
      exampleAfter = '<link rel="canonical" href="https://example.com/page">';
      cautions.push("Check whether an SEO plugin and a theme header are both outputting canonical tags simultaneously.");
    }

    // 5. CANONICAL_OUTSIDE_HEAD
    else if (ruleCode === "CANONICAL_OUTSIDE_HEAD") {
      safety = "SAFE";
      effort = "quick";
      whyItMatters =
        "The W3C and HTML specifications require <link rel='canonical'> to be positioned strictly within the <head> element. Canonical tags placed in the <body> or <footer> are ignored by search crawlers.";
      objective = "Move the canonical link element from the <body> or <footer> into the document <head>.";
      steps.push({
        stepNumber: 1,
        action: "Move the <link rel='canonical'> tag into the <head> block.",
        location: context.platform === "webflow" ? "Webflow Page Settings → Inside <head> Custom Code" : "HTML <head>",
        details: observed,
      });
      exampleBefore = "<body>\n  <link rel=\"canonical\" href=\"...\">\n  <main>...</main>\n</body>";
      exampleAfter = "<head>\n  <link rel=\"canonical\" href=\"...\">\n</head>\n<body>\n  <main>...</main>\n</body>";
    }

    // 6. REDIRECT_CHAIN
    else if (ruleCode === "REDIRECT_CHAIN") {
      safety = "REVIEW_REQUIRED";
      effort = "small";
      whyItMatters =
        "Multi-hop redirect chains (e.g. A → B → C) delay page load times for users, waste search engine crawl budget, and risk crawler drop-off before reaching the final URL.";
      objective = `Update internal links and server redirect rules so source URLs redirect directly to the final destination in a single hop (${targetUrl || "final target"}).`;
      steps.push({
        stepNumber: 1,
        action: "Inspect the intermediate redirect hops.",
        location: "Webflow 301 Redirects / Server Config",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Configure direct 1-hop redirect.",
        location: "Server Redirect Rules",
        details: `Change original source redirect to point directly to ${targetUrl || "final destination URL"}.`,
      });
      cautions.push("Test redirect rules to ensure no circular routing is created.");
    }

    // 7. REDIRECT_LOOP
    else if (ruleCode === "REDIRECT_LOOP") {
      safety = "HIGH_RISK";
      priority = "critical";
      whyItMatters =
        "A circular redirect loop (e.g. A → B → A) creates an infinite request cycle that causes browsers and search engine crawlers to immediately abort with a crawl error.";
      objective = "Break the circular redirect loop by removing the conflicting redirect rule.";
      steps.push({
        stepNumber: 1,
        action: "Identify the conflicting redirect rules.",
        location: "Redirect table / Nginx / Cloudflare / Webflow Redirects",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Delete or correct the cyclical hop.",
        location: "Redirect rules",
        details: "Ensure all source URLs terminate at a valid 200 OK page without bouncing back.",
      });
      cautions.push("CRITICAL: Redirect loops completely lock out both users and search engines. Fix immediately.");
    }

    // 7. CANONICAL_CHAIN
    if (ruleCode === "CANONICAL_CHAIN") {
      whyItMatters = "Search engines typically ignore canonical declarations when chained (A -> B -> C), leading to unpredictable indexing.";
      objective = `Update the canonical tag on ${affectedUrl || "this page"} to point directly to the final canonical destination (${targetUrl || "final target"}).`;
      steps.push({
        stepNumber: 1,
        action: "Identify the terminal canonical URL.",
        location: context.platform === "webflow" ? "Webflow Page Settings" : "HTML <head>",
        details: `Change canonical from intermediate page to final canonical: ${targetUrl || "final canonical URL"}`,
      });
      cautions.push("Ensure the final target URL is self-canonicalizing and returns HTTP 200.");
      priority = "critical";
      safety = "HIGH_RISK";
    }

    // 8. CANONICAL_RELATIVE
    if (ruleCode === "CANONICAL_RELATIVE") {
      whyItMatters = "Relative canonical tags resolve validly against the document base, but fully qualified absolute URLs (https://example.com/path) are recommended to prevent multi-domain, staging mirror, or protocol ambiguity.";
      objective = `Consider updating the canonical href on ${affectedUrl || "this page"} to a fully qualified absolute URL starting with https:// for multi-host clarity.`;
      steps.push({
        stepNumber: 1,
        action: "Optionally convert relative canonical path to absolute URL.",
        location: context.platform === "webflow" ? "Webflow Page Settings" : "HTML <head>",
        details: "Prepend the authoritative site origin (https://domain.com) to the canonical path.",
      });
      priority = "low";
      safety = "SAFE";
      effort = "quick";
    }

    // 9. REDIRECT_TO_BROKEN_4XX
    if (ruleCode === "REDIRECT_TO_BROKEN_4XX") {
      whyItMatters = "A redirect pointing to a broken 4xx or 5xx URL creates a dead-end crawl trap, wasting search engine equity.";
      objective = `Update the redirect rule on ${affectedUrl || "this URL"} to point to an active 200 OK destination or remove the redirect.`;
      steps.push({
        stepNumber: 1,
        action: "Update redirect destination in routing configuration.",
        location: context.platform === "webflow" ? "Webflow Project Settings → 301 Redirects" : "Server Redirect Config",
        details: "Point the redirect rule to a live, relevant 200 OK page.",
      });
      cautions.push("Do not leave redirects pointing to deleted or non-existent pages.");
      priority = "critical";
      safety = "SAFE";
      effort = "quick";
    }

    // 10. REDIRECT_META_REFRESH
    if (ruleCode === "REDIRECT_META_REFRESH") {
      whyItMatters = "Client-side meta refresh redirects delay page loading and are treated less favorably than server-side 301 redirects.";
      objective = `Remove the <meta http-equiv='refresh'> tag and implement a server-side 301 redirect.`;
      steps.push({
        stepNumber: 1,
        action: "Remove meta refresh tag from HTML <head>.",
        location: context.platform === "webflow" ? "Webflow Page Settings → Inside <head> Tag" : "HTML <head>",
        details: "Delete <meta http-equiv='refresh'> element.",
      });
      steps.push({
        stepNumber: 2,
        action: "Configure server-side 301 redirect.",
        location: context.platform === "webflow" ? "Webflow Project Settings → 301 Redirects" : "Server Config (.htaccess/nginx/next.config.js)",
        details: "Set up 301 permanent redirect from old URL to target URL.",
      });
      priority = "high";
      safety = "SAFE";
      effort = "quick";
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
      confidence: "confirmed",
      safety,
      effort,
      classification: isSystemic ? "SYSTEMIC_FIX" : safety === "HIGH_RISK" ? "HIGH_IMPACT" : "QUICK_WIN",
      fixLeverageScore: Math.round(((issue.impactScore || 6) * issue.affectedPages.length * 1.0) / (effort === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl ${affectedUrl || "site"} and trace HTTP status codes and canonical tags.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : ruleCode.startsWith("REDIRECT_") ? "server_configuration" : "page",
        confidence: 0.95,
        reason: isSystemic ? "Shared across multiple pages via template header" : "Routing or page configuration",
      },
      canAutoFix: false,
    };
  }
}
