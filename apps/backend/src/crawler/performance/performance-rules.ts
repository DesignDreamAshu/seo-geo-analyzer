/**
 * Diagnostic Performance & Core Web Vitals Rules Evaluation Engine
 * Evaluates normalized PagePerformanceFacts and emits formal DiagnosticIssues.
 */

import { DiagnosticIssue, DiagnosticEvidence } from "../types";
import { PagePerformanceFacts } from "./types";

export function evaluatePerformanceDiagnosticRules(
  perfFacts: PagePerformanceFacts[],
  totalPages: number = perfFacts.length
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  const addIssue = (partial: Omit<DiagnosticIssue, "id" | "affectedCount" | "affectedOccurrences" | "affectedUniquePages" | "eligiblePageCount" | "affectedRatio">) => {
    const uniqueUrls = Array.from(new Set(partial.affectedPages.map((p) => p.url)));
    issues.push({
      ...partial,
      id: `issue_${partial.code}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      affectedCount: uniqueUrls.length,
      affectedOccurrences: partial.affectedPages.length,
      affectedUniquePages: uniqueUrls.length,
      eligiblePageCount: totalPages,
      affectedRatio: totalPages > 0 ? uniqueUrls.length / totalPages : 0,
    });
  };

  // 1. FIELD_LCP_POOR (CrUX p75 LCP > 4000ms)
  const fieldLcpPoorPages: DiagnosticIssue["affectedPages"] = [];
  // 2. FIELD_LCP_NEEDS_IMPROVEMENT (CrUX p75 LCP 2501-4000ms)
  const fieldLcpNeedsImpPages: DiagnosticIssue["affectedPages"] = [];
  // 3. FIELD_INP_POOR (CrUX p75 INP > 500ms)
  const fieldInpPoorPages: DiagnosticIssue["affectedPages"] = [];
  // 4. FIELD_INP_NEEDS_IMPROVEMENT (CrUX p75 INP 201-500ms)
  const fieldInpNeedsImpPages: DiagnosticIssue["affectedPages"] = [];
  // 5. FIELD_CLS_POOR (CrUX p75 CLS > 0.25)
  const fieldClsPoorPages: DiagnosticIssue["affectedPages"] = [];
  // 6. FIELD_CLS_NEEDS_IMPROVEMENT (CrUX p75 CLS 0.101-0.25)
  const fieldClsNeedsImpPages: DiagnosticIssue["affectedPages"] = [];

  // 7. LAB_LCP_POOR (Simulated LCP > 4000ms)
  const labLcpPoorPages: DiagnosticIssue["affectedPages"] = [];
  // 8. LAB_CLS_POOR (Simulated CLS > 0.25)
  const labClsPoorPages: DiagnosticIssue["affectedPages"] = [];
  // 9. LAB_TBT_HIGH (Simulated TBT > 600ms)
  const labTbtHighPages: DiagnosticIssue["affectedPages"] = [];
  // 10. LAB_TTFB_SLOW (Server response > 1800ms)
  const labTtfbSlowPages: DiagnosticIssue["affectedPages"] = [];

  // 11. PERF_RENDER_BLOCKING_RESOURCES
  const renderBlockingPages: DiagnosticIssue["affectedPages"] = [];
  // 12. PERF_LCP_IMAGE_UNOPTIMIZED
  const lcpImageUnoptimizedPages: DiagnosticIssue["affectedPages"] = [];
  // 13. PERF_UNUSED_JAVASCRIPT_HIGH
  const unusedJsPages: DiagnosticIssue["affectedPages"] = [];
  // 14. PERF_DOM_SIZE_EXCESSIVE
  const domSizeExcessivePages: DiagnosticIssue["affectedPages"] = [];
  // 15. PERF_THIRD_PARTY_BLOCKING
  const thirdPartyBlockingPages: DiagnosticIssue["affectedPages"] = [];

  for (const page of perfFacts) {
    const mob = page.mobile;
    if (!mob) continue;

    // Field CWV Evaluation
    if (mob.field.sampleAvailable) {
      const scopeLabel = mob.field.fieldDataScope === "ORIGIN" ? " (Origin-level CrUX)" : " (URL-level CrUX)";

      // LCP Field
      if (mob.field.lcpP75Ms !== undefined) {
        if (mob.field.lcpP75Ms > 4000) {
          fieldLcpPoorPages.push({
            url: page.url,
            evidence: {
              observed: `Real-user 75th percentile LCP is ${(mob.field.lcpP75Ms / 1000).toFixed(2)}s (Poor > 4.0s)${scopeLabel}`,
              crawlTimestamp: mob.fetchedAt,
              sourceMode: "raw_http",
              sourceUrl: page.url,
            },
          });
        } else if (mob.field.lcpP75Ms > 2500) {
          fieldLcpNeedsImpPages.push({
            url: page.url,
            evidence: {
              observed: `Real-user 75th percentile LCP is ${(mob.field.lcpP75Ms / 1000).toFixed(2)}s (Needs Improvement 2.5s–4.0s)${scopeLabel}`,
              crawlTimestamp: mob.fetchedAt,
              sourceMode: "raw_http",
              sourceUrl: page.url,
            },
          });
        }
      }

      // INP Field
      if (mob.field.inpP75Ms !== undefined) {
        if (mob.field.inpP75Ms > 500) {
          fieldInpPoorPages.push({
            url: page.url,
            evidence: {
              observed: `Real-user 75th percentile INP is ${mob.field.inpP75Ms}ms (Poor > 500ms)${scopeLabel}`,
              crawlTimestamp: mob.fetchedAt,
              sourceMode: "raw_http",
              sourceUrl: page.url,
            },
          });
        } else if (mob.field.inpP75Ms > 200) {
          fieldInpNeedsImpPages.push({
            url: page.url,
            evidence: {
              observed: `Real-user 75th percentile INP is ${mob.field.inpP75Ms}ms (Needs Improvement 200ms–500ms)${scopeLabel}`,
              crawlTimestamp: mob.fetchedAt,
              sourceMode: "raw_http",
              sourceUrl: page.url,
            },
          });
        }
      }

      // CLS Field
      if (mob.field.clsP75 !== undefined) {
        if (mob.field.clsP75 > 0.25) {
          fieldClsPoorPages.push({
            url: page.url,
            evidence: {
              observed: `Real-user 75th percentile CLS is ${mob.field.clsP75.toFixed(3)} (Poor > 0.25)${scopeLabel}`,
              crawlTimestamp: mob.fetchedAt,
              sourceMode: "raw_http",
              sourceUrl: page.url,
            },
          });
        } else if (mob.field.clsP75 > 0.10) {
          fieldClsNeedsImpPages.push({
            url: page.url,
            evidence: {
              observed: `Real-user 75th percentile CLS is ${mob.field.clsP75.toFixed(3)} (Needs Improvement 0.10–0.25)${scopeLabel}`,
              crawlTimestamp: mob.fetchedAt,
              sourceMode: "raw_http",
              sourceUrl: page.url,
            },
          });
        }
      }
    }

    // Lab Metrics Evaluation
    if (mob.lab.lcpMs !== undefined && mob.lab.lcpMs > 4000) {
      labLcpPoorPages.push({
        url: page.url,
        evidence: {
          observed: `Simulated mobile Lighthouse LCP is ${(mob.lab.lcpMs / 1000).toFixed(2)}s (Poor > 4.0s)`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }

    if (mob.lab.cls !== undefined && mob.lab.cls > 0.25) {
      labClsPoorPages.push({
        url: page.url,
        evidence: {
          observed: `Simulated mobile Lighthouse CLS is ${mob.lab.cls.toFixed(3)} (Poor > 0.25)`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }

    if (mob.lab.tbtMs !== undefined && mob.lab.tbtMs > 600) {
      labTbtHighPages.push({
        url: page.url,
        evidence: {
          observed: `Simulated mobile Total Blocking Time (TBT) is ${mob.lab.tbtMs}ms (High > 600ms)`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }

    if (mob.lab.ttfbMs !== undefined && mob.lab.ttfbMs > 1800) {
      labTtfbSlowPages.push({
        url: page.url,
        evidence: {
          observed: `Simulated initial server response time (TTFB) is ${mob.lab.ttfbMs}ms (Slow > 1800ms)`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "raw_http",
          sourceUrl: page.url,
        },
      });
    }

    // Opportunities & Diagnostics
    const renderBlockingOpp = mob.opportunities.find((o) => o.id === "render-blocking-resources");
    if (renderBlockingOpp && renderBlockingOpp.savingsMs && renderBlockingOpp.savingsMs > 300) {
      renderBlockingPages.push({
        url: page.url,
        evidence: {
          observed: `Render-blocking CSS/JS resources delay page rendering by ~${renderBlockingOpp.savingsMs}ms`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }

    if (mob.lcpDiagnosis?.isLazyLoaded || (mob.lcpDiagnosis?.resourceType === "image" && mob.lab.lcpMs && mob.lab.lcpMs > 2500)) {
      lcpImageUnoptimizedPages.push({
        url: page.url,
        evidence: {
          observed: `Primary LCP element (${mob.lcpDiagnosis?.elementSelector || "hero image"}) contributes to delayed paint: ${mob.lcpDiagnosis?.resourceUrl || "hero"}`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
          targetUrl: mob.lcpDiagnosis?.resourceUrl,
        },
      });
    }

    const unusedJsOpp = mob.opportunities.find((o) => o.id === "unused-javascript");
    if (unusedJsOpp && unusedJsOpp.savingsBytes && unusedJsOpp.savingsBytes > 100 * 1024) {
      unusedJsPages.push({
        url: page.url,
        evidence: {
          observed: `High unused JavaScript payload: ${Math.round(unusedJsOpp.savingsBytes / 1024)}KB wasted across scripts`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }

    const domDiag = mob.diagnostics.find((d) => d.id === "dom-size");
    if (domDiag?.displayValue && parseInt(domDiag.displayValue.replace(/[^0-9]/g, ""), 10) > 1400) {
      domSizeExcessivePages.push({
        url: page.url,
        evidence: {
          observed: `Excessive DOM tree size: ${domDiag.displayValue} elements (Recommended < 800, Max < 1400)`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }

    const tpMainThreadTime = mob.thirdParties.reduce((acc, tp) => acc + tp.mainThreadBlockingTimeMs, 0);
    if (tpMainThreadTime > 400) {
      thirdPartyBlockingPages.push({
        url: page.url,
        evidence: {
          observed: `Third-party scripts consumed ${tpMainThreadTime}ms of main thread blocking time across ${mob.thirdParties.length} vendors`,
          crawlTimestamp: mob.fetchedAt,
          sourceMode: "rendered_playwright",
          sourceUrl: page.url,
        },
      });
    }
  }

  // Register issues
  if (fieldLcpPoorPages.length > 0) {
    addIssue({
      code: "FIELD_LCP_POOR",
      category: "page_speed_assets",
      severity: "warning",
      title: "Real-User Largest Contentful Paint (LCP) is Poor (> 4.0s)",
      description: "Aggregated Chrome User Experience Report (CrUX) field data indicates that over 25% of real users experience LCP > 4.0s.",
      recommendation: "Optimize LCP element delivery: compress hero images, preload critical assets, and eliminate render-blocking CSS/JS.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 6,
      affectedPages: fieldLcpPoorPages,
    });
  }

  if (fieldInpPoorPages.length > 0) {
    addIssue({
      code: "FIELD_INP_POOR",
      category: "page_speed_assets",
      severity: "warning",
      title: "Real-User Interaction to Next Paint (INP) is Poor (> 500ms)",
      description: "Chrome User Experience Report (CrUX) indicates poor real-user interaction responsiveness exceeding 500ms.",
      recommendation: "Break up long JavaScript tasks, defer non-critical third-party scripts, and optimize event handlers.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 6,
      affectedPages: fieldInpPoorPages,
    });
  }

  if (fieldClsPoorPages.length > 0) {
    addIssue({
      code: "FIELD_CLS_POOR",
      category: "page_speed_assets",
      severity: "warning",
      title: "Real-User Cumulative Layout Shift (CLS) is Poor (> 0.25)",
      description: "Real-user field data indicates severe visual instability during page load exceeding 0.25.",
      recommendation: "Set explicit width/height attributes on media, reserve layout space for dynamic elements and banners.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 6,
      affectedPages: fieldClsPoorPages,
    });
  }

  if (fieldLcpNeedsImpPages.length > 0) {
    addIssue({
      code: "FIELD_LCP_NEEDS_IMPROVEMENT",
      category: "page_speed_assets",
      severity: "warning",
      title: "Real-User Largest Contentful Paint (LCP) Needs Improvement (2.5s–4.0s)",
      description: "Real-user 75th percentile LCP is between 2.5s and 4.0s, failing the Google Good threshold (<= 2.5s).",
      recommendation: "Improve LCP asset delivery and server response time to bring real-user LCP below 2.5s.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 4,
      affectedPages: fieldLcpNeedsImpPages,
    });
  }

  if (fieldInpNeedsImpPages.length > 0) {
    addIssue({
      code: "FIELD_INP_NEEDS_IMPROVEMENT",
      category: "page_speed_assets",
      severity: "warning",
      title: "Real-User Interaction to Next Paint (INP) Needs Improvement (200ms–500ms)",
      description: "Real-user 75th percentile INP is between 200ms and 500ms, exceeding the 200ms Good target.",
      recommendation: "Reduce main-thread blocking time during user interactions and audit heavy UI script listeners.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 4,
      affectedPages: fieldInpNeedsImpPages,
    });
  }

  if (fieldClsNeedsImpPages.length > 0) {
    addIssue({
      code: "FIELD_CLS_NEEDS_IMPROVEMENT",
      category: "page_speed_assets",
      severity: "warning",
      title: "Real-User Cumulative Layout Shift (CLS) Needs Improvement (0.10–0.25)",
      description: "Real-user visual layout shift exceeds 0.10, causing noticeable page movement as assets load.",
      recommendation: "Audit late-loading fonts, unsized images, and dynamic injected widgets.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 4,
      affectedPages: fieldClsNeedsImpPages,
    });
  }

  if (labLcpPoorPages.length > 0) {
    addIssue({
      code: "LAB_LCP_POOR",
      category: "page_speed_assets",
      severity: "warning",
      title: "Simulated Lighthouse LCP is Poor (> 4.0s)",
      description: "Lab simulation under throttled mobile network conditions measures Largest Contentful Paint > 4.0s.",
      recommendation: "Optimize LCP element loading, eliminate render-blocking CSS, and ensure hero images load eagerly.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 5,
      affectedPages: labLcpPoorPages,
    });
  }

  if (labClsPoorPages.length > 0) {
    addIssue({
      code: "LAB_CLS_POOR",
      category: "page_speed_assets",
      severity: "warning",
      title: "Simulated Lighthouse CLS is Poor (> 0.25)",
      description: "Lab audit detects layout shifts > 0.25 occurring during initial synthetic page render.",
      recommendation: "Add width and height attributes to all image elements and avoid inserting DOM elements above existing content.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 5,
      affectedPages: labClsPoorPages,
    });
  }

  if (labTbtHighPages.length > 0) {
    addIssue({
      code: "LAB_TBT_HIGH",
      category: "page_speed_assets",
      severity: "warning",
      title: "High Total Blocking Time in lab simulation (> 600ms)",
      description: "Total Blocking Time (TBT) exceeds 600ms, indicating heavy JavaScript execution blocking the main thread.",
      recommendation: "Minimize main thread work, split large JavaScript bundles, and defer non-essential third-party tags.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 5,
      affectedPages: labTbtHighPages,
    });
  }

  if (labTtfbSlowPages.length > 0) {
    addIssue({
      code: "LAB_TTFB_SLOW",
      category: "page_speed_assets",
      severity: "warning",
      title: "Slow initial server response time / TTFB (> 1800ms)",
      description: "Server response time for the initial HTML document exceeds 1.8 seconds in lab measurements.",
      recommendation: "Utilize CDN edge caching, optimize database queries, and reduce backend processing latency.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 4,
      affectedPages: labTtfbSlowPages,
    });
  }

  if (renderBlockingPages.length > 0) {
    addIssue({
      code: "PERF_RENDER_BLOCKING_RESOURCES",
      category: "page_speed_assets",
      severity: "opportunity",
      title: "Render-blocking resources delaying first content paint",
      description: "Synchronous stylesheets or scripts in the HTML document head block the browser from painting content.",
      recommendation: "Inline critical CSS, defer non-critical stylesheets, and load scripts with defer or async attributes.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 4,
      affectedPages: renderBlockingPages,
    });
  }

  if (lcpImageUnoptimizedPages.length > 0) {
    addIssue({
      code: "PERF_LCP_IMAGE_UNOPTIMIZED",
      category: "page_speed_assets",
      severity: "opportunity",
      title: "LCP hero image delivery is unoptimized",
      description: "The primary hero image acting as the Largest Contentful Paint candidate is unoptimized or lazy-loaded.",
      recommendation: "Ensure LCP hero image has loading='eager', fetchpriority='high', and uses responsive WebP/AVIF formats.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 3,
      affectedPages: lcpImageUnoptimizedPages,
    });
  }

  if (unusedJsPages.length > 0) {
    addIssue({
      code: "PERF_UNUSED_JAVASCRIPT_HIGH",
      category: "page_speed_assets",
      severity: "opportunity",
      title: "High volume of unused JavaScript loaded on page (> 100KB)",
      description: "Significant portions of downloaded JavaScript are never executed during initial page rendering.",
      recommendation: "Implement code splitting, remove unused library imports, and dynamic-import interactive components.",
      confidence: "heuristic",
      confidenceScore: 0.75,
      impactScore: 2,
      affectedPages: unusedJsPages,
    });
  }

  if (domSizeExcessivePages.length > 0) {
    addIssue({
      code: "PERF_DOM_SIZE_EXCESSIVE",
      category: "page_speed_assets",
      severity: "opportunity",
      title: "Excessive DOM size (> 1,400 elements)",
      description: "A large DOM tree increases memory usage, slows layout and style calculations, and harms interaction latency.",
      recommendation: "Flatten component hierarchy, remove redundant wrapper divs, and paginate large lists.",
      confidence: "confirmed",
      confidenceScore: 1.0,
      impactScore: 2,
      affectedPages: domSizeExcessivePages,
    });
  }

  if (thirdPartyBlockingPages.length > 0) {
    addIssue({
      code: "PERF_THIRD_PARTY_BLOCKING",
      category: "page_speed_assets",
      severity: "opportunity",
      title: "Third-party scripts causing main thread execution delay (> 400ms)",
      description: "Third-party tracking, analytics, or chat widgets significantly block the browser main thread.",
      recommendation: "Load third-party scripts through Web Workers (Partytown), defer loading until user interaction, or consolidate tags.",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 3,
      affectedPages: thirdPartyBlockingPages,
    });
  }

  return issues;
}
