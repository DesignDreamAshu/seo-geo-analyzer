/**
 * Phase Integrators & Phase 11 Canonical Opportunity Actions Bridge.
 * Supplies indexation evidence to Phase 11 while respecting Phase 11 action authority and deduplicating actions.
 */

import { SeoActionItem } from "../opportunity/types";
import { IndexationEvidenceRecord } from "./types";

export function generateIndexationActionItems(params: {
  records: IndexationEvidenceRecord[];
  projectId: string;
}): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const seenActionKeys = new Set<string>();

  for (const r of params.records) {
    // 1. Important Page Crawled Currently Not Indexed (Advisory investigation action)
    if (r.isImportant && r.googleDetailedReason === "CRAWLED_CURRENTLY_NOT_INDEXED") {
      const key = `ACT_INDEX_CRAWLED_NOT_INDEXED_${r.normalizedUrl}`;
      if (!seenActionKeys.has(key)) {
        seenActionKeys.add(key);
        actions.push({
          actionId: key,
          projectId: params.projectId,
          type: "INDEXABILITY_FIX",
          title: `Investigate Unindexed Important Page (${r.url})`,
          description: `Google crawled '${r.url}' but chose not to index it ('Crawled - currently not indexed'). Audit content uniqueness, internal linking, and search intent alignment.`,
          nature: "REVIEW_RECOMMENDED",
          underlyingRuleCodes: [],
          monitoringSignals: ["INDEXATION_EVIDENCE"],
          sourceSignals: ["GSC_URL_INSPECTION_API"],
          affectedUrls: [r.url],
          representativeUrls: [r.url],
          affectedUrlsCount: 1,
          estimatedRealEdits: 1,
          technicalSeverity: "high",
          actionPriority: "HIGH",
          whyThisPriority: ["Important page crawled by Google but not indexed"],
          effort: "MEDIUM",
          effortRationale: "Requires content and internal linking review",
          primaryOwner: "Content",
          secondaryOwners: ["SEO"],
          owners: ["Content", "SEO"],
          ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
          pageImportanceStatus: "PAGE_IMPORTANCE_CONFIGURED",
          isWatchlistedPage: r.isImportant,
          isQuickWin: false,
          timelineBucket: "DO_NEXT",
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "Content editor / CMS template",
          recommendedAction: "Review page value and internal prominence",
          verificationInstructions: "Re-inspect URL in Google Search Console after updating",
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
        });
      }
    }

    // 2. Canonical Mismatch on Important Page
    if (r.isImportant && r.canonicalAlignment === "GOOGLE_SELECTED_DIFFERENT_CANONICAL" && r.googleCanonical) {
      const key = `ACT_INDEX_CANONICAL_MISMATCH_${r.normalizedUrl}`;
      if (!seenActionKeys.has(key)) {
        seenActionKeys.add(key);
        actions.push({
          actionId: key,
          projectId: params.projectId,
          type: "TECHNICAL_FIX",
          title: `Review Canonical Selection Mismatch on Important Page (${r.url})`,
          description: `Declared canonical is '${r.declaredCanonical || "none"}' but Google selected '${r.googleCanonical}'. Align internal links and evaluate duplicate relationships.`,
          nature: "DETERMINISTIC_FIX",
          underlyingRuleCodes: [],
          monitoringSignals: ["CANONICAL_MISMATCH"],
          sourceSignals: ["GSC_URL_INSPECTION_API"],
          affectedUrls: [r.url],
          representativeUrls: [r.url],
          affectedUrlsCount: 1,
          estimatedRealEdits: 1,
          technicalSeverity: "high",
          actionPriority: "HIGH",
          whyThisPriority: ["Google selected different canonical for important page"],
          effort: "LOW",
          effortRationale: "Align declared canonical tag or internal links",
          primaryOwner: "SEO",
          secondaryOwners: ["Developer"],
          owners: ["SEO", "Developer"],
          ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
          pageImportanceStatus: "PAGE_IMPORTANCE_CONFIGURED",
          isWatchlistedPage: r.isImportant,
          isQuickWin: true,
          timelineBucket: "DO_NOW",
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "HTML <head> canonical link tag",
          recommendedAction: "Update canonical declaration to match intended canonical target",
          verificationInstructions: "Verify canonical tag in rendered HTML and re-inspect in GSC",
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
        });
      }
    }
  }

  return actions;
}
