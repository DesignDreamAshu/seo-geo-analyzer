/**
 * Important Page Coverage & New Page Safety Evaluator.
 * Evaluates business-critical indexation without false urgency on newly published content.
 */

import { IndexationEvidenceRecord, GoogleIndexDetailedReason, IndexationRootCauseConfidence } from "./types";

export interface UnindexedImportantPageDetail {
  url: string;
  pageType?: string;
  importanceReasons: string[];
  googleDetailedReason: GoogleIndexDetailedReason;
  lastCrawlAt?: string;
  logCrawlCount?: number;
  rootCauseCategory: IndexationRootCauseConfidence;
  contextRationale: string;
}

export function evaluateImportantIndexCoverage(records: IndexationEvidenceRecord[]): {
  totalImportantPages: number;
  indexedImportantPagesCount: number;
  notIndexedImportantPagesCount: number;
  unknownImportantPagesCount: number;
  coveragePercentage: number;
  unindexedImportantPages: UnindexedImportantPageDetail[];
} {
  const importantRecords = records.filter((r) => r.isImportant);
  const total = importantRecords.length;

  if (total === 0) {
    return {
      totalImportantPages: 0,
      indexedImportantPagesCount: 0,
      notIndexedImportantPagesCount: 0,
      unknownImportantPagesCount: 0,
      coveragePercentage: 100,
      unindexedImportantPages: [],
    };
  }

  let indexedCount = 0;
  let notIndexedCount = 0;
  let unknownCount = 0;
  const unindexedList: UnindexedImportantPageDetail[] = [];

  for (const r of importantRecords) {
    if (r.googleIndexState === "INDEXED") {
      indexedCount++;
    } else if (r.googleIndexState === "NOT_INDEXED") {
      notIndexedCount++;
      let rationale = `Google reports state: '${r.googleDetailedReason}'.`;

      if (r.googleDetailedReason === "DISCOVERED_CURRENTLY_NOT_INDEXED") {
        rationale += " URL discovered by Google but not yet crawled; verify internal linking and sitemap.";
      } else if (r.googleDetailedReason === "CRAWLED_CURRENTLY_NOT_INDEXED") {
        rationale += " Google crawled this URL but decided against indexing; audit content value and uniqueness.";
      } else if (r.googleDetailedReason === "EXCLUDED_BY_NOINDEX") {
        rationale += " Excluded by noindex; check whether this directive was intentional.";
      }

      unindexedList.push({
        url: r.url,
        pageType: r.pageType,
        importanceReasons: r.importanceReasons,
        googleDetailedReason: r.googleDetailedReason,
        lastCrawlAt: r.lastGoogleCrawlAt,
        logCrawlCount: r.serverLogCrawlCount,
        rootCauseCategory: r.rootCauseCategory,
        contextRationale: rationale,
      });
    } else {
      unknownCount++;
    }
  }

  const coveragePercentage = Math.round((indexedCount / total) * 100);

  return {
    totalImportantPages: total,
    indexedImportantPagesCount: indexedCount,
    notIndexedImportantPagesCount: notIndexedCount,
    unknownImportantPagesCount: unknownCount,
    coveragePercentage,
    unindexedImportantPages: unindexedList,
  };
}
