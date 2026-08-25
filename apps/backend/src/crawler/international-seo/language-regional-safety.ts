/**
 * Language Alignment & Regional Variant Safety Engine.
 * Verifies content-language against declared hreflang codes, supports bilingual content,
 * and protects high-similarity regional variants (e.g. en-US vs en-GB) from false duplicate-content flags.
 */

import { RegionalVariantReview, LanguageAlignmentState } from "./types";
import { DEFAULT_INTERNATIONAL_POLICY, InternationalSeoPolicy } from "./config";

export interface RawPageTextSample {
  url: string;
  locale: string;
  htmlLang?: string;
  detectedLanguage?: string;
  bodyText?: string;
  currencySymbolsObserved?: string[]; // e.g. ["$", "£", "€", "₹"]
  regionalKeywordsObserved?: string[]; // e.g. ["free shipping us", "next day uk delivery"]
}

export function evaluateLanguageAlignment(
  page: RawPageTextSample
): {
  alignmentState: LanguageAlignmentState;
  details: string;
} {
  const declaredLang = page.locale.split("-")[0].toLowerCase();
  const detected = (page.detectedLanguage || "").toLowerCase();

  if (!detected || detected === "unknown") {
    return {
      alignmentState: "LANGUAGE_INSUFFICIENT_EVIDENCE",
      details: "Insufficient text body to reliably verify primary content language.",
    };
  }

  // Exact language match
  if (detected === declaredLang) {
    return {
      alignmentState: "LANGUAGE_ALIGNED",
      details: `Declared hreflang language '${declaredLang}' matches detected page body language '${detected}'.`,
    };
  }

  // Material mismatch (e.g. French hreflang but English body text)
  if (declaredLang === "fr" && detected === "en") {
    return {
      alignmentState: "HREFLANG_CONTENT_LANGUAGE_MISMATCH",
      details: `Page declared as French ('${page.locale}') but body copy was detected as English. Review whether untranslated copy was published.`,
    };
  }

  if (declaredLang === "de" && detected === "en") {
    return {
      alignmentState: "HREFLANG_CONTENT_LANGUAGE_MISMATCH",
      details: `Page declared as German ('${page.locale}') but body copy was detected as English. Review whether untranslated copy was published.`,
    };
  }

  return {
    alignmentState: "LANGUAGE_POSSIBLE_MISMATCH",
    details: `Detected language '${detected}' differs from declared hreflang '${page.locale}'. (Manual review recommended for multilingual/bilingual sections).`,
  };
}

export function evaluateRegionalVariants(
  pairs: Array<{ page1: RawPageTextSample; page2: RawPageTextSample; similarity: number }>,
  policy: InternationalSeoPolicy = DEFAULT_INTERNATIONAL_POLICY
): RegionalVariantReview[] {
  const reviews: RegionalVariantReview[] = [];

  for (const pair of pairs) {
    const { page1, page2, similarity } = pair;
    const diffs: string[] = [];

    // Check currency differences
    const c1 = page1.currencySymbolsObserved || [];
    const c2 = page2.currencySymbolsObserved || [];
    if (c1.length > 0 && c2.length > 0 && c1.join() !== c2.join()) {
      diffs.push(`CURRENCY_DIFFERENCE: ${c1.join()} vs ${c2.join()}`);
    }

    // Check regional keywords / shipping
    const k1 = page1.regionalKeywordsObserved || [];
    const k2 = page2.regionalKeywordsObserved || [];
    if (k1.length > 0 || k2.length > 0) {
      diffs.push("REGIONAL_OFFER_DIFFERENCE: Location-specific shipping or support terms");
    }

    const isSameLanguageDifferentRegion =
      page1.locale.split("-")[0] === page2.locale.split("-")[0] &&
      page1.locale !== page2.locale;

    if (isSameLanguageDifferentRegion && similarity >= policy.similarityThresholdForRegionalVariant) {
      if (diffs.length > 0) {
        reviews.push({
          sourceUrl: page1.url,
          targetUrl: page2.url,
          sourceLocale: page1.locale,
          targetLocale: page2.locale,
          textSimilarity: similarity,
          detectedRegionalDifferences: diffs,
          classification: "VALID_REGIONAL_VARIANT",
          rationale: `Pages share high text similarity (${Math.round(
            similarity * 100
          )}%) but target distinct regional markets ('${page1.locale}' vs '${page2.locale}') with verified localized differences (${diffs.join(
            ", "
          )}). Protected from duplicate content penalties.`,
        });
      } else {
        reviews.push({
          sourceUrl: page1.url,
          targetUrl: page2.url,
          sourceLocale: page1.locale,
          targetLocale: page2.locale,
          textSimilarity: similarity,
          detectedRegionalDifferences: [],
          classification: "REGIONAL_DIFFERENTIATION_REVIEW",
          rationale: `Pages for '${page1.locale}' and '${page2.locale}' are virtually identical (${Math.round(
            similarity * 100
          )}%) with no observable regional pricing, shipping, or contact differences. Review whether separate regional pages provide distinct user value.`,
        });
      }
    }
  }

  return reviews;
}
