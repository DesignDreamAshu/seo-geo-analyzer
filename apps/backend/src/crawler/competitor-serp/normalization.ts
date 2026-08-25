/**
 * Domain & URL Normalization for Competitor & SERP Intelligence.
 * Safely parses hostnames, preserves subdomains (e.g. docs.example.com != www.example.com),
 * and prevents substring false positives during own-domain matching.
 */

export interface NormalizedDomainInfo {
  rawUrl: string;
  normalizedUrl: string;
  hostname: string;
  domain: string;
  rootDomain: string;
  subdomain?: string;
}

export function parseAndNormalizeUrl(rawUrl: string): NormalizedDomainInfo {
  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    // Fallback simple parsing
    const clean = rawUrl.replace(/^[a-zA-Z]+:\/\//, "").split("/")[0].toLowerCase();
    return {
      rawUrl,
      normalizedUrl: rawUrl.toLowerCase(),
      hostname: clean,
      domain: clean.replace(/^www\./, ""),
      rootDomain: extractRootDomain(clean),
    };
  }

  // Remove tracking parameters
  const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  for (const p of paramsToRemove) {
    urlObj.searchParams.delete(p);
  }

  const hostname = urlObj.hostname.toLowerCase();
  const domain = hostname.replace(/^www\./, "");
  const rootDomain = extractRootDomain(domain);

  let subdomain: string | undefined;
  if (domain !== rootDomain) {
    const subPart = domain.substring(0, domain.length - rootDomain.length - 1);
    if (subPart && subPart !== "www") {
      subdomain = subPart;
    }
  }

  // Clean trailing slash if path is just /
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
  };
}

export function extractRootDomain(domainOrHostname: string): string {
  const clean = domainOrHostname.toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;

  // Handle two-part TLDs (e.g., co.uk, com.au, org.uk, co.in)
  const twoPartTlds = ["co.uk", "org.uk", "gov.uk", "com.au", "net.au", "co.in", "net.in", "co.nz", "com.br"];
  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

/**
 * Checks if a given URL belongs to the project's own domain or configured aliases.
 * Strictly checks exact hostname or legitimate subdomain of own domain,
 * preventing 'example.com.evil-domain.com' false positives.
 */
export function isOwnDomain(url: string, ownDomainAliases: string[] = []): boolean {
  if (ownDomainAliases.length === 0) return false;

  const { domain, rootDomain } = parseAndNormalizeUrl(url);

  for (const alias of ownDomainAliases) {
    const aliasNorm = alias.toLowerCase().replace(/^www\./, "").replace(/\/.*$/, "");
    const aliasRoot = extractRootDomain(aliasNorm);

    // Exact domain match
    if (domain === aliasNorm) return true;

    // Root domain match if root matches
    if (rootDomain === aliasRoot) {
      // Must be a proper dot-separated subdomain
      if (domain === aliasRoot || domain.endsWith(`.${aliasRoot}`)) {
        return true;
      }
    }
  }

  return false;
}
