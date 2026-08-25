/**
 * International SEO & Hreflang Intelligence Report Serializer.
 * Surfaces all 20 reporting dimensions (A through T) in structured Markdown.
 */

import { InternationalSeoIntelligenceReport } from "./types";

export function serializeInternationalSeoReportMarkdown(report: InternationalSeoIntelligenceReport): string {
  let md = `# INTERNATIONAL SEO & HREFLANG INTELLIGENCE

**Generated:** ${report.generatedAt}  
**Project:** \`${report.projectId}\`  
**Applicability:** \`${report.applicability}\` (${report.applicabilityRationale})  
**URL Architecture:** \`${report.urlArchitecture}\`  
**Applied Policy:** \`${report.appliedPolicy.policyName}\` (Source: \`${report.appliedPolicy.selectionSource}\` | Regional Similarity: **${Math.round(
    report.appliedPolicy.similarityThresholdForRegionalVariant * 100
  )}%** | Min Sample: **${report.appliedPolicy.minClusterSampleSize}**)

---

## 1. Executive Summary & International Inventory

| Metric / Dimension | Value | Strategic Meaning |
|---|---|---|
| **Discovered Locales** | **${report.locales.length} locales** | Total distinct language or language-region variants declared |
| **Observed Hreflang Alternates** | **${report.totalObservedAlternatesCount} tags** | Total alternate edge declarations parsed across HTML, headers, or sitemaps |
| **Alternate Clusters** | **${report.totalClustersCount} clusters** | Multi-locale equivalent content groups evaluated |
| **Reciprocity Issues** | **${report.reciprocityIssues.length} broken edges** | Alternate declarations lacking bidirectional return links |
| **Target Health Issues** | **${report.targetHealthIssues.length} targets** | Hreflang tags pointing to 404, redirect, or noindex destinations |
| **Canonical Conflicts** | **${report.canonicalConflicts.length} conflicts** | Cross-locale or cross-language canonical tags conflicting with hreflang |

---

## 2. 🌐 Locale Inventory & Targeting Model

`;

  if (report.locales.length === 0) {
    md += `*No international locales configured or discovered for this project.*\n\n`;
  } else {
    for (const loc of report.locales) {
      md += `- **\`${loc.hreflangCode}\`** [${loc.localeType}]: Language: \`${loc.languageCode}\`${loc.regionCode ? ` | Region: \`${loc.regionCode}\`` : ""}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 3. 🔗 Alternate Clusters & Reciprocal Graph Status\n\n`;

  if (report.clusters.length === 0) {
    md += `*No multi-locale hreflang clusters evaluated on site.*\n\n`;
  } else {
    for (const cl of report.clusters) {
      md += `### Cluster: \`${cl.clusterId}\` [\`${cl.completenessState}\` | \`${cl.reciprocityState}\`]\n`;
      md += `- **Participating URLs:** ${cl.pages.map((p) => `\`${p.localeCode}\` (${p.url})`).join(", ")}\n`;
      md += `- **x-default Status:** \`${cl.xDefaultState}\`${cl.xDefaultUrl ? ` ([${cl.xDefaultUrl}])` : ""}\n`;
      if (cl.duplicateLocaleDetails && cl.duplicateLocaleDetails.length > 0) {
        for (const dup of cl.duplicateLocaleDetails) {
          md += `  - ⚠️ ${dup}\n`;
        }
      }
      md += `\n`;
    }
  }

  md += `---\n\n## 4. 🎯 Hreflang Target Health & Status Codes\n\n`;

  if (report.targetHealthIssues.length === 0) {
    md += `*All hreflang targets resolve cleanly to HTTP 200 indexable canonical destinations.*\n\n`;
  } else {
    for (const ti of report.targetHealthIssues) {
      md += `- ⚠️ **[${ti.issueType}]** Source: \`${ti.sourceUrl}\` -> Target: \`${ti.targetUrl}\` (\`${ti.hreflang}\`): ${ti.details}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 5. 🧭 Canonical Compatibility & Language Alignment\n\n`;

  if (report.canonicalConflicts.length === 0 && report.languageMismatches.length === 0) {
    md += `*Canonical tags and content-language signals align cleanly with declared hreflang locales.*\n\n`;
  } else {
    for (const conf of report.canonicalConflicts) {
      md += `- ⚠️ **[${conf.conflictType}]** \`${conf.url}\` (${conf.locale}): ${conf.details}\n`;
    }
    for (const lm of report.languageMismatches) {
      md += `- ⚠️ **[${lm.alignmentState}]** \`${lm.url}\` (${lm.declaredHreflang}): ${lm.details}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 6. 🛡️ Regional Variant Similarity & Differentiation\n\n`;

  if (report.regionalVariantReviews.length === 0) {
    md += `*No regional variant pairs evaluated in current scope.*\n\n`;
  } else {
    for (const rv of report.regionalVariantReviews) {
      md += `### \`${rv.sourceLocale}\` vs \`${rv.targetLocale}\` [\`${rv.classification}\`]\n`;
      md += `- **Similarity:** ${Math.round(rv.textSimilarity * 100)}%\n`;
      md += `- **Analysis:** ${rv.rationale}\n\n`;
    }
  }

  md += `---\n\n## 7. 📈 GSC Market Performance & Search Intent\n\n`;

  if (report.gscMarketPerformance.length === 0) {
    md += `*No country-level GSC performance data configured or retrieved.*\n\n`;
  } else {
    for (const gsc of report.gscMarketPerformance) {
      md += `- **${gsc.countryName} (${gsc.countryCode}):** ${gsc.clicks.toLocaleString()} clicks | ${gsc.impressions.toLocaleString()} imps | Top URL: \`${gsc.topLandingUrl}\` [\`${gsc.alignmentState}\`]\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 8. ℹ️ Data Limitations & Governance Principles\n\n`;

  for (const lim of report.governanceLimitations) {
    md += `- ${lim}\n`;
  }

  md += `\n**Immutability Guarantee:** ${report.immutabilityStatement}\n`;

  return md;
}
