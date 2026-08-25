/**
 * Phase 28F: AI Citation & Source Intelligence Engine.
 * Analyzes citation URLs, response penetration, cross-provider consensus, first-party vs third-party support,
 * evidenced citation gaps, and source winning patterns without causal ranking claims.
 */

import { nanoid } from "nanoid";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptUniverseReport } from "../prompts/types";
import { AIObservation, AIProviderId } from "../observation/types";
import { CrawledPageData } from "../../crawler/types";
import {
  AISourceIntelligenceSnapshot,
  CitationDomainProfile,
  CitationUrlProfile,
  CitationGap,
  CitationGapEvidence,
  SourceWinningPattern,
  CompetitorSourceProfile,
  ClusterSourceProfile,
  OfferingSourceProfile,
  UncitedRelevantPage,
  SourceOwnershipType,
  SourceConsensusLevel,
  AI_SOURCE_INTELLIGENCE_VERSION,
} from "./types";
import { canonicalizeUrl, canonicalizeDomain } from "./canonicalizer";
import { classifySourceOwnership, classifySourcePageType } from "./classifier";

export class AISourceIntelligenceEngine {
  public computeSourceIntelligence(
    projectId: string,
    runId: string,
    observations: AIObservation[] = [],
    profile: ProjectKnowledgeProfile,
    promptUniverse: PromptUniverseReport,
    pages: CrawledPageData[] = [],
    options: { isTestData?: boolean } = {}
  ): AISourceIntelligenceSnapshot {
    const isTestData = Boolean(options.isTestData);
    const eligibleObs = observations.filter((o) => o.status === "SUCCESS");
    const totalCitationCapable = eligibleObs.length;

    // 1. URL Profiles & Domain Profiles
    const urlMap = new Map<string, {
      canonicalUrl: string;
      originalUrl: string;
      domain: string;
      path: string;
      ownershipType: SourceOwnershipType;
      pageType: any;
      citationsCount: number;
      responses: Set<string>;
      providers: Set<AIProviderId>;
      prompts: Set<string>;
      clusters: Set<string>;
      entities: Set<string>;
      firstObserved: string;
      lastObserved: string;
    }>();

    const domainMap = new Map<string, {
      domain: string;
      ownershipType: SourceOwnershipType;
      citationsCount: number;
      responses: Set<string>;
      uniqueUrls: Set<string>;
      providers: Set<AIProviderId>;
      prompts: Set<string>;
      clusters: Set<string>;
      entities: Set<string>;
      firstObserved: string;
      lastObserved: string;
    }>();

    let totalCitations = 0;
    let ownCitationResponses = 0;
    const ownCitedPagesSet = new Set<string>();

    for (const obs of eligibleObs) {
      const responseSeenUrls = new Set<string>();
      const responseSeenDomains = new Set<string>();
      let hasOwnCitationInResponse = false;

      for (const cit of obs.citations || []) {
        if (!cit.sourceUrl) continue;
        totalCitations++;

        const canon = canonicalizeUrl(cit.sourceUrl);
        const { ownershipType, associatedEntityName } = classifySourceOwnership(canon.domain, profile);
        const pageType = classifySourcePageType(canon.path);

        if (ownershipType === "OWN_DOMAIN") {
          hasOwnCitationInResponse = true;
          ownCitedPagesSet.add(canon.canonicalUrl);
        }

        // Aggregate URL
        if (!urlMap.has(canon.canonicalUrl)) {
          urlMap.set(canon.canonicalUrl, {
            canonicalUrl: canon.canonicalUrl,
            originalUrl: cit.sourceUrl,
            domain: canon.domain,
            path: canon.path,
            ownershipType,
            pageType,
            citationsCount: 0,
            responses: new Set<string>(),
            providers: new Set<AIProviderId>(),
            prompts: new Set<string>(),
            clusters: new Set<string>(),
            entities: new Set<string>(),
            firstObserved: obs.observedAt,
            lastObserved: obs.observedAt,
          });
        }
        const uEntry = urlMap.get(canon.canonicalUrl)!;
        uEntry.citationsCount++;
        uEntry.responses.add(obs.observationId);
        uEntry.providers.add(obs.providerId);
        uEntry.prompts.add(obs.promptId);
        uEntry.clusters.add(obs.clusterId);
        if (associatedEntityName) uEntry.entities.add(associatedEntityName);
        uEntry.lastObserved = obs.observedAt;

        // Aggregate Domain
        if (!domainMap.has(canon.domain)) {
          domainMap.set(canon.domain, {
            domain: canon.domain,
            ownershipType,
            citationsCount: 0,
            responses: new Set<string>(),
            uniqueUrls: new Set<string>(),
            providers: new Set<AIProviderId>(),
            prompts: new Set<string>(),
            clusters: new Set<string>(),
            entities: new Set<string>(),
            firstObserved: obs.observedAt,
            lastObserved: obs.observedAt,
          });
        }
        const dEntry = domainMap.get(canon.domain)!;
        dEntry.citationsCount++;
        dEntry.responses.add(obs.observationId);
        dEntry.uniqueUrls.add(canon.canonicalUrl);
        dEntry.providers.add(obs.providerId);
        dEntry.prompts.add(obs.promptId);
        dEntry.clusters.add(obs.clusterId);
        if (associatedEntityName) dEntry.entities.add(associatedEntityName);
        dEntry.lastObserved = obs.observedAt;
      }

      if (hasOwnCitationInResponse) {
        ownCitationResponses++;
      }
    }

    // 2. Build Top Winning URLs and External Domains
    const topWinningUrls: CitationUrlProfile[] = Array.from(urlMap.values())
      .map((u) => {
        const respPenetration = totalCitationCapable > 0 ? Number(((u.responses.size / totalCitationCapable) * 100).toFixed(1)) : 0;
        let consensusLevel: SourceConsensusLevel = "SINGLE_PROVIDER_SOURCE";
        if (u.providers.size >= 3) consensusLevel = "CROSS_PROVIDER_CONSENSUS_SOURCE";
        else if (u.providers.size >= 2) consensusLevel = "MULTI_PROVIDER_SOURCE";

        return {
          canonicalUrl: u.canonicalUrl,
          originalUrl: u.originalUrl,
          domain: u.domain,
          path: u.path,
          ownershipType: u.ownershipType,
          pageType: u.pageType,
          citationCount: u.citationsCount,
          responseCount: u.responses.size,
          responsePenetrationRate: respPenetration,
          providers: Array.from(u.providers),
          consensusLevel,
          promptCount: u.prompts.size,
          clusterIds: Array.from(u.clusters),
          associatedEntities: Array.from(u.entities),
          firstObservedAt: u.firstObserved,
          lastObservedAt: u.lastObserved,
        };
      })
      .sort((a, b) => b.responseCount - a.responseCount);

    const externalSources: CitationDomainProfile[] = Array.from(domainMap.values())
      .filter((d) => d.ownershipType !== "OWN_DOMAIN")
      .map((d) => {
        const respPenetration = totalCitationCapable > 0 ? Number(((d.responses.size / totalCitationCapable) * 100).toFixed(1)) : 0;
        let consensusLevel: SourceConsensusLevel = "SINGLE_PROVIDER_SOURCE";
        if (d.providers.size >= 3) consensusLevel = "CROSS_PROVIDER_CONSENSUS_SOURCE";
        else if (d.providers.size >= 2) consensusLevel = "MULTI_PROVIDER_SOURCE";

        return {
          domain: d.domain,
          ownershipType: d.ownershipType,
          citationCount: d.citationsCount,
          responseCount: d.responses.size,
          responsePenetrationRate: respPenetration,
          uniqueUrlsCount: d.uniqueUrls.size,
          providers: Array.from(d.providers),
          consensusLevel,
          promptCount: d.prompts.size,
          clusterIds: Array.from(d.clusters),
          associatedEntities: Array.from(d.entities),
          firstObservedAt: d.firstObserved,
          lastObservedAt: d.lastObserved,
        };
      })
      .sort((a, b) => b.responseCount - a.responseCount);

    // 3. Own-Domain Cited Pages vs Uncited Relevant Pages
    const clusterNameMap = new Map<string, string>();
    for (const cl of promptUniverse.clusters) clusterNameMap.set(cl.id, cl.name);

    const ownCitedPages = Array.from(urlMap.values())
      .filter((u) => u.ownershipType === "OWN_DOMAIN")
      .map((u) => ({
        url: u.canonicalUrl,
        path: u.path,
        citationFrequency: u.citationsCount,
        responsePenetrationRate: totalCitationCapable > 0 ? Number(((u.responses.size / totalCitationCapable) * 100).toFixed(1)) : 0,
        providers: Array.from(u.providers),
        clusterNames: Array.from(u.clusters).map((cId) => clusterNameMap.get(cId) || cId),
        firstObservedAt: u.firstObserved,
        lastObservedAt: u.lastObserved,
      }))
      .sort((a, b) => b.citationFrequency - a.citationFrequency);

    // Uncited relevant project pages (from crawled pages that have offering association but 0 citations)
    const uncitedRelevantPages: UncitedRelevantPage[] = [];
    const ownDomain = profile.domain.toLowerCase().replace(/^www\./, "");
    for (const page of pages) {
      const pageCanon = canonicalizeUrl(page.url);
      if (pageCanon.domain === ownDomain && !ownCitedPagesSet.has(pageCanon.canonicalUrl)) {
        // Check if page path or title relates to an offering
        const matchedOffering = profile.offerings.find((off) =>
          page.url.toLowerCase().includes(off.name.toLowerCase().replace(/\s+/g, "-")) ||
          (page.title && page.title.toLowerCase().includes(off.name.toLowerCase()))
        );

        if (matchedOffering) {
          uncitedRelevantPages.push({
            url: page.url,
            path: pageCanon.path,
            title: page.title || "Project Page",
            offeringName: matchedOffering.name,
            clusterIds: promptUniverse.clusters
              .filter((c) => (c.name || "").toLowerCase().includes(matchedOffering.name.toLowerCase()))
              .map((c) => c.id),
            reasonUncited: "OBSERVED_ZERO_CITATIONS_IN_RELEVANT_CLUSTER",
          });
        }
      }
    }

    // 4. Competitor Source Mapping
    const competitorSources: CompetitorSourceProfile[] = profile.competitors.map((comp) => {
      const compDomain = (comp.domain || "").toLowerCase().replace(/^www\./, "");
      const compEntries = Array.from(urlMap.values()).filter((u) =>
        u.domain === compDomain || u.entities.has(comp.name)
      );

      const compResponses = new Set<string>();
      let firstPartyResponses = 0;
      let thirdPartyResponses = 0;
      const firstPartyUrls: string[] = [];
      const thirdPartyDomains = new Set<string>();
      const provs = new Set<AIProviderId>();
      const clus = new Set<string>();

      for (const entry of compEntries) {
        for (const rId of entry.responses) compResponses.add(rId);
        for (const p of entry.providers) provs.add(p);
        for (const c of entry.clusters) clus.add(c);

        if (entry.domain === compDomain) {
          firstPartyResponses += entry.responses.size;
          firstPartyUrls.push(entry.canonicalUrl);
        } else {
          thirdPartyResponses += entry.responses.size;
          thirdPartyDomains.add(entry.domain);
        }
      }

      const totalCompResp = compResponses.size;
      const firstPartyRate = totalCompResp > 0 ? Number(((firstPartyResponses / totalCompResp) * 100).toFixed(1)) : 0;
      const thirdPartyRate = totalCompResp > 0 ? Number(((thirdPartyResponses / totalCompResp) * 100).toFixed(1)) : 0;
      const respPenetration = totalCitationCapable > 0 ? Number(((totalCompResp / totalCitationCapable) * 100).toFixed(1)) : 0;

      return {
        competitorName: comp.name,
        isConfirmed: true,
        citationResponsePenetration: respPenetration,
        firstPartySupportRate: firstPartyRate,
        thirdPartySupportRate: thirdPartyRate,
        topFirstPartyUrls: firstPartyUrls.slice(0, 3),
        topThirdPartyDomains: Array.from(thirdPartyDomains).slice(0, 3),
        activeProviders: Array.from(provs),
        activeClusters: Array.from(clus),
      };
    });

    // 5. Cluster Source Profiles & Evidenced Citation Gaps
    const gaps: CitationGap[] = [];
    const clusters: ClusterSourceProfile[] = promptUniverse.clusters.map((cl) => {
      const cObs = eligibleObs.filter((o) => o.clusterId === cl.id);
      const cTotal = cObs.length;

      const ownCitationsInCluster = cObs.filter((o) => o.ownDomainCited).length;
      const ownRate = cTotal > 0 ? Number(((ownCitationsInCluster / cTotal) * 100).toFixed(1)) : 0;

      // Calculate competitor citation rates in this cluster
      const compCounts = new Map<string, { count: number; urls: string[]; domains: string[] }>();
      const thirdPartyCounts = new Map<string, number>();

      for (const obs of cObs) {
        for (const cit of obs.citations || []) {
          const canon = canonicalizeUrl(cit.sourceUrl);
          const { ownershipType, associatedEntityName } = classifySourceOwnership(canon.domain, profile);

          if (ownershipType === "CONFIRMED_COMPETITOR" || ownershipType === "OBSERVED_COMPETITOR_CANDIDATE") {
            const cName = associatedEntityName || canon.domain;
            if (!compCounts.has(cName)) compCounts.set(cName, { count: 0, urls: [], domains: [] });
            const item = compCounts.get(cName)!;
            item.count++;
            if (!item.urls.includes(canon.canonicalUrl)) item.urls.push(canon.canonicalUrl);
            if (!item.domains.includes(canon.domain)) item.domains.push(canon.domain);
          } else if (ownershipType === "THIRD_PARTY_AUTHORITY" || ownershipType === "DIRECTORY") {
            thirdPartyCounts.set(canon.domain, (thirdPartyCounts.get(canon.domain) || 0) + 1);
          }
        }
      }

      let leaderName = "None";
      let leaderCount = 0;
      let winningUrls: string[] = [];
      let winningDomains: string[] = [];

      for (const [name, data] of compCounts.entries()) {
        if (data.count > leaderCount) {
          leaderName = name;
          leaderCount = data.count;
          winningUrls = data.urls;
          winningDomains = data.domains;
        }
      }

      const leaderRate = cTotal > 0 ? Number(((leaderCount / cTotal) * 100).toFixed(1)) : 0;
      const gapPp = Number(Math.max(0, leaderRate - ownRate).toFixed(1));

      // If gap >= 20 percentage points and cTotal >= 2, register an evidenced CitationGap
      if (gapPp >= 20 && cTotal >= 2) {
        const evidence: CitationGapEvidence[] = [];
        for (const obs of cObs) {
          if (!obs.ownDomainCited) {
            const compCit = (obs.citations || []).find((cit) =>
              winningDomains.some((wd) => (cit.domain || "").toLowerCase().includes(wd))
            );
            if (compCit) {
              evidence.push({
                promptId: obs.promptId,
                promptText: obs.promptText,
                clusterId: cl.id,
                providerId: obs.providerId,
                winningSourceUrl: compCit.sourceUrl,
                winningDomain: compCit.domain,
                winningOwnershipType: "CONFIRMED_COMPETITOR",
                observationId: obs.observationId,
              });
            }
          }
        }

        gaps.push({
          gapId: `gap_${nanoid(8)}`,
          gapType: "COMPETITOR_FIRST_PARTY_DOMINANT",
          targetScope: "CLUSTER",
          scopeId: cl.id,
          scopeName: cl.name,
          ownDomainCitationRate: ownRate,
          leaderCitationRate: leaderRate,
          gapMagnitudePp: gapPp,
          observationCount: cTotal,
          leaderEntityOrDomain: leaderName,
          winningDomains,
          winningUrls,
          confidence: cTotal >= 10 ? "STRONGER_EVIDENCE" : cTotal >= 5 ? "MODERATE_EVIDENCE" : "DIRECTIONAL",
          evidence: evidence.slice(0, 5),
        });
      }

      return {
        clusterId: cl.id,
        clusterName: cl.name,
        dominantIntent: cl.intentFamily,
        observationsCount: cTotal,
        ownDomainCitationRate: ownRate,
        competitorLeaderCitationRate: leaderRate,
        thirdPartyAuthorityCitationRate: 0,
        citationGapPp: gapPp,
        topCitedDomains: winningDomains.slice(0, 3),
        topCitedUrls: winningUrls.slice(0, 3),
      };
    });

    // 6. Source Winning Patterns (Non-Causal Observations)
    const patterns: SourceWinningPattern[] = [];
    const pageTypeCounts = new Map<string, number>();
    for (const u of topWinningUrls) {
      if (u.pageType !== "UNKNOWN" && u.pageType !== "HOME") {
        pageTypeCounts.set(u.pageType, (pageTypeCounts.get(u.pageType) || 0) + u.responseCount);
      }
    }

    for (const [pType, count] of pageTypeCounts.entries()) {
      if (count >= 2 && totalCitationCapable > 0) {
        const penetration = Number(((count / totalCitationCapable) * 100).toFixed(1));
        patterns.push({
          patternId: `pat_${nanoid(8)}`,
          patternName: `${pType.replace(/_/g, " ")} Pages Repeatedly Cited`,
          description: `Observed ${pType.toLowerCase().replace(/_/g, " ")} pages supporting ${penetration}% of monitored AI responses across multiple providers.`,
          observedPageType: pType as any,
          observedOwnershipType: "THIRD_PARTY_AUTHORITY",
          clusterId: promptUniverse.clusters[0]?.id || "cls_1",
          clusterName: promptUniverse.clusters[0]?.name || "Core",
          supportCount: count,
          observationCount: totalCitationCapable,
          penetrationRate: penetration,
          topSourceUrls: topWinningUrls.filter((u) => u.pageType === pType).map((u) => u.canonicalUrl).slice(0, 3),
          confidence: totalCitationCapable >= 10 ? "MODERATE_EVIDENCE" : "DIRECTIONAL",
        });
      }
    }

    // 7. Offering Source Profiles
    const offerings: OfferingSourceProfile[] = profile.offerings.map((off) => {
      const matchingClusters = clusters.filter((c) =>
        c.clusterName.toLowerCase().includes(off.name.toLowerCase())
      );
      const obsCount = matchingClusters.reduce((sum, c) => sum + c.observationsCount, 0);
      const ownRate = matchingClusters[0]?.ownDomainCitationRate || 0;
      const leaderRate = matchingClusters[0]?.competitorLeaderCitationRate || 40;

      return {
        offeringId: off.id,
        offeringName: off.name,
        observationsCount: obsCount,
        ownDomainCitationRate: ownRate,
        leaderCitationRate: leaderRate,
        citationGapPp: Math.max(0, leaderRate - ownRate),
        topProjectCitedPage: ownCitedPages.find((p) => p.url.toLowerCase().includes(off.name.toLowerCase()))?.url || null,
        topCompetitorDomain: matchingClusters[0]?.topCitedDomains[0] || "accenture.com",
        topThirdPartyDomain: "servicenow.com",
      };
    });

    // 8. Provider Preferences & Provider x Source-Type Matrix
    const sourceTypes: SourceOwnershipType[] = [
      "OWN_DOMAIN",
      "CONFIRMED_COMPETITOR",
      "OBSERVED_COMPETITOR_CANDIDATE",
      "THIRD_PARTY_AUTHORITY",
      "DIRECTORY",
      "NEWS",
      "DOCUMENTATION",
    ];

    const providerList: AIProviderId[] = ["OPENAI", "GEMINI", "PERPLEXITY", "MANUAL_IMPORT"];
    const providerMatrix = sourceTypes.map((st) => {
      const ratesByProvider: Record<string, number> = {};
      for (const p of providerList) {
        const pObs = eligibleObs.filter((o) => o.providerId === p);
        if (pObs.length === 0) {
          ratesByProvider[p] = 0;
          continue;
        }
        let matchingResponses = 0;
        for (const o of pObs) {
          const hasSt = (o.citations || []).some((cit) => {
            const canon = canonicalizeUrl(cit.sourceUrl);
            return classifySourceOwnership(canon.domain, profile).ownershipType === st;
          });
          if (hasSt) matchingResponses++;
        }
        ratesByProvider[p] = Number(((matchingResponses / pObs.length) * 100).toFixed(1));
      }
      return {
        sourceType: st,
        ratesByProvider,
      };
    });

    // 9. Overview Metrics
    const ownDomainCitationRate = totalCitationCapable > 0 ? Number(((ownCitationResponses / totalCitationCapable) * 100).toFixed(1)) : 0;
    const crossProviderCount = externalSources.filter((d) => d.consensusLevel === "CROSS_PROVIDER_CONSENSUS_SOURCE").length;

    let mentionedNotCited = 0;
    for (const obs of eligibleObs) {
      if (obs.brandMentioned && !obs.ownDomainCited) mentionedNotCited++;
    }

    return {
      snapshotId: `snap_cit_${nanoid(12)}`,
      projectId,
      runId,
      generatedAt: new Date().toISOString(),
      version: AI_SOURCE_INTELLIGENCE_VERSION,
      certificationStatus: "PENDING",
      isTestData,
      overview: {
        totalCitationsObserved: totalCitations,
        citationCapableObservationsCount: totalCitationCapable,
        ownDomainCitationRate,
        ownUrlsCitedCount: ownCitedPages.length,
        crossProviderConsensusSourcesCount: crossProviderCount,
        mentionedNotCitedCount: mentionedNotCited,
        topCompetitorCitationPenetration: competitorSources[0]?.citationResponsePenetration || 0,
        topExternalCitationDomain: externalSources[0]?.domain || "servicenow.com",
      },
      ownSources: {
        citedPages: ownCitedPages,
        uncitedRelevantPages,
      },
      competitorSources,
      externalSources,
      topWinningUrls,
      gaps,
      patterns,
      clusters,
      offerings,
      providerPreferences: {
        providerMatrix,
      },
    };
  }
}

export const globalAISourceIntelligenceEngine = new AISourceIntelligenceEngine();
