/**
 * Deterministic Mock Backlink Provider.
 * Supplies realistic test fixtures for standard backlink inventories,
 * referring domain aggregations, broken targets, sitewide repetition,
 * competitor link gaps, auth failures, quota limits, and index changes.
 */

import { BacklinkProvider, BacklinkDomainRequest, BacklinkProviderResult } from "./types";
import { BacklinkRecord, BacklinkSnapshot, BacklinkDatasetStatus } from "../types";
import { parseAndNormalizeBacklinkUrl } from "../normalization";
import { aggregateReferringDomains } from "../referring-domains";

export interface MockBacklinkDatasetFixture {
  targetDomain: string;
  simulateStatus?: BacklinkDatasetStatus;
  indexType?: "LIVE" | "FRESH" | "HISTORIC" | "MOCK";
  records: Array<{
    sourceUrl: string;
    targetUrl: string;
    anchorText: string;
    linkAttributes?: Array<"FOLLOW" | "NOFOLLOW" | "SPONSORED" | "UGC">;
    sourceTitle?: string;
    sourceLanguage?: string;
    sourceHttpStatus?: number;
    firstSeenDate?: string;
    lastSeenDate?: string;
    providerMetrics?: {
      ahrefsDomainRating?: number;
      mozDomainAuthority?: number;
      semrushAuthorityScore?: number;
      majesticTrustFlow?: number;
    };
  }>;
}

export class MockBacklinkProvider implements BacklinkProvider {
  public providerType = "MOCK_BACKLINK_PROVIDER" as const;
  public providerVersion = "v1.0.0-deterministic-fixture";

  private configured: boolean = true;
  private customFixtures: Map<string, MockBacklinkDatasetFixture> = new Map();

  constructor(isConfigured: boolean = true) {
    this.configured = isConfigured;
    this.registerDefaultFixtures();
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  public setConfigured(val: boolean) {
    this.configured = val;
  }

  public registerFixture(fixture: MockBacklinkDatasetFixture) {
    this.customFixtures.set(fixture.targetDomain.toLowerCase().replace(/^www\./, ""), fixture);
  }

  public async fetchDomainBacklinks(
    request: BacklinkDomainRequest,
    ownDomainAliases: string[] = []
  ): Promise<BacklinkProviderResult> {
    if (!this.configured) {
      return {
        status: "BACKLINK_DATA_NOT_CONFIGURED",
        errorMessage: "Backlink provider is not configured for this project.",
      };
    }

    const cleanTarget = request.targetDomain.toLowerCase().replace(/^www\./, "");
    const fixture = this.customFixtures.get(cleanTarget) || this.generateFallbackFixture(request.targetDomain);

    const status = fixture.simulateStatus || "BACKLINK_DATA_FRESH_COMPLETE";

    if (status === "BACKLINK_PROVIDER_AUTH_FAILED") {
      return {
        status: "BACKLINK_PROVIDER_AUTH_FAILED",
        errorMessage: "Backlink provider API authentication failed (invalid API key).",
      };
    }

    if (status === "BACKLINK_PROVIDER_QUOTA_EXCEEDED") {
      return {
        status: "BACKLINK_PROVIDER_QUOTA_EXCEEDED",
        errorMessage: "Monthly backlink API query quota exceeded.",
      };
    }

    if (status === "BACKLINK_FETCH_FAILED") {
      return {
        status: "BACKLINK_FETCH_FAILED",
        errorMessage: "Provider network gateway timeout.",
      };
    }

    const normalizedRecords: BacklinkRecord[] = fixture.records.map((r, index) => {
      const src = parseAndNormalizeBacklinkUrl(r.sourceUrl);
      const tgt = parseAndNormalizeBacklinkUrl(r.targetUrl);

      // Classify Anchor Text conservatively
      const anchorNorm = r.anchorText.trim().toLowerCase();
      let anchorClassification: BacklinkRecord["anchorClassification"] = "GENERIC";

      const brandKeywords = [cleanTarget.split(".")[0], ...ownDomainAliases.map((a) => a.split(".")[0])];
      const isBrand = brandKeywords.some((b) => anchorNorm.includes(b.toLowerCase()));

      if (anchorNorm === "" || anchorNorm === "image" || anchorNorm === "img") {
        anchorClassification = "IMAGE_NO_TEXT";
      } else if (anchorNorm.startsWith("http://") || anchorNorm.startsWith("https://") || anchorNorm.startsWith("www.")) {
        anchorClassification = "NAKED_URL";
      } else if (isBrand) {
        anchorClassification = anchorNorm === cleanTarget.split(".")[0] ? "BRANDED" : "PARTIAL_MATCH";
      } else if (anchorNorm.includes("consulting") || anchorNorm.includes("services") || anchorNorm.includes("guide")) {
        anchorClassification = "EXACT_MATCH_CANDIDATE";
      }

      // Determine Source Platform Type
      let sourcePlatformType: BacklinkRecord["sourcePlatformType"] = "COMPANY_BLOG";
      if (src.domain.includes("medium.com") || src.domain.includes("forbes.com") || src.domain.includes("techcrunch.com") || src.domain.includes("gartner.com")) {
        sourcePlatformType = "EDITORIAL_PUBLICATION";
      } else if (src.domain.includes("directory") || src.domain.includes("clutch.co") || src.domain.includes("g2.com")) {
        sourcePlatformType = "DIRECTORY";
      } else if (src.domain.includes("reddit.com") || src.domain.includes("forum")) {
        sourcePlatformType = "FORUM_COMMUNITY";
      } else if (src.domain.includes("github.com") || src.domain.includes("docs.")) {
        sourcePlatformType = "DOCUMENTATION";
      } else if (src.domain.endsWith(".edu")) {
        sourcePlatformType = "EDUCATIONAL";
      } else if (src.domain.endsWith(".gov")) {
        sourcePlatformType = "GOVERNMENT";
      }

      return {
        backlinkId: `BL_${index + 1}_${Math.abs(hashString(r.sourceUrl + r.targetUrl))}`,
        sourceUrl: r.sourceUrl,
        sourceNormalizedUrl: src.normalizedUrl,
        sourceHostname: src.hostname,
        sourceRegistrableDomain: src.rootDomain,
        sourceSubdomain: src.subdomain,
        sourceTitle: r.sourceTitle,
        sourceLanguage: r.sourceLanguage || "en",
        sourceHttpStatus: r.sourceHttpStatus || 200,
        sourcePlatformType,
        targetUrl: r.targetUrl,
        targetNormalizedUrl: tgt.normalizedUrl,
        anchorText: r.anchorText,
        anchorClassification,
        linkAttributes: r.linkAttributes && r.linkAttributes.length > 0 ? (r.linkAttributes as any) : ["FOLLOW"],
        firstSeenDate: r.firstSeenDate || "2026-01-15",
        lastSeenDate: r.lastSeenDate || "2026-08-15",
        providerMetrics: r.providerMetrics,
        relevanceState: sourcePlatformType === "EDITORIAL_PUBLICATION" || sourcePlatformType === "DOCUMENTATION" ? "HIGHLY_RELEVANT_SOURCE" : "RELATED_SOURCE",
        riskState: "NORMAL_LINK",
        provenance: {
          provider: this.providerType,
          providerVersion: this.providerVersion,
          retrievalTimestamp: new Date().toISOString(),
        },
      };
    });

    const snapshotId = `SNAP_BL_${request.projectId}_${Date.now().toString(36)}`;
    const referringDomains = aggregateReferringDomains(normalizedRecords, this.providerType, snapshotId);

    const snapshot: BacklinkSnapshot = {
      snapshotId,
      projectId: request.projectId,
      targetDomain: cleanTarget,
      targetRegistrableDomain: parseAndNormalizeBacklinkUrl(cleanTarget).rootDomain,
      provider: this.providerType,
      providerVersion: this.providerVersion,
      indexType: fixture.indexType || request.indexType || "LIVE",
      retrievalTimestamp: new Date().toISOString(),
      completeness: status,
      rowLimit: request.rowLimit || 10000,
      observedBacklinks: normalizedRecords,
      referringDomains,
      datasetFingerprint: `FP_${normalizedRecords.length}_${referringDomains.length}`,
      immutabilityGuarantee: "RUNTIME_IMMUTABLE",
    };

    return {
      status,
      snapshot,
      rawRecords: normalizedRecords,
    };
  }

  private registerDefaultFixtures() {
    // Standard Project Domain Fixture
    this.registerFixture({
      targetDomain: "botconsulting.io",
      records: [
        {
          sourceUrl: "https://www.gartner.com/reviews/market/servicenow-partners/bot-consulting",
          targetUrl: "https://www.botconsulting.io/services/cmdb",
          anchorText: "BOT Consulting ServiceNow Practice",
          linkAttributes: ["FOLLOW"],
          sourceTitle: "Gartner Peer Insights - BOT Consulting",
          providerMetrics: { ahrefsDomainRating: 91, semrushAuthorityScore: 88 },
        },
        {
          sourceUrl: "https://clutch.co/profile/bot-consulting",
          targetUrl: "https://www.botconsulting.io",
          anchorText: "botconsulting.io",
          linkAttributes: ["NOFOLLOW"],
          sourceTitle: "Clutch Profile - Top Cloud Consultants",
          providerMetrics: { ahrefsDomainRating: 85, semrushAuthorityScore: 80 },
        },
        {
          sourceUrl: "https://techcrunch.com/2026/05/12/enterprise-itil-automation/",
          targetUrl: "https://www.botconsulting.io/resources/cmdb-guide",
          anchorText: "comprehensive CMDB guide",
          linkAttributes: ["FOLLOW"],
          sourceTitle: "Enterprise Automation Trends 2026",
          providerMetrics: { ahrefsDomainRating: 93, mozDomainAuthority: 92 },
        },
        {
          sourceUrl: "https://community.servicenow.com/community?id=community_blog&sys_id=123",
          targetUrl: "https://www.botconsulting.io/old-broken-cmdb",
          anchorText: "ServiceNow CMDB health check tool",
          linkAttributes: ["UGC", "NOFOLLOW"],
          sourceTitle: "Community Knowledge Base Post",
        },
        {
          sourceUrl: "https://news.partner-network.com/article-1",
          targetUrl: "https://www.botconsulting.io/services/cmdb",
          anchorText: "ServiceNow CMDB Consulting",
          linkAttributes: ["FOLLOW", "SPONSORED"],
          sourceTitle: "Partner Spotlight 2026",
        },
      ],
    });

    // Competitor 1: Accenture
    this.registerFixture({
      targetDomain: "accenture.com",
      records: [
        {
          sourceUrl: "https://www.gartner.com/reviews/market/servicenow-partners/accenture",
          targetUrl: "https://www.accenture.com/services/servicenow",
          anchorText: "Accenture ServiceNow Consulting",
          linkAttributes: ["FOLLOW"],
        },
        {
          sourceUrl: "https://www.forbes.com/innovation/it-consulting-leaders/",
          targetUrl: "https://www.accenture.com/services/cmdb",
          anchorText: "enterprise architecture leaders",
          linkAttributes: ["FOLLOW"],
        },
        {
          sourceUrl: "https://tech-insights-journal.com/cmdb-best-practices",
          targetUrl: "https://www.accenture.com/services/cmdb",
          anchorText: "Accenture CMDB practices",
          linkAttributes: ["FOLLOW"],
        },
      ],
    });

    // Competitor 2: Deloitte
    this.registerFixture({
      targetDomain: "deloitte.com",
      records: [
        {
          sourceUrl: "https://www.gartner.com/reviews/market/servicenow-partners/deloitte",
          targetUrl: "https://www.deloitte.com/services/cmdb",
          anchorText: "Deloitte CMDB Transformation",
          linkAttributes: ["FOLLOW"],
        },
        {
          sourceUrl: "https://tech-insights-journal.com/cmdb-best-practices",
          targetUrl: "https://www.deloitte.com/services/cmdb",
          anchorText: "Deloitte CMDB guide",
          linkAttributes: ["FOLLOW"],
        },
      ],
    });
  }

  private generateFallbackFixture(domain: string): MockBacklinkDatasetFixture {
    return {
      targetDomain: domain,
      records: [
        {
          sourceUrl: `https://industry-directory.example.com/company/${encodeURIComponent(domain)}`,
          targetUrl: `https://${domain}/`,
          anchorText: domain,
          linkAttributes: ["NOFOLLOW"],
          sourceTitle: "Industry Directory Profile",
        },
      ],
    };
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
