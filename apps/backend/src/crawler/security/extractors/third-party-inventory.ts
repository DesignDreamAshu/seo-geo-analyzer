/**
 * Third-Party Inventory Fact Extractor (SECURITY S1).
 * Aggregates site-wide third-party origins, external scripts, styles, CDNs, and SRI facts.
 */

import type {
  ResourceSecurityFact,
  SecurityResourceType,
  ThirdPartyInventoryFacts,
  ThirdPartyOriginFact,
} from "../types";

export function buildThirdPartyInventory(
  allResources: ResourceSecurityFact[]
): ThirdPartyInventoryFacts {
  const originMap = new Map<
    string,
    {
      hostname: string;
      resourceUrls: Set<string>;
      resourceTypes: Set<SecurityResourceType>;
      pageUrls: Set<string>;
      isHttps: boolean;
      hasInsecureHttp: boolean;
      sriApplicableCount: number;
      sriWithIntegrityCount: number;
    }
  >();

  const allSeenOrigins = new Set<string>();
  const firstPartyOrigins = new Set<string>();
  let totalThirdPartyResources = 0;

  for (const res of allResources) {
    if (!res.resourceOrigin) continue;
    allSeenOrigins.add(res.resourceOrigin);

    if (res.isFirstParty) {
      firstPartyOrigins.add(res.resourceOrigin);
      continue;
    }

    totalThirdPartyResources++;
    let entry = originMap.get(res.resourceOrigin);
    if (!entry) {
      let hostname = res.resourceOrigin;
      try {
        hostname = new URL(res.resourceOrigin).hostname;
      } catch {}

      entry = {
        hostname,
        resourceUrls: new Set(),
        resourceTypes: new Set(),
        pageUrls: new Set(),
        isHttps: true,
        hasInsecureHttp: false,
        sriApplicableCount: 0,
        sriWithIntegrityCount: 0,
      };
      originMap.set(res.resourceOrigin, entry);
    }

    entry.resourceUrls.add(res.resolvedAbsoluteUrl);
    entry.resourceTypes.add(res.resourceType);
    entry.pageUrls.add(res.sourcePageUrl);

    if (res.isInsecureHttp) {
      entry.isHttps = false;
      entry.hasInsecureHttp = true;
    }

    // SRI is typically applicable to external JavaScript and CSS
    const isSriApplicable = res.resourceType === "script" || res.resourceType === "stylesheet";
    if (isSriApplicable) {
      entry.sriApplicableCount++;
      if (res.hasIntegrity && res.hasValidSriHash) {
        entry.sriWithIntegrityCount++;
      }
    }
  }

  const thirdPartyOrigins: ThirdPartyOriginFact[] = Array.from(originMap.entries()).map(
    ([origin, data]) => ({
      origin,
      hostname: data.hostname,
      resourceCount: data.resourceUrls.size,
      resourceTypes: Array.from(data.resourceTypes),
      affectedPagesCount: data.pageUrls.size,
      sampleResourceUrls: Array.from(data.resourceUrls).slice(0, 5),
      samplePageUrls: Array.from(data.pageUrls).slice(0, 5),
      isHttps: data.isHttps,
      hasInsecureHttpResources: data.hasInsecureHttp,
      sriCoverage: {
        totalApplicableResources: data.sriApplicableCount,
        resourcesWithSri: data.sriWithIntegrityCount,
        resourcesWithoutSri: data.sriApplicableCount - data.sriWithIntegrityCount,
      },
    })
  );

  // Sort by affected pages count descending
  thirdPartyOrigins.sort((a, b) => b.affectedPagesCount - a.affectedPagesCount);

  return {
    totalUniqueOrigins: allSeenOrigins.size,
    thirdPartyOriginsCount: thirdPartyOrigins.length,
    firstPartyOriginsCount: firstPartyOrigins.size,
    totalThirdPartyResources,
    thirdPartyOrigins,
  };
}
