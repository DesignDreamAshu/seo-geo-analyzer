/**
 * Backlink Target Health & Redirect Equivalence Safety Engine.
 * Cross-references external backlink targets against deterministic technical crawl facts.
 * Enforces strict equivalence confidence (HIGH, MEDIUM, LOW, NO_EQUIVALENT, MANUAL_REVIEW)
 * to prevent indiscriminate soft-404 redirects to the homepage.
 */

import {
  BacklinkRecord,
  BrokenBacklinkTargetOpportunity,
  RedirectTargetBacklinkReview,
  CanonicalTargetBacklinkReview,
  RedirectEquivalenceConfidence,
} from "./types";

export interface CrawlTargetMetadata {
  statusCode: number;
  isCanonicalMatch?: boolean;
  declaredCanonical?: string;
  redirectChain?: string[];
  finalDestinationUrl?: string;
  equivalentResourceCandidate?: string;
  candidateEquivalenceType?: "EXACT_REPLACEMENT" | "TOPICAL_SUBSTITUTE" | "HOMEPAGE_FALLBACK" | "AMBIGUOUS_MULTIPLE";
}

export function evaluateBacklinkTargetHealth(
  backlinks: BacklinkRecord[],
  crawlMetadataMap: Map<string, CrawlTargetMetadata>
): {
  brokenTargets: BrokenBacklinkTargetOpportunity[];
  redirectTargetReviews: RedirectTargetBacklinkReview[];
  canonicalTargetReviews: CanonicalTargetBacklinkReview[];
} {
  // Group backlinks by normalized target URL
  const targetMap = new Map<string, BacklinkRecord[]>();
  for (const bl of backlinks) {
    const list = targetMap.get(bl.targetNormalizedUrl) || [];
    list.push(bl);
    targetMap.set(bl.targetNormalizedUrl, list);
  }

  const brokenTargets: BrokenBacklinkTargetOpportunity[] = [];
  const redirectTargetReviews: RedirectTargetBacklinkReview[] = [];
  const canonicalTargetReviews: CanonicalTargetBacklinkReview[] = [];

  for (const [targetUrl, blList] of targetMap.entries()) {
    const meta = crawlMetadataMap.get(targetUrl);
    if (!meta) continue;

    const referringDomains = new Set(blList.map((b) => b.sourceRegistrableDomain));
    const relevantSources = blList.filter(
      (b) => b.relevanceState === "HIGHLY_RELEVANT_SOURCE" || b.relevanceState === "RELATED_SOURCE"
    ).length;

    // 1. Broken Backlink Targets (404 / 410)
    if (meta.statusCode === 404 || meta.statusCode === 410) {
      let equivalenceConfidence: RedirectEquivalenceConfidence = "NO_EQUIVALENT_TARGET";
      let recommendedAction = `Review restoring original content on [${targetUrl}] or finding a topical equivalent.`;
      let requiresOutreach = referringDomains.size >= 5;

      if (meta.equivalentResourceCandidate) {
        if (meta.candidateEquivalenceType === "HOMEPAGE_FALLBACK" || meta.equivalentResourceCandidate.endsWith(".io/") || meta.equivalentResourceCandidate.endsWith(".com/")) {
          equivalenceConfidence = "LOW_EQUIVALENCE";
          recommendedAction = `Inbound target [${targetUrl}] has no specific equivalent page. Do NOT automatically redirect service/article targets to homepage (risks soft-404). Review restoring page content.`;
        } else if (meta.candidateEquivalenceType === "AMBIGUOUS_MULTIPLE") {
          equivalenceConfidence = "MANUAL_REVIEW";
          recommendedAction = `Multiple potential replacement candidates exist for [${targetUrl}]. Perform manual content review before selecting 301 target.`;
        } else if (meta.candidateEquivalenceType === "TOPICAL_SUBSTITUTE") {
          equivalenceConfidence = "MEDIUM_EQUIVALENCE";
          recommendedAction = `Topical substitute [${meta.equivalentResourceCandidate}] identified. Review 301 redirect or content update.`;
        } else {
          equivalenceConfidence = "HIGH_EQUIVALENCE";
          recommendedAction = `Review 301 permanent redirect from [${targetUrl}] to verified equivalent current resource [${meta.equivalentResourceCandidate}].`;
        }
      }

      brokenTargets.push({
        targetUrl,
        statusCode: meta.statusCode,
        observedBacklinkCount: blList.length,
        observedReferringDomainCount: referringDomains.size,
        relevantSourceCount: relevantSources,
        sampleReferringDomains: Array.from(referringDomains).slice(0, 5),
        existingEquivalentUrlCandidate: meta.equivalentResourceCandidate,
        redirectEquivalenceConfidence: equivalenceConfidence,
        recommendedAction,
        requiresOutreach,
      });
    }

    // 2. Redirect Chain Targets
    if (meta.redirectChain && meta.redirectChain.length >= 2) {
      redirectTargetReviews.push({
        targetUrl,
        redirectChain: meta.redirectChain,
        finalDestinationUrl: meta.finalDestinationUrl || targetUrl,
        observedBacklinkCount: blList.length,
        observedReferringDomainCount: referringDomains.size,
        reviewNote: `External links target an origin with a multi-hop redirect chain (${meta.redirectChain.length} hops -> [${meta.finalDestinationUrl}]). Consider updating inbound outreach where possible.`,
      });
    }

    // 3. Canonicalized-Away Targets
    if (meta.declaredCanonical && meta.isCanonicalMatch === false && meta.declaredCanonical !== targetUrl) {
      canonicalTargetReviews.push({
        targetUrl,
        declaredCanonicalUrl: meta.declaredCanonical,
        observedBacklinkCount: blList.length,
        observedReferringDomainCount: referringDomains.size,
        reviewNote: `External backlinks target [${targetUrl}], which canonicalizes to [${meta.declaredCanonical}]. Contextual observation; not automatically wasted link equity.`,
      });
    }
  }

  // Sort broken targets by referring domain count descending
  brokenTargets.sort((a, b) => b.observedReferringDomainCount - a.observedReferringDomainCount);

  return {
    brokenTargets,
    redirectTargetReviews,
    canonicalTargetReviews,
  };
}
