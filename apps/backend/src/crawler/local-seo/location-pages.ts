/**
 * Location Page Quality & Doorway Safeguards Engine.
 * Evaluates location landing pages for distinct local value, discoverability,
 * indexability, and detects city-substitution doorway patterns without automated spam accusations.
 */

import { LocationPageQualityReview, LocationPageClassification } from "./types";
import { DEFAULT_LOCAL_SEO_POLICY, LocalSeoPolicy } from "./config";

export interface RawPageLocationData {
  url: string;
  title?: string;
  h1?: string;
  bodyText?: string;
  statusCode?: number;
  isNoindex?: boolean;
  canonicalUrl?: string;
  hasLocalSchema?: boolean;
  hasAddressText?: boolean;
  hasPhoneText?: boolean;
  hasHoursText?: boolean;
  discoveredInLocationHub?: boolean;
  discoveredInFooter?: boolean;
}

export function classifyLocationPage(url: string, title: string = "", body: string = ""): LocationPageClassification {
  const normUrl = url.toLowerCase();
  const normTitle = title.toLowerCase();

  if (normUrl.includes("/locations/") || normUrl.includes("/branches/") || normUrl.includes("/stores/")) {
    if (normUrl.endsWith("/locations") || normUrl.endsWith("/locations/")) {
      return "PRIMARY_LOCATION_PAGE";
    }
    return "LOCATION_DETAIL_PAGE";
  }

  if (normUrl.includes("/service-areas/") || normUrl.includes("/areas-served/")) {
    return "SERVICE_AREA_PAGE";
  }

  if (normUrl.includes("/contact") || normUrl.includes("/reach-us")) {
    return "CONTACT_PAGE";
  }

  // Check if city name is in URL with service keywords (e.g. /seo-jaipur, /web-design-delhi)
  const cityKeywords = [
    "jaipur",
    "delhi",
    "mumbai",
    "bangalore",
    "pune",
    "hyderabad",
    "chennai",
    "kolkata",
    "chicago",
    "new-york",
    "london",
    "austin",
    "dallas",
    "seattle",
    "san-francisco",
  ];
  const hasCityInUrl = cityKeywords.some((c) => normUrl.includes(`-${c}`) || normUrl.includes(`/${c}`));

  if (hasCityInUrl) {
    return "CITY_CONTENT_PAGE";
  }

  return "NON_LOCATION_PAGE";
}

export function evaluateLocationPagesQuality(
  pages: RawPageLocationData[],
  policy: LocalSeoPolicy = DEFAULT_LOCAL_SEO_POLICY
): LocationPageQualityReview[] {
  const reviews: LocationPageQualityReview[] = [];

  // Group pages that look like city-substituted service pages
  const cityPages: RawPageLocationData[] = [];

  for (const p of pages) {
    const classification = classifyLocationPage(p.url, p.title, p.bodyText);
    if (classification === "NON_LOCATION_PAGE") continue;

    if (classification === "CITY_CONTENT_PAGE" || classification === "LOCATION_DETAIL_PAGE") {
      cityPages.push(p);
    }

    const isIndexable = !p.isNoindex && (p.statusCode === 200 || p.statusCode === undefined);
    const isSelfCanonical = !p.canonicalUrl || p.canonicalUrl === p.url;

    let discoverySource: LocationPageQualityReview["internalDiscoverySource"];
    if (p.discoveredInLocationHub) discoverySource = "LOCATION_HUB";
    else if (p.discoveredInFooter) discoverySource = "FOOTER";
    else discoverySource = "HEADER_NAV";

    reviews.push({
      url: p.url,
      classification,
      hasUniqueIdentity: Boolean(p.h1 && p.h1.trim().length > 3),
      hasAddressOrServiceArea: Boolean(p.hasAddressText),
      hasPhoneOrContact: Boolean(p.hasPhoneText),
      hasHours: Boolean(p.hasHoursText),
      hasStructuredData: Boolean(p.hasLocalSchema),
      isIndexable,
      isSelfCanonical,
      internalDiscoverySource: discoverySource,
    });
  }

  // Doorway / Template Duplication Analysis
  if (cityPages.length >= policy.minCityTokensForDoorwayReview) {
    // Check pairwise structural similarity across city pages
    let duplicateClusters = 0;
    for (let i = 0; i < cityPages.length; i++) {
      for (let j = i + 1; j < cityPages.length; j++) {
        const text1 = (cityPages[i].bodyText || "").toLowerCase();
        const text2 = (cityPages[j].bodyText || "").toLowerCase();
        if (text1.length > 50 && text2.length > 50) {
          const sim = calculateJaccardSimilarity(text1, text2);
          if (sim >= policy.doorwaySimilarityThreshold) {
            duplicateClusters++;
          }
        }
      }
    }

    if (duplicateClusters >= policy.minCityTokensForDoorwayReview) {
      for (const rev of reviews) {
        if (rev.classification === "CITY_CONTENT_PAGE" || rev.classification === "LOCATION_DETAIL_PAGE") {
          rev.doorwayReviewFinding = {
            finding: "LOCAL_DOORWAY_PAGE_REVIEW",
            rationale: `Discovered ${cityPages.length} city-targeted pages exhibiting high template similarity (>= ${Math.round(
              policy.doorwaySimilarityThreshold * 100
            )}%) with city-token substitution. Review whether each page provides genuine localized value and unique service details. (Manual review; no automated penalty implied).`,
          };
        }
      }
    }
  }

  return reviews;
}

function calculateJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = words1.size + words2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
