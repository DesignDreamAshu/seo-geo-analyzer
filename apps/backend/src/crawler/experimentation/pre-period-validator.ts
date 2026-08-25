/**
 * Phase 22: Hardened Pre-Period & Parallel Trend Validator.
 * Evaluates multi-period trajectory consistency, baseline level differences, and volatility.
 */

import { PrePeriodValidation, PreTrendStatus } from "./types";
import { DEFAULT_EXPERIMENTATION_POLICY } from "./config";

export interface PrePeriodValidationInput {
  prePeriodStart: string;
  prePeriodEnd: string;
  treatmentPreTrendSlope?: number; // e.g. weekly growth rate %
  controlPreTrendSlope?: number;   // e.g. weekly growth rate %
  treatmentMultiPeriodSlopes?: number[];
  controlMultiPeriodSlopes?: number[];
  treatmentBaselineLevel?: number;
  controlBaselineLevel?: number;
  isGscDataComplete?: boolean;
  hasActiveMigrationInPrePeriod?: boolean;
  hasSiteOutageInPrePeriod?: boolean;
  hasMajorAlgorithmUpdateInPrePeriod?: boolean;
  hasMajorMarketingCampaignInPrePeriod?: boolean;
  maxSlopeDivergencePercent?: number;
  policyName?: string;
}

export function validatePrePeriod(input: PrePeriodValidationInput): PrePeriodValidation {
  const anomaliesDetected: string[] = [];
  const policyUsed = input.policyName || DEFAULT_EXPERIMENTATION_POLICY.policyName;
  const maxDivergence = input.maxSlopeDivergencePercent ?? DEFAULT_EXPERIMENTATION_POLICY.contextualThresholds.mediumTraffic.maxPreTrendSlopeDivergencePercent;

  const startDate = new Date(input.prePeriodStart);
  const endDate = new Date(input.prePeriodEnd);
  const prePeriodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  if (input.isGscDataComplete === false) {
    anomaliesDetected.push("Incomplete Search Console dataset during pre-period.");
  }
  if (input.hasSiteOutageInPrePeriod) {
    anomaliesDetected.push("Site outage or technical downtime detected during pre-period.");
  }
  if (input.hasActiveMigrationInPrePeriod) {
    anomaliesDetected.push("Domain or URL migration active during pre-period baseline.");
  }
  if (input.hasMajorAlgorithmUpdateInPrePeriod) {
    anomaliesDetected.push("Google core algorithm update overlapped pre-period baseline.");
  }
  if (input.hasMajorMarketingCampaignInPrePeriod) {
    anomaliesDetected.push("Paid marketing or offline brand campaign active during pre-period baseline.");
  }

  let preTrendStatus: PreTrendStatus = "PARALLEL_TRENDS_STRONG";
  let preTrendSlopeDifferencePercent: number | undefined;
  let preTrendMultiPeriodDirectionConsistent = true;

  if (input.treatmentPreTrendSlope !== undefined && input.controlPreTrendSlope !== undefined) {
    preTrendSlopeDifferencePercent = parseFloat(
      Math.abs(input.treatmentPreTrendSlope - input.controlPreTrendSlope).toFixed(2)
    );

    // Multi-period consistency check
    if (input.treatmentMultiPeriodSlopes && input.controlMultiPeriodSlopes) {
      for (let i = 0; i < Math.min(input.treatmentMultiPeriodSlopes.length, input.controlMultiPeriodSlopes.length); i++) {
        const tSign = Math.sign(input.treatmentMultiPeriodSlopes[i]);
        const cSign = Math.sign(input.controlMultiPeriodSlopes[i]);
        if (tSign !== 0 && cSign !== 0 && tSign !== cSign) {
          preTrendMultiPeriodDirectionConsistent = false;
          break;
        }
      }
    }

    if (preTrendSlopeDifferencePercent > maxDivergence) {
      preTrendStatus = "PRE_TREND_MISMATCH";
      anomaliesDetected.push(
        `Pre-trend trajectories diverged by ${preTrendSlopeDifferencePercent}% (threshold: ${maxDivergence}%). Violates parallel trends assumption.`
      );
    } else if (preTrendSlopeDifferencePercent <= 5.0 && preTrendMultiPeriodDirectionConsistent) {
      preTrendStatus = "PARALLEL_TRENDS_STRONG";
    } else if (preTrendSlopeDifferencePercent <= 15.0) {
      preTrendStatus = "PARALLEL_TRENDS_ACCEPTABLE";
    } else {
      preTrendStatus = "PARALLEL_TRENDS_WEAK";
    }
  } else {
    preTrendStatus = "INSUFFICIENT_PRE_TREND_DATA";
  }

  // Baseline level imbalance calculation
  let baselineLevelDifferencePercent: number | undefined;
  if (input.treatmentBaselineLevel !== undefined && input.controlBaselineLevel !== undefined && input.treatmentBaselineLevel > 0) {
    baselineLevelDifferencePercent = parseFloat(
      (Math.abs(input.treatmentBaselineLevel - input.controlBaselineLevel) / input.treatmentBaselineLevel * 100).toFixed(2)
    );
  }

  const isValidForExperiment =
    (input.isGscDataComplete !== false) &&
    !input.hasSiteOutageInPrePeriod &&
    !input.hasActiveMigrationInPrePeriod &&
    preTrendStatus !== "PRE_TREND_MISMATCH";

  const reason = !isValidForExperiment
    ? `Pre-period validation failed due to: ${anomaliesDetected.join("; ")}`
    : `Pre-period baseline satisfies parallel trend requirements (${preTrendStatus}, slope diff: ${preTrendSlopeDifferencePercent ?? 0}%).`;

  return {
    prePeriodStart: input.prePeriodStart,
    prePeriodEnd: input.prePeriodEnd,
    prePeriodDays,
    isDataComplete: input.isGscDataComplete !== false,
    preTrendStatus,
    preTrendSlopeDifferencePercent,
    preTrendMultiPeriodDirectionConsistent,
    baselineLevelDifferencePercent,
    anomaliesDetected,
    isValidForExperiment,
    policyUsed,
    reason,
  };
}
