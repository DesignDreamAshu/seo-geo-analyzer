/**
 * Phase 20: SEO Forecasting, Impact Modeling & Decision Intelligence Types & Data Contracts.
 * Hardened with non-probabilistic scenario ranges, multi-stage business funnels, sequence-aware dependency portfolios,
 * explicit overlap aggregation semantics, and benchmark quality tracking.
 */

import { ActionPriority, ImplementationEffort, ActionOwner, TimelineBucket } from "../opportunity/types";

export type ImpactNature =
  | "OBSERVED_EXPOSURE"
  | "ESTIMATED_OPPORTUNITY"
  | "CONDITIONAL_SCENARIO_RANGE"
  | "POST_FIX_REALIZED_CHANGE"
  | "ATTRIBUTION_UNKNOWN";

export type ForecastabilityState =
  | "HIGHLY_FORECASTABLE"
  | "PARTIALLY_FORECASTABLE"
  | "LOW_FORECASTABILITY"
  | "NOT_FORECASTABLE";

export type ForecastConfidence =
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT_EVIDENCE";

export type ScenarioConstructionMethod =
  | "SAME_URL_HISTORICAL_DISTRIBUTION"
  | "SAME_CLUSTER_HISTORICAL_DISTRIBUTION"
  | "PROJECT_ACTION_CLASS_BENCHMARK"
  | "SAME_SITE_COHORT_BENCHMARK"
  | "CONFIGURED_EXTERNAL_BENCHMARK"
  | "USER_CONFIGURED_ASSUMPTIONS"
  | "ASSUMPTION_DRIVEN_SCENARIO"
  | "QUANTIFICATION_NOT_SUPPORTED";

export type SeasonalComparability =
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "UNKNOWN";

export type ActionOverlapState =
  | "INDEPENDENT"
  | "PARTIALLY_OVERLAPPING"
  | "HIGHLY_OVERLAPPING"
  | "SAME_OPPORTUNITY_POOL"
  | "DEPENDENT"
  | "UNKNOWN_OVERLAP";

export type DownsideRiskLevel = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";

export type ActionReversibility =
  | "HIGHLY_REVERSIBLE"
  | "REVERSIBLE"
  | "DIFFICULT_TO_REVERSE"
  | "IRREVERSIBLE_OR_HIGH_RISK";

export type BusinessDataState =
  | "BUSINESS_DATA_AVAILABLE"
  | "PARTIAL_BUSINESS_DATA"
  | "NO_BUSINESS_DATA";

export type ImplementationCostState =
  | "IMPLEMENTATION_COST_AVAILABLE"
  | "PARTIAL_IMPLEMENTATION_COST"
  | "NO_IMPLEMENTATION_COST";

export type FunnelType = "ECOMMERCE" | "LEAD_GENERATION" | "SAAS" | "CUSTOM_FUNNEL";

export type BenchmarkQualityState =
  | "BENCHMARK_STRONG"
  | "BENCHMARK_MODERATE"
  | "BENCHMARK_WEAK"
  | "INSUFFICIENT_HISTORICAL_SAMPLE";

export type PostFixRealizationState =
  | "BELOW_CONSERVATIVE_RANGE"
  | "WITHIN_CONSERVATIVE_RANGE"
  | "WITHIN_BASE_RANGE"
  | "WITHIN_UPSIDE_RANGE"
  | "ABOVE_UPSIDE_RANGE"
  | "INCONCLUSIVE"
  | "MEASUREMENT_NOT_READY";

export type AttributionConfidenceLevel =
  | "HIGH_ATTRIBUTION_CONFIDENCE"
  | "MODERATE_ATTRIBUTION_CONFIDENCE"
  | "LOW_ATTRIBUTION_CONFIDENCE"
  | "ATTRIBUTION_UNKNOWN";

export interface HistoricalBaselineDistribution {
  medianMonthlyClicks: number;
  p25MonthlyClicks?: number;
  p75MonthlyClicks?: number;
  dispersionVariance?: number;
  periodCount: number;
  isAnomalyFree: boolean;
  anomalyNotes?: string[];
}

export interface ObservedExposureMetric {
  historicalMonthlyImpressions: number;
  historicalMonthlyClicks: number;
  historicalAverageCtr: number;
  historicalAveragePosition?: number;
  positionVolatilityStdDev?: number;
  affectedUrlsCount: number;
  affectedQueryClustersCount: number;
  referringDomainsCount?: number;
  evidencePeriodRange: string;
  baselineDistribution?: HistoricalBaselineDistribution;
}

export interface ImpactScenarioRange {
  minMonthlyClicks: number;
  maxMonthlyClicks: number;
  scenarioDescription: string;
}

export interface BusinessFunnelConfig {
  funnelType: FunnelType;
  currency: string;
  stage1ConversionRatePercent?: number; // e.g. visit to lead / add to cart
  stage2ConversionRatePercent?: number; // e.g. lead to qualified / cart to checkout
  stage3ConversionRatePercent?: number; // e.g. qualified to close / checkout to purchase
  averageOrderValueOrLtv?: number;
  grossMarginPercent?: number; // e.g. 70%
}

export interface ImplementationCostsConfig {
  developerCost?: number;
  contentCost?: number;
  designCost?: number;
  SEOConsultingCost?: number;
  outreachCost?: number;
  fixedVendorCost?: number;
  internalHourlyCost?: number;
  estimatedHours?: number;
  customImplementationCost?: number;
}

export interface BusinessEconomicsConfig {
  funnel?: BusinessFunnelConfig;
  costs?: ImplementationCostsConfig;
}

export interface SeoImpactEstimate {
  actionId: string;
  projectId: string;
  ruleCode?: string;
  title: string;

  impactNature: ImpactNature;
  forecastability: ForecastabilityState;
  quantificationSupported: boolean;
  unquantifiedReason?: string;
  scenarioMethod: ScenarioConstructionMethod;

  affectedUrls: string[];
  opportunityPoolId?: string;
  overlapState: ActionOverlapState;
  overlapAdjustmentCoefficient?: number; // 0.0 to 1.0

  // 1. Observed Exposure Baseline
  observedExposure: ObservedExposureMetric;
  baselineType: "HISTORICAL_HEALTHY_PERIOD" | "YEAR_OVER_YEAR_MATCH" | "PRE_REGRESSION_WINDOW" | "SAME_SITE_COHORT" | "NO_HISTORICAL_BASELINE";
  seasonalComparability: SeasonalComparability;
  isBaselineAnomalyFree: boolean;

  // 2. Scenario Forecasts (Non-probabilistic conditional ranges)
  scenarios?: {
    conservative: ImpactScenarioRange;
    base: ImpactScenarioRange;
    upside: ImpactScenarioRange;
  };

  // 3. Business & Revenue Scenarios (Conditional on explicit business inputs)
  businessValueScenarios?: {
    conservativeMonthlyRevenue?: { min: number; max: number; currency: string };
    baseMonthlyRevenue?: { min: number; max: number; currency: string };
    upsideMonthlyRevenue?: { min: number; max: number; currency: string };
    estimatedScenarioRoi?: number; // Scenario Return Ratio (Annual Base / Cost)
    estimatedScenarioProfitRoi?: number; // Margin adjusted
    costState: ImplementationCostState;
    totalImplementationCost?: number;
    assumptionsDisclosure: string[];
  };

  // 4. Uncertainty, Dependencies & Risk
  confidence: ForecastConfidence;
  uncertaintyReasons: string[];
  downsideRisk: DownsideRiskLevel;
  reversibility: ActionReversibility;
  dependencyBlockedByActionIds: string[];
  isIndexationDependent: boolean;

  // 5. Post-Fix Verification & Realization
  postFixStatus?: {
    measuredAt: string;
    observedPostFixMonthlyClicks: number;
    realizationState: PostFixRealizationState;
    technicalResolutionSuccess: boolean;
    attributionConfidence: AttributionConfidenceLevel;
    confoundingFactors: string[];
    measurementWindowDays: number;
    hasHoldoutControlCohort?: boolean;
  };

  modelVersion: string;
  policyVersion: string;
  calibrationVersion?: string;
}

export interface PortfolioForecastSummary {
  projectId: string;
  totalActionsEvaluated: number;
  quantifiableActionsCount: number;
  unquantifiedActionsCount: number;

  totalObservedMonthlyClicksExposure: number;
  totalObservedMonthlyImpressionsExposure: number;

  portfolioScenarios: {
    conservativeMonthlyClicksRange: { min: number; max: number };
    baseMonthlyClicksRange: { min: number; max: number };
    upsideMonthlyClicksRange: { min: number; max: number };
  };

  portfolioBusinessScenarios?: {
    conservativeMonthlyRevenueRange?: { min: number; max: number; currency: string };
    baseMonthlyRevenueRange?: { min: number; max: number; currency: string };
    upsideMonthlyRevenueRange?: { min: number; max: number; currency: string };
    estimatedScenarioRoiRange?: { baseRoi: number; currency: string };
    totalPortfolioCost?: number;
  };

  topExposureActions: SeoImpactEstimate[];
  topUpsideActions: SeoImpactEstimate[];
  nonQuantifiableHighValueActions: SeoImpactEstimate[];
}

export interface ForecastSnapshot {
  snapshotId: string;
  projectId: string;
  capturedAt: string;
  modelVersion: string;
  policyVersion: string;
  calibrationVersion: string;
  businessDataState: BusinessDataState;
  costState: ImplementationCostState;
  totalActionsCount: number;
  portfolioSummary: PortfolioForecastSummary;
  estimates: SeoImpactEstimate[];
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface SeoImpactReport {
  generatedAt: string;
  projectId: string;
  modelVersion: string;
  policyVersion: string;
  calibrationVersion: string;
  businessDataState: BusinessDataState;
  costState: ImplementationCostState;
  portfolioSummary: PortfolioForecastSummary;
  actionEstimates: SeoImpactEstimate[];
  governanceLimitations: string[];
  immutabilityStatement: string;
}
