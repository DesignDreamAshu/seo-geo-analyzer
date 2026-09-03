/**
 * Security Facts Collector (SECURITY S1).
 * Orchestrates collection of all authoritative URL, header, cookie, resource, form,
 * TLS, DNS, safe-probe, and platform facts at their correct respective scopes.
 */

import type { CrawledPageData } from "../types";
import type {
  SecurityAuditFacts,
  SecurityCapabilities,
  UrlResponseSecurityFacts,
  ResponseSecurityHeadersFacts,
  CookieSecurityFact,
  ResourceSecurityFact,
  FormSecurityFact,
  HostTlsSecurityFacts,
  DomainDnsSecurityFacts,
  PlatformSecurityFacts,
} from "./types";
import { redactHeadersMap } from "./redaction";
import { extractAllSecurityHeadersFacts } from "./parsers/headers-parser";
import { extractCookiesFromHeaders } from "./parsers/cookie-parser";
import { extractPageResources, extractAllMixedContent } from "./extractors/resource-extractor";
import { extractPageForms } from "./extractors/form-extractor";
import { inspectHostTls } from "./extractors/tls-inspector";
import { inspectDomainDns, extractRootDomain } from "./extractors/dns-inspector";
import { buildThirdPartyInventory } from "./extractors/third-party-inventory";
import { executeSafeProbes } from "./extractors/safe-probes";
import { inspectSecurityTxt } from "./extractors/security-txt-inspector";
import { detectPlatformFromPages } from "../fix-intelligence/platform-adapters";

export interface SecurityFactsCollectorOptions {
  seedUrl: string;
  skipNetworkProbes?: boolean; // useful for offline unit tests
  timeoutMs?: number;
}

export function getDefaultSecurityCapabilities(skipNetworkProbes = false): SecurityCapabilities {
  return {
    tlsCertificateInspection: skipNetworkProbes ? "NOT_AVAILABLE" : "AVAILABLE",
    tlsNegotiatedCipher: skipNetworkProbes ? "NOT_AVAILABLE" : "AVAILABLE",
    tlsDeprecatedProtocolProbing: "NOT_AVAILABLE", // Passive audit does not execute deprecated multi-handshake probe
    securityHeaderAnalysis: "AVAILABLE",
    cspDirectiveParsing: "AVAILABLE",
    hstsDirectiveParsing: "AVAILABLE",
    cookieAttributeInspection: "AVAILABLE",
    mixedContentDetection: "AVAILABLE",
    formTransportInspection: "AVAILABLE",
    thirdPartyOriginInventory: "AVAILABLE",
    subresourceIntegrityObservation: "AVAILABLE",
    dnsCaaInspection: skipNetworkProbes ? "NOT_AVAILABLE" : "AVAILABLE",
    dnsSpfDmarcInspection: skipNetworkProbes ? "NOT_AVAILABLE" : "AVAILABLE",
    dnssecValidation: "NOT_OBSERVABLE", // Standard resolver lacks DO validation flag
    safeSensitiveFileProbing: skipNetworkProbes ? "NOT_AVAILABLE" : "AVAILABLE",
    frameworkVersionObservation: "AVAILABLE",
    activeExploitationTesting: "NOT_AVAILABLE", // Strictly prohibited in passive posture engine
  };
}

export async function collectSecurityFacts(
  crawledPages: CrawledPageData[],
  options: SecurityFactsCollectorOptions
): Promise<SecurityAuditFacts> {
  const auditTimestamp = new Date().toISOString();
  const seedUrl = options.seedUrl;

  let seedOrigin = "";
  let seedHost = "";
  let seedDomain = "";
  try {
    const parsedSeed = new URL(seedUrl.startsWith("http") ? seedUrl : `https://${seedUrl}`);
    seedOrigin = parsedSeed.origin;
    seedHost = parsedSeed.hostname;
    seedDomain = extractRootDomain(seedHost);
  } catch {
    seedOrigin = seedUrl;
    seedHost = seedUrl;
    seedDomain = seedUrl;
  }

  const urlFacts: Record<string, UrlResponseSecurityFacts> = {};
  const securityHeadersByUrl: Record<string, ResponseSecurityHeadersFacts> = {};
  const allCookies: CookieSecurityFact[] = [];
  const allResources: ResourceSecurityFact[] = [];
  const allForms: FormSecurityFact[] = [];
  const uniqueHosts = new Set<string>();
  const uniqueDomains = new Set<string>();

  if (seedHost) {
    uniqueHosts.add(seedHost);
    uniqueDomains.add(seedDomain);
  }

  // 1. Process Per-Page Facts
  for (const page of crawledPages) {
    const pageUrl = page.url;
    let pageProtocol = "http:";
    let pageHostname = "";
    let pageOrigin = "";

    try {
      const parsed = new URL(pageUrl);
      pageProtocol = parsed.protocol;
      pageHostname = parsed.hostname;
      pageOrigin = parsed.origin;
      uniqueHosts.add(pageHostname);
      uniqueDomains.add(extractRootDomain(pageHostname));
    } catch {}

    const isHttps = pageProtocol === "https:";
    const isInsecureHttp = pageProtocol === "http:";

    const rawHeaders = page.headers || {};
    const redactedHeaders = redactHeadersMap(rawHeaders);

    const urlFact: UrlResponseSecurityFacts = {
      requestedUrl: page.requestedUrl || pageUrl,
      finalUrl: page.finalUrl || pageUrl,
      protocol: pageProtocol,
      hostname: pageHostname,
      origin: pageOrigin,
      httpStatus: page.statusCode,
      isRedirect: (page.redirectHops && page.redirectHops.length > 0) || false,
      redirectChain: page.redirectHops || [],
      contentType: page.contentType || "",
      rawHeaders,
      redactedHeaders,
      responseTimestamp: page.crawledAt || auditTimestamp,
      isHttps,
      isInsecureHttp,
    };
    urlFacts[pageUrl] = urlFact;

    // Security Response Headers
    const secHeaders = extractAllSecurityHeadersFacts(rawHeaders);
    securityHeadersByUrl[pageUrl] = secHeaders;

    // Cookies
    const pageCookies = extractCookiesFromHeaders(rawHeaders, pageUrl);
    allCookies.push(...pageCookies);

    // Resources & Mixed Content
    const pageResources = extractPageResources(page, seedOrigin);
    allResources.push(...pageResources);

    // Forms
    const pageForms = extractPageForms(page);
    allForms.push(...pageForms);
  }

  const mixedContentOccurrences = extractAllMixedContent(allResources);
  const thirdPartyInventory = buildThirdPartyInventory(allResources);

  // 2. Platform / Framework Evidence (Reused from existing detection)
  const platformResult = detectPlatformFromPages(crawledPages);
  let ownershipScope: PlatformSecurityFacts["ownershipScope"] = "UNKNOWN";
  if (platformResult.platform === "webflow" || platformResult.platform === "shopify") {
    ownershipScope = "PLATFORM_HOSTING_CONTROLLED";
  } else if (platformResult.platform === "wordpress" || platformResult.platform === "nextjs") {
    ownershipScope = "HYBRID";
  } else if (platformResult.platform === "generic_html") {
    ownershipScope = "USER_CONFIGURABLE";
  }

  const platform: PlatformSecurityFacts = {
    detectedPlatform: platformResult.platform,
    confidence: platformResult.confidence,
    signals: platformResult.signals,
    isHighConfidence: platformResult.confidence >= 0.75,
    ownershipScope,
  };

  // 3. Host-Level TLS Inspection (Deduplicated across discovered hosts)
  const tlsByHost: Record<string, HostTlsSecurityFacts> = {};
  if (!options.skipNetworkProbes) {
    for (const host of uniqueHosts) {
      if (!host || host === "localhost" || host === "127.0.0.1") continue;
      const tlsResult = await inspectHostTls(host, 443, options.timeoutMs || 5000);
      tlsByHost[host] = tlsResult;
    }
  }

  // 4. Domain-Level DNS Inspection (Deduplicated across discovered domains)
  const dnsByDomain: Record<string, DomainDnsSecurityFacts> = {};
  if (!options.skipNetworkProbes) {
    for (const domain of uniqueDomains) {
      if (!domain || domain === "localhost") continue;
      const dnsResult = await inspectDomainDns(domain, options.timeoutMs || 5000);
      dnsByDomain[domain] = dnsResult;
    }
  }

  // 5. Safe Bounded Probes (Executed once on seed origin)
  const safeProbes = !options.skipNetworkProbes && seedOrigin.startsWith("http")
    ? await executeSafeProbes(seedOrigin, options.timeoutMs || 4000)
    : [];

  // 6. RFC 9116 security.txt Inspection (Executed once on seed domain)
  const securityTxt = !options.skipNetworkProbes && (seedDomain || seedHost)
    ? await inspectSecurityTxt(seedDomain || seedHost, { timeoutMs: options.timeoutMs || 3000, skipNetworkProbes: options.skipNetworkProbes })
    : null;

  const capabilities = getDefaultSecurityCapabilities(Boolean(options.skipNetworkProbes));

  return {
    targetDomain: seedDomain || seedHost,
    seedUrl,
    auditTimestamp,
    capabilities,
    urlFacts,
    securityHeadersByUrl,
    cookies: allCookies,
    resources: allResources,
    mixedContentOccurrences,
    forms: allForms,
    tlsByHost,
    dnsByDomain,
    thirdPartyInventory,
    safeProbes,
    platform,
    securityTxt,
  };
}
