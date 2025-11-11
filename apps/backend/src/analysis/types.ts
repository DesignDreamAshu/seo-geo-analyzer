import type { CheerioAPI } from "cheerio";

export type AnalyzeStrategy = "mobile" | "desktop";

export type ModuleKey =
  | "performance"
  | "schema"
  | "geo"
  | "seo_basics"
  | "social"
  | "security"
  | "accessibility"
  | "links";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  weight: number;
  description: string;
}

export interface ModuleIssues {
  critical: number;
  warning: number;
  info: number;
}

export interface HighlightEntry {
  label: string;
  value: string;
  status?: "good" | "warn" | "info" | "poor";
}

export interface ModuleDetails {
  highlights?: HighlightEntry[];
  [key: string]: unknown;
}

export interface ModuleResult {
  key: ModuleKey;
  label: string;
  weight: number;
  score: number;
  summary: string;
  recommendations: string[];
  issues: ModuleIssues;
  details: ModuleDetails;
  lastChecked: string;
}

export interface AnalyzeOptions {
  url: string;
  strategy?: AnalyzeStrategy;
  locale?: string;
  skipCache?: boolean;
  signal?: AbortSignal;
}

export interface PsiAuditEntry {
  id?: string;
  score?: number | null;
  numericValue?: number | null;
  displayValue?: string | null;
  details?: unknown;
}

export interface PsiResponse {
  id?: string;
  lighthouseResult?: {
    requestedUrl?: string;
    finalUrl?: string;
    categories?: Record<string, { score?: number | null } | undefined>;
    audits?: Record<string, PsiAuditEntry | undefined>;
  };
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, Record<string, unknown>>;
  };
  analysisUTCTimestamp?: string;
  version?: {
    major?: number;
    minor?: number;
  };
  [key: string]: unknown;
}

export interface HtmlFetchResult {
  html: string;
  statusCode: number;
  headers: Record<string, string>;
  finalUrl: string;
  dom: CheerioAPI;
  contentType: string | null;
}

export interface RobotsResult {
  text: string | null;
  fetchedFrom: string | null;
}

export interface SitemapEntrySummary {
  loc: string;
  lastmod?: string;
  alternates?: Array<{ hreflang: string; href: string }>;
}

export interface SitemapSummary {
  urls: string[];
  fetched: Array<{
    url: string;
    ok: boolean;
    statusCode?: number;
    entries?: SitemapEntrySummary[];
  }>;
  hasHreflang: boolean;
}

export interface GeoLookupResult {
  status?: "success" | "fail";
  country?: string;
  countryCode?: string;
  regionName?: string;
  isp?: string;
  query?: string;
  message?: string;
}

export interface LinkSampleEntry {
  url: string;
  statusCode: number | null;
  ok: boolean;
  rel?: string;
}

export interface LinkSampleSummary {
  total: number;
  checked: LinkSampleEntry[];
  broken: LinkSampleEntry[];
  nofollow: number;
}

export interface AnalysisContext {
  url: URL;
  normalizedUrl: string;
  locale: string;
  targetCountry: string | null;
  strategy: AnalyzeStrategy;
  psi: PsiResponse;
  html: string;
  dom: CheerioAPI;
  headers: Record<string, string>;
  robotsTxt: string | null;
  sitemap: SitemapSummary | null;
  geo: GeoLookupResult | null;
  linkSample: LinkSampleSummary;
}

export interface AnalysisResult {
  ok: boolean;
  url: string;
  strategy: AnalyzeStrategy;
  locale: string;
  overall: number;
  modules: ModuleResult[];
  raw: {
    psi: PsiResponse;
    headers: Record<string, string>;
    robots: string | null;
    sitemap: SitemapSummary | null;
    geo: GeoLookupResult | null;
  };
  timingMs: number;
  startedAt: string;
  finishedAt: string;
  historySnapshots: Array<{ timestamp: string; overallScore: number }>;
}

export interface AnalysisRecord {
  id: string;
  url: string;
  normalizedUrl: string;
  strategy: AnalyzeStrategy;
  locale: string;
  overall: number;
  modules: ModuleResult[];
  createdAt: string;
}

export type AnalysisHistorySnapshot = { timestamp: string; overallScore: number };

