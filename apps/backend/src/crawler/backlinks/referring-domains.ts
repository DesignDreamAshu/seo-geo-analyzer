/**
 * Referring Domain Aggregation & Structural Sitewide Detection Engine.
 * Consolidates multiple backlink records into distinct referring domain entities.
 * Invariant: Evaluates structural evidence (target repetition, anchor repetition, template paths)
 * rather than raw counts alone to distinguish sitewide template footers from genuine natural multi-links.
 */

import {
  BacklinkRecord,
  ReferringDomainAggregate,
  BacklinkProviderType,
  AnchorClassification,
  LinkAttribute,
  SitewideRepetitionClassification,
} from "./types";
import { DEFAULT_BACKLINK_POLICY, BacklinkIntelligencePolicy } from "./config";

export function aggregateReferringDomains(
  backlinks: BacklinkRecord[],
  provider: BacklinkProviderType,
  snapshotId: string,
  policy: BacklinkIntelligencePolicy = DEFAULT_BACKLINK_POLICY
): ReferringDomainAggregate[] {
  const domainMap = new Map<string, {
    rootDomain: string;
    backlinks: BacklinkRecord[];
    targetUrls: Set<string>;
    anchors: Set<string>;
    anchorCounts: Record<AnchorClassification, number>;
    attributeCounts: Record<LinkAttribute, number>;
    firstSeen?: string;
    lastSeen?: string;
    platformType: BacklinkRecord["sourcePlatformType"];
    relevance: BacklinkRecord["relevanceState"];
    providerMetrics?: BacklinkRecord["providerMetrics"];
  }>();

  for (const bl of backlinks) {
    const key = bl.sourceRegistrableDomain;
    let entry = domainMap.get(key);

    if (!entry) {
      entry = {
        rootDomain: bl.sourceRegistrableDomain,
        backlinks: [],
        targetUrls: new Set<string>(),
        anchors: new Set<string>(),
        anchorCounts: {
          BRANDED: 0,
          NAKED_URL: 0,
          GENERIC: 0,
          PARTIAL_MATCH: 0,
          EXACT_MATCH_CANDIDATE: 0,
          IMAGE_NO_TEXT: 0,
          UNKNOWN: 0,
        },
        attributeCounts: {
          FOLLOW: 0,
          NOFOLLOW: 0,
          SPONSORED: 0,
          UGC: 0,
          UNKNOWN: 0,
        },
        platformType: bl.sourcePlatformType,
        relevance: bl.relevanceState,
        providerMetrics: bl.providerMetrics,
      };
      domainMap.set(key, entry);
    }

    entry.backlinks.push(bl);
    entry.targetUrls.add(bl.targetNormalizedUrl);
    if (bl.anchorText) entry.anchors.add(bl.anchorText.trim().toLowerCase());

    entry.anchorCounts[bl.anchorClassification] = (entry.anchorCounts[bl.anchorClassification] || 0) + 1;

    for (const attr of bl.linkAttributes) {
      entry.attributeCounts[attr] = (entry.attributeCounts[attr] || 0) + 1;
    }

    if (bl.firstSeenDate) {
      if (!entry.firstSeen || bl.firstSeenDate < entry.firstSeen) {
        entry.firstSeen = bl.firstSeenDate;
      }
    }
    if (bl.lastSeenDate) {
      if (!entry.lastSeen || bl.lastSeenDate > entry.lastSeen) {
        entry.lastSeen = bl.lastSeenDate;
      }
    }
    if (bl.providerMetrics && !entry.providerMetrics) {
      entry.providerMetrics = bl.providerMetrics;
    }
  }

  const aggregates: ReferringDomainAggregate[] = [];

  for (const [domainKey, data] of domainMap.entries()) {
    const count = data.backlinks.length;
    let sitewideClassification: SitewideRepetitionClassification = "NOT_SITEWIDE";

    if (count >= policy.sitewideRepetitionThreshold) {
      // Structural analysis:
      // High count with exactly 1 or 2 targets and 1 or 2 anchors indicates template repetition (e.g. footer)
      const targetRepetitionRatio = count / Math.max(1, data.targetUrls.size);
      const anchorRepetitionRatio = count / Math.max(1, data.anchors.size);

      if (targetRepetitionRatio >= 10 && anchorRepetitionRatio >= 10) {
        sitewideClassification = "SITEWIDE_TEMPLATE_DOMINANT";
      } else if (targetRepetitionRatio >= 5) {
        sitewideClassification = "POSSIBLE_SITEWIDE_REPETITION";
      } else {
        sitewideClassification = "NOT_SITEWIDE"; // Varied independent editorial pages
      }
    }

    aggregates.push({
      domain: domainKey,
      rootDomain: data.rootDomain,
      observedBacklinkCount: count,
      uniqueTargetUrlCount: data.targetUrls.size,
      targetUrls: Array.from(data.targetUrls),
      sampleAnchors: Array.from(data.anchors).slice(0, 5),
      anchorDistribution: data.anchorCounts,
      attributeDistribution: data.attributeCounts,
      sourcePlatformType: data.platformType,
      relevanceState: data.relevance,
      sitewideClassification,
      firstSeenDate: data.firstSeen,
      lastSeenDate: data.lastSeen,
      providerMetrics: data.providerMetrics,
      provenance: {
        provider,
        snapshotId,
      },
    });
  }

  // Sort by observed backlink count descending
  return aggregates.sort((a, b) => b.observedBacklinkCount - a.observedBacklinkCount);
}
