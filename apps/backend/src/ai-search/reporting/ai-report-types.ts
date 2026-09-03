/**
 * Phase 28D.1 Live AI Executive Report Contracts.
 */

export interface AIReportPriorityItem {
  priority: number;
  title: string;
  reason: string;
  evidence: string[];
  recommendedAction: string;
  expectedImpact: "High" | "Medium" | "Low" | string;
  difficulty: "Easy" | "Moderate" | "Complex" | string;
  affectedPagesCount?: number;
}

export interface AIReportQuickWin {
  title: string;
  impact: string;
  action: string;
  effort: string;
}

export interface AIReportStructuralImprovement {
  area: string;
  observation: string;
  strategicRecommendation: string;
}

export interface AIReportImplementationPhase {
  phase: string;
  actions: string[];
  timeframe: string;
}

export interface AIExecutiveReport {
  executiveSummary: string;
  overallAssessment: string;
  healthBand?: string;
  topPriorities: AIReportPriorityItem[];
  quickWins: AIReportQuickWin[];
  structuralImprovements: AIReportStructuralImprovement[];
  crossIssueInsights: string[];
  implementationPlan: AIReportImplementationPhase[];
  limitations: string[];
}

export interface PersistedAIAnalysisRecord {
  reportId: string;
  projectId: string;
  auditRunId: string;
  generatedAt: string;
  provider: string;
  gateway: string;
  requestedModel: string;
  resolvedModel: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  entitlementSource: string;
  creditsConsumed: number;
  generationStatus: "COMPLETED" | "FAILED";
  schemaVersion: string;
  report: AIExecutiveReport;
  createdAt: string;
}
