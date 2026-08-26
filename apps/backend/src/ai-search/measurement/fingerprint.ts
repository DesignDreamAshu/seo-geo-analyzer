/**
 * Phase 28I: Deterministic Measurement Fingerprinting.
 * Generates an immutable SHA-256 hash of canonicalized measurement facts,
 * strictly excluding timestamps, random IDs, and ordering noise.
 */

import { createHash } from "node:crypto";
import { AIMeasurementSnapshot } from "./types";

export function computeAIMeasurementFingerprint(snapshot: Omit<AIMeasurementSnapshot, "fingerprint" | "measurementId" | "generatedAt">): string {
  // Extract strictly canonical facts
  const canonicalFacts = {
    projectId: snapshot.projectId,
    auditRunId: snapshot.auditRunId,
    optimizationSnapshotId: snapshot.optimizationSnapshotId,
    engineVersion: snapshot.engineVersion,

    // Metric values & bounds
    metrics: Object.keys(snapshot.metrics)
      .sort()
      .map((k) => {
        const m = (snapshot.metrics as any)[k];
        return {
          id: m.metricId,
          num: m.numerator,
          den: m.denominator,
          val: m.value,
        };
      }),

    // Prompt coverage summary
    promptCoverage: snapshot.promptCoverageSummary,

    // Page targeting summary
    pageTargeting: snapshot.pageTargetingSummary,

    // Sorted prompt details
    prompts: snapshot.promptDetails
      .map((p) => ({
        id: p.promptId,
        text: p.promptText,
        intent: p.intent,
        level: p.coverageLevel,
        url: p.targetPageUrl,
        targeting: p.pageTargetingState,
        ans: p.answerCoverage,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),

    // Sorted intent breakdowns
    intents: snapshot.intentBreakdowns
      .map((i) => ({
        family: i.intentFamily,
        total: i.totalPrompts,
        served: i.adequatelyServed,
        ratio: i.coverageRatio,
      }))
      .sort((a, b) => a.family.localeCompare(b.family)),

    // Sorted category health states
    categories: snapshot.categoryMeasurements
      .map((c) => ({
        cat: c.category,
        health: c.healthState,
        findings: c.activeFindingCount,
      }))
      .sort((a, b) => a.cat.localeCompare(b.cat)),
  };

  const payload = JSON.stringify(canonicalFacts);
  return createHash("sha256").update(payload).digest("hex");
}
