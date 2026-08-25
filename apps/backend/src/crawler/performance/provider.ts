/**
 * Performance Provider Abstraction & Response Normalizer
 * Normalizes raw Google PageSpeed Insights & CrUX API responses into structured PagePerformanceFacts.
 */

import {
  CoreWebVitalsRating,
  FieldDataScope,
  FieldMetrics,
  LabMetrics,
  LcpDiagnosis,
  ClsDiagnosis,
  InpDiagnosis,
  PerformanceDiagnosticItem,
  PerformanceOpportunity,
  PerformanceProfile,
  ResourcePerformanceFact,
  ThirdPartyImpactGroup,
} from "./types";
import { evaluateLcp, evaluateInp, evaluateCls, evaluateOverallFieldStatus } from "./thresholds";

export interface NormalizedPerformanceResult {
  url: string;
  strategy: "mobile" | "desktop";
  status: "OK" | "RATE_LIMITED" | "API_UNAVAILABLE" | "ERROR";
  profile?: PerformanceProfile;
  rawResponse?: any;
  errorMessage?: string;
}

export interface PerformanceProvider {
  name: string;
  fetchPerformanceData(url: string, strategy: "mobile" | "desktop"): Promise<NormalizedPerformanceResult>;
}

/**
 * Normalizes raw PageSpeed Insights JSON response into strict internal PerformanceProfile contract.
 */
export function normalizePageSpeedResponse(rawJson: any, strategy: "mobile" | "desktop"): PerformanceProfile | undefined {
  if (!rawJson || typeof rawJson !== "object") {
    return undefined;
  }

  const lighthouse = rawJson.lighthouseResult;
  const audits = lighthouse?.audits || {};
  const categories = lighthouse?.categories || {};

  // 1. Informational Composite Performance Score
  const perfCategoryScore = categories.performance?.score;
  const performanceScore = typeof perfCategoryScore === "number" ? Math.round(perfCategoryScore * 100) : undefined;

  // 2. Lab Metrics
  const lab: LabMetrics = {
    fcpMs: audits["first-contentful-paint"]?.numericValue,
    lcpMs: audits["largest-contentful-paint"]?.numericValue,
    cls: audits["cumulative-layout-shift"]?.numericValue,
    tbtMs: audits["total-blocking-time"]?.numericValue,
    speedIndexMs: audits["speed-index"]?.numericValue,
    ttfbMs: audits["server-response-time"]?.numericValue,
    interactiveMs: audits["interactive"]?.numericValue,
  };

  // 3. Field Metrics (CrUX) with strict URL vs ORIGIN scope detection
  let fieldDataScope: FieldDataScope = "NONE";
  let fieldMetricsSource = rawJson.loadingExperience;

  if (fieldMetricsSource && fieldMetricsSource.metrics && Object.keys(fieldMetricsSource.metrics).length > 0) {
    fieldDataScope = "URL";
  } else if (rawJson.originLoadingExperience && rawJson.originLoadingExperience.metrics && Object.keys(rawJson.originLoadingExperience.metrics).length > 0) {
    fieldDataScope = "ORIGIN";
    fieldMetricsSource = rawJson.originLoadingExperience;
  }

  const sampleAvailable = fieldDataScope !== "NONE" && fieldMetricsSource?.metrics !== undefined;
  const metrics = fieldMetricsSource?.metrics || {};

  const lcpP75Ms = metrics["LARGEST_CONTENTFUL_PAINT_MS"]?.percentile;
  const inpP75Ms = metrics["INTERACTION_TO_NEXT_PAINT"]?.percentile;
  const clsP75 = metrics["CUMULATIVE_LAYOUT_SHIFT_SCORE"] ? metrics["CUMULATIVE_LAYOUT_SHIFT_SCORE"].percentile / 100 : undefined;
  const fcpP75Ms = metrics["FIRST_CONTENTFUL_PAINT_MS"]?.percentile;
  const ttfbP75Ms = metrics["EXPERIMENTAL_TIME_TO_FIRST_BYTE"]?.percentile;

  const lcpRating = evaluateLcp(lcpP75Ms);
  const inpRating = evaluateInp(inpP75Ms);
  const clsRating = evaluateCls(clsP75);
  const overallCategory = evaluateOverallFieldStatus(lcpRating, inpRating, clsRating);

  const field: FieldMetrics = {
    lcpP75Ms,
    inpP75Ms,
    clsP75,
    fcpP75Ms,
    ttfbP75Ms,
    overallCategory,
    sampleAvailable,
    fieldDataScope,
  };

  // 4. LCP Diagnosis
  let lcpDiagnosis: LcpDiagnosis | undefined;
  const lcpAudit = audits["largest-contentful-paint-element"];
  if (lcpAudit) {
    const lcpItem = lcpAudit.details?.items?.[0];
    const node = lcpItem?.node;
    const likelyCauses: string[] = [];
    if (lab.ttfbMs && lab.ttfbMs > 800) likelyCauses.push("Slow initial server response time (TTFB)");
    if (audits["render-blocking-resources"]?.numericValue && audits["render-blocking-resources"].numericValue > 300) {
      likelyCauses.push("Render-blocking CSS/JavaScript delaying element discovery");
    }
    if (node?.snippet && node.snippet.includes("loading=\"lazy\"")) {
      likelyCauses.push("Primary LCP element uses loading='lazy'");
    }

    lcpDiagnosis = {
      metricValueMs: lab.lcpMs,
      rating: evaluateLcp(lab.lcpMs),
      elementSelector: node?.selector,
      elementSnippet: node?.snippet,
      resourceUrl: lcpItem?.url,
      resourceType: lcpItem?.type === "image" ? "image" : "text",
      isLazyLoaded: node?.snippet?.includes("loading=\"lazy\"") ?? false,
      fetchPriority: node?.snippet?.includes("fetchpriority") ? "high" : undefined,
      likelyCauses,
      confidence: node?.snippet ? "confirmed" : "likely",
      evidenceSource: "PSI_LAB",
    };
  }

  // 5. CLS Diagnosis
  let clsDiagnosis: ClsDiagnosis | undefined;
  const clsAudit = audits["layout-shifts"];
  if (clsAudit) {
    const shiftElements = (clsAudit.details?.items || []).map((it: any) => ({
      selector: it.node?.selector,
      snippet: it.node?.snippet,
      scoreContribution: it.score,
    }));
    const likelyCauses: string[] = [];
    if (audits["unsized-images"]?.details?.items?.length > 0) {
      likelyCauses.push("Images without explicit width and height dimensions");
    }
    clsDiagnosis = {
      metricValue: lab.cls,
      rating: evaluateCls(lab.cls),
      shiftElements,
      likelyCauses,
      confidence: shiftElements.length > 0 ? "confirmed" : "likely",
      evidenceSource: "PSI_LAB",
    };
  }

  // 6. INP Diagnosis (Field INP supported by Lab TBT & Long Tasks)
  let inpDiagnosis: InpDiagnosis | undefined;
  if (field.inpP75Ms !== undefined || lab.tbtMs !== undefined) {
    const likelyCauses: string[] = [];
    if (lab.tbtMs && lab.tbtMs > 200) likelyCauses.push("High Total Blocking Time (TBT) on main thread");
    if (audits["bootup-time"]?.numericValue && audits["bootup-time"].numericValue > 1000) {
      likelyCauses.push("Heavy JavaScript execution and parsing time");
    }
    if (audits["third-party-summary"]?.numericValue && audits["third-party-summary"].numericValue > 500) {
      likelyCauses.push("Third-party scripts blocking main thread");
    }

    inpDiagnosis = {
      metricValueMs: field.inpP75Ms,
      rating: field.inpP75Ms ? evaluateInp(field.inpP75Ms) : undefined,
      supportingLabTbtMs: lab.tbtMs,
      likelyCauses,
      confidence: field.inpP75Ms !== undefined ? "confirmed" : "heuristic",
      evidenceSource: field.inpP75Ms !== undefined ? "CRUX_FIELD" : "PSI_LAB",
    };
  }

  // 7. Opportunities & Resource Telemetry
  const opportunities: PerformanceOpportunity[] = [];
  const oppAudits = [
    { id: "render-blocking-resources", ownership: "FRONTEND" as const },
    { id: "unminified-javascript", ownership: "FRONTEND" as const },
    { id: "unminified-css", ownership: "FRONTEND" as const },
    { id: "unused-javascript", ownership: "FRONTEND" as const },
    { id: "unused-css-rules", ownership: "FRONTEND" as const },
    { id: "uses-optimized-images", ownership: "DESIGN_ASSET" as const },
    { id: "modern-image-formats", ownership: "DESIGN_ASSET" as const },
    { id: "uses-responsive-images", ownership: "DESIGN_ASSET" as const },
    { id: "efficient-animated-content", ownership: "DESIGN_ASSET" as const },
    { id: "uses-text-compression", ownership: "HOSTING_CDN" as const },
    { id: "uses-long-cache-ttl", ownership: "HOSTING_CDN" as const },
  ];

  for (const opp of oppAudits) {
    const a = audits[opp.id];
    if (a && typeof a.score === "number" && a.score < 0.9) {
      opportunities.push({
        id: opp.id,
        title: a.title || opp.id,
        description: a.description || "",
        score: a.score,
        savingsBytes: a.details?.overallSavingsBytes,
        savingsMs: a.details?.overallSavingsMs,
        source: "PSI_LAB",
        ownership: opp.ownership,
        items: a.details?.items?.map((it: any) => ({
          url: it.url,
          totalBytes: it.totalBytes,
          wastedBytes: it.wastedBytes,
          wastedMs: it.wastedMs,
          nodeSnippet: it.node?.snippet,
        })),
      });
    }
  }

  // 8. Diagnostics
  const diagnostics: PerformanceDiagnosticItem[] = [];
  const diagAudits = ["dom-size", "critical-request-chains", "user-timings", "bootup-time", "mainthread-work-breakdown", "font-display"];
  for (const dId of diagAudits) {
    const a = audits[dId];
    if (a) {
      diagnostics.push({
        id: dId,
        title: a.title || dId,
        description: a.description || "",
        displayValue: a.displayValue,
        source: "PSI_LAB",
      });
    }
  }

  // 9. Resource Network Summary
  const resources: ResourcePerformanceFact[] = [];
  const netAudit = audits["network-requests"];
  if (netAudit?.details?.items) {
    for (const item of netAudit.details.items) {
      resources.push({
        url: item.url,
        type: item.resourceType?.toLowerCase() || "other",
        transferBytes: item.transferSize || 0,
        resourceBytes: item.resourceSize || 0,
        isRenderBlocking: item.priority === "VeryHigh" || item.priority === "High",
        isThirdParty: item.url.startsWith("http") && !item.url.includes("example.com"),
        cacheControl: item.responseHeaders?.find((h: any) => h.name?.toLowerCase() === "cache-control")?.value,
      });
    }
  }

  // 10. Third-Party Summary
  const thirdParties: ThirdPartyImpactGroup[] = [];
  const tpAudit = audits["third-party-summary"];
  if (tpAudit?.details?.items) {
    for (const item of tpAudit.details.items) {
      thirdParties.push({
        entityName: item.entity?.text || item.entity?.name || "Third-Party",
        category: item.entity?.category || "other",
        domain: item.url || "external",
        transferBytes: item.transferSize || 0,
        mainThreadBlockingTimeMs: item.blockingTime || 0,
        resourceCount: item.subItems?.items?.length || 1,
      });
    }
  }

  return {
    strategy,
    performanceScore,
    lab,
    field,
    lcpDiagnosis,
    clsDiagnosis,
    inpDiagnosis,
    opportunities,
    diagnostics,
    resources,
    thirdParties,
    fetchedAt: lighthouse?.fetchTime || new Date().toISOString(),
  };
}
