/**
 * Master GEO / AEO / AI Search Intelligence Engine.
 * Evaluates crawler accessibility, extractability, entity clarity, structured data consistency,
 * and search demand integration using transparent qualitative grades (no arbitrary 0-100 scores).
 */

import { CrawledPageData } from "../types";
import { PageGscMetrics } from "../gsc/types";
import { inspectAiCrawlerAccess } from "./robots-inspector";
import { evaluateContentExtractability } from "./extractability";
import { evaluateEntityConsistency } from "./entity-consistency";
import { evaluateAnswerReadiness } from "./answer-readiness";
import { findGscAeoOpportunities } from "./gsc-aeo-prioritizer";
import {
  GeoAeoAuditResult,
  AiReadinessDimensions,
  ReadinessGrade,
  LlmsTxtReport,
  ExternalAiVisibilityData,
  GeoAeoFinding,
} from "./types";

export function auditPageForAiSearch(
  page: CrawledPageData,
  robotsTxtContent: string | null = null,
  gscData?: PageGscMetrics | null,
  llmsTxtReport?: LlmsTxtReport
): GeoAeoAuditResult {
  const urlPath = new URL(page.url).pathname;

  // 1. Evaluate AI Crawler Accessibility
  const crawlerAccess = inspectAiCrawlerAccess(robotsTxtContent, urlPath);

  // 2. Evaluate Content Extractability
  const extractability = evaluateContentExtractability(page);

  // 3. Evaluate Entity Consistency
  const entityConsistency = evaluateEntityConsistency(page);

  // 4. Evaluate Answer Readiness & Intent Classification
  const answerReadiness = evaluateAnswerReadiness(page);

  // 5. Evaluate GSC Opportunities
  const gscOpportunities = findGscAeoOpportunities(page.url, gscData, answerReadiness);

  // 6. Calculate Transparent Qualitative Grades (NO arbitrary 0-100 precision)
  const searchBots = crawlerAccess.filter((c) => c.crawler.role === "SEARCH_INDEXER");
  const searchAllowedCount = searchBots.filter(
    (c) => c.accessStatus === "ALLOWED" || c.accessStatus === "INHERITED_WILDCARD_ALLOWED" || c.accessStatus === "NO_ROBOTS_TXT"
  ).length;

  const trainingBots = crawlerAccess.filter((c) => c.crawler.role === "TRAINING_CRAWLER");
  const trainingAllowedCount = trainingBots.filter(
    (c) => c.accessStatus === "ALLOWED" || c.accessStatus === "INHERITED_WILDCARD_ALLOWED" || c.accessStatus === "NO_ROBOTS_TXT"
  ).length;

  // Dimension 1: Crawl & Retrieval Readiness
  let crawlGrade: ReadinessGrade = "STRONG";
  if (!extractability.rawHtmlPrimaryContentPresent) {
    crawlGrade = "LIMITED";
  } else if (searchAllowedCount < searchBots.length) {
    crawlGrade = "NEEDS_REVIEW";
  }

  // Dimension 2: Structural Extractability
  let structGrade: ReadinessGrade = "STRONG";
  if (!extractability.hasSemanticMain && !extractability.hasSemanticArticle) {
    structGrade = "ADEQUATE";
  }
  if (!extractability.hasClearH1 || !extractability.headingsOutlineValid) {
    structGrade = structGrade === "ADEQUATE" ? "NEEDS_REVIEW" : "ADEQUATE";
  }

  // Dimension 3: Entity Clarity
  let entityGrade: ReadinessGrade = "STRONG";
  if (!entityConsistency.isOrganizationConsistent) {
    entityGrade = "NEEDS_REVIEW";
  } else if (!entityConsistency.isAuthorConsistent && answerReadiness.pageIntent.applicableHeuristics.editorialAuthorExpected) {
    entityGrade = "ADEQUATE";
  }

  // Dimension 4: Answer Extractability
  let answerGrade: ReadinessGrade = "ADEQUATE";
  if (answerReadiness.pageIntent.applicableHeuristics.answerFirstDefinitionExpected) {
    if (answerReadiness.hasConciseDefinition && answerReadiness.isContentChunked) {
      answerGrade = "STRONG";
    } else if (!answerReadiness.isContentChunked) {
      answerGrade = "NEEDS_REVIEW";
    }
  } else {
    // Commercial, contact, and utility pages are evaluated on structural clarity rather than definition placement
    answerGrade = extractability.hasSemanticMain ? "STRONG" : "ADEQUATE";
  }

  // Dimension 5: Structured Data Consistency
  let schemaGrade: ReadinessGrade = "STRONG";
  if (entityConsistency.discrepancies.length > 0) {
    schemaGrade = "NEEDS_REVIEW";
  }

  // Dimension 6: Search Demand Opportunity
  const informationalImps = gscOpportunities.reduce((sum, o) => sum + o.impressions, 0);
  const searchDemandGrade =
    !gscData
      ? "NO_GSC_DATA"
      : informationalImps >= 500
      ? "HIGH_DEMAND"
      : informationalImps >= 100
      ? "MODERATE_DEMAND"
      : "LOW_DEMAND";

  // Dimension 7: External AI Visibility
  const externalAiVisibility: ExternalAiVisibilityData = {
    status: "AI_VISIBILITY_NOT_MEASURED",
    source: "NONE",
    googleGenAiStatus: "GOOGLE_GEN_AI_PUBLIC_API_NOT_DOCUMENTED",
    totalCitationsObserved: 0,
    providerBreakdown: {
      googleAiOverview: {
        status: "AI_VISIBILITY_NOT_MEASURED",
        uiReportStatus: "GOOGLE_GEN_AI_UI_REPORT_AVAILABLE",
        apiAvailabilityStatus: "GOOGLE_GEN_AI_PUBLIC_API_NOT_DOCUMENTED",
        notes:
          "Google Search Console provides a dedicated Generative AI performance report in the product UI for eligible properties. At the current verification date, Dream SEO does not have authoritative evidence of a dedicated public Search Console API field/filter that exposes this same report separately. Dream SEO does not scrape the Search Console UI.",
      },
      chatGptSearch: {
        status: "AI_VISIBILITY_NOT_MEASURED",
        notes: "No active OpenAI Search telemetry webhook or citation log is connected.",
      },
      perplexity: {
        status: "AI_VISIBILITY_NOT_MEASURED",
        notes: "No Perplexity citation monitoring integration is active.",
      },
    },
    evidenceStatement:
      "External AI search visibility is NOT measured. Google Search Console provides a dedicated Generative AI performance report in the product UI for eligible properties, but dedicated public Search Console API access is not yet documented. Dream SEO does not fabricate synthetic citation counts or scrape UI sessions.",
  };

  const dimensions: AiReadinessDimensions = {
    crawlRetrievalReadiness: {
      grade: crawlGrade,
      summary: `${searchAllowedCount}/${searchBots.length} Search Indexers Allowed | Raw HTML Present: ${extractability.rawHtmlPrimaryContentPresent ? "YES" : "NO"}`,
      details: {
        searchIndexersAllowed: searchAllowedCount,
        searchIndexersTotal: searchBots.length,
        trainingCrawlersAllowed: trainingAllowedCount,
        trainingCrawlersTotal: trainingBots.length,
        hasRawHtmlPrimaryContent: extractability.rawHtmlPrimaryContentPresent,
      },
    },
    structuralExtractability: {
      grade: structGrade,
      summary: `Main Landmark: ${extractability.hasSemanticMain ? "YES" : "NO"} | Valid H1: ${extractability.hasClearH1 ? "YES" : "NO"} | Tables: ${extractability.structuredElements.tablesCount}, Lists: ${extractability.structuredElements.listsCount}`,
      details: {
        hasSemanticMain: extractability.hasSemanticMain,
        hasClearH1: extractability.hasClearH1,
        headingsOutlineValid: extractability.headingsOutlineValid,
        structuredElementsCount: {
          tables: extractability.structuredElements.tablesCount,
          lists: extractability.structuredElements.listsCount,
          definitionLists: extractability.structuredElements.definitionListsCount,
        },
        averageParagraphWordCount: extractability.averageParagraphWordCount,
      },
    },
    entityClarity: {
      grade: entityGrade,
      summary: `Brand Identity Match: ${entityConsistency.isOrganizationConsistent ? "PASS" : "CONFLICT"} | Author Match: ${entityConsistency.isAuthorConsistent ? "PASS" : "CONFLICT"}`,
      details: {
        primaryEntityIdentified: entityConsistency.visibleOrganizationName,
        schemaTypeDeclared: entityConsistency.schemaOrganizationName ? "Organization" : null,
        isIdentityConsistent: entityConsistency.isOrganizationConsistent,
        inconsistencies: entityConsistency.discrepancies,
      },
    },
    answerExtractability: {
      grade: answerGrade,
      summary: `Intent: ${answerReadiness.pageIntent.primaryClass} | Concise Definition: ${answerReadiness.hasConciseDefinition ? "YES" : "NO"} | Q&A Candidates: ${answerReadiness.candidates.length}`,
      details: {
        pageIntent: answerReadiness.pageIntent.primaryClass,
        directAnswerCandidatesCount: answerReadiness.candidates.length,
        qaPairsCount: answerReadiness.qaPairsCount,
        hasConciseDefinition: answerReadiness.hasConciseDefinition,
        isContentChunked: answerReadiness.isContentChunked,
      },
    },
    structuredDataConsistency: {
      grade: schemaGrade,
      summary: `Discrepancies: ${entityConsistency.discrepancies.length}`,
      details: {
        schemaBlocksCount: page.schemaJsonLd?.length || 0,
        schemaContentMatches: entityConsistency.discrepancies.length === 0,
        discrepancies: entityConsistency.discrepancies,
      },
    },
    searchDemandOpportunity: {
      grade: searchDemandGrade,
      informationalQueriesCount: gscOpportunities.length,
      topInformationalQuery: gscOpportunities[0]?.query,
      impressions: informationalImps,
      averagePosition: gscOpportunities[0]?.averagePosition || 0,
    },
    externalAiVisibility,
  };

  // Compile Concrete GeoAeoFindings conforming to the Remediation Contract
  const findings: GeoAeoFinding[] = [];

  // 1. Blocked Search Indexers
  for (const c of crawlerAccess) {
    if (c.searchAccessRisk !== "NONE") {
      findings.push({
        signalCode: `AEO_CRAWLER_BLOCKED_${c.crawler.userAgent.toUpperCase()}`,
        evidenceClass: "DETERMINISTIC_BARRIER",
        title: `Search Access Blocked: ${c.crawler.crawlerName} is Disallowed in robots.txt`,
        category: "ai_crawler_access",
        severity: "warning",
        confidence: "confirmed",
        affectedUrl: page.url,
        observedState: `robots.txt contains '${c.matchedDirective}' affecting '${c.affectedScope}' scope.`,
        interpretation: c.crawler.searchVisibilityImplication,
        whereToFix: "Webflow Site Settings → SEO → robots.txt editor",
        locationCertainty: "CONFIRMED",
        remediation: `Remove 'Disallow: ${c.matchedPattern}' for User-agent '${c.crawler.userAgent}' or declare 'Allow: /'.`,
        caution: "Do NOT allow AI training bots if your organization policy mandates training opt-outs; only allow search indexing bots.",
        owner: "Technical SEO / Webmaster",
        verification: `Re-inspect robots.txt; verify ${c.crawler.userAgent} evaluates to ALLOWED.`,
      });
    }
  }

  // 2. Entity Discrepancies
  for (const disc of entityConsistency.discrepancies) {
    findings.push({
      signalCode: "AEO_ENTITY_SCHEMA_DISCREPANCY",
      evidenceClass: "HIGH_CONFIDENCE_SIGNAL",
      title: "Visible Content & Schema Entity Conflict",
      category: "entity_consistency",
      severity: "warning",
      confidence: "likely",
      affectedUrl: page.url,
      observedState: disc,
      interpretation: "Inconsistencies between visible branding and structured data diminish entity authority in knowledge graphs.",
      whereToFix: "Webflow Page Settings → Custom Code (<head> JSON-LD schema embed)",
      locationCertainty: "HIGH_CONFIDENCE",
      remediation: "Align schema properties (name, legalName, author, datePublished) with visible page typography.",
      caution: "Ensure legal entity names match official registry documentation.",
      owner: "Developer / SEO Specialist",
      verification: "Re-crawl page; confirm entity consistency evaluation reports zero discrepancies.",
    });
  }

  // 3. Answer-First Advisory Opportunities
  for (const sug of answerReadiness.advisorySuggestions) {
    findings.push({
      signalCode: "AEO_ANSWER_STRUCTURE_OPPORTUNITY",
      evidenceClass: "ADVISORY_HEURISTIC",
      title: "Enhance Answer-First Content Structure",
      category: "answer_readiness",
      severity: "opportunity",
      confidence: "heuristic",
      affectedUrl: page.url,
      observedState: sug,
      interpretation: "Placing a clear 30-50 word direct definition below key topic headings improves automated extraction.",
      whereToFix: "Webflow Designer → Page Canvas → Heading & Rich Text block",
      locationCertainty: "HIGH_CONFIDENCE",
      remediation: "Add a concise summary paragraph directly below the relevant <h2> heading.",
      caution: "This is an editorial advisory suggestion, not a guarantee of featured snippet or AI overview inclusion.",
      owner: "Content Editor / Copywriter",
      verification: "Re-evaluate page; confirm answer-readiness evaluation extracts high-confidence direct answer candidate.",
    });
  }

  // 4. GSC Informational Opportunities
  for (const opp of gscOpportunities) {
    findings.push({
      signalCode: "AEO_GSC_INFORMATIONAL_DEMAND",
      evidenceClass: "ADVISORY_HEURISTIC",
      title: `Informational Demand Optimization: "${opp.query}"`,
      category: "search_demand",
      severity: "opportunity",
      confidence: "heuristic",
      affectedUrl: page.url,
      observedState: `Query "${opp.query}" drove ${opp.impressions} impressions at position ${opp.averagePosition.toFixed(1)}.`,
      interpretation: opp.recommendation,
      whereToFix: "Webflow Designer → Page Canvas / CMS Template",
      locationCertainty: "HIGH_CONFIDENCE",
      remediation: `Add a targeted section or Q&A card addressing "${opp.query}".`,
      caution: "Ensure added content directly answers user query intent without keyword stuffing.",
      owner: "SEO Strategist",
      verification: "Monitor Search Console query performance over 28-day comparison window.",
    });
  }

  return {
    url: page.url,
    evaluatedAt: new Date().toISOString(),
    pageIntent: answerReadiness.pageIntent,
    crawlerAccess,
    dimensions,
    directAnswers: answerReadiness.candidates,
    entityConsistency,
    llmsTxt: llmsTxtReport || {
      hasLlmsTxt: false,
      hasLlmsFullTxt: false,
      llmsTxtUrl: null,
      llmsFullTxtUrl: null,
      characterCount: 0,
      status: "NOT_PRESENT",
      advisoryNote: "/llms.txt is optional and does not affect traditional SEO Health.",
    },
    findings,
  };
}

/**
 * Serializes the GEO / AEO / AI Search Intelligence section into structured Markdown for Master Reports.
 */
export function serializeGeoAeoReportSection(result: GeoAeoAuditResult): string {
  const d = result.dimensions;

  let md = `## GEO / AEO / AI SEARCH INTELLIGENCE

### 1. Executive Summary & Readiness Dimensions

| Dimension | Grade | Summary |
|---|---|---|
| **Crawl & Retrieval Readiness** | \`${d.crawlRetrievalReadiness.grade}\` | ${d.crawlRetrievalReadiness.summary} |
| **Structural Extractability** | \`${d.structuralExtractability.grade}\` | ${d.structuralExtractability.summary} |
| **Entity Clarity** | \`${d.entityClarity.grade}\` | ${d.entityClarity.summary} |
| **Answer Extractability** | \`${d.answerExtractability.grade}\` | ${d.answerExtractability.summary} |
| **Structured Data Consistency** | \`${d.structuredDataConsistency.grade}\` | ${d.structuredDataConsistency.summary} |
| **Search Demand Opportunity** | \`${d.searchDemandOpportunity.grade}\` | ${d.searchDemandOpportunity.informationalQueriesCount} Informational Queries (${d.searchDemandOpportunity.impressions} imps) |
| **External AI Visibility** | \`${d.externalAiVisibility.status}\` | ${d.externalAiVisibility.evidenceStatement} |

---

### 2. Page Intent & Extractability Details
- **Classified Page Intent:** \`${result.pageIntent.primaryClass}\` (Confidence: \`${result.pageIntent.confidence}\`)
- **Direct Answer Candidates Identified:** ${result.directAnswers.length}
`;

  if (result.directAnswers.length > 0) {
    for (const ans of result.directAnswers) {
      md += `  - **${ans.questionOrHeading}** (Format: \`${ans.format}\`, Words: ${ans.wordCount})\n`;
      md += `    > "${ans.conciseAnswerText}"\n`;
      md += `    *Location: \`${ans.domLocation}\`*\n`;
    }
  }

  md += `\n### 3. AI Crawler Access Status\n`;
  for (const c of result.crawlerAccess) {
    const roleTag = `[${c.crawler.role}]`;
    md += `- **${c.crawler.crawlerName}** ${roleTag}: \`${c.accessStatus}\` — ${c.evidence}\n`;
  }

  if (result.findings.length > 0) {
    md += `\n### 4. Actionable Findings & Advisory Opportunities\n`;
    for (const f of result.findings) {
      md += `\n#### [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `- **Signal Code:** \`${f.signalCode}\` | **Class:** \`${f.evidenceClass}\` | **Confidence:** \`${f.confidence}\`\n`;
      md += `- **Observed State:** ${f.observedState}\n`;
      md += `- **Interpretation:** ${f.interpretation}\n`;
      md += `- **Where to Fix:** ${f.whereToFix} (Certainty: \`${f.locationCertainty}\`)\n`;
      md += `- **Remediation:** ${f.remediation}\n`;
      md += `- **Caution:** ${f.caution}\n`;
      md += `- **Verification:** ${f.verification}\n`;
    }
  }

  return md;
}
