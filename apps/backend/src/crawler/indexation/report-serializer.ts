/**
 * Google Indexation Intelligence Report Serializer.
 * Formats canonical index coverage evidence into an auditable 18-section Markdown report.
 */

import { GoogleIndexationIntelligenceReport } from "./types";

export function serializeGoogleIndexationReportMarkdown(report: GoogleIndexationIntelligenceReport): string {
  const lines: string[] = [];

  lines.push("# 🔍 GOOGLE INDEXATION INTELLIGENCE REPORT\n");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Project:** \`${report.projectId}\``);
  lines.push(`**Interpretation Confidence:** \`${report.evidenceQuality.interpretationConfidence}\`\n`);
  lines.push("---\n");

  // 1. Evidence Quality & Sampling
  lines.push("## 1. 📊 Evidence Quality & Inspection Scope\n");
  lines.push("| Dimension | Value | Meaning / Context |");
  lines.push("|---|---|---|");
  lines.push(`| **Provider Capability** | **\`${report.evidenceQuality.providerCapability}\`** | GSC Inspection API access state |`);
  lines.push(`| **Inspection Mode** | **\`${report.evidenceQuality.inspectionSamplingMode}\`** | Sampling methodology |`);
  lines.push(`| **Eligible URLs** | **${report.evidenceQuality.eligibleUrlsCount} URLs** | URLs qualifying for inspection |`);
  lines.push(`| **Inspected URLs** | **${report.evidenceQuality.inspectedUrlsCount} URLs** | URLs with active inspection data |`);
  lines.push(`| **Inspection Coverage** | **${report.evidenceQuality.coveragePercentage}%** | Inspected / Eligible coverage ratio |`);
  lines.push(
    `| **Evidence Freshness** | **${report.evidenceQuality.freshnessBreakdown.freshPercent}% Fresh / ${report.evidenceQuality.freshnessBreakdown.agingPercent}% Aging / ${report.evidenceQuality.freshnessBreakdown.stalePercent}% Stale** | Temporal recency of inspection payloads |`
  );
  lines.push("");

  // 2. Known URL Universe
  lines.push("## 2. 🌐 Known URL Universe & Source Composition\n");
  lines.push(`- **Total Known Normalized URLs:** ${report.knownUrlUniverse.totalKnownUrls}`);
  lines.push(`  - **Crawler Discovered:** ${report.knownUrlUniverse.sources.crawlerCount}`);
  lines.push(`  - **XML Sitemaps:** ${report.knownUrlUniverse.sources.sitemapCount}`);
  lines.push(`  - **GSC Landing Pages:** ${report.knownUrlUniverse.sources.gscLandingPagesCount}`);
  lines.push(`  - **Server Logs:** ${report.knownUrlUniverse.sources.serverLogsCount}`);
  lines.push(`  - **Backlink Targets:** ${report.knownUrlUniverse.sources.backlinksCount}`);
  lines.push(`  - **Migration Mappings:** ${report.knownUrlUniverse.sources.migrationCount}`);
  lines.push("");

  // 3. Technical Indexability vs Google Index Evidence
  lines.push("## 3. ⚖️ Technical Indexability × Google Index Evidence Matrix\n");
  lines.push(`- **Technically Indexable URLs:** ${report.matrixDistribution.technicallyIndexableUrlsCount}`);
  lines.push(`- **Technically Non-Indexable URLs:** ${report.matrixDistribution.technicallyNonIndexableUrlsCount}`);
  lines.push(`- **URLs with Google Inspection Evidence:** ${report.matrixDistribution.urlsWithGoogleEvidenceCount}`);
  lines.push(`  - **Indexed by Google:** ${report.matrixDistribution.indexedCount}`);
  lines.push(`  - **Not Indexed by Google:** ${report.matrixDistribution.notIndexedCount}`);
  lines.push(`  - **Processing / Uncertain:** ${report.matrixDistribution.processingOrUncertainCount}`);
  lines.push(`  - **Unknown Index State:** ${report.matrixDistribution.unknownIndexStateCount}\n`);

  lines.push("### Explicit Coverage Denominators");
  lines.push(
    `- **Indexed among URLs with Google Evidence:** ${report.matrixDistribution.indexedAmongEligibleWithEvidenceRatio.numerator} / ${report.matrixDistribution.indexedAmongEligibleWithEvidenceRatio.denominator} (${report.matrixDistribution.indexedAmongEligibleWithEvidenceRatio.percentage}%)`
  );
  lines.push(
    `- **Important Indexable Pages Indexed:** ${report.matrixDistribution.importantIndexableIndexedRatio.numerator} / ${report.matrixDistribution.importantIndexableIndexedRatio.denominator} (${report.matrixDistribution.importantIndexableIndexedRatio.percentage}%)`
  );
  lines.push("");

  // 4. Important Page Coverage
  lines.push("## 4. 🎯 Important Page Index Coverage\n");
  lines.push(`- **Total Important Pages:** ${report.importantPageCoverage.totalImportantPages}`);
  lines.push(`- **Indexed Important Pages:** ${report.importantPageCoverage.indexedImportantPagesCount} (${report.importantPageCoverage.coveragePercentage}%)`);
  lines.push(`- **Unindexed Important Pages:** ${report.importantPageCoverage.notIndexedImportantPagesCount}\n`);

  if (report.importantPageCoverage.unindexedImportantPages.length > 0) {
    lines.push("### Unindexed Important Pages for Investigation");
    for (const p of report.importantPageCoverage.unindexedImportantPages) {
      lines.push(`- **\`${p.url}\`** (${p.importanceReasons.join(", ") || "CRITICAL"})`);
      lines.push(`  - *Google Reason:* \`${p.googleDetailedReason}\``);
      lines.push(`  - *Root Cause Confidence:* \`${p.rootCauseCategory}\``);
      lines.push(`  - *Context:* ${p.contextRationale}`);
    }
    lines.push("");
  }

  // 5. Canonical Selection Intelligence
  lines.push("## 5. 🔀 Canonical Selection Intelligence\n");
  lines.push(`- **Declared Canonical Matches Google Canonical:** ${report.canonicalSelectionIntelligence.canonicalMatchCount}`);
  lines.push(`- **Google Selected Different Canonical:** ${report.canonicalSelectionIntelligence.googleSelectedDifferentCanonicalCount}`);
  lines.push(`- **Declared Canonical Missing:** ${report.canonicalSelectionIntelligence.declaredCanonicalMissingCount}\n`);

  if (report.canonicalSelectionIntelligence.mismatchExamples.length > 0) {
    lines.push("### Canonical Mismatch Examples");
    for (const m of report.canonicalSelectionIntelligence.mismatchExamples) {
      lines.push(`- **Declared URL:** \`${m.declaredUrl}\``);
      lines.push(`  - *Declared Canonical:* \`${m.declaredCanonical || "none"}\``);
      lines.push(`  - *Google Selected:* \`${m.googleCanonical}\``);
      lines.push(`  - *Guidance:* ${m.guidance}`);
    }
    lines.push("");
  }

  // 6. Unexpected Index Expansion
  lines.push("## 6. ⚠️ Unexpected Index Expansion\n");
  lines.push(`- **Indexed Tracking Parameter Variants:** ${report.unexpectedIndexExpansion.trackingParametersIndexedCount}`);
  lines.push(`- **Indexed Internal Search Pages:** ${report.unexpectedIndexExpansion.internalSearchIndexedCount}`);
  lines.push(`- **Indexed Session URLs:** ${report.unexpectedIndexExpansion.sessionUrlsIndexedCount}\n`);

  // 7. Data Limitations & Governance Principles
  lines.push("## 7. ℹ️ Data Limitations & Governance Principles\n");
  for (const lim of report.governanceLimitations) {
    lines.push(`- ${lim}`);
  }
  lines.push("");
  lines.push(`**${report.immutabilityStatement}**`);

  return lines.join("\n");
}
