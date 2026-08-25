/**
 * Hardened URL Mapping Engine & Pre-Migration Inventory Builder.
 * Enforces mapping precedence, semantic candidate confirmation, equivalence classification,
 * mapping change detection, and multi-dimensional high-value URL evaluation.
 */

import {
  SourceUrlRecord,
  DestinationUrlRecord,
  UrlMappingEntry,
  MappingType,
  MappingSource,
  MappingConfidence,
  MappingChangeType,
  RedirectEquivalence,
} from "./types";
import { DEFAULT_MIGRATION_POLICY, MigrationPolicy } from "./config";

export interface RawMappingInput {
  sourceUrl: string;
  destinationUrl?: string;
  isRemoved?: boolean;
  isMultiDestination?: boolean;
  notes?: string;
}

export function evaluateSourceUrlImportance(
  src: Partial<SourceUrlRecord>,
  policy: MigrationPolicy = DEFAULT_MIGRATION_POLICY,
  configuredWatchlist: Set<string> = new Set()
): { isHighValue: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const clicks = src.gscClicks || 0;
  const imps = src.gscImpressions || 0;
  const backlinks = src.backlinkCount || 0;

  if (clicks >= policy.highValueClickThreshold) {
    reasons.push(`GSC_SEARCH_TRAFFIC_LEADER (${clicks} clicks >= ${policy.highValueClickThreshold})`);
  }
  if (imps >= policy.highValueImpressionThreshold) {
    reasons.push(`HIGH_SEARCH_IMPRESSIONS (${imps} imps >= ${policy.highValueImpressionThreshold})`);
  }
  if (backlinks >= policy.highValueBacklinkThreshold) {
    reasons.push(`BACKLINK_AUTHORITY_HUB (${backlinks} backlinks >= ${policy.highValueBacklinkThreshold})`);
  }
  if (src.url && configuredWatchlist.has(src.url)) {
    reasons.push("CONFIGURED_BUSINESS_WATCHLIST");
  }
  if (src.pageType === "PRIMARY_SERVICE_PAGE" || src.pageType === "CORE_PRODUCT_PAGE" || src.pageType === "CHECKOUT_OR_CONVERSION") {
    reasons.push(`STRATEGIC_PAGE_ROLE (${src.pageType})`);
  }

  const isHighValue = reasons.length > 0;
  return { isHighValue, reasons };
}

export function buildUrlMappings(params: {
  sourceUrls: SourceUrlRecord[];
  destinationUrls: DestinationUrlRecord[];
  configuredMappings?: RawMappingInput[];
  discoveredRedirects?: Map<string, { targetUrl: string; statusCode: number; hopCount?: number }>;
  semanticCandidates?: Map<string, { candidateUrl: string; similarity: number }>;
  previousMappings?: UrlMappingEntry[];
  configuredWatchlist?: Set<string>;
  policy?: MigrationPolicy;
}): UrlMappingEntry[] {
  const policy = params.policy || DEFAULT_MIGRATION_POLICY;
  const configuredMap = new Map<string, RawMappingInput>();
  if (params.configuredMappings) {
    for (const m of params.configuredMappings) {
      configuredMap.set(m.sourceUrl, m);
    }
  }

  const destinationSet = new Set(params.destinationUrls.map((d) => d.url));
  const discoveredRedirects = params.discoveredRedirects || new Map();
  const semanticCandidates = params.semanticCandidates || new Map();
  const previousMap = new Map((params.previousMappings || []).map((m) => [m.sourceUrl, m]));

  const entries: UrlMappingEntry[] = [];

  for (const src of params.sourceUrls) {
    const importance = evaluateSourceUrlImportance(src, policy, params.configuredWatchlist);
    const isHighValue = src.isHighValue || importance.isHighValue;
    const importanceReasons = src.importanceReasons?.length > 0 ? src.importanceReasons : importance.reasons;

    const mappingId = `map_${Math.abs(src.url.length + (src.title?.length || 0))}_${src.url.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;

    // 1. Explicit Configured Mapping
    if (configuredMap.has(src.url)) {
      const cfg = configuredMap.get(src.url)!;

      if (cfg.isRemoved) {
        entries.push({
          mappingId,
          sourceUrl: src.url,
          mappingType: "REMOVED_NO_REPLACEMENT",
          mappingSource: "CONFIGURED",
          mappingConfidence: "DETERMINISTIC",
          redirectEquivalence: "NO_EQUIVALENT_TARGET",
          sourceIsHighValue: isHighValue,
          sourceImportanceReasons: importanceReasons,
          contentParity: "CONTENT_PARITY_STRONG",
          blockerState: "NON_BLOCKING", // Intentionally retired content is not a launch blocker
          notes: cfg.notes || "Intentionally retired URL with no new replacement.",
        });
        continue;
      }

      if (cfg.isMultiDestination) {
        entries.push({
          mappingId,
          sourceUrl: src.url,
          destinationUrl: cfg.destinationUrl,
          mappingType: "ONE_TO_MANY_REVIEW",
          mappingSource: "CONFIGURED",
          mappingConfidence: "MANUAL_REVIEW",
          redirectEquivalence: "MANUAL_REVIEW",
          sourceIsHighValue: isHighValue,
          sourceImportanceReasons: importanceReasons,
          contentParity: "CONTENT_PARITY_PARTIAL",
          blockerState: "REVIEW_BEFORE_LAUNCH",
          notes: "Source page split into multiple destinations. Requires editorial review.",
        });
        continue;
      }

      if (cfg.destinationUrl) {
        const dest = cfg.destinationUrl;
        const isHompageRedirect = (dest.endsWith(".com/") || dest.endsWith(".io/")) && src.url.split("/").length > 4;
        const equiv: RedirectEquivalence = isHompageRedirect ? "UNRELATED_HOMEPAGE" : "STRONG_EQUIVALENCE";

        entries.push({
          mappingId,
          sourceUrl: src.url,
          destinationUrl: dest,
          mappingType: "ONE_TO_ONE",
          mappingSource: "CONFIGURED",
          mappingConfidence: "DETERMINISTIC",
          redirectEquivalence: equiv,
          sourceIsHighValue: isHighValue,
          sourceImportanceReasons: importanceReasons,
          contentParity: "CONTENT_PARITY_STRONG",
          blockerState: isHompageRedirect && isHighValue ? "REVIEW_BEFORE_LAUNCH" : "NON_BLOCKING",
          notes: cfg.notes || "Explicit configured mapping.",
        });
        continue;
      }
    }

    // 2. Exact Preserved URL (Unchanged)
    if (destinationSet.has(src.url)) {
      entries.push({
        mappingId,
        sourceUrl: src.url,
        destinationUrl: src.url,
        mappingType: "UNCHANGED",
        mappingSource: "DETERMINISTIC_EXACT",
        mappingConfidence: "DETERMINISTIC",
        redirectEquivalence: "EXACT_REPLACEMENT",
        sourceIsHighValue: isHighValue,
        sourceImportanceReasons: importanceReasons,
        contentParity: "CONTENT_PARITY_STRONG",
        blockerState: "NON_BLOCKING",
        notes: "URL preserved unchanged on destination site.",
      });
      continue;
    }

    // 3. Discovered 301/308 Redirect
    if (discoveredRedirects.has(src.url)) {
      const redir = discoveredRedirects.get(src.url)!;
      const isHompageRedirect = (redir.targetUrl.endsWith(".com/") || redir.targetUrl.endsWith(".io/")) && src.url.split("/").length > 4;
      const equiv: RedirectEquivalence = isHompageRedirect ? "UNRELATED_HOMEPAGE" : "STRONG_EQUIVALENCE";

      entries.push({
        mappingId,
        sourceUrl: src.url,
        destinationUrl: redir.targetUrl,
        mappingType: "ONE_TO_ONE",
        mappingSource: "REDIRECT_DISCOVERED",
        mappingConfidence: "HIGH",
        redirectEquivalence: equiv,
        sourceIsHighValue: isHighValue,
        sourceImportanceReasons: importanceReasons,
        observedRedirectStatus: redir.statusCode,
        redirectHopCount: redir.hopCount || 1,
        finalResolvedUrl: redir.targetUrl,
        contentParity: "CONTENT_PARITY_STRONG",
        blockerState: isHompageRedirect && isHighValue ? "REVIEW_BEFORE_LAUNCH" : "NON_BLOCKING",
        notes: `Observed HTTP ${redir.statusCode} redirect.`,
      });
      continue;
    }

    // 4. Semantic Similarity Candidate (Remains candidate requiring review)
    if (semanticCandidates.has(src.url)) {
      const cand = semanticCandidates.get(src.url)!;
      entries.push({
        mappingId,
        sourceUrl: src.url,
        destinationUrl: cand.candidateUrl,
        mappingType: "MANUAL_REVIEW",
        mappingSource: "SEMANTIC_CANDIDATE",
        mappingConfidence: "MEDIUM",
        redirectEquivalence: "PARTIAL_EQUIVALENCE",
        sourceIsHighValue: isHighValue,
        sourceImportanceReasons: importanceReasons,
        contentParity: "CONTENT_PARITY_PARTIAL",
        blockerState: "REVIEW_BEFORE_LAUNCH",
        notes: `Semantic similarity candidate (${Math.round(cand.similarity * 100)}% match). Requires human review before confirmation.`,
      });
      continue;
    }

    // 5. Unmapped Source URL
    entries.push({
      mappingId,
      sourceUrl: src.url,
      mappingType: "MANUAL_REVIEW",
      mappingSource: "MANUAL",
      mappingConfidence: "MANUAL_REVIEW",
      redirectEquivalence: "NO_EQUIVALENT_TARGET",
      sourceIsHighValue: isHighValue,
      sourceImportanceReasons: importanceReasons,
      contentParity: "CONTENT_PARITY_UNKNOWN",
      blockerState: isHighValue ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
      notes: isHighValue
        ? "High-value source URL has no destination mapping or redirect defined. Immediate launch blocker."
        : "Source URL has no destination mapping.",
    });
  }

  // Detect Many-To-One Consolidations
  const destinationGroupMap = new Map<string, UrlMappingEntry[]>();
  for (const e of entries) {
    if (e.destinationUrl) {
      const list = destinationGroupMap.get(e.destinationUrl) || [];
      list.push(e);
      destinationGroupMap.set(e.destinationUrl, list);
    }
  }

  for (const [dest, group] of destinationGroupMap.entries()) {
    if (group.length > 1) {
      for (const item of group) {
        if (item.mappingType === "ONE_TO_ONE") {
          item.mappingType = "MANY_TO_ONE";
          item.notes += ` (Consolidated with ${group.length - 1} other source URLs into [${dest}])`;
        }
      }
    }
  }

  // Versioning and Change Detection
  for (const e of entries) {
    if (previousMap.has(e.sourceUrl)) {
      const prev = previousMap.get(e.sourceUrl)!;
      if (prev.destinationUrl !== e.destinationUrl || prev.mappingType !== e.mappingType) {
        e.mappingChangeType = "MAPPING_CHANGED";
      } else {
        e.mappingChangeType = "MAPPING_UNCHANGED";
      }
    } else {
      e.mappingChangeType = "MAPPING_ADDED";
    }
  }

  return entries;
}
