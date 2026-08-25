/**
 * Team Work Queue Router.
 * Assigns actions to appropriate specialist queues (Developer, SEO, Content, CMS Editor, Manual Review).
 */

import { ActionOwner, SeoActionItem, TeamWorkQueue } from "./types";

export function buildTeamWorkQueues(actions: SeoActionItem[]): Record<ActionOwner, TeamWorkQueue> {
  const owners: ActionOwner[] = [
    "Developer",
    "SEO",
    "Content",
    "CMS Editor",
    "Designer",
    "Analytics",
    "Client",
    "Manual Review",
  ];

  const queues: Record<ActionOwner, TeamWorkQueue> = Object.fromEntries(
    owners.map((owner) => [
      owner,
      {
        owner,
        actionCount: 0,
        criticalCount: 0,
        highCount: 0,
        actions: [],
      },
    ])
  ) as Record<ActionOwner, TeamWorkQueue>;

  for (const action of actions) {
    for (const owner of action.owners) {
      if (queues[owner]) {
        queues[owner].actions.push(action);
        queues[owner].actionCount++;
        if (action.actionPriority === "CRITICAL") queues[owner].criticalCount++;
        if (action.actionPriority === "HIGH") queues[owner].highCount++;
      }
    }
  }

  return queues;
}

export function inferActionOwners(
  ruleCode: string,
  opportunityType: string,
  platform?: string
): ActionOwner[] {
  if (opportunityType === "MANUAL_REVIEW") {
    return ["Manual Review", "SEO"];
  }

  if (opportunityType === "CTR_OPPORTUNITY" || opportunityType === "POSITION_OPPORTUNITY") {
    return ["SEO", "Content"];
  }

  if (opportunityType === "CONTENT_REFRESH_OPPORTUNITY" || opportunityType === "CONTENT_STRUCTURE_OPPORTUNITY") {
    return ["Content", "SEO"];
  }

  if (opportunityType === "INTERNAL_LINKING_OPPORTUNITY") {
    return ["SEO", "Content"];
  }

  if (ruleCode.startsWith("PERF_") || ruleCode.startsWith("CODE_") || ruleCode.startsWith("SECURITY_")) {
    return ["Developer"];
  }

  if (ruleCode.startsWith("SOCIAL_") || ruleCode.startsWith("IMAGE_") || ruleCode.startsWith("CONTENT_")) {
    if (platform === "webflow") {
      return ["CMS Editor", "SEO"];
    }
    return ["Developer", "SEO"];
  }

  if (ruleCode.startsWith("INDEXABILITY_") || ruleCode.startsWith("CANONICAL_") || ruleCode.startsWith("REDIRECT_")) {
    return ["Developer", "SEO"];
  }

  return ["SEO"];
}
