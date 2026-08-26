/**
 * Phase 28K: Client Reporting & Executive Intelligence Data Model.
 * Represents immutable, reproducible client report snapshots supporting both
 * EXECUTIVE and TECHNICAL presentation modes.
 */

export type ReportAudience = "EXECUTIVE" | "TECHNICAL";

export type ReportComparabilityState =
  | "DIRECTLY_COMPARABLE"
  | "COMPARABLE_WITH_CAVEAT"
  | "NOT_COMPARABLE";

export interface ScoreDriverItem {
  ruleId: string;
  ruleTitle: string;
  pointImpact: number;
  explanation: string;
}

export interface ClientReportSnapshot {
  reportId: string;
  projectId: string;
  reportVersion: "phase28k-client-report-v1";
  generatedAt: string;
  fingerprint: string;
  
  metadata: {
    projectName: string;
    domain: string;
    audience: ReportAudience;
    auditRunId?: string;
    previousAuditRunId?: string;
    aiMeasurementSnapshotId?: string;
    competitiveSnapshotId?: string;
    workflowSnapshotId?: string;
  };

  executiveSummary: {
    headline: string;
    overallHealthStatus: string;
    keyAccomplishments: string[];
    topRemainingRisks: string[];
    clientDependencies: string[];
    recommendedNextActions: string[];
  };

  seoHealth: {
    currentScore: number;
    previousScore: number | null;
    scoreDelta: number | null;
    scoreDrivers: ScoreDriverItem[];
    rulesPassed: number;
    rulesFailed: number;
    totalRules: number;
  };

  remediationProgress: {
    totalActionItems: number;
    openCount: number;
    inProgressCount: number;
    readyToVerifyCount: number;
    verifiedFixedCount: number;
    partiallyFixedCount: number;
    blockedCount: number;
    wontFixCount: number;
    totalOccurrences: number;
    resolvedOccurrences: number;
    remainingOccurrences: number;
    progressPercentage: number;
  };

  aiSearchIntelligence: {
    promptUniverseSize: number;
    adequatelyServedPrompts: number;
    highPriorityServedPrompts: number;
    highPriorityTotal: number;
    clearPrimaryTargets: number;
    providerGroundingStatus: string;
    categoryCoverages: {
      category: string;
      status: string;
      score: number;
      summary: string;
    }[];
  };

  competitiveIntelligence: {
    competitorName?: string;
    competitorDomain?: string;
    totalCompared: number;
    clientWins: number;
    competitorWins: number;
    roughParity: number;
    bothWeak: number;
    clientAdvantagesCount: number;
    actionableOpportunitiesCount: number;
  };

  keyIssuesRemaining: {
    actionItemId: string;
    title: string;
    priority: string;
    category: string;
    affectedPageCount: number;
    recommendation: string;
    sampleUrls: string[];
  }[];

  verifiedWorkCompleted: {
    actionItemId: string;
    title: string;
    category: string;
    resolvedOccurrences: number;
    verifiedAt: string;
    evidenceSummary: string;
  }[];

  clientDependencies: {
    actionItemId: string;
    title: string;
    blockerReason: string;
    blockerDetail: string;
  }[];

  prioritizedNextActions: {
    step: number;
    actionItemId: string;
    title: string;
    priority: string;
    actionSummary: string;
    expectedImpact: string;
  }[];

  methodologyAndCaveats: {
    comparability: ReportComparabilityState;
    notes: string[];
  };
}

export interface ReportGenerationOptions {
  audience?: ReportAudience;
  includeSEO?: boolean;
  includeAI?: boolean;
  includeCompetitive?: boolean;
  previousAuditRunId?: string;
}
