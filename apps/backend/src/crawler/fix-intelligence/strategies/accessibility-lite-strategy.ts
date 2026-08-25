/**
 * Fix Strategy for Accessibility-Lite signals (Main Landmark and Form Controls).
 */

import type { DiagnosticIssue } from "../../types";
import type { SeoFixIntelligence, FixStep } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class AccessibilityLiteStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return ruleCode.startsWith("A11Y_");
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

    // 1. A11Y_MISSING_MAIN_LANDMARK
    if (ruleCode === "A11Y_MISSING_MAIN_LANDMARK") {
      priority = "medium";
      whyItMatters =
        "The <main> HTML5 landmark element defines the unique central content of the document, enabling screen reader users and assistive devices to bypass repetitive navigation and jump directly to body content.";
      objective = "Wrap the primary body content of the page in a semantic <main> tag.";
      steps.push({
        stepNumber: 1,
        action: "Locate the primary content wrapper container in the template.",
        location: isSystemic ? `${context.templateName || "Page Template"} → Main Wrapper` : `${affectedUrl || "Page"} → DOM Body`,
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Change container tag from <div> to <main>.",
        location: context.platform === "webflow" ? "Webflow Element Settings (D) → HTML Tag: <main>" : "HTML template markup",
        details: "Ensure header, navbar, and footer remain outside this <main> container.",
      });
      exampleBefore = '<header>...</header>\n<div class="main-wrapper">\n  <h1>Title</h1>\n</div>\n<footer>...</footer>';
      exampleAfter = '<header>...</header>\n<main class="main-wrapper">\n  <h1>Title</h1>\n</main>\n<footer>...</footer>';
      cautions.push("Do NOT wrap headers, global navigation menus, or footers inside the <main> element.");
      cautions.push("A document should contain only one visible <main> landmark.");
    }

    // 2. A11Y_UNLABELLED_FORM_CONTROL
    else if (ruleCode === "A11Y_UNLABELLED_FORM_CONTROL") {
      priority = "low"; // Accessibility/quality finding, not a high direct SEO ranking issue
      whyItMatters =
        "Form input controls without an associated <label>, aria-label, or aria-labelledby cannot be identified by screen readers, creating serious accessibility barriers.";
      objective = "Attach an explicit visible <label for='...'> or aria-label to all input, select, and textarea elements.";
      steps.push({
        stepNumber: 1,
        action: "Locate the unlabelled form input element.",
        location: affectedUrl || "Form Container",
        details: observed,
        codeSnippet,
      });
      steps.push({
        stepNumber: 2,
        action: "Add a matching label or aria-label.",
        location: "Form Element Settings / HTML",
        details: "Add <label for='input-id'>Field Name</label> with matching id, or add aria-label='[Descriptive Label]' to the <input> element.",
      });
      exampleBefore = '<input type="email" placeholder="Your Email">';
      exampleAfter = '<label for="user-email">Email Address</label>\n<input id="user-email" type="email" placeholder="Your Email">\n<!-- or <input type="email" aria-label="Email Address" placeholder="Your Email"> -->';
      cautions.push("A placeholder attribute is NOT a sufficient replacement for a label or aria-label.");
    }

    // 3. A11Y_BUTTON_NAME_MISSING
    else if (ruleCode === "A11Y_BUTTON_NAME_MISSING") {
      priority = "medium";
      whyItMatters =
        "Buttons without accessible names are announced as unlabelled or empty by screen readers, making interactive features unusable for assistive technology users.";
      objective = "Provide a clear, accessible name for every interactive <button> element.";
      steps.push({
        stepNumber: 1,
        action: "Inspect the affected button element.",
        location: `${affectedUrl || "Page"} → DOM Button`,
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Add descriptive visible text or an aria-label attribute.",
        location: "Button element HTML / Component",
        details: "For icon-only buttons (like search or hamburger menus), add aria-label='Search' or aria-label='Open Navigation Menu'.",
      });
      exampleBefore = '<button class="icon-btn"><svg>...</svg></button>';
      exampleAfter = '<button class="icon-btn" aria-label="Search site"><svg>...</svg></button>';
      cautions.push("Do not leave aria-label empty or use generic terms like 'button' or 'click'.");
    }

    // 4. A11Y_IFRAME_TITLE_MISSING
    else if (ruleCode === "A11Y_IFRAME_TITLE_MISSING") {
      priority = "low";
      whyItMatters =
        "The title attribute on an <iframe> provides screen reader users with context about embedded external content (such as maps, video players, or forms).";
      objective = "Add a concise, descriptive title attribute to the <iframe> tag.";
      steps.push({
        stepNumber: 1,
        action: "Locate the <iframe> element in the page markup.",
        location: `${affectedUrl || "Page"} → <iframe> tag`,
        details: observed,
      });
      steps.push({
        stepNumber: 2,
        action: "Add title attribute explaining the embedded resource.",
        location: "HTML <iframe> tag",
        details: "Example: <iframe title='Google Map Location' src='...'>",
      });
      exampleBefore = '<iframe src="https://maps.google.com/embed?..." width="600" height="450"></iframe>';
      exampleAfter = '<iframe title="Company Headquarters Map" src="https://maps.google.com/embed?..." width="600" height="450"></iframe>';
      cautions.push("Keep the title concise and descriptive; avoid vague titles like 'iframe' or the file URL.");
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
      subCategory: "ACCESSIBILITY_LITE",
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
        method: `Re-crawl ${affectedUrl || "page"} and verify DOM landmarks and form labels with Dream SEO.`,
        expectedOutcome: `${ruleCode} should no longer be emitted in the audit findings.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "page",
        confidence: 0.9,
        reason: isSystemic ? "Template structural element or form block" : "Page-level form control",
      },
      canAutoFix: false,
    };
  }
}
