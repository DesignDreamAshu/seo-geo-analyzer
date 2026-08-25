/**
 * Inspection Prioritization Queue & Sampling Strategy.
 * Prioritizes high-value and volatile URLs when API quota is constrained.
 */

export interface InspectionCandidate {
  url: string;
  normalizedUrl: string;
  isImportant: boolean;
  isMigratedOrChanged?: boolean;
  hasTechnicalAnomaly?: boolean;
  gscImpressions?: number;
  backlinksCount?: number;
  isSitemapPresent?: boolean;
  templateId?: string;
}

export function prioritizeInspectionQueue(
  candidates: InspectionCandidate[],
  maxQuota: number = 2000
): { prioritized: InspectionCandidate[]; samplingMode: "FULL_COVERAGE" | "TARGETED_INSPECTION" | "REPRESENTATIVE_SAMPLE" } {
  if (candidates.length <= maxQuota) {
    return {
      prioritized: candidates,
      samplingMode: "FULL_COVERAGE",
    };
  }

  // Calculate score for each candidate
  const scored = candidates.map((c) => {
    let score = 0;
    if (c.isImportant) score += 1000;
    if (c.isMigratedOrChanged) score += 500;
    if (c.hasTechnicalAnomaly) score += 300;
    if (c.gscImpressions && c.gscImpressions > 100) score += 200;
    if (c.backlinksCount && c.backlinksCount > 0) score += 100;
    if (c.isSitemapPresent) score += 50;

    return { candidate: c, score };
  });

  // Sort descending by priority score
  scored.sort((a, b) => b.score - a.score);

  const prioritized = scored.slice(0, maxQuota).map((s) => s.candidate);
  const samplingMode = prioritized.some((p) => p.isImportant || p.isMigratedOrChanged)
    ? "TARGETED_INSPECTION"
    : "REPRESENTATIVE_SAMPLE";

  return {
    prioritized,
    samplingMode,
  };
}
