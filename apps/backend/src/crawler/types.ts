export type Severity = "critical" | "warning" | "opportunity" | "notice";

export type ConfidenceLevel = "confirmed" | "likely" | "heuristic" | "manual_review";

export type ResourceType =
  | "html_page"
  | "xml_sitemap"
  | "image"
  | "script"
  | "stylesheet"
  | "api_endpoint"
  | "utility_endpoint"
  | "error"
  | "other";

export type IndexabilityStatus =
  | "indexable"
  | "intentionally_non_indexable"
  | "technically_non_indexable"
  | "utility_resource"
  | "unknown_manual_review";

export type ExternalLinkOutcome =
  | "confirmed_ok"
  | "redirected_ok"
  | "browser_verified_ok"
  | "confirmed_broken"
  | "http_404_browser_inconclusive"
  | "bot_blocked_inconclusive"
  | "rate_limited_inconclusive"
  | "browser_challenge_inconclusive"
  | "timeout_inconclusive"
  | "dns_failure"
  | "ssl_failure"
  | "network_failure"
  | "unsupported_scheme"
  | "manual_review";

export type ExternalLinkStatus =
  | "reachable"
  | "confirmed_broken"
  | "bot_blocked_inconclusive"
  | "timeout"
  | "dns_failure"
  | "ssl_failure";

export type LinkClassification =
  | "internal_navigation"
  | "external"
  | "fragment"
  | "placeholder_hash"
  | "javascript_action"
  | "mailto"
  | "tel"
  | "download"
  | "invalid";

export type ImageAltState =
  | "missing_alt_attribute"
  | "empty_alt_decorative"
  | "empty_alt_suspicious"
  | "descriptive_alt_present";

export type RenderMode =
  | "raw"
  | "playwright_rendered"
  | "raw_plus_playwright"
  | "schema_enriched"
  | "raw_plus_schema"
  | "manual_review";

export type RenderConfidence = "high" | "medium" | "low" | "manual_review";

export type Soft404Status =
  | "valid_page"
  | "possible_soft_404"
  | "confirmed_soft_404"
  | "empty_dynamic_shell"
  | "manual_review";

export type PageClassType =
  | "homepage"
  | "marketing_landing"
  | "article_blog"
  | "category_listing"
  | "product_job_detail"
  | "active_job"
  | "legacy_job"
  | "duplicate_job_candidate"
  | "archived_job_candidate"
  | "cms_duplicate_candidate"
  | "form_application"
  | "utility_legal"
  | "thank_you_confirmation"
  | "search_filter"
  | "sitemap_resource"
  | "utility_endpoint"
  | "redirect"
  | "error";

export interface PageClassification {
  primaryClass: PageClassType;
  confidence: number; // 0.0 to 1.0
  signals: string[];
}

export interface CrawlOptions {
  seedUrl: string;
  maxPages?: number; // default 50, configurable 10 - 1000+
  maxDepth?: number; // default 5
  concurrency?: number; // default 5
  timeoutMs?: number; // default 10000
  allowSubdomains?: boolean; // default false
  respectRobotsTxt?: boolean; // default true
  honorCrawlDelay?: boolean; // default true
  renderJsFallback?: boolean; // default false
  onProgress?: (progress: CrawlProgress) => void;
  signal?: AbortSignal;
}

export interface CrawlProgress {
  crawledPages: number;
  queuedPages: number;
  maxPages: number;
  currentUrl: string;
  percent: number;
  status: "discovering_sitemap" | "crawling" | "analyzing_graph" | "evaluating_rules" | "completed" | "aborted";
}

export interface RedirectHop {
  statusCode: number;
  fromUrl: string;
  toUrl: string;
}

export interface InlinkEntry {
  sourceUrl: string;
  anchorText: string;
  accessibleName?: string;
  rel?: string;
  isNofollow: boolean;
  isImageLink: boolean;
}

export interface CandidateProvenance {
  sourcePage: string;
  domElement: string;
  attributeName: string;
  rawValue: string;
  normalizedUrl: string;
  discoveryMethod: "anchor_tag" | "area_tag" | "sitemap_loc" | "seed_url" | "canonical_fallback";
}

export interface OutlinkEntry {
  targetUrl: string;
  rawHref: string;
  resolvedAbsoluteHref: string;
  normalizedTargetUrl: string;
  anchorText: string;
  accessibleName: string;
  hasAccessibleName: boolean;
  linkClassification: LinkClassification;
  rel?: string;
  isInternal: boolean;
  isNofollow: boolean;
  statusCode?: number | null;
  statusCategory?: ExternalLinkStatus | "internal_ok" | "internal_broken" | "internal_redirect";
  redirectHops?: RedirectHop[];
  isBroken?: boolean;
  provenance?: CandidateProvenance;
}

export type BrowserPageState =
  | "valid_page"
  | "not_found_page"
  | "soft_404_candidate"
  | "challenge_page"
  | "login_wall"
  | "empty_shell"
  | "unknown";

export type BrowserVerificationCapability = "available" | "unavailable" | "degraded";

export type CrawlTerminationReason =
  | "CRAWL_COMPLETE"
  | "MAX_PAGES_REACHED"
  | "DEPTH_LIMIT_REACHED"
  | "QUEUE_EXHAUSTED"
  | "TIME_LIMIT_REACHED"
  | "MANUAL_CANCEL"
  | "FETCH_FAILURE_THRESHOLD"
  | "INTERNAL_ERROR"
  | "queue_exhausted"
  | "max_pages_reached"
  | "cancelled"
  | "fatal_error"
  | "timeout";

export type StatusStability = "stable" | "unstable" | "unknown";

export interface ExternalLinkHttpEvidence {
  status: number | null;
  finalUrl: string;
  method: "GET" | "HEAD";
  checkedAt: string;
  outcome: ExternalLinkOutcome;
}

export interface ExternalLinkBrowserEvidence {
  attempted: boolean;
  navigationStatus?: number | null;
  finalUrl?: string;
  pageTitle?: string;
  pageState?: BrowserPageState;
  visibleTextSample?: string;
  challengeDetected?: boolean;
  checkedAt?: string;
  outcome?: ExternalLinkOutcome;
}

export interface ExternalLinkEvidence {
  rawHref: string;
  resolvedUrl: string;
  normalizedUrl: string;
  sourcePageUrl: string;
  verificationMethod: "http_get" | "http_head" | "playwright_browser" | "http_plus_playwright";
  requestMethod: "GET" | "HEAD";
  httpStatus: number | null;
  finalUrl: string;
  redirectChain: RedirectHop[];
  outcome: ExternalLinkOutcome;
  reason: string;
  checkedAt: string;
  httpVerification?: ExternalLinkHttpEvidence;
  browserVerification?: ExternalLinkBrowserEvidence;
}

export interface ExternalLinkTelemetry {
  discoveredUniqueUrls: number;
  discoveredOccurrences: number;
  verificationLimit: number;
  checkedUniqueUrls: number;
  checkedOccurrences: number;
  uncheckedUniqueUrls: number;
  uncheckedOccurrences: number;

  confirmedOkUniqueUrls: number;
  confirmedOkOccurrences: number;
  redirectedOkUniqueUrls: number;
  redirectedOkOccurrences: number;
  browserVerifiedOkUniqueUrls: number;
  browserVerifiedOkOccurrences: number;
  confirmedBrokenUniqueUrls: number;
  confirmedBrokenOccurrences: number;
  inconclusiveUniqueUrls: number;
  inconclusiveOccurrences: number;

  verificationCoveragePercent: number;

  // Compatibility fields
  uniqueExternalUrlsCount: number;
  totalExternalOccurrences: number;
  confirmedOkCount: number;
  redirectedOkCount: number;
  browserVerifiedOkCount: number;
  confirmedBrokenCount: number;
  botBlockedCount: number;
  rateLimitedCount: number;
  timeoutCount: number;
  networkDnsSslCount: number;
  excludedPlaceholderHashCount: number;
  excludedMailtoTelJsCount: number;
  topExternalDomains: Array<{ domain: string; count: number }>;
}

export interface ImageAsset {
  src: string;
  resolvedUrl?: string;
  alt: string | null;
  altText?: string | null;
  altState: ImageAltState;
  hasAltAttribute: boolean;
  isDecorative: boolean;
  isLinked: boolean;
  accessibleContext?: string | null;
  srcset?: string | null;
  width?: number | null;
  height?: number | null;
  hasDimensions?: boolean;
  loading?: string | null;
  format?: string | null;
  byteSize?: number | null;
  isBroken?: boolean;
}

export interface ResourceAsset {
  url: string;
  resolvedUrl: string;
  type: "script" | "stylesheet" | "image" | "font" | "other";
  byteSize?: number | null;
  isRenderBlocking?: boolean;
  statusCode?: number | null;
  isBroken?: boolean;
}

export interface HeadingOutlineItem {
  level: number;
  text: string;
  domSelector?: string;
  inMainContent: boolean;
  context: "main" | "nav" | "footer" | "header" | "aside" | "component";
}

export interface OpenGraphTagFact {
  property: string;
  content: string;
  source: "raw_html" | "rendered_dom";
}

export type OgImageFetchState =
  | "FETCH_CONFIRMED"
  | "FETCH_FAILED"
  | "FETCH_BLOCKED"
  | "FETCH_NOT_EVALUATED"
  | "FETCH_INCONCLUSIVE";

export interface OpenGraphData {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  resolvedImageUrl?: string | null;
  imageFetchState: OgImageFetchState;
  imageFetchStatus?: number | null;
  imageContentType?: string | null;
  imageDimensions?: { width: number; height: number } | null;
  isImageBroken?: boolean;
  isImageAbsolute?: boolean;
  isImageValidFormat?: boolean;
  url?: string | null;
  type?: string | null;
  siteName?: string | null;
  rawTags: OpenGraphTagFact[];
  missingRequiredTags: string[];
  duplicateTags: string[];
  emptyTags: string[];
  canonicalConsistent: boolean;
  validationStatus: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_EVALUATED";
}

export interface TwitterCardData {
  card?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  resolvedImageUrl?: string | null;
  site?: string | null;
  creator?: string | null;
  rawTags: OpenGraphTagFact[];
  missingTags: string[];
  hasExplicitCard: boolean;
  hasOgFallback: boolean;
  ogFallbackDetails?: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasImage: boolean;
  };
  validationStatus: "PASS" | "FALLBACK_OG_PASS" | "FAIL" | "NOT_EVALUATED";
}

export interface JsonLdBlock {
  blockIndex: number;
  raw: string;
  parsed: Record<string, unknown> | null;
  parsedSuccessfully: boolean;
  parserError?: string | null;
  parserErrorPosition?: number | null;
  rawLength: number;
  types: string[];
  schemaOrgValid: boolean;
  errors: string[];
}

export interface StructuredOccurrence {
  occurrenceId: string;
  type: string; // e.g. "FORM_CONTROL", "IMAGE_ALT", "IMAGE_DIMENSIONS", "BROKEN_LINK", "LINK_TARGET_BLANK", "HEADING_HIERARCHY", "SCHEMA_ERROR", "DEPRECATED_TAG", etc.
  identity: string; // concise primary human-readable identity (e.g. `<input name="candidateEmail" type="email">`, `https://example.com/broken`, `<h1>...</h1>`)
  label?: string; // descriptive label (e.g. "Candidate Email Input", "Footer Logo Image", "H2 Subtitle")
  pageUrl: string;
  targetUrl?: string | null;
  selector?: string | null;
  tagName?: string | null;
  attributes?: Record<string, string | null | undefined>;
  snippet?: string | null;
  observedValue?: string | null;
  expectedValue?: string | null;
  metadata?: Record<string, any>;
}

export interface FormControlFact {
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string | null;
  ariaLabelledBy?: string | null;
  snippet?: string;
  accessibleName: string | null;
  isLabelled: boolean;
}

export interface FormFact {
  id?: string;
  action?: string;
  method?: string;
  controlCount: number;
  unlabelledCount: number;
  controls: FormControlFact[];
  formClassification?: "global_template_form" | "page_primary_form" | "unknown_form";
}

export interface ButtonFact {
  tag: string;
  text: string;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  accessibleName: string;
  isLabelled: boolean;
  domSelector?: string;
}

export interface IframeFact {
  src: string | null;
  title: string | null;
  name?: string | null;
  isHidden: boolean;
  domSelector?: string;
}

export interface RuleExecutionRecord {
  ruleId: string;
  category: string;
  title: string;
  severity: "critical" | "warning" | "opportunity" | "notice";
  isScoring: boolean;
  eligibleCount: number;
  evaluatedCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  skipReasons: Record<string, number>;
  status: "PASSED" | "FAILED" | "SKIPPED" | "NOT_APPLICABLE";
}

export interface LandmarkFacts {
  hasMain: boolean;
  mainCount: number;
  navCount: number;
  footerCount: number;
  headerCount: number;
  asideCount: number;
}

export interface RenderDecision {
  evaluated: boolean;
  eligible: boolean;
  triggered: boolean;
  reasons: string[];
  skippedReason?: "budget_exhausted" | "browser_unavailable" | "static_complete" | "non_html_or_non_200";
  attempted: boolean;
  success?: boolean;
}

export interface RawPageFacts {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  h1Count: number;
  h1Texts: string[];
  forms: FormFact[];
  formCount: number;
  unlabelledFormControlCount: number;
  missingAltCount: number;
  images: ImageAsset[];
  rawDocumentWordCount: number;
  visibleBodyWordCount: number;
  mainContentWordCount: number;
  landmarks: LandmarkFacts;
  hasMainLandmark: boolean;
  headingsOutline: HeadingOutlineItem[];
  htmlLang?: string | null;
  buttons?: ButtonFact[];
  iframes?: IframeFact[];
  isCompressionEnabled?: boolean;
  htmlCharset?: string | null;
  hasValidCharset?: boolean;
  deprecatedHtmlTags?: string[];
  targetBlankWithoutNoopenerLinks?: Array<{ href: string; text: string; rel: string | null }>;
  socialOpenGraphFallbackIssues?: { missingTitle: boolean; missingImage: boolean; missingDescription: boolean; isFallbackIncomplete: boolean };
  lazyLoadingStats?: { belowFoldMissingLazyCount: number; sampleImageUrls: string[] };
  legacyFormatImages?: Array<{ url: string; format: string; byteSize: number }>;
  unminifiedResources?: Array<{ url: string; type: "css" | "js"; byteSize: number }>;
}

export interface RenderedPageFacts {
  attempted: boolean;
  success: boolean;
  renderedAt?: string;
  renderReason?: string;
  renderConfidence?: RenderConfidence;
  title?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  h1Count?: number;
  h1Texts?: string[];
  forms?: FormFact[];
  formCount?: number;
  unlabelledFormControlCount?: number;
  missingAltCount?: number;
  images?: ImageAsset[];
  rawDocumentWordCount?: number;
  visibleBodyWordCount?: number;
  mainContentWordCount?: number;
  landmarks?: LandmarkFacts;
  hasMainLandmark?: boolean;
  headingsOutline?: HeadingOutlineItem[];
  htmlLang?: string | null;
  buttons?: ButtonFact[];
  iframes?: IframeFact[];
  isCompressionEnabled?: boolean;
  htmlCharset?: string | null;
  hasValidCharset?: boolean;
  deprecatedHtmlTags?: string[];
  targetBlankWithoutNoopenerLinks?: Array<{ href: string; text: string; rel: string | null }>;
  socialOpenGraphFallbackIssues?: { missingTitle: boolean; missingImage: boolean; missingDescription: boolean; isFallbackIncomplete: boolean };
  lazyLoadingStats?: { belowFoldMissingLazyCount: number; sampleImageUrls: string[] };
  legacyFormatImages?: Array<{ url: string; format: string; byteSize: number }>;
  unminifiedResources?: Array<{ url: string; type: "css" | "js"; byteSize: number }>;
}

export interface AuthoritativePageFacts {
  source: "raw" | "rendered";
  sourceMode?: "raw_http" | "rendered_playwright";
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  h1Count: number;
  h1Texts: string[];
  forms: FormFact[];
  formCount: number;
  unlabelledFormControlCount: number;
  missingAltCount: number;
  images: ImageAsset[];
  wordCount?: number;
  mainText?: string;
  rawDocumentWordCount: number;
  visibleBodyWordCount: number;
  mainContentWordCount: number;
  landmarks: LandmarkFacts;
  hasMainLandmark: boolean;
  headingsOutline: HeadingOutlineItem[];
  htmlLang?: string | null;
  buttons?: ButtonFact[];
  iframes?: IframeFact[];
  isCompressionEnabled?: boolean;
  htmlCharset?: string | null;
  hasValidCharset?: boolean;
  deprecatedHtmlTags?: string[];
  targetBlankWithoutNoopenerLinks?: Array<{ href: string; text: string; rel: string | null }>;
  socialOpenGraphFallbackIssues?: { missingTitle: boolean; missingImage: boolean; missingDescription: boolean; isFallbackIncomplete: boolean };
  lazyLoadingStats?: { belowFoldMissingLazyCount: number; sampleImageUrls: string[] };
  legacyFormatImages?: Array<{ url: string; format: string; byteSize: number }>;
  unminifiedResources?: Array<{ url: string; type: "css" | "js"; byteSize: number }>;
  renderReason?: string;
  renderConfidence?: RenderConfidence;
}

export function synthesizeAuthoritativeFacts(page: CrawledPageData): AuthoritativePageFacts {
  if (page.authoritativeSource === "rendered" && page.renderedFacts?.success) {
    const rendered = page.renderedFacts;
    return {
      source: "rendered",
      sourceMode: "rendered_playwright",
      title: rendered.title || null,
      metaDescription: rendered.metaDescription || null,
      canonicalUrl: rendered.canonicalUrl || null,
      h1Count: rendered.h1Count || 0,
      h1Texts: rendered.h1Texts || [],
      forms: rendered.forms || [],
      formCount: rendered.forms?.length || 0,
      unlabelledFormControlCount: rendered.unlabelledFormControlCount || 0,
      missingAltCount: rendered.missingAltCount || 0,
      images: rendered.images || [],
      wordCount: rendered.mainContentWordCount || rendered.visibleBodyWordCount || 0,
      mainText: "",
      rawDocumentWordCount: rendered.rawDocumentWordCount || 0,
      visibleBodyWordCount: rendered.visibleBodyWordCount || 0,
      mainContentWordCount: rendered.mainContentWordCount || 0,
      landmarks: rendered.landmarks || { hasMain: false, mainCount: 0, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
      hasMainLandmark: Boolean(rendered.hasMainLandmark),
      headingsOutline: rendered.headingsOutline || [],
      htmlLang: rendered.htmlLang || null,
      buttons: rendered.buttons || [],
      iframes: rendered.iframes || [],
      isCompressionEnabled: rendered.isCompressionEnabled,
      htmlCharset: rendered.htmlCharset || null,
      hasValidCharset: rendered.hasValidCharset,
      deprecatedHtmlTags: rendered.deprecatedHtmlTags || [],
      targetBlankWithoutNoopenerLinks: rendered.targetBlankWithoutNoopenerLinks || [],
      socialOpenGraphFallbackIssues: rendered.socialOpenGraphFallbackIssues,
      lazyLoadingStats: rendered.lazyLoadingStats,
      legacyFormatImages: rendered.legacyFormatImages || [],
      unminifiedResources: rendered.unminifiedResources || [],
      renderReason: rendered.renderReason,
      renderConfidence: rendered.renderConfidence,
    };
  }

  return {
    source: "raw",
    sourceMode: "raw_http",
    title: page.title || null,
    metaDescription: page.metaDescription || null,
    canonicalUrl: page.canonicalUrl || (page as any).canonicalTag || null,
    h1Count: page.h1Count !== undefined ? page.h1Count : ((page as any).h1 ? (page as any).h1.length : (page.h1s ? page.h1s.length : 0)),
    h1Texts: page.h1Tags || page.h1s || (page as any).h1 || [],
    forms: page.forms || [],
    formCount: page.forms ? page.forms.length : 0,
    unlabelledFormControlCount: page.forms ? page.forms.reduce((sum, f) => sum + f.unlabelledCount, 0) : 0,
    missingAltCount: page.images ? page.images.filter((img) => !img.hasAltAttribute).length : 0,
    images: page.images || [],
    wordCount: page.wordCount || 0,
    mainText: page.mainTextSnippet || "",
    rawDocumentWordCount: page.rawDocumentWordCount || page.rawWordCount || page.wordCount || 0,
    visibleBodyWordCount: page.visibleBodyWordCount || page.wordCount || 0,
    mainContentWordCount: page.mainContentWordCount || page.wordCount || 0,
    landmarks: page.landmarks || { hasMain: false, mainCount: 0, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
    hasMainLandmark: Boolean(page.landmarks?.hasMain),
    headingsOutline: page.headingsOutline || [],
    htmlLang: page.htmlLang || null,
    buttons: page.buttons || [],
    iframes: page.iframes || [],
    isCompressionEnabled: page.isCompressionEnabled,
    htmlCharset: page.htmlCharset || null,
    hasValidCharset: page.hasValidCharset,
    deprecatedHtmlTags: page.deprecatedHtmlTags || [],
    targetBlankWithoutNoopenerLinks: page.targetBlankWithoutNoopenerLinks || [],
    socialOpenGraphFallbackIssues: page.socialOpenGraphFallbackIssues,
    lazyLoadingStats: page.lazyLoadingStats,
    legacyFormatImages: page.legacyFormatImages || [],
    unminifiedResources: page.unminifiedResources || [],
    renderReason: page.renderReason,
    renderConfidence: page.renderConfidence,
  };
}

/**
 * Authoritative facts accessor that ensures single source of truth.
 */
export function getAuthoritativeFacts(page: CrawledPageData): AuthoritativePageFacts {
  if (page.authoritativeFacts) {
    return page.authoritativeFacts;
  }
  return synthesizeAuthoritativeFacts(page);
}

/**
 * Authoritative Single Page Fact Model
 */
export interface CrawledPageData {
  url: string;
  requestedUrl: string;
  normalizedUrl: string;
  finalUrl: string;
  statusCode: number;
  redirectHops: RedirectHop[];
  contentType: string;
  resourceType: ResourceType;
  responseTimeMs: number;
  depth: number;
  html: string;
  headers: Record<string, string | string[] | undefined>;
  crawledAt: string;
  sourceMode: "raw_http" | "rendered_playwright";

  // Separate Evidence Fact Populations
  rawFacts?: RawPageFacts;
  renderedFacts?: RenderedPageFacts;
  authoritativeFacts?: AuthoritativePageFacts;
  authoritativeSource?: "raw" | "rendered";
  renderDecision?: RenderDecision;
  renderMode?: RenderMode;
  renderReason?: string;
  renderConfidence?: RenderConfidence;
  rawWordCount: number;
  renderedWordCount?: number;
  rawDocumentWordCount: number;
  visibleBodyWordCount: number;
  mainContentWordCount: number;
  rawH1Count: number;
  renderedH1Count?: number;
  rawTitle: string | null;
  renderedTitle?: string | null;
  structuredDataJobTitle?: string | null;
  soft404Status: Soft404Status;
  statusStability?: StatusStability;

  // Extracted Canonical DOM Features
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonicalUrl: string | null;
  isCanonicalSelfReferencing: boolean;
  isCanonicalTargetReachable: boolean;
  metaRobots: string | null;
  xRobotsTag: string | null;
  isIndexable: boolean;
  indexabilityStatus: IndexabilityStatus;
  h1s: string[];
  h1Count: number;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  headingsOutline: HeadingOutlineItem[];
  headingsHierarchyValid: boolean;
  headingsHierarchyIssues: string[];
  wordCount: number;
  textToHtmlRatio: number;
  landmarks: LandmarkFacts;
  forms: FormFact[];
  images: ImageAsset[];
  resources: ResourceAsset[];
  outlinks: OutlinkEntry[];
  openGraph: OpenGraphData;
  twitterCard: TwitterCardData;
  schemaJsonLd: JsonLdBlock[];
  classification: PageClassification;
  simHashFingerprint?: string;
  mainTextSnippet?: string;
  allCanonicalTags?: Array<{ href: string; inHead: boolean; isValidUrl: boolean; rawHref: string }>;
  viewport?: { tagPresent: boolean; content: string | null; isValid: boolean; issues: string[] };
  hreflangTags?: Array<{ hreflang: string; href: string; isValidLang: boolean; resolvedUrl: string }>;
  mixedContentResources?: Array<{ url: string; type: "image" | "script" | "stylesheet" }>;
  titleTagsCount?: number;
  metaDescriptionTagsCount?: number;
  rawHtmlByteLength?: number;
  robotsDirectives?: { metaRobots: string | null; googlebotMeta: string | null; xRobotsTag: string | null; hasNoindex: boolean; hasNofollow: boolean; conflict: boolean; conflictReason?: string };
  hasMetaRefresh?: boolean;
  metaRefreshTarget?: string | null;
  robotsHasNoSitemap?: boolean;
  htmlLang?: string | null;
  buttons?: ButtonFact[];
  iframes?: IframeFact[];
  isCompressionEnabled?: boolean;
  htmlCharset?: string | null;
  hasValidCharset?: boolean;
  deprecatedHtmlTags?: string[];
  targetBlankWithoutNoopenerLinks?: Array<{ href: string; text: string; rel: string | null }>;
  socialOpenGraphFallbackIssues?: { missingTitle: boolean; missingImage: boolean; missingDescription: boolean; isFallbackIncomplete: boolean };
  lazyLoadingStats?: { belowFoldMissingLazyCount: number; sampleImageUrls: string[] };
  legacyFormatImages?: Array<{ url: string; format: string; byteSize: number }>;
  unminifiedResources?: Array<{ url: string; type: "css" | "js"; byteSize: number }>;
}

export interface DiagnosticEvidence {
  observed: string;
  crawlTimestamp: string;
  httpStatus?: number | null;
  domSelector?: string | null;
  sourceMode: "raw_http" | "rendered_playwright";
  sourceUrl: string;
  targetUrl?: string | null;
  codeSnippet?: string | null;
  factSource?: "raw_http" | "rendered_playwright" | "mixed" | "manual_review";
  authoritativeFactSource?: "raw" | "rendered";
  renderReason?: string;
  renderConfidence?: RenderConfidence;
  componentClassification?: "global_template" | "page_primary" | "unknown";
  occurrences?: StructuredOccurrence[];
}

export interface DiagnosticIssue {
  id: string;
  code: string;
  category:
    | "links"
    | "indexability"
    | "content_relevance"
    | "duplicate_content"
    | "redirects"
    | "page_speed_assets"
    | "security"
    | "social_schema"
    | "code_validation"
    | "url_architecture";
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  impactScore: number; // base impact weight 1-10
  scorePenalty?: number; // exact calibrated point deduction
  affectedCount: number; // unique affected pages count
  affectedOccurrences: number; // total occurrence count across all pages
  affectedUniquePages: number; // unique affected pages count
  eligiblePageCount: number; // denominator of eligible pages
  affectedRatio: number; // affectedUniquePages / eligiblePageCount
  affectedPages: Array<{
    url: string;
    evidence: DiagnosticEvidence;
  }>;
  isSystemicTemplateIssue?: boolean;
  templateFingerprint?: string;
  componentGuess?: "navbar" | "footer" | "blog_template" | "job_template" | "unknown_shared_component";
  duplicateValue?: string;
  groupId?: string;
}

export interface ScoreDeduction {
  ruleId: string;
  title: string;
  category: DiagnosticIssue["category"];
  severity: Severity;
  confidence: ConfidenceLevel;
  pageImportance: number;
  affectedCount: number;
  affectedOccurrences: number;
  affectedUniquePages: number;
  eligiblePageCount: number;
  affectedRatio: number;
  basePenalty: number;
  importanceMultiplier: number;
  confidenceMultiplier: number;
  finalPenalty: number;
  capApplied: boolean;
}

export interface ScoreBreakdown {
  startingScore: number;
  finalScore: number;
  totalDeductions: number;
  deductions: ScoreDeduction[];
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  sourceSitemap?: string;
  isDisallowed?: boolean;
}

export interface CrawlInventory {
  totalCrawled: number;
  totalIndexable: number;
  totalNonIndexable: number;
  totalRedirects: number;
  totalBrokenPages: number;
  sitemapDiscoveredCount: number;
  sitemapOrphanCount: number;
  crawlIsolatedCount: number;
  // Completeness Metrics
  sitemapUrlsDiscovered?: number;
  internalUrlsDiscovered?: number;
  urlsQueued?: number;
  urlsAttempted?: number;
  urlsSuccessfullyFetched?: number;
  urlsEvaluated?: number;
  urlsExcludedIntentionally?: number;
  urlsBlockedByRobots?: number;
  urlsRedirected?: number;
  urlsFailed?: number;
  urlsRemainingInQueue?: number;
  maxPagesConfigured?: number;
  crawlTerminationReason?: CrawlTerminationReason;
  isGraphDiscoveryComplete?: boolean;
  crawlCoverageEvaluation?: "FULL_COVERAGE" | "LIMITED_BY_MAX_PAGES" | "PARTIAL_CRAWL";
}

export interface CategoryScoreSummary {
  category: DiagnosticIssue["category"];
  label: string;
  score: number; // 0 - 100
  evaluationStatus: "evaluated" | "partially_evaluated" | "not_evaluated";
  checksExecuted: number;
  checksAvailable: number;
  passedChecks: number;
  failedChecks: number;
  criticalCount: number;
  warningCount: number;
  opportunityCount: number;
  noticeCount: number;
}

export interface CrawlAuditResult {
  auditId: string;
  seedUrl: string;
  normalizedSeedUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  terminationReason: CrawlTerminationReason;
  healthScore: number; // 0 - 100
  auditCoveragePercent: number; // 0 - 100%
  scoreBreakdown: ScoreBreakdown;
  inventory: CrawlInventory;
  severityCounts: {
    critical: number;
    warnings: number;
    opportunities: number;
    notices: number;
  };
  categories: CategoryScoreSummary[];
  issues: DiagnosticIssue[];
  crawledPages: Array<Omit<CrawledPageData, "html">>;
  sitemapOrphans: SitemapUrlEntry[];
  linkGraphSummary: {
    totalInternalLinks: number;
    totalExternalLinks: number;
    brokenInternalLinksCount: number;
    brokenExternalLinksCount: number;
    botBlockedExternalCount: number;
    externalLinkTelemetry: ExternalLinkTelemetry;
  };
  ruleExecutionObservability?: RuleExecutionRecord[];
  scoreModelVersion?: string;
}
