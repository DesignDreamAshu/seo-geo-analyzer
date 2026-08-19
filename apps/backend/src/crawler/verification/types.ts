import type { BrowserPageState, BrowserVerificationCapability, CrawlAuditResult, DiagnosticIssue, ExternalLinkTelemetry } from "../types";

export interface VerificationEnvironment {
  nodeVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  playwrightVersion: string;
  isRender: boolean;
}

export interface VerificationRunHeader {
  verificationRunId: string;
  gitSha: string;
  branch: string;
  workingTreeClean: boolean;
  targetSite: string;
  startedAt: string;
  finishedAt?: string;
  environment: VerificationEnvironment;
}

export interface BrowserCapabilityArtifact {
  verificationRunId: string;
  gitSha: string;
  generatedAt: string;
  capability: BrowserVerificationCapability;
  details: string;
  launchSuccess: boolean;
  navigationSmokeSuccess: boolean;
  environment: VerificationEnvironment;
}

export interface FieldParityStat {
  field: string;
  totalEvaluated: number;
  exactMatches: number;
  toleratedMatches: number;
  mismatches: number;
  inconclusive: number;
  notEvaluated: number;
  strictParityPercent: number;
  comparableParityPercent: number;
}

export interface RuleAccuracyMetric {
  ruleCode: string;
  totalEvaluatedPages: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  status: "MEASURED" | "NOT_EVALUATED";
}

export interface ParityArtifact {
  verificationRunId: string;
  gitSha: string;
  generatedAt: string;
  targetUrlsCount: number;
  totalFactsConsidered: number;
  exactMatches: number;
  toleratedMatches: number;
  mismatches: number;
  inconclusive: number;
  notEvaluated: number;
  strictParity: number; // 0 - 100
  comparableParity: number; // 0 - 100
  accuracyBand: "excellent" | "good" | "needs_review" | "unacceptable";
  categoryParity: {
    coreSeoParityPercent: number;
    structuralAccessibilityParityPercent: number;
    contentTextParityPercent: number;
  };
  mismatchCategories: Record<string, number>;
  fieldMetrics: FieldParityStat[];
  ruleMetrics: RuleAccuracyMetric[];
  urlSummaries: Array<{
    url: string;
    exact: number;
    tolerated: number;
    mismatch: number;
    comparisons: Array<{
      field: string;
      crawlerValue: any;
      browserValue: any;
      status: string;
      note?: string;
    }>;
  }>;
}

export interface DisputedUrlStabilityProbe {
  url: string;
  statusObservations: number[];
  isStable: boolean;
  stabilityClassification: "stable_200" | "stable_404" | "unstable_manual_review" | "unreachable";
  rootCauseAnalysis: string;
}

export interface LegacyStabilityArtifact {
  verificationRunId: string;
  gitSha: string;
  generatedAt: string;
  probesCount: number;
  disputedUrlsCount: number;
  results: DisputedUrlStabilityProbe[];
}

export interface AuditArtifact {
  verificationRunId: string;
  gitSha: string;
  generatedAt: string;
  auditId: string;
  seedUrl: string;
  durationMs: number;
  terminationReason: string;
  healthScore: number;
  auditCoveragePercent: number;
  inventory: {
    totalCrawled: number;
    totalIndexable: number;
    totalNonIndexable: number;
    totalRedirects: number;
    totalBrokenPages: number;
    sitemapDiscoveredCount: number;
    sitemapOrphanCount: number;
    crawlIsolatedCount: number;
  };
  severityCounts: {
    critical: number;
    warnings: number;
    opportunities: number;
    notices: number;
  };
  issues: DiagnosticIssue[];
  externalLinkTelemetry: ExternalLinkTelemetry;
}

export interface ReleaseManifestEntry {
  path: string;
  relativePath: string;
  sha256: string;
  byteSize: number;
}

export interface ReleaseManifest {
  verificationRunId: string;
  gitSha: string;
  generatedAt: string;
  artifacts: {
    browserCapability: ReleaseManifestEntry;
    parity: ReleaseManifestEntry;
    audit: ReleaseManifestEntry;
    legacyStability: ReleaseManifestEntry;
  };
}

export interface ReleaseVerificationReport {
  verificationRunId: string;
  gitSha: string;
  branch: string;
  workingTreeClean: boolean;
  generatedAt: string;
  overallStatus: "VERIFIED_PASS" | "VERIFIED_WITH_WARNINGS" | "FAILED";
  summary: {
    buildStatus: "PASS" | "FAIL";
    browserCapability: BrowserVerificationCapability;
    parityComparableRate: number;
    parityStrictRate: number;
    auditHealthScore: number;
    auditCoveragePercent: number;
    pagesCrawled: number;
    indexablePages: number;
    terminationReason: string;
    totalIssues: number;
    criticalIssues: number;
  };
  invariantsCheck: {
    passed: boolean;
    allArtifactsShareRunIdAndSha: boolean;
    parityArithmeticValid: boolean;
    mismatchCategoriesSumValid: boolean;
    telemetryArithmeticValid: boolean;
    scoreDeductionsValid: boolean;
  };
  provenance: {
    gitSha: string;
    branch: string;
    commitTimestamp?: string;
    commitAuthor?: string;
    commitMessage?: string;
  };
  environment: VerificationEnvironment;
  browserCapability: BrowserCapabilityArtifact;
  browserParity: ParityArtifact;
  ruleAccuracy: RuleAccuracyMetric[];
  legacyStability: LegacyStabilityArtifact;
  fullAudit: AuditArtifact;
  manifest: ReleaseManifest;
  knownLimitations: string[];
}
