import { SerpSnapshot } from "../competitor-serp/types";

export interface GscCountryPerformance {
  country: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topUrl: string;
}

export type InternationalApplicability =
  | "SINGLE_LANGUAGE_SINGLE_MARKET"
  | "SINGLE_LANGUAGE_MULTI_MARKET"
  | "MULTILINGUAL_SINGLE_MARKET"
  | "MULTILINGUAL_MULTI_MARKET"
  | "GLOBAL_GENERIC"
  | "UNKNOWN_INTERNATIONAL_APPLICABILITY";

export type LocaleType =
  | "LANGUAGE_ONLY"
  | "LANGUAGE_REGION"
  | "GLOBAL_DEFAULT";

export type HreflangDeclarationSource =
  | "HTML"
  | "SITEMAP"
  | "HTTP_HEADER";

export type ReciprocityState =
  | "HREFLANG_RECIPROCAL"
  | "HREFLANG_RETURN_LINK_MISSING"
  | "HREFLANG_RECIPROCITY_INCONCLUSIVE";

export type XDefaultState =
  | "X_DEFAULT_VALID"
  | "X_DEFAULT_MISSING_ADVISORY"
  | "X_DEFAULT_MULTIPLE_CONFLICT"
  | "X_DEFAULT_TARGET_INVALID"
  | "X_DEFAULT_NOT_APPLICABLE";

export type CanonicalCompatibilityState =
  | "HREFLANG_CANONICAL_ALIGNED"
  | "HREFLANG_CANONICAL_CONFLICT"
  | "CROSS_LANGUAGE_CANONICAL_REVIEW"
  | "HREFLANG_CANONICAL_REVIEW";

export type LanguageAlignmentState =
  | "LANGUAGE_ALIGNED"
  | "LANGUAGE_POSSIBLE_MISMATCH"
  | "HREFLANG_CONTENT_LANGUAGE_MISMATCH"
  | "LANGUAGE_INSUFFICIENT_EVIDENCE";

export type UrlArchitectureType =
  | "CCTLD"
  | "SUBDOMAIN"
  | "SUBDIRECTORY"
  | "PARAMETER"
  | "MIXED_ARCHITECTURE";

export interface LocaleDefinition {
  localeId: string;
  projectId: string;
  languageCode: string;
  regionCode?: string;
  hreflangCode: string; // e.g. "en", "en-US", "en-GB", "fr-FR", "x-default"
  localeType: LocaleType;
  configuredDomains?: string[];
  configuredPathPrefixes?: string[];
  configuredSubdomains?: string[];
  provenance: {
    source: "CONFIGURED" | "DISCOVERED_HREFLANG" | "DISCOVERED_URL_PATH" | "DISCOVERED_HTML_LANG";
    retrievedAt: string;
  };
}

export interface HreflangEdge {
  sourceUrl: string;
  targetUrl: string;
  hreflang: string;
  sourceType: HreflangDeclarationSource;
  isSelfReference: boolean;
  isValidCode: boolean;
  codeValidationIssue?: string;
}

export interface LocalePageReference {
  url: string;
  localeCode: string;
  statusCode?: number;
  isIndexable: boolean;
  canonicalUrl?: string;
  detectedContentLanguage?: string;
  htmlLangAttribute?: string;
}

export interface HreflangCluster {
  clusterId: string;
  pages: LocalePageReference[];
  declaredAlternates: HreflangEdge[];
  xDefaultUrl?: string;
  xDefaultState: XDefaultState;
  reciprocityState: ReciprocityState;
  hasDuplicateLocaleTargets: boolean;
  duplicateLocaleDetails?: string[];
  completenessState: "COMPLETE_CLUSTER" | "PARTIAL_INTENTIONAL_CLUSTER" | "INCOMPLETE_CLUSTER";
  canonicalCompatibility: CanonicalCompatibilityState;
  provenance: {
    sources: HreflangDeclarationSource[];
    evaluatedAt: string;
  };
}

export interface RegionalVariantReview {
  sourceUrl: string;
  targetUrl: string;
  sourceLocale: string;
  targetLocale: string;
  textSimilarity: number;
  detectedRegionalDifferences: string[]; // e.g. ["CURRENCY_USD_VS_GBP", "SHIPPING_TERMS", "PHONE_NUMBER"]
  classification: "VALID_REGIONAL_VARIANT" | "REGIONAL_DIFFERENTIATION_REVIEW";
  rationale: string;
}

export interface InternationalSeoSnapshot {
  snapshotId: string;
  projectId: string;
  applicability: InternationalApplicability;
  locales: LocaleDefinition[];
  clusters: HreflangCluster[];
  urlArchitecture: UrlArchitectureType;
  retrievalTimestamp: string;
  completeness: "INTERNATIONAL_DATA_COMPLETE" | "INTERNATIONAL_DATA_PARTIAL" | "INTERNATIONAL_SEO_NOT_APPLICABLE";
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface InternationalSeoIntelligenceReport {
  generatedAt: string;
  projectId: string;
  applicability: InternationalApplicability;
  applicabilityRationale: string;
  urlArchitecture: UrlArchitectureType;
  appliedPolicy: {
    policyName: string;
    selectionSource: string;
    similarityThresholdForRegionalVariant: number;
    minClusterSampleSize: number;
  };
  locales: LocaleDefinition[];
  totalObservedAlternatesCount: number;
  totalClustersCount: number;
  clusters: HreflangCluster[];
  reciprocityIssues: Array<{
    sourceUrl: string;
    declaredHreflang: string;
    targetUrl: string;
    missingReturnReferenceUrl: string;
    issueState: ReciprocityState;
  }>;
  targetHealthIssues: Array<{
    sourceUrl: string;
    targetUrl: string;
    hreflang: string;
    targetStatusCode?: number;
    issueType: "HREFLANG_TARGET_404" | "HREFLANG_TARGET_REDIRECT" | "HREFLANG_TARGET_NOINDEX" | "HREFLANG_TARGET_CANONICAL_MISMATCH";
    details: string;
  }>;
  canonicalConflicts: Array<{
    url: string;
    locale: string;
    canonicalUrl: string;
    conflictType: CanonicalCompatibilityState;
    details: string;
  }>;
  languageMismatches: Array<{
    url: string;
    declaredHreflang: string;
    htmlLang?: string;
    detectedContentLanguage?: string;
    alignmentState: LanguageAlignmentState;
    details: string;
  }>;
  regionalVariantReviews: RegionalVariantReview[];
  sourceConsistency: {
    state: "HREFLANG_SOURCE_ALIGNED" | "HREFLANG_SOURCE_CONFLICT" | "SINGLE_SOURCE_IMPLEMENTED";
    details: string;
  };
  gscMarketPerformance: Array<{
    countryCode: string;
    countryName: string;
    clicks: number;
    impressions: number;
    topLandingUrl: string;
    expectedLocale?: string;
    alignmentState: "MARKET_ALIGNED" | "INTERNATIONAL_QUERY_PAGE_ALIGNMENT_REVIEW";
  }>;
  serpMarketObservations: Array<{
    query: string;
    country: string;
    observedIntent: string;
    topRankingUrl: string;
    intentDifferenceNote?: string;
  }>;
  historicalChanges: {
    isComparable: boolean;
    incomparabilityReason?: string;
    newlyObservedAlternates: number;
    noLongerObservedAlternates: number;
    brokenReciprocityCount: number;
  };
  governanceLimitations: string[];
  immutabilityStatement: string;
}
