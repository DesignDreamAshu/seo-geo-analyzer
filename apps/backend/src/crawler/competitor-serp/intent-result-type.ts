/**
 * Hardened SERP Result-Type & Intent Analysis Engine.
 * Classifies ranking page formats, evaluates dominant intent states with sample-size awareness,
 * and derives INTENT_ALIGNMENT_REVIEW conservatively.
 */

import {
  ResultType,
  OrganicSerpResult,
  SerpIntentDistribution,
  ResultTypeDistribution,
  DominantSerpIntentState,
} from "./types";
import { QueryIntent } from "../content-demand/types";

export function classifyResultType(
  url: string,
  title: string,
  snippet: string
): { resultType: ResultType; confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" } {
  const normUrl = url.toLowerCase();
  const normTitle = title.toLowerCase();

  let path = "";
  try {
    path = new URL(normUrl.startsWith("http") ? normUrl : `https://${normUrl}`).pathname;
  } catch {
    path = normUrl;
  }

  // 1. Homepage Check
  if (path === "/" || path === "" || path === "/index.html") {
    return { resultType: "HOMEPAGE", confidence: "HIGH_CONFIDENCE" };
  }

  // 2. Video Check
  if (normUrl.includes("youtube.com") || normUrl.includes("vimeo.com") || path.includes("/video/") || path.includes("/watch")) {
    return { resultType: "VIDEO", confidence: "HIGH_CONFIDENCE" };
  }

  // 3. Forum / Community Check
  if (
    normUrl.includes("reddit.com") ||
    normUrl.includes("quora.com") ||
    normUrl.includes("stackoverflow.com") ||
    normUrl.includes("community.") ||
    path.includes("/forum") ||
    path.includes("/discussion")
  ) {
    return { resultType: "FORUM_COMMUNITY", confidence: "HIGH_CONFIDENCE" };
  }

  // 4. Documentation Check
  if (
    normUrl.includes("docs.") ||
    path.includes("/docs") ||
    path.includes("/documentation") ||
    path.includes("/api-reference") ||
    path.includes("/developer")
  ) {
    return { resultType: "DOCUMENTATION", confidence: "HIGH_CONFIDENCE" };
  }

  // 5. Comparison Check
  if (
    path.includes("/vs/") ||
    path.includes("-vs-") ||
    path.includes("/alternatives") ||
    path.includes("/compare") ||
    normTitle.includes(" vs ") ||
    normTitle.includes(" alternatives")
  ) {
    return { resultType: "COMPARISON_PAGE", confidence: "HIGH_CONFIDENCE" };
  }

  // 6. Case Study Check
  if (path.includes("/case-stud") || path.includes("/customer-stori") || path.includes("/success-stori")) {
    return { resultType: "CASE_STUDY", confidence: "HIGH_CONFIDENCE" };
  }

  // 7. Local Listing Check
  if (path.includes("/location") || path.includes("/branches") || path.includes("/offices/")) {
    return { resultType: "LOCAL_LISTING", confidence: "HIGH_CONFIDENCE" };
  }

  // 8. Product Page Check
  if (path.includes("/product/") || path.includes("/item/") || path.includes("/pricing")) {
    return { resultType: "PRODUCT_PAGE", confidence: "HIGH_CONFIDENCE" };
  }

  // 9. Service Check
  if (
    path.includes("/services/") ||
    path.includes("/service/") ||
    path.includes("/solutions/") ||
    normTitle.includes("consulting") ||
    normTitle.includes("services") ||
    normTitle.includes("assessment")
  ) {
    return { resultType: "SERVICE_PAGE", confidence: "HIGH_CONFIDENCE" };
  }

  // 10. Category Hub Check
  if (
    path.includes("/category/") ||
    path.endsWith("/blog") ||
    path.endsWith("/blog/") ||
    path.endsWith("/guides") ||
    path.endsWith("/services")
  ) {
    return { resultType: "CATEGORY_PAGE", confidence: "HIGH_CONFIDENCE" };
  }

  // 11. Article / Guide Check
  if (
    path.includes("/blog/") ||
    path.includes("/guide/") ||
    path.includes("/articles/") ||
    path.includes("/news/") ||
    path.includes("/insights/") ||
    normTitle.includes("guide") ||
    normTitle.includes("tutorial") ||
    normTitle.includes("how to")
  ) {
    return { resultType: "ARTICLE_GUIDE", confidence: "HIGH_CONFIDENCE" };
  }

  return { resultType: "UNKNOWN", confidence: "LOW_CONFIDENCE" };
}

export function analyzeSerpIntentDistribution(
  organicResults: OrganicSerpResult[],
  phase12PredictedIntent?: QueryIntent,
  dominanceThreshold: number = 0.6
): SerpIntentDistribution {
  const sample = organicResults.slice(0, 10);
  const sampleSize = sample.length;

  if (sampleSize < 3) {
    return {
      dominantIntentState: "INSUFFICIENT_DATA",
      dominantIntent: "UNKNOWN",
      intentBreakdown: {},
      sampleSize,
      dominanceRatio: 0,
      confidence: "LOW_CONFIDENCE",
    };
  }

  const intentCounts: Record<string, number> = {
    INFORMATIONAL: 0,
    COMMERCIAL_INVESTIGATION: 0,
    TRANSACTIONAL: 0,
    LOCAL: 0,
    COMPARISON: 0,
    NAVIGATIONAL: 0,
  };

  for (const r of sample) {
    switch (r.resultType) {
      case "ARTICLE_GUIDE":
      case "CATEGORY_PAGE":
      case "VIDEO":
      case "DOCUMENTATION":
      case "FORUM_COMMUNITY":
        intentCounts.INFORMATIONAL = (intentCounts.INFORMATIONAL || 0) + 1;
        break;
      case "SERVICE_PAGE":
      case "CASE_STUDY":
        intentCounts.COMMERCIAL_INVESTIGATION = (intentCounts.COMMERCIAL_INVESTIGATION || 0) + 1;
        break;
      case "PRODUCT_PAGE":
        intentCounts.TRANSACTIONAL = (intentCounts.TRANSACTIONAL || 0) + 1;
        break;
      case "COMPARISON_PAGE":
        intentCounts.COMPARISON = (intentCounts.COMPARISON || 0) + 1;
        break;
      case "LOCAL_LISTING":
        intentCounts.LOCAL = (intentCounts.LOCAL || 0) + 1;
        break;
      case "HOMEPAGE":
        intentCounts.NAVIGATIONAL = (intentCounts.NAVIGATIONAL || 0) + 1;
        break;
      default:
        intentCounts.INFORMATIONAL = (intentCounts.INFORMATIONAL || 0) + 1;
        break;
    }
  }

  // Find max intent
  let dominantIntent: QueryIntent = "INFORMATIONAL";
  let maxCount = 0;
  for (const [intent, count] of Object.entries(intentCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantIntent = intent as QueryIntent;
    }
  }

  const dominanceRatio = Math.round((maxCount / sampleSize) * 100) / 100;
  let dominantIntentState: DominantSerpIntentState;
  let confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" = "MEDIUM_CONFIDENCE";

  if ((dominanceRatio >= dominanceThreshold && sampleSize >= 5) || (dominanceRatio >= 0.75 && sampleSize >= 3)) {
    confidence = "HIGH_CONFIDENCE";
    if (dominantIntent === "INFORMATIONAL") dominantIntentState = "INFORMATIONAL_DOMINANT";
    else if (dominantIntent === "COMMERCIAL_INVESTIGATION" || dominantIntent === "TRANSACTIONAL") dominantIntentState = "COMMERCIAL_DOMINANT";
    else if (dominantIntent === "LOCAL") dominantIntentState = "LOCAL_DOMINANT";
    else dominantIntentState = "INFORMATIONAL_DOMINANT";
  } else if (dominanceRatio < 0.4) {
    dominantIntentState = "MIXED";
    dominantIntent = "MIXED";
    confidence = "MEDIUM_CONFIDENCE";
  } else {
    dominantIntentState = "MIXED";
    confidence = "LOW_CONFIDENCE";
  }

  let intentDisagreementWithPhase12: SerpIntentDistribution["intentDisagreementWithPhase12"];

  if (
    phase12PredictedIntent &&
    phase12PredictedIntent !== "MIXED" &&
    phase12PredictedIntent !== dominantIntent &&
    confidence === "HIGH_CONFIDENCE" &&
    dominantIntentState !== "MIXED"
  ) {
    intentDisagreementWithPhase12 = {
      phase12PredictedIntent,
      observedSerpDominantIntent: dominantIntent,
      finding: "INTENT_ALIGNMENT_REVIEW",
      rationale: `First-party query predicted '${phase12PredictedIntent}', but current observed top-${sampleSize} SERP is predominantly '${dominantIntent}' (${Math.round(dominanceRatio * 100)}% of results). Review content format alignment.`,
    };
  }

  return {
    dominantIntentState,
    dominantIntent,
    intentBreakdown: intentCounts,
    sampleSize,
    dominanceRatio,
    confidence,
    intentDisagreementWithPhase12,
  };
}

export function analyzeResultTypeDistribution(
  organicResults: OrganicSerpResult[],
  ownPageType?: ResultType
): ResultTypeDistribution {
  const typeCounts: Record<ResultType, number> = {
    HOMEPAGE: 0,
    SERVICE_PAGE: 0,
    PRODUCT_PAGE: 0,
    CATEGORY_PAGE: 0,
    ARTICLE_GUIDE: 0,
    COMPARISON_PAGE: 0,
    CASE_STUDY: 0,
    DOCUMENTATION: 0,
    FORUM_COMMUNITY: 0,
    VIDEO: 0,
    LOCAL_LISTING: 0,
    UNKNOWN: 0,
  };

  const topSample = organicResults.slice(0, 10);
  for (const r of topSample) {
    typeCounts[r.resultType] = (typeCounts[r.resultType] || 0) + 1;
  }

  let dominantType: ResultType = "UNKNOWN";
  let maxCount = 0;
  for (const [t, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantType = t as ResultType;
    }
  }

  let formatMismatchCandidate: ResultTypeDistribution["formatMismatchCandidate"];

  if (ownPageType && ownPageType !== "UNKNOWN" && dominantType !== "UNKNOWN" && ownPageType !== dominantType && maxCount >= 5) {
    formatMismatchCandidate = {
      ownPageType,
      dominantSerpType: dominantType,
      finding: "OWN_PAGE_FORMAT_MISMATCH_CANDIDATE",
      rationale: `Own landing page is a '${ownPageType}', whereas ${maxCount} of ${topSample.length} top ranking competitors are dedicated '${dominantType}' assets. Review whether creating/improving a dedicated format aligns better with search expectations.`,
    };
  }

  return {
    typeCounts,
    dominantType,
    sampleSize: topSample.length,
    formatMismatchCandidate,
  };
}
