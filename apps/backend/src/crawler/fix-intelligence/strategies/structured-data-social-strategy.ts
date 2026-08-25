/**
 * Fix Strategy for Schema JSON-LD Structured Data and Social Meta Tags (OpenGraph).
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class StructuredDataSocialStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return ruleCode.startsWith("SCHEMA_") || ruleCode.startsWith("SOCIAL_");
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
    let priority: SeoFixIntelligence["priority"] = "low";
    let confidence: SeoFixIntelligence["confidence"] = "confirmed";

    // 1. SCHEMA_MALFORMED_JSON
    if (ruleCode === "SCHEMA_MALFORMED_JSON") {
      priority = "medium";
      safety = "SAFE"; // Pure deterministic syntax fix (closing brackets, escaping quotes) is SAFE
      whyItMatters =
        "Syntax errors (such as unescaped quotes, trailing commas, or missing brackets) cause search engines to completely discard the entire structured data block.";
      objective = "Fix JSON syntax errors inside the <script type='application/ld+json'> block.";
      steps.push({
        stepNumber: 1,
        action: "Inspect the raw JSON-LD block.",
        location: affectedUrl || "HTML <head> / Schema Embed",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Validate JSON syntax using a JSON validator or Google Rich Results Test.",
        location: "Custom Code / CMS Schema Embed",
        details: "Ensure all strings are escaped, object keys are quoted, and no trailing commas exist.",
      });
      cautions.push("Deterministic Syntax Only: Closing quotes/brackets is safe. If fixing schema requires modifying entity facts (prices, ratings, dates, authors), mark as REVIEW_REQUIRED and never fabricate business values.");
    }

    // 2. SCHEMA_MISSING_TYPE / SCHEMA_INVALID_CONTEXT
    else if (ruleCode === "SCHEMA_MISSING_TYPE" || ruleCode === "SCHEMA_INVALID_CONTEXT") {
      priority = "low";
      safety = "REVIEW_REQUIRED"; // Declaring business entity type is semantic and requires human review
      whyItMatters =
        "Valid Schema.org structured data requires an explicit '@context': 'https://schema.org' and a recognized '@type' (e.g. 'Organization', 'Article', 'JobPosting').";
      objective = "Add valid '@context' and '@type' declarations to the JSON-LD root object.";
      steps.push({
        stepNumber: 1,
        action: "Add '@context': 'https://schema.org' and declare the entity '@type'.",
        location: "JSON-LD Script Block",
        details: observed,
      });
      exampleBefore = '{\n  "name": "BOT Consulting"\n}';
      exampleAfter = '{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "BOT Consulting"\n}';
      cautions.push("REVIEW REQUIRED: Choose the exact Schema.org @type matching page entity intent (e.g. Article vs Organization vs Product).");
    }

    // 3. SCHEMA_BREADCRUMBLIST_INVALID
    else if (ruleCode === "SCHEMA_BREADCRUMBLIST_INVALID") {
      priority = "high";
      safety = "SAFE";
      whyItMatters = "Invalid BreadcrumbList schema (missing itemListElement or item positions) causes Google to reject breadcrumb rich search snippets.";
      objective = "Ensure BreadcrumbList includes an array of itemListElement items with 1-based sequential position integers.";
      steps.push({
        stepNumber: 1,
        action: "Structure itemListElement array with valid position numbers.",
        location: "JSON-LD Breadcrumb Block",
        details: "Include ListItem elements with position: 1, 2, 3... and valid name/item URLs.",
      });
      exampleBefore = '{\n  "@type": "BreadcrumbList",\n  "itemListElement": [{ "name": "Home" }]\n}';
      exampleAfter = '{\n  "@type": "BreadcrumbList",\n  "itemListElement": [\n    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" }\n  ]\n}';
    }

    // 4. SOCIAL_TWITTER_CARD_MISSING
    else if (ruleCode === "SOCIAL_TWITTER_CARD_MISSING") {
      priority = "low";
      whyItMatters =
        "The twitter:card meta tag instructs X/Twitter whether to display a compact summary or a rich, large image card when your content is shared.";
      objective = "Add <meta name='twitter:card' content='summary_large_image'> to document <head>.";
      steps.push({
        stepNumber: 1,
        action: "Add twitter:card meta tag inside <head>.",
        location: `${affectedUrl || "Page"} → HTML <head>`,
        details: observed,
      });
      exampleBefore = '<meta property="og:title" content="...">\n(No twitter:card tag)';
      exampleAfter = '<meta name="twitter:card" content="summary_large_image">';
      cautions.push("summary_large_image requires an accompanying og:image or twitter:image to display properly.");
    }

    // 4b. SOCIAL_OPENGRAPH_FALLBACK
    else if (ruleCode === "SOCIAL_OPENGRAPH_FALLBACK") {
      priority = "low";
      whyItMatters =
        "Social sharing platforms rely on complete Open Graph metadata (title, image, description) to generate preview snippets when specific platform tags are absent.";
      objective = "Ensure all primary Open Graph tags (og:title, og:image, og:description) are declared in <head>.";
      steps.push({
        stepNumber: 1,
        action: "Inspect missing Open Graph properties.",
        location: affectedUrl || "HTML <head>",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Add complete og:title, og:description, and absolute og:image tags.",
        location: "Page Open Graph Settings / <head>",
        details: "Provide fallback social metadata across all indexable content pages.",
      });
      exampleBefore = '<meta property="og:title" content="About Us">\n(Missing og:image and og:description)';
      exampleAfter = '<meta property="og:title" content="About Us">\n<meta property="og:description" content="Learn about our team.">\n<meta property="og:image" content="https://example.com/og-image.jpg">';
    }

    // 5. SOCIAL_INCOMPLETE_OG
    else {
      priority = "low";
      whyItMatters =
        "OpenGraph and Twitter meta tags control how your links appear when shared on LinkedIn, Slack, X, and Facebook. Missing or malformed OG images lead to blank preview cards or truncated descriptions.";
      objective = "Configure complete og:title, og:description, absolute og:image URL, and og:url in page metadata.";

      if (context.platform === "webflow") {
        if (context.isCmsPage) {
          steps.push({
            stepNumber: 1,
            action: "Open Webflow CMS Collection Template settings.",
            location: `Webflow Designer → CMS Collections → ${context.templateName || "Collection"} Template → Page Settings (gear icon)`,
            details: "Scroll down to the 'Open Graph Settings' section.",
          });
          steps.push({
            stepNumber: 2,
            action: "Bind Open Graph fields to CMS collection fields.",
            location: "Open Graph Settings",
            details: "Check 'Same as SEO title/description' or bind to CMS fields. For 'Open Graph Image URL', bind directly to the CMS 'Main Image' or 'Featured Image' asset field.",
          });
        } else {
          steps.push({
            stepNumber: 1,
            action: "Open Static Page Settings in Webflow Designer.",
            location: "Webflow Designer → Pages Panel → Select Page → Settings (gear icon)",
            details: "Navigate to Open Graph Settings.",
          });
          steps.push({
            stepNumber: 2,
            action: "Set absolute Open Graph Image URL.",
            location: "Open Graph Image URL field",
            details: "Paste the absolute HTTPS image URL (e.g. 'https://www.botconsulting.io/images/og-card.png') or upload an asset with recommended dimensions of 1200x630px.",
          });
        }
      } else {
        steps.push({
          stepNumber: 1,
          action: "Add complete OpenGraph and Twitter meta tags to document <head>.",
          location: "HTML <head> / Next.js Metadata / WordPress SEO Plugin",
          details: "Ensure all required tags are present and og:image uses an absolute HTTPS URL.",
        });
      }

      exampleBefore = '<meta property="og:title" content="...">';
      exampleAfter =
        '<meta property="og:title" content="Enterprise ServiceNow & Cloud Consulting">\n<meta property="og:description" content="Accelerate your digital transformation...">\n<meta property="og:image" content="https://www.botconsulting.io/og-image.jpg">\n<meta property="og:url" content="https://www.botconsulting.io/solutions">\n<meta property="og:type" content="website">\n<meta name="twitter:card" content="summary_large_image">';
      cautions.push(
        "Always use absolute HTTPS URLs for og:image. Relative URLs (/images/og.png) fail to resolve when shared on social platforms."
      );
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
      fixLeverageScore: Math.round(((issue.impactScore || 2) * issue.affectedPages.length * 1.0) / (effort === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl ${affectedUrl || "page"} and test with Google Rich Results Test or Dream SEO.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "site_configuration",
        confidence: 0.9,
        reason: isSystemic ? "Shared layout or schema template" : "Page-level metadata configuration",
      },
      canAutoFix: false,
    };
  }
}
