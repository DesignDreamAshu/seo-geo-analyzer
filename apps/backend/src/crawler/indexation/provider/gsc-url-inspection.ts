/**
 * Google Search Console URL Inspection API Adapter & Normalizer.
 * Safely ingests raw GSC URL Inspection payloads and produces canonical IndexationEvidenceRecords.
 */

import {
  RawGoogleInspectionPayload,
  IndexationEvidenceRecord,
  CanonicalAlignmentState,
  TechnicalIndexabilityState,
  IndexationConfidence,
} from "../types";
import { mapRawGoogleCoverageState } from "./raw-mapper";
import { evaluateEvidenceFreshness, DEFAULT_INDEXATION_POLICY } from "../config";

export function parseGscUrlInspectionPayload(params: {
  projectId: string;
  payload: RawGoogleInspectionPayload;
  technicalIndexability?: TechnicalIndexabilityState;
  technicalDirectives?: IndexationEvidenceRecord["technicalDirectives"];
  isImportant?: boolean;
  importanceReasons?: string[];
  pageType?: string;
  serverLogCrawlCount?: number;
  lastServerLogCrawlAt?: string;
  gscImpressions28d?: number;
  gscClicks28d?: number;
  backlinksCount?: number;
}): IndexationEvidenceRecord {
  const p = params.payload;
  const normalized = mapRawGoogleCoverageState(
    p.coverageState,
    p.verdict,
    p.pageFetchState,
    p.indexingState,
    p.robotsTxtState
  );

  // Evaluate Canonical Alignment
  let canonicalAlignment: CanonicalAlignmentState = "GOOGLE_CANONICAL_UNKNOWN";
  if (p.googleCanonical && p.userCanonical) {
    const cleanUser = p.userCanonical.toLowerCase().replace(/\/$/, "");
    const cleanGoogle = p.googleCanonical.toLowerCase().replace(/\/$/, "");
    canonicalAlignment = cleanUser === cleanGoogle ? "CANONICAL_MATCH" : "GOOGLE_SELECTED_DIFFERENT_CANONICAL";
  } else if (!p.userCanonical && p.googleCanonical) {
    canonicalAlignment = "DECLARED_CANONICAL_MISSING";
  }

  const freshness = evaluateEvidenceFreshness(p.inspectionTimestamp, DEFAULT_INDEXATION_POLICY);
  const confidence: IndexationConfidence = freshness === "FRESH" ? "HIGH" : freshness === "AGING" ? "MODERATE" : "LOW";

  // Root-cause categorization
  let rootCauseCategory: IndexationEvidenceRecord["rootCauseCategory"] = "CAUSE_UNKNOWN";
  const rootCauseDetails: string[] = [];

  if (normalized.detailedReason === "EXCLUDED_BY_NOINDEX" && params.technicalDirectives?.noindex) {
    rootCauseCategory = "DETERMINISTIC_TECHNICAL_CAUSE";
    rootCauseDetails.push("URL contains an explicit noindex directive which Google observed and respected.");
  } else if (normalized.detailedReason === "BLOCKED_BY_ROBOTS" && params.technicalDirectives?.robotsDisallowed) {
    rootCauseCategory = "DETERMINISTIC_TECHNICAL_CAUSE";
    rootCauseDetails.push("URL is blocked by robots.txt directives which prevented Googlebot from crawling.");
  } else if (normalized.detailedReason === "DUPLICATE_GOOGLE_CHOSE_DIFFERENT_CANONICAL") {
    rootCauseCategory = "STRONG_CORRELATION";
    rootCauseDetails.push(`Google selected '${p.googleCanonical}' as the canonical version instead of this URL.`);
  } else if (normalized.detailedReason === "CRAWLED_CURRENTLY_NOT_INDEXED") {
    rootCauseCategory = "POSSIBLE_CONTRIBUTOR";
    rootCauseDetails.push("Google crawled the URL but chose not to index it; review content value, internal prominence, and template uniqueness.");
  } else if (normalized.detailedReason === "DISCOVERED_CURRENTLY_NOT_INDEXED") {
    rootCauseCategory = "POSSIBLE_CONTRIBUTOR";
    rootCauseDetails.push("Google discovered the URL but has not crawled it yet; check internal linking depth and sitemap inclusion.");
  }

  return {
    projectId: params.projectId,
    url: p.inspectionUrl,
    normalizedUrl: p.inspectionUrl.toLowerCase().replace(/\/$/, ""),
    pageType: params.pageType,
    isImportant: params.isImportant ?? false,
    importanceReasons: params.importanceReasons || [],
    evaluatedAt: new Date().toISOString(),

    technicalIndexability: params.technicalIndexability || "UNKNOWN",
    technicalDirectives: params.technicalDirectives,

    rawGoogleState: normalized.rawStatus,
    googleIndexState: normalized.normalizedState,
    googleDetailedReason: normalized.detailedReason,
    googleCoverageExplanation: normalized.mappingExplanation,
    lastGoogleCrawlAt: p.lastCrawlTime,
    crawledAs: p.crawledAs,

    declaredCanonical: p.userCanonical || params.technicalDirectives?.declaredCanonical,
    googleCanonical: p.googleCanonical,
    canonicalAlignment,

    serverLogCrawlCount: params.serverLogCrawlCount,
    lastServerLogCrawlAt: params.lastServerLogCrawlAt,
    gscImpressions28d: params.gscImpressions28d,
    gscClicks28d: params.gscClicks28d,
    backlinksCount: params.backlinksCount,

    rootCauseCategory,
    rootCauseDetails,

    evidenceSource: "GSC_URL_INSPECTION_API",
    evidenceFreshness: freshness,
    confidence,
    mapperVersion: normalized.mapperVersion,
  };
}
