/**
 * Phase Integration Bridges for Local SEO & Location Intelligence.
 * Connects location findings to Phase 8 GSC performance, Phase 10 Monitoring,
 * and Phase 11 Canonical Actions (deduplicated).
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import { BusinessLocation, LocationPageQualityReview, BusinessProfileDataset, LocalBusinessApplicability } from "./types";

export function bridgeLocalOpportunitiesToPhase11(
  projectId: string,
  locations: BusinessLocation[],
  locationPages: LocationPageQualityReview[],
  profileAlignments: Array<{
    locationId: string;
    websiteUrlAlignment: string;
    categoryAlignment: string;
  }>,
  existingActions: SeoActionItem[] = []
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set(existingActions.map((a) => a.actionId));

  // 1. Location Page Quality / Noindex / Orphan actions
  for (const page of locationPages) {
    if (!page.isIndexable) {
      const actionId = buildStableActionId("LOCATION_PAGE_NOINDEX", page.url, "404");
      if (!existingActionIds.has(actionId)) {
        actions.push({
          actionId,
          projectId,
          type: "TECHNICAL_FIX",
          nature: "DETERMINISTIC_FIX",
          title: `Location Page Indexability: Ensure location page [${page.url}] is indexable and accessible`,
          description: `Location detail page for local branch is currently non-indexable or returning an error status.`,
          underlyingRuleCodes: ["INDEXABILITY_NOINDEX"],
          monitoringSignals: [],
          sourceSignals: ["LOCAL_LOCATION_PAGE_AUDIT"],
          affectedUrls: [page.url],
          representativeUrls: [page.url],
          affectedUrlsCount: 1,
          estimatedRealEdits: 1,
          technicalSeverity: "high",
          actionPriority: "HIGH",
          whyThisPriority: ["Location page represents a key local business point of presence."],
          effort: "LOW",
          effortRationale: "Remove accidental noindex tag or restore HTTP 200 route.",
          primaryOwner: "Developer",
          secondaryOwners: ["SEO"],
          owners: ["Developer", "SEO"],
          ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
          pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
          isQuickWin: true,
          timelineBucket: "DO_NOW",
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "Page template / CMS header settings",
          recommendedAction: `Ensure [${page.url}] returns HTTP 200 with index,follow robots directive.`,
          verificationInstructions: `Verify [${page.url}] is crawlable and indexable.`,
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 15 local audit." }],
        });
      }
    }
  }

  // 2. Business Profile Website Mismatch actions
  for (const pa of profileAlignments) {
    if (pa.websiteUrlAlignment === "BUSINESS_PROFILE_WEBSITE_MISMATCH") {
      const actionId = buildStableActionId("GBP_WEBSITE_MISMATCH", pa.locationId, "url");
      if (!existingActionIds.has(actionId)) {
        actions.push({
          actionId,
          projectId,
          type: "CONTENT_STRUCTURE_OPPORTUNITY",
          nature: "REVIEW_RECOMMENDED",
          title: `Google Business Profile: Align landing page URL for location [${pa.locationId}]`,
          description: `Authorized Google Business Profile lists a website URL that differs from the canonical location page.`,
          underlyingRuleCodes: [],
          monitoringSignals: [],
          sourceSignals: ["LOCAL_BUSINESS_PROFILE_AUDIT"],
          affectedUrls: [],
          representativeUrls: [],
          affectedUrlsCount: 1,
          estimatedRealEdits: 1,
          technicalSeverity: "info",
          actionPriority: "MEDIUM",
          whyThisPriority: ["Directs local searchers to the most relevant branch landing page."],
          effort: "LOW",
          effortRationale: "Update website link inside Google Business Profile dashboard.",
          primaryOwner: "Client",
          secondaryOwners: ["SEO"],
          owners: ["Client", "SEO"],
          ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
          pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
          isQuickWin: true,
          timelineBucket: "DO_NOW",
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "Google Business Profile Dashboard",
          recommendedAction: `Update Google Business Profile website URL to canonical location page.`,
          verificationInstructions: "Verify GBP dashboard reflects verified canonical location URL.",
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 15 GBP audit." }],
        });
      }
    }
  }

  return actions;
}
