/**
 * Phase 28C: Prompt Deduplication & Semantic Clustering Engine.
 * Collapses trivial near-duplicates while preserving distinct commercial/industry contexts,
 * generating stable deterministic cluster identities.
 */

import { PromptCandidate, PromptCluster, IntentTaxonomy } from "./types";
import crypto from "node:crypto";

function stableClusterId(name: string): string {
  const hash = crypto.createHash("md5").update(name.trim().toLowerCase()).digest("hex").slice(0, 10);
  return `cls_${hash}`;
}

export interface ClusteringResult {
  deduplicatedCandidates: PromptCandidate[];
  clusters: PromptCluster[];
}

export function deduplicateAndClusterPrompts(candidates: PromptCandidate[]): ClusteringResult {
  const deduped: PromptCandidate[] = [];
  const normalizedKeys = new Set<string>();

  // 1. Deduplication Step: Normalize trivial variants
  for (const c of candidates) {
    // Normalization: strip punctuation, lowercase, normalize 'consulting firms' vs 'consulting companies'
    const norm = c.prompt
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\b(companies|firms|agencies|providers)\b/g, "providers")
      .replace(/\b(top|best|leading)\b/g, "top")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizedKeys.has(norm)) {
      normalizedKeys.add(norm);
      deduped.push(c);
    }
  }

  // 2. Semantic Clustering Step
  const clusterBuckets = new Map<string, { name: string; pillar: string; intent: IntentTaxonomy; items: PromptCandidate[] }>();

  for (const c of deduped) {
    let clusterName = "General Brand & Category Discovery";
    let pillar = "General";
    let intent: IntentTaxonomy = c.intents[0] || "INFORMATIONAL";

    const offName = c.evidenceTrace.derivedFromOfferingName;
    const indName = c.evidenceTrace.derivedFromIndustryName;

    if (offName) {
      pillar = offName;
      if (indName) {
        clusterName = `${offName} — ${indName}`;
      } else if (c.intents.includes("VENDOR_DISCOVERY") || c.intents.includes("RECOMMENDATION")) {
        clusterName = `${offName} — Vendor Discovery & Recommendations`;
      } else if (c.intents.includes("IMPLEMENTATION") || c.intents.includes("HOW_TO")) {
        clusterName = `${offName} — Implementation & Architecture`;
      } else if (c.intents.includes("COMPARISON")) {
        clusterName = `${offName} — Vendor Comparison`;
      } else {
        clusterName = `${offName} — General`;
      }
    } else if (c.brandedness === "BRANDED" || c.brandedness === "SEMI_BRANDED") {
      pillar = "Brand";
      clusterName = "Brand Identity & Direct Company Inquiries";
    }

    const cId = stableClusterId(clusterName);
    c.clusterId = cId;

    if (!clusterBuckets.has(cId)) {
      clusterBuckets.set(cId, { name: clusterName, pillar, intent, items: [] });
    }
    clusterBuckets.get(cId)!.items.push(c);
  }

  // 3. Build Cluster Summaries
  const clusters: PromptCluster[] = [];
  for (const [cId, bucket] of clusterBuckets.entries()) {
    // Pick the most representative prompt in the cluster
    const representative = bucket.items.sort((a, b) => b.priorityScore - a.priorityScore)[0] || bucket.items[0];
    representative.isRepresentative = true;

    clusters.push({
      id: cId,
      name: bucket.name,
      pillar: bucket.pillar,
      intentFamily: bucket.intent,
      promptsCount: bucket.items.length,
      representativePromptId: representative.id,
      monitoringTier: bucket.items.some((i) => i.monitoringTier === "TIER_1_CORE") ? "TIER_1_CORE" : "TIER_2_EXPANDED",
      samplePrompts: bucket.items.slice(0, 3).map((i) => i.prompt),
    });
  }

  return {
    deduplicatedCandidates: deduped,
    clusters,
  };
}
