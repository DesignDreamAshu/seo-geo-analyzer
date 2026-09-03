/**
 * Security Posture Scoring & View-Model Contracts (SECURITY S5).
 * Defines deterministic, transparent scoring models, category health, and frontend view-model structures.
 */

import type { SecurityFinding, SecurityCoverageRecord, SecurityRuleCategory, SecurityExecutionStatus } from "../rule-types";
import type { SecurityRemediation, SecurityImplementationMap } from "../remediation/remediation-types";
import type { ThirdPartyOriginFact, FormSecurityFact, CookieSecurityFact, ResourceSecurityFact } from "../types";

export type SecurityPosture = "Excellent" | "Strong" | "Moderate" | "Weak" | "High Risk";

export type SecurityCategoryPosture =
  | SecurityPosture
  | "Manual Assessment"
  | "Not Applicable"
  | "Not Observable"
  | "No Findings";

export interface SecurityScoreDeduction {
  ruleId: string;
  findingId: string;
  category: SecurityRuleCategory;
  title: string;
  severity: string;
  confidence: string;
  baseWeight: number;
  confidenceModifier: number;
  exposureModifier: number;
  finalDeduction: number;
  reason: string;
}

export interface SecurityCategoryHealth {
  category: SecurityRuleCategory;
  categoryName: string;
  posture: SecurityCategoryPosture;
  totalRules: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  observedCount: number;
  notApplicableCount: number;
  notObservableCount: number;
  manualCount: number;
  scoreDeduction: number;
  summaryExplanation?: string;
}

export interface SecurityScoreBreakdown {
  score: number; // 0 - 100
  posture: SecurityPosture;
  baseScore: number; // 100
  totalDeductions: number;
  deductionsByCategory: Record<SecurityRuleCategory, number>;
  deductions: SecurityScoreDeduction[];
  excludedNonScoringCount: number;
  observableAutomatedCoverage: {
    availableChecks: number;
    totalAutomatedChecks: number;
    coveragePercent: number;
  };
  scoreDisclaimer: string;
}

export interface SecurityTopRisk {
  findingId: string;
  ruleId: string;
  title: string;
  severity: "critical" | "high" | "medium";
  category: SecurityRuleCategory;
  affectedOccurrences: number;
  summary: string;
  leverageText: string;
}

export interface SecurityQuickWin {
  findingId: string;
  ruleId: string;
  title: string;
  difficulty: "EASY" | "MODERATE";
  estimatedEffortClass: string;
  summary: string;
  implementationHint: string;
  scoreImpact: number;
}

export interface SecurityPageSummary {
  url: string;
  httpStatus: number;
  protocol: string;
  isHttps: boolean;
  pageFindings: SecurityFinding[];
  inheritedHostFindings: SecurityFinding[];
  passedControlsCount: number;
  mixedContentCount: number;
  formsCount: number;
  thirdPartyResourcesCount: number;
}

export interface SecurityCapabilityDetail {
  status: "AVAILABLE" | "NOT_AVAILABLE" | "NOT_OBSERVABLE" | "PROVIDER_REQUIRED" | "ERROR";
  explanation?: string;
  category?: string;
}

export type SecurityAuditCapabilities = Record<string, SecurityCapabilityDetail>;

export interface SanitizedSecurityTxtFact {
  hasSecurityTxt: boolean;
  requestedUrl: string;
  httpStatus: number;
  isHttps: boolean;
  contact: string[];
  expires: string | null;
  isExpired: boolean;
  canonical: string | null;
  policy: string | null;
  encryption: string | null;
  acknowledgments: string | null;
  preferredLanguages: string | null;
}

export interface SecurityAuditViewModel {
  targetDomain: string;
  auditTimestamp: string;
  isPartialAudit: boolean;
  partialReason?: string;

  // 1. Scoring & Posture
  scoreBreakdown: SecurityScoreBreakdown;

  // 2. Metrics & Health
  stats: {
    totalRulesRegistered: number;
    testsExecuted: number;
    passedControls: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    informationalObservations: number;
    manualAreasCount: number;
    totalAffectedUrls: number;
  };

  categoryHealth: SecurityCategoryHealth[];
  topRisks: SecurityTopRisk[];
  quickWins: SecurityQuickWin[];
  implementationMap: SecurityImplementationMap;

  // 3. Complete Filterable Findings
  findings: Array<SecurityFinding & { remediation: SecurityRemediation }>;

  // 4. Full Coverage Matrix
  coverage: SecurityCoverageRecord[];

  // 5. Capabilities & Limitations (S6 / S6.1)
  capabilities: SecurityAuditCapabilities;

  // 6. Security.txt Structured Facts (RFC 9116)
  securityTxt?: SanitizedSecurityTxtFact | null;

  // 7. Per-Page Explorer
  pages: SecurityPageSummary[];

  // 8. Third Parties Inventory
  thirdParties: {
    totalThirdPartyOrigins: number;
    totalThirdPartyResources: number;
    sriCoveragePercent: number;
    origins: ThirdPartyOriginFact[];
  };

  // 9. Disclaimers & Governance
  disclaimer: {
    title: string;
    description: string;
    auditType: "AUTOMATED_CONFIGURATION_ASSESSMENT";
  };
}

export interface SecurityScoringConfig {
  severityWeights: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  confidenceModifiers: {
    confirmed: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryDeductionCaps: Partial<Record<SecurityRuleCategory, number>>;
}
