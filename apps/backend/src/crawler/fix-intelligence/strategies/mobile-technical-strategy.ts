/**
 * Fix Strategy for Mobile Viewport, Technical HTML, Security Headers, and Performance.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class MobileTechnicalStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return (
      ruleCode.startsWith("MOBILE_") ||
      ruleCode.startsWith("HTML_") ||
      ruleCode.startsWith("SEC_") ||
      ruleCode.startsWith("PERF_") ||
      ruleCode === "HTTP_STATUS_5XX_SERVER_ERROR"
    );
  }

  buildFixIntelligence(issue: DiagnosticIssue, context: FixContext): SeoFixIntelligence {
    const ruleCode = issue.code;
    const firstAff = issue.affectedPages[0];
    const affectedUrl = firstAff?.url;
    const observed = firstAff?.evidence?.observed || issue.description;
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

    // 1. MOBILE_VIEWPORT_MISSING / MOBILE_VIEWPORT_INVALID
    if (ruleCode === "MOBILE_VIEWPORT_MISSING" || ruleCode === "MOBILE_VIEWPORT_INVALID") {
      priority = "critical";
      whyItMatters =
        "Google evaluates websites using 100% Mobile-First Indexing. A missing or restrictive viewport tag causes mobile browsers to render desktop layouts or disables essential user pinch-to-zoom accessibility.";
      objective = "Include a standard, responsive <meta name='viewport'> tag inside the document <head>.";
      steps.push({
        stepNumber: 1,
        action: "Add or update the viewport meta tag inside <head>.",
        location: context.platform === "webflow" ? "Webflow Page Settings / Default Header" : "HTML <head>",
        details: "Ensure content='width=device-width, initial-scale=1.0' is present and remove any 'user-scalable=no' or 'maximum-scale=1.0' parameters.",
      });
      exampleBefore = ruleCode === "MOBILE_VIEWPORT_MISSING" ? "<head>\n</head>" : '<meta name="viewport" content="width=1024, user-scalable=no">';
      exampleAfter = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
      cautions.push("Never disable user zoom (user-scalable=no) as this violates WCAG accessibility criteria.");
    }

    // 2. HTML_LANG_MISSING
    else if (ruleCode === "HTML_LANG_MISSING") {
      priority = "medium";
      whyItMatters =
        "The <html> lang attribute declares the primary natural language of the document. Without it, screen readers cannot select the correct pronunciation synthesizer, and search engines may struggle with locale targeting.";
      objective = "Add a valid BCP 47 language code (e.g. lang='en') to the root <html> tag.";
      steps.push({
        stepNumber: 1,
        action: "Locate the root <html> tag in your site template or layout.",
        location: context.platform === "webflow" ? "Webflow Project Settings → General → Language Code" : "Base layout / HTML template",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Set the lang attribute with the primary language/region code.",
        location: "<html> element",
        details: "Example: <html lang='en'> or <html lang='en-US'>",
      });
      exampleBefore = "<html>\n<head>...</head>";
      exampleAfter = '<html lang="en">\n<head>...</head>';
      cautions.push("Use valid two-letter ISO 639-1 language codes (e.g. 'en', 'es', 'de') or BCP 47 language-region tags (e.g. 'en-GB').");
    }

    // 2b. HTML_CHARSET_MISSING
    else if (ruleCode === "HTML_CHARSET_MISSING") {
      priority = "medium";
      whyItMatters =
        "Declaring an explicit character encoding prevents character distortion (mojibake) and guards against UTF-7/XSS cross-site scripting vulnerabilities.";
      objective = "Add <meta charset='utf-8'> as the first element inside the document <head>.";
      steps.push({
        stepNumber: 1,
        action: "Add the charset meta declaration at the top of <head>.",
        location: context.platform === "webflow" ? "Webflow Page Settings / Custom Code <head>" : "HTML <head>",
        details: observed,
      });
      exampleBefore = "<head>\n  <title>Page Title</title>\n</head>";
      exampleAfter = '<head>\n  <meta charset="utf-8">\n  <title>Page Title</title>\n</head>';
      cautions.push("Ensure <meta charset='utf-8'> is placed within the first 1024 bytes of the HTML response.");
    }

    // 2c. HTML_DEPRECATED_TAGS
    else if (ruleCode === "HTML_DEPRECATED_TAGS") {
      priority = "low";
      safety = "REVIEW_REQUIRED";
      whyItMatters =
        "Deprecated presentational HTML elements (like <marquee>, <blink>, <font>, <center>) violate modern HTML5 standards and impair assistive technology navigation.";
      objective = "Refactor obsolete presentational HTML elements to semantic tags styled with CSS.";
      steps.push({
        stepNumber: 1,
        action: "Locate obsolete tags in document markup.",
        location: affectedUrl || "HTML template / CMS Rich Text",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Replace deprecated tags with CSS-styled semantic elements (e.g., replace <center> with CSS text-align: center; replace <font> with CSS font-family).",
        location: "CSS Stylesheet / Template",
        details: "Modernize layout using standard CSS classes.",
      });
      exampleBefore = "<center><font color='red'>Important Announcement</font></center>";
      exampleAfter = '<p class="announcement text-center text-red">Important Announcement</p>';
      cautions.push("REVIEW REQUIRED: Verify visual presentation after replacing obsolete tags to prevent styling regressions.");
    }

    // 2d. SEC_TARGET_BLANK_NOOPENER
    else if (ruleCode === "SEC_TARGET_BLANK_NOOPENER") {
      priority = "low";
      whyItMatters =
        "External links that open in a new tab without rel='noopener' or rel='noreferrer' can expose users to reverse tabnabbing and window.opener manipulation in legacy browsers.";
      objective = "Add rel='noopener noreferrer' to all external hyperlinks that specify target='_blank'.";
      steps.push({
        stepNumber: 1,
        action: "Locate target='_blank' external links.",
        location: affectedUrl || "HTML template / Rich Text links",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Add rel='noopener noreferrer' to the link attributes.",
        location: "Link Element Settings",
        details: "Ensure rel attribute contains 'noopener noreferrer'.",
      });
      exampleBefore = '<a href="https://external-partner.com" target="_blank">Partner Site</a>';
      exampleAfter = '<a href="https://external-partner.com" target="_blank" rel="noopener noreferrer">Partner Site</a>';
    }

    // 3. HTML_TITLE_MULTIPLE / HTML_META_DESC_MULTIPLE
    else if (ruleCode === "HTML_TITLE_MULTIPLE" || ruleCode === "HTML_META_DESC_MULTIPLE") {
      priority = "medium";
      whyItMatters =
        "Having duplicate <title> or <meta name='description'> tags confuses search crawlers regarding which snippet to index.";
      objective = "Consolidate to a single, unambiguous metadata tag in <head>.";
      steps.push({
        stepNumber: 1,
        action: "Locate duplicate tags.",
        location: affectedUrl || "HTML <head>",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Remove redundant tag injected by themes, embeds, or plugins.",
        location: "Template Header / Custom Code",
        details: "Ensure exactly one tag exists in <head>.",
      });
    }

    // 4. PERF_COMPRESSION_DISABLED
    else if (ruleCode === "PERF_COMPRESSION_DISABLED") {
      priority = "high";
      whyItMatters =
        "Serving uncompressed HTML responses > 10 KB increases network transfer time, inflates Time to First Byte (TTFB), and wastes user bandwidth on mobile devices.";
      objective = "Enable Gzip or Brotli compression on your web server, CDN, or reverse proxy.";
      steps.push({
        stepNumber: 1,
        action: "Verify compression settings in your web server / CDN configuration.",
        location: "Nginx / Apache / Cloudflare / Vercel Settings",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Enable Brotli ('br') or Gzip ('gzip') encoding for text/html MIME types.",
        location: "Server Configuration",
        details: "Ensure 'Content-Encoding: br' or 'Content-Encoding: gzip' header is returned on HTML responses.",
      });
      exampleBefore = "HTTP/1.1 200 OK\nContent-Type: text/html; charset=UTF-8\n(No Content-Encoding header)";
      exampleAfter = "HTTP/1.1 200 OK\nContent-Type: text/html; charset=UTF-8\nContent-Encoding: br";
      cautions.push("Most modern CDNs (Cloudflare, Fastly, CloudFront) enable Brotli automatically with a single toggle in dashboard settings.");
    }

    // 3. SEC_MIXED_CONTENT
    else if (ruleCode === "SEC_MIXED_CONTENT") {
      priority = "high";
      whyItMatters =
        "Loading unencrypted HTTP scripts, styles, or images on an HTTPS webpage triggers browser security warnings and blocks resource loading.";
      objective = "Update all resource URLs to use HTTPS or relative protocol URLs.";
      steps.push({
        stepNumber: 1,
        action: "Locate the insecure HTTP resource references.",
        location: affectedUrl || "Page DOM / Scripts",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Change protocol from http:// to https://.",
        location: "Asset src / href",
        details: "Ensure the external asset host supports SSL/TLS.",
      });
      exampleBefore = '<img src="http://cdn.example.com/image.jpg">\n<script src="http://api.example.com/widget.js"></script>';
      exampleAfter = '<img src="https://cdn.example.com/image.jpg">\n<script src="https://api.example.com/widget.js"></script>';
    }

    // 4. SEC_MISSING_NOSNIFF
    else if (ruleCode === "SEC_MISSING_NOSNIFF") {
      priority = "informational";
      safety = "SAFE";
      effort = "quick";
      whyItMatters =
        "The 'X-Content-Type-Options: nosniff' HTTP response header is a standard web server security hygiene practice preventing MIME-type sniffing attacks. It has no direct organic search ranking impact.";
      objective = "Configure server or reverse proxy to output 'X-Content-Type-Options: nosniff' header on all HTML responses.";
      steps.push({
        stepNumber: 1,
        action: "Add security response header in server/proxy configuration.",
        location: "Server HTTP Headers / CDN / Reverse Proxy Config",
        details: "Add header: 'X-Content-Type-Options: nosniff'",
      });
      exampleBefore = "HTTP/1.1 200 OK";
      exampleAfter = "HTTP/1.1 200 OK\nX-Content-Type-Options: nosniff";
      cautions.push("Security Hygiene: This is a general web-quality header, not a direct Google ranking signal. It should not take precedence over crawl or indexability defects.");
    }

    // 5. HTTP_STATUS_5XX_SERVER_ERROR
    else if (ruleCode === "HTTP_STATUS_5XX_SERVER_ERROR") {
      priority = "critical";
      safety = "HIGH_RISK";
      effort = "medium";
      whyItMatters = "Server 5xx errors completely block search engine crawlers and trigger rapid indexation drops.";
      objective = "Investigate application crashes, upstream gateway timeouts, or database exceptions on the web server.";
      steps.push({
        stepNumber: 1,
        action: "Inspect web server and application error logs.",
        location: "Web Server / Hosting Platform Logs",
        details: `Inspect server logs for 5xx errors occurring on ${affectedUrl || "this page"}.`,
      });
      cautions.push("5xx errors require backend developer investigation.");
    }

    // 6. PERF_LARGE_HTML_PAYLOAD / PERF_SLOW_SERVER_RESPONSE
    else {
      priority = "low";
      confidence = "heuristic";
      effort = "medium";
      whyItMatters =
        "Large document payloads and slow Time to First Byte (TTFB) delay browser rendering and increase mobile bounce rates.";
      objective = "Reduce initial HTML byte size via compression/code splitting, or optimize server caching/CDN edge delivery.";
      steps.push({
        stepNumber: 1,
        action: "Inspect document payload and TTFB.",
        location: "Server / CDN / Bundler",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Enable Brotli/Gzip compression and CDN edge caching.",
        location: "CDN / Hosting Provider",
        details: "Minify inline CSS/JS and ensure dynamic pages are cached at CDN edge locations.",
      });
      cautions.push("Performance heuristics flag potential bottleneck areas; measure with actual WebPageTest or Lighthouse for deep profiling.");
    }

    const platformGuidance = getPlatformRemediationGuidance(
      context.platform,
      ruleCode,
      issue.category,
      { isCmsPage: context.isCmsPage, templateName: context.templateName }
    );

    const subCategory: SeoFixIntelligence["subCategory"] = ruleCode.startsWith("SEC_")
      ? "SECURITY_LITE"
      : ruleCode.startsWith("MOBILE_")
      ? "CORE_SEO"
      : "TECHNICAL_QUALITY";

    return {
      id: `fix_${ruleCode}_${Buffer.from(affectedUrl || "site").toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`,
      ruleCode,
      category: issue.category,
      subCategory,
      title: issue.title,
      summary: issue.description,
      priority,
      confidence,
      safety,
      effort,
      classification: isSystemic ? "SYSTEMIC_FIX" : "QUICK_WIN",
      fixLeverageScore: Math.round(((issue.impactScore || 3) * issue.affectedPages.length * 1.0) / (effort === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl ${affectedUrl || "page"} and verify HTTP headers, markup, and payload size.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : ruleCode.startsWith("SEC_") || ruleCode.startsWith("PERF_") ? "server_configuration" : "page",
        confidence: 0.95,
        reason: "Document head or server header configuration",
      },
      canAutoFix: false,
    };
  }
}
