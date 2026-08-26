/**
 * Phase 28J: Deterministic Competitive Benchmark Fingerprinting.
 * Generates an immutable SHA-256 hash of canonicalized competitive intelligence facts.
 */

import { createHash } from "node:crypto";
import { AICompetitiveBenchmarkSnapshot } from "./types";

export function computeCompetitiveFingerprint(
  snapshot: Omit<AICompetitiveBenchmarkSnapshot, "fingerprint" | "snapshotId" | "generatedAt">
): string {
  const canonicalFacts = {
    projectId: snapshot.projectId,
    clientMeasurementSnapshotId: snapshot.clientMeasurementSnapshotId,
    competitiveEngineVersion: snapshot.competitiveEngineVersion,
    competitors: snapshot.competitors
      .map((c) => ({ id: c.competitorId, domain: c.domain, status: c.status }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    summary: snapshot.summary,
    prompts: snapshot.promptComparisons
      .map((p) => ({
        id: p.promptId,
        state: p.competitiveState,
        ownership: p.ownership,
        clientPage: p.clientBestPageUrl,
        winner: p.winningCompetitorName,
        reasons: p.advantageEvidence.reasons,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    intents: snapshot.intentComparisons
      .map((i) => ({
        family: i.intentFamily,
        total: i.totalComparablePrompts,
        clientAdv: i.clientAdvantages,
        compAdv: i.competitorAdvantages,
        parity: i.roughParity,
      }))
      .sort((a, b) => a.family.localeCompare(b.family)),
    opportunities: snapshot.opportunities
      .map((o) => ({
        type: o.type,
        priority: o.priority,
        targetUrl: o.clientTargetPageUrl,
        prompts: o.affectedPrompts.map((p) => p.id).sort(),
      }))
      .sort((a, b) => (a.targetUrl || "").localeCompare(b.targetUrl || "")),
  };

  const payload = JSON.stringify(canonicalFacts);
  return createHash("sha256").update(payload).digest("hex");
}
