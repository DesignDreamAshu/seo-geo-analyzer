/**
 * Competitor Referring-Domain Gap & Link Intersect Engine.
 * Reuses Phase 13 competitor identities to identify genuine editorial link prospects
 * without promoting blind link-copying or spam directory prospecting.
 */

import {
  ReferringDomainAggregate,
  LinkProspectReview,
  SourcePlatformType,
  SourceRelevanceState,
} from "./types";
import { SearchCompetitorSummary, CompetitorRelationship } from "../competitor-serp/types";
import { DEFAULT_BACKLINK_POLICY, BacklinkIntelligencePolicy } from "./config";

export interface CompetitorReferringDomainDataset {
  competitorDomain: string;
  summary?: SearchCompetitorSummary;
  referringDomains: ReferringDomainAggregate[];
}

export interface CompetitorLinkGapAnalysisResult {
  totalCompetitorsAnalyzed: number;
  includedRelationshipTypes: CompetitorRelationship[];
  ownOnlyReferringDomainsCount: number;
  sharedReferringDomainsCount: number;
  competitorOnlyReferringDomainsCount: number;
  linkProspectReviews: LinkProspectReview[];
}

export function analyzeCompetitorLinkGaps(
  ownReferringDomains: ReferringDomainAggregate[],
  competitorDatasets: CompetitorReferringDomainDataset[],
  policy: BacklinkIntelligencePolicy = DEFAULT_BACKLINK_POLICY
): CompetitorLinkGapAnalysisResult {
  const ownDomainMap = new Map(ownReferringDomains.map((d) => [d.rootDomain, d]));
  const totalCompetitors = competitorDatasets.length;
  const relationshipTypesSet = new Set<CompetitorRelationship>();

  if (totalCompetitors === 0) {
    return {
      totalCompetitorsAnalyzed: 0,
      includedRelationshipTypes: [],
      ownOnlyReferringDomainsCount: ownReferringDomains.length,
      sharedReferringDomainsCount: 0,
      competitorOnlyReferringDomainsCount: 0,
      linkProspectReviews: [],
    };
  }

  // Aggregate competitor linking domains
  interface CompetitorDomainOccurrence {
    domain: string;
    rootDomain: string;
    sourcePlatformType: SourcePlatformType;
    sourceRelevance: SourceRelevanceState;
    linkedCompetitors: Array<{
      domain: string;
      relationship: CompetitorRelationship;
      observedBacklinkCount: number;
    }>;
  }

  const compDomainMap = new Map<string, CompetitorDomainOccurrence>();

  for (const cData of competitorDatasets) {
    const compRel = cData.summary?.relationship || "CONFIGURED_BUSINESS_COMPETITOR";
    relationshipTypesSet.add(compRel);

    for (const refDom of cData.referringDomains) {
      const key = refDom.rootDomain;
      let entry = compDomainMap.get(key);

      if (!entry) {
        entry = {
          domain: refDom.domain,
          rootDomain: refDom.rootDomain,
          sourcePlatformType: refDom.sourcePlatformType,
          sourceRelevance: refDom.relevanceState,
          linkedCompetitors: [],
        };
        compDomainMap.set(key, entry);
      }

      entry.linkedCompetitors.push({
        domain: cData.competitorDomain,
        relationship: compRel,
        observedBacklinkCount: refDom.observedBacklinkCount,
      });
    }
  }

  let ownOnlyCount = 0;
  let sharedCount = 0;
  let compOnlyCount = 0;

  for (const ownDom of ownReferringDomains) {
    if (compDomainMap.has(ownDom.rootDomain)) {
      sharedCount++;
    } else {
      ownOnlyCount++;
    }
  }

  const linkProspectReviews: LinkProspectReview[] = [];

  for (const [key, compEntry] of compDomainMap.entries()) {
    const hasOwnLink = ownDomainMap.has(key);
    if (!hasOwnLink) {
      compOnlyCount++;

      // Prospect Safety Guard:
      // Must be relevant (EDITORIAL_PUBLICATION or COMPANY_BLOG), cannot be DIRECTORY, FORUM, SOCIAL, or UNRELATED
      const isEligiblePlatform =
        compEntry.sourcePlatformType === "EDITORIAL_PUBLICATION" ||
        compEntry.sourcePlatformType === "COMPANY_BLOG" ||
        compEntry.sourcePlatformType === "DOCUMENTATION" ||
        compEntry.sourcePlatformType === "EDUCATIONAL";

      const isTopicallyRelevant =
        compEntry.sourceRelevance === "HIGHLY_RELEVANT_SOURCE" || compEntry.sourceRelevance === "RELATED_SOURCE";

      const competitorCount = compEntry.linkedCompetitors.length;
      const meetsIntersection = competitorCount >= Math.min(policy.minCompetitorSourcesForProspect, totalCompetitors);

      if (isEligiblePlatform && isTopicallyRelevant && meetsIntersection) {
        let confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" = "MEDIUM_CONFIDENCE";
        if (competitorCount >= 3 && compEntry.sourceRelevance === "HIGHLY_RELEVANT_SOURCE") {
          confidence = "HIGH_CONFIDENCE";
        } else if (competitorCount < 2) {
          confidence = "LOW_CONFIDENCE";
        }

        linkProspectReviews.push({
          referringDomain: compEntry.domain,
          rootDomain: compEntry.rootDomain,
          sourcePlatformType: compEntry.sourcePlatformType,
          sourceRelevance: compEntry.sourceRelevance,
          linkedCompetitors: compEntry.linkedCompetitors,
          linkedCompetitorCount: competitorCount,
          totalCompetitorsEvaluated: totalCompetitors,
          competitorPrevalenceFraction: `${competitorCount} of ${totalCompetitors}`,
          observedLinkToOwnProject: false,
          confidence,
          advisoryOutreachGuidance: `Relevant publication [${compEntry.rootDomain}] links to ${competitorCount} of ${totalCompetitors} analyzed competitors (${compEntry.linkedCompetitors.map((c) => c.domain).join(", ")}). Review whether the project has a legitimate editorial contribution, unique research report, or resource opportunity. (Advisory only; no guarantee of link acquisition).`,
        });
      }
    }
  }

  // Sort prospects by competitor count descending
  linkProspectReviews.sort((a, b) => b.linkedCompetitorCount - a.linkedCompetitorCount);

  return {
    totalCompetitorsAnalyzed: totalCompetitors,
    includedRelationshipTypes: Array.from(relationshipTypesSet),
    ownOnlyReferringDomainsCount: ownOnlyCount,
    sharedReferringDomainsCount: sharedCount,
    competitorOnlyReferringDomainsCount: compOnlyCount,
    linkProspectReviews,
  };
}
