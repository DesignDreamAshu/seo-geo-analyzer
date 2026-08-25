/**
 * Official Google Core Web Vitals & Performance Thresholds
 * Central policy module for all 75th-percentile field and lab metric evaluations.
 */

import { CoreWebVitalsRating, MetricThresholds } from "./types";

export const CWV_THRESHOLDS = {
  // Field Metrics (75th percentile)
  LCP: {
    goodMax: 2500, // <= 2.5s is GOOD
    needsImprovementMax: 4000, // <= 4.0s is NEEDS_IMPROVEMENT, > 4.0s is POOR
  } as MetricThresholds,

  INP: {
    goodMax: 200, // <= 200ms is GOOD
    needsImprovementMax: 500, // <= 500ms is NEEDS_IMPROVEMENT, > 500ms is POOR
  } as MetricThresholds,

  CLS: {
    goodMax: 0.10, // <= 0.10 is GOOD
    needsImprovementMax: 0.25, // <= 0.25 is NEEDS_IMPROVEMENT, > 0.25 is POOR
  } as MetricThresholds,

  FCP: {
    goodMax: 1800, // <= 1.8s
    needsImprovementMax: 3000, // <= 3.0s
  } as MetricThresholds,

  TTFB: {
    goodMax: 800, // <= 800ms
    needsImprovementMax: 1800, // <= 1.8s
  } as MetricThresholds,

  // Lab Metrics
  TBT: {
    goodMax: 200, // <= 200ms
    needsImprovementMax: 600, // <= 600ms
  } as MetricThresholds,

  SPEED_INDEX: {
    goodMax: 3400, // <= 3.4s
    needsImprovementMax: 5800, // <= 5.8s
  } as MetricThresholds,

  DOM_SIZE: {
    goodMax: 800,
    needsImprovementMax: 1400,
  } as MetricThresholds,

  HTML_PAYLOAD_BYTES: {
    goodMax: 100 * 1024, // 100KB
    needsImprovementMax: 200 * 1024, // 200KB
  } as MetricThresholds,
} as const;

/**
 * Evaluates a numeric metric value against standard Good / Needs Improvement / Poor thresholds.
 */
export function evaluateRating(value: number | undefined | null, thresholds: MetricThresholds): CoreWebVitalsRating | undefined {
  if (value === undefined || value === null || isNaN(value)) {
    return undefined;
  }
  if (value <= thresholds.goodMax) {
    return "GOOD";
  }
  if (value <= thresholds.needsImprovementMax) {
    return "NEEDS_IMPROVEMENT";
  }
  return "POOR";
}

export function evaluateLcp(lcpMs?: number | null): CoreWebVitalsRating | undefined {
  return evaluateRating(lcpMs, CWV_THRESHOLDS.LCP);
}

export function evaluateInp(inpMs?: number | null): CoreWebVitalsRating | undefined {
  return evaluateRating(inpMs, CWV_THRESHOLDS.INP);
}

export function evaluateCls(cls?: number | null): CoreWebVitalsRating | undefined {
  return evaluateRating(cls, CWV_THRESHOLDS.CLS);
}

export function evaluateFcp(fcpMs?: number | null): CoreWebVitalsRating | undefined {
  return evaluateRating(fcpMs, CWV_THRESHOLDS.FCP);
}

export function evaluateTtfb(ttfbMs?: number | null): CoreWebVitalsRating | undefined {
  return evaluateRating(ttfbMs, CWV_THRESHOLDS.TTFB);
}

export function evaluateTbt(tbtMs?: number | null): CoreWebVitalsRating | undefined {
  return evaluateRating(tbtMs, CWV_THRESHOLDS.TBT);
}

export function evaluateOverallFieldStatus(lcp?: CoreWebVitalsRating, inp?: CoreWebVitalsRating, cls?: CoreWebVitalsRating): CoreWebVitalsRating | undefined {
  const ratings = [lcp, inp, cls].filter(Boolean) as CoreWebVitalsRating[];
  if (ratings.length === 0) return undefined;
  if (ratings.includes("POOR")) return "POOR";
  if (ratings.includes("NEEDS_IMPROVEMENT")) return "NEEDS_IMPROVEMENT";
  return "GOOD";
}
