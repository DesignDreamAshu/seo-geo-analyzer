/**
 * Domain & URL Normalization for Backlinks & Off-Page Intelligence.
 * Safely parses hostnames, preserves subdomains (e.g. news.example.com vs forum.example.com),
 * extracts registrable domains, strips tracking query parameters, and verifies own-domain boundaries.
 */

export interface NormalizedBacklinkUrlInfo {
  rawUrl: string;
  normalizedUrl: string;
  hostname: string;
  domain: string;
  rootDomain: string;
  subdomain?: string;
  pathname: string;
}

export function parseAndNormalizeBacklinkUrl(rawUrl: string): NormalizedBacklinkUrlInfo {
  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    const clean = rawUrl.replace(/^[a-zA-Z]+:\/\//, "").split("/")[0].toLowerCase();
    return {
      rawUrl,
      normalizedUrl: rawUrl.toLowerCase(),
      hostname: clean,
      domain: clean.replace(/^www\./, ""),
      rootDomain: extractRegistrableDomain(clean),
      pathname: "/",
    };
  }

  // Strip tracking parameters
  const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"];
  for (const p of paramsToRemove) {
    urlObj.searchParams.delete(p);
  }

  const hostname = urlObj.hostname.toLowerCase();
  const domain = hostname.replace(/^www\./, "");
  const rootDomain = extractRegistrableDomain(domain);

  let subdomain: string | undefined;
  if (domain !== rootDomain) {
    const subPart = domain.substring(0, domain.length - rootDomain.length - 1);
    if (subPart && subPart !== "www") {
      subdomain = subPart;
    }
  }

  let normalizedUrl = urlObj.toString();
  if (urlObj.pathname === "/" && !urlObj.search && !urlObj.hash) {
    normalizedUrl = `${urlObj.protocol}//${urlObj.host}`;
  }

  return {
    rawUrl,
    normalizedUrl,
    hostname,
    domain,
    rootDomain,
    subdomain,
    pathname: urlObj.pathname,
  };
}

export function extractRegistrableDomain(domainOrHostname: string): string {
  const clean = domainOrHostname.toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;

  const twoPartTlds = ["co.uk", "org.uk", "gov.uk", "com.au", "net.au", "co.in", "net.in", "co.nz", "com.br", "edu.au"];
  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

export function isOwnBacklinkDomain(url: string, ownDomainAliases: string[] = []): boolean {
  if (ownDomainAliases.length === 0) return false;

  const { domain, rootDomain } = parseAndNormalizeBacklinkUrl(url);

  for (const alias of ownDomainAliases) {
    const aliasNorm = alias.toLowerCase().replace(/^www\./, "").replace(/\/.*$/, "");
    const aliasRoot = extractRegistrableDomain(aliasNorm);

    if (domain === aliasNorm) return true;

    if (rootDomain === aliasRoot) {
      if (domain === aliasRoot || domain.endsWith(`.${aliasRoot}`)) {
        return true;
      }
    }
  }

  return false;
}
