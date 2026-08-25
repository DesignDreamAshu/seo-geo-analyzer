/**
 * Phase 9 GEO / AEO / AI Search Intelligence Data Contracts & Types.
 * Strictly separates deterministic technical barriers from heuristic content opportunities
 * and external observed metrics.
 */

export type AiCrawlerRole =
  | "SEARCH_INDEXER"
  | "TRAINING_CRAWLER"
  | "USER_INITIATED_RETRIEVAL"
  | "ROLE_UNCERTAIN";

export type CrawlerConfidenceLevel =
  | "CONFIRMED_BY_PROVIDER"
  | "DOCUMENTED_BY_PROVIDER"
  | "DOCUMENTED_ECOSYSTEM"
  | "ROLE_UNCERTAIN";

export interface AiCrawlerDefinition {
  provider: string;
  crawlerName: string;
  userAgent: string;
  role: AiCrawlerRole;
  officialSourceUrl: string;
  sourceTitle: string;
  lastVerifiedDate: string;
  statedPurpose: string;
  searchVisibilityImplication: string;
  trainingImplication: string;
  confidence: CrawlerConfidenceLevel;
  notes?: string;
}

export type AccessStatus =
  | "ALLOWED"
  | "DISALLOWED"
  | "CONDITIONAL"
  | "INHERITED_WILDCARD_ALLOWED"
  | "INHERITED_WILDCARD_DISALLOWED"
  | "NO_ROBOTS_TXT";

export type SearchAccessRisk =
  | "SEARCH_ACCESS_BLOCKED"
  | "SEARCH_DISCOVERABILITY_HIGH_RISK"
  | "NONE";

export interface AiCrawlerAccessFinding {
  crawler: AiCrawlerDefinition;
  accessStatus: AccessStatus;
  matchedDirective: string | null;
  matchedPattern: string | null;
  confidence: "confirmed" | "likely" | "heuristic";
  evidence: string;
  affectedScope: "sitewide" | "path_specific" | "none";
  searchAccessRisk: SearchAccessRisk;
  trainingOptOutConfirmed: boolean;
  remediationGuidance?: string;
}

export type ReadinessGrade =
  | "STRONG"
  | "ADEQUATE"
  | "NEEDS_REVIEW"
  | "LIMITED"
  | "NOT_EVALUATED";

export type PageIntentClass =
  | "homepage"
  | "service_product"
  | "category_collection"
  | "article_blog"
  | "informational_guide"
  | "faq"
  | "comparison"
  | "case_study"
  | "location"
  | "about"
  | "contact"
  | "utility"
  | "legal"
  | "unknown";

export interface PageIntentClassification {
  primaryClass: PageIntentClass;
  confidence: "CONFIRMED" | "HIGH" | "MODERATE" | "INFERRED";
  applicableHeuristics: {
    answerFirstDefinitionExpected: boolean;
    faqStructureExpected: boolean;
    editorialAuthorExpected: boolean;
    comparisonTableExpected: boolean;
    entityIdentityExpected: boolean;
  };
  evidenceSignals: string[];
}

export interface DirectAnswerCandidate {
  questionOrHeading: string;
  headingLevel: number;
  conciseAnswerText: string;
  wordCount: number;
  domLocation: string; // Valid CSS selector or semantic DOM locator
  format: "definition" | "qa_pair" | "step_procedure" | "table_summary";
  confidence: "high" | "moderate";
}

export interface EntityConsistencyReport {
  visibleOrganizationName: string | null;
  schemaOrganizationName: string | null;
  visibleAuthor: string | null;
  schemaAuthor: string | null;
  visibleDate: string | null;
  schemaDatePublished: string | null;
  schemaDateModified: string | null;
  isOrganizationConsistent: boolean;
  isAuthorConsistent: boolean;
  isDateConsistent: boolean;
  discrepancies: string[];
  normalizationNotes: string[];
}

export type ExternalAiVisibilityStatus =
  | "AI_VISIBILITY_OBSERVED"
  | "AI_VISIBILITY_NOT_MEASURED"
  | "AI_VISIBILITY_SOURCE_UNAVAILABLE"
  | "AI_VISIBILITY_DATA_STALE"
  | "AI_VISIBILITY_PARTIAL";

export type GoogleGenAiReportingStatus =
  | "GOOGLE_GEN_AI_UI_REPORT_AVAILABLE"
  | "GOOGLE_GEN_AI_PUBLIC_API_AVAILABLE"
  | "GOOGLE_GEN_AI_PUBLIC_API_NOT_DOCUMENTED"
  | "GOOGLE_GEN_AI_PROPERTY_NOT_ELIGIBLE"
  | "GOOGLE_GEN_AI_DATA_NOT_AVAILABLE";

export interface ExternalAiVisibilityData {
  status: ExternalAiVisibilityStatus;
  source: "GSC_SEARCH_ANALYTICS" | "OBSERVED_FEED" | "NONE";
  googleGenAiStatus: GoogleGenAiReportingStatus;
  totalCitationsObserved: number;
  measuredDateRange?: { start: string; end: string };
  providerBreakdown: {
    googleAiOverview: {
      status: ExternalAiVisibilityStatus;
      uiReportStatus: "GOOGLE_GEN_AI_UI_REPORT_AVAILABLE" | "NOT_ELIGIBLE" | "UNKNOWN";
      apiAvailabilityStatus: "GOOGLE_GEN_AI_PUBLIC_API_NOT_DOCUMENTED" | "API_CONNECTED";
      notes: string;
    };
    chatGptSearch: { status: ExternalAiVisibilityStatus; notes: string };
    perplexity: { status: ExternalAiVisibilityStatus; notes: string };
  };
  evidenceStatement: string;
}

export interface LlmsTxtReport {
  hasLlmsTxt: boolean;
  hasLlmsFullTxt: boolean;
  llmsTxtUrl: string | null;
  llmsFullTxtUrl: string | null;
  characterCount: number;
  status: "PRESENT" | "NOT_PRESENT";
  advisoryNote: string;
}

export interface AiReadinessDimensions {
  crawlRetrievalReadiness: {
    grade: ReadinessGrade;
    summary: string;
    details: {
      searchIndexersAllowed: number;
      searchIndexersTotal: number;
      trainingCrawlersAllowed: number;
      trainingCrawlersTotal: number;
      hasRawHtmlPrimaryContent: boolean;
    };
  };
  structuralExtractability: {
    grade: ReadinessGrade;
    summary: string;
    details: {
      hasSemanticMain: boolean;
      hasClearH1: boolean;
      headingsOutlineValid: boolean;
      structuredElementsCount: {
        tables: number;
        lists: number;
        definitionLists: number;
      };
      averageParagraphWordCount: number;
    };
  };
  entityClarity: {
    grade: ReadinessGrade;
    summary: string;
    details: {
      primaryEntityIdentified: string | null;
      schemaTypeDeclared: string | null;
      isIdentityConsistent: boolean;
      inconsistencies: string[];
    };
  };
  answerExtractability: {
    grade: ReadinessGrade;
    summary: string;
    details: {
      pageIntent: PageIntentClass;
      directAnswerCandidatesCount: number;
      qaPairsCount: number;
      hasConciseDefinition: boolean;
      isContentChunked: boolean;
    };
  };
  structuredDataConsistency: {
    grade: ReadinessGrade;
    summary: string;
    details: {
      schemaBlocksCount: number;
      schemaContentMatches: boolean;
      discrepancies: string[];
    };
  };
  searchDemandOpportunity: {
    grade: "HIGH_DEMAND" | "MODERATE_DEMAND" | "LOW_DEMAND" | "NO_GSC_DATA";
    informationalQueriesCount: number;
    topInformationalQuery?: string;
    impressions: number;
    averagePosition: number;
  };
  externalAiVisibility: ExternalAiVisibilityData;
}

export interface GeoAeoFinding {
  signalCode: string;
  evidenceClass: "DETERMINISTIC_BARRIER" | "HIGH_CONFIDENCE_SIGNAL" | "ADVISORY_HEURISTIC" | "OBSERVED_EXTERNAL";
  title: string;
  category: string;
  severity: "critical" | "warning" | "opportunity" | "info";
  confidence: "confirmed" | "likely" | "heuristic" | "manual_review";
  affectedUrl: string;
  observedState: string;
  interpretation: string;
  whereToFix: string;
  locationCertainty: "CONFIRMED" | "HIGH_CONFIDENCE" | "LIKELY" | "MANUAL_REVIEW";
  remediation: string;
  caution: string;
  owner: string;
  verification: string;
}

export interface GeoAeoAuditResult {
  url: string;
  evaluatedAt: string;
  pageIntent: PageIntentClassification;
  crawlerAccess: AiCrawlerAccessFinding[];
  dimensions: AiReadinessDimensions;
  directAnswers: DirectAnswerCandidate[];
  entityConsistency: EntityConsistencyReport;
  llmsTxt: LlmsTxtReport;
  findings: GeoAeoFinding[];
}
