/**
 * Phase 20: SEO Impact Modeling & Decision Intelligence Master Coordinator.
 * Evaluates observed exposure, constructs non-probabilistic scenario ranges, deduplicates action overlap,
 * and generates portfolio decision intelligence.
 */

import {
  SeoImpactEstimate,
  SeoImpactReport,
  ForecastSnapshot,
  BusinessEconomicsConfig,
  BusinessDataState,
  ImplementationCostState,
  ActionOverlapState,
} from "./types";
import { computeObservedExposure } from "./exposure-engine";
import { evaluateActionForecastability } from "./forecastability-gate";
import { generateImpactScenarios } from "./scenario-model";
import { computePortfolioScenarios } from "./overlap-deduplicator";
import { computeBusinessScenarios } from "./business-roi";
import { createForecastSnapshot } from "./snapshots";
import { enrichPhase11ActionsWithForecast } from "./phase11-bridge";
import { SeoActionItem } from "../opportunity/types";
import { ForecastingPolicy, DEFAULT_FORECASTING_POLICY } from "./config";

export interface ActionImpactInput {
  action: SeoActionItem;
  historicalImpressions?: number;
  historicalClicks?: number;
  avgPosition?: number;
  positionVolatilityStdDev?: number;
  historicalPeriodMonthlyClicks?: number[];
  anomalyNotes?: string[];
  historicalPreRegressionMonthlyClicks?: number;
  sameSiteBenchmarkCtrPercent?: number;
  opportunityPoolId?: string;
  overlapState?: ActionOverlapState;
  overlapAdjustmentCoefficient?: number;
  isNewContentCandidate?: boolean;
  isBacklinkProspecting?: boolean;
  isSchemaOnly?: boolean;
  isIndexationBlocked?: boolean;
  isMigrationTransition?: boolean;
  serpVolatilityHigh?: boolean;
  dependencyBlockedByActionIds?: string[];
  userConfiguredAssumptions?: {
    conservativeMultiplier: number;
    baseMultiplier: number;
    upsideMultiplier: number;
  };
}

export interface AnalyzeSeoImpactParams {
  projectId: string;
  actionInputs: ActionImpactInput[];
  businessEconomics?: BusinessEconomicsConfig;
  policy?: ForecastingPolicy;
}

export async function analyzeSeoImpactIntelligence(params: AnalyzeSeoImpactParams): Promise<{
  report: SeoImpactReport;
  snapshot: ForecastSnapshot;
  enrichedActions: SeoActionItem[];
  estimates: SeoImpactEstimate[];
}> {
  const policy = params.policy || DEFAULT_FORECASTING_POLICY;
  const estimates: SeoImpactEstimate[] = [];
  const rawActions: SeoActionItem[] = [];

  for (const input of params.actionInputs) {
    const act = input.action;
    rawActions.push(act);

    // 1. Observed Exposure & Baseline Distribution
    const observed = computeObservedExposure({
      impressions: input.historicalImpressions,
      clicks: input.historicalClicks,
      avgPosition: input.avgPosition,
      positionVolatilityStdDev: input.positionVolatilityStdDev,
      affectedUrls: act.affectedUrls,
      historicalPeriodMonthlyClicks: input.historicalPeriodMonthlyClicks,
      anomalyNotes: input.anomalyNotes,
      periodRange: "Last 28 days GSC",
    });

    // 2. Forecastability Gate
    const gate = evaluateActionForecastability({
      actionType: act.type,
      ruleCode: act.underlyingRuleCodes?.[0],
      observedExposure: observed,
      hasHistoricalPreRegressionBaseline: !!input.historicalPreRegressionMonthlyClicks,
      hasSameSiteCohortBenchmark: !!input.sameSiteBenchmarkCtrPercent,
      isNewContentCandidate: input.isNewContentCandidate,
      isBacklinkProspecting: input.isBacklinkProspecting,
      isSchemaOnly: input.isSchemaOnly,
      isIndexationBlocked: input.isIndexationBlocked,
      isMigrationTransition: input.isMigrationTransition,
      serpVolatilityHigh: input.serpVolatilityHigh,
      policy,
    });

    // 3. Scenario Modeling
    let scenarios: SeoImpactEstimate["scenarios"] | undefined;
    let scenarioMethod = gate.scenarioMethod;

    if (gate.quantificationSupported) {
      const modelType = input.historicalPreRegressionMonthlyClicks
        ? "TECHNICAL_RECOVERY"
        : input.sameSiteBenchmarkCtrPercent
        ? "CTR_BENCHMARK_OPTIMIZATION"
        : "GENERIC_OPPORTUNITY";

      const res = generateImpactScenarios({
        modelType,
        observedExposure: observed,
        historicalPreRegressionMonthlyClicks: input.historicalPreRegressionMonthlyClicks,
        sameSiteBenchmarkCtrPercent: input.sameSiteBenchmarkCtrPercent,
        userConfiguredAssumptions: input.userConfiguredAssumptions,
      });

      scenarios = res.scenarios;
      scenarioMethod = res.scenarioMethod;
    }

    // 4. Business Economics (Conditional)
    const businessScenarios = computeBusinessScenarios(scenarios, params.businessEconomics);

    estimates.push({
      actionId: act.actionId,
      projectId: params.projectId,
      ruleCode: act.underlyingRuleCodes?.[0],
      title: act.title,
      impactNature: gate.quantificationSupported ? "CONDITIONAL_SCENARIO_RANGE" : "OBSERVED_EXPOSURE",
      forecastability: gate.forecastability,
      quantificationSupported: gate.quantificationSupported,
      unquantifiedReason: gate.unquantifiedReason,
      scenarioMethod,
      affectedUrls: act.affectedUrls,
      opportunityPoolId: input.opportunityPoolId || act.affectedUrls[0] || act.actionId,
      overlapState: input.overlapState || "INDEPENDENT",
      overlapAdjustmentCoefficient: input.overlapAdjustmentCoefficient,
      observedExposure: observed,
      baselineType: input.historicalPreRegressionMonthlyClicks
        ? "PRE_REGRESSION_WINDOW"
        : "HISTORICAL_HEALTHY_PERIOD",
      seasonalComparability: "STRONG",
      isBaselineAnomalyFree: gate.isBaselineAnomalyFree,
      scenarios,
      businessValueScenarios: businessScenarios.conservativeMonthlyRevenue
        ? {
            conservativeMonthlyRevenue: businessScenarios.conservativeMonthlyRevenue,
            baseMonthlyRevenue: businessScenarios.baseMonthlyRevenue,
            upsideMonthlyRevenue: businessScenarios.upsideMonthlyRevenue,
            estimatedScenarioRoi: businessScenarios.estimatedScenarioRoi,
            estimatedScenarioProfitRoi: businessScenarios.estimatedScenarioProfitRoi,
            costState: businessScenarios.costState,
            totalImplementationCost: businessScenarios.totalImplementationCost,
            assumptionsDisclosure: businessScenarios.assumptionsDisclosure,
          }
        : undefined,
      confidence: gate.confidence,
      uncertaintyReasons: gate.uncertaintyReasons,
      downsideRisk: act.type === "TECHNICAL_FIX" ? "LOW_RISK" : "MODERATE_RISK",
      reversibility: act.type === "TECHNICAL_FIX" ? "HIGHLY_REVERSIBLE" : "REVERSIBLE",
      dependencyBlockedByActionIds: input.dependencyBlockedByActionIds || [],
      isIndexationDependent: !!input.isIndexationBlocked,
      modelVersion: policy.modelVersion,
      policyVersion: policy.policyVersion,
      calibrationVersion: policy.calibrationVersion,
    });
  }

  // 5. Portfolio Overlap Scenarios
  const portfolioSummary = computePortfolioScenarios(estimates, params.projectId, policy, params.businessEconomics);

  const businessDataState: BusinessDataState = params.businessEconomics?.funnel?.averageOrderValueOrLtv
    ? "BUSINESS_DATA_AVAILABLE"
    : "NO_BUSINESS_DATA";

  const costState: ImplementationCostState = params.businessEconomics?.costs
    ? "IMPLEMENTATION_COST_AVAILABLE"
    : "NO_IMPLEMENTATION_COST";

  // 6. Assemble Snapshot
  const snapshot = createForecastSnapshot({
    snapshotId: `snap_fore_${params.projectId}_${Date.now()}`,
    projectId: params.projectId,
    modelVersion: policy.modelVersion,
    policyVersion: policy.policyVersion,
    calibrationVersion: policy.calibrationVersion,
    businessDataState,
    costState,
    portfolioSummary,
    estimates,
  });

  // 7. Assemble Master Report
  const report: SeoImpactReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    modelVersion: policy.modelVersion,
    policyVersion: policy.policyVersion,
    calibrationVersion: policy.calibrationVersion,
    businessDataState,
    costState,
    portfolioSummary,
    actionEstimates: estimates,
    governanceLimitations: [
      "Scenario forecasts are conditional non-probabilistic ranges and must never be interpreted as deterministic guarantees.",
      "Observed search exposure represents historical baseline volume, not guaranteed recoverable clicks.",
      "Post-fix traffic changes reflect observational association and do not automatically prove causation.",
      "Monetary ROI is modeled only when explicit first-party business economics and cost inputs are configured.",
    ],
    immutabilityStatement: "Immutability Guarantee: Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  // 8. Enrich Phase 11 Canonical Actions
  const enrichedActions = enrichPhase11ActionsWithForecast(rawActions, estimates);

  return {
    report,
    snapshot,
    enrichedActions,
    estimates,
  };
}
