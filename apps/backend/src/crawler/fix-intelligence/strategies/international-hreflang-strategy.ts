/**
 * Fix Strategy for International Hreflang and Localization.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class InternationalHreflangStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return ruleCode.startsWith("HREFLANG_");
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
    let effort: SeoFixIntelligence["effort"] = "small";
    let priority: SeoFixIntelligence["priority"] = "medium";
    let confidence: SeoFixIntelligence["confidence"] = "confirmed";

    // 1. HREFLANG_INVALID_CODE
    if (ruleCode === "HREFLANG_INVALID_CODE") {
      whyItMatters =
        "Search engines ignore hreflang tags that contain invalid ISO 639-1 language or ISO 3166-1 Alpha 2 region codes, breaking geo-targeting.";
      objective = "Update the hreflang attribute value to match valid BCP 47 format (e.g. 'en', 'en-US', 'fr-CA', or 'x-default').";
      steps.push({
        stepNumber: 1,
        action: "Inspect the invalid hreflang code.",
        location: affectedUrl || "HTML <head>",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Correct the language / country code format.",
        location: "Hreflang link tag / plugin",
        details: "Use ISO 639-1 for language (lowercase) and ISO 3166-1 for country (uppercase or lowercase, e.g. 'en-gb').",
      });
      exampleBefore = '<link rel="alternate" hreflang="eng-usa" href="...">';
      exampleAfter = '<link rel="alternate" hreflang="en-us" href="...">';
    }

    // 2. HREFLANG_MISSING_RETURN
    else if (ruleCode === "HREFLANG_MISSING_RETURN") {
      whyItMatters =
        "Hreflang annotations must be reciprocal (bi-directional). If Page A links to Page B, Page B MUST link back to Page A with a matching hreflang tag. Missing return links cause Google to ignore the entire annotation cluster.";
      objective = `Add a reciprocal return hreflang tag on the target page pointing back to ${affectedUrl || "this source page"}.`;
      steps.push({
        stepNumber: 1,
        action: "Locate the target language alternate page.",
        location: "Target Alternate Page <head>",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Insert the reciprocal hreflang tag on the target page.",
        location: "Target Page <head>",
        details: `Add <link rel="alternate" hreflang="[source-language]" href="${affectedUrl || "https://example.com/source-url"}">`,
      });
      exampleBefore = '<!-- On target page: Missing link back to original language -->';
      exampleAfter = `<!-- On target page: -->\n<link rel="alternate" hreflang="en" href="${affectedUrl || "https://example.com/en/page"}">\n<link rel="alternate" hreflang="es" href="https://example.com/es/page">`;
      cautions.push("Both pages must reciprocally declare all language alternatives in the cluster.");
    }

    // 3. HREFLANG_TARGET_NON_INDEXABLE
    else if (ruleCode === "HREFLANG_TARGET_NON_INDEXABLE") {
      priority = "critical";
      safety = "SAFE";
      whyItMatters = "Google ignores hreflang annotations that point to 4xx broken pages, 3xx redirecting URLs, or noindex targets.";
      objective = "Update hreflang annotations to reference only active 200 OK indexable canonical destination URLs.";
      steps.push({
        stepNumber: 1,
        action: "Update hreflang alternate URL.",
        location: "Hreflang Configuration / HTML <head>",
        details: "Change href to the final active 200 OK canonical URL for that language.",
      });
      cautions.push("Never point hreflang tags to broken or redirecting pages.");
    }

    // 4. HREFLANG_SELF_REF_MISSING
    else {

      whyItMatters =
        "Best practice and search engine specifications require each localized page to include a self-referencing hreflang tag alongside its alternate language links.";
      objective = `Add a self-referencing hreflang tag on ${affectedUrl || "this page"} pointing to its own URL.`;
      steps.push({
        stepNumber: 1,
        action: "Add self-referencing hreflang link tag.",
        location: affectedUrl || "HTML <head>",
        details: observed,
      });
      exampleBefore = '<link rel="alternate" hreflang="es" href="https://example.com/es/page">';
      exampleAfter = `<link rel="alternate" hreflang="en" href="${affectedUrl || "https://example.com/en/page"}">\n<link rel="alternate" hreflang="es" href="https://example.com/es/page">`;
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
      classification: isSystemic ? "SYSTEMIC_FIX" : "HIGH_IMPACT",
      fixLeverageScore: Math.round(((issue.impactScore || 3) * issue.affectedPages.length * 1.0) / ((effort as string) === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl localized cluster with Dream SEO and verify reciprocal hreflang tags.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "site_configuration",
        confidence: 0.95,
        reason: "Hreflang cluster configuration across multilingual templates",
      },
      canAutoFix: false,
    };
  }
}
