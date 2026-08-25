/**
 * Deterministic Mock Local Business Provider.
 * Provides realistic test fixtures for verified GBP profiles, multi-location branches,
 * Service Area Businesses (SABs), opening hours, review counts, citations, and error states.
 */

import { LocalBusinessProvider, LocalBusinessProviderResult } from "./types";
import { BusinessProfileDataset, BusinessProfileProviderType, CitationRecord } from "../types";

export interface MockLocalFixture {
  targetDomain: string;
  simulateStatus?: LocalBusinessProviderResult["status"];
  profiles: BusinessProfileDataset[];
  citations?: CitationRecord[];
}

export class MockLocalBusinessProvider implements LocalBusinessProvider {
  public providerType: BusinessProfileProviderType = "MOCK_LOCAL_PROVIDER";
  public providerVersion: string = "v1.0.0-deterministic-fixture";

  private configured: boolean = true;
  private customFixtures: Map<string, MockLocalFixture> = new Map();

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

  public registerFixture(fixture: MockLocalFixture) {
    this.customFixtures.set(fixture.targetDomain.toLowerCase().replace(/^www\./, ""), fixture);
  }

  public async fetchBusinessProfiles(request: { projectId: string; targetDomain: string }): Promise<LocalBusinessProviderResult> {
    if (!this.configured) {
      return {
        status: "LOCAL_DATA_NOT_CONFIGURED",
        errorMessage: "Local business profile provider is not configured for this project.",
      };
    }

    const cleanTarget = request.targetDomain.toLowerCase().replace(/^www\./, "");
    const fixture = this.customFixtures.get(cleanTarget) || this.generateFallbackFixture(request.targetDomain);

    const status = fixture.simulateStatus || "LOCAL_DATA_FRESH_COMPLETE";

    if (status === "LOCAL_PROVIDER_AUTH_FAILED") {
      return {
        status: "LOCAL_PROVIDER_AUTH_FAILED",
        errorMessage: "Google Business Profile API OAuth token expired or invalid.",
      };
    }

    if (status === "LOCAL_PROVIDER_QUOTA_EXCEEDED") {
      return {
        status: "LOCAL_PROVIDER_QUOTA_EXCEEDED",
        errorMessage: "Local business profile API daily quota exceeded.",
      };
    }

    return {
      status,
      profiles: fixture.profiles,
      citations: fixture.citations,
    };
  }

  private registerDefaultFixtures() {
    this.registerFixture({
      targetDomain: "botconsulting.io",
      profiles: [
        {
          profileId: "GBP_JAIPUR_101",
          locationId: "LOC_JAIPUR",
          businessName: "BOT Consulting",
          primaryCategory: "Business Management Consultant",
          additionalCategories: ["IT Consultant", "Software Company"],
          address: {
            streetAddress: "M.I. Road, C-Scheme",
            addressLocality: "Jaipur",
            addressRegion: "Rajasthan",
            postalCode: "302001",
            addressCountry: "IN",
          },
          phone: "+91 98765 43210",
          websiteUrl: "https://www.botconsulting.io/locations/jaipur",
          openingHours: [
            { dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00" },
            { dayOfWeek: ["Saturday", "Sunday"], isClosed: true },
          ],
          coordinates: { latitude: 26.9124, longitude: 75.7873 },
          reviewCount: 37,
          aggregateRating: 4.8,
          profileStatus: "VERIFIED",
          provenance: {
            provider: this.providerType,
            providerVersion: this.providerVersion,
            retrievedAt: new Date().toISOString(),
          },
        },
      ],
      citations: [
        {
          directoryName: "Justdial",
          directoryUrl: "https://www.justdial.com/Jaipur/BOT-Consulting",
          observedNap: {
            name: "BOT Consulting",
            address: { streetAddress: "MI Road, C Scheme", addressLocality: "Jaipur", postalCode: "302001" },
            phone: "+91 98765 43210",
          },
          locationId: "LOC_JAIPUR",
          alignmentState: "CITATION_NAP_ALIGNED",
        },
        {
          directoryName: "Sulekha",
          directoryUrl: "https://www.sulekha.com/bot-consulting-jaipur",
          observedNap: {
            name: "BOT Consulting Services",
            address: { streetAddress: "M.I. Rd", addressLocality: "Jaipur", postalCode: "302001" },
            phone: "+91 98765 43210",
          },
          locationId: "LOC_JAIPUR",
          alignmentState: "CITATION_FORMAT_VARIATION",
        },
      ],
    });
  }

  private generateFallbackFixture(domain: string): MockLocalFixture {
    return {
      targetDomain: domain,
      profiles: [],
      citations: [],
    };
  }
}
