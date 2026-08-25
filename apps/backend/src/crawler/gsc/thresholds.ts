/**
 * Centralized Thresholds and Policy Guards for Google Search Console Intelligence.
 * Prevents noisy alerts on negligible traffic volumes and sets heuristic opportunity discovery ranges.
 */

export const GSC_POLICY_THRESHOLDS = {
  // Volume Safeguards for Page Declines
  PAGE_DECLINE: {
    minPreviousImpressions: 50, // Must have >= 50 impressions in previous period
    minPreviousClicks: 5, // Must have >= 5 clicks in previous period
    materialClickDropPercent: 25.0, // >= 25% click loss
    materialImpressionDropPercent: 30.0, // >= 30% impression loss
    materialPositionDrop: 3.0, // Drop of >= 3 ranking positions
    minPeriodDays: 14, // Periods with < 14 days are considered incomplete / inconclusive
  },

  // Volume Safeguards for Query Declines
  QUERY_DECLINE: {
    minPreviousImpressions: 30,
    minPreviousClicks: 3,
    materialClickDropPercent: 30.0,
    materialPositionDrop: 4.0,
    minPeriodDays: 14,
  },

  // Heuristic CTR Opportunity Benchmark Ranges (Advisory heuristic only)
  CTR_OPPORTUNITY_BENCHMARK: {
    minImpressions: 100,
    top3PositionMax: 3.5,
    top3BenchmarkCtr: 0.10, // ~10% heuristic benchmark for top 3
    positions4to10Max: 10.0,
    positions4to10BenchmarkCtr: 0.03, // ~3% heuristic benchmark for positions 4-10
    strikingDistanceMax: 20.0,
    strikingDistanceBenchmarkCtr: 0.015, // ~1.5% heuristic benchmark for positions 11-20
  },

  // Ranking Opportunity Ranges
  RANKING_OPPORTUNITY: {
    nearPageOne: {
      minPosition: 4.0,
      maxPosition: 10.0,
      minImpressions: 50,
    },
    strikingDistance: {
      minPosition: 10.1,
      maxPosition: 20.0,
      minImpressions: 100,
    },
  },

  // Search Priority Mapping Thresholds
  SEARCH_PRIORITY: {
    urgentBusinessImpressionThreshold: 20000,
    urgentBusinessClickThreshold: 1000,
    highImpressionThreshold: 2000,
    highClickThreshold: 100,
    mediumImpressionThreshold: 200,
    mediumClickThreshold: 10,
  },
} as const;

/**
 * Heuristic CTR Opportunity Benchmark Curve by average position.
 * NOTE: This is an advisory heuristic benchmark, NOT an official Google mandate.
 * Actual CTR varies widely based on brand intent, rich snippets, featured snippets,
 * local map packs, device type, query intent, and industry.
 */
export function getHeuristicCtrBenchmark(position: number): number {
  if (position <= 1.5) return 0.28; // ~28% benchmark for position 1
  if (position <= 2.5) return 0.15; // ~15% benchmark for position 2
  if (position <= 3.5) return 0.10; // ~10% benchmark for position 3
  if (position <= 5.0) return 0.06; // ~6% benchmark for positions 4-5
  if (position <= 10.0) return 0.025; // ~2.5% benchmark for positions 6-10
  if (position <= 20.0) return 0.012; // ~1.2% benchmark for page 2
  return 0.005;
}
