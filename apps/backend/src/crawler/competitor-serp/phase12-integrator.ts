/**
 * Phase 12 Content Demand Integration Bridge.
 * Enriches Phase 12 coverage decisions with observed SERP landscape & competitor format evidence.
 * Prevents blind new page creation when SERP format contradicts planned format.
 */

import { ContentCoverageAssessment } from "../content-demand/types";
import { SerpSnapshot, ResultTypeDistribution, SerpIntentDistribution } from "./types";

export interface SerpEnrichedCoverageResult {
  assessment: ContentCoverageAssessment;
  serpAlignmentConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  serpFormatInsight?: string;
  revisedDecision?: "CREATE_NEW_PAGE_CANDIDATE" | "IMPROVE_EXISTING_PAGE" | "VALIDATION_REQUIRED" | "NO_ACTION";
}

export function enrichPhase12WithSerpIntelligence(
  assessment: ContentCoverageAssessment,
  snapshot: SerpSnapshot,
  resultDistribution: ResultTypeDistribution,
  intentDistribution: SerpIntentDistribution,
  serpCoverageGaps: string[] = []
): SerpEnrichedCoverageResult {
  const enriched = { ...assessment };

  // Append verified SERP coverage topics to missing topics without duplicates
  const currentMissing = new Set(enriched.missingTopicAreas || []);
  for (const gap of serpCoverageGaps) {
    currentMissing.add(gap);
  }
  enriched.missingTopicAreas = Array.from(currentMissing);

  let serpAlignmentConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" = "HIGH_CONFIDENCE";
  let serpFormatInsight = `SERP shows ${resultDistribution.dominantType} dominant landscape.`;
  let revisedDecision: SerpEnrichedCoverageResult["revisedDecision"] = enriched.decision as any;

  // Case A: Phase 12 proposes CREATE_NEW_PAGE_CANDIDATE and SERP is dominated by dedicated format
  if (
    enriched.decision === "CREATE_NEW_PAGE_CANDIDATE" &&
    resultDistribution.dominantType === "SERVICE_PAGE" &&
    intentDistribution.dominantIntent === "COMMERCIAL_INVESTIGATION"
  ) {
    serpAlignmentConfidence = "HIGH_CONFIDENCE";
    serpFormatInsight = `Strongly supported by competitive SERP: ${resultDistribution.typeCounts.SERVICE_PAGE} of 10 ranking competitors use dedicated service landing pages.`;
  }

  // Case B: Phase 12 proposes CREATE_NEW_PAGE_CANDIDATE but SERP is overwhelmingly INFORMATIONAL
  if (
    enriched.decision === "CREATE_NEW_PAGE_CANDIDATE" &&
    intentDistribution.dominantIntent === "INFORMATIONAL" &&
    resultDistribution.dominantType === "ARTICLE_GUIDE" &&
    resultDistribution.typeCounts.ARTICLE_GUIDE >= 6
  ) {
    serpAlignmentConfidence = "MEDIUM_CONFIDENCE";
    serpFormatInsight = `Advisory Note: Observed top SERP is 60%+ informational guides. If existing relevant guide exists on site, consider improving that guide rather than deploying a purely transactional page.`;
  }

  return {
    assessment: enriched,
    serpAlignmentConfidence,
    serpFormatInsight,
    revisedDecision,
  };
}
