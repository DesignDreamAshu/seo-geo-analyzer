/**
 * Hardened Action Prioritization & Implementation-Shape Effort Estimation Engine.
 * Evaluates priority across technical severity, GSC search exposure, systemic leverage,
 * page importance, and data quality without mutating underlying technical severity.
 */

import {
  ActionPriority,
  ImplementationEffort,
  TimelineBucket,
  GscSearchExposure,
  OpportunityType,
  PageImportanceStatus,
  ActionOwner,
} from "./types";
import { DEFAULT_OPPORTUNITY_CONFIG, OpportunityConfig } from "./config";

export interface PriorityEvaluationInputs {
  technicalSeverity: "critical" | "high" | "medium" | "low" | "info";
  ruleCode?: string;
  isNewRegression: boolean;
  isReopened: boolean;
  isSystemic: boolean;
  affectedUrlsCount: number;
  estimatedRealEdits: number;
  gscExposure?: GscSearchExposure;
  opportunityType: OpportunityType;
  platform?: string;
  isManualReview?: boolean;
  isWatchlistedPage?: boolean;
  implementationShape?: "SHARED_TEMPLATE" | "CMS_FIELD_BATCH" | "PAGE_SPECIFIC" | "CODE_ARCHITECTURE_REFACTOR";
  config?: OpportunityConfig;
}

export function evaluateActionPriority(inputs: PriorityEvaluationInputs): {
  actionPriority: ActionPriority;
  whyThisPriority: string[];
  effort: ImplementationEffort;
  effortRationale: string;
  timelineBucket: TimelineBucket;
  pageImportanceStatus: PageImportanceStatus;
  primaryOwner: ActionOwner;
  secondaryOwners: ActionOwner[];
  owners: ActionOwner[];
  ownerRoutingConfidence: "CONFIRMED_OWNER" | "PRIMARY_AND_SECONDARY" | "INFERRED_DEFAULT";
} {
  const cfg = inputs.config || DEFAULT_OPPORTUNITY_CONFIG;
  const why: string[] = [];
  let priority: ActionPriority = "MEDIUM";
  let effort: ImplementationEffort = "MEDIUM";
  let effortRationale = "Standard implementation scope.";

  const impressions = inputs.gscExposure?.totalImpressions || 0;
  const isHighDemand = impressions >= cfg.thresholds.highSearchDemandImpressions;
  const isModerateDemand = impressions >= cfg.thresholds.moderateSearchDemandImpressions;
  const isWatchlisted = Boolean(inputs.isWatchlistedPage);

  const pageImportanceStatus: PageImportanceStatus = isWatchlisted
    ? "PAGE_IMPORTANCE_CONFIGURED"
    : "PAGE_IMPORTANCE_NOT_CONFIGURED";

  // 1. Implementation-Shape-Based Effort Model
  if (inputs.implementationShape === "CODE_ARCHITECTURE_REFACTOR") {
    effort = "HIGH";
    effortRationale = "Application-level routing, server header, or build pipeline refactor required.";
  } else if (inputs.implementationShape === "CMS_FIELD_BATCH" || (inputs.affectedUrlsCount > 15 && !inputs.isSystemic)) {
    effort = "MEDIUM";
    effortRationale = `Batch adjustment across ${inputs.affectedUrlsCount} CMS items (~${inputs.estimatedRealEdits} edits).`;
  } else if (inputs.isSystemic && inputs.estimatedRealEdits <= 1) {
    effort = "LOW";
    effortRationale = "Single shared CMS template or component edit resolves all affected pages.";
  } else if (inputs.affectedUrlsCount === 1 && inputs.estimatedRealEdits === 1) {
    effort = "TRIVIAL";
    effortRationale = "Single page-specific setting or tag adjustment.";
  } else {
    effort = "MEDIUM";
    effortRationale = `Standard remediation across ${inputs.affectedUrlsCount} pages (~${inputs.estimatedRealEdits} edits).`;
  }

  // 2. Strict Priority Tier Safety (CRITICAL vs HIGH vs MEDIUM)
  const isExistentialBlocker =
    inputs.technicalSeverity === "critical" ||
    inputs.opportunityType === "INDEXABILITY_FIX" ||
    (inputs.ruleCode && (
      inputs.ruleCode.includes("NOINDEX") ||
      inputs.ruleCode.includes("STATUS_4XX") ||
      inputs.ruleCode.includes("ROBOTS_DISALLOWED") ||
      inputs.ruleCode.includes("CANONICAL_CONFLICT")
    ));

  if (inputs.isManualReview) {
    priority = "REVIEW";
    why.push("Requires manual human evaluation or business intent confirmation before technical action.");
  } else if (isExistentialBlocker && (isWatchlisted || isHighDemand || inputs.isNewRegression || inputs.technicalSeverity === "critical")) {
    // CRITICAL strictly reserved for existential indexability/search access barriers
    priority = "CRITICAL";
    why.push("Critical search access or indexability barrier preventing search indexing.");
    if (isWatchlisted) {
      why.push("High-priority watchlisted page affected (Page importance configured).");
    }
  } else if (
    inputs.technicalSeverity === "high" ||
    isHighDemand ||
    (inputs.isSystemic && inputs.affectedUrlsCount >= 5) ||
    inputs.isNewRegression ||
    inputs.opportunityType === "DECLINING_PAGE_RECOVERY" ||
    isWatchlisted
  ) {
    priority = "HIGH";
    if (inputs.technicalSeverity === "high" && (!inputs.gscExposure || inputs.gscExposure.dataQuality === "NOT_AVAILABLE")) {
      why.push("High technical SEO severity finding (Retains HIGH priority even without GSC search data).");
    } else if (inputs.technicalSeverity === "high") {
      why.push("High technical SEO severity defect.");
    }
    if (inputs.isNewRegression) {
      why.push("Newly introduced regression observed in latest verified crawl.");
    }
    if (inputs.isSystemic) {
      why.push(`Systemic template issue affecting ${inputs.affectedUrlsCount} pages (~${inputs.estimatedRealEdits} real edit).`);
    }
    if (isHighDemand) {
      why.push(`High search visibility: Pages receive ${impressions.toLocaleString()} evaluated GSC impressions.`);
    }
    if (isWatchlisted) {
      why.push("Configured high-importance watchlisted page.");
    }
    if (inputs.opportunityType === "DECLINING_PAGE_RECOVERY") {
      why.push("Temporally correlated with active search performance decline.");
    }
  } else if (
    inputs.technicalSeverity === "medium" ||
    isModerateDemand ||
    inputs.opportunityType === "CTR_OPPORTUNITY" ||
    inputs.opportunityType === "POSITION_OPPORTUNITY"
  ) {
    priority = "MEDIUM";
    why.push("Moderate technical severity or growth opportunity with search demand.");
    if (inputs.opportunityType === "CTR_OPPORTUNITY") {
      why.push("Underperforming click-through rate relative to average ranking position.");
    }
  } else {
    priority = "LOW";
    why.push("Low technical impact on pages with low or unconfigured search demand.");
  }

  // 3. Timeline Bucket
  let timelineBucket: TimelineBucket = "LATER_OPTIMIZE";
  if (priority === "CRITICAL" || (priority === "HIGH" && effort === "LOW")) {
    timelineBucket = "DO_NOW";
  } else if (priority === "HIGH" || (priority === "MEDIUM" && (effort === "TRIVIAL" || effort === "LOW"))) {
    timelineBucket = "DO_NEXT";
  } else {
    timelineBucket = "LATER_OPTIMIZE";
  }

  // 4. Specialist Owner Routing & Confidence
  const { primaryOwner, secondaryOwners, owners, ownerRoutingConfidence } = routeActionOwners(
    inputs.ruleCode || "",
    inputs.opportunityType,
    inputs.platform
  );

  return {
    actionPriority: priority,
    whyThisPriority: why,
    effort,
    effortRationale,
    timelineBucket,
    pageImportanceStatus,
    primaryOwner,
    secondaryOwners,
    owners,
    ownerRoutingConfidence,
  };
}

function routeActionOwners(
  ruleCode: string,
  opportunityType: string,
  platform?: string
): {
  primaryOwner: ActionOwner;
  secondaryOwners: ActionOwner[];
  owners: ActionOwner[];
  ownerRoutingConfidence: "CONFIRMED_OWNER" | "PRIMARY_AND_SECONDARY" | "INFERRED_DEFAULT";
} {
  if (opportunityType === "MANUAL_REVIEW") {
    return {
      primaryOwner: "Manual Review",
      secondaryOwners: ["SEO"],
      owners: ["Manual Review", "SEO"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    };
  }

  if (opportunityType === "CTR_OPPORTUNITY" || opportunityType === "POSITION_OPPORTUNITY") {
    return {
      primaryOwner: "SEO",
      secondaryOwners: ["Content"],
      owners: ["SEO", "Content"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    };
  }

  if (opportunityType === "CONTENT_REFRESH_OPPORTUNITY" || opportunityType === "CONTENT_STRUCTURE_OPPORTUNITY") {
    return {
      primaryOwner: "Content",
      secondaryOwners: ["SEO"],
      owners: ["Content", "SEO"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    };
  }

  if (opportunityType === "INTERNAL_LINKING_OPPORTUNITY") {
    return {
      primaryOwner: "SEO",
      secondaryOwners: ["Content"],
      owners: ["SEO", "Content"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    };
  }

  if (ruleCode.startsWith("PERF_") || ruleCode.startsWith("CODE_") || ruleCode.startsWith("SECURITY_")) {
    return {
      primaryOwner: "Developer",
      secondaryOwners: [],
      owners: ["Developer"],
      ownerRoutingConfidence: "CONFIRMED_OWNER",
    };
  }

  if (ruleCode.startsWith("SOCIAL_") || ruleCode.startsWith("IMAGE_") || ruleCode.startsWith("CONTENT_")) {
    if (platform === "webflow") {
      return {
        primaryOwner: "CMS Editor",
        secondaryOwners: ["SEO"],
        owners: ["CMS Editor", "SEO"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
      };
    }
    return {
      primaryOwner: "Developer",
      secondaryOwners: ["SEO"],
      owners: ["Developer", "SEO"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
    };
  }

  return {
    primaryOwner: "SEO",
    secondaryOwners: [],
    owners: ["SEO"],
    ownerRoutingConfidence: "INFERRED_DEFAULT",
  };
}
