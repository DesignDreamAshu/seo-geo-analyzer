/**
 * Anchor Text Intelligence & Classification Engine.
 * Categorizes backlink anchor text conservatively into branded, naked URL, generic,
 * partial-match, exact-match candidate, and image anchors without universal ideal percentage dogma.
 */

import { BacklinkRecord, AnchorClassification } from "./types";
import { DEFAULT_BACKLINK_POLICY, BacklinkIntelligencePolicy } from "./config";

export function classifyAnchorText(
  anchorText: string,
  brandAliases: string[] = []
): AnchorClassification {
  const norm = anchorText.trim().toLowerCase();

  if (!norm || norm === "image" || norm === "img" || norm === "banner") {
    return "IMAGE_NO_TEXT";
  }

  if (
    norm.startsWith("http://") ||
    norm.startsWith("https://") ||
    norm.startsWith("www.") ||
    norm.includes(".com") ||
    norm.includes(".io") ||
    norm.includes(".org")
  ) {
    return "NAKED_URL";
  }

  const genericTokens = new Set([
    "click here",
    "website",
    "link",
    "source",
    "read more",
    "learn more",
    "visit",
    "page",
    "here",
    "this article",
    "official site",
    "home",
  ]);
  if (genericTokens.has(norm)) {
    return "GENERIC";
  }

  // Exact Brand Match (case-insensitive)
  const isExactBrand = brandAliases.some((b) => norm === b.toLowerCase().trim());
  if (isExactBrand) {
    return "BRANDED";
  }

  // Word-boundary brand check (prevents "bot" matching "robot" or "bottom")
  const brandRegexes = brandAliases.map((b) => new RegExp(`\\b${escapeRegExp(b.toLowerCase().trim())}\\b`, "i"));
  const hasBrandWord = brandRegexes.some((re) => re.test(norm));

  if (hasBrandWord) {
    return "PARTIAL_MATCH";
  }

  // Commercial keyword candidates without brand
  const commercialTerms = [
    "consulting",
    "services",
    "agency",
    "software",
    "solutions",
    "guide",
    "pricing",
    "tools",
    "expert",
    "assessment",
    "implementation",
  ];
  const isCommercial = commercialTerms.some((t) => norm.includes(t));
  if (isCommercial) {
    return "EXACT_MATCH_CANDIDATE";
  }

  return "UNKNOWN";
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface AnchorDistributionResult {
  counts: Record<AnchorClassification, number>;
  percentages: Record<AnchorClassification, number>;
  sampleSize: number;
  distributionReview?: {
    finding: "ANCHOR_DISTRIBUTION_REVIEW";
    rationale: string;
  };
}

export function analyzeAnchorDistribution(
  backlinks: BacklinkRecord[],
  policy: BacklinkIntelligencePolicy = DEFAULT_BACKLINK_POLICY
): AnchorDistributionResult {
  const counts: Record<AnchorClassification, number> = {
    BRANDED: 0,
    NAKED_URL: 0,
    GENERIC: 0,
    PARTIAL_MATCH: 0,
    EXACT_MATCH_CANDIDATE: 0,
    IMAGE_NO_TEXT: 0,
    UNKNOWN: 0,
  };

  const sampleSize = backlinks.length;

  for (const bl of backlinks) {
    counts[bl.anchorClassification] = (counts[bl.anchorClassification] || 0) + 1;
  }

  const percentages: Record<AnchorClassification, number> = {
    BRANDED: 0,
    NAKED_URL: 0,
    GENERIC: 0,
    PARTIAL_MATCH: 0,
    EXACT_MATCH_CANDIDATE: 0,
    IMAGE_NO_TEXT: 0,
    UNKNOWN: 0,
  };

  if (sampleSize > 0) {
    for (const [key, count] of Object.entries(counts)) {
      percentages[key as AnchorClassification] = Math.round((count / sampleSize) * 1000) / 10;
    }
  }

  let distributionReview: AnchorDistributionResult["distributionReview"];

  // Exact-match review candidate requires sufficient sample size AND high prevalence
  const exactMatchRatio = sampleSize > 0 ? counts.EXACT_MATCH_CANDIDATE / sampleSize : 0;
  if (sampleSize >= policy.minSampleSizeForAnchorReview && exactMatchRatio >= policy.exactMatchReviewThresholdRatio) {
    distributionReview = {
      finding: "ANCHOR_DISTRIBUTION_REVIEW",
      rationale: `Exact-match commercial anchor text represents ${percentages.EXACT_MATCH_CANDIDATE}% (${counts.EXACT_MATCH_CANDIDATE} of ${sampleSize} backlink records). Review acquisition sources for over-optimized anchor patterns. (Descriptive observation; no universal penalty threshold).`,
    };
  }

  return {
    counts,
    percentages,
    sampleSize,
    distributionReview,
  };
}
