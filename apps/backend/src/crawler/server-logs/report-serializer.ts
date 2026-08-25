/**
 * Search Bot Crawl Intelligence Report Serializer.
 * Serializes dataset quality, authoritative bot verification, coverage, crawl efficiency,
 * latency, and governance into comprehensive Markdown.
 */

import { ServerLogIntelligenceReport } from "./types";

export function serializeServerLogReportMarkdown(report: ServerLogIntelligenceReport): string {
  let md = `# SEARCH BOT CRAWL INTELLIGENCE REPORT

**Generated:** ${report.generatedAt}  
**Project:** \`${report.projectId}\`  
**Dataset Quality & Completeness:** \`${report.datasetQuality.completeness}\` (${report.datasetQuality.interpretationConfidence} confidence)

---

## 1. 📊 Dataset Quality, Adapter State & Bot Verification

| Metric | Value | Meaning / Context |
|---|---|---|
| **Period Analyzed** | **${report.datasetQuality.periodStart} → ${report.datasetQuality.periodEnd}** | Date window covered by log export |
| **Log Source / Provider** | **\`${report.datasetQuality.sourceProvider}\`** | Infrastructure ingestion format |
| **Adapter Support State** | **\`${report.datasetQuality.adapterSupportState}\`** | Implementation & testing verification state |
| **Total Lines Ingested** | **${report.datasetQuality.totalEventsParsed.toLocaleString()} events** | Ingested request volume |
| **Rejected / Malformed** | **${report.datasetQuality.rejectedEventsCount} lines (${report.datasetQuality.rejectionRatePercent}%)** | Unparseable or malformed rows |
| **Bot Range Dataset Version** | **\`${report.datasetQuality.rangeDatasetMetadata.datasetVersionOrHash}\`** | Authoritative IP range dataset hash |
| **Range Dataset Freshness** | **\`${report.datasetQuality.rangeDatasetMetadata.freshness}\`** | Range freshness lifecycle state |
| **Verifier Version** | **\`${report.datasetQuality.rangeDatasetMetadata.verifierVersion}\`** | Bot verification engine version |
| **Bot Verification Quality** | **${report.datasetQuality.botVerificationBreakdown.verifiedProviderRangePercent}% Published Range / ${report.datasetQuality.botVerificationBreakdown.verifiedDnsPercent}% DNS** | Authoritative validation rate |

---

## 2. 🤖 Search Engine & AI Crawler Observations

- **Total Search & AI Bot Requests:** ${report.botOverview.totalBotRequests.toLocaleString()}
- **Verified Googlebot Requests:** ${report.botOverview.verifiedGooglebotRequests.toLocaleString()}
  - **Googlebot Smartphone:** ${report.botOverview.googlebotSmartphoneRequests.toLocaleString()}
  - **Googlebot Desktop:** ${report.botOverview.googlebotDesktopRequests.toLocaleString()}
  - **Googlebot Image:** ${report.botOverview.googlebotImageRequests.toLocaleString()}
- **Bingbot Requests:** ${report.botOverview.bingbotRequests.toLocaleString()}
- **AI Crawler Activity (By Distinct Purpose):**
  - **OpenAI GPTBot (AI Model Training):** ${report.botOverview.aiCrawlerRequests.gptBotTrainingRequests.toLocaleString()} requests
  - **OpenAI OAI-SearchBot (Search Indexing):** ${report.botOverview.aiCrawlerRequests.oaiSearchBotSearchRequests.toLocaleString()} requests
  - **OpenAI ChatGPT-User (User-Triggered Fetch):** ${report.botOverview.aiCrawlerRequests.chatGptUserFetchRequests.toLocaleString()} requests
  - **ClaudeBot (Anthropic AI):** ${report.botOverview.aiCrawlerRequests.claudeBotRequests.toLocaleString()} requests
  - **PerplexityBot (Search/Answer Indexing):** ${report.botOverview.aiCrawlerRequests.perplexityBotRequests.toLocaleString()} requests
- **Spoofed / Unverified Crawlers Flagged:** ${report.botOverview.spoofedRequestsBlockedOrFlagged.toLocaleString()}

---

## 3. 🎯 Important Page Crawl Coverage

- **Total Critical / High-Value Pages:** ${report.importantPageCoverage.totalImportantPages}
- **Observed in Log Period:** ${report.importantPageCoverage.observedImportantPagesCount} pages (**${report.importantPageCoverage.coveragePercentage}% coverage**)
- **Unobserved in Log Period:** ${report.importantPageCoverage.unobservedImportantPagesCount} pages

`;

  if (report.importantPageCoverage.unobservedImportantPages.length === 0) {
    md += `*All identified high-value URLs received verified search bot requests during the analyzed window.*\n\n`;
  } else {
    md += `### Unobserved Important URLs for Review:\n`;
    for (const u of report.importantPageCoverage.unobservedImportantPages) {
      md += `- **\`${u.url}\`** (${u.importanceReasons.join(", ")})\n`;
      for (const reason of u.possibleReasons) {
        md += `  - *Context:* ${reason}\n`;
      }
    }
    md += `\n`;
  }

  md += `---

## 4. 📈 Crawl Efficiency & Status Distribution

**Crawl Budget Materiality:** \`${report.crawlEfficiency.materiality}\` (\`${report.crawlEfficiency.materialityPolicySelected}\`)  
*${report.crawlEfficiency.materialityRationale}*

### Status Code Distribution (Verified Googlebot HTML Requests)
- **200 OK (Indexable):** ${report.crawlEfficiency.htmlStatusDistribution.status200IndexablePercent}%
- **200 OK (Non-Indexable):** ${report.crawlEfficiency.htmlStatusDistribution.status200NonIndexablePercent}%
- **3xx Redirects:** ${report.crawlEfficiency.htmlStatusDistribution.redirect3xxPercent}%
- **4xx Client Errors:** ${report.crawlEfficiency.htmlStatusDistribution.clientError4xxPercent}%
- **5xx Server Errors:** ${report.crawlEfficiency.htmlStatusDistribution.serverError5xxPercent}%

---

## 5. 🔀 Redirect & Error Concentration

- **Total Bot Requests to Redirecting URLs:** ${report.crawlEfficiency.redirectConcentration.totalRedirectRequests.toLocaleString()}
- **Total Requests to 404 URLs:** ${report.crawlEfficiency.errorConcentration.total404Requests.toLocaleString()}
- **Total Requests to 410 URLs:** ${report.crawlEfficiency.errorConcentration.total410Requests.toLocaleString()}
- **Total Requests to 5xx URLs:** ${report.crawlEfficiency.errorConcentration.total5xxRequests.toLocaleString()}

`;

  if (report.crawlEfficiency.errorConcentration.errorBurstsDetected.length > 0) {
    md += `### 🚨 Detected 5xx Error Bursts:\n`;
    for (const b of report.crawlEfficiency.errorConcentration.errorBurstsDetected) {
      md += `- **HTTP ${b.statusCode}:** ${b.requestsCount} requests between \`${b.timestampStart}\` and \`${b.timestampEnd}\` (Affected URLs: ${b.affectedUrls.slice(0, 3).join(", ")})\n`;
    }
    md += `\n`;
  }

  if (report.crawlEfficiency.parameterAndFacetExpansion.facetPatternsDetected.length > 0) {
    md += `---

## 6. 🔍 Parameter & Facet Crawl Expansion

`;
    for (const f of report.crawlEfficiency.parameterAndFacetExpansion.facetPatternsDetected) {
      md += `- **Base Path \`${f.basePath}\`**: ${f.variantCount} observed parameter variants (${f.requestsCount} requests). Search demand: ${f.hasSearchDemand ? "YES" : "NO"}. Review: \`${f.recommendedReviewType}\`\n`;
      md += `  - *Guidance:* ${f.guidance}\n`;
    }
    md += `\n`;
  }

  md += `---

## 7. ⏱️ Origin Server Response Latency

- **Latency Sample Count:** ${report.crawlEfficiency.originLatency.sampleCount} bot requests
- **Median Response Time (p50):** ${report.crawlEfficiency.originLatency.medianMs ?? "N/A"} ms
- **p75 Response Time:** ${report.crawlEfficiency.originLatency.p75Ms ?? "N/A"} ms
- **p95 Response Time:** ${report.crawlEfficiency.originLatency.p95Ms ?? "N/A"} ms
- *Note:* ${report.crawlEfficiency.originLatency.disclaimer}

`;

  if (report.migrationIntelligenceIntegration) {
    md += `---

## 8. 🚀 Migration Crawl Transition

- **Legacy Source URLs Still Requested:** ${report.migrationIntelligenceIntegration.legacyUrlsStillCrawledCount}
- **Healthy 301/308 Redirect Percentage:** ${report.migrationIntelligenceIntegration.legacyUrlsHealthyRedirectPercent}%
- **New Destination Discovery Count:** ${report.migrationIntelligenceIntegration.newDestinationDiscoveryCount}
\n`;
  }

  md += `---

## 9. ℹ️ Data Limitations & Governance Principles

`;

  for (const lim of report.governanceLimitations) {
    md += `- ${lim}\n`;
  }

  md += `\n**Immutability Guarantee:** ${report.immutabilityStatement}\n`;

  return md;
}
