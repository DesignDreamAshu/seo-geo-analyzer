/**
 * Performance & Core Web Vitals Intelligence Types
 * Strictly differentiates Crawler signals, Lab data, Field (CrUX) data, and Heuristic opportunities.
 */

export type PerformanceDataSource =
  | "CRAWLER"
  | "PSI_LAB"
  | "CRUX_FIELD"
  | "BROWSER_LOCAL"
  | "HEURISTIC"
  | "NOT_AVAILABLE";

export type FieldDataScope = "URL" | "ORIGIN" | "NONE";

export type PerformanceEvaluationStatus =
  | "EVALUATED"
  | "NOT_EVALUATED"
  | "RATE_LIMITED"
  | "API_UNAVAILABLE"
  | "ERROR";

export type CoreWebVitalsRating = "GOOD" | "NEEDS_IMPROVEMENT" | "POOR";

export type PerformanceOwnership =
  | "CONTENT"
  | "FRONTEND"
  | "BACKEND"
  | "CMS_TEMPLATE"
  | "HOSTING_CDN"
  | "THIRD_PARTY"
  | "DESIGN_ASSET"
  | "UNKNOWN";

export type PerformanceVerificationState =
  | "LAB_RESOLVED"
  | "FIELD_PENDING"
  | "FIELD_IMPROVED"
  | "FIELD_RESOLVED"
  | "NO_FIELD_DATA"
  | "INCONCLUSIVE";

export interface MetricThresholds {
  goodMax: number;
  needsImprovementMax: number;
}

export interface MetricEvaluation<T = number> {
  value: T;
  unit: "ms" | "score" | "bytes" | "count" | "ratio";
  rating: CoreWebVitalsRating;
  source: PerformanceDataSource;
  scope?: FieldDataScope;
  percentiles?: {
    goodPercent?: number;
    needsImprovementPercent?: number;
    poorPercent?: number;
  };
}

export interface LabMetrics {
  fcpMs?: number;
  lcpMs?: number;
  cls?: number;
  tbtMs?: number;
  speedIndexMs?: number;
  ttfbMs?: number;
  interactiveMs?: number;
}

export interface FieldMetrics {
  lcpP75Ms?: number;
  inpP75Ms?: number;
  clsP75?: number;
  fcpP75Ms?: number;
  ttfbP75Ms?: number;
  overallCategory?: CoreWebVitalsRating;
  sampleAvailable: boolean;
  fieldDataScope: FieldDataScope;
}

export interface PerformanceOpportunity {
  id: string;
  title: string;
  description: string;
  score?: number;
  savingsBytes?: number;
  savingsMs?: number;
  source: PerformanceDataSource;
  ownership: PerformanceOwnership;
  items?: Array<{
    url?: string;
    totalBytes?: number;
    wastedBytes?: number;
    wastedMs?: number;
    nodeSnippet?: string;
  }>;
}

export interface PerformanceDiagnosticItem {
  id: string;
  title: string;
  description: string;
  displayValue?: string;
  source: PerformanceDataSource;
}

export interface ResourcePerformanceFact {
  url: string;
  type: "script" | "stylesheet" | "image" | "font" | "document" | "other";
  transferBytes: number;
  resourceBytes: number;
  isRenderBlocking: boolean;
  isThirdParty: boolean;
  wastedBytes?: number;
  cacheControl?: string;
}

export interface ThirdPartyImpactGroup {
  entityName: string;
  category: "analytics" | "tag_manager" | "chat" | "video" | "marketing" | "social" | "fonts" | "other";
  domain: string;
  transferBytes: number;
  mainThreadBlockingTimeMs: number;
  resourceCount: number;
}

export interface LcpDiagnosis {
  metricValueMs?: number;
  rating?: CoreWebVitalsRating;
  elementSelector?: string;
  elementSnippet?: string;
  resourceUrl?: string;
  resourceType?: "image" | "text" | "video" | "other";
  isLazyLoaded?: boolean;
  fetchPriority?: string;
  likelyCauses: string[];
  confidence: "confirmed" | "likely" | "heuristic";
  evidenceSource: PerformanceDataSource;
}

export interface ClsDiagnosis {
  metricValue?: number;
  rating?: CoreWebVitalsRating;
  shiftElements: Array<{
    selector?: string;
    snippet?: string;
    scoreContribution?: number;
  }>;
  likelyCauses: string[];
  confidence: "confirmed" | "likely" | "heuristic";
  evidenceSource: PerformanceDataSource;
}

export interface InpDiagnosis {
  metricValueMs?: number;
  rating?: CoreWebVitalsRating;
  interactionType?: string;
  interactionElement?: string;
  supportingLabTbtMs?: number;
  likelyCauses: string[];
  confidence: "confirmed" | "likely" | "heuristic";
  evidenceSource: PerformanceDataSource;
}

export interface PerformanceProfile {
  strategy: "mobile" | "desktop";
  performanceScore?: number; // 0-100 composite (informational)
  lab: LabMetrics;
  field: FieldMetrics;
  lcpDiagnosis?: LcpDiagnosis;
  clsDiagnosis?: ClsDiagnosis;
  inpDiagnosis?: InpDiagnosis;
  opportunities: PerformanceOpportunity[];
  diagnostics: PerformanceDiagnosticItem[];
  resources: ResourcePerformanceFact[];
  thirdParties: ThirdPartyImpactGroup[];
  fetchedAt: string;
}

export interface CrawlerPerformanceSignals {
  ttfbMs: number;
  htmlPayloadBytes: number;
  domNodeCount?: number;
  resourceCount?: number;
  imageCount?: number;
  scriptCount?: number;
  stylesheetCount?: number;
}

export interface PagePerformanceFacts {
  url: string;
  normalizedUrl: string;
  crawlerSignals: CrawlerPerformanceSignals;
  evaluationStatus: PerformanceEvaluationStatus;
  mobile?: PerformanceProfile;
  desktop?: PerformanceProfile;
  errorMessage?: string;
}

export interface TemplatePerformanceGroup {
  templateId: string;
  templateName: string;
  routePattern: string;
  sampledUrls: string[];
  sampleCount: number;
  failingLcpCount: number;
  failingInpCount: number;
  failingClsCount: number;
  averageMobileLabScore: number;
  averageMobileLcpMs: number;
  fieldDataAvailable: boolean;
  confidence: number;
  likelySharedCauses: string[];
  estimatedPagesAffected: number;
}
