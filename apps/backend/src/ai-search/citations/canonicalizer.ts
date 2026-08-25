/**
 * Phase 28F: Safe URL and Domain Canonicalization Engine.
 * Strips tracking parameters, fragments, default ports, and normalizes domains while preserving semantic path distinctness.
 */

export interface CanonicalizedUrlResult {
  originalUrl: string;
  canonicalUrl: string;
  domain: string;
  hostname: string;
  subdomain: string | null;
  path: string;
  protocol: string;
}

const TRACKING_PARAM_PREFIXES = ["utm_", "fbclid", "gclid", "msclkid", "ref", "source", "mc_cid", "mc_eid", "_ga", "_hsenc", "_hsmi"];

export function canonicalizeUrl(rawUrl: string): CanonicalizedUrlResult {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    return {
      originalUrl: rawUrl,
      canonicalUrl: "",
      domain: "",
      hostname: "",
      subdomain: null,
      path: "/",
      protocol: "https:",
    };
  }

  let urlObj: URL;
  try {
    urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return {
      originalUrl: rawUrl,
      canonicalUrl: trimmed.toLowerCase(),
      domain: trimmed.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").toLowerCase(),
      hostname: trimmed.split("/")[0].toLowerCase(),
      subdomain: null,
      path: "/",
      protocol: "https:",
    };
  }

  // 1. Normalize Hostname & Domain
  const hostname = urlObj.hostname.toLowerCase();
  const cleanDomain = hostname.replace(/^www\./, "");

  // Extract Subdomain
  let subdomain: string | null = null;
  const parts = cleanDomain.split(".");
  if (parts.length > 2) {
    subdomain = parts[0];
  }

  // 2. Normalize Path
  let path = urlObj.pathname;
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  if (!path) path = "/";

  // 3. Strip Tracking & Analytics Parameters
  const newParams = new URLSearchParams();
  for (const [key, value] of urlObj.searchParams.entries()) {
    const keyLower = key.toLowerCase();
    const isTracking = TRACKING_PARAM_PREFIXES.some((prefix) => keyLower === prefix || keyLower.startsWith(prefix));
    if (!isTracking) {
      newParams.append(key, value);
    }
  }

  // Rebuild Canonical URL
  const searchStr = newParams.toString() ? `?${newParams.toString()}` : "";
  const canonicalUrl = `https://${cleanDomain}${path}${searchStr}`;

  return {
    originalUrl: rawUrl,
    canonicalUrl,
    domain: cleanDomain,
    hostname,
    subdomain,
    path,
    protocol: urlObj.protocol || "https:",
  };
}

export function canonicalizeDomain(rawDomain: string): { canonicalDomain: string; hostname: string; subdomain: string | null } {
  const clean = (rawDomain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();

  const parts = clean.split(".");
  let subdomain: string | null = null;
  if (parts.length > 2) {
    subdomain = parts[0];
  }

  return {
    canonicalDomain: clean,
    hostname: (rawDomain || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0],
    subdomain,
  };
}
