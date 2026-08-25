/**
 * Phase 21: Content Lifecycle Centralized Policies & Threshold Configurations.
 * Centralizes all thresholds, page-type policies, equity weights, freshness rules, and measurement windows.
 * Removes universal hardcoded SEO decay assumptions.
 */

import { FreshnessSensitivity } from "./types";

export interface PageTypeLifecyclePolicy {
  pageType: string;
  defaultFreshnessSensitivity: FreshnessSensitivity;
  decayMinTrafficDropPercent: number;
  decayMinPersistenceDays: number;
  maxAcceptableCtrDropPercent: number;
  allowAutonomousConsolidation: boolean;
  requiresManualReviewForRetirement: boolean;
  measurementWindowDays: number;
  measurementWindowReason: string;
}

export interface PrimaryUrlEquityWeights {
  clicksWeight: number;
  impressionsWeight: number;
  referringDomainsWeight: number;
  internalInlinksWeight: number;
  indexationBonus: number;
  canonicalStabilityBonus: number;
  businessImportanceMultiplier: number;
  contentCompletenessMultiplier: number;
  urlRelevanceBonus: number;
}

export interface ContentLifecyclePolicy {
  policyVersion: string;
  modelVersion: string;
  policyName: string;
  policySource: string;

  // Scale & Volume Thresholds
  minMonthlyImpressionsForEvaluation: number;
  minMonthlyClicksForEvaluation: number;
  minImpressionsForStatisticallyMeaningfulQueryCluster: number;
  minImpressionsForCtrDecayEvaluation: number;
  maxPositionVarianceForCtrDecay: number;
  minLostQueryClustersForCoverageDecay: number;

  // Variance & Scale Policies
  highVarianceVolatilityDiscount: number; // Discounter for confidence when variance > 0.4
  materialVolumeThresholdImpressions: number; // E.g., 20% drop on 50k is material

  // Equity weights versioning
  primaryUrlEquityWeights: PrimaryUrlEquityWeights;

  pageTypePolicies: Record<string, PageTypeLifecyclePolicy>;
}

export const DEFAULT_PRIMARY_URL_EQUITY_WEIGHTS: PrimaryUrlEquityWeights = {
  clicksWeight: 2.0,
  impressionsWeight: 0.1,
  referringDomainsWeight: 50.0,
  internalInlinksWeight: 10.0,
  indexationBonus: 100.0,
  canonicalStabilityBonus: 50.0,
  businessImportanceMultiplier: 25.0,
  contentCompletenessMultiplier: 0.05,
  urlRelevanceBonus: 30.0,
};

export const DEFAULT_PAGE_TYPE_POLICIES: Record<string, PageTypeLifecyclePolicy> = {
  blog: {
    pageType: "blog",
    defaultFreshnessSensitivity: "MODERATE_FRESHNESS_SENSITIVITY",
    decayMinTrafficDropPercent: 30,
    decayMinPersistenceDays: 60,
    maxAcceptableCtrDropPercent: 25,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 30,
    measurementWindowReason: "Standard content cadence with monthly crawl and ranking normalization",
  },
  service_page: {
    pageType: "service_page",
    defaultFreshnessSensitivity: "LOW_FRESHNESS_SENSITIVITY",
    decayMinTrafficDropPercent: 25,
    decayMinPersistenceDays: 45,
    maxAcceptableCtrDropPercent: 20,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 45,
    measurementWindowReason: "Commercial landing pages require extended observation for lead and ranking stability",
  },
  product: {
    pageType: "product",
    defaultFreshnessSensitivity: "HIGH_FRESHNESS_SENSITIVITY",
    decayMinTrafficDropPercent: 35,
    decayMinPersistenceDays: 30,
    maxAcceptableCtrDropPercent: 25,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 14,
    measurementWindowReason: "Fast-moving inventory and ecommerce product indexing require rapid verification",
  },
  documentation: {
    pageType: "documentation",
    defaultFreshnessSensitivity: "HIGH_FRESHNESS_SENSITIVITY",
    decayMinTrafficDropPercent: 25,
    decayMinPersistenceDays: 30,
    maxAcceptableCtrDropPercent: 20,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 30,
    measurementWindowReason: "Developer docs require verification across API query clusters and usage patterns",
  },
  evergreen_guide: {
    pageType: "evergreen_guide",
    defaultFreshnessSensitivity: "EVERGREEN",
    decayMinTrafficDropPercent: 30,
    decayMinPersistenceDays: 90,
    maxAcceptableCtrDropPercent: 20,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 60,
    measurementWindowReason: "Evergreen foundational definitions fluctuate slowly and require 60-day baseline comparability",
  },
  location_page: {
    pageType: "location_page",
    defaultFreshnessSensitivity: "LOW_FRESHNESS_SENSITIVITY",
    decayMinTrafficDropPercent: 30,
    decayMinPersistenceDays: 60,
    maxAcceptableCtrDropPercent: 25,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 45,
    measurementWindowReason: "Local pack and geo-proximity signals fluctuate based on local query demand cycles",
  },
  news: {
    pageType: "news",
    defaultFreshnessSensitivity: "HIGH_FRESHNESS_SENSITIVITY",
    decayMinTrafficDropPercent: 50,
    decayMinPersistenceDays: 14,
    maxAcceptableCtrDropPercent: 30,
    allowAutonomousConsolidation: false,
    requiresManualReviewForRetirement: true,
    measurementWindowDays: 7,
    measurementWindowReason: "News and timely commentary require high-frequency daily/weekly measurement",
  },
};

export const DEFAULT_CONTENT_LIFECYCLE_POLICY: ContentLifecyclePolicy = {
  policyVersion: "1.0.0",
  modelVersion: "1.0.0",
  policyName: "Default Context-Aware Lifecycle Policy",
  policySource: "SYSTEM_PRODUCTION_BASELINE_V1",
  minMonthlyImpressionsForEvaluation: 100,
  minMonthlyClicksForEvaluation: 5,
  minImpressionsForStatisticallyMeaningfulQueryCluster: 30,
  minImpressionsForCtrDecayEvaluation: 300,
  maxPositionVarianceForCtrDecay: 1.5,
  minLostQueryClustersForCoverageDecay: 2,
  highVarianceVolatilityDiscount: 0.5,
  materialVolumeThresholdImpressions: 10000,
  primaryUrlEquityWeights: DEFAULT_PRIMARY_URL_EQUITY_WEIGHTS,
  pageTypePolicies: DEFAULT_PAGE_TYPE_POLICIES,
};
