import type { BrowserVerificationCapability, DiagnosticIssue, ExternalLinkTelemetry } from "../types";
import type { VerificationGitState } from "./git-info";

export interface VerificationEnvironment {
  nodeVersion: string;
  expectedProductionNodeVersion: string;
  nodeVersionMatchesExpected: boolean;
  platform: string;
  arch: string;
  osRelease: string;
  declaredPlaywrightVersion?: string;
  lockfilePlaywrightVersion?: string;
  runtimePlaywrightVersion: string;
  playwrightVersionMatchesDeclared: boolean;
  playwrightVersion: string; // compatibility alias
  isRender: boolean;
}

export interface VerificationRunHeader {
  verificationRunId: string;
  gitShaFull: string;
  gitShaShort: string;
  branch: string;
  workingTreeClean: boolean;
  targetSite: string;
  startedAt: string;
  finishedAt?: string;
  remoteBranchSha?: string | null;
  remoteVerified: boolean;
  verificationGitState: VerificationGitState;
  environment: VerificationEnvironment;
}

export interface BrowserCapabilityArtifact {
  verificationRunId: string;
  gitShaFull: string;
  generatedAt: string;
  capability: BrowserVerificationCapability;
  details: string;
  chromiumVersion: string;
  chromiumExecutableAvailable: boolean;
  browserLaunchSucceeded: boolean;
  navigationSmokeSucceeded: boolean;
  environment: VerificationEnvironment;
}

export type FieldQualityStatus = "PASS" | "PARTIAL" | "FAIL" | "NOT_EVALUATED";

export interface FieldParityStat {
  field: string;
  category: "core_seo" | "structural_a11y" | "content_text";
  totalEvaluated: number;
  exactMatches: number;
  toleratedMatches: number;
  mismatches: number;
  inconclusive: number;
  notEvaluated: number;
  strictParityPercent: number;
  comparableParityPercent: number;
  fieldQualityStatus: FieldQualityStatus;
  gateThresholdPercent: number;
}

export interface RuleAccuracyMetric {
  ruleCode: string;
  totalEvaluatedPages: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  status: "MEASURED" | "NOT_EVALUATED";
  notes?: string;
}

export interface ParityCategorySummary {
  name: string;
  registeredFields: string[];
  totalEvaluated: number;
  exactMatches: number;
  toleratedMatches: number;
  mismatches: number;
  strictParityPercent: number;
  comparableParityPercent: number;
  qualityGatePassed: boolean;
  qualityGateThresholdPercent: number;
  mandatoryFieldsPassed: boolean;
}

export interface SingleParityPopulation {
  populationName: "raw_extraction" | "production_authoritative";
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
    coreSeo: ParityCategorySummary;
    structuralAccessibility: ParityCategorySummary;
    contentText: ParityCategorySummary;
  };
  mismatchCategories: Record<string, number>;
  fieldMetrics: FieldParityStat[];
  urlSummaries: Array<{
    url: string;
    exact: number;
    tolerated: number;
    mismatch: number;
    comparisons: Array<{
      field: string;
      category: string;
      crawlerValue: any;
      browserValue: any;
      status: string;
      mismatchReason?: string;
    }>;
  }>;
}

export interface RenderDecisionSample {
  url: string;
  classification: string;
  rawH1: string | null;
  rawVisibleWords: number;
  rawMainWords: number;
  formsCount: number;
  renderEligible: boolean;
  triggerReasons: string[];
  attempted: boolean;
  success?: boolean;
  authoritativeSource: "raw" | "rendered";
}

export interface RenderTriggerAccuracyMetric {
  targetUrlsCount: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  precisionPercent: number;
  recallPercent: number;
}

export interface ParityArtifact {
  verificationRunId: string;
  gitShaFull: string;
  generatedAt: string;
  rawExtractionParity: SingleParityPopulation;
  productionAuthoritativeParity: SingleParityPopulation;
  renderTriggerAccuracy: RenderTriggerAccuracyMetric;
  renderDecisionSamples: RenderDecisionSample[];
  ruleMetrics: RuleAccuracyMetric[];
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
  gitShaFull: string;
  generatedAt: string;
  probesCount: number;
  disputedUrlsCount: number;
  results: DisputedUrlStabilityProbe[];
}

export interface RenderingTelemetry {
  htmlPagesEvaluated: number;
  eligibleForRender: number;
  notEligibleForRender: number;
  actuallyRendered: number;
  skippedEligible: number;
  renderSuccess: number;
  renderFailed: number;
  authoritativeRenderedPagesCount: number;
  telemetryInvariantValid: boolean;
}

export interface AuditArtifact {
  verificationRunId: string;
  gitShaFull: string;
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
  renderingTelemetry: RenderingTelemetry;
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
  gitShaFull: string;
  generatedAt: string;
  artifacts: {
    browserCapability: ReleaseManifestEntry;
    parity: ReleaseManifestEntry;
    audit: ReleaseManifestEntry;
    legacyStability: ReleaseManifestEntry;
  };
}

export type DeploymentStatusClassification =
  | "PRODUCTION_VERIFIED"
  | "DNS_UNRESOLVED"
  | "CONNECTION_TIMEOUT"
  | "SERVICE_UNAVAILABLE"
  | "HTTP_ERROR"
  | "HEALTH_ROUTE_MISSING"
  | "SHA_MISMATCH"
  | "BROWSER_UNAVAILABLE"
  | "DEPLOYMENT_URL_NOT_CONFIGURED"
  | "DEPLOYMENT_PENDING";

export interface DeploymentVerificationArtifact {
  deploymentUrl: string | null;
  deployedGitSha: string | null;
  verifiedGitSha: string;
  shaMatch: boolean;
  runtime: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  chromiumVersion?: string;
  browserCapability: BrowserVerificationCapability;
  browserLaunchSucceeded: boolean;
  navigationSmokeSucceeded: boolean;
  checkedAt: string;
  deploymentStatus: DeploymentStatusClassification;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number | null;
}

export interface MultiDimensionalReleaseStatus {
  buildVerificationStatus: "PASS" | "FAIL";
  accuracyVerificationStatus: "PASS" | "NEEDS_REVIEW" | "FAIL";
  localReleaseStatus: "VERIFIED_PASS" | "VERIFIED_WITH_WARNINGS" | "FAILED";
  productionDeploymentStatus: DeploymentStatusClassification;
}

export interface ReleaseVerificationReport {
  verificationRunId: string;
  gitShaFull: string;
  gitShaShort: string;
  branch: string;
  workingTreeClean: boolean;
  remoteBranchSha?: string | null;
  remoteVerified: boolean;
  verificationGitState: VerificationGitState;
  generatedAt: string;
  statuses: MultiDimensionalReleaseStatus;
  overallStatus: "VERIFIED_PASS" | "VERIFIED_WITH_WARNINGS" | "FAILED"; // compatibility alias for localReleaseStatus
  summary: {
    buildStatus: "PASS" | "FAIL";
    browserCapability: BrowserVerificationCapability;
    rawParityComparableRate: number;
    productionParityComparableRate: number;
    productionParityStrictRate: number;
    coreSeoParityPercent: number;
    structuralParityPercent: number;
    contentTextParityPercent: number;
    auditHealthScore: number;
    auditCoveragePercent: number;
    pagesCrawled: number;
    indexablePages: number;
    renderedPagesCount: number;
    renderTriggerRecallPercent: number;
    terminationReason: string;
    totalIssues: number;
    criticalIssues: number;
  };
  invariantsCheck: {
    passed: boolean;
    allArtifactsShareRunIdAndSha: boolean;
    parityArithmeticValid: boolean;
    fieldMetricsSumReconcilesGlobally: boolean;
    mismatchCategoriesSumValid: boolean;
    telemetryArithmeticValid: boolean;
    scoreDeductionsValid: boolean;
    renderDecisionTelemetryValid: boolean;
  };
  provenance: {
    gitShaFull: string;
    gitShaShort: string;
    branch: string;
    remoteBranchSha?: string | null;
    remoteVerified: boolean;
    verificationGitState: VerificationGitState;
    commitTimestamp?: string;
    commitAuthor?: string;
    commitMessage?: string;
  };
  environment: VerificationEnvironment;
  browserCapability: BrowserCapabilityArtifact;
  browserParity: ParityArtifact;
  renderDecisionSamples: RenderDecisionSample[];
  ruleAccuracy: RuleAccuracyMetric[];
  legacyStability: LegacyStabilityArtifact;
  fullAudit: AuditArtifact;
  manifest: ReleaseManifest;
  deploymentVerification?: DeploymentVerificationArtifact;
  knownLimitations: string[];
}
