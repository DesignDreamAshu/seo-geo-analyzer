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
  | "other";

export type IndexabilityStatus =
  | "indexable"
  | "intentionally_non_indexable"
  | "technically_non_indexable"
  | "utility_resource"
  | "unknown_manual_review";

export type ExternalLinkOutcome =
  | "confirmed_ok"
  | "confirmed_broken"
  | "redirected_ok"
  | "bot_blocked_inconclusive"
  | "rate_limited_inconclusive"
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
}

export interface ExternalLinkEvidence {
  rawHref: string;
  resolvedUrl: string;
  normalizedUrl: string;
  sourcePageUrl: string;
  verificationMethod: "http_get" | "http_head" | "playwright_browser";
  requestMethod: "GET" | "HEAD";
  httpStatus: number | null;
  finalUrl: string;
  redirectChain: RedirectHop[];
  outcome: ExternalLinkOutcome;
  reason: string;
  checkedAt: string;
}

export interface ExternalLinkTelemetry {
  uniqueExternalUrlsCount: number;
  totalExternalOccurrences: number;
  confirmedOkCount: number;
  redirectedOkCount: number;
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

export interface FormControlFact {
  tag: string;
  type?: string;
  name?: string;
  id?: string;
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
}

export interface LandmarkFacts {
  hasMain: boolean;
  mainCount: number;
  navCount: number;
  footerCount: number;
  headerCount: number;
  asideCount: number;
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

  // Rendering & Completeness
  renderMode: RenderMode;
  renderReason?: string;
  renderConfidence: RenderConfidence;
  rawWordCount: number;
  renderedWordCount?: number;
  rawH1Count: number;
  renderedH1Count?: number;
  rawTitle: string | null;
  renderedTitle?: string | null;
  structuredDataJobTitle?: string | null;
  soft404Status: Soft404Status;

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
  openGraph: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
    url?: string | null;
    type?: string | null;
  };
  twitterCard: {
    card?: string | null;
    title?: string | null;
    description?: string | null;
    image?: string | null;
  };
  schemaJsonLd: JsonLdBlock[];
  classification: PageClassification;
  simHashFingerprint?: string;
  mainTextSnippet?: string;
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
  sourceSitemap: string;
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
}
