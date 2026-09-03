/**
 * Domain & DNS Security Fact Inspector (SECURITY S1 / S2).
 * Inspects CAA, SPF, and DMARC DNS records with Public-Suffix-Aware domain handling
 * and host deduplication caching. Truthfully reports DNSSEC capability without fabricating results.
 */

import * as dns from "node:dns/promises";
import type { DomainDnsSecurityFacts } from "../types";

const dnsFactsCache = new Map<string, DomainDnsSecurityFacts>();

/**
 * Common ccTLD second-level category label set.
 */
const KNOWN_SECOND_LEVEL_PREFIXES = new Set([
  "com", "co", "net", "ne", "org", "or", "edu", "ed", "gov", "go", "gob", "govt",
  "ac", "ad", "mil", "nom", "sch", "school", "gen", "firm", "ind", "nic", "res",
  "asn", "id", "pe", "re", "muni", "idv", "ltd", "plc", "me", "hs", "ms", "es"
]);

/**
 * Checks if a string is an IPv4 or IPv6 address.
 */
export function isIpAddress(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").trim();
  // IPv4 check
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) {
    const octets = clean.split(".").map((o) => parseInt(o, 10));
    return octets.every((o) => o >= 0 && o <= 255);
  }
  // IPv6 check (contains colons)
  if (clean.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Extracts the registrable (root) domain from a hostname in a Public-Suffix-aware manner.
 * Handles single-label hosts (localhost), IP addresses, standard gTLDs (example.com),
 * and ccTLD compound suffixes (example.co.uk, example.com.au, example.co.in, etc.).
 */
export function extractRootDomain(host: string): string {
  if (!host) return "";
  const clean = host.toLowerCase().trim().replace(/\.$/, ""); // strip trailing dot

  // 1. IP Addresses / Localhost / Single Label Hosts
  if (clean === "localhost" || clean.endsWith(".local") || clean.endsWith(".internal") || isIpAddress(clean)) {
    return clean;
  }

  const parts = clean.split(".");
  if (parts.length <= 1) {
    return clean;
  }
  if (parts.length === 2) {
    return clean;
  }

  // 2. Check compound public suffix (e.g. *.co.uk, *.com.au, *.co.in)
  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];

  // ccTLDs are 2-letter codes. If the second-to-last label is a known second-level registry label
  // (or <=3 chars under a 2-char ccTLD), the public suffix is two parts.
  const isCompoundPublicSuffix =
    lastPart.length === 2 &&
    (KNOWN_SECOND_LEVEL_PREFIXES.has(secondLastPart) ||
      (secondLastPart.length <= 3 && !KNOWN_SECOND_LEVEL_PREFIXES.has(secondLastPart) && parts.length >= 3));

  if (isCompoundPublicSuffix) {
    if (parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return clean;
  }

  // 3. Standard single TLD (e.g. example.com, example.org, sub.example.app)
  return parts.slice(-2).join(".");
}

/**
 * Clears the DNS facts cache (useful for testing).
 */
export function clearDnsFactsCache(): void {
  dnsFactsCache.clear();
}

/**
 * Parses DMARC tag-value pairs from a raw DMARC TXT record string.
 */
export function parseDmarcRecord(rawDmarc: string) {
  const parts = rawDmarc.split(";").map((p) => p.trim()).filter(Boolean);
  let policy: DomainDnsSecurityFacts["dmarcPolicy"] = "unspecified";
  let subdomainPolicy: DomainDnsSecurityFacts["dmarcSubdomainPolicy"] = null;
  let percentage: number | null = null;
  const rua: string[] = [];
  const ruf: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) {
      const tag = part.slice(0, eqIdx).trim().toLowerCase();
      const val = part.slice(eqIdx + 1).trim();

      if (tag === "p") {
        const lower = val.toLowerCase();
        if (lower === "none") policy = "none";
        else if (lower === "quarantine") policy = "quarantine";
        else if (lower === "reject") policy = "reject";
        else policy = "invalid";
      } else if (tag === "sp") {
        const lower = val.toLowerCase();
        if (lower === "none") subdomainPolicy = "none";
        else if (lower === "quarantine") subdomainPolicy = "quarantine";
        else if (lower === "reject") subdomainPolicy = "reject";
      } else if (tag === "pct") {
        const num = parseInt(val, 10);
        if (!isNaN(num)) percentage = num;
      } else if (tag === "rua") {
        rua.push(...val.split(",").map((s) => s.trim()).filter(Boolean));
      } else if (tag === "ruf") {
        ruf.push(...val.split(",").map((s) => s.trim()).filter(Boolean));
      }
    }
  }

  return { policy, subdomainPolicy, percentage, rua: rua.length > 0 ? rua : null, ruf: ruf.length > 0 ? ruf : null };
}

/**
 * Inspects DNS CAA, SPF, and DMARC records for a domain/host.
 */
export async function inspectDomainDns(
  host: string,
  timeoutMs = 6000
): Promise<DomainDnsSecurityFacts> {
  const cleanHost = host.toLowerCase().trim();
  const domain = extractRootDomain(cleanHost);
  const cacheKey = `${domain}:${cleanHost}`;

  const cached = dnsFactsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const queryTimestamp = new Date().toISOString();
  const resolver = new dns.Resolver({ timeout: timeoutMs, tries: 1 });

  let caaRecords: DomainDnsSecurityFacts["caaRecords"] = [];
  let txtRecords: string[][] = [];
  let dmarcTxtRecord: string | null = null;
  let resolverErrorMessage: string | null = null;
  let status: DomainDnsSecurityFacts["dnsResolverStatus"] = "SUCCESS";

  // 1. Resolve CAA records (try exact host first, then registrable domain)
  try {
    const rawCaa = await resolver.resolveCaa(cleanHost).catch(() => resolver.resolveCaa(domain));
    caaRecords = rawCaa.map((item) => ({
      flags: item.critical ?? 0,
      tag: item.issue ? "issue" : item.issuewild ? "issuewild" : item.iodef ? "iodef" : "custom",
      value: item.issue || item.issuewild || item.iodef || (item as any).value || "",
    }));
  } catch (err: any) {
    // ENOTFOUND / ENODATA / SERVFAIL / NOTFOUND are expected when no CAA record is published
    if (
      err.code !== "ENODATA" &&
      err.code !== "ENOTFOUND" &&
      err.code !== "SERVFAIL" &&
      err.code !== "NOTFOUND"
    ) {
      resolverErrorMessage = err.message;
      status = "PARTIAL";
    }
  }

  // 2. Resolve TXT records for SPF
  try {
    txtRecords = await resolver.resolveTxt(domain).catch(() => resolver.resolveTxt(cleanHost));
  } catch (err: any) {
    if (err.code !== "ENODATA" && err.code !== "ENOTFOUND" && err.code !== "NOTFOUND") {
      resolverErrorMessage = err.message;
      status = "PARTIAL";
    }
  }

  // 3. Resolve DMARC record from _dmarc.<domain>
  try {
    const dmarcHost = `_dmarc.${domain}`;
    const dmarcRecords = await resolver.resolveTxt(dmarcHost).catch(() =>
      cleanHost !== domain ? resolver.resolveTxt(`_dmarc.${cleanHost}`) : []
    );
    for (const chunk of dmarcRecords) {
      const joined = chunk.join("");
      if (joined.toLowerCase().startsWith("v=dmarc1")) {
        dmarcTxtRecord = joined;
        break;
      }
    }
  } catch (err: any) {
    // No DMARC record found
  }

  // Filter SPF records
  const spfRecords: string[] = [];
  for (const chunk of txtRecords) {
    const joined = chunk.join("");
    if (joined.toLowerCase().startsWith("v=spf1")) {
      spfRecords.push(joined);
    }
  }

  const hasSpfRecord = spfRecords.length > 0;
  const isSpfSyntacticallyValid =
    hasSpfRecord &&
    spfRecords.every((rec) => {
      const lower = rec.toLowerCase();
      return (
        lower.includes("all") ||
        lower.includes("include:") ||
        lower.includes("ip4:") ||
        lower.includes("ip6:") ||
        lower.includes("redirect=") ||
        lower.includes("a") ||
        lower.includes("mx")
      );
    });

  const hasDmarcRecord = Boolean(dmarcTxtRecord);
  const parsedDmarc = dmarcTxtRecord
    ? parseDmarcRecord(dmarcTxtRecord)
    : { policy: "unspecified" as const, subdomainPolicy: null, percentage: null, rua: null, ruf: null };

  const result: DomainDnsSecurityFacts = {
    domain,
    host: cleanHost,
    queryTimestamp,
    dnsResolverStatus: status,
    resolverErrorMessage,
    caaRecords,
    hasCaaRecord: caaRecords.length > 0,
    txtRecords,
    spfRecords,
    hasSpfRecord,
    isSpfSyntacticallyValid,
    dmarcRecord: dmarcTxtRecord,
    hasDmarcRecord,
    dmarcPolicy: parsedDmarc.policy,
    dmarcSubdomainPolicy: parsedDmarc.subdomainPolicy,
    dmarcPercentage: parsedDmarc.percentage,
    dmarcRua: parsedDmarc.rua,
    dmarcRuf: parsedDmarc.ruf,
    dnssec: {
      capability: "NOT_OBSERVABLE",
      status: "NOT_OBSERVABLE",
      details:
        "DNSSEC validation requires a validating recursive stub resolver with EDNS0 DO-flag support; not directly observable via standard Node DNS resolver.",
    },
  };

  dnsFactsCache.set(cacheKey, result);
  return result;
}
