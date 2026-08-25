/**
 * Centralized, Configurable Monitoring Thresholds and Policies.
 * Replaces all magic numbers with explicit, tunable configuration.
 */

export interface MonitoringConfig {
  // Comparability Thresholds
  comparability: {
    minTraversalRatioForFullComparison: number; // default 0.70
    minTraversalRatioForPartialComparison: number; // default 0.30
    maxAllowedFetchFailureRatio: number; // default 0.15
  };

  // Content Loss Thresholds
  contentLoss: {
    proportionalReductionThreshold: number; // e.g. 0.70 (70% drop)
    minPreviousWordCount: number; // e.g. 250 words
    maxCurrentWordCount: number; // e.g. 80 words
  };

  // Performance (Core Web Vitals) Thresholds
  performance: {
    lcpMaterialDeltaMs: number; // e.g. 500ms
    clsMaterialDelta: number; // e.g. 0.05
    inpMaterialDeltaMs: number; // e.g. 100ms
  };

  // Systemic Regression Grouping
  systemic: {
    minGroupSizeForSystemic: number; // default 3 pages in same route family
  };

  // Change Burst Detection
  changeBurst: {
    burstFindingThreshold: number; // default 25 findings
  };
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  comparability: {
    minTraversalRatioForFullComparison: 0.70,
    minTraversalRatioForPartialComparison: 0.30,
    maxAllowedFetchFailureRatio: 0.15,
  },
  contentLoss: {
    proportionalReductionThreshold: 0.70,
    minPreviousWordCount: 250,
    maxCurrentWordCount: 80,
  },
  performance: {
    lcpMaterialDeltaMs: 500,
    clsMaterialDelta: 0.05,
    inpMaterialDeltaMs: 100,
  },
  systemic: {
    minGroupSizeForSystemic: 3,
  },
  changeBurst: {
    burstFindingThreshold: 25,
  },
};
