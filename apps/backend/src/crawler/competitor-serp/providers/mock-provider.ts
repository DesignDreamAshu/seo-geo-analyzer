/**
 * Deterministic Mock SERP Provider.
 * Supplies realistic test fixtures for standard organic SERP, featured snippets,
 * PAA, local pack, video pack, partial responses, auth failures, and quota limits.
 */

import { SerpProvider, SerpProviderResult } from "./types";
import { SerpRequest, SerpSnapshot, OrganicSerpResult, SerpFeatureItem } from "../types";
import { createSerpSnapshot } from "../serp-snapshot";
import { classifyResultType } from "../intent-result-type";
import { parseAndNormalizeUrl } from "../normalization";

export interface MockSerpFixtureScenario {
  queryKeyword: string;
  results: Array<{
    position: number;
    url: string;
    title: string;
    snippet: string;
  }>;
  serpFeatures?: SerpFeatureItem[];
  simulateStatus?: "SUCCESS" | "AUTH_FAILED" | "QUOTA_EXCEEDED" | "PARTIAL";
}

export class MockSerpProvider implements SerpProvider {
  public providerType = "MOCK_PROVIDER" as const;
  public providerVersion = "v1.0.0-deterministic-fixture";

  private configured: boolean = true;
  private customFixtures: Map<string, MockSerpFixtureScenario> = new Map();

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

  public registerFixture(scenario: MockSerpFixtureScenario) {
    this.customFixtures.set(scenario.queryKeyword.toLowerCase(), scenario);
  }

  public async fetchSerp(
    request: SerpRequest,
    projectId: string,
    ownDomainAliases: string[] = []
  ): Promise<SerpProviderResult> {
    if (!this.configured) {
      return {
        status: "SERP_DATA_NOT_CONFIGURED",
        errorMessage: "SERP data provider is not configured for this project.",
      };
    }

    const normQuery = request.query.toLowerCase();
    const fixture = this.customFixtures.get(normQuery) || this.generateDefaultFallbackFixture(request.query);

    if (fixture.simulateStatus === "AUTH_FAILED") {
      return {
        status: "SERP_PROVIDER_AUTH_FAILED",
        errorMessage: "SERP provider API key authentication failed.",
      };
    }

    if (fixture.simulateStatus === "QUOTA_EXCEEDED") {
      return {
        status: "SERP_PROVIDER_QUOTA_EXCEEDED",
        errorMessage: "Monthly SERP query quota exceeded for provider account.",
      };
    }

    const organicResults: OrganicSerpResult[] = fixture.results.map((r) => {
      const { normalizedUrl, domain, rootDomain } = parseAndNormalizeUrl(r.url);
      const { resultType, confidence } = classifyResultType(r.url, r.title, r.snippet);

      return {
        position: r.position,
        url: r.url,
        normalizedUrl,
        domain,
        rootDomain,
        title: r.title,
        snippet: r.snippet,
        resultType,
        resultTypeConfidence: confidence,
        isOwnDomain: false, // Tagged inside createSerpSnapshot
      };
    });

    const snapshotId = `SNAP_${projectId}_${Date.now().toString(36)}_${Math.abs(hashString(normQuery))}`;

    const snapshot = createSerpSnapshot({
      snapshotId,
      projectId,
      provider: this.providerType,
      providerVersion: this.providerVersion,
      request,
      normalizedQuery: normQuery,
      organicResults,
      serpFeatures: fixture.serpFeatures || [],
      ownDomainAliases,
      providerCompleteness: fixture.simulateStatus === "PARTIAL" ? "PARTIAL" : "COMPLETE",
    });

    return {
      status: fixture.simulateStatus === "PARTIAL" ? "SERP_DATA_PARTIAL" : "SERP_DATA_FRESH_COMPLETE",
      snapshot,
    };
  }

  private registerDefaultFixtures() {
    // 1. Standard Commercial CMDB query
    this.registerFixture({
      queryKeyword: "servicenow cmdb consulting",
      results: [
        {
          position: 1,
          url: "https://www.accenture.com/services/servicenow-cmdb",
          title: "Accenture ServiceNow CMDB Consulting Services",
          snippet: "Enterprise ServiceNow Configuration Management Database (CMDB) implementation and consulting.",
        },
        {
          position: 2,
          url: "https://www.deloitte.com/services/cmdb-consulting",
          title: "Deloitte CMDB Services and Architecture",
          snippet: "Transform your IT operations with Deloitte enterprise CMDB consulting specialists.",
        },
        {
          position: 3,
          url: "https://www.kpmg.com/advisory/cmdb-services",
          title: "KPMG ServiceNow Consulting Practice",
          snippet: "Full lifecycle ServiceNow architecture and configuration management consulting.",
        },
        {
          position: 4,
          url: "https://docs.servicenow.com/bundle/utah-servicenow-platform/page/product/configuration-management/concept/c_ITILConfigurationManagement.html",
          title: "Configuration Management Database (CMDB) - ServiceNow Docs",
          snippet: "Official documentation for ServiceNow CMDB architecture and table structure.",
        },
        {
          position: 5,
          url: "https://www.botconsulting.io/services/cmdb",
          title: "ServiceNow CMDB Consulting & Health Check | BOT Consulting",
          snippet: "Certified ServiceNow Elite Partner specializing in CMDB health checks and data models.",
        },
      ],
      serpFeatures: [
        {
          featureType: "PEOPLE_ALSO_ASK",
          questions: [
            "What does a ServiceNow CMDB consultant do?",
            "How much does a ServiceNow CMDB implementation cost?",
            "What is CSDM vs CMDB in ServiceNow?",
          ],
        },
      ],
    });

    // 2. Informational Guide with Featured Snippet
    this.registerFixture({
      queryKeyword: "what is servicenow cmdb",
      results: [
        {
          position: 1,
          url: "https://www.cprime.com/resources/blog/what-is-servicenow-cmdb",
          title: "What is ServiceNow CMDB? Complete Guide & Architecture",
          snippet: "The ServiceNow Configuration Management Database (CMDB) stores information about all configuration items (CIs) in your IT environment.",
        },
        {
          position: 2,
          url: "https://docs.servicenow.com/bundle/utah-servicenow-platform/page/product/configuration-management/concept/c_ITILConfigurationManagement.html",
          title: "ServiceNow CMDB Overview and Fundamentals",
          snippet: "Official guide to ServiceNow CMDB concepts and relationships.",
        },
      ],
      serpFeatures: [
        {
          featureType: "FEATURED_SNIPPET",
          owningDomain: "cprime.com",
          owningUrl: "https://www.cprime.com/resources/blog/what-is-servicenow-cmdb",
          title: "ServiceNow CMDB Definition",
          providerEvidence: "Paragraph snippet with 54 words extracted.",
        },
        {
          featureType: "PEOPLE_ALSO_ASK",
          questions: ["Why is CMDB important in ServiceNow?", "What is a CI in ServiceNow CMDB?"],
        },
      ],
    });

    // 3. Local Search Query with Local Pack
    this.registerFixture({
      queryKeyword: "servicenow consultant near me",
      results: [
        {
          position: 1,
          url: "https://www.accenture.com/locations/chicago",
          title: "Accenture Chicago IT Consulting & ServiceNow Practice",
          snippet: "Local Chicago technology and ServiceNow certified consultants.",
        },
      ],
      serpFeatures: [
        {
          featureType: "LOCAL_PACK",
          title: "Local IT & Cloud Consultants",
          providerEvidence: "3 map pins with address, ratings, and phone numbers.",
        },
      ],
    });
  }

  private generateDefaultFallbackFixture(query: string): MockSerpFixtureScenario {
    return {
      queryKeyword: query,
      results: [
        {
          position: 1,
          url: `https://www.example-competitor.com/services/${encodeURIComponent(query.replace(/\s+/g, "-"))}`,
          title: `Best ${query} Solutions & Services`,
          snippet: `Comprehensive overview and solutions for ${query}.`,
        },
        {
          position: 2,
          url: `https://docs.example.com/guide/${encodeURIComponent(query.replace(/\s+/g, "-"))}`,
          title: `${query} Documentation & Architecture Guide`,
          snippet: `Official documentation and best practices for ${query}.`,
        },
      ],
      serpFeatures: [],
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
