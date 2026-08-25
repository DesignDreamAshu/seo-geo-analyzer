/**
 * Conditional Multi-Stage Business Value & Generalized ROI Engine.
 * Converts traffic scenario ranges to revenue and profit ranges using configurable funnels and flexible cost models.
 */

import {
  BusinessEconomicsConfig,
  BusinessDataState,
  ImplementationCostState,
  ImpactScenarioRange,
} from "./types";

export interface CalculatedBusinessScenarios {
  businessDataState: BusinessDataState;
  costState: ImplementationCostState;
  conservativeMonthlyRevenue?: { min: number; max: number; currency: string };
  baseMonthlyRevenue?: { min: number; max: number; currency: string };
  upsideMonthlyRevenue?: { min: number; max: number; currency: string };
  conservativeMonthlyProfit?: { min: number; max: number; currency: string };
  baseMonthlyProfit?: { min: number; max: number; currency: string };
  upsideMonthlyProfit?: { min: number; max: number; currency: string };
  estimatedScenarioRoi?: number; // Annual Base Revenue Uplift / Total Cost
  estimatedScenarioProfitRoi?: number; // Annual Base Profit Uplift / Total Cost
  totalImplementationCost?: number;
  assumptionsDisclosure: string[];
}

export function computeBusinessScenarios(
  scenarios: { conservative: ImpactScenarioRange; base: ImpactScenarioRange; upside: ImpactScenarioRange } | undefined,
  config?: BusinessEconomicsConfig
): CalculatedBusinessScenarios {
  const assumptions: string[] = [];

  if (!config || !config.funnel || !config.funnel.averageOrderValueOrLtv) {
    return {
      businessDataState: "NO_BUSINESS_DATA",
      costState: "NO_IMPLEMENTATION_COST",
      assumptionsDisclosure: ["No business economics or customer value configured."],
    };
  }

  const funnel = config.funnel;
  const currency = funnel.currency || "USD";

  // 1. Calculate Effective Conversion Multiplier Across Funnel Stages
  let effectiveConversionRate = 1.0;
  if (funnel.stage1ConversionRatePercent !== undefined) {
    effectiveConversionRate *= funnel.stage1ConversionRatePercent / 100;
    assumptions.push(`Stage 1 Conversion (${funnel.funnelType}): ${funnel.stage1ConversionRatePercent}%`);
  }
  if (funnel.stage2ConversionRatePercent !== undefined) {
    effectiveConversionRate *= funnel.stage2ConversionRatePercent / 100;
    assumptions.push(`Stage 2 Conversion: ${funnel.stage2ConversionRatePercent}%`);
  }
  if (funnel.stage3ConversionRatePercent !== undefined) {
    effectiveConversionRate *= funnel.stage3ConversionRatePercent / 100;
    assumptions.push(`Stage 3 Conversion: ${funnel.stage3ConversionRatePercent}%`);
  }

  const valuePerOutcome = funnel.averageOrderValueOrLtv;
  assumptions.push(`Average Value / LTV per Customer: ${currency} ${valuePerOutcome.toLocaleString()}`);

  const effectiveValuePerClick = effectiveConversionRate * valuePerOutcome;

  // 2. Gross Margin (Profit vs Revenue distinction)
  const marginMultiplier = funnel.grossMarginPercent ? funnel.grossMarginPercent / 100 : 1.0;
  if (funnel.grossMarginPercent !== undefined) {
    assumptions.push(`Gross Margin: ${funnel.grossMarginPercent}%`);
  }

  if (!scenarios) {
    return {
      businessDataState: "BUSINESS_DATA_AVAILABLE",
      costState: "NO_IMPLEMENTATION_COST",
      assumptionsDisclosure: assumptions,
    };
  }

  // 3. Revenue Scenarios
  const conservativeRev = {
    min: Math.round(scenarios.conservative.minMonthlyClicks * effectiveValuePerClick),
    max: Math.round(scenarios.conservative.maxMonthlyClicks * effectiveValuePerClick),
    currency,
  };

  const baseRev = {
    min: Math.round(scenarios.base.minMonthlyClicks * effectiveValuePerClick),
    max: Math.round(scenarios.base.maxMonthlyClicks * effectiveValuePerClick),
    currency,
  };

  const upsideRev = {
    min: Math.round(scenarios.upside.minMonthlyClicks * effectiveValuePerClick),
    max: Math.round(scenarios.upside.maxMonthlyClicks * effectiveValuePerClick),
    currency,
  };

  // 4. Generalized Implementation Cost Aggregation
  let totalCost = 0;
  let hasCost = false;
  let isCostPartial = false;

  if (config.costs) {
    const c = config.costs;
    if (c.customImplementationCost !== undefined) {
      totalCost += c.customImplementationCost;
      hasCost = true;
      assumptions.push(`Custom Implementation Cost: ${currency} ${c.customImplementationCost}`);
    }
    if (c.developerCost !== undefined) {
      totalCost += c.developerCost;
      hasCost = true;
      assumptions.push(`Developer Cost: ${currency} ${c.developerCost}`);
    }
    if (c.contentCost !== undefined) {
      totalCost += c.contentCost;
      hasCost = true;
      assumptions.push(`Content Cost: ${currency} ${c.contentCost}`);
    }
    if (c.designCost !== undefined) {
      totalCost += c.designCost;
      hasCost = true;
      assumptions.push(`Design Cost: ${currency} ${c.designCost}`);
    }
    if (c.SEOConsultingCost !== undefined) {
      totalCost += c.SEOConsultingCost;
      hasCost = true;
      assumptions.push(`SEO Consulting Cost: ${currency} ${c.SEOConsultingCost}`);
    }
    if (c.fixedVendorCost !== undefined) {
      totalCost += c.fixedVendorCost;
      hasCost = true;
      assumptions.push(`Fixed Vendor Cost: ${currency} ${c.fixedVendorCost}`);
    }
    if (c.internalHourlyCost !== undefined && c.estimatedHours !== undefined) {
      const hourlyTotal = c.internalHourlyCost * c.estimatedHours;
      totalCost += hourlyTotal;
      hasCost = true;
      assumptions.push(`Hourly Cost (${c.estimatedHours} hrs @ ${currency} ${c.internalHourlyCost}/hr): ${currency} ${hourlyTotal}`);
    }
  }

  const costState: ImplementationCostState = hasCost
    ? isCostPartial
      ? "PARTIAL_IMPLEMENTATION_COST"
      : "IMPLEMENTATION_COST_AVAILABLE"
    : "NO_IMPLEMENTATION_COST";

  let scenarioRoi: number | undefined;
  let scenarioProfitRoi: number | undefined;

  if (hasCost && totalCost > 0) {
    const annualBaseRev = baseRev.max * 12;
    scenarioRoi = Math.round((annualBaseRev / totalCost) * 10) / 10;
    assumptions.push(`Estimated Scenario Revenue ROI: ${scenarioRoi}x (Annual Base Max Revenue ${currency} ${annualBaseRev.toLocaleString()} / Total Cost ${currency} ${totalCost.toLocaleString()})`);

    if (funnel.grossMarginPercent !== undefined) {
      const annualBaseProfit = annualBaseRev * marginMultiplier;
      scenarioProfitRoi = Math.round((annualBaseProfit / totalCost) * 10) / 10;
      assumptions.push(`Estimated Scenario Profit ROI: ${scenarioProfitRoi}x (Annual Base Profit ${currency} ${annualBaseProfit.toLocaleString()} / Total Cost ${currency} ${totalCost.toLocaleString()})`);
    }
  }

  return {
    businessDataState: "BUSINESS_DATA_AVAILABLE",
    costState,
    conservativeMonthlyRevenue: conservativeRev,
    baseMonthlyRevenue: baseRev,
    upsideMonthlyRevenue: upsideRev,
    conservativeMonthlyProfit: funnel.grossMarginPercent !== undefined ? { min: Math.round(conservativeRev.min * marginMultiplier), max: Math.round(conservativeRev.max * marginMultiplier), currency } : undefined,
    baseMonthlyProfit: funnel.grossMarginPercent !== undefined ? { min: Math.round(baseRev.min * marginMultiplier), max: Math.round(baseRev.max * marginMultiplier), currency } : undefined,
    upsideMonthlyProfit: funnel.grossMarginPercent !== undefined ? { min: Math.round(upsideRev.min * marginMultiplier), max: Math.round(upsideRev.max * marginMultiplier), currency } : undefined,
    estimatedScenarioRoi: scenarioRoi,
    estimatedScenarioProfitRoi: scenarioProfitRoi,
    totalImplementationCost: hasCost ? totalCost : undefined,
    assumptionsDisclosure: assumptions,
  };
}
