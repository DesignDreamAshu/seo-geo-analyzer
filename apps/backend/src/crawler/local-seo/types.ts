/**
 * Phase 15: Local SEO & Location Intelligence — Core Data Types.
 * Adheres strictly to non-fabrication, location identity stability,
 * multi-location isolation, doorway safeguards, and zero fake GBP/citation/authority scores.
 */

import { CompetitorRelationship, SerpSnapshot, SerpDevice } from "../competitor-serp/types";

export type LocalBusinessApplicability =
  | "LOCAL_BUSINESS"
  | "MULTI_LOCATION_BUSINESS"
  | "SERVICE_AREA_BUSINESS"
  | "HYBRID_LOCAL_BUSINESS"
  | "ONLINE_ONLY_BUSINESS"
  | "UNKNOWN_LOCAL_APPLICABILITY";

export type LocationType =
  | "PHYSICAL_LOCATION"
  | "SERVICE_AREA"
  | "HYBRID"
  | "VIRTUAL_OR_UNKNOWN";

export type LocationPageClassification =
  | "PRIMARY_LOCATION_PAGE"
  | "LOCATION_DETAIL_PAGE"
  | "SERVICE_AREA_PAGE"
  | "CONTACT_PAGE"
  | "CITY_CONTENT_PAGE"
  | "NON_LOCATION_PAGE"
  | "AMBIGUOUS_LOCATION_PAGE";

export type NapConsistencyState =
  | "NAP_CONSISTENT"
  | "NAP_FORMAT_VARIATION_ONLY"
  | "NAP_POSSIBLE_MISMATCH"
  | "NAP_CONFIRMED_MISMATCH"
  | "NAP_INSUFFICIENT_EVIDENCE";

export type OpeningHoursState =
  | "HOURS_ALIGNED"
  | "HOURS_POSSIBLE_MISMATCH"
  | "HOURS_CONFIRMED_MISMATCH"
  | "HOURS_NOT_AVAILABLE";

export type BusinessProfileProviderType =
  | "GOOGLE_BUSINESS_PROFILE"
  | "GOOGLE_PLACES_API"
  | "DATAFORSEO_LOCAL"
  | "MANUAL_VERIFIED_DATASET"
  | "MOCK_LOCAL_PROVIDER"
  | "UNCONFIGURED";

export type LocalProviderImplementationState =
  | "IMPLEMENTED_AND_TESTED"
  | "ARCHITECTURE_READY"
  | "NOT_CONFIGURED"
  | "UNSUPPORTED";

export type LocalDatasetStatus =
  | "LOCAL_DATA_FRESH_COMPLETE"
  | "LOCAL_DATA_PARTIAL"
  | "LOCAL_DATA_NOT_CONFIGURED"
  | "LOCAL_PROVIDER_AUTH_FAILED"
  | "LOCAL_PROVIDER_QUOTA_EXCEEDED"
  | "LOCAL_FETCH_FAILED"
  | "LOCAL_SEO_NOT_APPLICABLE";

export interface PostalAddress {
  streetAddress?: string;
  addressLocality?: string; // City
  addressRegion?: string; // State/Province
  postalCode?: string;
  addressCountry?: string; // Country Code e.g. "IN", "US"
  rawAddressText?: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface OpeningHoursSpecification {
  dayOfWeek: string[]; // e.g. ["Monday", "Tuesday", ...]
  opens?: string; // e.g. "09:00"
  closes?: string; // e.g. "18:00"
  isClosed?: boolean;
}

export interface ServiceArea {
  name: string; // e.g. "Jaipur", "Ajmer", "Kota"
  region?: string;
  countryCode?: string;
}

export interface BusinessLocation {
  locationId: string;
  projectId: string;
  businessName: string;
  locationName: string; // e.g. "Jaipur Headquarters", "Delhi Branch"
  address?: PostalAddress;
  phone?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  coordinates?: GeoCoordinates;
  locationType: LocationType;
  canonicalLocationUrl?: string;
  serviceAreas?: ServiceArea[];
  primaryCategory?: string;
  additionalCategories?: string[];
  openingHours?: OpeningHoursSpecification[];
  provenance: {
    source: "CONFIGURED" | "WEBSITE_PAGE" | "STRUCTURED_DATA" | "PROVIDER_PROFILE";
    retrievedAt: string;
  };
}

export interface ObservedNapEvidence {
  sourceUrl: string;
  sourceType: "FOOTER" | "CONTACT_PAGE" | "LOCATION_PAGE" | "STRUCTURED_DATA" | "PROVIDER_PROFILE";
  observedBusinessName?: string;
  observedAddress?: PostalAddress;
  observedPhone?: string;
  locationId: string;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
}

export interface LocationPageQualityReview {
  url: string;
  locationId?: string;
  classification: LocationPageClassification;
  hasUniqueIdentity: boolean;
  hasAddressOrServiceArea: boolean;
  hasPhoneOrContact: boolean;
  hasHours: boolean;
  hasStructuredData: boolean;
  isIndexable: boolean;
  isSelfCanonical: boolean;
  internalDiscoverySource?: "LOCATION_HUB" | "HEADER_NAV" | "FOOTER" | "ORPHAN";
  similarityClusterId?: string;
  doorwayReviewFinding?: {
    finding: "LOCAL_DOORWAY_PAGE_REVIEW" | "LOCATION_PAGE_DIFFERENTIATION_REVIEW";
    rationale: string;
  };
}

export interface BusinessProfileDataset {
  profileId: string;
  locationId: string;
  businessName: string;
  primaryCategory: string;
  additionalCategories: string[];
  address?: PostalAddress;
  serviceAreas?: ServiceArea[];
  phone?: string;
  websiteUrl?: string;
  openingHours?: OpeningHoursSpecification[];
  coordinates?: GeoCoordinates;
  reviewCount?: number;
  aggregateRating?: number;
  profileStatus: "VERIFIED" | "UNVERIFIED" | "SUSPENDED" | "UNKNOWN";
  provenance: {
    provider: BusinessProfileProviderType;
    providerVersion: string;
    retrievedAt: string;
  };
}

export interface LocalPackObservation {
  query: string;
  locationContext: string; // e.g. "Jaipur, Rajasthan, India"
  coordinatesContext?: GeoCoordinates;
  device: SerpDevice;
  language: string;
  isProjectObserved: boolean;
  observedPosition?: number; // e.g. 1, 2, 3 in local pack
  observedTitle?: string;
  competitorsObserved: Array<{
    title: string;
    address?: string;
    rating?: number;
    reviewCount?: number;
    category?: string;
    relationship: CompetitorRelationship;
  }>;
  provenance: {
    provider: string;
    retrievalTimestamp: string;
    snapshotId: string;
  };
}

export interface CitationRecord {
  directoryName: string;
  directoryUrl: string;
  observedNap: {
    name?: string;
    address?: PostalAddress;
    phone?: string;
  };
  locationId: string;
  alignmentState: "CITATION_NAP_ALIGNED" | "CITATION_FORMAT_VARIATION" | "CITATION_POSSIBLE_MISMATCH" | "CITATION_CONFIRMED_MISMATCH";
  notes?: string;
}

export interface LocalSeoSnapshot {
  snapshotId: string;
  projectId: string;
  applicability: LocalBusinessApplicability;
  locations: BusinessLocation[];
  provider: BusinessProfileProviderType;
  providerVersion: string;
  retrievalTimestamp: string;
  completeness: LocalDatasetStatus;
  profiles: BusinessProfileDataset[];
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface LocalSeoIntelligenceReport {
  generatedAt: string;
  projectId: string;
  applicability: LocalBusinessApplicability;
  applicabilityRationale: string;
  provider: BusinessProfileProviderType;
  providerStatus: LocalDatasetStatus;
  providerImplementationState: LocalProviderImplementationState;
  providerVersion: string;
  appliedPolicy: {
    policyName: string;
    selectionSource: string;
    minCityTokensForDoorwayReview: number;
    doorwaySimilarityThreshold: number;
    reviewGapSampleSize: number;
  };
  locations: BusinessLocation[];
  locationPages: LocationPageQualityReview[];
  napConsistency: Array<{
    locationId: string;
    locationName: string;
    state: NapConsistencyState;
    details: string;
    evidenceCount: number;
  }>;
  structuredDataAlignment: Array<{
    locationId: string;
    schemaType: string;
    isAligned: boolean;
    issuesFound: string[];
  }>;
  businessProfileAlignment: Array<{
    locationId: string;
    websiteUrlAlignment: "BUSINESS_PROFILE_WEBSITE_ALIGNED" | "BUSINESS_PROFILE_WEBSITE_REDIRECTED" | "BUSINESS_PROFILE_WEBSITE_MISMATCH" | "BUSINESS_PROFILE_WEBSITE_UNKNOWN";
    categoryAlignment: "CATEGORY_ALIGNED" | "LOCAL_CATEGORY_ALIGNMENT_REVIEW" | "CATEGORY_NOT_CONFIGURED";
    hoursState: OpeningHoursState;
    reviewMetrics?: {
      reviewCount: number;
      aggregateRating: number;
      reviewVolumeGap?: {
        finding: "LOCAL_REVIEW_VOLUME_GAP_OBSERVED";
        rationale: string;
      };
    };
  }>;
  localPackObservations: LocalPackObservation[];
  citationEvidence: {
    status: "LOCAL_CITATION_DATA_CONFIGURED" | "LOCAL_CITATION_DATA_NOT_CONFIGURED";
    citations: CitationRecord[];
  };
  historicalChanges: {
    isComparable: boolean;
    incomparabilityReason?: string;
    observedReviewCountChange?: number;
    observedRatingChange?: number;
    observedNapChanges: string[];
  };
  governanceLimitations: string[];
  immutabilityStatement: string;
}
