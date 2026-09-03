/**
 * Typed Contracts for Security Fix Intelligence & Remediation Engineering (SECURITY S4).
 * Provides structured, actionable, multi-layer remediation blueprints for all security findings.
 */

export type SecurityOwnership =
  | "SITE_OWNER"
  | "CONTENT_EDITOR"
  | "DEVELOPER"
  | "CMS_ADMIN"
  | "APPLICATION"
  | "WEB_SERVER"
  | "CDN"
  | "DNS_PROVIDER"
  | "HOSTING_PROVIDER"
  | "EMAIL_ADMIN"
  | "THIRD_PARTY_PROVIDER"
  | "PLATFORM_CONTROLLED";

export type SecurityRemediationScope =
  | "URL"
  | "PAGE"
  | "RESOURCE"
  | "COMPONENT"
  | "TEMPLATE"
  | "APPLICATION"
  | "SERVER"
  | "HOST"
  | "DOMAIN"
  | "SITE_WIDE"
  | "THIRD_PARTY";

export type SecurityFixDifficulty = "EASY" | "MODERATE" | "ADVANCED";

export type SecurityEffortClass =
  | "MINUTES"
  | "UNDER_1_HOUR"
  | "FEW_HOURS"
  | "PROJECT_LEVEL"
  | "PROVIDER_DEPENDENT";

export type SecurityPlatformType =
  | "WEBFLOW"
  | "WORDPRESS"
  | "NEXT_JS"
  | "SHOPIFY"
  | "STATIC_CUSTOM"
  | "NGINX"
  | "APACHE"
  | "CLOUDFLARE"
  | "GENERIC";

export type SecurityActionabilityType =
  | "USER_ACTIONABLE"
  | "DEVELOPER_ACTIONABLE"
  | "PROVIDER_ACTIONABLE"
  | "PLATFORM_CONTROLLED"
  | "INFORMATIONAL_ONLY"
  | "MANUAL_ASSESSMENT_REQUIRED";

export interface SecurityCodeExample {
  title: string;
  language: string;
  code: string;
  description?: string;
  context?: "BEFORE" | "AFTER" | "RECOMMENDED" | "CONFIG";
}

export interface SecurityPlatformInstruction {
  platform: SecurityPlatformType;
  title: string;
  isDirectlySupported: boolean;
  controlLocation: string; // e.g. "Webflow Site Settings > Custom Code" or "next.config.js > headers()"
  steps: string[];
  codeExamples?: SecurityCodeExample[];
  caveats?: string[];
}

export interface SecurityAutomatedVerificationContract {
  supported: boolean;
  method: "RE_FETCH_HTTPS" | "RE_CRAWL_PAGE" | "SAFE_PROBE" | "DNS_QUERY" | "TLS_HANDSHAKE" | "MANUAL_ONLY";
  requiredFacts: string[];
  successCondition: string;
  partialCondition?: string;
  failureCondition: string;
}

export interface SecurityGlobalEfficiency {
  isGlobalFix: boolean;
  fixOnce: boolean;
  affectedUrlsCount: number;
  affectedOccurrencesCount: number;
  scope: SecurityRemediationScope;
  explanation: string;
}

export interface SecurityReference {
  title: string;
  url: string;
  source: "MDN" | "OWASP" | "W3C" | "PLATFORM_DOCS" | "IETF_RFC";
}

export interface SecurityRemediation {
  findingId: string;
  ruleId: string;
  title: string;

  // Progressive Disclosure Level 1: Summary & Plain English
  summary: string;
  simpleExplanation: string; // "In Simple Terms"
  whatIsWrong: string;
  whyItMatters: string;
  evidenceExplanation: string;

  // Ownership & Scope
  scope: SecurityRemediationScope;
  scopeExplanation: string;
  actionability: SecurityActionabilityType;
  ownership: SecurityOwnership[];

  // Actionable Remediation
  recommendedAction: string;
  exactRecommendedChange: string;
  implementationSteps: string[];

  // Code & Config Examples
  codeExamples: SecurityCodeExample[];
  configurationExamples: SecurityCodeExample[];
  platformInstructions: SecurityPlatformInstruction[];

  // Risk Management
  risksAndCautions: string[];
  prerequisites: string[];

  // Verification & Impact
  verificationSteps: string[];
  automatedVerification: SecurityAutomatedVerificationContract;
  expectedImpact: string;

  // Affected Targeting & Efficiency
  affectedUrls: string[];
  affectedResources?: string[];
  affectedOccurrences: number;
  globalEfficiency: SecurityGlobalEfficiency;

  // Difficulty & Effort
  difficulty: SecurityFixDifficulty;
  estimatedEffortClass: SecurityEffortClass;

  // Metadata
  references: SecurityReference[];
  limitations: string[];
}

export interface SecurityImplementationAction {
  actionId: string;
  title: string;
  description: string;
  primaryOwner: SecurityOwnership;
  secondaryOwners?: SecurityOwnership[];
  difficulty: SecurityFixDifficulty;
  estimatedEffortClass: SecurityEffortClass;
  resolvedRuleIds: string[];
  resolvedFindingIds: string[];
  affectedUrlsCount: number;
  affectedOccurrencesCount: number;
  isGlobalFix: boolean;
  implementationSummary: string;
}

export interface SecurityImplementationMap {
  totalActions: number;
  totalResolvedFindings: number;
  actionsByOwner: Record<SecurityOwnership, SecurityImplementationAction[]>;
  actions: SecurityImplementationAction[];
  globalActionsCount: number;
}
