/**
 * Off-Page & Backlink Intelligence Report Serializer.
 * Surfaces all 18 reporting dimensions (A through R) into transparent,
 * evidence-backed Markdown output without fake metrics or penalty assertions.
 */

import { OffPageBacklinkIntelligenceReport } from "./types";

export function serializeOffPageBacklinkReportMarkdown(report: OffPageBacklinkIntelligenceReport): string {
  let md = `# OFF-PAGE & BACKLINK INTELLIGENCE

**Generated:** ${report.generatedAt}  
**Project:** \`${report.projectId}\`  
**Target Domain:** \`${report.targetDomain}\`  
**Provider:** \`${report.provider}\` (Version: \`${report.providerVersion}\` | State: \`${report.providerImplementationState}\` | Status: \`${report.providerStatus}\`)  
**Index Type:** \`${report.indexType}\`  
**Dataset Completeness:** ${report.datasetCompletenessNote}  
**Applied Policy:** \`${report.appliedPolicy.policyName}\` (Source: \`${report.appliedPolicy.selectionSource}\` | Sitewide Threshold: **${report.appliedPolicy.sitewideRepetitionThreshold}** | Anchor Min Sample: **${report.appliedPolicy.minSampleSizeForAnchorReview}** | Burst Ratio: **${report.appliedPolicy.burstThresholdRatio}x**)

---

## 1. Executive Summary & Inventory Dimensions

| Metric / Dimension | Value | Strategic Meaning |
|---|---|---|
| **Observed Backlink Records** | **${report.totalObservedBacklinkRecords.toLocaleString()} records** | Total individual external link records in provider dataset |
| **Observed Referring Domains** | **${report.totalObservedReferringDomains.toLocaleString()} domains** | Distinct root domains linking to project properties |
| **Broken Backlink Targets** | **${report.brokenTargetOpportunities.length} URLs** | Inbound external links pointing to 404/410 endpoints on own site |
| **Link Prospect Reviews** | **${report.competitorLinkGaps.linkProspectReviews.length} candidates** | High-relevance editorial domains linking to multiple competitors |
| **Linkable Asset Signals** | **${report.linkableAssetSignals.length} assets** | Internal pages demonstrating natural external link attraction |

---

## 2. 🔗 Link Attribute & Anchor Distribution

### Link Attributes
- **Follow:** ${report.attributeDistribution.FOLLOW || 0}
- **Nofollow:** ${report.attributeDistribution.NOFOLLOW || 0}
- **Sponsored:** ${report.attributeDistribution.SPONSORED || 0}
- **UGC:** ${report.attributeDistribution.UGC || 0}
*(Note: Link attributes are descriptive technical markers; nofollow/sponsored/UGC links represent legitimate external visibility).*

### Anchor Text Distribution (${report.anchorDistribution.sampleSize} samples)
- **Branded:** ${report.anchorDistribution.percentages.BRANDED || 0}% (${report.anchorDistribution.counts.BRANDED || 0})
- **Naked URL:** ${report.anchorDistribution.percentages.NAKED_URL || 0}% (${report.anchorDistribution.counts.NAKED_URL || 0})
- **Generic:** ${report.anchorDistribution.percentages.GENERIC || 0}% (${report.anchorDistribution.counts.GENERIC || 0})
- **Partial Match:** ${report.anchorDistribution.percentages.PARTIAL_MATCH || 0}% (${report.anchorDistribution.counts.PARTIAL_MATCH || 0})
- **Exact Match Candidate:** ${report.anchorDistribution.percentages.EXACT_MATCH_CANDIDATE || 0}% (${report.anchorDistribution.counts.EXACT_MATCH_CANDIDATE || 0})
- **Image / No Text:** ${report.anchorDistribution.percentages.IMAGE_NO_TEXT || 0}% (${report.anchorDistribution.counts.IMAGE_NO_TEXT || 0})

`;

  if (report.anchorDistribution.distributionReview) {
    md += `> [!NOTE]\n> **Anchor Distribution Review:** ${report.anchorDistribution.distributionReview.rationale}\n\n`;
  }

  md += `---\n\n## 3. 🎯 Broken Backlink Targets (404/410 Reclamation Opportunities)\n\n`;

  if (report.brokenTargetOpportunities.length === 0) {
    md += `*No external backlinks targeting broken (404/410) endpoints were observed in current crawl reconciliation.*\n\n`;
  } else {
    for (const broken of report.brokenTargetOpportunities) {
      md += `### Target: \`${broken.targetUrl}\` [HTTP ${broken.statusCode}]\n`;
      md += `- **Observed Impact:** **${broken.observedBacklinkCount}** backlinks from **${broken.observedReferringDomainCount}** referring domains (**${broken.relevantSourceCount}** relevant sources)\n`;
      md += `- **Sample Referring Domains:** ${broken.sampleReferringDomains.map((d) => `\`${d}\``).join(", ")}\n`;
      md += `- **Redirect Equivalence Confidence:** \`${broken.redirectEquivalenceConfidence}\`\n`;
      md += `- **Actionable Recommendation:** ${broken.recommendedAction}\n\n`;
    }
  }

  md += `---\n\n## 4. 🧭 Redirect & Canonical Target Reviews\n\n`;

  if (report.redirectTargetReviews.length > 0) {
    md += `### Redirect Chain Targets\n`;
    for (const red of report.redirectTargetReviews) {
      md += `- **${red.targetUrl}** (${red.observedReferringDomainCount} referring domains): ${red.reviewNote}\n`;
    }
    md += `\n`;
  }

  if (report.canonicalTargetReviews.length > 0) {
    md += `### Canonical Target Alignments\n`;
    for (const can of report.canonicalTargetReviews) {
      md += `- **${can.targetUrl}** (${can.observedReferringDomainCount} referring domains): ${can.reviewNote}\n`;
    }
    md += `\n`;
  }

  if (report.redirectTargetReviews.length === 0 && report.canonicalTargetReviews.length === 0) {
    md += `*All external backlink targets align directly with healthy HTTP 200 canonical destinations.*\n\n`;
  }

  md += `---\n\n## 5. 💡 Linkable Asset Signals (Natural Link Magnets)\n\n`;

  if (report.linkableAssetSignals.length === 0) {
    md += `*No prominent multi-domain linkable assets identified in this dataset.*\n\n`;
  } else {
    for (const asset of report.linkableAssetSignals) {
      md += `### ${asset.targetUrl} [\`${asset.assetType}\`]\n`;
      md += `- **External Visibility:** **${asset.observedReferringDomainCount}** referring domains (${asset.observedBacklinkCount} backlink records)\n`;
      md += `- **Anchor Themes:** ${asset.primaryAnchorThemes.map((t) => `\`${t}\``).join(", ")}\n`;
      md += `- **Strategic Opportunity:** ${asset.strategicInsight}\n\n`;
    }
  }

  md += `---\n\n## 6. 🔍 Competitor Referring Domain Gaps & Link Intersect\n\n`;

  md += `- **Competitor Relationship Scopes Included:** ${report.competitorLinkGaps.includedRelationshipTypes.map((r) => `\`${r}\``).join(", ") || "None"}\n`;
  md += `- **Own-Only Referring Domains:** **${report.competitorLinkGaps.ownOnlyReferringDomainsCount}**\n`;
  md += `- **Shared Referring Domains:** **${report.competitorLinkGaps.sharedReferringDomainsCount}**\n`;
  md += `- **Competitor-Only Referring Domains:** **${report.competitorLinkGaps.competitorOnlyReferringDomainsCount}**\n\n`;

  if (report.competitorLinkGaps.linkProspectReviews.length > 0) {
    md += `### Curated Link Prospect Reviews (Multi-Competitor Editorial Intersection)\n\n`;
    for (const p of report.competitorLinkGaps.linkProspectReviews) {
      md += `#### ${p.rootDomain} [\`${p.sourcePlatformType}\` | \`${p.sourceRelevance}\`]\n`;
      md += `- **Competitor Coverage:** Links to **${p.competitorPrevalenceFraction}** competitors (${p.linkedCompetitors.map((c) => `${c.domain} [${c.relationship}]`).join(", ")})\n`;
      md += `- **Advisory Guidance:** ${p.advisoryOutreachGuidance}\n\n`;
    }
  }

  md += `---\n\n## 7. 📈 Historical Changes & Volatility\n\n`;

  if (!report.historicalChanges.isComparable) {
    md += `*Historical comparison suppressed: ${report.historicalChanges.incomparabilityReason}*\n\n`;
  } else {
    md += `- **Newly Observed Backlinks:** +${report.historicalChanges.newlyObservedBacklinksCount}\n`;
    md += `- **No Longer Observed Backlinks:** -${report.historicalChanges.noLongerObservedBacklinksCount}\n`;
    md += `- **Newly Observed Referring Domains:** +${report.historicalChanges.newlyObservedReferringDomainsCount}\n`;
    md += `- **No Longer Observed Referring Domains:** -${report.historicalChanges.noLongerObservedReferringDomainsCount}\n\n`;

    if (report.historicalChanges.burstObservation) {
      md += `> [!NOTE]\n> **Link Burst Alert:** ${report.historicalChanges.burstObservation.rationale}\n\n`;
    }
  }

  md += `---\n\n## 8. 🛡️ Suspicious Patterns & Disavow Safety Boundaries\n\n`;

  if (report.suspiciousPatternReviews.length === 0) {
    md += `*No suspicious cross-domain burst patterns or autogenerated link schemes observed.*\n\n`;
  } else {
    for (const susp of report.suspiciousPatternReviews) {
      md += `### ${susp.patternType} (Confidence: \`${susp.confidence}\`)\n`;
      md += `- **Evidence:** ${susp.affectedDomainCount} domains, ${susp.affectedBacklinkCount} backlink records\n`;
      md += `- **Sample Domains:** ${susp.sampleSourceDomains.join(", ")}\n`;
      md += `- **Interpretation:** ${susp.interpretationNote}\n\n`;
    }
  }

  md += `\n---\n\n## 9. ℹ️ Data Limitations & Governance Principles\n\n`;

  for (const lim of report.governanceLimitations) {
    md += `- ${lim}\n`;
  }

  md += `\n**Immutability Guarantee:** ${report.immutabilityStatement}\n`;

  return md;
}
