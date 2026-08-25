/**
 * Phase 11 Canonical Action Decision Bridge for Content Lifecycle.
 * Enriches canonical Phase 11 Action Items with lifecycle intelligence while preserving Phase 11 priority authority.
 */

import { SeoActionItem } from "../opportunity/types";
import { ContentLifecycleAssessment } from "./types";

export function enrichPhase11ActionsWithLifecycle(
  actions: SeoActionItem[],
  assessments: ContentLifecycleAssessment[]
): SeoActionItem[] {
  const assessmentMap = new Map<string, ContentLifecycleAssessment>();
  for (const a of assessments) {
    assessmentMap.set(a.url.trim().toLowerCase(), a);
  }

  return actions.map((action) => {
    const primaryUrl = action.representativeUrls?.[0] || action.affectedUrls?.[0];
    if (!primaryUrl) return action;

    const matched = assessmentMap.get(primaryUrl.trim().toLowerCase());
    if (!matched) return action;

    const whyList = [...(action.whyThisPriority || [])];
    whyList.push(`Content Lifecycle State: ${matched.lifecycleState} (Trend: ${matched.trendShape})`);

    return {
      ...action,
      whyThisPriority: whyList,
      // Retain Phase 11 priority, primaryOwner, and timelineBucket
    };
  });
}
