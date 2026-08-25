/**
 * Hardened SERP Feature Opportunities Engine.
 * Evaluates advisory content & format opportunities (PAA, Snippet, Local, Video, Image)
 * with strict feature provenance.
 */

import { SerpSnapshot, SerpFeatureOpportunity } from "./types";

export function evaluateSerpFeatureOpportunities(
  snapshot: SerpSnapshot,
  representativeLabel: string,
  ownPosition?: number
): SerpFeatureOpportunity[] {
  const opportunities: SerpFeatureOpportunity[] = [];

  for (const feat of snapshot.serpFeatures) {
    switch (feat.featureType) {
      case "PEOPLE_ALSO_ASK":
        if (feat.questions && feat.questions.length > 0) {
          opportunities.push({
            featureType: "PEOPLE_ALSO_ASK",
            queryClusterId: snapshot.clusterId,
            representativeLabel,
            opportunityName: "PAA_CONTENT_OPPORTUNITY",
            confidence: "HIGH_CONFIDENCE",
            advisoryNote: `Observed ${feat.questions.length} real Google PAA questions in SERP. Consider answering: ${feat.questions.slice(0, 3).map((q) => `"${q}"`).join(", ")}.`,
            provenance: {
              sourceSnapshotId: snapshot.snapshotId,
              sourceFeatureType: "PEOPLE_ALSO_ASK",
              providerSuppliedQuestions: feat.questions,
            },
          });
        }
        break;

      case "FEATURED_SNIPPET":
        opportunities.push({
          featureType: "FEATURED_SNIPPET",
          queryClusterId: snapshot.clusterId,
          representativeLabel,
          owningDomain: feat.owningDomain,
          ownPosition,
          opportunityName: "ANSWER_FORMAT_OPPORTUNITY",
          confidence: "MEDIUM_CONFIDENCE",
          advisoryNote: `SERP features a direct answer box owned by [${feat.owningDomain || "competitor"}]. Structure target answer concisely (40-60 words) under clear H2 heading. (Advisory only; no guarantee of snippet acquisition).`,
          provenance: {
            sourceSnapshotId: snapshot.snapshotId,
            sourceFeatureType: "FEATURED_SNIPPET",
          },
        });
        break;

      case "LOCAL_PACK":
        opportunities.push({
          featureType: "LOCAL_PACK",
          queryClusterId: snapshot.clusterId,
          representativeLabel,
          opportunityName: "LOCAL_SEARCH_REVIEW",
          confidence: "HIGH_CONFIDENCE",
          advisoryNote: `Local Pack observed in SERP. Ensure Google Business Profile and local entity signals are verified for location context '${snapshot.location || snapshot.country}'.`,
          provenance: {
            sourceSnapshotId: snapshot.snapshotId,
            sourceFeatureType: "LOCAL_PACK",
          },
        });
        break;

      case "VIDEO_PACK":
        opportunities.push({
          featureType: "VIDEO_PACK",
          queryClusterId: snapshot.clusterId,
          representativeLabel,
          opportunityName: "VIDEO_CONTENT_OPPORTUNITY",
          confidence: "MEDIUM_CONFIDENCE",
          advisoryNote: `Video carousel featured in top SERP results. Consider augmenting written guides with structured video walk-throughs.`,
          provenance: {
            sourceSnapshotId: snapshot.snapshotId,
            sourceFeatureType: "VIDEO_PACK",
          },
        });
        break;

      case "IMAGE_PACK":
        opportunities.push({
          featureType: "IMAGE_PACK",
          queryClusterId: snapshot.clusterId,
          representativeLabel,
          opportunityName: "IMAGE_SERP_OPPORTUNITY",
          confidence: "LOW_CONFIDENCE",
          advisoryNote: `Image pack observed in SERP. Ensure high-quality diagrams with descriptive ALT text and ImageObject schema are included.`,
          provenance: {
            sourceSnapshotId: snapshot.snapshotId,
            sourceFeatureType: "IMAGE_PACK",
          },
        });
        break;
    }
  }

  return opportunities;
}
