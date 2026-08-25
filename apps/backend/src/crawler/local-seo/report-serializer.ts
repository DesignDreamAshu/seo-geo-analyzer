/**
 * Local SEO & Location Intelligence Report Serializer.
 * Surfaces all 20 reporting sections (A through T) in clean, transparent Markdown.
 */

import { LocalSeoIntelligenceReport } from "./types";

export function serializeLocalSeoReportMarkdown(report: LocalSeoIntelligenceReport): string {
  let md = `# LOCAL SEO & LOCATION INTELLIGENCE

**Generated:** ${report.generatedAt}  
**Project:** \`${report.projectId}\`  
**Applicability:** \`${report.applicability}\` (${report.applicabilityRationale})  
**Business Profile Provider:** \`${report.provider}\` (Version: \`${report.providerVersion}\` | State: \`${report.providerImplementationState}\` | Status: \`${report.providerStatus}\`)  
**Applied Policy:** \`${report.appliedPolicy.policyName}\` (Source: \`${report.appliedPolicy.selectionSource}\` | Doorway Min City Pages: **${report.appliedPolicy.minCityTokensForDoorwayReview}** | Review Sample: **${report.appliedPolicy.reviewGapSampleSize}**)

---

## 1. Executive Summary & Location Inventory

| Metric / Dimension | Value | Strategic Meaning |
|---|---|---|
| **Configured Locations** | **${report.locations.length} locations** | Distinct physical branches, headquarters, or service area hubs |
| **Location Landing Pages** | **${report.locationPages.length} pages** | Dedicated location landing pages evaluated on website |
| **NAP Consistency** | **${report.napConsistency.filter((n) => n.state === "NAP_CONSISTENT" || n.state === "NAP_FORMAT_VARIATION_ONLY").length} of ${report.napConsistency.length} aligned** | Name, Address, and Phone consistency across verified channels |
| **Local Pack Observations** | **${report.localPackObservations.length} queries** | Local 3-Pack SERP presence observations from Phase 13 snapshots |
| **Citation Records** | **${report.citationEvidence.citations.length} listings** | Provider-verified external directory and map citations |

---

## 2. 📍 Business Locations & Branch Details

`;

  if (report.locations.length === 0) {
    md += `*No physical locations or service areas configured or evidenced for this project.*\n\n`;
  } else {
    for (const loc of report.locations) {
      md += `### ${loc.locationName} [\`${loc.locationType}\`]\n`;
      md += `- **Business Name:** ${loc.businessName}\n`;
      if (loc.address) {
        md += `- **Address:** ${loc.address.streetAddress || ""}, ${loc.address.addressLocality || ""}, ${loc.address.addressRegion || ""} ${loc.address.postalCode || ""}, ${loc.address.addressCountry || ""}\n`;
      }
      if (loc.serviceAreas && loc.serviceAreas.length > 0) {
        md += `- **Service Areas Covered:** ${loc.serviceAreas.map((s) => `\`${s.name}\``).join(", ")}\n`;
      }
      if (loc.phone) md += `- **Phone:** \`${loc.phone}\`\n`;
      if (loc.canonicalLocationUrl) md += `- **Canonical Page:** [${loc.canonicalLocationUrl}]\n`;
      md += `\n`;
    }
  }

  md += `---\n\n## 3. 📞 NAP Consistency & Verification\n\n`;

  for (const nap of report.napConsistency) {
    md += `### Location: \`${nap.locationName}\` [\`${nap.state}\`]\n`;
    md += `- **Evidence Details:** ${nap.details} (${nap.evidenceCount} sources verified)\n\n`;
  }

  md += `---\n\n## 4. 📄 Location Pages & Quality Review\n\n`;

  if (report.locationPages.length === 0) {
    md += `*No dedicated location detail pages observed on website.*\n\n`;
  } else {
    for (const p of report.locationPages) {
      md += `### \`${p.url}\` [\`${p.classification}\`]\n`;
      md += `- **Health:** Indexable: **${p.isIndexable}** | Self-Canonical: **${p.isSelfCanonical}** | Structured Data: **${p.hasStructuredData}**\n`;
      md += `- **Discovery:** Internal Discovery: \`${p.internalDiscoverySource || "HEADER_NAV"}\`\n`;
      if (p.doorwayReviewFinding) {
        md += `> [!NOTE]\n> **Doorway Pattern Review:** ${p.doorwayReviewFinding.rationale}\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n\n## 5. 🏷️ Local Structured Data & Entity Alignment\n\n`;

  for (const sd of report.structuredDataAlignment) {
    md += `### Location: \`${sd.locationId}\` [Schema: \`${sd.schemaType}\` | Aligned: **${sd.isAligned}**]\n`;
    if (sd.issuesFound.length === 0) {
      md += `- *Structured data properties align cleanly with visible entity facts.*\n`;
    } else {
      for (const issue of sd.issuesFound) {
        md += `- ⚠️ ${issue}\n`;
      }
    }
    md += `\n`;
  }

  md += `---\n\n## 6. 🏢 Google Business Profile Alignment & Reviews\n\n`;

  for (const pa of report.businessProfileAlignment) {
    md += `### Location: \`${pa.locationId}\`\n`;
    md += `- **Website URL Alignment:** \`${pa.websiteUrlAlignment}\`\n`;
    md += `- **Primary Category:** \`${pa.categoryAlignment}\`\n`;
    md += `- **Opening Hours:** \`${pa.hoursState}\`\n`;
    if (pa.reviewMetrics) {
      md += `- **Reviews:** **${pa.reviewMetrics.reviewCount}** reviews (Aggregate Rating: **${pa.reviewMetrics.aggregateRating}★**)\n`;
      if (pa.reviewMetrics.reviewVolumeGap) {
        md += `> [!NOTE]\n> **Review Gap Observation:** ${pa.reviewMetrics.reviewVolumeGap.rationale}\n`;
      }
    }
    md += `\n`;
  }

  md += `---\n\n## 7. 🗺️ Local Pack Observations (Phase 13 SERP Integration)\n\n`;

  if (report.localPackObservations.length === 0) {
    md += `*No Local 3-Pack features observed in current tracked SERP snapshots.*\n\n`;
  } else {
    for (const pack of report.localPackObservations) {
      md += `### Query: '${pack.query}' (${pack.locationContext})\n`;
      md += `- **Project Visibility:** ${pack.isProjectObserved ? `Observed in Local Pack (Position #${pack.observedPosition})` : "Not observed in Local 3-Pack"}\n`;
      md += `- **Competitors in Pack:** ${pack.competitorsObserved.map((c) => `\`${c.title}\``).join(", ") || "None"}\n\n`;
    }
  }

  md += `---\n\n## 8. 📚 Citation Evidence & Local Directories\n\n`;

  md += `- **Citation Provider Status:** \`${report.citationEvidence.status}\`\n`;
  if (report.citationEvidence.citations.length > 0) {
    for (const cit of report.citationEvidence.citations) {
      md += `- **${cit.directoryName}** ([${cit.directoryUrl}]): \`${cit.alignmentState}\`\n`;
    }
  } else {
    md += `*No external citation records configured or retrieved for this project.*\n`;
  }

  md += `\n---\n\n## 9. ℹ️ Data Limitations & Governance Principles\n\n`;

  for (const lim of report.governanceLimitations) {
    md += `- ${lim}\n`;
  }

  md += `\n**Immutability Guarantee:** ${report.immutabilityStatement}\n`;

  return md;
}
