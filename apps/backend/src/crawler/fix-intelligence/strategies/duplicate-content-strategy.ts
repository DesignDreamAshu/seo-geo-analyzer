/**
 * Fix Strategy for Duplicate Titles, Meta Descriptions, Headings, and Content Clones.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class DuplicateContentStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return ruleCode.startsWith("DUP_");
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

    let safety: SeoFixIntelligence["safety"] = "REVIEW_REQUIRED";
    let effort: SeoFixIntelligence["effort"] = "small";
    let priority: SeoFixIntelligence["priority"] = "high";

    // 1. DUP_IDENTICAL_TITLE / DUP_META_DESC / DUP_H1
    if (ruleCode === "DUP_IDENTICAL_TITLE" || ruleCode === "DUP_META_DESC" || ruleCode === "DUP_H1") {
      const field = ruleCode === "DUP_IDENTICAL_TITLE" ? "<title> tags" : ruleCode === "DUP_META_DESC" ? "meta descriptions" : "<h1> headings";
      whyItMatters = `Duplicate ${field} across multiple URLs cause keyword cannibalization, making search engines uncertain which page to rank for relevant queries.`;
      objective = `Differentiate the ${field} across the duplicate URL cluster so each page distinctly reflects its unique purpose.`;
      steps.push({
        stepNumber: 1,
        action: `Review the shared ${field} across affected URLs.`,
        location: "Page SEO Settings / CMS Template",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: `Craft unique ${field} for each page.`,
        location: "Page Settings / CMS Schema",
        details: "Include specific sub-topics, location modifiers, service categories, or job titles to ensure distinct intent.",
      });
      cautions.push("For CMS collections, ensure dynamic fields (e.g. {{Title}} | {{Category}}) are used in the template SEO settings rather than hardcoded static text.");
    }

    // 2. DUP_MAIN_CONTENT_EXACT
    else if (ruleCode === "DUP_MAIN_CONTENT_EXACT") {
      priority = "critical";
      effort = "medium";
      whyItMatters =
        "Search engines filter out exact cloned pages to avoid serving repetitive results. Having identical body text across multiple URLs dissipates backlink equity and organic traffic.";
      objective = "Choose the best remediation strategy for this duplicate cluster: Differentiate, Canonicalize, 301 Redirect, or Merge.";
      steps.push({
        stepNumber: 1,
        action: "Select the appropriate duplicate consolidation strategy:",
        location: "Duplicate Cluster Review",
        details: "Option A (Differentiate): Rewrite content to address distinct audiences/services. Option B (Canonicalize): Add cross-page canonical pointing to primary version. Option C (301 Redirect): Permanently redirect secondary duplicates into primary URL. Option D (Noindex): Apply noindex to internal duplicates.",
      });
      steps.push({
        stepNumber: 2,
        action: "Apply chosen consolidation method.",
        location: "CMS / Server / Canonical Settings",
        details: "Consolidate link authority into a single primary canonical URL.",
      });
      cautions.push("Do NOT leave duplicate pages active without canonical or redirect instructions; Google will algorithmically choose one and ignore the rest.");
    }

    // 3. DUP_MAIN_CONTENT_NEAR
    else {
      priority = "medium";
      effort = "medium";
      whyItMatters =
        "Pages with > 80% word similarity (e.g. location doorway pages with only city names swapped) risk being de-indexed under search spam and unhelpful content guidelines.";
      objective = "Enrich near-duplicate pages with unique local data, specialized case studies, team bios, and differentiated editorial value.";
      steps.push({
        stepNumber: 1,
        action: "Add substantial unique section blocks.",
        location: "CMS / Copywriting",
        details: observed,
      });
      cautions.push("Avoid boilerplate-heavy templates where only a single keyword changes across dozens of pages.");
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
      confidence: "confirmed",
      safety,
      effort,
      classification: isSystemic ? "SYSTEMIC_FIX" : "PAGE_SPECIFIC",
      fixLeverageScore: Math.round(((issue.impactScore || 6) * issue.affectedPages.length * 1.0) / ((effort as string) === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl affected URLs and verify uniqueness with Dream SEO.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "cms_content",
        confidence: 0.9,
        reason: isSystemic ? "Shared CMS template outputting identical metadata" : "Content duplication across CMS records or static pages",
      },
      canAutoFix: false,
    };
  }
}
