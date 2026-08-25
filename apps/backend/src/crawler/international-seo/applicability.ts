/**
 * International SEO Applicability Gate & Non-International Safety Boundary.
 * Invariant: SINGLE_LANGUAGE_SINGLE_MARKET produces ZERO missing hreflang or x-default defects.
 */

import { InternationalApplicability, LocaleDefinition } from "./types";

export interface ProjectInternationalContext {
  configuredApplicability?: InternationalApplicability;
  configuredLocales?: LocaleDefinition[];
  targetCountries?: string[];
  targetLanguages?: string[];
  hasMultiCountryPresence?: boolean;
}

export function determineInternationalApplicability(
  projectContext: ProjectInternationalContext,
  crawledHreflangCount: number = 0,
  discoveredPathPrefixes: string[] = []
): {
  applicability: InternationalApplicability;
  rationale: string;
  isInternationalApplicable: boolean;
} {
  // 1. Explicit Project Configuration
  if (projectContext.configuredApplicability) {
    const isApplicable = projectContext.configuredApplicability !== "SINGLE_LANGUAGE_SINGLE_MARKET";
    return {
      applicability: projectContext.configuredApplicability,
      rationale: `Explicitly configured as ${projectContext.configuredApplicability}.`,
      isInternationalApplicable: isApplicable,
    };
  }

  const configuredLocales = projectContext.configuredLocales || [];
  if (configuredLocales.length > 1) {
    const hasMultipleLanguages = new Set(configuredLocales.map((l) => l.languageCode)).size > 1;
    const hasMultipleRegions = new Set(configuredLocales.map((l) => l.regionCode).filter(Boolean)).size > 1;

    if (hasMultipleLanguages && hasMultipleRegions) {
      return {
        applicability: "MULTILINGUAL_MULTI_MARKET",
        rationale: `Configured for ${configuredLocales.length} distinct language/region locales across multiple markets.`,
        isInternationalApplicable: true,
      };
    }

    if (hasMultipleLanguages) {
      return {
        applicability: "MULTILINGUAL_SINGLE_MARKET",
        rationale: "Configured with multiple language versions serving a primary market.",
        isInternationalApplicable: true,
      };
    }

    if (hasMultipleRegions) {
      return {
        applicability: "SINGLE_LANGUAGE_MULTI_MARKET",
        rationale: "Configured with single language (e.g. English) targeting multiple regional markets (e.g. US, UK, AU).",
        isInternationalApplicable: true,
      };
    }
  }

  // 2. Crawl Discovery Evidence
  if (crawledHreflangCount > 0 || discoveredPathPrefixes.length >= 2) {
    return {
      applicability: "MULTILINGUAL_MULTI_MARKET",
      rationale: `Discovered active hreflang alternate annotations and localized path prefixes on site.`,
      isInternationalApplicable: true,
    };
  }

  // Default: Single language, single market
  return {
    applicability: "SINGLE_LANGUAGE_SINGLE_MARKET",
    rationale: "No alternate language versions, regional targeting, or hreflang tags declared on site.",
    isInternationalApplicable: false,
  };
}
