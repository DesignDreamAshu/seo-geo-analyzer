/**
 * Phase Integration Bridges for Off-Page & Backlink Intelligence.
 * Connects backlink evidence to Phase 8 GSC performance (correlational only),
 * Phase 12 Content Demand (linkable assets), and Phase 11 Canonical Actions (deduplicated).
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import {
  BrokenBacklinkTargetOpportunity,
  LinkProspectReview,
  LinkableAssetSignal,
  BacklinkRecord,
  ReferringDomainAggregate,
} from "./types";
import { QueryCluster } from "../content-demand/types";

export function bridgeBrokenBacklinksToPhase11(
  projectId: string,
  brokenTargets: BrokenBacklinkTargetOpportunity[],
  existingActions: SeoActionItem[] = []
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set(existingActions.map((a) => a.actionId));

  for (const broken of brokenTargets) {
    const actionId = buildStableActionId("BROKEN_BACKLINK", broken.targetUrl, `${broken.statusCode}`);

    // If an existing action already covers this target URL, enrich or deduplicate
    if (existingActionIds.has(actionId)) {
      continue;
    }

    actions.push({
      actionId,
      projectId,
      type: "TECHNICAL_FIX",
      nature: "DETERMINISTIC_FIX",
      title: `Broken Backlink Target: Restore or redirect [${broken.targetUrl}] (${broken.observedReferringDomainCount} referring domains)`,
      description: `Target URL returns HTTP ${broken.statusCode} but receives ${broken.observedBacklinkCount} external backlink records from ${broken.observedReferringDomainCount} referring domains: ${broken.sampleReferringDomains.slice(0, 3).join(", ")}.`,
      underlyingRuleCodes: ["HTTP_404_NOT_FOUND"],
      monitoringSignals: [],
      sourceSignals: ["OFF_PAGE_BACKLINK_INTELLIGENCE"],
      affectedUrls: [broken.targetUrl],
      representativeUrls: [broken.targetUrl],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "high",
      actionPriority: broken.observedReferringDomainCount >= 5 ? "HIGH" : "MEDIUM",
      whyThisPriority: [
        `Target page receives ${broken.observedReferringDomainCount} external referring domains.`,
        `Preserves existing link equity and resolves user/crawler 404 destination errors.`,
      ],
      effort: "LOW",
      effortRationale: "Configure 301 redirect or restore equivalent resource.",
      primaryOwner: "Developer",
      secondaryOwners: ["SEO"],
      owners: ["Developer", "SEO"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
      pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
      isQuickWin: true,
      quickWinRationale: "Single redirect rule restores external link value immediately.",
      timelineBucket: "DO_NOW",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "Server routing / CMS redirect table",
      recommendedAction: broken.recommendedAction,
      verificationInstructions: `Verify [${broken.targetUrl}] responds with HTTP 301 pointing to valid target or HTTP 200 restored page.`,
      actionStatus: "OPEN",
      statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 14 broken backlink audit." }],
    });
  }

  return actions;
}

export function bridgeLinkProspectsToPhase11(
  projectId: string,
  prospects: LinkProspectReview[],
  existingActions: SeoActionItem[] = []
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set(existingActions.map((a) => a.actionId));

  for (const p of prospects) {
    const actionId = buildStableActionId("LINK_PROSPECT", p.rootDomain, `${p.linkedCompetitorCount}`);

    if (existingActionIds.has(actionId)) {
      continue;
    }

    actions.push({
      actionId,
      projectId,
      type: "CONTENT_STRUCTURE_OPPORTUNITY",
      nature: "REVIEW_RECOMMENDED",
      title: `Link Prospect Review: Editorial opportunity on [${p.rootDomain}] (links to ${p.competitorPrevalenceFraction} competitors)`,
      description: p.advisoryOutreachGuidance,
      underlyingRuleCodes: [],
      monitoringSignals: [],
      sourceSignals: ["OFF_PAGE_LINK_INTERSECT"],
      affectedUrls: [],
      representativeUrls: [],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "info",
      actionPriority: "LOW",
      whyThisPriority: [
        `Domain links to multiple competitors (${p.linkedCompetitorCount} competitors).`,
        `Advisory editorial research candidate.`,
      ],
      effort: "MEDIUM",
      effortRationale: "Requires researching publication editorial guidelines and content pitch.",
      primaryOwner: "Content",
      secondaryOwners: ["SEO"],
      owners: ["Content", "SEO"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
      pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
      isQuickWin: false,
      timelineBucket: "LATER_OPTIMIZE",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "Editorial outreach / Content marketing",
      recommendedAction: p.advisoryOutreachGuidance,
      verificationInstructions: "Validate whether editorial contribution or research asset meets publication guidelines.",
      actionStatus: "OPEN",
      statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 14 link intersect." }],
    });
  }

  return actions;
}

export function identifyLinkableAssets(
  backlinks: BacklinkRecord[],
  referringDomains: ReferringDomainAggregate[],
  queryClusters: QueryCluster[] = []
): LinkableAssetSignal[] {
  const urlBacklinkMap = new Map<string, { backlinks: BacklinkRecord[]; referringDomains: Set<string>; anchors: Set<string> }>();

  for (const bl of backlinks) {
    let entry = urlBacklinkMap.get(bl.targetNormalizedUrl);
    if (!entry) {
      entry = { backlinks: [], referringDomains: new Set<string>(), anchors: new Set<string>() };
      urlBacklinkMap.set(bl.targetNormalizedUrl, entry);
    }
    entry.backlinks.push(bl);
    entry.referringDomains.add(bl.sourceRegistrableDomain);
    if (bl.anchorText) entry.anchors.add(bl.anchorText);
  }

  const signals: LinkableAssetSignal[] = [];

  for (const [url, data] of urlBacklinkMap.entries()) {
    const refCount = data.referringDomains.size;
    if (refCount >= 2 && !url.endsWith(".io") && !url.endsWith(".com") && !url.endsWith("/")) {
      const matchingCluster = queryClusters.find((c) => c.dominantLandingPage === url);

      let assetType: LinkableAssetSignal["assetType"] = "GENERAL_RESOURCE";
      if (url.includes("guide") || url.includes("research") || url.includes("report")) {
        assetType = "GUIDE_RESEARCH";
      } else if (url.includes("tool") || url.includes("calculator")) {
        assetType = "TOOL_CALCULATOR";
      }

      signals.push({
        targetUrl: url,
        observedReferringDomainCount: refCount,
        observedBacklinkCount: data.backlinks.length,
        primaryAnchorThemes: Array.from(data.anchors).slice(0, 3),
        phase12ClusterId: matchingCluster?.clusterId,
        assetType,
        strategicInsight: `Page naturally attracts external links from ${refCount} referring domains. Consider updating statistics, expanding internal linking from this hub, and promoting related subtopics.`,
      });
    }
  }

  return signals.sort((a, b) => b.observedReferringDomainCount - a.observedReferringDomainCount);
}
