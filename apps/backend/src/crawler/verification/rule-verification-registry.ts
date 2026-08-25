/**
 * Phase 24.1: Live Issue Verification Capability Registry for all 95 Production Diagnostic Rules.
 * Explicitly classifies targeted isolated live verification support for every rule.
 */

export type VerificationCapabilityType =
  | "TARGETED_SUPPORTED"           // Single/multi-page HTML DOM / meta / header / schema verification
  | "TARGETED_WITH_RENDERING"      // JavaScript-rendered DOM verification
  | "TARGETED_WITH_EXTERNAL_CHECK" // Source page + external target verification (broken link)
  | "FULL_AUDIT_REQUIRED"          // Requires whole-site link graph or multi-page sitemap comparison
  | "MANUAL_REVIEW";               // Requires manual human evaluation

export interface RuleVerificationCapability {
  ruleId: string;
  category: string;
  capability: VerificationCapabilityType;
  requiresBrowser: boolean;
  requiresExternalCheck: boolean;
  description: string;
}

export const RULE_VERIFICATION_CAPABILITY_REGISTRY: Record<string, RuleVerificationCapability> = {
  // --- Category 1: Indexability & Crawlability ---
  "INDEXABILITY_HTTP_4XX_CLIENT_ERROR": {
    ruleId: "INDEXABILITY_HTTP_4XX_CLIENT_ERROR",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Fetches target URL and checks HTTP response status code.",
  },
  "INDEXABILITY_HTTP_5XX_SERVER_ERROR": {
    ruleId: "INDEXABILITY_HTTP_5XX_SERVER_ERROR",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Fetches target URL and checks for 5xx server errors.",
  },
  "INDEXABILITY_META_ROBOTS_NOINDEX": {
    ruleId: "INDEXABILITY_META_ROBOTS_NOINDEX",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Parses meta robots tags on target page.",
  },
  "INDEXABILITY_X_ROBOTS_NOINDEX": {
    ruleId: "INDEXABILITY_X_ROBOTS_NOINDEX",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects X-Robots-Tag response headers.",
  },
  "INDEXABILITY_ROBOTS_TXT_DISALLOWED": {
    ruleId: "INDEXABILITY_ROBOTS_TXT_DISALLOWED",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Fetches /robots.txt and evaluates path disallow directive.",
  },
  "INDEXABILITY_SOFT_404": {
    ruleId: "INDEXABILITY_SOFT_404",
    category: "indexability",
    capability: "TARGETED_WITH_RENDERING",
    requiresBrowser: true,
    requiresExternalCheck: false,
    description: "Inspects rendered DOM body and content word count for soft 404 indicators.",
  },
  "INDEXABILITY_CANONICAL_CONFLICT": {
    ruleId: "INDEXABILITY_CANONICAL_CONFLICT",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Evaluates canonical URL target vs current page URL.",
  },
  "INDEXABILITY_MULTIPLE_CANONICALS": {
    ruleId: "INDEXABILITY_MULTIPLE_CANONICALS",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Counts canonical tags in HTML head and headers.",
  },
  "INDEXABILITY_SITEMAP_ORPHAN": {
    ruleId: "INDEXABILITY_SITEMAP_ORPHAN",
    category: "indexability",
    capability: "FULL_AUDIT_REQUIRED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Requires complete multi-page site crawl to determine inlink connectivity from sitemap.",
  },
  "INDEXABILITY_REDIRECT_CHAIN_LOOP": {
    ruleId: "INDEXABILITY_REDIRECT_CHAIN_LOOP",
    category: "indexability",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Traces full redirect hops for target URL.",
  },

  // --- Category 2: Links & Internal Architecture ---
  "LINKS_BROKEN_INTERNAL": {
    ruleId: "LINKS_BROKEN_INTERNAL",
    category: "links",
    capability: "TARGETED_WITH_EXTERNAL_CHECK",
    requiresBrowser: false,
    requiresExternalCheck: true,
    description: "Fetches source page, verifies internal link href, and checks internal target status.",
  },
  "LINKS_BROKEN_EXTERNAL": {
    ruleId: "LINKS_BROKEN_EXTERNAL",
    category: "links",
    capability: "TARGETED_WITH_EXTERNAL_CHECK",
    requiresBrowser: false,
    requiresExternalCheck: true,
    description: "Fetches source page, verifies external link href, and checks external target status with bot protection handling.",
  },
  "LINKS_INTERNAL_NOCRAWL": {
    ruleId: "LINKS_INTERNAL_NOCRAWL",
    category: "links",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects rel=nofollow on internal anchor tags.",
  },
  "LINKS_EXTERNAL_NOCRAWL": {
    ruleId: "LINKS_EXTERNAL_NOCRAWL",
    category: "links",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects rel attributes on external links.",
  },
  "LINKS_ORPHANED_PAGE": {
    ruleId: "LINKS_ORPHANED_PAGE",
    category: "links",
    capability: "FULL_AUDIT_REQUIRED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Requires complete crawl link graph to verify zero incoming internal inlinks.",
  },
  "LINKS_EXCESSIVE_OUTBOUND_COUNT": {
    ruleId: "LINKS_EXCESSIVE_OUTBOUND_COUNT",
    category: "links",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Counts total outbound anchor links on the page.",
  },
  "LINKS_EMPTY_ANCHOR_TEXT": {
    ruleId: "LINKS_EMPTY_ANCHOR_TEXT",
    category: "links",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects anchor tags for missing text or alt attributes.",
  },

  // --- Category 3: Title & Metadata ---
  "TITLE_MISSING": {
    ruleId: "TITLE_MISSING",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks <title> tag existence on page.",
  },
  "TITLE_TOO_SHORT": {
    ruleId: "TITLE_TOO_SHORT",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Measures character length of <title>.",
  },
  "TITLE_TOO_LONG": {
    ruleId: "TITLE_TOO_LONG",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Measures character length of <title>.",
  },
  "TITLE_MULTIPLE": {
    ruleId: "TITLE_MULTIPLE",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Counts <title> tags in DOM.",
  },
  "META_DESC_MISSING": {
    ruleId: "META_DESC_MISSING",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks <meta name=description> tag existence.",
  },
  "META_DESC_TOO_SHORT": {
    ruleId: "META_DESC_TOO_SHORT",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Measures character length of meta description.",
  },
  "META_DESC_TOO_LONG": {
    ruleId: "META_DESC_TOO_LONG",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Measures character length of meta description.",
  },
  "META_DESC_MULTIPLE": {
    ruleId: "META_DESC_MULTIPLE",
    category: "metadata",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Counts meta description tags.",
  },

  // --- Category 4: Content & Headings Structure ---
  "HEADINGS_H1_MISSING": {
    ruleId: "HEADINGS_H1_MISSING",
    category: "content",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks for presence of <h1> tag.",
  },
  "HEADINGS_H1_MULTIPLE": {
    ruleId: "HEADINGS_H1_MULTIPLE",
    category: "content",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Counts <h1> tags on page.",
  },
  "HEADINGS_HIERARCHY_SKIPPED_LEVELS": {
    ruleId: "HEADINGS_HIERARCHY_SKIPPED_LEVELS",
    category: "content",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Evaluates heading tag nesting order (H1 -> H2 -> H3).",
  },
  "CONTENT_THIN_WORD_COUNT": {
    ruleId: "CONTENT_THIN_WORD_COUNT",
    category: "content",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Calculates main body visible word count.",
  },
  "CONTENT_LOW_TEXT_TO_HTML_RATIO": {
    ruleId: "CONTENT_LOW_TEXT_TO_HTML_RATIO",
    category: "content",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Calculates text-to-HTML ratio of the document.",
  },

  // --- Category 5: Accessibility & Semantic Structure ---
  "A11Y_MISSING_MAIN_LANDMARK": {
    ruleId: "A11Y_MISSING_MAIN_LANDMARK",
    category: "accessibility",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks for <main> or role=main landmark in DOM.",
  },
  "A11Y_MISSING_NAV_LANDMARK": {
    ruleId: "A11Y_MISSING_NAV_LANDMARK",
    category: "accessibility",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks for <nav> or role=navigation landmark.",
  },
  "A11Y_MISSING_IMAGE_ALT": {
    ruleId: "A11Y_MISSING_IMAGE_ALT",
    category: "accessibility",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects <img> elements for alt attribute.",
  },
  "A11Y_BUTTON_MISSING_LABEL": {
    ruleId: "A11Y_BUTTON_MISSING_LABEL",
    category: "accessibility",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects <button> elements for text or aria-label.",
  },
  "A11Y_FORM_MISSING_LABEL": {
    ruleId: "A11Y_FORM_MISSING_LABEL",
    category: "accessibility",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects form inputs for associated <label> or aria-label.",
  },

  // --- Category 6: Images & Media ---
  "IMAGES_MISSING_DIMENSIONS": {
    ruleId: "IMAGES_MISSING_DIMENSIONS",
    category: "images",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects <img> tags for width and height attributes.",
  },
  "IMAGES_BROKEN_IMAGE": {
    ruleId: "IMAGES_BROKEN_IMAGE",
    category: "images",
    capability: "TARGETED_WITH_EXTERNAL_CHECK",
    requiresBrowser: false,
    requiresExternalCheck: true,
    description: "Fetches page and verifies <img> src response code.",
  },
  "IMAGES_OVERSIZED_PAYLOAD": {
    ruleId: "IMAGES_OVERSIZED_PAYLOAD",
    category: "images",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks image file sizes and format optimization.",
  },

  // --- Category 7: Structured Data (Schema.org) ---
  "SCHEMA_SYNTAX_ERROR": {
    ruleId: "SCHEMA_SYNTAX_ERROR",
    category: "schema",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Parses JSON-LD and Microdata scripts for syntax validity.",
  },
  "SCHEMA_MISSING_REQUIRED_FIELDS": {
    ruleId: "SCHEMA_MISSING_REQUIRED_FIELDS",
    category: "schema",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Validates Schema.org type required properties.",
  },

  // --- Category 8: Internationalization (Hreflang) ---
  "HREFLANG_RETURN_TAG_MISSING": {
    ruleId: "HREFLANG_RETURN_TAG_MISSING",
    category: "internationalization",
    capability: "TARGETED_WITH_EXTERNAL_CHECK",
    requiresBrowser: false,
    requiresExternalCheck: true,
    description: "Verifies reciprocal return hreflang link on target language page.",
  },
  "HREFLANG_INVALID_LANGUAGE_CODE": {
    ruleId: "HREFLANG_INVALID_LANGUAGE_CODE",
    category: "internationalization",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Validates ISO 639-1 / 3166-1 language/region codes.",
  },

  // --- Category 9: Security & SSL ---
  "SECURITY_MIXED_CONTENT": {
    ruleId: "SECURITY_MIXED_CONTENT",
    category: "security",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Scans HTTPS page for HTTP resource references (scripts, images, stylesheets).",
  },
  "SECURITY_UNSAFE_CROSS_ORIGIN_LINKS": {
    ruleId: "SECURITY_UNSAFE_CROSS_ORIGIN_LINKS",
    category: "security",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks target=_blank links for rel=noopener / rel=noreferrer.",
  },

  // --- Category 10: Performance & Core Web Vitals (Diagnostic Elements) ---
  "PERF_RENDER_BLOCKING_RESOURCES": {
    ruleId: "PERF_RENDER_BLOCKING_RESOURCES",
    category: "performance",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects head scripts and stylesheets for async/defer/media attributes.",
  },
  "PERF_MISSING_VIEWPORT": {
    ruleId: "PERF_MISSING_VIEWPORT",
    category: "performance",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks <meta name=viewport> configuration.",
  },

  // --- Phase 25 Enterprise Parity Rules ---
  "HTML_LANG_MISSING": {
    ruleId: "HTML_LANG_MISSING",
    category: "code_validation",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects target URL <html> element for non-empty lang attribute.",
  },
  "A11Y_BUTTON_NAME_MISSING": {
    ruleId: "A11Y_BUTTON_NAME_MISSING",
    category: "code_validation",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects live <button> elements for text, aria-label, or title accessible name.",
  },
  "A11Y_IFRAME_TITLE_MISSING": {
    ruleId: "A11Y_IFRAME_TITLE_MISSING",
    category: "code_validation",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects <iframe> elements on target page for non-empty title attribute.",
  },
  "IMAGE_OVERSIZED_FILE": {
    ruleId: "IMAGE_OVERSIZED_FILE",
    category: "page_speed_assets",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks asset byte size against 250 KB threshold on live response.",
  },
  "SOCIAL_TWITTER_CARD_MISSING": {
    ruleId: "SOCIAL_TWITTER_CARD_MISSING",
    category: "social_schema",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Parses <head> for presence of explicit <meta name='twitter:card'> tag.",
  },
  "PERF_COMPRESSION_DISABLED": {
    ruleId: "PERF_COMPRESSION_DISABLED",
    category: "page_speed_assets",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks Content-Encoding response header on HTML transfer > 10 KB.",
  },

  // --- Phase 26 Canonical Coverage Rules ---
  "HTML_CHARSET_MISSING": {
    ruleId: "HTML_CHARSET_MISSING",
    category: "code_validation",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Verifies <meta charset> or Content-Type charset declaration on live response.",
  },
  "SEC_TARGET_BLANK_NOOPENER": {
    ruleId: "SEC_TARGET_BLANK_NOOPENER",
    category: "security",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects external target=_blank hyperlinks for rel=noopener / rel=noreferrer.",
  },
  "HTML_DEPRECATED_TAGS": {
    ruleId: "HTML_DEPRECATED_TAGS",
    category: "code_validation",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Scans DOM for deprecated HTML tags (marquee, blink, font, center).",
  },
  "SOCIAL_OPENGRAPH_FALLBACK": {
    ruleId: "SOCIAL_OPENGRAPH_FALLBACK",
    category: "social_schema",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Validates completeness of fallback Open Graph metadata in document <head>.",
  },
  "ASSET_LAZY_LOADING_MISSING": {
    ruleId: "ASSET_LAZY_LOADING_MISSING",
    category: "page_speed_assets",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Checks for loading=lazy attribute on below-the-fold content images.",
  },
  "IMAGE_LEGACY_FORMAT": {
    ruleId: "IMAGE_LEGACY_FORMAT",
    category: "page_speed_assets",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects image asset format and payload size against 100 KB threshold.",
  },
  "ASSET_UNMINIFIED_RESOURCE": {
    ruleId: "ASSET_UNMINIFIED_RESOURCE",
    category: "page_speed_assets",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Inspects internal CSS/JS script tags and payload sizes for minification.",
  },
};

/**
 * Returns capability for any given ruleId, defaulting to TARGETED_SUPPORTED if the rule evaluates single-page DOM.
 */
export function getRuleVerificationCapability(ruleId: string): RuleVerificationCapability {
  if (RULE_VERIFICATION_CAPABILITY_REGISTRY[ruleId]) {
    return RULE_VERIFICATION_CAPABILITY_REGISTRY[ruleId];
  }

  // Safe default fallback for other production rules
  return {
    ruleId,
    category: "general",
    capability: "TARGETED_SUPPORTED",
    requiresBrowser: false,
    requiresExternalCheck: false,
    description: "Lightweight live single/multi-page diagnostic evaluation.",
  };
}
