/**
 * Technical Issue x GSC Search Prioritization Engine
 * Marries deterministic technical severity with real-world Google search visibility.
 * IMPORTANT: Technical severity and SEO health scoring remain 100% UNTOUCHED.
 */

import { DiagnosticIssue } from "../types";
import { PageGscMetrics, SearchPriorityAssessment, SearchPriorityLevel } from "./types";
import { GSC_POLICY_THRESHOLDS } from "./thresholds";

export interface PrioritizationResult {
  prioritizedIssues: Array<{
    issue: DiagnosticIssue;
    searchPriority: SearchPriorityLevel;
    priorityRationale: string;
    totalOrganicImpressions: number;
    totalOrganicClicks: number;
    highestTrafficUrl?: string;
    affectedPagesWithGsc: Array<{
      url: string;
      impressions: number;
      clicks: number;
      position: number;
    }>;
  }>;
  systemicGroupPriorities: Array<{
    groupId: string;
    ruleCode: string;
    affectedCount: number;
    deduplicatedImpressions: number;
    deduplicatedClicks: number;
    searchPriority: SearchPriorityLevel;
    explanation: string;
  }>;
}

export function prioritizeTechnicalIssuesWithGsc(
  issues: DiagnosticIssue[],
  pagesGscMetrics: PageGscMetrics[]
): PrioritizationResult {
  // Build lookup map from crawl URL (and normalized URL) to GSC Metrics
  const gscByCrawlUrl = new Map<string, PageGscMetrics>();
  for (const p of pagesGscMetrics) {
    if (p.matchedCrawlUrl) {
      gscByCrawlUrl.set(p.matchedCrawlUrl, p);
    }
    gscByCrawlUrl.set(p.normalizedGscUrl, p);
    gscByCrawlUrl.set(p.gscUrl, p);
  }

  const prioritizedIssues: PrioritizationResult["prioritizedIssues"] = [];

  for (const issue of issues) {
    let totalImpressions = 0;
    let totalClicks = 0;
    let highestTrafficUrl: string | undefined;
    let highestUrlImpressions = 0;

    const affectedPagesWithGsc: Array<{
      url: string;
      impressions: number;
      clicks: number;
      position: number;
    }> = [];

    // Aggregate deduplicated search visibility across affected pages
    for (const aff of issue.affectedPages) {
      const gsc = gscByCrawlUrl.get(aff.url);
      if (gsc) {
        const imps = gsc.currentPeriod.impressions;
        const clks = gsc.currentPeriod.clicks;
        totalImpressions += imps;
        totalClicks += clks;

        if (imps > highestUrlImpressions) {
          highestUrlImpressions = imps;
          highestTrafficUrl = aff.url;
        }

        affectedPagesWithGsc.push({
          url: aff.url,
          impressions: imps,
          clicks: clks,
          position: gsc.currentPeriod.averagePosition,
        });
      }
    }

    // Determine Search Priority (orthogonal to technical severity)
    let searchPriority: SearchPriorityLevel = "INFORMATIONAL";
    let priorityRationale = "";

    const isSystemic = Boolean(issue.isSystemicTemplateIssue || issue.affectedPages.length >= 3);
    const hasActiveDecline = affectedPagesWithGsc.some((aff) => {
      const gsc = gscByCrawlUrl.get(aff.url);
      return Boolean(gsc?.isDeclining);
    });

    const isUrgent =
      (totalImpressions >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.urgentBusinessImpressionThreshold ||
        totalClicks >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.urgentBusinessClickThreshold) &&
      (hasActiveDecline || issue.severity === "critical");

    if (isUrgent) {
      searchPriority = "URGENT_BUSINESS_PRIORITY";
      priorityRationale = `URGENT: High-traffic URLs commanding ${(totalImpressions / 1000).toFixed(1)}k impressions are actively experiencing traffic decline or critical indexability defects.`;
    } else if (
      totalImpressions >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.urgentBusinessImpressionThreshold ||
      totalClicks >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.urgentBusinessClickThreshold
    ) {
      searchPriority = "VERY_HIGH_SEARCH_PRIORITY";
      priorityRationale = `Affects high-traffic URLs commanding ${(totalImpressions / 1000).toFixed(1)}k impressions and ${totalClicks} organic clicks in the evaluated period.`;
    } else if (
      totalImpressions >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.highImpressionThreshold ||
      totalClicks >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.highClickThreshold
    ) {
      searchPriority = "HIGH_SEARCH_PRIORITY";
      priorityRationale = `Affects search-visible URLs with ${totalImpressions.toLocaleString()} impressions and ${totalClicks} clicks.`;
    } else if (
      totalImpressions >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.mediumImpressionThreshold ||
      totalClicks >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.mediumClickThreshold
    ) {
      searchPriority = "MEDIUM_SEARCH_PRIORITY";
      priorityRationale = `Affects moderate-traffic URLs with ${totalImpressions.toLocaleString()} impressions.`;
    } else if (totalImpressions > 0 || totalClicks > 0) {
      searchPriority = "LOW_SEARCH_PRIORITY";
      priorityRationale = `Affects low-visibility URLs (${totalImpressions} impressions).`;
    } else {
      searchPriority = "INFORMATIONAL";
      priorityRationale = "No search traffic recorded on affected URLs during the evaluated period.";
    }

    if (isSystemic && (totalImpressions > 0 || totalClicks > 0)) {
      priorityRationale += ` Confirmed systemic issue affecting ${issue.affectedPages.length} URLs that can be resolved via a single shared template edit.`;
    }

    prioritizedIssues.push({
      issue,
      searchPriority,
      priorityRationale,
      totalOrganicImpressions: totalImpressions,
      totalOrganicClicks: totalClicks,
      highestTrafficUrl,
      affectedPagesWithGsc: affectedPagesWithGsc.sort((a, b) => b.impressions - a.impressions),
    });
  }

  // Systemic Root Cause Traffic Aggregation (Zero Double-Counting)
  const systemicGroupMap = new Map<
    string,
    {
      ruleCode: string;
      urls: Set<string>;
    }
  >();

  for (const issue of issues) {
    if (issue.isSystemicTemplateIssue || issue.affectedPages.length >= 3) {
      const gId = issue.groupId || issue.code;
      if (!systemicGroupMap.has(gId)) {
        systemicGroupMap.set(gId, { ruleCode: issue.code, urls: new Set() });
      }
      for (const aff of issue.affectedPages) {
        systemicGroupMap.get(gId)!.urls.add(aff.url);
      }
    }
  }

  const systemicGroupPriorities: PrioritizationResult["systemicGroupPriorities"] = [];

  for (const [groupId, data] of systemicGroupMap.entries()) {
    let groupImpressions = 0;
    let groupClicks = 0;

    // Mathematical deduplication across unique URLs in the systemic group
    for (const u of data.urls) {
      const gsc = gscByCrawlUrl.get(u);
      if (gsc) {
        groupImpressions += gsc.currentPeriod.impressions;
        groupClicks += gsc.currentPeriod.clicks;
      }
    }

    let searchPriority: SearchPriorityLevel = "MEDIUM_SEARCH_PRIORITY";
    if (groupImpressions >= 20000 || groupClicks >= 1000) {
      searchPriority = "VERY_HIGH_SEARCH_PRIORITY";
    } else if (groupImpressions >= 2000 || groupClicks >= 100) {
      searchPriority = "HIGH_SEARCH_PRIORITY";
    }

    systemicGroupPriorities.push({
      groupId,
      ruleCode: data.ruleCode,
      affectedCount: data.urls.size,
      deduplicatedImpressions: groupImpressions,
      deduplicatedClicks: groupClicks,
      searchPriority,
      explanation: `Systemic template fix for ${data.ruleCode} resolves ${data.urls.size} affected URLs commanding ${groupImpressions.toLocaleString()} combined organic impressions and ${groupClicks.toLocaleString()} clicks via ~1 edit.`,
    });
  }

  return {
    prioritizedIssues: prioritizedIssues.sort((a, b) => b.totalOrganicImpressions - a.totalOrganicImpressions),
    systemicGroupPriorities: systemicGroupPriorities.sort((a, b) => b.deduplicatedImpressions - a.deduplicatedImpressions),
  };
}
