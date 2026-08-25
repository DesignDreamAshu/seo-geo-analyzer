/**
 * Typed Contracts for Dream SEO Fix Intelligence Layer.
 * Defines comprehensive, actionable remediation blueprints for diagnostic issues.
 */

import type { DiagnosticIssue, CrawledPageData } from "../types";

export type FixPriority = "critical" | "high" | "medium" | "low" | "informational";
export type FixConfidence = "confirmed" | "high_confidence" | "heuristic" | "manual_review" | "inconclusive";
export type FixEffort = "quick" | "small" | "medium" | "large";
export type FixSafety = "SAFE" | "REVIEW_REQUIRED" | "HIGH_RISK";
export type FixClassification = "QUICK_WIN" | "HIGH_IMPACT" | "SYSTEMIC_FIX" | "PAGE_SPECIFIC" | "MANUAL_REVIEW";
export type FixLocationCertainty = "CONFIRMED_FIX_LOCATION" | "LIKELY_FIX_LOCATION" | "GENERIC_WEBFLOW_GUIDANCE" | "GENERIC_GUIDANCE";
export type FixSubCategory = "CORE_SEO" | "TECHNICAL_QUALITY" | "SECURITY_LITE" | "ACCESSIBILITY_LITE" | "INDEXABILITY_CRITICAL";
export type FixScopeType =
  | "page"
  | "template"
  | "global_component"
  | "cms_content"
  | "site_configuration"
  | "server_configuration"
  | "external"
  | "manual_review";

export type SupportedPlatform = "generic_html" | "webflow" | "wordpress" | "nextjs" | "shopify" | "unknown";

export interface FixStep {
  stepNumber: number;
  action: string;
  location: string;
  details?: string;
  codeSnippet?: string;
}

export interface PlatformSpecificGuidance {
  platform: SupportedPlatform;
  locationDescription: string;
  locationCertainty: FixLocationCertainty;
  steps: string[];
  tips?: string[];
}

export interface SeoFixIntelligence {
  id: string; // Stable finding identifier for progress tracking
  ruleCode: string;
  category: string;
  subCategory: FixSubCategory;
  title: string;
  summary: string;

  priority: FixPriority;
  confidence: FixConfidence;
  safety: FixSafety;
  effort: FixEffort;
  classification: FixClassification;
  fixLeverageScore: number; // Quantitative remediation leverage
  rankingRationale?: string;

  affectedUrl?: string;
  affectedCount: number;

  problem: {
    observed: string;
    expected?: string;
    explanation: string;
  };

  evidence: {
    source: string;
    details: Record<string, unknown>;
  };

  whyItMatters: string;

  fix: {
    objective: string;
    steps: FixStep[];
    recommendedChange?: string;
    exampleBefore?: string;
    exampleAfter?: string;
    platformGuidance?: PlatformSpecificGuidance;
  };

  cautions: string[];

  verification: {
    method: string;
    expectedOutcome: string;
    ruleShouldDisappear: boolean;
  };

  fixScope: {
    type: FixScopeType;
    confidence: number;
    reason: string;
    targetComponentOrTemplate?: string;
  };

  dependsOn?: string[];
  relatedIssues?: string[];
  canAutoFix: boolean;
}

export interface FixGroup {
  groupId: string;
  ruleCode: string;
  title: string;
  scope: "template" | "global_component" | "cms_content" | "site_configuration" | "page_specific" | "unknown";
  affectedUrls: string[];
  affectedCount: number;
  confidence: number;
  locationCertainty: FixLocationCertainty;
  likelySharedCause: string;
  recommendedFixLocation: string;
  estimatedFixesRequired: number;
  leverageScore: number;
  primaryFixIntelligence: SeoFixIntelligence;
}

export interface RootCauseGroup {
  rootCauseId: string;
  rootCauseTitle: string;
  description: string;
  primaryRuleCode: string;
  relatedRuleCodes: string[];
  affectedUrls: string[];
  recommendedAction: string;
  potentialFindingsResolved: number;
}

export interface AuditFixIntelligenceResult {
  runId: string;
  generatedAt: string;
  targetSite: string;
  detectedPlatform: SupportedPlatform;
  platformConfidence: number;

  totalFindings: number;
  totalUniquePagesAffected: number;

  fixIntelligenceList: SeoFixIntelligence[];
  systemicFixGroups: FixGroup[];
  rootCauseGroups: RootCauseGroup[];

  summary: {
    quickWinsCount: number;
    systemicFixesCount: number;
    globalComponentFixesCount: number;
    cmsContentFixesCount: number;
    pageSpecificFixesCount: number;
    manualReviewsCount: number;
    highRiskFixesCount: number;
    totalIssueOccurrences: number;
    totalGroupedOccurrences: number;
    totalUngroupedOccurrences: number;
    estimatedIndividualChangesRequired: number;
    potentialFindingsResolved: number; // strictly deduplicated
  };

  prioritizedFixQueue: SeoFixIntelligence[];
}
