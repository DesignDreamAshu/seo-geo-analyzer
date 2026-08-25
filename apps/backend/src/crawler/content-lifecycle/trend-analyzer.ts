/**
 * Multi-Window Performance Trend & Statistical Query Coverage Shift Analyzer.
 * Enforces variance safety, contextual query loss thresholds, and multi-period trend shapes.
 */

import {
  HistoricalPerformanceSummary,
  QueryClusterCoverageShift,
  TrendShape,
  LifecycleSignal,
} from "./types";
import { ContentLifecyclePolicy, DEFAULT_CONTENT_LIFECYCLE_POLICY } from "./config";

export interface TrendAnalysisResult {
  trendShape: TrendShape;
  clickChangePercent: number;
  impressionChangePercent: number;
  ctrChangePercent: number;
  positionChange: number;
  signals: LifecycleSignal[];
  queryShifts: QueryClusterCoverageShift[];
  isMaterialDecline: boolean;
  confidenceAdjustment: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_EVIDENCE";
}

export function analyzePerformanceTrends(params: {
  recent: HistoricalPerformanceSummary;
  baseline?: HistoricalPerformanceSummary;
  historicalIntervalMonthlyClicks?: number[];
  queryClusterBaselineImpressions?: Record<string, number>;
  queryClusterCurrentImpressions?: Record<string, number>;
  queryClusterLabels?: Record<string, string>;
  queryClusterBaselinePositions?: Record<string, number>;
  queryClusterCurrentPositions?: Record<string, number>;
  policy?: ContentLifecyclePolicy;
}): TrendAnalysisResult {
  const policy = params.policy || DEFAULT_CONTENT_LIFECYCLE_POLICY;
  const signals: LifecycleSignal[] = [];
  const queryShifts: QueryClusterCoverageShift[] = [];

  if (!params.baseline) {
    return {
      trendShape: "INCONCLUSIVE_TREND",
      clickChangePercent: 0,
      impressionChangePercent: 0,
      ctrChangePercent: 0,
      positionChange: 0,
      signals: [{ signalType: "CLICK_DECLINE", description: "No historical baseline available for trend comparison.", severity: "INFO" }],
      queryShifts: [],
      isMaterialDecline: false,
      confidenceAdjustment: "INSUFFICIENT_EVIDENCE",
    };
  }

  const baseClicks = params.baseline.monthlyClicks;
  const currentClicks = params.recent.monthlyClicks;
  const clickChangePercent = baseClicks > 0 ? Math.round(((currentClicks - baseClicks) / baseClicks) * 100) : 0;

  const baseImp = params.baseline.monthlyImpressions;
  const currentImp = params.recent.monthlyImpressions;
  const impressionChangePercent = baseImp > 0 ? Math.round(((currentImp - baseImp) / baseImp) * 100) : 0;

  const baseCtr = Math.max(0.01, params.baseline.averageCtr);
  const currentCtr = params.recent.averageCtr;
  const ctrChangePercent = Math.round(((currentCtr - baseCtr) / baseCtr) * 100);

  const basePos = params.baseline.averagePosition || 0;
  const currentPos = params.recent.averagePosition || 0;
  const positionChange = basePos > 0 && currentPos > 0 ? Number((currentPos - basePos).toFixed(1)) : 0;

  // 1. Statistical Volume & Variance Safety Evaluation
  let confidenceAdjustment: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_EVIDENCE" = "HIGH";
  let isMaterialDecline = false;

  const isLowVolumeSample = baseClicks < policy.minMonthlyClicksForEvaluation && baseImp < policy.minMonthlyImpressionsForEvaluation;
  const isHighVolumeSample = baseImp >= policy.materialVolumeThresholdImpressions || baseClicks >= 200;
  const isHighVariance = (params.baseline.historicalVarianceScore || 0) > 0.4 || (params.recent.historicalVarianceScore || 0) > 0.4;

  if (isLowVolumeSample) {
    confidenceAdjustment = "INSUFFICIENT_EVIDENCE";
    signals.push({
      signalType: "CLICK_DECLINE",
      description: `Observed traffic (${baseClicks} clicks, ${baseImp} imp) is below statistical significance threshold. Percentage changes are suppressed to prevent false decay diagnosis.`,
      severity: "INFO",
    });
  } else if (isHighVariance) {
    confidenceAdjustment = "LOW";
    signals.push({
      signalType: "VARIANCE_HIGH",
      description: "High historical variance/volatility detected across observation periods. Trend confidence is reduced.",
      severity: "WARNING",
    });
  } else if (isHighVolumeSample) {
    confidenceAdjustment = "HIGH";
    // At high volume, even 15-20% drop represents substantial material search loss
    if (clickChangePercent <= -15 || impressionChangePercent <= -20) {
      isMaterialDecline = true;
    }
  }

  if (clickChangePercent <= -25 && !isLowVolumeSample) {
    isMaterialDecline = true;
  }

  // 2. Identify Trend Shape
  let trendShape: TrendShape = "STABLE_PLATEAU";

  if (params.historicalIntervalMonthlyClicks && params.historicalIntervalMonthlyClicks.length >= 3) {
    const intervals = params.historicalIntervalMonthlyClicks;
    const maxDropInSingleInterval = Math.max(
      ...intervals.slice(1).map((val, idx) => (intervals[idx] - val) / Math.max(1, intervals[idx]))
    );

    if (maxDropInSingleInterval >= 0.75) {
      trendShape = "SUDDEN_CLIFF";
      signals.push({
        signalType: "CLICK_DECLINE",
        description: `Sudden traffic cliff detected (${Math.round(maxDropInSingleInterval * 100)}% drop in a single period). Suggests technical or indexation cause.`,
        severity: "CRITICAL",
        detectedValue: `${Math.round(maxDropInSingleInterval * 100)}% drop`,
      });
    } else if (clickChangePercent <= -20) {
      let isProgressive = true;
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i] > intervals[i - 1] * 1.1) {
          isProgressive = false;
          break;
        }
      }
      trendShape = isProgressive ? "GRADUAL_DECLINE" : "INTERMITTENT_VOLATILITY";
    } else if (clickChangePercent >= 20) {
      trendShape = "SUSTAINED_GROWTH";
    }
  } else {
    if (clickChangePercent <= -60 && !isLowVolumeSample) {
      trendShape = "SUDDEN_CLIFF";
    } else if (clickChangePercent <= -20 && !isLowVolumeSample) {
      trendShape = "GRADUAL_DECLINE";
    } else if (clickChangePercent >= 20 && !isLowVolumeSample) {
      trendShape = "SUSTAINED_GROWTH";
    } else if (isLowVolumeSample) {
      trendShape = "INCONCLUSIVE_TREND";
    }
  }

  // 3. Structured Signals
  if (isMaterialDecline && clickChangePercent <= -20) {
    signals.push({
      signalType: "CLICK_DECLINE",
      description: `Observed monthly clicks declined by ${Math.abs(clickChangePercent)}% (${baseClicks} → ${currentClicks}).`,
      severity: isHighVolumeSample ? "CRITICAL" : "WARNING",
      detectedValue: `${currentClicks}`,
      baselineValue: `${baseClicks}`,
    });
  }

  if (isMaterialDecline && impressionChangePercent <= -25) {
    signals.push({
      signalType: "IMPRESSION_DECLINE",
      description: `Observed monthly impressions declined by ${Math.abs(impressionChangePercent)}% (${baseImp} → ${currentImp}).`,
      severity: "WARNING",
      detectedValue: `${currentImp}`,
      baselineValue: `${baseImp}`,
    });
  }

  // 4. Contextual Query Cluster Coverage Shifts (Preventing 2 imp -> 0 false positives)
  if (params.queryClusterBaselineImpressions && params.queryClusterCurrentImpressions) {
    const baseKeys = Object.keys(params.queryClusterBaselineImpressions);
    const currKeys = Object.keys(params.queryClusterCurrentImpressions);
    const allKeys = Array.from(new Set([...baseKeys, ...currKeys]));

    for (const k of allKeys) {
      const bImp = params.queryClusterBaselineImpressions[k] || 0;
      const cImp = params.queryClusterCurrentImpressions[k] || 0;
      const label = params.queryClusterLabels?.[k] || k;
      const bPos = params.queryClusterBaselinePositions?.[k];
      const cPos = params.queryClusterCurrentPositions?.[k];

      const isStatisticallyMeaningful = bImp >= policy.minImpressionsForStatisticallyMeaningfulQueryCluster || cImp >= policy.minImpressionsForStatisticallyMeaningfulQueryCluster;
      const magnitudeDifference = cImp - bImp;

      let shiftState: QueryClusterCoverageShift["shiftState"] = "RETAINED";
      if (isStatisticallyMeaningful) {
        if (bImp >= policy.minImpressionsForStatisticallyMeaningfulQueryCluster && cImp === 0) {
          shiftState = "LOST";
        } else if (bImp >= policy.minImpressionsForStatisticallyMeaningfulQueryCluster && cImp < bImp * 0.5) {
          shiftState = "WEAKENED";
        } else if (bImp === 0 && cImp >= policy.minImpressionsForStatisticallyMeaningfulQueryCluster) {
          shiftState = "NEW";
        }
      } else {
        // Low volume query shifts are suppressed from becoming impactful LOST states
        shiftState = "RETAINED";
      }

      queryShifts.push({
        clusterId: k,
        clusterLabel: label,
        shiftState,
        baselineImpressions: bImp,
        currentImpressions: cImp,
        baselinePosition: bPos,
        currentPosition: cPos,
        isStatisticallyMeaningful,
        magnitudeDifference,
      });
    }

    const meaningfulLostCount = queryShifts.filter((q) => q.shiftState === "LOST" && q.isStatisticallyMeaningful).length;
    if (meaningfulLostCount >= policy.minLostQueryClustersForCoverageDecay) {
      signals.push({
        signalType: "LOST_QUERY_CLUSTERS",
        description: `Page lost search visibility across ${meaningfulLostCount} statistically meaningful query clusters.`,
        severity: "WARNING",
        detectedValue: `${meaningfulLostCount} clusters lost`,
      });
    }
  }

  return {
    trendShape,
    clickChangePercent,
    impressionChangePercent,
    ctrChangePercent,
    positionChange,
    signals,
    queryShifts,
    isMaterialDecline,
    confidenceAdjustment,
  };
}
