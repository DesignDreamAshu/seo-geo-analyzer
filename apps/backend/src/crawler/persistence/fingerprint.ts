/**
 * Phase 24: Stable Rule-Aware Finding Fingerprinting & Domain Normalization Engine.
 * Excludes volatile evidence fields (timestamps, request IDs, DOM ordering) while preserving exact semantic identity.
 */

/**
 * Normalizes root project domain for indexing and project lookup.
 * Does NOT alter individual audit page URLs.
 */
export function normalizeDomain(rawDomainOrUrl: string): string {
  let cleaned = rawDomainOrUrl.trim().toLowerCase();
  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//, "");
  // Strip www. prefix for project lookup
  cleaned = cleaned.replace(/^www\./, "");
  // Strip trailing slashes and paths
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx !== -1) {
    cleaned = cleaned.substring(0, slashIdx);
  }
  // Strip port 80/443
  cleaned = cleaned.replace(/:(80|443)$/, "");
  return cleaned;
}

/**
 * Normalizes technical page URLs while preserving technical distinction (HTTP vs HTTPS, www vs non-www).
 */
export function normalizeTechnicalUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url.trim());
    // Strip default ports
    if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
      parsed.port = "";
    }
    // Remove query fragment
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export interface FingerprintInput {
  projectId: string;
  ruleId: string;
  normalizedUrl: string;
  targetResource?: string;
  targetLocale?: string;
  schemaType?: string;
  domSelector?: string; // Only if stable
  evidence?: Record<string, any>;
}

export function generateStableFindingFingerprint(input: FingerprintInput): string {
  const ruleId = input.ruleId.trim().toUpperCase();
  const url = input.normalizedUrl.trim().toLowerCase();
  const projectId = input.projectId.trim();

  // Rule-aware formula branching:
  // 1. Broken Link / Internal Link / Redirect rules: bind source URL and target URL
  if (
    ruleId.includes("BROKEN_LINK") ||
    ruleId.includes("REDIRECT_CHAIN") ||
    ruleId.includes("INTERNAL_LINK") ||
    ruleId.includes("REDIRECT_LOOP") ||
    ruleId.includes("OUTLINK")
  ) {
    const target = (input.targetResource || input.evidence?.targetUrl || input.evidence?.destinationUrl || "").trim().toLowerCase();
    return `fprint_${projectId}_${ruleId}_${url}__target_${target}`;
  }

  // 2. Image ALT / Dimensions / Asset rules: bind page URL and stable image src/filename
  if (
    ruleId.includes("IMAGE") ||
    ruleId.includes("IMG") ||
    ruleId.includes("ALT") ||
    ruleId.includes("WIDTH_HEIGHT") ||
    ruleId.includes("ASSET")
  ) {
    const asset = (input.targetResource || input.evidence?.imageSrc || input.evidence?.assetUrl || input.evidence?.src || "").trim().toLowerCase();
    return `fprint_${projectId}_${ruleId}_${url}__asset_${asset}`;
  }

  // 3. International / Hreflang rules: bind page URL, target locale, and return URL
  if (ruleId.includes("HREFLANG") || ruleId.includes("LOCALE") || ruleId.includes("INTERNATIONAL")) {
    const locale = (input.targetLocale || input.evidence?.locale || input.evidence?.lang || "").trim().toLowerCase();
    const targetUrl = (input.targetResource || input.evidence?.targetUrl || "").trim().toLowerCase();
    return `fprint_${projectId}_${ruleId}_${url}__locale_${locale}__target_${targetUrl}`;
  }

  // 4. Structured Data / Schema rules: bind page URL and schema type
  if (ruleId.includes("STRUCTURED_DATA") || ruleId.includes("SCHEMA") || ruleId.includes("JSON_LD")) {
    const schema = (input.schemaType || input.evidence?.schemaType || input.evidence?.entityType || "").trim().toLowerCase();
    return `fprint_${projectId}_${ruleId}_${url}__schema_${schema}`;
  }

  // 5. Canonical rules: bind page URL and declared canonical
  if (ruleId.includes("CANONICAL")) {
    const canonical = (input.targetResource || input.evidence?.canonicalUrl || "").trim().toLowerCase();
    return `fprint_${projectId}_${ruleId}_${url}__canonical_${canonical}`;
  }

  // 6. Heading hierarchy / duplicate headings: bind heading level / text if specific
  if (ruleId.includes("HEADING") && input.targetResource) {
    const heading = input.targetResource.trim().toLowerCase();
    return `fprint_${projectId}_${ruleId}_${url}__heading_${heading}`;
  }

  // 7. General page-level defects (H1, Title, Meta Description, Indexability, Performance):
  // Rule ID + Normalized URL is canonical identity
  return `fprint_${projectId}_${ruleId}_${url}`;
}

export function sanitizeEvidenceForComparison(evidence: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const volatileKeys = new Set([
    "timestamp",
    "createdAt",
    "crawlTimestamp",
    "crawledAt",
    "crawlTimeMs",
    "crawlTime",
    "durationMs",
    "requestId",
    "request_id",
    "traceId",
    "trace_id",
    "sourceUrl",
    "sourceMode",
    "domIndex",
    "nodeId",
    "randomId",
  ]);

  for (const [k, v] of Object.entries(evidence)) {
    if (!volatileKeys.has(k)) {
      sanitized[k] = v;
    }
  }
  return sanitized;
}
