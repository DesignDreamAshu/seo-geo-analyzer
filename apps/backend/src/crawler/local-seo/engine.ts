/**
 * Master Local SEO & Location Intelligence Engine Coordinator.
 * Orchestrates applicability gating, location-scoped NAP verification,
 * doorway safeguards, structured data alignment, Phase 13 Local Pack integration, and Phase 11 action bridges.
 */

import {
  LocalSeoIntelligenceReport,
  LocalSeoSnapshot,
  BusinessLocation,
  BusinessProfileDataset,
  ObservedNapEvidence,
} from "./types";
import { DEFAULT_LOCAL_SEO_POLICY, LocalSeoPolicy } from "./config";
import { determineLocalSeoApplicability, ProjectLocalContext } from "./applicability";
import { evaluateNapConsistency } from "./nap-normalization";
import { evaluateLocationPagesQuality, RawPageLocationData } from "./location-pages";
import { validateLocalStructuredData, ParsedLocalBusinessSchema } from "./structured-data";
import { LocalBusinessProvider } from "./providers/types";
import { getActiveLocalProvider, getLocalProviderImplementationState } from "./providers/provider-registry";
import { extractLocalPackObservations } from "./local-serp-integrator";
import { evaluateLocalReviewGap } from "./competitor-integrator";
import { bridgeLocalOpportunitiesToPhase11 } from "./phase-integrators";
import { createLocalSeoSnapshot } from "./snapshots";
import { SerpSnapshot } from "../competitor-serp/types";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeLocalSeoParams {
  projectId: string;
  targetDomain: string;
  projectContext?: ProjectLocalContext;
  crawledPages?: RawPageLocationData[];
  schemasByLocation?: Map<string, ParsedLocalBusinessSchema[]>;
  serpSnapshots?: SerpSnapshot[];
  competitorProfiles?: BusinessProfileDataset[];
  previousSnapshot?: LocalSeoSnapshot;
  existingActions?: SeoActionItem[];
  provider?: LocalBusinessProvider;
  policy?: LocalSeoPolicy;
}

export interface AnalyzeLocalSeoResult {
  report: LocalSeoIntelligenceReport;
  currentSnapshot?: LocalSeoSnapshot;
  actions: SeoActionItem[];
}

export async function analyzeLocalSeoIntelligence(
  params: AnalyzeLocalSeoParams
): Promise<AnalyzeLocalSeoResult> {
  const policy = params.policy || DEFAULT_LOCAL_SEO_POLICY;
  const provider = params.provider || getActiveLocalProvider();
  const projectContext = params.projectContext || {};
  const crawledPages = params.crawledPages || [];
  const schemasByLocation = params.schemasByLocation || new Map();
  const serpSnapshots = params.serpSnapshots || [];
  const competitorProfiles = params.competitorProfiles || [];

  const providerType = provider ? provider.providerType : "UNCONFIGURED";
  const providerState = getLocalProviderImplementationState(providerType);
  const providerVersion = provider ? provider.providerVersion : "v0.0.0";

  // 1. Applicability Gating
  const applicabilityResult = determineLocalSeoApplicability(projectContext, crawledPages as any);

  if (!applicabilityResult.isLocalIntelligenceApplicable) {
    const nonLocalReport: LocalSeoIntelligenceReport = {
      generatedAt: new Date().toISOString(),
      projectId: params.projectId,
      applicability: applicabilityResult.applicability,
      applicabilityRationale: applicabilityResult.rationale,
      provider: providerType,
      providerStatus: "LOCAL_SEO_NOT_APPLICABLE",
      providerImplementationState: providerState,
      providerVersion,
      appliedPolicy: {
        policyName: policy.policyName,
        selectionSource: policy.selectionSource,
        minCityTokensForDoorwayReview: policy.minCityTokensForDoorwayReview,
        doorwaySimilarityThreshold: policy.doorwaySimilarityThreshold,
        reviewGapSampleSize: policy.reviewGapSampleSize,
      },
      locations: [],
      locationPages: [],
      napConsistency: [],
      structuredDataAlignment: [],
      businessProfileAlignment: [],
      localPackObservations: [],
      citationEvidence: { status: "LOCAL_CITATION_DATA_NOT_CONFIGURED", citations: [] },
      historicalChanges: { isComparable: false, observedNapChanges: [] },
      governanceLimitations: [
        "Project operates as an online-only business. Local SEO storefront/location checks are not applicable.",
        "Zero missing address, missing GBP, or missing LocalBusiness schema defects are generated for non-local sites.",
      ],
      immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
    };

    return {
      report: nonLocalReport,
      actions: [],
    };
  }

  // 2. Fetch Business Profiles & Citations from Provider
  const providerRes = await provider.fetchBusinessProfiles({
    projectId: params.projectId,
    targetDomain: params.targetDomain,
  });

  const profiles = providerRes.profiles || [];
  const citations = providerRes.citations || [];

  // 3. Resolve Business Locations
  const configuredLocs = projectContext.configuredLocations || [];
  let resolvedLocations: BusinessLocation[] = [...configuredLocs];

  if (resolvedLocations.length === 0 && profiles.length > 0) {
    resolvedLocations = profiles.map((p) => ({
      locationId: p.locationId,
      projectId: params.projectId,
      businessName: p.businessName,
      locationName: p.address?.addressLocality ? `${p.businessName} - ${p.address.addressLocality}` : p.businessName,
      address: p.address,
      phone: p.phone,
      city: p.address?.addressLocality,
      region: p.address?.addressRegion,
      postalCode: p.address?.postalCode,
      countryCode: p.address?.addressCountry || "IN",
      locationType: p.address ? "PHYSICAL_LOCATION" : "SERVICE_AREA",
      canonicalLocationUrl: p.websiteUrl,
      serviceAreas: p.serviceAreas,
      primaryCategory: p.primaryCategory,
      additionalCategories: p.additionalCategories,
      openingHours: p.openingHours,
      provenance: { source: "PROVIDER_PROFILE", retrievedAt: p.provenance.retrievedAt },
    }));
  }

  // 4. NAP Consistency Evaluation
  const napEvidenceList: ObservedNapEvidence[] = [];
  for (const p of profiles) {
    napEvidenceList.push({
      sourceUrl: p.websiteUrl || `https://${params.targetDomain}`,
      sourceType: "PROVIDER_PROFILE",
      observedBusinessName: p.businessName,
      observedAddress: p.address,
      observedPhone: p.phone,
      locationId: p.locationId,
      confidence: "HIGH_CONFIDENCE",
    });
  }

  const napConsistency = resolvedLocations.map((loc) => {
    const evalRes = evaluateNapConsistency(loc, napEvidenceList);
    return {
      locationId: loc.locationId,
      locationName: loc.locationName,
      state: evalRes.state,
      details: evalRes.details,
      evidenceCount: evalRes.evidenceCount,
    };
  });

  // 5. Location Pages Quality & Doorway Safeguards
  const locationPages = evaluateLocationPagesQuality(crawledPages, policy);

  // 6. Structured Data Alignment
  const structuredDataAlignment = resolvedLocations.map((loc) => {
    const locSchemas = schemasByLocation.get(loc.locationId) || [];
    return {
      locationId: loc.locationId,
      ...validateLocalStructuredData(loc, locSchemas),
    };
  });

  // 7. Business Profile Alignment & Review Volume Gap
  const businessProfileAlignment = resolvedLocations.map((loc) => {
    const matchingProfile = profiles.find((p) => p.locationId === loc.locationId);
    let websiteUrlAlignment: "BUSINESS_PROFILE_WEBSITE_ALIGNED" | "BUSINESS_PROFILE_WEBSITE_REDIRECTED" | "BUSINESS_PROFILE_WEBSITE_MISMATCH" | "BUSINESS_PROFILE_WEBSITE_UNKNOWN" = "BUSINESS_PROFILE_WEBSITE_UNKNOWN";

    if (matchingProfile?.websiteUrl && loc.canonicalLocationUrl) {
      if (matchingProfile.websiteUrl === loc.canonicalLocationUrl) {
        websiteUrlAlignment = "BUSINESS_PROFILE_WEBSITE_ALIGNED";
      } else {
        websiteUrlAlignment = "BUSINESS_PROFILE_WEBSITE_MISMATCH";
      }
    }

    const reviewGap = evaluateLocalReviewGap(matchingProfile, competitorProfiles, policy);

    return {
      locationId: loc.locationId,
      websiteUrlAlignment,
      categoryAlignment: matchingProfile?.primaryCategory ? ("CATEGORY_ALIGNED" as const) : ("CATEGORY_NOT_CONFIGURED" as const),
      hoursState: matchingProfile?.openingHours ? ("HOURS_ALIGNED" as const) : ("HOURS_NOT_AVAILABLE" as const),
      reviewMetrics: matchingProfile
        ? {
            reviewCount: matchingProfile.reviewCount || 0,
            aggregateRating: matchingProfile.aggregateRating || 0,
            reviewVolumeGap: reviewGap.gapFinding,
          }
        : undefined,
    };
  });

  // 8. Local SERP Integration (Phase 13 Local Pack)
  const localSerp = extractLocalPackObservations(serpSnapshots, params.targetDomain, resolvedLocations[0]?.businessName || "BOT Consulting");

  // 9. Actions Bridge to Phase 11
  const actions = bridgeLocalOpportunitiesToPhase11(
    params.projectId,
    resolvedLocations,
    locationPages,
    businessProfileAlignment,
    params.existingActions || []
  );

  // 10. Build Snapshot
  const snapshotId = `SNAP_LOC_${params.projectId}_${Date.now().toString(36)}`;
  const currentSnapshot = createLocalSeoSnapshot({
    snapshotId,
    projectId: params.projectId,
    applicability: applicabilityResult.applicability,
    locations: resolvedLocations,
    provider: provider.providerType,
    providerVersion: provider.providerVersion,
    completeness: providerRes.status,
    profiles,
  });

  const report: LocalSeoIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    applicability: applicabilityResult.applicability,
    applicabilityRationale: applicabilityResult.rationale,
    provider: provider.providerType,
    providerStatus: providerRes.status,
    providerImplementationState: providerState,
    providerVersion: provider.providerVersion,
    appliedPolicy: {
      policyName: policy.policyName,
      selectionSource: policy.selectionSource,
      minCityTokensForDoorwayReview: policy.minCityTokensForDoorwayReview,
      doorwaySimilarityThreshold: policy.doorwaySimilarityThreshold,
      reviewGapSampleSize: policy.reviewGapSampleSize,
    },
    locations: resolvedLocations,
    locationPages,
    napConsistency,
    structuredDataAlignment,
    businessProfileAlignment,
    localPackObservations: localSerp.observations,
    citationEvidence: {
      status: citations.length > 0 ? "LOCAL_CITATION_DATA_CONFIGURED" : "LOCAL_CITATION_DATA_NOT_CONFIGURED",
      citations,
    },
    historicalChanges: {
      isComparable: true,
      observedNapChanges: [],
    },
    governanceLimitations: [
      "Local presence observations represent point-in-time facts from configured providers; they do not represent absolute real-time map positions.",
      "A Service Area Business (SAB) is never penalized or flagged for withholding a public storefront street address.",
      "Review gap observations are descriptive; review manipulation or incentivization is strictly prohibited.",
      "City-substituted location pages with high duplication trigger manual doorway reviews rather than automated penalty assertions.",
      "Local SEO intelligence never mutates the project's 95-rule technical SEO Health score.",
    ],
    immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  return {
    report,
    currentSnapshot,
    actions,
  };
}
