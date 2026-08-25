/**
 * Transparent AI Readiness Scoring Engine
 * Computes 4 independent sub-scores with strict denominator transparency.
 * Never penalizes missing external provider credentials.
 */

import type {
  AIReadinessScoreBreakdown,
  AIReadinessSubScore,
  AIObservabilityRecord,
  AISearchPillar,
} from "../types";

function computePillarScore(
  pillar: AISearchPillar,
  observability: AIObservabilityRecord[]
): AIReadinessSubScore {
  const records = observability.filter((r) => r.pillar === pillar);

  let eligible = 0;
  let evaluated = 0;
  let passed = 0;
  let failed = 0;
  let advisory = 0;
  let providerRequired = 0;
  let notApplicable = 0;

  for (const r of records) {
    if (r.measurementClass === "PROVIDER_REQUIRED" || r.status === "PROVIDER_REQUIRED") {
      providerRequired++;
      continue;
    }
    if (r.measurementClass === "EXPERIMENTAL" || r.evidenceLevel === "LEVEL_D") {
      advisory++;
      continue;
    }
    if (r.status === "SKIPPED") {
      notApplicable++;
      continue;
    }

    eligible += r.eligibleCount;
    evaluated += r.evaluatedCount;
    passed += r.passedCount;
    failed += r.failedCount;
  }

  const score = evaluated > 0 ? Math.max(0, Math.min(100, Math.round((passed / evaluated) * 100))) : 100;

  return {
    score,
    eligibleDimensions: eligible,
    evaluatedDimensions: evaluated,
    passedDimensions: passed,
    failedDimensions: failed,
    advisoryCount: advisory,
    providerRequiredCount: providerRequired,
    notApplicableCount: notApplicable,
  };
}

export function computeAIReadinessScores(
  observability: AIObservabilityRecord[]
): AIReadinessScoreBreakdown {
  return {
    scoreModelVersion: "v28b-1.0",
    technicalAccessibility: computePillarScore("TECHNICAL", observability),
    aeoReadiness: computePillarScore("AEO", observability),
    geoEvidenceReadiness: computePillarScore("GEO", observability),
    entityGrounding: computePillarScore("ENTITY_LLM", observability),
  };
}
