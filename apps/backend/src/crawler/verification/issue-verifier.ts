/**
 * Phase 24.1: Issue-Level Live Verification Engine.
 * Executes targeted, lightweight live verification of specific diagnostic findings on live websites.
 */

import * as cheerio from "cheerio";
import { fetchPageHtml, verifyLinkTarget } from "../fetcher";
import { processPageAuthoritatively } from "../page-processor";
import { evaluateAllDiagnosticRules } from "../rules";
import { normalizeUrl } from "../normalizer";
import { getRuleVerificationCapability } from "./rule-verification-registry";
import { computeOccurrenceDiff, OccurrenceDiffResult } from "./occurrence-diff";
import type { DiagnosticEvidence } from "../types";

export type LiveVerificationStatus =
  | "VERIFIED_FIXED"
  | "STILL_PRESENT"
  | "PARTIALLY_FIXED"
  | "UNVERIFIABLE"
  | "DATA_NOT_READY"
  | "FETCH_FAILED"
  | "ACCESS_BLOCKED"
  | "FULL_AUDIT_REQUIRED";

export interface AffectedResourceInput {
  url: string;
  targetUrl?: string | null;
  rawHref?: string | null;
  domSelector?: string | null;
  codeSnippet?: string | null;
  occurrences?: any[];
}

export interface ResourceVerificationResult {
  url: string;
  targetUrl?: string | null;
  status: LiveVerificationStatus;
  isFixed: boolean;
  message: string;
  occurrenceDiff?: OccurrenceDiffResult;
  liveEvidence?: {
    httpStatus?: number | null;
    observed?: string;
    codeSnippet?: string | null;
    occurrences?: any[];
    verifiedAt: string;
    method?: string;
  };
  verifiedAt: string;
}

export interface BatchVerificationSummary {
  ruleId: string;
  overallResult: LiveVerificationStatus;
  summary: {
    total: number;
    fixed: number;
    stillPresent: number;
    unverifiable: number;
  };
  results: ResourceVerificationResult[];
  verifiedAt: string;
}

/**
 * Verifies a single resource against a specific diagnostic rule.
 */
export async function verifySingleResource(
  ruleId: string,
  resource: AffectedResourceInput,
  seedDomain = "",
  timeoutMs = 12000
): Promise<ResourceVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const capabilityInfo = getRuleVerificationCapability(ruleId);

  if (capabilityInfo.capability === "FULL_AUDIT_REQUIRED") {
    return {
      url: resource.url,
      targetUrl: resource.targetUrl,
      status: "FULL_AUDIT_REQUIRED",
      isFixed: false,
      message: "This issue involves multi-page site graph structure and requires a Full Re-crawl to verify.",
      verifiedAt,
    };
  }

  // 1. Specialized Verifier for Broken External & Internal Links
  if (ruleId === "LINKS_BROKEN_EXTERNAL" || ruleId === "LINKS_BROKEN_INTERNAL") {
    return await verifyBrokenLinkFinding(ruleId, resource, seedDomain, timeoutMs);
  }

  // 2. Standard DOM, Content, Metadata, Accessibility & Schema Verifier
  return await verifyDomOrMetadataFinding(ruleId, resource, seedDomain, timeoutMs);
}

/**
 * Broken Link Verifier (Rule-Specific)
 */
async function verifyBrokenLinkFinding(
  ruleId: string,
  resource: AffectedResourceInput,
  seedDomain: string,
  timeoutMs: number
): Promise<ResourceVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const sourceUrl = resource.url;
  const targetUrl = resource.targetUrl || "";

  // Step 1: Fetch source page live
  const fetchRes = await fetchPageHtml(sourceUrl, timeoutMs);
  if (!fetchRes.ok && fetchRes.statusCode === 0) {
    return {
      url: sourceUrl,
      targetUrl,
      status: "FETCH_FAILED",
      isFixed: false,
      message: `Failed to fetch source page (${sourceUrl}) for live verification.`,
      verifiedAt,
    };
  }

  // Step 2: Parse source page HTML to check if the link still exists
  const $ = cheerio.load(fetchRes.html || "");
  let linkStillExistsOnPage = false;
  let matchingAnchorHref: string | null = null;

  $("a").each((_, el) => {
    const rawHref = $(el).attr("href")?.trim();
    if (!rawHref) return;

    if (rawHref === targetUrl || rawHref === resource.rawHref) {
      linkStillExistsOnPage = true;
      matchingAnchorHref = rawHref;
      return false;
    }

    try {
      const resolved = new URL(rawHref, sourceUrl).toString();
      if (resolved === targetUrl) {
        linkStillExistsOnPage = true;
        matchingAnchorHref = rawHref;
        return false;
      }
    } catch {}
  });

  // If the broken hyperlink was removed or changed to a different URL on the source page
  if (!linkStillExistsOnPage && targetUrl) {
    return {
      url: sourceUrl,
      targetUrl,
      status: "VERIFIED_FIXED",
      isFixed: true,
      message: `Outbound link to ${targetUrl} has been removed or replaced on the live source page.`,
      liveEvidence: {
        httpStatus: fetchRes.statusCode,
        observed: "Hyperlink is no longer present in current source page HTML.",
        verifiedAt,
        method: "LIVE_DOM_INSPECTION",
      },
      verifiedAt,
    };
  }

  // Step 3: Link is still present on page — check if target URL is now working
  if (targetUrl) {
    const targetCheck = await verifyLinkTarget(targetUrl, sourceUrl, matchingAnchorHref || targetUrl, timeoutMs);

    if (targetCheck.outcome === "confirmed_ok" || targetCheck.outcome === "redirected_ok") {
      return {
        url: sourceUrl,
        targetUrl,
        status: "VERIFIED_FIXED",
        isFixed: true,
        message: `Target URL is now reachable (HTTP ${targetCheck.httpStatus || 200}).`,
        liveEvidence: {
          httpStatus: targetCheck.httpStatus,
          observed: `Target URL responded successfully with HTTP ${targetCheck.httpStatus}.`,
          verifiedAt,
          method: targetCheck.verificationMethod,
        },
        verifiedAt,
      };
    }

    if (
      targetCheck.outcome === "bot_blocked_inconclusive" ||
      targetCheck.outcome === "browser_challenge_inconclusive" ||
      targetCheck.outcome === "rate_limited_inconclusive"
    ) {
      return {
        url: sourceUrl,
        targetUrl,
        status: "ACCESS_BLOCKED",
        isFixed: false,
        message: "Target server returned a bot challenge or access restriction (inconclusive).",
        liveEvidence: {
          httpStatus: targetCheck.httpStatus,
          observed: "Bot challenge / Cloudflare WAF encountered on target host.",
          verifiedAt,
          method: "TARGET_STATUS_CHECK",
        },
        verifiedAt,
      };
    }

    // Target still returns error (e.g. 404)
    return {
      url: sourceUrl,
      targetUrl,
      status: "STILL_PRESENT",
      isFixed: false,
      message: `Target URL is still returning ${targetCheck.httpStatus ? `HTTP ${targetCheck.httpStatus}` : targetCheck.reason || "an error"}.`,
      liveEvidence: {
        httpStatus: targetCheck.httpStatus,
        observed: `Target URL ${targetUrl} still returned HTTP ${targetCheck.httpStatus || "Error"} (${targetCheck.outcome}).`,
        codeSnippet: matchingAnchorHref ? `<a href="${matchingAnchorHref}">...</a>` : undefined,
        verifiedAt,
        method: "TARGET_STATUS_CHECK",
      },
      verifiedAt,
    };
  }

  return {
    url: sourceUrl,
    targetUrl,
    status: "STILL_PRESENT",
    isFixed: false,
    message: "Broken link is still present on page.",
    verifiedAt,
  };
}

/**
 * Standard DOM, Content & Metadata Verifier
 */
async function verifyDomOrMetadataFinding(
  ruleId: string,
  resource: AffectedResourceInput,
  seedDomain: string,
  timeoutMs: number
): Promise<ResourceVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const sourceUrl = resource.url;

  // 1. Fetch live page HTML
  const fetchRes = await fetchPageHtml(sourceUrl, timeoutMs);
  if (!fetchRes.ok && fetchRes.statusCode === 0) {
    return {
      url: sourceUrl,
      status: "FETCH_FAILED",
      isFixed: false,
      message: `Failed to connect to ${sourceUrl} during verification.`,
      verifiedAt,
    };
  }

  // 2. Process page authoritatively
  const pageData = await processPageAuthoritatively(
    sourceUrl,
    normalizeUrl(sourceUrl),
    fetchRes.finalUrl,
    fetchRes.statusCode,
    fetchRes.redirectHops,
    fetchRes.html,
    fetchRes.headers,
    fetchRes.responseTimeMs,
    0,
    { seedNormalized: seedDomain || normalizeUrl(sourceUrl) }
  );

  // 3. Evaluate diagnostic rules against the live page
  const evalResults = evaluateAllDiagnosticRules([pageData]);
  const currentIssue = evalResults.issues.find((i) => i.code === ruleId);

  const origOccurrences = resource.occurrences && resource.occurrences.length > 0 ? resource.occurrences : (resource.codeSnippet || null);

  if (!currentIssue) {
    const diff = origOccurrences ? computeOccurrenceDiff(origOccurrences, null) : undefined;
    return {
      url: sourceUrl,
      status: "VERIFIED_FIXED",
      isFixed: true,
      message: diff && diff.originalCount > 1
        ? `All ${diff.originalCount} items verified fixed on ${sourceUrl}.`
        : `Issue ${ruleId} is no longer detected on ${sourceUrl}.`,
      occurrenceDiff: diff,
      liveEvidence: {
        httpStatus: fetchRes.statusCode,
        observed: `Passed rule evaluation on live page (HTTP ${fetchRes.statusCode}).`,
        verifiedAt,
        method: "LIVE_DOM_EVALUATION",
      },
      verifiedAt,
    };
  }

  const liveEvidenceItem = currentIssue.affectedPages.find((p) => p.url === sourceUrl || p.url === pageData.normalizedUrl);
  const liveSnippet = liveEvidenceItem?.evidence?.codeSnippet || null;
  const liveOccurrences = liveEvidenceItem?.evidence?.occurrences && liveEvidenceItem.evidence.occurrences.length > 0
    ? liveEvidenceItem.evidence.occurrences
    : (liveSnippet || null);

  const diff = computeOccurrenceDiff(origOccurrences, liveOccurrences);

  const status: LiveVerificationStatus = diff.status === "PARTIALLY_FIXED" ? "PARTIALLY_FIXED" : "STILL_PRESENT";

  return {
    url: sourceUrl,
    status,
    isFixed: false,
    message: diff.status === "PARTIALLY_FIXED"
      ? `${currentIssue.title || ruleId}: ${diff.summaryLabel}`
      : currentIssue.title || `Issue ${ruleId} is still detected on the live page.`,
    occurrenceDiff: diff,
    liveEvidence: {
      httpStatus: fetchRes.statusCode,
      observed: liveEvidenceItem?.evidence?.observed || currentIssue.description || "Issue still detected on live page.",
      codeSnippet: liveSnippet,
      occurrences: liveEvidenceItem?.evidence?.occurrences,
      verifiedAt,
      method: "LIVE_DOM_EVALUATION",
    },
    verifiedAt,
  };
}

/**
 * Verifies multiple affected resources for an issue with controlled concurrency.
 */
export async function verifyBatchAffected(
  ruleId: string,
  affectedResources: AffectedResourceInput[],
  seedDomain = "",
  concurrency = 3,
  timeoutMs = 12000
): Promise<BatchVerificationSummary> {
  const verifiedAt = new Date().toISOString();
  const safeResources = Array.isArray(affectedResources) ? affectedResources : [];
  const results: ResourceVerificationResult[] = [];

  // Concurrency pool
  const queue = [...safeResources];
  const workers = Array(Math.min(concurrency, queue.length || 1))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const res = await verifySingleResource(ruleId, item, seedDomain, timeoutMs);
        results.push(res);
      }
    });

  await Promise.all(workers);

  const total = results.length;
  const fixed = results.filter((r) => r.status === "VERIFIED_FIXED").length;
  const partiallyFixed = results.filter((r) => r.status === "PARTIALLY_FIXED").length;
  const stillPresent = results.filter((r) => r.status === "STILL_PRESENT").length;
  const unverifiable = results.filter(
    (r) => r.status !== "VERIFIED_FIXED" && r.status !== "PARTIALLY_FIXED" && r.status !== "STILL_PRESENT"
  ).length;

  let overallResult: LiveVerificationStatus = "STILL_PRESENT";
  if (total === 0 || fixed === total) {
    overallResult = "VERIFIED_FIXED";
  } else if (partiallyFixed > 0 || (fixed > 0 && stillPresent > 0)) {
    overallResult = "PARTIALLY_FIXED";
  } else if (stillPresent === total) {
    overallResult = "STILL_PRESENT";
  } else if (unverifiable === total) {
    overallResult = results[0]?.status || "UNVERIFIABLE";
  } else if (fixed > 0) {
    overallResult = "PARTIALLY_FIXED";
  }

  return {
    ruleId,
    overallResult,
    summary: {
      total,
      fixed,
      stillPresent,
      unverifiable,
    },
    results,
    verifiedAt,
  };
}
