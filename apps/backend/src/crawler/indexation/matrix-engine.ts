/**
 * Index Coverage 4-Way Matrix Engine & Explicit Denominator Accountant.
 * Models: Technical Indexability × Google Index State × Server Log Crawl × GSC Performance.
 */

import { IndexationEvidenceRecord, IndexCoverageMatrixDistribution } from "./types";

export function computeIndexCoverageMatrix(
  records: IndexationEvidenceRecord[],
  totalKnownUrls: number
): IndexCoverageMatrixDistribution {
  let technicallyIndexableCount = 0;
  let technicallyNonIndexableCount = 0;

  let urlsWithEvidence = 0;
  let indexedCount = 0;
  let notIndexedCount = 0;
  let processingOrUncertainCount = 0;
  let unknownCount = 0;

  let importantIndexableWithEvidence = 0;
  let importantIndexableIndexed = 0;

  for (const r of records) {
    if (r.technicalIndexability === "INDEXABLE") technicallyIndexableCount++;
    else if (r.technicalIndexability === "NON_INDEXABLE") technicallyNonIndexableCount++;

    if (r.googleIndexState === "UNKNOWN") {
      unknownCount++;
    } else {
      urlsWithEvidence++;
      if (r.googleIndexState === "INDEXED") {
        indexedCount++;
        if (r.isImportant && r.technicalIndexability === "INDEXABLE") {
          importantIndexableIndexed++;
        }
      } else if (r.googleIndexState === "NOT_INDEXED") {
        notIndexedCount++;
      } else if (r.googleIndexState === "PROCESSING_OR_UNCERTAIN") {
        processingOrUncertainCount++;
      }

      if (r.isImportant && r.technicalIndexability === "INDEXABLE") {
        importantIndexableWithEvidence++;
      }
    }
  }

  // Calculate explicit ratio percentages
  const eligibleRatioPct = urlsWithEvidence > 0 ? Math.round((indexedCount / urlsWithEvidence) * 100) : 0;
  const importantRatioPct = importantIndexableWithEvidence > 0 ? Math.round((importantIndexableIndexed / importantIndexableWithEvidence) * 100) : 100;

  return {
    totalKnownUrls,
    technicallyIndexableUrlsCount: technicallyIndexableCount,
    technicallyNonIndexableUrlsCount: technicallyNonIndexableCount,
    urlsWithGoogleEvidenceCount: urlsWithEvidence,
    indexedCount,
    notIndexedCount,
    processingOrUncertainCount,
    unknownIndexStateCount: unknownCount + Math.max(0, totalKnownUrls - records.length),
    indexedAmongEligibleWithEvidenceRatio: {
      numerator: indexedCount,
      denominator: urlsWithEvidence,
      percentage: eligibleRatioPct,
    },
    importantIndexableIndexedRatio: {
      numerator: importantIndexableIndexed,
      denominator: importantIndexableWithEvidence,
      percentage: importantRatioPct,
    },
  };
}
