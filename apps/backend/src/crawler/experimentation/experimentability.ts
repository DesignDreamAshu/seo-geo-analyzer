/**
 * Phase 22: Experimentability, Adherence & Required Correctness Exclusion Engine.
 */

import {
  ExperimentType,
  ExperimentabilityStatus,
  TreatmentIsolationLevel,
  ExperimentRiskLevel,
  ExperimentBlocker,
  TreatmentDefinition,
  TreatmentAdherenceStatus,
  SerpExposureStatus,
} from "./types";

export interface ProposedChangeInput {
  actionId?: string;
  actionTitle?: string;
  changeType: string;
  targetUrls: string[];
  isDeterministicBugFix?: boolean; // e.g. broken canonical, 404 link, noindex error, robots block
  deterministicBugType?: string;
  simultaneousModifications?: string[];
  adherenceStatus?: TreatmentAdherenceStatus;
  serpExposureStatus?: SerpExposureStatus;
  isGoogleTitleOrSnippetRewritten?: boolean;
  reversibility?: "INSTANTLY_REVERSIBLE" | "REVERSIBLE_WITH_DELAY" | "DIFFICULT_TO_REVERT" | "IRREVERSIBLE";
  isMissionCriticalCohort?: boolean;
  totalMonthlyImpressions?: number;
  totalMonthlyClicks?: number;
}

export interface ExperimentabilityAssessment {
  experimentability: ExperimentabilityStatus;
  suggestedExperimentType: ExperimentType;
  isolationLevel: TreatmentIsolationLevel;
  riskLevel: ExperimentRiskLevel;
  isSuitableForControlCohort: boolean;
  blockers: ExperimentBlocker[];
  reasons: string[];
  treatmentDefinition: TreatmentDefinition;
}

export function evaluateExperimentability(input: ProposedChangeInput): ExperimentabilityAssessment {
  const reasons: string[] = [];
  const blockers: ExperimentBlocker[] = [];

  // Safeguard 1: Do NOT experiment with required correctness
  const requiredFixKeywords = [
    "noindex",
    "robots.txt",
    "canonical",
    "404",
    "broken link",
    "syntax error",
    "ssl",
    "security",
    "redirect loop",
    "500 error",
    "server error",
    "hreflang broken",
    "structured data syntax error",
    "invalid schema syntax",
  ];

  const lowerTitle = (input.actionTitle || "").toLowerCase();
  const lowerType = input.changeType.toLowerCase();

  const isDeterministicDefect =
    input.isDeterministicBugFix ||
    requiredFixKeywords.some((kw) => lowerTitle.includes(kw) || lowerType.includes(kw));

  if (isDeterministicDefect) {
    return {
      experimentability: "NOT_SUITABLE_FOR_EXPERIMENT_REQUIRED_FIX",
      suggestedExperimentType: "CUSTOM_SEO_TEST",
      isolationLevel: "ISOLATED_TREATMENT",
      riskLevel: "NOT_APPROPRIATE",
      isSuitableForControlCohort: false,
      blockers: ["REQUIRED_FIX_EXCLUSION"],
      reasons: [
        `Change addresses a deterministic correctness or compliance defect (${input.deterministicBugType || input.actionTitle || input.changeType}). Deterministic defects must be fixed directly and must never be preserved in control groups for experimentation.`,
      ],
      treatmentDefinition: {
        treatmentName: input.actionTitle || "Deterministic Bug Fix",
        affectedElements: [input.changeType],
        description: "Direct remediation fix required by Phase 11 authority.",
        isolationLevel: "ISOLATED_TREATMENT",
        adherenceStatus: input.adherenceStatus || "TREATMENT_APPLIED",
        serpExposureStatus: input.serpExposureStatus || "DEPLOYED_TREATMENT",
        reversibility: "REVERSIBLE_WITH_DELAY",
      },
    };
  }

  // Determine suggested experiment type
  let expType: ExperimentType = "CUSTOM_SEO_TEST";
  if (lowerType.includes("title") || lowerTitle.includes("title")) {
    expType = "TITLE_TEST";
  } else if (lowerType.includes("meta_description") || lowerTitle.includes("meta description")) {
    expType = "META_DESCRIPTION_TEST";
  } else if (lowerType.includes("refresh") || lowerTitle.includes("refresh")) {
    expType = "CONTENT_REFRESH_TEST";
  } else if (lowerType.includes("expand") || lowerType.includes("expansion") || lowerTitle.includes("expansion") || lowerTitle.includes("subtopic")) {
    expType = "CONTENT_EXPANSION_TEST";
  } else if (lowerType.includes("internal_link") || lowerTitle.includes("internal link")) {
    expType = "INTERNAL_LINKING_TEST";
  } else if (lowerType.includes("schema") || lowerType.includes("structured_data") || lowerTitle.includes("schema")) {
    expType = "STRUCTURED_DATA_TEST";
  } else if (lowerType.includes("template") || lowerTitle.includes("template")) {
    expType = "TEMPLATE_CHANGE_TEST";
  } else if (lowerType.includes("consolidation") || lowerTitle.includes("consolidat")) {
    expType = "CONSOLIDATION_TEST";
  } else if (lowerType.includes("ux") || lowerTitle.includes("ux")) {
    expType = "UX_CONTENT_TEST";
  }

  // Treatment Adherence & SERP Exposure
  const adherenceStatus: TreatmentAdherenceStatus = input.adherenceStatus || "TREATMENT_APPLIED";
  if (adherenceStatus === "TREATMENT_NOT_APPLIED") {
    blockers.push("TREATMENT_NOT_APPLIED");
    reasons.push("Treatment has not been deployed to production URLs.");
  }

  let serpExposureStatus: SerpExposureStatus = input.serpExposureStatus || "DEPLOYED_TREATMENT";
  if (input.isGoogleTitleOrSnippetRewritten) {
    serpExposureStatus = "TREATMENT_EXPOSURE_UNCERTAIN";
    reasons.push("Google is actively rewriting deployed title/snippet on SERPs, introducing exposure uncertainty.");
  }

  // Treatment Isolation
  const simultaneousChanges = input.simultaneousModifications || [];
  let isolationLevel: TreatmentIsolationLevel = "ISOLATED_TREATMENT";
  if (simultaneousChanges.length > 2) {
    isolationLevel = "CONFOUNDED_TREATMENT";
    reasons.push(`Multiple simultaneous changes detected (${simultaneousChanges.join(", ")}), reducing attribution isolation.`);
  } else if (simultaneousChanges.length > 0) {
    isolationLevel = "MULTI_CHANGE_TREATMENT";
    reasons.push(`Secondary changes (${simultaneousChanges.join(", ")}) modify elements alongside primary treatment.`);
  }

  // Risk & Reversibility
  let riskLevel: ExperimentRiskLevel = "LOW_RISK";
  if (expType === "CONSOLIDATION_TEST" || input.reversibility === "IRREVERSIBLE") {
    riskLevel = "HIGH_RISK";
    reasons.push("URL consolidation or irreversible redirects represent high risk and are poorly suited for classic control testing.");
  } else if (input.isMissionCriticalCohort) {
    riskLevel = "HIGH_RISK";
    reasons.push("Cohort contains mission-critical pages. Aggressive experimentation not recommended without holdouts.");
  } else if (isolationLevel === "CONFOUNDED_TREATMENT") {
    riskLevel = "MODERATE_RISK";
  }

  // Experimentability scoring
  let experimentability: ExperimentabilityStatus = "HIGH_EXPERIMENTABILITY";
  const urlCount = input.targetUrls.length;

  if (expType === "CONSOLIDATION_TEST") {
    experimentability = "LOW_EXPERIMENTABILITY";
  } else if (urlCount === 0) {
    experimentability = "NOT_SUITABLE_FOR_EXPERIMENT";
    blockers.push("INSUFFICIENT_BASELINE");
    reasons.push("No target URLs provided for experiment cohort.");
  } else if (input.totalMonthlyClicks !== undefined && urlCount < 3 && input.totalMonthlyClicks < 50) {
    experimentability = "LOW_EXPERIMENTABILITY";
    blockers.push("TRAFFIC_TOO_LOW");
    reasons.push(`Target cohort size (${urlCount} URLs) and traffic are too low for reliable statistical comparison.`);
  } else if (isolationLevel === "CONFOUNDED_TREATMENT") {
    experimentability = "MODERATE_EXPERIMENTABILITY";
  } else if (expType === "TITLE_TEST" || expType === "META_DESCRIPTION_TEST") {
    experimentability = "HIGH_EXPERIMENTABILITY";
    reasons.push("Title and snippet tag treatments are highly isolated, instantly reversible, and well-suited for cohort testing.");
  } else {
    experimentability = "MODERATE_EXPERIMENTABILITY";
  }

  return {
    experimentability,
    suggestedExperimentType: expType,
    isolationLevel,
    riskLevel,
    isSuitableForControlCohort: true,
    blockers,
    reasons,
    treatmentDefinition: {
      treatmentName: input.actionTitle || `${expType} Intervention`,
      affectedElements: [expType, ...simultaneousChanges],
      description: `Structured SEO treatment for ${expType}`,
      isolationLevel,
      simultaneousChangesDetected: simultaneousChanges,
      adherenceStatus,
      serpExposureStatus,
      reversibility: input.reversibility || "INSTANTLY_REVERSIBLE",
    },
  };
}
