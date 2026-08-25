/**
 * Formal SEO Rule Value Model & Taxonomy
 * Classifies diagnostic rules by SEO area, impact class, impact types, confidence models, and actionable value.
 */

export type SEOImpactClass =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational"
  | "skip";

export type SEOArea =
  | "crawlability"
  | "indexability"
  | "canonicalization"
  | "internal_linking"
  | "content"
  | "headings"
  | "metadata"
  | "structured_data"
  | "images"
  | "performance"
  | "mobile"
  | "security"
  | "international"
  | "social"
  | "sitemap"
  | "redirects"
  | "technical_html";

export type ImpactType =
  | "direct_technical_seo"
  | "search_understanding"
  | "serp_visibility"
  | "crawl_efficiency"
  | "authority_flow"
  | "content_quality"
  | "performance_ux"
  | "search_feature_eligibility"
  | "technical_quality"
  | "social_discovery";

export type ConfidenceModel =
  | "confirmed"
  | "high_confidence"
  | "heuristic"
  | "manual_review"
  | "inconclusive"
  | "not_evaluated";

export interface RuleValueSpec {
  code: string;
  title: string;
  seoArea: SEOArea;
  impactClass: SEOImpactClass;
  impactTypes: ImpactType[];
  scoringEligible: boolean;
  basePenalty: number;
  confidenceModel: ConfidenceModel;
  whyItMatters: string;
  recommendedFix: string;
  sitecheckerEquivalent?: string;
  implementationStatus: "implemented_and_certified" | "in_expansion_scope" | "deferred_future" | "skipped_low_value" | "requires_external_data";
  skipOrDeferRationale?: string;
}

export const SEO_RULE_VALUE_TAXONOMY: RuleValueSpec[] = [
  // =========================================================================
  // BATCH 1: CRAWL / INDEX CONTROLS, ROBOTS, CANONICALIZATION, REDIRECTS, SOFT 404
  // =========================================================================
  {
    code: "INDEX_NOINDEX",
    title: "Noindex directive on indexable content page",
    seoArea: "indexability",
    impactClass: "critical",
    impactTypes: ["direct_technical_seo", "serp_visibility"],
    scoringEligible: true,
    basePenalty: 4.0,
    confidenceModel: "confirmed",
    whyItMatters: "Directs search engines to drop the page from search results completely.",
    recommendedFix: "Remove the 'noindex' directive from meta robots or X-Robots-Tag if this page is meant for search indexation.",
    sitecheckerEquivalent: "Page has noindex tag",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "INDEX_ROBOTS_CONFLICT",
    title: "Conflicting robots directives (e.g. meta index vs header noindex)",
    seoArea: "indexability",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "search_understanding"],
    scoringEligible: true,
    basePenalty: 2.0,
    confidenceModel: "confirmed",
    whyItMatters: "Contradictory directives cause unpredictable crawling and indexation behavior across search engine bots.",
    recommendedFix: "Align HTML meta robots and HTTP X-Robots-Tag headers to deliver a unified indexation instruction.",
    sitecheckerEquivalent: "Conflicting robots directives",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "CANONICAL_POINTS_TO_4XX",
    title: "Canonical tag points to a broken 4xx URL",
    seoArea: "canonicalization",
    impactClass: "critical",
    impactTypes: ["direct_technical_seo", "authority_flow"],
    scoringEligible: true,
    basePenalty: 4.0,
    confidenceModel: "confirmed",
    whyItMatters: "Instructs search engines to consolidate ranking equity to a non-existent page, causing indexation failure.",
    recommendedFix: "Update canonical href to point to the live self URL or an existing authoritative 200 OK document.",
    sitecheckerEquivalent: "Canonical URL has 4xx status code",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "CANONICAL_POINTS_TO_REDIRECT",
    title: "Canonical tag points to a redirect hop",
    seoArea: "canonicalization",
    impactClass: "medium",
    impactTypes: ["crawl_efficiency", "authority_flow"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Forces search engine bots through unnecessary redirect hops during canonical equity resolution.",
    recommendedFix: "Change canonical tag to directly specify the final destination URL.",
    sitecheckerEquivalent: "Canonical URL has 3xx status code",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "CANONICAL_POINTS_TO_NOINDEX",
    title: "Canonical tag points to a noindexed target page",
    seoArea: "canonicalization",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "serp_visibility"],
    scoringEligible: true,
    basePenalty: 2.5,
    confidenceModel: "confirmed",
    whyItMatters: "Canonicalizing to a page that blocks indexing can cause both the source and target to drop out of search results.",
    recommendedFix: "Point canonical tag to an indexable document or remove the noindex directive on the target page.",
    sitecheckerEquivalent: "Canonical URL is noindex",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "CANONICAL_MULTIPLE",
    title: "Multiple conflicting <link rel='canonical'> tags found",
    seoArea: "canonicalization",
    impactClass: "critical",
    impactTypes: ["direct_technical_seo", "search_understanding"],
    scoringEligible: true,
    basePenalty: 3.5,
    confidenceModel: "confirmed",
    whyItMatters: "Search engine algorithms ignore all canonical directives when multiple conflicting tags are present.",
    recommendedFix: "Ensure exactly one canonical link element is rendered in the HTML <head>.",
    sitecheckerEquivalent: "Multiple canonical URLs",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "CANONICAL_OUTSIDE_HEAD",
    title: "Canonical tag located in <body> instead of <head>",
    seoArea: "canonicalization",
    impactClass: "medium",
    impactTypes: ["direct_technical_seo", "technical_quality"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Search engine parsers may disregard canonical link tags placed in the document body.",
    recommendedFix: "Move the <link rel='canonical'> tag inside the <head> element.",
    sitecheckerEquivalent: "Canonical URL outside head",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "REDIRECT_CHAIN",
    title: "Redirect chain contains 2 or more intermediate hops",
    seoArea: "redirects",
    impactClass: "medium",
    impactTypes: ["crawl_efficiency", "authority_flow", "performance_ux"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Slows down page load times, wastes crawl budget, and can dilute link equity transfer.",
    recommendedFix: "Update the initial redirect rule or source internal link to point directly to the final 200 OK target.",
    sitecheckerEquivalent: "Redirect chain",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "REDIRECT_LOOP",
    title: "Redirect loop detected (URL cycles infinitely)",
    seoArea: "redirects",
    impactClass: "critical",
    impactTypes: ["direct_technical_seo", "crawl_efficiency", "performance_ux"],
    scoringEligible: true,
    basePenalty: 4.0,
    confidenceModel: "confirmed",
    whyItMatters: "Users and search engine crawlers cannot access the page at all due to cyclical redirection.",
    recommendedFix: "Break the redirect cycle by pointing the originating URL to an independent 200 OK endpoint.",
    sitecheckerEquivalent: "Redirect loop",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SOFT_404_CANDIDATE",
    title: "Soft 404 candidate (HTTP 200 with Not Found template)",
    seoArea: "crawlability",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "crawl_efficiency"],
    scoringEligible: false, // manual review heuristic has 0 score penalty
    basePenalty: 0.0,
    confidenceModel: "manual_review",
    whyItMatters: "Search engines may treat 200 status missing pages as low-quality content, causing index bloat.",
    recommendedFix: "Configure server to return an explicit HTTP 404 (Not Found) or 410 (Gone) status code.",
    sitecheckerEquivalent: "Soft 404",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // BATCH 2: CONTENT, METADATA & SEARCH UNDERSTANDING
  // =========================================================================
  {
    code: "TITLE_TOO_SHORT",
    title: "Title tag is too short (< 10 characters)",
    seoArea: "metadata",
    impactClass: "low",
    impactTypes: ["serp_visibility", "search_understanding"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "heuristic",
    whyItMatters: "Very short title tags miss opportunities to communicate keywords and relevance to users on SERPs.",
    recommendedFix: "Expand the title tag to 30–60 characters clearly describing the page topic and brand.",
    sitecheckerEquivalent: "Title is too short",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "TITLE_TOO_LONG",
    title: "Title tag is excessively long (> 70 characters)",
    seoArea: "metadata",
    impactClass: "low",
    impactTypes: ["serp_visibility"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "heuristic",
    whyItMatters: "Titles exceeding ~60-70 characters risk truncation in desktop and mobile search engine results pages.",
    recommendedFix: "Keep title tags between 50 and 60 characters (under ~600 pixels width) for optimal SERP display.",
    sitecheckerEquivalent: "Title is too long",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "META_DESC_TOO_SHORT",
    title: "Meta description is too short (< 50 characters)",
    seoArea: "metadata",
    impactClass: "low",
    impactTypes: ["serp_visibility"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "heuristic",
    whyItMatters: "Short descriptions provide insufficient context to encourage clicks in search results.",
    recommendedFix: "Expand meta description to 120–155 characters summarizing the unique value of the page.",
    sitecheckerEquivalent: "Description is too short",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "META_DESC_TOO_LONG",
    title: "Meta description is excessively long (> 160 characters)",
    seoArea: "metadata",
    impactClass: "low",
    impactTypes: ["serp_visibility"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "heuristic",
    whyItMatters: "Long meta descriptions will be truncated with ellipsis by search engines on SERPs.",
    recommendedFix: "Condense meta description to 120–155 characters focusing on a clear call-to-action.",
    sitecheckerEquivalent: "Description is too long",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "DUP_META_DESC",
    title: "Duplicate meta description shared across distinct indexable pages",
    seoArea: "metadata",
    impactClass: "medium",
    impactTypes: ["serp_visibility", "content_quality"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Identical snippets make it difficult for users to distinguish between different pages in search results.",
    recommendedFix: "Write unique, tailored meta descriptions for each indexable page.",
    sitecheckerEquivalent: "Duplicate description",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "DUP_H1",
    title: "Duplicate primary H1 heading shared across distinct indexable pages",
    seoArea: "headings",
    impactClass: "medium",
    impactTypes: ["search_understanding", "content_quality"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Multiple pages with the same primary topic heading dilute keyword specificity.",
    recommendedFix: "Craft distinct, descriptive H1 headings reflecting the unique subject matter of each page.",
    sitecheckerEquivalent: "Duplicate H1",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "DUP_MAIN_CONTENT_EXACT",
    title: "Exact duplicate main content text across multiple URLs",
    seoArea: "content",
    impactClass: "high",
    impactTypes: ["content_quality", "authority_flow", "crawl_efficiency"],
    scoringEligible: true,
    basePenalty: 2.5,
    confidenceModel: "confirmed",
    whyItMatters: "Search engines filter out duplicate content, splitting link equity and creating ranking confusion.",
    recommendedFix: "Consolidate duplicates with a 301 redirect, add a canonical tag, or write unique content.",
    sitecheckerEquivalent: "Duplicate content",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "DUP_MAIN_CONTENT_NEAR",
    title: "Near-duplicate main content detected (SimHash/Jaccard similarity >= 85%)",
    seoArea: "content",
    impactClass: "medium",
    impactTypes: ["content_quality", "authority_flow"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "heuristic",
    whyItMatters: "Thin boilerplate variants of the same template can trigger search engine algorithmic cannibalization.",
    recommendedFix: "Differentiate editorial content substantially or canonicalize regional/product variants.",
    sitecheckerEquivalent: "Near duplicate content",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SCHEMA_MISSING_TYPE",
    title: "JSON-LD structured data block missing @type",
    seoArea: "structured_data",
    impactClass: "medium",
    impactTypes: ["search_feature_eligibility", "search_understanding"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Search engine schema validators reject structured data entities that lack a valid @type definition.",
    recommendedFix: "Declare a valid Schema.org @type (e.g. 'Organization', 'Article', 'Product') inside the JSON-LD script.",
    sitecheckerEquivalent: "Structured data missing type",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SCHEMA_INVALID_CONTEXT",
    title: "JSON-LD structured data block missing schema.org @context",
    seoArea: "structured_data",
    impactClass: "medium",
    impactTypes: ["search_feature_eligibility", "search_understanding"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Without '@context': 'https://schema.org', parsers cannot map vocabulary terms correctly.",
    recommendedFix: "Set '@context': 'https://schema.org' at the root of every JSON-LD structured data block.",
    sitecheckerEquivalent: "Structured data invalid context",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // BATCH 3: SITE ARCHITECTURE, INTERNAL LINKING & SITEMAPS
  // =========================================================================
  {
    code: "LINKS_INTERNAL_TO_REDIRECT",
    title: "Internal link points to a 3xx redirect instead of canonical URL",
    seoArea: "internal_linking",
    impactClass: "low",
    impactTypes: ["crawl_efficiency", "authority_flow"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "confirmed",
    whyItMatters: "Passing internal links through redirect hops creates minor latency and crawl inefficiency.",
    recommendedFix: "Update the internal anchor href to point directly to the destination canonical URL.",
    sitecheckerEquivalent: "Internal link to redirect",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "ORPHAN_INDEXABLE_PAGE",
    title: "Indexable page receives 0 internal inbound links",
    seoArea: "internal_linking",
    impactClass: "high",
    impactTypes: ["authority_flow", "crawl_efficiency", "serp_visibility"],
    scoringEligible: true,
    basePenalty: 2.0,
    confidenceModel: "confirmed",
    whyItMatters: "Orphaned pages receive zero PageRank equity from the internal site architecture and are rarely crawled.",
    recommendedFix: "Add contextual internal navigation links from relevant category, blog, or navigation sections.",
    sitecheckerEquivalent: "Orphan page",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "PAGES_DEEP_CRAWL_DEPTH",
    title: "Important page requires > 4 clicks from homepage to reach",
    seoArea: "internal_linking",
    impactClass: "low",
    impactTypes: ["authority_flow", "crawl_efficiency"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "heuristic",
    whyItMatters: "Pages buried deep in the site hierarchy receive minimal crawl budget and lower internal link equity.",
    recommendedFix: "Add top-level category or featured links to bring important content within 2–3 clicks of the homepage.",
    sitecheckerEquivalent: "High crawl depth",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SITEMAP_URL_4XX",
    title: "XML sitemap lists a URL returning a 4xx error",
    seoArea: "sitemap",
    impactClass: "high",
    impactTypes: ["crawl_efficiency", "direct_technical_seo"],
    scoringEligible: true,
    basePenalty: 2.5,
    confidenceModel: "confirmed",
    whyItMatters: "Submitting broken URLs in sitemaps wastes search engine crawl budget and signals poor site health.",
    recommendedFix: "Remove the 4xx URL from the sitemap or restore the missing page.",
    sitecheckerEquivalent: "Sitemap contains 4xx URLs",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SITEMAP_URL_REDIRECT",
    title: "XML sitemap lists a URL that redirects (3xx)",
    seoArea: "sitemap",
    impactClass: "medium",
    impactTypes: ["crawl_efficiency", "authority_flow"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Sitemaps should contain only canonical 200 OK URLs to guide bot crawling cleanly.",
    recommendedFix: "Update the sitemap entry to point directly to the final 200 destination URL.",
    sitecheckerEquivalent: "Sitemap contains redirect URLs",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SITEMAP_URL_NOINDEX",
    title: "XML sitemap lists a URL containing a noindex directive",
    seoArea: "sitemap",
    impactClass: "medium",
    impactTypes: ["direct_technical_seo", "search_understanding"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Submitting a URL in the sitemap while instructing bots not to index it sends conflicting signals.",
    recommendedFix: "Remove noindexed URLs from the sitemap or remove the noindex directive if the page is valuable.",
    sitecheckerEquivalent: "Sitemap contains noindex URLs",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "SITEMAP_MALFORMED_XML",
    title: "XML sitemap fails XML validation or syntax parsing",
    seoArea: "sitemap",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "crawl_efficiency"],
    scoringEligible: true,
    basePenalty: 3.0,
    confidenceModel: "confirmed",
    whyItMatters: "Malformed XML causes search engine sitemap parsers to reject the entire sitemap file.",
    recommendedFix: "Correct syntax errors, unclosed tags, or unescaped characters in the XML sitemap file.",
    sitecheckerEquivalent: "Malformed sitemap XML",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // BATCH 4: IMAGES & BROKEN STATIC RESOURCES
  // =========================================================================
  {
    code: "IMAGE_BROKEN",
    title: "Embedded image returns a 4xx/5xx HTTP error",
    seoArea: "images",
    impactClass: "medium",
    impactTypes: ["performance_ux", "technical_quality"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Broken images create a poor user experience and display visual error artifacts.",
    recommendedFix: "Replace or remove broken image links, or update the src attribute to a valid image URL.",
    sitecheckerEquivalent: "Broken images",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "RESOURCE_BROKEN_SCRIPT",
    title: "JavaScript resource (<script src>) returns a 4xx/5xx error",
    seoArea: "technical_html",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "performance_ux"],
    scoringEligible: true,
    basePenalty: 2.5,
    confidenceModel: "confirmed",
    whyItMatters: "Failed script loads can break page interactivity, client-side rendering, and tracking.",
    recommendedFix: "Fix the broken script path or remove unused script tags from the document.",
    sitecheckerEquivalent: "Broken JavaScript",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "RESOURCE_BROKEN_STYLESHEET",
    title: "Stylesheet resource (<link rel='stylesheet'>) returns a 4xx/5xx error",
    seoArea: "technical_html",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "performance_ux"],
    scoringEligible: true,
    basePenalty: 2.5,
    confidenceModel: "confirmed",
    whyItMatters: "Missing CSS files result in unstyled page renders and severe layout instability.",
    recommendedFix: "Verify the stylesheet URL and ensure the CSS bundle is properly deployed.",
    sitecheckerEquivalent: "Broken CSS",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "IMAGE_LINK_MISSING_ALT",
    title: "Linked image missing alt text and accessible link name",
    seoArea: "images",
    impactClass: "medium",
    impactTypes: ["authority_flow", "search_understanding"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "When an image is wrapped in an anchor without text or alt, search bots cannot determine anchor equity context.",
    recommendedFix: "Add descriptive alt text to the <img> tag or an aria-label attribute to the enclosing <a> tag.",
    sitecheckerEquivalent: "Image link without alt",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // BATCH 5: INTERNATIONAL SEO / HREFLANG
  // =========================================================================
  {
    code: "HREFLANG_INVALID_CODE",
    title: "Hreflang tag contains invalid language or region code",
    seoArea: "international",
    impactClass: "medium",
    impactTypes: ["direct_technical_seo", "search_understanding"],
    scoringEligible: true,
    basePenalty: 1.5,
    confidenceModel: "confirmed",
    whyItMatters: "Search engine algorithms ignore hreflang annotations with invalid ISO 639-1 / ISO 3166-1 codes.",
    recommendedFix: "Use standard BCP 47 language codes (e.g. 'en', 'es-ES', 'de-DE', 'x-default').",
    sitecheckerEquivalent: "Invalid hreflang code",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "HREFLANG_MISSING_RETURN",
    title: "Hreflang annotation lacks reciprocal return link on target page",
    seoArea: "international",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "search_understanding"],
    scoringEligible: true,
    basePenalty: 2.0,
    confidenceModel: "confirmed",
    whyItMatters: "Google ignores hreflang clusters unless both pages reciprocally link to each other.",
    recommendedFix: "Add matching reciprocal hreflang annotations across all localized versions in the cluster.",
    sitecheckerEquivalent: "Hreflang missing return link",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "HREFLANG_SELF_REF_MISSING",
    title: "Localized page missing self-referencing hreflang tag",
    seoArea: "international",
    impactClass: "medium",
    impactTypes: ["direct_technical_seo", "search_understanding"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Best practice requires every localized URL in an hreflang cluster to include a self-referencing hreflang tag.",
    recommendedFix: "Include an hreflang tag pointing to the current page's own URL.",
    sitecheckerEquivalent: "Hreflang missing self-reference",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // BATCH 6: MOBILE, VIEWPORT & PERFORMANCE
  // =========================================================================
  {
    code: "MOBILE_VIEWPORT_MISSING",
    title: "Missing <meta name='viewport'> tag in <head>",
    seoArea: "mobile",
    impactClass: "critical",
    impactTypes: ["performance_ux", "direct_technical_seo"],
    scoringEligible: true,
    basePenalty: 3.5,
    confidenceModel: "confirmed",
    whyItMatters: "Mobile browsers will render the page with desktop scaling, causing usability failure on smartphones.",
    recommendedFix: "Add `<meta name='viewport' content='width=device-width, initial-scale=1'>` to `<head>`.",
    sitecheckerEquivalent: "Viewport tag missing",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "MOBILE_VIEWPORT_INVALID",
    title: "Invalid viewport meta tag (missing device-width or disables user zoom)",
    seoArea: "mobile",
    impactClass: "medium",
    impactTypes: ["performance_ux", "technical_quality"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Setting user-scalable=no or fixed pixel widths breaks mobile responsiveness and WCAG accessibility standards.",
    recommendedFix: "Use standard `width=device-width, initial-scale=1` and avoid disabling user scaling.",
    sitecheckerEquivalent: "Invalid viewport configuration",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "PERF_LARGE_HTML_PAYLOAD",
    title: "Excessively large raw HTML document payload (> 2 MB)",
    seoArea: "performance",
    impactClass: "low",
    impactTypes: ["performance_ux", "crawl_efficiency"],
    scoringEligible: true,
    basePenalty: 0.5,
    confidenceModel: "heuristic",
    whyItMatters: "Very large HTML documents slow DOM parsing, delay Time to First Byte (TTFB), and increase crawler memory.",
    recommendedFix: "Remove bloated inline JSON state, optimize SSR bundles, and enable server Gzip/Brotli compression.",
    sitecheckerEquivalent: "Large page size",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // BATCH 7: SECURITY-LITE & TECHNICAL HTML
  // =========================================================================
  {
    code: "SEC_MIXED_CONTENT",
    title: "Mixed content (insecure HTTP resources on HTTPS page)",
    seoArea: "security",
    impactClass: "high",
    impactTypes: ["direct_technical_seo", "performance_ux", "technical_quality"],
    scoringEligible: true,
    basePenalty: 2.0,
    confidenceModel: "confirmed",
    whyItMatters: "Browsers block insecure passive/active HTTP resources on HTTPS origins and display security warnings.",
    recommendedFix: "Change all internal and external asset URLs (scripts, styles, images) to use secure 'https://' protocols.",
    sitecheckerEquivalent: "Mixed content",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "HTML_TITLE_MULTIPLE",
    title: "Multiple <title> tags declared in HTML document",
    seoArea: "technical_html",
    impactClass: "medium",
    impactTypes: ["search_understanding", "technical_quality"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Having multiple title tags causes unpredictable snippet selection across search engines.",
    recommendedFix: "Remove duplicate title tags, leaving exactly one descriptive title element in <head>.",
    sitecheckerEquivalent: "Multiple title tags",
    implementationStatus: "in_expansion_scope",
  },
  {
    code: "HTML_META_DESC_MULTIPLE",
    title: "Multiple <meta name='description'> tags declared in HTML",
    seoArea: "technical_html",
    impactClass: "medium",
    impactTypes: ["search_understanding", "technical_quality"],
    scoringEligible: true,
    basePenalty: 1.0,
    confidenceModel: "confirmed",
    whyItMatters: "Multiple meta descriptions confuse search engines when generating SERP preview snippets.",
    recommendedFix: "Retain exactly one primary meta description tag in the document <head>.",
    sitecheckerEquivalent: "Multiple meta description tags",
    implementationStatus: "in_expansion_scope",
  },

  // =========================================================================
  // LOW-VALUE / SKIPPED CANDIDATE CHECKS (DOCUMENTED TRANSPARENTLY)
  // =========================================================================
  {
    code: "TITLE_STARTS_LOWERCASE",
    title: "Title starts with lowercase character",
    seoArea: "metadata",
    impactClass: "skip",
    impactTypes: ["content_quality"],
    scoringEligible: false,
    basePenalty: 0.0,
    confidenceModel: "heuristic",
    whyItMatters: "Stylistic preference with zero empirical search engine ranking impact.",
    recommendedFix: "Optional editorial styling.",
    sitecheckerEquivalent: "Title begins with lowercase",
    implementationStatus: "skipped_low_value",
    skipOrDeferRationale: "Noisy cosmetic check; lowercase brand names like 'eBay', 'iPhone', 'adidas' are valid.",
  },
  {
    code: "H1_STARTS_LOWERCASE",
    title: "H1 starts with lowercase character",
    seoArea: "headings",
    impactClass: "skip",
    impactTypes: ["content_quality"],
    scoringEligible: false,
    basePenalty: 0.0,
    confidenceModel: "heuristic",
    whyItMatters: "Stylistic preference with zero search ranking impact.",
    recommendedFix: "Optional editorial styling.",
    sitecheckerEquivalent: "H1 begins with lowercase",
    implementationStatus: "skipped_low_value",
    skipOrDeferRationale: "Noisy cosmetic check with no SEO value.",
  },
  {
    code: "KEYWORD_DENSITY_SCORE",
    title: "Keyword density percentage check",
    seoArea: "content",
    impactClass: "skip",
    impactTypes: ["search_understanding"],
    scoringEligible: false,
    basePenalty: 0.0,
    confidenceModel: "heuristic",
    whyItMatters: "Outdated 1990s ranking heuristic rejected by modern semantic search engines.",
    recommendedFix: "Write natural, high-quality editorial content.",
    sitecheckerEquivalent: "Keyword density calculation",
    implementationStatus: "skipped_low_value",
    skipOrDeferRationale: "Google algorithms do not use keyword density; promotes spammy keyword stuffing.",
  },
  {
    code: "EXACT_100_LINK_LIMIT",
    title: "Page has more than 100 links",
    seoArea: "internal_linking",
    impactClass: "skip",
    impactTypes: ["crawl_efficiency"],
    scoringEligible: false,
    basePenalty: 0.0,
    confidenceModel: "heuristic",
    whyItMatters: "Outdated Google guidance from 2008 superseded by modern crawl infrastructure.",
    recommendedFix: "Structure navigation reasonably for users.",
    sitecheckerEquivalent: "More than 100 links",
    implementationStatus: "skipped_low_value",
    skipOrDeferRationale: "Modern e-commerce and megamenus routinely have 150+ valid links without penalty.",
  },

  // =========================================================================
  // EXTERNAL DATA REQUIRED (GSC / CRUX)
  // =========================================================================
  {
    code: "GSC_HIGH_IMPRESSION_ORPHAN",
    title: "Page receives GSC search impressions but has 0 internal links",
    seoArea: "internal_linking",
    impactClass: "high",
    impactTypes: ["authority_flow", "serp_visibility"],
    scoringEligible: false,
    basePenalty: 0.0,
    confidenceModel: "not_evaluated",
    whyItMatters: "High-traffic search landing page is decoupled from the site's navigation architecture.",
    recommendedFix: "Add internal navigation links to support search rankings.",
    sitecheckerEquivalent: "Search Console orphan with impressions",
    implementationStatus: "requires_external_data",
    skipOrDeferRationale: "Requires active Google Search Console API OAuth integration.",
  },
  {
    code: "CRUX_FIELD_CWV_FAIL",
    title: "Field Core Web Vitals (LCP/INP/CLS) failed in CrUX dataset",
    seoArea: "performance",
    impactClass: "high",
    impactTypes: ["performance_ux", "direct_technical_seo"],
    scoringEligible: false,
    basePenalty: 0.0,
    confidenceModel: "not_evaluated",
    whyItMatters: "Real-user field performance metrics are used directly in Google Page Experience ranking signals.",
    recommendedFix: "Optimize real-user Largest Contentful Paint, Interaction to Next Paint, and Layout Shift.",
    sitecheckerEquivalent: "Core Web Vitals failed",
    implementationStatus: "requires_external_data",
    skipOrDeferRationale: "Requires Chrome User Experience Report (CrUX) API token and 28-day sample volume.",
  },
];
