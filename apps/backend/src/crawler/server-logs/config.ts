/**
 * Phase 18: Server Log Intelligence Configuration & Contextual Policy Profiles.
 * Eliminates universal hardcoded thresholds in favor of explainable, contextual policies.
 */

import { QueryParameterCategory } from "./types";

export interface CrawlFrequencyPolicy {
  policyName: string;
  minDatasetDays: number;
  frequentActivityPercentage: number;
  periodicActivityPercentage: number;
  minRequestsForPeriodic: number;
}

export interface CrawlBudgetMaterialityPolicy {
  policyName: string;
  largeCatalogUrlThreshold: number;
  moderateCatalogUrlThreshold: number;
  largeFacetExpansionThreshold: number;
  moderateFacetExpansionThreshold: number;
}

export interface ServerErrorBurstPolicy {
  policyName: string;
  minErrorCountForBurst: number;
  maxWindowMinutes: number;
  minAffectedUrlsCount: number;
}

export interface LogIntelligencePolicy {
  policyName: string;
  frequencyPolicy: CrawlFrequencyPolicy;
  materialityPolicy: CrawlBudgetMaterialityPolicy;
  burstPolicy: ServerErrorBurstPolicy;
  elevatedLatencyThresholdMs: number;
}

export const DEFAULT_LOG_POLICY: LogIntelligencePolicy = {
  policyName: "DEFAULT_CONTEXTUAL_LOG_POLICY",
  frequencyPolicy: {
    policyName: "STANDARD_FREQUENCY_POLICY",
    minDatasetDays: 7,
    frequentActivityPercentage: 0.7,
    periodicActivityPercentage: 0.3,
    minRequestsForPeriodic: 3,
  },
  materialityPolicy: {
    policyName: "STANDARD_MATERIALITY_POLICY",
    largeCatalogUrlThreshold: 10000,
    moderateCatalogUrlThreshold: 1000,
    largeFacetExpansionThreshold: 5000,
    moderateFacetExpansionThreshold: 500,
  },
  burstPolicy: {
    policyName: "STANDARD_BURST_POLICY",
    minErrorCountForBurst: 5,
    maxWindowMinutes: 15,
    minAffectedUrlsCount: 1,
  },
  elevatedLatencyThresholdMs: 1500,
};

export const SENSITIVE_PARAMETER_PATTERNS = [
  "token",
  "auth",
  "password",
  "secret",
  "key",
  "api_key",
  "session",
  "sessionid",
  "jwt",
  "card",
  "cvv",
  "email",
  "phone",
];

export const PARAMETER_CLASSIFICATION_RULES: Array<{
  pattern: RegExp;
  category: QueryParameterCategory;
}> = [
  { pattern: /^utm_|^gclid|^fbclid|^msclkid|^dclid|^ref$/i, category: "TRACKING" },
  { pattern: /^sort|^order|^dir|^by$/i, category: "SORTING" },
  { pattern: /^filter|^price|^brand|^color|^size|^cat$/i, category: "FILTERING" },
  { pattern: /^page|^p|^pg|^offset|^start$/i, category: "PAGINATION" },
  { pattern: /^q|^search|^query|^keyword|^term$/i, category: "SEARCH" },
  { pattern: /^session|^sid|^phpsessid|^jsessionid$/i, category: "SESSION" },
  { pattern: /^f_|^facet_|^attr_/i, category: "FACETING" },
  { pattern: /^id|^slug|^view|^mode|^lang|^locale$/i, category: "FUNCTIONAL" },
];
