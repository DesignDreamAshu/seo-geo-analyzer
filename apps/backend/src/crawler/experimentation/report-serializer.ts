/**
 * Phase 22: Hardened User-Visible Experiment & Causal Learning Report Serializer.
 * Generates structured Markdown experiment briefs, DiD outcome matrices, and learning summaries.
 */

import { ExperimentEvaluation, ProjectTreatmentLibraryEntry } from "./types";

export interface ExperimentReportInput {
  evaluation: ExperimentEvaluation;
  treatmentLibrary?: ProjectTreatmentLibraryEntry[];
  governanceLimitations?: string[];
}

export function serializeExperimentReportMarkdown(input: ExperimentReportInput): string {
  const ev = input.evaluation;
  const lines: string[] = [];

  lines.push("# SEO EXPERIMENTATION & CAUSAL LEARNING REPORT");
  lines.push(`**Experiment Name:** ${ev.experimentName}`);
  lines.push(`**Experiment ID:** \`${ev.experimentId}\` | **Project ID:** \`${ev.projectId}\``);
  lines.push(`**Experiment Type:** \`${ev.experimentType}\` | **Status:** \`${ev.status}\``);
  lines.push(`**Policy Used:** \`${ev.policyUsed}\` (Policy Version: \`${ev.policyVersion}\`) | **Model Version:** \`${ev.modelVersion}\``);
  lines.push(`**Evaluated At:** ${ev.evaluatedAt}`);
  lines.push("");

  lines.push("## 1. HYPOTHESIS, TREATMENT & ADHERENCE");
  lines.push(`- **Structured Hypothesis:** ${ev.hypothesis}`);
  lines.push(`- **Hypothesis Locked:** ${ev.isHypothesisLocked ? "YES (Pre-registration Locked)" : "NO"}`);
  lines.push(`- **Treatment Adherence:** \`${ev.treatmentDefinition.adherenceStatus}\``);
  lines.push(`- **SERP Exposure Status:** \`${ev.treatmentDefinition.serpExposureStatus}\``);
  lines.push(`- **Primary Metric:** \`${ev.primaryMetric}\` (Locked: ${ev.isPrimaryMetricLocked ? "YES" : "NO"})`);
  lines.push(`- **Secondary Metrics:** ${ev.secondaryMetrics.length > 0 ? ev.secondaryMetrics.join(", ") : "None"}`);
  lines.push(`- **Guardrail Metrics:** ${ev.guardrailMetrics.length > 0 ? ev.guardrailMetrics.join(", ") : "None"}`);
  lines.push(`- **Observation Window:** ${ev.observationWindowDays} days (${ev.observationWindowPolicy})`);
  lines.push("");

  lines.push("## 2. COHORT ALLOCATION, BALANCE & PRE-TRENDS");
  lines.push(`- **Treatment Cohort Size:** ${ev.treatmentCohort.length} URLs`);
  lines.push(`- **Control Cohort Size:** ${ev.controlCohort.length} URLs`);
  lines.push(`- **Control Quality Grade:** \`${ev.controlQuality}\``);
  if (ev.controlBalanceReport) {
    lines.push(`- **Baseline Metric Balance:** \`${ev.controlBalanceReport.baselineMetricBalance}\` (Matched Ratio: ${ev.controlBalanceReport.matchedRatio * 100}%)`);
  }
  lines.push(`- **Pre-Period Baseline:** ${ev.prePeriod.prePeriodDays} days (${ev.prePeriod.prePeriodStart} to ${ev.prePeriod.prePeriodEnd})`);
  lines.push(`- **Parallel Pre-Trends Status:** \`${ev.prePeriod.preTrendStatus}\``);
  if (ev.prePeriod.preTrendSlopeDifferencePercent !== undefined) {
    lines.push(`- **Pre-Trend Slope Divergence:** ${ev.prePeriod.preTrendSlopeDifferencePercent}%`);
  }
  lines.push("");

  lines.push("## 3. DIFFERENCE-IN-DIFFERENCES OUTCOME MATRIX");
  lines.push("| Metric | Treatment (Pre → Post) | Control (Pre → Post) | Control-Adjusted Effect | Uncertainty Range / Interval | Evidence Quality |");
  lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");

  const pm = ev.primaryMetricResult;
  lines.push(
    `| **${pm.metric} (Primary)** | ${pm.treatmentPre} → ${pm.treatmentPost} (${pm.treatmentRelativeChangePercent >= 0 ? "+" : ""}${pm.treatmentRelativeChangePercent}%) | ${pm.controlPre} → ${pm.controlPost} (${pm.controlRelativeChangePercent >= 0 ? "+" : ""}${pm.controlRelativeChangePercent}%) | **${pm.controlAdjustedAbsoluteChange >= 0 ? "+" : ""}${pm.controlAdjustedAbsoluteChange} pts (${pm.controlAdjustedRelativeChangePercent >= 0 ? "+" : ""}${pm.controlAdjustedRelativeChangePercent}% rel)** | [${pm.uncertaintyInterval.lowerBound}, ${pm.uncertaintyInterval.upperBound}] (${pm.uncertaintyType}) | \`${ev.evidenceQuality}\` |`
  );

  for (const sec of ev.secondaryMetricResults) {
    lines.push(
      `| ${sec.metric} | ${sec.treatmentPre} → ${sec.treatmentPost} (${sec.treatmentRelativeChangePercent >= 0 ? "+" : ""}${sec.treatmentRelativeChangePercent}%) | ${sec.controlPre} → ${sec.controlPost} (${sec.controlRelativeChangePercent >= 0 ? "+" : ""}${sec.controlRelativeChangePercent}%) | ${sec.controlAdjustedAbsoluteChange >= 0 ? "+" : ""}${sec.controlAdjustedAbsoluteChange} pts (${sec.controlAdjustedRelativeChangePercent >= 0 ? "+" : ""}${sec.controlAdjustedRelativeChangePercent}% rel) | [${sec.uncertaintyInterval.lowerBound}, ${sec.uncertaintyInterval.upperBound}] | \`${ev.evidenceQuality}\` |`
    );
  }
  lines.push("");
  lines.push(`*Statistical Method:* ${pm.statisticalMethod}`);
  lines.push("");

  lines.push("## 4. CONFOUNDER AUDIT & CAUSAL EVIDENCE");
  lines.push(`- **Evidence Quality Grade:** \`${ev.evidenceQuality}\``);
  lines.push(`- **Causal Language Level:** \`${ev.causalLanguageLevel}\``);
  lines.push(`- **Outcome Classification:** \`${ev.outcomeClassification}\``);
  lines.push(`- **Practical Significance:** ${ev.practicalSignificanceAssessment}`);
  lines.push(`- **Transferability Scope:** \`${ev.transferabilityScope}\``);

  if (ev.confoundersDetected.length > 0) {
    lines.push("\n### Confounders & Biases Identified:");
    for (const c of ev.confoundersDetected) {
      lines.push(`- **[${c.severity}] ${c.confounderType}:** ${c.description} *(Impact: ${c.impactOnCausalConfidence})*`);
    }
  } else {
    lines.push("- **Confounders:** No major SERP, algorithm, migration, or indexation confounders detected.");
  }
  lines.push("");

  lines.push("## 5. EXPERIMENT DECISION & ROLLOUT GUIDANCE");
  lines.push(`- **Recommended Decision:** \`${ev.recommendedDecision}\``);
  lines.push(`- **Risk Classification:** \`${ev.riskLevel}\``);
  if (ev.controlOpportunityCostAssessment) {
    lines.push(`- **Control Opportunity Cost:** ${ev.controlOpportunityCostAssessment}`);
  }
  if (ev.isSafetyStopTriggered) {
    lines.push(`- **SAFETY STOP TRIGGERED:** ${ev.safetyStopReason}`);
  }
  if (ev.rolloutSafetyConsiderations.length > 0) {
    lines.push("\n### Rollout Safety Guidance:");
    for (const r of ev.rolloutSafetyConsiderations) {
      lines.push(`- ${r}`);
    }
  }
  lines.push("");

  if (input.treatmentLibrary && input.treatmentLibrary.length > 0) {
    lines.push("## 6. PROJECT-LOCAL TREATMENT LEARNING");
    lines.push("| Treatment | Count | Positive | Negative | Neutral | Replication Status | Scope | Avg Effect |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const lib of input.treatmentLibrary) {
      lines.push(
        `| ${lib.treatmentName} | ${lib.totalExperimentsCount} | ${lib.positiveOutcomesCount} | ${lib.negativeOutcomesCount} | ${lib.neutralOutcomesCount} | \`${lib.replicationStatus}\` | \`${lib.transferabilityScope}\` | ${lib.averageControlAdjustedEffectPercent >= 0 ? "+" : ""}${lib.averageControlAdjustedEffectPercent}% (${lib.averageControlAdjustedAbsoluteEffect >= 0 ? "+" : ""}${lib.averageControlAdjustedAbsoluteEffect} pts) |`
      );
    }
    lines.push("");
  }

  lines.push("## 7. GOVERNANCE & METHODOLOGICAL LIMITATIONS");
  const limitations = input.governanceLimitations || [
    "Observational SEO testing does not constitute randomized laboratory-grade causal proof.",
    "Difference-in-differences adjusts for macro search demand and seasonality across cohorts but cannot isolate unknown private search algorithm updates.",
    "Positive findings in this project-local cohort must not be assumed as universal SEO truths for other websites or domains.",
    "One experiment outcome does not automatically warrant universal 100% site-wide template rollout without ongoing monitoring.",
  ];
  for (const lim of limitations) {
    lines.push(`- ${lim}`);
  }

  return lines.join("\n");
}
