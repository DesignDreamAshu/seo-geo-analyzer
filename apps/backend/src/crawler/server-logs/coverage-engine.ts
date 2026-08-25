/**
 * Important Page Coverage & Crawl Budget Materiality Engine.
 * Evaluates coverage of business-critical URLs and calculates site-scale budget materiality without exaggeration.
 */

import {
  UrlCrawlMetrics,
  CrawlBudgetMateriality,
  LogDatasetCompleteness,
} from "./types";
import { DEFAULT_LOG_POLICY, LogIntelligencePolicy } from "./config";

export function evaluateImportantPageCoverage(
  metricsMap: Map<string, UrlCrawlMetrics>,
  completeness: LogDatasetCompleteness
): {
  totalImportantPages: number;
  observedImportantPagesCount: number;
  unobservedImportantPagesCount: number;
  coveragePercentage: number;
  unobservedImportantPages: Array<{
    url: string;
    pageType?: string;
    importanceReasons: string[];
    possibleReasons: string[];
  }>;
} {
  const importantPages: UrlCrawlMetrics[] = [];
  for (const m of metricsMap.values()) {
    if (m.isImportant) importantPages.push(m);
  }

  const total = importantPages.length;
  if (total === 0) {
    return {
      totalImportantPages: 0,
      observedImportantPagesCount: 0,
      unobservedImportantPagesCount: 0,
      coveragePercentage: 100,
      unobservedImportantPages: [],
    };
  }

  const unobserved: Array<{
    url: string;
    pageType?: string;
    importanceReasons: string[];
    possibleReasons: string[];
  }> = [];

  let observedCount = 0;

  for (const p of importantPages) {
    if (p.verifiedGooglebotRequests > 0 || p.verifiedBotRequests > 0) {
      observedCount++;
    } else {
      const possibleReasons: string[] = [];
      if (completeness === "PARTIAL") {
        possibleReasons.push("Dataset reflects a partial date window; observation is inconclusive.");
      } else if (completeness === "INVALID") {
        possibleReasons.push("Dataset is marked invalid due to parse failures.");
      } else {
        possibleReasons.push("Not observed in analyzed log period (verify internal linking depth, canonical consistency, and sitemap inclusion).");
      }

      unobserved.push({
        url: p.url,
        pageType: p.pageType,
        importanceReasons: p.importanceReasons,
        possibleReasons,
      });
    }
  }

  const coveragePercentage = Math.round((observedCount / total) * 100);

  return {
    totalImportantPages: total,
    observedImportantPagesCount: observedCount,
    unobservedImportantPagesCount: unobserved.length,
    coveragePercentage,
    unobservedImportantPages: unobserved,
  };
}

export function evaluateCrawlBudgetMateriality(params: {
  totalKnownUrls: number;
  totalObservedRequests: number;
  facetVariantCount?: number;
  completeness: LogDatasetCompleteness;
  policy?: LogIntelligencePolicy;
}): { materiality: CrawlBudgetMateriality; policySelected: string; rationale: string } {
  const policy = params.policy || DEFAULT_LOG_POLICY;
  const matPolicy = policy.materialityPolicy;

  if (params.completeness === "INVALID" || params.completeness === "UNKNOWN") {
    return {
      materiality: "INSUFFICIENT_EVIDENCE",
      policySelected: matPolicy.policyName,
      rationale: "Log dataset is incomplete or invalid. Crawl budget materiality cannot be established.",
    };
  }

  if (
    params.totalKnownUrls >= matPolicy.largeCatalogUrlThreshold ||
    (params.facetVariantCount && params.facetVariantCount >= matPolicy.largeFacetExpansionThreshold)
  ) {
    return {
      materiality: "HIGH",
      policySelected: matPolicy.policyName,
      rationale: `Site has large architectural scale (${params.totalKnownUrls.toLocaleString()} known URLs or large parameter space). Search bot crawl efficiency is strategically important.`,
    };
  }

  if (
    params.totalKnownUrls >= matPolicy.moderateCatalogUrlThreshold ||
    (params.facetVariantCount && params.facetVariantCount >= matPolicy.moderateFacetExpansionThreshold)
  ) {
    return {
      materiality: "MODERATE",
      policySelected: matPolicy.policyName,
      rationale: "Site has moderate catalog scale with active parameter spaces.",
    };
  }

  return {
    materiality: "LOW",
    policySelected: matPolicy.policyName,
    rationale: `Site has compact scale (${params.totalKnownUrls} URLs). Search engines can easily crawl indexable inventory without crawl budget constraints.`,
  };
}
