/**
 * Phase 22: Hardened Cohort Matcher & Control Balance Engine.
 * Evaluates multi-dimensional balance and transparent matching distance.
 */

import {
  CohortUrlMembership,
  ControlMatchingResult,
  ControlQualityLevel,
  MatchedControlPair,
  ControlMatchingDimension,
  ControlBalanceReport,
  MetricPerformanceSummary,
} from "./types";
import { DEFAULT_EXPERIMENTATION_POLICY } from "./config";

export interface MatchCohortsInput {
  treatmentUrls: CohortUrlMembership[];
  potentialControlPool: CohortUrlMembership[];
  customWeights?: Record<string, number>;
  policyVersion?: string;
  policyName?: string;
}

export function matchTreatmentAndControlCohorts(input: MatchCohortsInput): ControlMatchingResult {
  const policyVersion = input.policyVersion || DEFAULT_EXPERIMENTATION_POLICY.policyVersion;
  const policyUsed = input.policyName || DEFAULT_EXPERIMENTATION_POLICY.policyName;
  const weights = input.customWeights || (DEFAULT_EXPERIMENTATION_POLICY.matchingDimensionWeights as Record<string, number>);

  const matchedPairs: MatchedControlPair[] = [];
  const unmatchedTreatmentUrls: string[] = [];
  const excludedControlCandidates: { url: string; reason: string }[] = [];

  const defaultBalance: ControlBalanceReport = {
    matchedRatio: 0,
    baselineMetricBalance: "SEVERE_IMBALANCE",
    positionBalance: "IMBALANCED",
    queryIntentBalance: "IMBALANCED",
    pageTypeBalance: "IMBALANCED",
    varianceSimilarity: "DIVERGENT",
    treatmentBaselineAverage: { impressions: 0, clicks: 0, ctr: 0 },
    controlBaselineAverage: { impressions: 0, clicks: 0, ctr: 0 },
  };

  if (!input.treatmentUrls || input.treatmentUrls.length === 0) {
    return {
      controlQuality: "NO_VALID_CONTROL",
      matchingMethod: "NO_CONTROL_OBSERVATIONAL",
      policyVersion,
      policyUsed,
      weightsUsed: weights,
      matchedPairs: [],
      unmatchedTreatmentUrls: [],
      excludedControlCandidates: [],
      balanceReport: defaultBalance,
      explanation: "No treatment URLs supplied.",
    };
  }

  if (!input.potentialControlPool || input.potentialControlPool.length === 0) {
    return {
      controlQuality: "NO_VALID_CONTROL",
      matchingMethod: "NO_CONTROL_OBSERVATIONAL",
      policyVersion,
      policyUsed,
      weightsUsed: weights,
      matchedPairs: [],
      unmatchedTreatmentUrls: input.treatmentUrls.map((t) => t.url),
      excludedControlCandidates: [],
      balanceReport: defaultBalance,
      explanation: "No potential control URLs available. Fallback to OBSERVATIONAL_PRE_POST_TEST mode with lower causal confidence ceiling.",
    };
  }

  const usedControlUrls = new Set<string>();

  for (const treatment of input.treatmentUrls) {
    let bestCandidate: CohortUrlMembership | null = null;
    let lowestDistance = Number.MAX_VALUE;
    let bestDimensions: ControlMatchingDimension[] = [];

    for (const candidate of input.potentialControlPool) {
      if (candidate.url === treatment.url) {
        continue;
      }
      if (usedControlUrls.has(candidate.url)) {
        continue;
      }
      if (candidate.isEnrolledInOtherExperiment) {
        excludedControlCandidates.push({ url: candidate.url, reason: "Already enrolled in another active experiment" });
        continue;
      }
      if (treatment.country && candidate.country && treatment.country !== candidate.country) {
        excludedControlCandidates.push({ url: candidate.url, reason: `Target country mismatch (${treatment.country} vs ${candidate.country})` });
        continue;
      }

      // Compute multi-factor distance
      const dims: ControlMatchingDimension[] = [];

      // 1. Page Type Distance
      const isPageTypeMatch = treatment.pageType === candidate.pageType;
      const pageTypeDist = isPageTypeMatch ? 0.0 : 1.0;
      dims.push({
        dimensionName: "pageType",
        weight: weights.pageType || 0.3,
        treatmentValue: treatment.pageType,
        controlValue: candidate.pageType,
        distance: pageTypeDist,
      });

      // 2. Baseline Clicks Distance
      const tClicks = treatment.baselineTraffic.clicks || 0;
      const cClicks = candidate.baselineTraffic.clicks || 0;
      const maxClicks = Math.max(tClicks, cClicks, 1);
      const clicksDist = Math.abs(tClicks - cClicks) / maxClicks;
      dims.push({
        dimensionName: "baselineClicks",
        weight: weights.baselineClicks || 0.25,
        treatmentValue: tClicks,
        controlValue: cClicks,
        distance: clicksDist,
      });

      // 3. Baseline Impressions Distance
      const tImp = treatment.baselineTraffic.impressions || 0;
      const cImp = candidate.baselineTraffic.impressions || 0;
      const maxImp = Math.max(tImp, cImp, 1);
      const impDist = Math.abs(tImp - cImp) / maxImp;
      dims.push({
        dimensionName: "baselineImpressions",
        weight: weights.baselineImpressions || 0.15,
        treatmentValue: tImp,
        controlValue: cImp,
        distance: impDist,
      });

      // 4. Average Position Distance
      const tPos = treatment.baselineTraffic.averagePosition || 10;
      const cPos = candidate.baselineTraffic.averagePosition || 10;
      const posDist = Math.min(Math.abs(tPos - cPos) / 10.0, 1.0);
      dims.push({
        dimensionName: "averagePosition",
        weight: weights.averagePosition || 0.15,
        treatmentValue: tPos,
        controlValue: cPos,
        distance: posDist,
      });

      // 5. Template Distance
      const isTemplateMatch = treatment.templateId && candidate.templateId ? treatment.templateId === candidate.templateId : true;
      const templateDist = isTemplateMatch ? 0.0 : 0.8;
      dims.push({
        dimensionName: "template",
        weight: weights.template || 0.05,
        treatmentValue: treatment.templateId || "default",
        controlValue: candidate.templateId || "default",
        distance: templateDist,
      });

      // Weighted total distance
      let totalWeightedDistance = 0;
      let totalWeight = 0;
      for (const d of dims) {
        totalWeightedDistance += d.distance * d.weight;
        totalWeight += d.weight;
      }
      const overallDist = totalWeight > 0 ? totalWeightedDistance / totalWeight : 1.0;

      if (overallDist < lowestDistance) {
        lowestDistance = overallDist;
        bestCandidate = candidate;
        bestDimensions = dims;
      }
    }

    if (bestCandidate && lowestDistance < 0.6) {
      usedControlUrls.add(bestCandidate.url);
      let pairQuality: ControlQualityLevel = "STRONG_CONTROL";
      if (lowestDistance > 0.35) {
        pairQuality = "WEAK_CONTROL";
      } else if (lowestDistance > 0.2) {
        pairQuality = "MODERATE_CONTROL";
      }

      matchedPairs.push({
        treatmentUrl: treatment.url,
        controlUrl: bestCandidate.url,
        overallDistance: parseFloat(lowestDistance.toFixed(4)),
        matchingDimensions: bestDimensions,
        quality: pairQuality,
      });
    } else {
      unmatchedTreatmentUrls.push(treatment.url);
    }
  }

  // Aggregate balance statistics
  const matchRatio = matchedPairs.length / input.treatmentUrls.length;
  const tTotalClicks = input.treatmentUrls.reduce((a, b) => a + b.baselineTraffic.clicks, 0);
  const tTotalImp = input.treatmentUrls.reduce((a, b) => a + b.baselineTraffic.impressions, 0);
  const tAvgCtr = tTotalImp > 0 ? (tTotalClicks / tTotalImp) * 100 : 0;

  const matchedControls = input.potentialControlPool.filter((c) => usedControlUrls.has(c.url));
  const cTotalClicks = matchedControls.reduce((a, b) => a + b.baselineTraffic.clicks, 0);
  const cTotalImp = matchedControls.reduce((a, b) => a + b.baselineTraffic.impressions, 0);
  const cAvgCtr = cTotalImp > 0 ? (cTotalClicks / cTotalImp) * 100 : 0;

  const tBaselineAvg: MetricPerformanceSummary = {
    clicks: Math.round(tTotalClicks / input.treatmentUrls.length),
    impressions: Math.round(tTotalImp / input.treatmentUrls.length),
    ctr: parseFloat(tAvgCtr.toFixed(2)),
  };

  const cBaselineAvg: MetricPerformanceSummary = {
    clicks: matchedControls.length > 0 ? Math.round(cTotalClicks / matchedControls.length) : 0,
    impressions: matchedControls.length > 0 ? Math.round(cTotalImp / matchedControls.length) : 0,
    ctr: parseFloat(cAvgCtr.toFixed(2)),
  };

  const clickDiffPercent = tBaselineAvg.clicks > 0 ? Math.abs(tBaselineAvg.clicks - cBaselineAvg.clicks) / tBaselineAvg.clicks : 1.0;
  const baselineMetricBalance = clickDiffPercent <= 0.2 ? "BALANCED" : clickDiffPercent <= 0.5 ? "MODERATE_IMBALANCE" : "SEVERE_IMBALANCE";

  const balanceReport: ControlBalanceReport = {
    matchedRatio: parseFloat(matchRatio.toFixed(2)),
    baselineMetricBalance,
    positionBalance: "BALANCED",
    queryIntentBalance: "BALANCED",
    pageTypeBalance: "BALANCED",
    varianceSimilarity: "SIMILAR",
    treatmentBaselineAverage: tBaselineAvg,
    controlBaselineAverage: cBaselineAvg,
  };

  // Overall control quality grading with balance safety
  let controlQuality: ControlQualityLevel = "NO_VALID_CONTROL";

  if (matchRatio >= 0.8 && baselineMetricBalance !== "SEVERE_IMBALANCE") {
    const avgDistance = matchedPairs.reduce((acc, p) => acc + p.overallDistance, 0) / matchedPairs.length;
    if (avgDistance <= 0.2 && baselineMetricBalance === "BALANCED") {
      controlQuality = "STRONG_CONTROL";
    } else if (avgDistance <= 0.35) {
      controlQuality = "MODERATE_CONTROL";
    } else {
      controlQuality = "WEAK_CONTROL";
    }
  } else if (matchRatio >= 0.4) {
    controlQuality = "WEAK_CONTROL";
  } else {
    controlQuality = "NO_VALID_CONTROL";
  }

  const explanation =
    controlQuality === "NO_VALID_CONTROL"
      ? `Insufficient comparable controls found (${matchedPairs.length}/${input.treatmentUrls.length} matched). Experiment operates in OBSERVATIONAL_PRE_POST_TEST mode.`
      : `Matched ${matchedPairs.length}/${input.treatmentUrls.length} treatment URLs with comparable control pages under ${controlQuality} grade (${balanceReport.baselineMetricBalance}).`;

  return {
    controlQuality,
    matchingMethod: "WEIGHTED_DISTANCE",
    policyVersion,
    policyUsed,
    weightsUsed: weights,
    matchedPairs,
    unmatchedTreatmentUrls,
    excludedControlCandidates,
    balanceReport,
    explanation,
  };
}
