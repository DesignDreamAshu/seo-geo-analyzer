/**
 * Rule-Aware Stable Finding Identity Engine.
 * Constructs robust logical identities that survive DOM/CSS refactoring and array re-ordering.
 */

import { SnapshotDiagnosticFinding } from "./types";

export function buildStableFindingIdentity(finding: SnapshotDiagnosticFinding): string {
  const normUrl = normalizeUrl(finding.url);
  const rule = finding.ruleCode;

  // 1. Page-Level Diagnostic Rules
  if (
    rule === "CONTENT_MISSING_H1" ||
    rule === "CONTENT_TITLE_MISSING" ||
    rule === "INDEXABILITY_NOINDEX" ||
    rule === "INDEXABILITY_ROBOTS_DISALLOWED" ||
    rule === "STATUS_4XX" ||
    rule === "STATUS_5XX" ||
    rule === "SECURITY_HTTPS_MISSING" ||
    rule.startsWith("CANONICAL_")
  ) {
    return `${rule}::${normUrl}`;
  }

  // 2. Link Rules (Identity tied to source page + target href)
  if (rule.startsWith("LINK_") || rule.includes("ANCHOR")) {
    const target = finding.targetHref ? normalizeUrl(finding.targetHref) : extractTargetFromEvidence(finding.evidence) || "unknown_link";
    return `${rule}::${normUrl}::target=${target}`;
  }

  // 3. Resource & Image Rules (Identity tied to source page + resource URL)
  if (rule.startsWith("IMAGE_") || rule.startsWith("ASSET_") || rule.startsWith("SOCIAL_")) {
    const resUrl = finding.targetResourceUrl ? normalizeUrl(finding.targetResourceUrl) : extractResourceFromEvidence(finding.evidence) || "page_resource";
    return `${rule}::${normUrl}::resource=${resUrl}`;
  }

  // 4. Default Safe Fallback
  return `${rule}::${normUrl}::${finding.targetElementSelector || "page"}`;
}

function normalizeUrl(rawUrl: string): string {
  try {
    return rawUrl.trim().toLowerCase().replace(/\/$/, "");
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function extractTargetFromEvidence(evidence?: string): string | null {
  if (!evidence) return null;
  const match = evidence.match(/href=['"]?([^'"\s>]+)['"]?/i) || evidence.match(/target=['"]?([^'"\s>]+)['"]?/i);
  return match ? normalizeUrl(match[1]) : null;
}

function extractResourceFromEvidence(evidence?: string): string | null {
  if (!evidence) return null;
  const match = evidence.match(/src=['"]?([^'"\s>]+)['"]?/i) || evidence.match(/url=['"]?([^'"\s>]+)['"]?/i);
  return match ? normalizeUrl(match[1]) : null;
}
