/**
 * International URL Architecture & Cross-Domain Intelligence.
 * Detects ccTLDs, Subdomains, Subdirectories, and Mixed Architectures without arbitrary quality biases.
 */

import { UrlArchitectureType } from "./types";

export function determineUrlArchitecture(urls: string[]): {
  architectureType: UrlArchitectureType;
  details: string;
} {
  if (urls.length === 0) {
    return { architectureType: "SUBDIRECTORY", details: "Default standard architecture." };
  }

  let hasCcTld = false;
  let hasSubdomain = false;
  let hasSubdirectory = false;

  for (const raw of urls) {
    try {
      const u = new URL(raw);
      const hostParts = u.hostname.split(".");
      const tld = hostParts[hostParts.length - 1];

      // ccTLD check
      if (["fr", "de", "uk", "au", "in", "jp", "ca", "es", "it", "nl", "br"].includes(tld)) {
        hasCcTld = true;
      }

      // Subdomain check (e.g. fr.example.com)
      if (hostParts.length >= 3 && ["fr", "de", "es", "it", "uk", "us", "eu", "en"].includes(hostParts[0])) {
        hasSubdomain = true;
      }

      // Subdirectory check (e.g. /fr/, /de/)
      const pathSegment = u.pathname.split("/").filter(Boolean)[0];
      if (pathSegment && (pathSegment.length === 2 || pathSegment.includes("-"))) {
        hasSubdirectory = true;
      }
    } catch {
      // ignore
    }
  }

  const typesCount = (hasCcTld ? 1 : 0) + (hasSubdomain ? 1 : 0) + (hasSubdirectory ? 1 : 0);

  if (typesCount > 1) {
    return {
      architectureType: "MIXED_ARCHITECTURE",
      details: "Website utilizes a mixed international architecture across domains, subdomains, or subdirectories.",
    };
  }

  if (hasCcTld) {
    return {
      architectureType: "CCTLD",
      details: "Website utilizes country-code top-level domains (ccTLDs) for market targeting.",
    };
  }

  if (hasSubdomain) {
    return {
      architectureType: "SUBDOMAIN",
      details: "Website utilizes localized subdomains (e.g. fr.example.com) for market targeting.",
    };
  }

  return {
    architectureType: "SUBDIRECTORY",
    details: "Website utilizes localized subdirectories (e.g. /fr/, /de/) for market targeting.",
  };
}
