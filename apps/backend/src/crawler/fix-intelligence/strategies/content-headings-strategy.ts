/**
 * Fix Strategy for Content Relevance, Titles, Meta Descriptions, Headings, and Soft 404s.
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class ContentHeadingsStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return (
      ruleCode.startsWith("CONTENT_") ||
      ruleCode.startsWith("TITLE_") ||
      ruleCode.startsWith("META_DESC_") ||
      ruleCode === "SOFT_404_CANDIDATE"
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

    let safety: SeoFixIntelligence["safety"] = "REVIEW_REQUIRED";
    let effort: SeoFixIntelligence["effort"] = "quick";
    let priority: SeoFixIntelligence["priority"] = "high";
    let confidence: SeoFixIntelligence["confidence"] = "confirmed";

    // 1. CONTENT_MISSING_H1
    if (ruleCode === "CONTENT_MISSING_H1") {
      priority = "high"; // Default is HIGH, reserving CRITICAL for severe crawl/index/canonical defects
      whyItMatters =
        "The primary <h1> heading communicates the central topic of the page to search engines and assistive technologies. Pages without an H1 lack clear semantic topic definition.";
      objective = `Assign an <h1> tag to the primary visible page title on ${affectedUrl || "this page"} (or its shared template).`;
      steps.push({
        stepNumber: 1,
        action: "Locate the primary hero/page title element on the canvas.",
        location: isSystemic ? `${context.templateName || "Shared Template"} → Hero Heading` : `${affectedUrl || "Page"} → Main Title`,
        details: "Identify the main visible title at the top of the page content.",
      });
      steps.push({
        stepNumber: 2,
        action: "Convert the element tag to <h1> while preserving styling.",
        location: context.platform === "webflow" ? "Webflow Element Settings (D) → Heading Type: H1" : "HTML / Component markup",
        details: "Change tag from <div>, <h2>, or <h3> to <h1>. Retain existing CSS classes to preserve visual appearance.",
      });
      exampleBefore = '<div class="hero-title">Service Overview</div>\n<!-- or <h2 class="title">Service Overview</h2> -->';
      exampleAfter = '<h1 class="hero-title">Service Overview</h1>';
      cautions.push("Do NOT add an extra invisible or hidden H1 just to satisfy the audit; convert the existing visible main heading.");
    }

    // 2. CONTENT_MULTIPLE_H1
    else if (ruleCode === "CONTENT_MULTIPLE_H1") {
      priority = "medium";
      whyItMatters =
        "Having multiple <h1> tags dilutes the primary topic signal and can confuse search crawlers and screen readers regarding which heading represents the document's main subject.";
      objective = "Retain a single primary <h1> for the page title and convert secondary headings to <h2> elements.";
      steps.push({
        stepNumber: 1,
        action: "Review all detected H1 tags on the page.",
        location: affectedUrl || "Page DOM",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Demote secondary H1 elements to <h2>.",
        location: "Page Canvas / Component Markup",
        details: "Keep the main hero title as <h1>. Change section titles (e.g. 'Our Services', 'Testimonials') to <h2>.",
      });
      exampleBefore = '<h1>Main Page Title</h1>\n<section>\n  <h1>Our Features</h1>\n</section>';
      exampleAfter = '<h1>Main Page Title</h1>\n<section>\n  <h2>Our Features</h2>\n</section>';
    }

    // 3. CONTENT_SKIPPED_HEADINGS
    else if (ruleCode === "CONTENT_SKIPPED_HEADINGS") {
      priority = "low";
      safety = "SAFE";
      whyItMatters =
        "Skipping heading levels (e.g. H2 directly followed by H4 without an H3) creates broken document outlines for screen readers and search crawlers.";
      objective = "Adjust heading levels to follow a sequential hierarchy (H1 → H2 → H3 → H4).";
      steps.push({
        stepNumber: 1,
        action: "Locate the heading transition.",
        location: affectedUrl || "Page Content",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Adjust the tag to match semantic hierarchy.",
        location: "Element Settings",
        details: "Change the heading level to the next consecutive number (e.g. H4 to H3). Adjust CSS styling classes if visual sizing needs to remain unchanged.",
      });
      cautions.push("Do NOT change heading tags purely for visual font sizing; use CSS classes for appearance and HTML tags for semantic hierarchy.");
    }

    // 4. CONTENT_EMPTY_HEADING
    else if (ruleCode === "CONTENT_EMPTY_HEADING") {
      priority = "low";
      safety = "SAFE";
      whyItMatters = "Empty heading tags (e.g. <h2></h2>) create phantom outline entries with zero keyword relevance.";
      objective = "Remove empty heading tags or populate them with descriptive text.";
      steps.push({
        stepNumber: 1,
        action: "Remove empty heading container from template or page.",
        location: affectedUrl || "Template",
        details: observed,
      });
    }

    // 5. CONTENT_MISSING_TITLE
    else if (ruleCode === "CONTENT_MISSING_TITLE") {
      priority = "critical";
      whyItMatters =
        "The <title> tag is the single most critical on-page SEO signal, determining your headline in search results (SERPs) and social shares.";
      objective = `Add a unique, descriptive <title> tag inside the <head> of ${affectedUrl || "this page"}.`;
      steps.push({
        stepNumber: 1,
        action: "Draft a unique title (30–60 characters).",
        location: context.platform === "webflow" ? "Webflow Page Settings → SEO Settings → Title Tag" : "HTML <head>",
        details: "Format: [Primary Keyword / Page Topic] — [Brand Name]",
      });
      exampleBefore = "<head>\n  <meta name=\"description\" content=\"...\">\n</head>";
      exampleAfter = `<head>\n  <title>Services & Solutions — BOT Consulting</title>\n  <meta name="description" content="...">\n</head>`;
      cautions.push("SUGGESTION — HUMAN REVIEW REQUIRED: Choose title copy that accurately matches search intent.");
    }

    // 6. TITLE_TOO_SHORT / TITLE_TOO_LONG
    else if (ruleCode === "TITLE_TOO_SHORT" || ruleCode === "TITLE_TOO_LONG") {
      priority = "medium";
      whyItMatters =
        "Search engines display ~50–60 characters (or ~600px) of title text. Titles that are too short miss keyword opportunities; titles that are too long get truncated in SERPs.";
      objective = "Refine the title tag length to fit within the optimal 30–60 character display band.";
      steps.push({
        stepNumber: 1,
        action: "Review current title length and wording.",
        location: affectedUrl || "Page SEO Settings",
        details: observed,
        codeSnippet,
      });
      cautions.push("Note: Character guidelines are SERP display recommendations, not algorithmic ranking limits.");
    }

    // 7. CONTENT_MISSING_META_DESC / META_DESC_TOO_SHORT / META_DESC_TOO_LONG
    else if (ruleCode.startsWith("CONTENT_MISSING_META_DESC") || ruleCode.startsWith("META_DESC_")) {
      priority = "medium";
      whyItMatters =
        "Meta descriptions act as advertising copy in Google search snippets, directly driving organic click-through rates (CTR).";
      objective = "Provide an engaging, accurate summary of the page content between 120–155 characters.";
      steps.push({
        stepNumber: 1,
        action: "Update the <meta name='description'> content attribute.",
        location: context.platform === "webflow" ? "Webflow Page Settings → SEO Settings → Meta Description" : "HTML <head>",
        details: "Write 1–2 compelling sentences summarizing what the user will find on the page, including a clear call to action.",
      });
      exampleBefore = '<meta name="description" content="Overview">';
      exampleAfter = '<meta name="description" content="Explore enterprise ServiceNow and cloud transformation consulting services designed to scale your operations. Contact our experts today.">';
    }

    // 8. CONTENT_THIN_WORD_COUNT
    else if (ruleCode === "CONTENT_THIN_WORD_COUNT") {
      priority = "medium";
      confidence = "heuristic";
      safety = "REVIEW_REQUIRED";
      effort = "medium";
      whyItMatters =
        "Pages with very sparse main content may struggle to satisfy user search intent and risk lower organic search visibility under helpful content quality guidelines.";
      objective = `Evaluate whether ${affectedUrl || "this page"} provides sufficient unique, useful information for its search and user intent.`;
      steps.push({
        stepNumber: 1,
        action: "Evaluate page intent and substantive content completeness.",
        location: affectedUrl || "Page Content / CMS Record",
        details: "Determine if the page answers the visitor's core question or provides sufficient context for its page type.",
      });
      steps.push({
        stepNumber: 2,
        action: "Enrich with relevant domain specifics.",
        location: "CMS Content Editor / Copywriting",
        details: "For job listings: add clear responsibilities, qualifications, work model (remote/hybrid/onsite), team/role context, and application instructions. For services: include deliverables, case studies, and FAQs.",
      });
      cautions.push("Heuristic Advisory: Search engines do NOT enforce arbitrary word count minimums. Do not expand content merely to hit a target word count; prioritize clarity, unique value, and user intent fulfillment.");
    }

    // 9. SOFT_404_CANDIDATE
    else if (ruleCode === "SOFT_404_CANDIDATE") {
      priority = "high";
      safety = "HIGH_RISK";
      effort = "quick";
      whyItMatters =
        "Returning HTTP 200 OK for a page displaying an error or missing-content template confuses search engines into indexing broken pages, wasting crawl budget.";
      objective = "Configure the web server to return an explicit HTTP 404 (Not Found) or 410 (Gone) status code, or populate the page with valid content.";
      steps.push({
        stepNumber: 1,
        action: "Determine if URL is truly a missing/deleted resource.",
        location: affectedUrl || "Server Routing",
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Fix status code or content.",
        location: "Server Configuration / CMS",
        details: "If deleted, return HTTP 404 / 410. If valid, replace the 'Not Found' template text with actual page content.",
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
      classification: isSystemic ? "SYSTEMIC_FIX" : ruleCode === "CONTENT_MISSING_H1" ? "QUICK_WIN" : "PAGE_SPECIFIC",
      fixLeverageScore: Math.round(((issue.impactScore || 5) * issue.affectedPages.length * 1.0) / ((effort as string) === "quick" ? 1 : 2) * 10) / 10,
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
        method: `Re-crawl ${affectedUrl || "page"} and verify DOM headings / metadata with Dream SEO.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "page",
        confidence: 0.9,
        reason: isSystemic ? "Shared across multiple pages in this collection or layout template" : "Page-level copy or metadata",
      },
      canAutoFix: false,
    };
  }
}
