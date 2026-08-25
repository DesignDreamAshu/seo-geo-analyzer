/**
 * Performance Representative Sampling Engine & Template Intelligence
 * Selects representative pages per layout/template family and aggregates template performance.
 */

import { CrawledPageData } from "../types";
import { PagePerformanceFacts, TemplatePerformanceGroup } from "./types";

export interface SamplingStrategyConfig {
  mode: "PERFORMANCE_OFF" | "REPRESENTATIVE" | "FULL";
  maxSamplesPerTemplate?: number;
  maxTotalSamples?: number;
}

export function selectRepresentativeUrls(pages: CrawledPageData[], config?: SamplingStrategyConfig): string[] {
  const mode = config?.mode || "REPRESENTATIVE";
  if (mode === "PERFORMANCE_OFF") return [];

  const maxPerTemplate = config?.maxSamplesPerTemplate ?? 2;
  const maxTotal = config?.maxTotalSamples ?? 15;

  if (mode === "FULL") {
    return pages.filter((p) => p.isIndexable && p.statusCode === 200).map((p) => p.url).slice(0, maxTotal);
  }

  // Group pages by template / route classification
  const templateGroups = new Map<string, CrawledPageData[]>();

  for (const p of pages) {
    if (!p.isIndexable || p.statusCode !== 200) continue;

    const templateKey = p.classification?.primaryClass || "generic";
    if (!templateGroups.has(templateKey)) {
      templateGroups.set(templateKey, []);
    }
    templateGroups.get(templateKey)!.push(p);
  }

  const selectedUrls: string[] = [];

  // 1. Always prioritize Homepage
  const homepage = pages.find((p) => p.classification?.primaryClass === "homepage");
  if (homepage) {
    selectedUrls.push(homepage.url);
  }

  // 2. Select representatives from each template group
  for (const [key, groupPages] of templateGroups.entries()) {
    if (key === "homepage") continue;

    // Pick top pages by crawl depth / importance / html size
    const sorted = [...groupPages].sort((a, b) => (b.html ? b.html.length : 0) - (a.html ? a.html.length : 0));
    const picks = sorted.slice(0, maxPerTemplate).map((p) => p.url);

    for (const u of picks) {
      if (!selectedUrls.includes(u) && selectedUrls.length < maxTotal) {
        selectedUrls.push(u);
      }
    }
  }

  return selectedUrls;
}

/**
 * Aggregates individual PagePerformanceFacts into TemplatePerformanceGroup structures.
 */
export function aggregateTemplatePerformance(
  allPages: CrawledPageData[],
  perfFacts: PagePerformanceFacts[]
): TemplatePerformanceGroup[] {
  const templateMap = new Map<string, {
    pages: CrawledPageData[];
    facts: PagePerformanceFacts[];
  }>();

  for (const p of allPages) {
    const tClass = p.classification?.primaryClass || "static_page";
    if (!templateMap.has(tClass)) {
      templateMap.set(tClass, { pages: [], facts: [] });
    }
    templateMap.get(tClass)!.pages.push(p);

    const fact = perfFacts.find((f) => f.url === p.url || f.normalizedUrl === p.normalizedUrl);
    if (fact) {
      templateMap.get(tClass)!.facts.push(fact);
    }
  }

  const groups: TemplatePerformanceGroup[] = [];

  for (const [tId, data] of templateMap.entries()) {
    if (data.facts.length === 0) continue;

    const sampleCount = data.facts.length;
    let failingLcpCount = 0;
    let failingInpCount = 0;
    let failingClsCount = 0;
    let totalLabScore = 0;
    let totalLcpMs = 0;
    let validScores = 0;
    let validLcps = 0;
    let hasField = false;

    for (const f of data.facts) {
      const mob = f.mobile;
      if (mob) {
        if (mob.performanceScore !== undefined) {
          totalLabScore += mob.performanceScore;
          validScores++;
        }
        if (mob.lab.lcpMs !== undefined) {
          totalLcpMs += mob.lab.lcpMs;
          validLcps++;
        }
        if (mob.field.sampleAvailable) {
          hasField = true;
          if (mob.field.lcpP75Ms && mob.field.lcpP75Ms > 4000) failingLcpCount++;
          if (mob.field.inpP75Ms && mob.field.inpP75Ms > 500) failingInpCount++;
          if (mob.field.clsP75 && mob.field.clsP75 > 0.25) failingClsCount++;
        } else {
          // Fallback to lab failure count
          if (mob.lab.lcpMs && mob.lab.lcpMs > 4000) failingLcpCount++;
          if (mob.lab.cls && mob.lab.cls > 0.25) failingClsCount++;
        }
      }
    }

    const averageMobileLabScore = validScores > 0 ? Math.round(totalLabScore / validScores) : 0;
    const averageMobileLcpMs = validLcps > 0 ? Math.round(totalLcpMs / validLcps) : 0;
    const confidence = Math.min(1.0, 0.5 + (sampleCount / Math.max(1, data.pages.length)) * 0.5);

    const likelySharedCauses: string[] = [];
    if (averageMobileLcpMs > 3500) likelySharedCauses.push("Heavy template hero assets / slow render blocking");
    if (failingClsCount > 0) likelySharedCauses.push("Unsized template component media / dynamic layout shift");

    groups.push({
      templateId: tId,
      templateName: tId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      routePattern: `/${tId}/*`,
      sampledUrls: data.facts.map((f) => f.url),
      sampleCount,
      failingLcpCount,
      failingInpCount,
      failingClsCount,
      averageMobileLabScore,
      averageMobileLcpMs,
      fieldDataAvailable: hasField,
      confidence: Math.round(confidence * 100) / 100,
      likelySharedCauses,
      estimatedPagesAffected: data.pages.length,
    });
  }

  return groups;
}
