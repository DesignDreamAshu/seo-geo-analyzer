/**
 * Local Competitor & Review Gap Integrator.
 * Reuses Phase 13 competitor models to evaluate local review volume gaps without ranking causality assertions.
 */

import { SearchCompetitorSummary } from "../competitor-serp/types";
import { BusinessProfileDataset } from "./types";
import { DEFAULT_LOCAL_SEO_POLICY, LocalSeoPolicy } from "./config";

export interface ReviewGapAnalysisResult {
  projectReviewCount: number;
  competitorMedianReviewCount: number;
  sampleCompetitorCount: number;
  gapFinding?: {
    finding: "LOCAL_REVIEW_VOLUME_GAP_OBSERVED";
    rationale: string;
  };
}

export function evaluateLocalReviewGap(
  projectProfile?: BusinessProfileDataset,
  competitorProfiles: BusinessProfileDataset[] = [],
  policy: LocalSeoPolicy = DEFAULT_LOCAL_SEO_POLICY
): ReviewGapAnalysisResult {
  const projectCount = projectProfile?.reviewCount || 0;
  const compCounts = competitorProfiles.map((c) => c.reviewCount || 0).filter((c) => c > 0).sort((a, b) => a - b);

  if (compCounts.length === 0) {
    return {
      projectReviewCount: projectCount,
      competitorMedianReviewCount: 0,
      sampleCompetitorCount: 0,
    };
  }

  const mid = Math.floor(compCounts.length / 2);
  const median = compCounts.length % 2 !== 0 ? compCounts[mid] : Math.round((compCounts[mid - 1] + compCounts[mid]) / 2);

  let gapFinding: ReviewGapAnalysisResult["gapFinding"];
  if (compCounts.length >= policy.reviewGapSampleSize && median >= projectCount * 2 && median >= 50) {
    gapFinding = {
      finding: "LOCAL_REVIEW_VOLUME_GAP_OBSERVED",
      rationale: `Configured provider observed ${projectCount} customer reviews for project vs competitor median of ${median} reviews across ${compCounts.length} local competitors. Review implementing a compliant customer feedback acquisition process. (Advisory observation; no ranking causality or penalty implied).`,
    };
  }

  return {
    projectReviewCount: projectCount,
    competitorMedianReviewCount: median,
    sampleCompetitorCount: compCounts.length,
    gapFinding,
  };
}
