/**
 * Content Staleness, Freshness Sensitivity & Anti-Fake-Freshness Safeguards.
 * Enforces:
 * OLD_CONTENT ≠ STALE_CONTENT
 * Distinguishes historical/archived content from false freshness claims and verifies factual evidence.
 */

import { FreshnessSensitivity, LifecycleSignal, StaleClaimEvidence } from "./types";

export interface StalenessEvaluationInput {
  url: string;
  pageType: string;
  publishedDate?: string;
  lastUpdatedDate?: string;
  freshnessSensitivity?: FreshnessSensitivity;
  titleText?: string;
  bodyText?: string;

  // Year Context
  outdatedYearReferences?: number[];
  isHistoricalContext?: boolean;
  isArchivedEvent?: boolean;
  isTaxGuideForTaxYear?: boolean;
  isClaimingOutdatedYearIsCurrent?: boolean;
  isRecurringAnnualPage?: boolean;

  // Content Signals
  hasPricingOrServiceTiers?: boolean;
  hasRegulatoryOrLegalCommitments?: boolean;
  hasSoftwareVersionReferences?: boolean;
  hasUpcomingEventDates?: boolean;
  hasStockOrAvailabilitySignals?: boolean;
  hasDynamicBusinessPolicy?: boolean;
  isEvergreenDefinition?: boolean;

  // Concrete Factual Checks
  outdatedPricingDetected?: boolean;
  currentPricingSource?: string;
  expiredEventDetected?: boolean;
  obsoleteSoftwareVersionDetected?: boolean;
  currentSoftwareVersionSource?: string;
  isFakeFreshnessAttemptDetected?: boolean;
}

export interface StalenessEvaluationResult {
  isContentStale: boolean;
  freshnessSensitivity: FreshnessSensitivity;
  stalenessSignals: LifecycleSignal[];
  staleSections: string[];
  staleClaims: StaleClaimEvidence[];
  fakeFreshnessWarning?: string;
}

export function evaluateContentStaleness(input: StalenessEvaluationInput): StalenessEvaluationResult {
  const signals: LifecycleSignal[] = [];
  const staleSections: string[] = [];
  const staleClaims: StaleClaimEvidence[] = [];
  const currentYear = new Date().getFullYear();

  // 1. Content-Aware Freshness Sensitivity Derivation
  let freshnessSensitivity: FreshnessSensitivity = input.freshnessSensitivity || "MODERATE_FRESHNESS_SENSITIVITY";

  if (input.isEvergreenDefinition) {
    freshnessSensitivity = "EVERGREEN";
  } else if (
    input.hasPricingOrServiceTiers ||
    input.hasRegulatoryOrLegalCommitments ||
    input.hasUpcomingEventDates ||
    input.pageType === "news" ||
    input.hasStockOrAvailabilitySignals
  ) {
    freshnessSensitivity = "HIGH_FRESHNESS_SENSITIVITY";
  } else if (input.pageType === "evergreen_guide") {
    freshnessSensitivity = "EVERGREEN";
  } else if (input.pageType === "service_page" && !input.hasPricingOrServiceTiers) {
    freshnessSensitivity = "LOW_FRESHNESS_SENSITIVITY";
  }

  // 2. Fake Freshness Safeguard
  let fakeFreshnessWarning: string | undefined;
  if (input.isFakeFreshnessAttemptDetected) {
    fakeFreshnessWarning =
      "SUPERFICIAL_DATE_CHANGE_DETECTED: Publication date was updated without meaningful substantive content changes. Superficial freshness edits do not improve search quality and are flagged as fake freshness.";
    signals.push({
      signalType: "OUTDATED_YEAR",
      description: fakeFreshnessWarning,
      severity: "WARNING",
    });
  }

  // 3. Year Safety: Differentiate Historical/Archived Articles vs False Current Claims
  if (input.outdatedYearReferences && input.outdatedYearReferences.length > 0) {
    const oldYears = input.outdatedYearReferences.filter((y) => y < currentYear - 1);
    const isHistoricalSafe = input.isHistoricalContext || input.isArchivedEvent || input.isTaxGuideForTaxYear;

    if (oldYears.length > 0 && !isHistoricalSafe) {
      if (input.isClaimingOutdatedYearIsCurrent || input.isRecurringAnnualPage) {
        signals.push({
          signalType: "OUTDATED_YEAR",
          description: `Page incorrectly references outdated year (${oldYears.join(", ")}) as current or requires annual update for current year ${currentYear}.`,
          severity: "WARNING",
          detectedValue: oldYears.join(", "),
        });
        staleSections.push(`Year-specific section referencing ${oldYears.join(", ")}`);
        staleClaims.push({
          claimId: `stale_year_${oldYears[0]}`,
          affectedSection: "Title / Main Header",
          exactEvidence: `Page title/heading references year ${oldYears.join(", ")} in a current context`,
          whyOutdated: `Current year is ${currentYear}; page claims past year is active`,
          sourceOfCurrentTruth: `Calendar Year ${currentYear}`,
          confidence: "HIGH",
          status: "CONFIRMED_STALE",
        });
      }
    }
  }

  // 4. Factual Staleness: Outdated Pricing or Discontinued Products
  if (input.outdatedPricingDetected) {
    signals.push({
      signalType: "OUTDATED_FACTS",
      description: "Page contains outdated pricing tables or discontinued service tiers.",
      severity: "WARNING",
    });
    staleSections.push("Pricing & Service Tier table");
    staleClaims.push({
      claimId: "stale_pricing_table",
      affectedSection: "Pricing & Service Tier table",
      exactEvidence: "Stale price figures or discontinued tiers detected in table markup",
      whyOutdated: "Pricing differs from current published catalog rates",
      sourceOfCurrentTruth: input.currentPricingSource,
      confidence: input.currentPricingSource ? "HIGH" : "MODERATE",
      status: input.currentPricingSource ? "CONFIRMED_STALE" : "MANUAL_FACT_VERIFICATION_REQUIRED",
    });
  }

  // 5. Expired Events
  if (input.expiredEventDetected && !input.isArchivedEvent) {
    signals.push({
      signalType: "OUTDATED_FACTS",
      description: "Page describes a past, concluded event as upcoming.",
      severity: "WARNING",
    });
    staleSections.push("Event schedule and registration section");
    staleClaims.push({
      claimId: "expired_event_notice",
      affectedSection: "Event schedule and registration section",
      exactEvidence: "Registration CTA and future-tense description for a past date",
      whyOutdated: "Event timestamp is in the past",
      confidence: "HIGH",
      status: "CONFIRMED_STALE",
    });
  }

  // 6. Obsolete Software Versions
  if (input.obsoleteSoftwareVersionDetected) {
    signals.push({
      signalType: "OUTDATED_FACTS",
      description: "Documentation or guide references deprecated software major versions.",
      severity: "WARNING",
    });
    staleSections.push("Software configuration / API code snippets");
    staleClaims.push({
      claimId: "obsolete_software_version",
      affectedSection: "Software configuration / API code snippets",
      exactEvidence: "Deprecated API method and version string detected",
      whyOutdated: "Referenced library version is unsupported",
      sourceOfCurrentTruth: input.currentSoftwareVersionSource,
      confidence: input.currentSoftwareVersionSource ? "HIGH" : "LOW",
      status: input.currentSoftwareVersionSource ? "CONFIRMED_STALE" : "MANUAL_FACT_VERIFICATION_REQUIRED",
    });
  }

  const isContentStale = staleSections.length > 0 || staleClaims.some((c) => c.status === "CONFIRMED_STALE" || c.status === "MANUAL_FACT_VERIFICATION_REQUIRED");

  return {
    isContentStale,
    freshnessSensitivity,
    stalenessSignals: signals,
    staleSections,
    staleClaims,
    fakeFreshnessWarning,
  };
}
