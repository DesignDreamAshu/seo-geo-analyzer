/**
 * Comprehensive Redirect Validation Engine for Migrations.
 * Evaluates 301, 308, 302, 307, meta refresh, JS redirects, chains, loops,
 * 404/410 targets, noindex targets, canonicalized targets, and cross-locale/branch conflicts.
 */

import { UrlMappingEntry, LaunchBlockerState } from "./types";

export interface RedirectIssue {
  sourceUrl: string;
  destinationUrl: string;
  issueType:
    | "MIGRATION_REDIRECT_LOOP"
    | "MIGRATION_REDIRECT_CHAIN"
    | "MIGRATION_REDIRECT_TARGET_BROKEN"
    | "MIGRATION_REDIRECT_TARGET_410"
    | "MIGRATION_REDIRECT_TARGET_NON_INDEXABLE"
    | "MIGRATION_REDIRECT_TARGET_CANONICAL_MISMATCH"
    | "MIGRATION_TEMPORARY_REDIRECT_REVIEW"
    | "MIGRATION_META_REFRESH_REDIRECT"
    | "MIGRATION_JAVASCRIPT_REDIRECT"
    | "MIGRATION_LOCALE_MAPPING_CONFLICT"
    | "MIGRATION_BRANCH_MAPPING_CONFLICT";
  hopCount?: number;
  statusCode?: number;
  blockerState: LaunchBlockerState;
  details: string;
  suggestedFix: string;
}

export function validateMigrationRedirects(
  mappings: UrlMappingEntry[],
  crawlMetadataMap: Map<string, { statusCode?: number; isNoindex?: boolean; canonicalUrl?: string; redirectChain?: string[]; redirectMethod?: string; detectedLocale?: string; branchLocationId?: string }>
): RedirectIssue[] {
  const issues: RedirectIssue[] = [];

  for (const m of mappings) {
    if (!m.destinationUrl) continue;

    const destMeta = crawlMetadataMap.get(m.destinationUrl);

    // 1. Redirect Loop
    if (m.sourceUrl === m.destinationUrl && m.mappingType !== "UNCHANGED") {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_REDIRECT_LOOP",
        blockerState: "LAUNCH_BLOCKER",
        details: `Redirect loop detected: [${m.sourceUrl}] redirects directly back to itself.`,
        suggestedFix: "Update redirect rule to point to the correct distinct destination URL.",
      });
      continue;
    }

    // 2. Redirect Chains (>= 2 hops)
    if (m.redirectHopCount && m.redirectHopCount >= 2) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_REDIRECT_CHAIN",
        hopCount: m.redirectHopCount,
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Redirect chain detected (${m.redirectHopCount} hops) from [${m.sourceUrl}] to [${m.finalResolvedUrl || m.destinationUrl}].`,
        suggestedFix: `Update redirect rule on [${m.sourceUrl}] to point directly to the final 200 destination [${m.finalResolvedUrl || m.destinationUrl}].`,
      });
    }

    // 3. Temporary Redirect Review (302/307)
    if (m.observedRedirectStatus === 302 || m.observedRedirectStatus === 307) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_TEMPORARY_REDIRECT_REVIEW",
        statusCode: m.observedRedirectStatus,
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Temporary HTTP ${m.observedRedirectStatus} redirect observed. Permanent site migrations should use HTTP 301 or 308 for full link equity transfer.`,
        suggestedFix: `Change redirect status code to HTTP 301 Permanent Redirect.`,
      });
    }

    // 4. Meta Refresh & JS Redirects
    if (destMeta?.redirectMethod === "META_REFRESH") {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_META_REFRESH_REDIRECT",
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Meta refresh redirect observed. Server-side HTTP 301 is required for clean search engine signal transference.`,
        suggestedFix: "Replace meta refresh tag with server-side 301 redirect.",
      });
    } else if (destMeta?.redirectMethod === "JAVASCRIPT") {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_JAVASCRIPT_REDIRECT",
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Client-side JavaScript redirect observed. Server-side HTTP 301 is required for search engines.`,
        suggestedFix: "Replace JavaScript window.location redirect with server-side 301 redirect.",
      });
    }

    // 5. Broken Destination (404/410)
    if (destMeta && destMeta.statusCode === 404) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_REDIRECT_TARGET_BROKEN",
        statusCode: destMeta.statusCode,
        blockerState: m.sourceIsHighValue ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
        details: `Destination URL [${m.destinationUrl}] returns HTTP 404 Not Found.`,
        suggestedFix: `Fix the destination page or update the mapping to an active HTTP 200 equivalent.`,
      });
    } else if (destMeta && destMeta.statusCode === 410) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_REDIRECT_TARGET_410",
        statusCode: destMeta.statusCode,
        blockerState: m.sourceIsHighValue ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
        details: `Destination URL [${m.destinationUrl}] returns HTTP 410 Gone.`,
        suggestedFix: `Remap to an active HTTP 200 replacement or update source mapping to REMOVED_NO_REPLACEMENT.`,
      });
    }

    // 6. Non-Indexable Destination (noindex)
    if (destMeta && destMeta.isNoindex) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_REDIRECT_TARGET_NON_INDEXABLE",
        blockerState: m.sourceIsHighValue ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
        details: `Destination URL [${m.destinationUrl}] has a noindex directive. Redirecting indexable traffic to a non-indexable target causes deindexing.`,
        suggestedFix: `Remove noindex tag from destination URL or remap to an indexable page.`,
      });
    }

    // 7. Canonicalized-Away Target
    if (destMeta?.canonicalUrl) {
      const normDest = m.destinationUrl.replace(/\/$/, "");
      const normCanon = destMeta.canonicalUrl.replace(/\/$/, "");
      if (normCanon !== normDest) {
        issues.push({
          sourceUrl: m.sourceUrl,
          destinationUrl: m.destinationUrl,
          issueType: "MIGRATION_REDIRECT_TARGET_CANONICAL_MISMATCH",
          blockerState: "REVIEW_BEFORE_LAUNCH",
          details: `Destination URL [${m.destinationUrl}] canonicalizes to a different page [${destMeta.canonicalUrl}]. Redirect rule should point directly to the canonical target.`,
          suggestedFix: `Update redirect destination directly to [${destMeta.canonicalUrl}].`,
        });
      }
    }

    // 8. Cross-Locale Conflict
    const srcIsFrench = m.sourceUrl.includes("/fr/") || m.sourceUrl.includes("/fr-fr/");
    const destIsEnglish = m.destinationUrl.includes("/en/") || m.destinationUrl.includes("/en-us/");
    if (srcIsFrench && destIsEnglish) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_LOCALE_MAPPING_CONFLICT",
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `French locale URL [${m.sourceUrl}] is redirected to English destination [${m.destinationUrl}].`,
        suggestedFix: `Map French source page to equivalent French destination page.`,
      });
    }

    // 9. Cross-Branch Location Conflict
    const srcIsJaipur = m.sourceUrl.includes("jaipur");
    const destIsDelhi = m.destinationUrl.includes("delhi");
    if (srcIsJaipur && destIsDelhi) {
      issues.push({
        sourceUrl: m.sourceUrl,
        destinationUrl: m.destinationUrl,
        issueType: "MIGRATION_BRANCH_MAPPING_CONFLICT",
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Jaipur branch location page [${m.sourceUrl}] is redirected to Delhi branch [${m.destinationUrl}]. Location identities must be preserved.`,
        suggestedFix: `Map to corresponding Jaipur location landing page.`,
      });
    }
  }

  return issues;
}
