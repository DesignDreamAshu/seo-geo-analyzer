/**
 * Google Canonical Selection & Duplicate Family Intelligence.
 * Compares declared vs Google-selected canonicals without automatically declaring differences as defects.
 */

import { IndexationEvidenceRecord } from "./types";

export interface CanonicalMismatchDetail {
  declaredUrl: string;
  declaredCanonical?: string;
  googleCanonical: string;
  isContentEquivalenceLikely: boolean;
  guidance: string;
}

export function evaluateCanonicalSelectionIntelligence(records: IndexationEvidenceRecord[]): {
  canonicalMatchCount: number;
  googleSelectedDifferentCanonicalCount: number;
  declaredCanonicalMissingCount: number;
  mismatchExamples: CanonicalMismatchDetail[];
} {
  let matchCount = 0;
  let differentCount = 0;
  let missingCount = 0;
  const mismatchExamples: CanonicalMismatchDetail[] = [];

  for (const r of records) {
    if (r.canonicalAlignment === "CANONICAL_MATCH") {
      matchCount++;
    } else if (r.canonicalAlignment === "GOOGLE_SELECTED_DIFFERENT_CANONICAL" && r.googleCanonical) {
      differentCount++;

      const isEquiv =
        r.declaredCanonical !== undefined &&
        (r.declaredCanonical.toLowerCase().includes(r.googleCanonical.toLowerCase()) ||
          r.googleCanonical.toLowerCase().includes(r.declaredCanonical.toLowerCase()));

      mismatchExamples.push({
        declaredUrl: r.url,
        declaredCanonical: r.declaredCanonical,
        googleCanonical: r.googleCanonical,
        isContentEquivalenceLikely: isEquiv,
        guidance: isEquiv
          ? "Google selected a clean/equivalent variant as canonical. Review internal links to align with Google's selection."
          : `Google chose '${r.googleCanonical}' instead of declared canonical '${r.declaredCanonical}'. Audit content uniqueness and internal anchor text.`,
      });
    } else if (r.canonicalAlignment === "DECLARED_CANONICAL_MISSING") {
      missingCount++;
    }
  }

  return {
    canonicalMatchCount: matchCount,
    googleSelectedDifferentCanonicalCount: differentCount,
    declaredCanonicalMissingCount: missingCount,
    mismatchExamples,
  };
}
