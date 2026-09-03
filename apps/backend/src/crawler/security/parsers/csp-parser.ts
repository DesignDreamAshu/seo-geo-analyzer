/**
 * Content-Security-Policy (CSP) Fact Parser (SECURITY S1).
 * Parses CSP and CSP-Report-Only headers into structured, authoritative facts without deciding rule severity.
 */

import type { CspHeaderFact, CspDirectiveFact } from "../types";

export function parseCspHeader(rawHeader: string, isReportOnly = false): CspHeaderFact {
  const parseErrors: string[] = [];
  const directives: Record<string, CspDirectiveFact> = {};

  if (!rawHeader || typeof rawHeader !== "string") {
    return {
      rawHeader: rawHeader || "",
      isReportOnly,
      isEnforced: !isReportOnly,
      parsedSuccessfully: false,
      parseErrors: ["Empty or non-string CSP header"],
      directives: {},
      directiveCount: 0,
      hasDefaultSrc: false,
      hasScriptSrc: false,
      hasStyleSrc: false,
      hasObjectSrc: false,
      hasBaseUri: false,
      hasFrameAncestors: false,
      hasUpgradeInsecureRequests: false,
      hasBlockAllMixedContent: false,
      reportUri: null,
      reportTo: null,
    };
  }

  // Directives are separated by semicolons
  const rawDirectives = rawHeader.split(";");

  for (const rawDir of rawDirectives) {
    const trimmed = rawDir.trim();
    if (!trimmed) {
      continue;
    }

    // First whitespace splits directive name and directive value list
    const parts = trimmed.split(/\s+/);
    const directiveName = parts[0].toLowerCase();
    const rawValues = parts.slice(1);

    if (!directiveName) {
      parseErrors.push(`Malformed empty directive token: "${trimmed}"`);
      continue;
    }

    // Flag known special source keywords
    let hasUnsafeInline = false;
    let hasUnsafeEval = false;
    let hasUnsafeHashes = false;
    let hasStrictDynamic = false;
    let hasWildcard = false;
    let hasHttpSource = false;
    let hasDataUri = false;
    let hasNone = false;
    let hasSelf = false;
    const sources: string[] = [];

    for (const val of rawValues) {
      const lower = val.toLowerCase().replace(/['"]/g, ""); // normalized without quotes for comparison
      const rawLower = val.toLowerCase();

      if (rawLower === "'unsafe-inline'" || lower === "unsafe-inline") {
        hasUnsafeInline = true;
      }
      if (rawLower === "'unsafe-eval'" || lower === "unsafe-eval") {
        hasUnsafeEval = true;
      }
      if (rawLower === "'unsafe-hashes'" || lower === "unsafe-hashes") {
        hasUnsafeHashes = true;
      }
      if (rawLower === "'strict-dynamic'" || lower === "strict-dynamic") {
        hasStrictDynamic = true;
      }
      if (rawLower === "'none'" || lower === "none") {
        hasNone = true;
      }
      if (rawLower === "'self'" || lower === "self") {
        hasSelf = true;
      }
      if (val === "*" || val === "http:*" || val === "https:*") {
        hasWildcard = true;
      }
      if (rawLower.startsWith("http:") || rawLower.startsWith("http://")) {
        hasHttpSource = true;
      }
      if (rawLower.startsWith("data:") || rawLower === "'data:'") {
        hasDataUri = true;
      }

      sources.push(val);
    }

    directives[directiveName] = {
      directiveName,
      rawValues,
      hasUnsafeInline,
      hasUnsafeEval,
      hasUnsafeHashes,
      hasStrictDynamic,
      hasWildcard,
      hasHttpSource,
      hasDataUri,
      hasNone,
      hasSelf,
      sources,
    };
  }

  const directiveKeys = Object.keys(directives);

  return {
    rawHeader,
    isReportOnly,
    isEnforced: !isReportOnly,
    parsedSuccessfully: parseErrors.length === 0,
    parseErrors,
    directives,
    directiveCount: directiveKeys.length,
    hasDefaultSrc: "default-src" in directives,
    hasScriptSrc: "script-src" in directives || "script-src-elem" in directives,
    hasStyleSrc: "style-src" in directives || "style-src-elem" in directives,
    hasObjectSrc: "object-src" in directives,
    hasBaseUri: "base-uri" in directives,
    hasFrameAncestors: "frame-ancestors" in directives,
    hasUpgradeInsecureRequests: "upgrade-insecure-requests" in directives,
    hasBlockAllMixedContent: "block-all-mixed-content" in directives,
    reportUri: directives["report-uri"]?.rawValues.join(" ") || null,
    reportTo: directives["report-to"]?.rawValues.join(" ") || null,
  };
}

/**
 * Parses all CSP and CSP-Report-Only headers from a response headers map.
 */
export function extractCspFactsFromHeaders(
  headers: Record<string, string | string[] | undefined>
): { enforced: CspHeaderFact[]; reportOnly: CspHeaderFact[] } {
  const enforced: CspHeaderFact[] = [];
  const reportOnly: CspHeaderFact[] = [];

  for (const [key, val] of Object.entries(headers)) {
    if (!val) continue;
    const lowerKey = key.toLowerCase();

    if (lowerKey === "content-security-policy") {
      if (Array.isArray(val)) {
        val.forEach((item) => enforced.push(parseCspHeader(String(item), false)));
      } else {
        enforced.push(parseCspHeader(String(val), false));
      }
    } else if (lowerKey === "content-security-policy-report-only") {
      if (Array.isArray(val)) {
        val.forEach((item) => reportOnly.push(parseCspHeader(String(item), true)));
      } else {
        reportOnly.push(parseCspHeader(String(val), true));
      }
    }
  }

  return { enforced, reportOnly };
}
