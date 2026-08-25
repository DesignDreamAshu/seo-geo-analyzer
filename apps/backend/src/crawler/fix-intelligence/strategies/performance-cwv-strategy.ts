/**
 * Performance & Core Web Vitals Fix Intelligence Strategy
 * Generates actionable remediation blueprints for Field CWV, Lab metrics, and Resource optimizations.
 */

import { DiagnosticIssue } from "../../types";
import type { FixStep, SeoFixIntelligence } from "../types";
import type { FixContext, RuleFixStrategy } from "./base";
import { getPlatformRemediationGuidance } from "../platform-adapters";

export class PerformanceCwvStrategy implements RuleFixStrategy {
  canHandle(ruleCode: string): boolean {
    return (
      ruleCode.startsWith("FIELD_") ||
      ruleCode.startsWith("LAB_") ||
      ruleCode.startsWith("PERF_")
    );
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

    let safety: SeoFixIntelligence["safety"] = "SAFE";
    let effort: SeoFixIntelligence["effort"] = "quick";
    let priority: SeoFixIntelligence["priority"] =
      ruleCode.endsWith("_POOR") ? "high" : ruleCode.endsWith("_NEEDS_IMPROVEMENT") ? "medium" : "medium";
    let isFieldRule = ruleCode.startsWith("FIELD_");

    // 1. FIELD_LCP_POOR / FIELD_LCP_NEEDS_IMPROVEMENT
    if (ruleCode === "FIELD_LCP_POOR" || ruleCode === "FIELD_LCP_NEEDS_IMPROVEMENT") {
      whyItMatters =
        "Largest Contentful Paint (LCP) measures when the main content of the page is rendered. Real-user field failures directly harm user engagement and Core Web Vitals rankings.";
      objective = "Optimize critical asset delivery and remove render blockers to bring real-user 75th percentile LCP below 2.5s.";
      steps.push({
        stepNumber: 1,
        action: "Inspect primary LCP element.",
        location: context.platform === "webflow" ? "Webflow Designer → Hero Image/Section" : "Hero Template",
        details: "Identify if the LCP element is an image, video, background, or text block.",
      });
      steps.push({
        stepNumber: 2,
        action: "Ensure eager loading and fetchpriority.",
        location: context.platform === "webflow" ? "Image Settings" : "HTML <img> Tag",
        details: "Set loading='eager' and fetchpriority='high'. Do NOT lazy-load above-the-fold hero images.",
      });
      steps.push({
        stepNumber: 3,
        action: "Compress and serve in modern format (WebP/AVIF).",
        location: "Media Asset Library",
        details: "Resize hero asset to exact render dimensions and compress below 200KB.",
      });
      cautions.push("Real-user CrUX field data reflects a 28-day rolling window; changes reflect in lab immediately, but field validation takes time.");
      safety = "SAFE";
      effort = "small";
    }

    // 2. FIELD_INP_POOR / FIELD_INP_NEEDS_IMPROVEMENT
    else if (ruleCode === "FIELD_INP_POOR" || ruleCode === "FIELD_INP_NEEDS_IMPROVEMENT") {
      whyItMatters =
        "Interaction to Next Paint (INP) measures page responsiveness to user clicks, taps, and key presses. Poor INP causes UI sluggishness.";
      objective = "Minimize main-thread blocking time during user interactions to bring real-user INP <= 200ms.";
      steps.push({
        stepNumber: 1,
        action: "Break up long JavaScript tasks.",
        location: "Frontend Scripts / Third-Party Tags",
        details: "Use requestAnimationFrame or setTimeout to yield to the main thread during heavy computations.",
      });
      steps.push({
        stepNumber: 2,
        action: "Audit third-party scripts.",
        location: context.platform === "webflow" ? "Project Settings → Custom Code" : "Script Manager / GTM",
        details: "Defer non-essential marketing, analytics, or chat widgets until after user interaction.",
      });
      cautions.push("Never block click or keydown handlers with synchronous loops or heavy DOM mutations.");
      safety = "REVIEW_REQUIRED";
      effort = "medium";
    }

    // 3. FIELD_CLS_POOR / FIELD_CLS_NEEDS_IMPROVEMENT
    else if (ruleCode === "FIELD_CLS_POOR" || ruleCode === "FIELD_CLS_NEEDS_IMPROVEMENT") {
      whyItMatters =
        "Cumulative Layout Shift (CLS) measures unexpected visual layout shifts during page loading. Shifts cause accidental clicks and poor experience.";
      objective = "Reserve layout space for all dynamic elements and media to keep real-user CLS <= 0.10.";
      steps.push({
        stepNumber: 1,
        action: "Add explicit width and height to all images and video embeds.",
        location: context.platform === "webflow" ? "Webflow Element Settings" : "HTML / CSS",
        details: "Ensure every media element has defined aspect ratio or dimensions.",
      });
      steps.push({
        stepNumber: 2,
        action: "Reserve space for dynamic content, cookie banners, and ads.",
        location: "CSS / Layout Components",
        details: "Use min-height or placeholder containers to prevent layout jumps when dynamic content renders.",
      });
      safety = "SAFE";
      effort = "quick";
    }

    // 4. LAB_LCP_POOR
    else if (ruleCode === "LAB_LCP_POOR") {
      whyItMatters = "Simulated mobile LCP exceeds 4.0s under standard throttled network conditions.";
      objective = "Optimize server response time and LCP asset delivery in mobile lab audit.";
      steps.push({
        stepNumber: 1,
        action: "Preload hero image and eliminate render-blocking CSS.",
        location: "HTML <head> / Webflow Custom Code",
        details: "Add <link rel='preload' as='image' href='...'> for critical hero asset.",
      });
      safety = "SAFE";
      effort = "quick";
    }

    // 5. LAB_CLS_POOR
    else if (ruleCode === "LAB_CLS_POOR") {
      whyItMatters = "Simulated initial page render causes visual layout movement > 0.25.";
      objective = "Eliminate layout shifts in lab simulation by fixing unsized elements.";
      steps.push({
        stepNumber: 1,
        action: "Specify width and height attributes on images and iframes.",
        location: "HTML / CSS",
        details: "Set explicit dimensions or CSS aspect-ratio.",
      });
      safety = "SAFE";
      effort = "quick";
    }

    // 6. LAB_TBT_HIGH
    else if (ruleCode === "LAB_TBT_HIGH") {
      whyItMatters = "Total Blocking Time exceeds 600ms, indicating heavy script execution monopolizing the CPU.";
      objective = "Reduce JavaScript execution time during initial page hydration.";
      steps.push({
        stepNumber: 1,
        action: "Defer non-critical scripts and split bundles.",
        location: "Custom Code / Script Tags",
        details: "Add defer attribute or load non-essential tags via async.",
      });
      safety = "REVIEW_REQUIRED";
      effort = "medium";
    }

    // 7. LAB_TTFB_SLOW
    else if (ruleCode === "LAB_TTFB_SLOW") {
      whyItMatters = "Initial server response time exceeds 1.8s, delaying all downstream resource discovery.";
      objective = "Enable CDN edge caching and optimize backend document generation.";
      steps.push({
        stepNumber: 1,
        action: "Verify CDN edge caching.",
        location: "Hosting / CDN Settings (Cloudflare / Webflow)",
        details: "Ensure static pages are served from edge cache with max-age headers.",
      });
      safety = "SAFE";
      effort = "quick";
    }

    // 8. PERF_RENDER_BLOCKING_RESOURCES
    else if (ruleCode === "PERF_RENDER_BLOCKING_RESOURCES") {
      whyItMatters = "Synchronous CSS/JS in <head> blocks browser rendering until downloaded and parsed.";
      objective = "Inline critical above-the-fold CSS and defer non-critical stylesheets and scripts.";
      steps.push({
        stepNumber: 1,
        action: "Add defer or async to head scripts.",
        location: "HTML <head>",
        details: "Ensure all <script src='...'> tags have defer or async attributes.",
      });
      safety = "SAFE";
      effort = "quick";
    }

    // 9. PERF_LCP_IMAGE_UNOPTIMIZED
    else if (ruleCode === "PERF_LCP_IMAGE_UNOPTIMIZED") {
      whyItMatters = "LCP candidate hero image is uncompressed, missing fetchpriority, or lazy-loaded.";
      objective = "Optimize LCP hero image delivery attributes.";
      steps.push({
        stepNumber: 1,
        action: "Set loading='eager' and fetchpriority='high'.",
        location: "Hero Image Element",
        details: "Remove loading='lazy' from hero image and add fetchpriority='high'.",
      });
      safety = "SAFE";
      effort = "quick";
    }

    // 10. Default performance fallback
    else {
      whyItMatters = "Resource and DOM efficiency directly improves user experience and Core Web Vitals.";
      objective = "Optimize asset payload, DOM tree structure, or third-party script loading.";
      steps.push({
        stepNumber: 1,
        action: "Review resource payload and script execution.",
        location: affectedUrl || "Page Assets",
        details: observed,
      });
      safety = "SAFE";
      effort = "small";
      priority = "medium";
    }

    const platformGuidance = getPlatformRemediationGuidance(
      context.platform,
      ruleCode,
      issue.category,
      { isCmsPage: context.isCmsPage, templateName: context.templateName }
    );

    let fixConfidence: SeoFixIntelligence["confidence"] =
      issue.confidence === "confirmed" ? "confirmed" : issue.confidence === "likely" ? "high_confidence" : "heuristic";

    let classification: SeoFixIntelligence["classification"] = isSystemic
      ? "SYSTEMIC_FIX"
      : issue.severity === "critical"
      ? "HIGH_IMPACT"
      : "QUICK_WIN";

    return {
      id: `fix_${ruleCode}_${Buffer.from(affectedUrl || "site").toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`,
      ruleCode,
      category: issue.category,
      subCategory: "TECHNICAL_QUALITY",
      title: issue.title,
      summary: issue.description,
      priority,
      confidence: fixConfidence,
      safety,
      effort,
      classification,
      fixLeverageScore: Math.round(((issue.impactScore || 5) * issue.affectedPages.length * 1.0) / (effort === "quick" ? 1 : 2) * 10) / 10,
      affectedUrl,
      affectedCount: issue.affectedPages.length,
      problem: {
        observed,
        explanation: issue.description,
      },
      evidence: {
        source: firstAff?.evidence?.sourceMode || "rendered_browser",
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
        method: isFieldRule
          ? "Rerun PageSpeed Insights lab audit immediately for synthetic verification; real-user CrUX field status will update over a rolling 28-day window."
          : `Rerun performance audit on ${affectedUrl || "this page"} and verify metric improvement.`,
        expectedOutcome: `${ruleCode} should resolve or move into GOOD threshold.`,
        ruleShouldDisappear: true,
      },
      fixScope: {
        type: isSystemic ? "template" : "page",
        confidence: 0.9,
        reason: isSystemic ? "Template-level performance layout pattern" : "Page-specific asset payload",
      },
      canAutoFix: false,
    };
  }
}
