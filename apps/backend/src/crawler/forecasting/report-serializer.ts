/**
 * SEO Impact & Decision Intelligence Report Serializer.
 * Formats portfolio forecasts, observed exposure, and scenario ranges into an auditable 16-section Markdown report.
 * Strictly separates OBSERVED, ESTIMATED, CONDITIONAL SCENARIO, REALIZED, and ATTRIBUTION data.
 */

import { SeoImpactReport } from "./types";

export function serializeSeoImpactReportMarkdown(report: SeoImpactReport): string {
  const lines: string[] = [];

  lines.push("# 📈 SEO IMPACT & DECISION INTELLIGENCE REPORT\n");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Project:** \`${report.projectId}\``);
  lines.push(`**Model Version:** \`${report.modelVersion}\` | **Policy Version:** \`${report.policyVersion}\` | **Calibration Version:** \`${report.calibrationVersion}\``);
  lines.push(`**Business Economics State:** \`${report.businessDataState}\` | **Cost Model State:** \`${report.costState}\`\n`);
  lines.push("---\n");

  // 1. Evidence Quality & Baseline Context
  lines.push("## 1. 📊 Evidence Quality & Baseline Context\n");
  lines.push(`- **Total Actions Evaluated:** ${report.portfolioSummary.totalActionsEvaluated}`);
  lines.push(`- **Quantifiable Opportunities (Conditional Scenario Ranges):** ${report.portfolioSummary.quantifiableActionsCount}`);
  lines.push(`- **Non-Quantifiable Strategic Actions:** ${report.portfolioSummary.unquantifiedActionsCount}`);
  lines.push(`- **Total Observed Monthly Clicks Exposure [OBSERVED]:** ${report.portfolioSummary.totalObservedMonthlyClicksExposure.toLocaleString()} clicks/mo`);
  lines.push(`- **Total Observed Monthly Impressions Exposure [OBSERVED]:** ${report.portfolioSummary.totalObservedMonthlyImpressionsExposure.toLocaleString()} imp/mo\n`);

  // 2. Forecastability Overview
  lines.push("## 2. 🎯 Forecastability Overview\n");
  lines.push("| Action Title | Forecastability | Scenario Method | Baseline Type | Confidence | Quantified |");
  lines.push("|---|---|---|---|---|---|");
  for (const est of report.actionEstimates.slice(0, 10)) {
    lines.push(
      `| **${est.title}** | \`${est.forecastability}\` | \`${est.scenarioMethod}\` | \`${est.baselineType}\` | \`${est.confidence}\` | ${est.quantificationSupported ? "✅ Yes" : "❌ No"} |`
    );
  }
  lines.push("");

  // 3. Highest Observed Search Exposure
  lines.push("## 3. 🔍 Highest Observed Search Exposure [OBSERVED]\n");
  for (const est of report.portfolioSummary.topExposureActions.slice(0, 5)) {
    lines.push(`### 🔹 ${est.title}`);
    lines.push(`- **Historical Observed Exposure [OBSERVED]:** ${est.observedExposure.historicalMonthlyClicks} clicks/mo (${est.observedExposure.historicalMonthlyImpressions} imp/mo, CTR ${est.observedExposure.historicalAverageCtr}%)`);
    lines.push(`- **Affected URLs:** ${est.affectedUrls.length} pages | **Period:** ${est.observedExposure.evidencePeriodRange}`);
    lines.push(`- **Downside Risk:** \`${est.downsideRisk}\` | **Reversibility:** \`${est.reversibility}\``);
    if (est.observedExposure.baselineDistribution) {
      const d = est.observedExposure.baselineDistribution;
      lines.push(`- **Baseline Distribution:** Median: ${d.medianMonthlyClicks} clicks, p25: ${d.p25MonthlyClicks ?? "N/A"}, p75: ${d.p75MonthlyClicks ?? "N/A"}, Variance: ${d.dispersionVariance ?? "N/A"}`);
    }
    lines.push("");
  }

  // 4. Portfolio Scenario Forecasts
  lines.push("## 4. 🧮 Portfolio Scenario Forecasts [CONDITIONAL SCENARIOS]\n");
  lines.push("*Note: Portfolio ranges are de-duplicated across shared URL/cluster opportunity pools and sequence-discounted to prevent double-counting.*");
  lines.push("");
  lines.push(`- **Conservative Scenario (Low-Band Recovery/Uplift):** +${report.portfolioSummary.portfolioScenarios.conservativeMonthlyClicksRange.min} to +${report.portfolioSummary.portfolioScenarios.conservativeMonthlyClicksRange.max} clicks/mo`);
  lines.push(`- **Base Conditional Scenario (Cohort/Distribution Target):** +${report.portfolioSummary.portfolioScenarios.baseMonthlyClicksRange.min} to +${report.portfolioSummary.portfolioScenarios.baseMonthlyClicksRange.max} clicks/mo`);
  lines.push(`- **Upside Scenario (High Search Capture):** +${report.portfolioSummary.portfolioScenarios.upsideMonthlyClicksRange.min} to +${report.portfolioSummary.portfolioScenarios.upsideMonthlyClicksRange.max} clicks/mo\n`);

  // 5. Non-Quantifiable High-Value Actions
  if (report.portfolioSummary.nonQuantifiableHighValueActions.length > 0) {
    lines.push("## 5. 🛡️ Non-Quantifiable Strategic Actions\n");
    for (const nq of report.portfolioSummary.nonQuantifiableHighValueActions.slice(0, 5)) {
      lines.push(`- **${nq.title}** (\`${nq.forecastability}\`)`);
      lines.push(`  - *Why Unquantified:* ${nq.unquantifiedReason || "High strategic value with indirect search response"}`);
      lines.push(`  - *Observed Context [OBSERVED]:* ${nq.observedExposure.historicalMonthlyImpressions} impressions exposed across ${nq.affectedUrls.length} URLs`);
    }
    lines.push("");
  }

  // 6. Business Economics & Revenue Ranges
  if (report.businessDataState === "BUSINESS_DATA_AVAILABLE" && report.portfolioSummary.portfolioBusinessScenarios) {
    lines.push("## 6. 💼 Business Economics & Revenue Ranges [CONDITIONAL SCENARIOS]\n");
    const b = report.portfolioSummary.portfolioBusinessScenarios;
    if (b.baseMonthlyRevenueRange) {
      lines.push(`- **Estimated Base Monthly Revenue Uplift:** ${b.baseMonthlyRevenueRange.currency} ${b.baseMonthlyRevenueRange.min.toLocaleString()} – ${b.baseMonthlyRevenueRange.max.toLocaleString()}/mo`);
    }
    if (b.estimatedScenarioRoiRange) {
      lines.push(`- **Estimated Scenario ROI:** ${b.estimatedScenarioRoiRange.baseRoi}x`);
    }
    lines.push("");
  }

  // 7. Limitations & Governance Principles
  lines.push("## 7. ℹ️ Data Limitations & Governance Principles\n");
  for (const lim of report.governanceLimitations) {
    lines.push(`- ${lim}`);
  }
  lines.push("");
  lines.push(`**${report.immutabilityStatement}**`);

  return lines.join("\n");
}
