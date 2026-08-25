/**
 * Hardened Landing Page Fit & Query-Page Stability Evaluator.
 * Evaluates semantic alignment, intent compatibility, and longitudinal query-to-page stability.
 */

import { LandingPageFit, QueryPageStability, QueryCluster } from "./types";

export interface PageMetadataSummary {
  url: string;
  title?: string;
  h1?: string;
  pageIntent?: string;
  statusCode?: number;
  isNoindex?: boolean;
}

export function evaluateLandingPageFit(
  cluster: QueryCluster,
  pageSummary?: PageMetadataSummary
): {
  fit: LandingPageFit;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  rationale: string;
} {
  if (!cluster.dominantLandingPage || !pageSummary) {
    return {
      fit: "UNKNOWN",
      confidence: "LOW_CONFIDENCE",
      rationale: "No dominant landing page metadata available.",
    };
  }

  const normQuery = cluster.representativeLabel.toLowerCase();
  const title = (pageSummary.title || "").toLowerCase();
  const h1 = (pageSummary.h1 || "").toLowerCase();
  let urlPath = "";
  try {
    urlPath = new URL(cluster.dominantLandingPage).pathname.toLowerCase();
  } catch {
    urlPath = cluster.dominantLandingPage.toLowerCase();
  }

  // 1. Homepage Evaluation
  if (urlPath === "/" || urlPath === "") {
    if (cluster.brandState === "BRANDED") {
      return {
        fit: "STRONG_FIT",
        confidence: "HIGH_CONFIDENCE",
        rationale: "Homepage is the expected strong fit for branded navigational demand.",
      };
    }
    return {
      fit: "WEAK_FIT",
      confidence: "HIGH_CONFIDENCE",
      rationale: `Specific topic demand '${cluster.representativeLabel}' is landing on generic homepage.`,
    };
  }

  // 2. Commercial query landing on purely informational blog post -> MISMATCH
  if (cluster.primaryIntent === "COMMERCIAL_INVESTIGATION" && urlPath.includes("/blog/")) {
    return {
      fit: "MISMATCH",
      confidence: "HIGH_CONFIDENCE",
      rationale: `Commercial query intent landing on informational blog post (${urlPath}).`,
    };
  }

  // 3. Informational query landing on service page -> PARTIAL_FIT (not automatic mismatch)
  if (cluster.primaryIntent === "INFORMATIONAL" && (urlPath.includes("/services/") || urlPath.includes("/service/"))) {
    return {
      fit: "PARTIAL_FIT",
      confidence: "MEDIUM_CONFIDENCE",
      rationale: `Informational query '${cluster.representativeLabel}' landing on commercial service page; page provides relevant context but lacks dedicated guide structure.`,
    };
  }

  // 4. Check Exact / Strong Path & Heading Alignment
  const queryTokens = normQuery.split(" ").filter((w) => w.length > 2);
  const matchedTokensInTitle = queryTokens.filter((t) => title.includes(t));
  const matchedTokensInH1 = queryTokens.filter((t) => h1.includes(t));
  const matchedTokensInPath = queryTokens.filter((t) => urlPath.includes(t));

  const hasStrongMatch =
    matchedTokensInTitle.length / Math.max(queryTokens.length, 1) >= 0.65 ||
    matchedTokensInH1.length / Math.max(queryTokens.length, 1) >= 0.65 ||
    matchedTokensInPath.length / Math.max(queryTokens.length, 1) >= 0.65;

  if (hasStrongMatch) {
    return {
      fit: "STRONG_FIT",
      confidence: "HIGH_CONFIDENCE",
      rationale: `Landing page (${urlPath}) directly targets cluster topics in title/H1/URL.`,
    };
  }

  // 5. Category Parent Page -> PARTIAL_FIT
  const isParentCategory = matchedTokensInPath.length > 0 || matchedTokensInTitle.length > 0;
  if (isParentCategory) {
    return {
      fit: "PARTIAL_FIT",
      confidence: "MEDIUM_CONFIDENCE",
      rationale: `Landing page provides broader parent category coverage, but lacks dedicated focus on '${cluster.representativeLabel}'.`,
    };
  }

  return {
    fit: "WEAK_FIT",
    confidence: "MEDIUM_CONFIDENCE",
    rationale: `Low semantic and structural overlap between '${cluster.representativeLabel}' and page content.`,
  };
}

export function evaluateQueryPageStability(
  cluster: QueryCluster,
  previousPeriodDominantLp?: string,
  minImpressionsThreshold: number = 50,
  isPeriodMismatched: boolean = false
): QueryPageStability {
  if (isPeriodMismatched) {
    return "INCONCLUSIVE";
  }

  if (cluster.totalObservedImpressions < minImpressionsThreshold) {
    return "INSUFFICIENT_DATA";
  }

  if (cluster.landingPages.length <= 1) {
    return "STABLE";
  }

  if (previousPeriodDominantLp && cluster.dominantLandingPage && previousPeriodDominantLp !== cluster.dominantLandingPage) {
    return "SWITCHING";
  }

  if (cluster.landingPages.length >= 2) {
    return "MULTI_PAGE";
  }

  return "STABLE";
}
