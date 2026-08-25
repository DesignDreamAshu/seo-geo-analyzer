/**
 * Local SEO Applicability Gate & Non-Local Safety Boundary.
 * Determines whether a project operates as a physical local business, service area business,
 * multi-location entity, or purely online business.
 * Invariant: ONLINE_ONLY_BUSINESS produces ZERO missing address or LocalBusiness schema defects.
 */

import { LocalBusinessApplicability, BusinessLocation } from "./types";

export interface ProjectLocalContext {
  configuredApplicability?: LocalBusinessApplicability;
  configuredLocations?: BusinessLocation[];
  hasPhysicalStorefront?: boolean;
  hasServiceAreas?: boolean;
  hasOnlineOnlyFlag?: boolean;
  businessType?: string; // e.g. "SAAS", "ECOMMERCE", "LOCAL_SERVICE", "CONSULTING_OFFICE"
}

export function determineLocalSeoApplicability(
  projectContext: ProjectLocalContext,
  crawledPages: Array<{ url: string; title?: string; bodyText?: string; schemas?: any[] }> = []
): {
  applicability: LocalBusinessApplicability;
  rationale: string;
  isLocalIntelligenceApplicable: boolean;
} {
  // 1. Explicit Project Configuration
  if (projectContext.configuredApplicability) {
    const isApplicable = projectContext.configuredApplicability !== "ONLINE_ONLY_BUSINESS";
    return {
      applicability: projectContext.configuredApplicability,
      rationale: `Explicitly configured as ${projectContext.configuredApplicability}.`,
      isLocalIntelligenceApplicable: isApplicable,
    };
  }

  if (projectContext.hasOnlineOnlyFlag || projectContext.businessType === "SAAS" || projectContext.businessType === "ECOMMERCE") {
    return {
      applicability: "ONLINE_ONLY_BUSINESS",
      rationale: "Project business model is purely digital/online. Local storefront/location SEO is not applicable.",
      isLocalIntelligenceApplicable: false,
    };
  }

  // 2. Location Configuration Check
  const configuredLocs = projectContext.configuredLocations || [];
  if (configuredLocs.length > 1) {
    return {
      applicability: "MULTI_LOCATION_BUSINESS",
      rationale: `Project operates ${configuredLocs.length} configured physical/service locations.`,
      isLocalIntelligenceApplicable: true,
    };
  }

  if (configuredLocs.length === 1) {
    const loc = configuredLocs[0];
    if (loc.locationType === "SERVICE_AREA") {
      return {
        applicability: "SERVICE_AREA_BUSINESS",
        rationale: "Project operates as a Service Area Business (SAB) serving regional customers without a public storefront.",
        isLocalIntelligenceApplicable: true,
      };
    }
    if (loc.locationType === "HYBRID") {
      return {
        applicability: "HYBRID_LOCAL_BUSINESS",
        rationale: "Project operates a physical storefront with extended regional service area coverage.",
        isLocalIntelligenceApplicable: true,
      };
    }
    return {
      applicability: "LOCAL_BUSINESS",
      rationale: "Project operates a verified physical local business location.",
      isLocalIntelligenceApplicable: true,
    };
  }

  // 3. Website Crawl Evidence (Detect Location/Contact Pages & Schemas)
  const hasLocalBusinessSchema = crawledPages.some((p) =>
    (p.schemas || []).some((s) => s["@type"] === "LocalBusiness" || s["@type"]?.includes("Store") || s["@type"]?.includes("Restaurant") || s["@type"]?.includes("ProfessionalService"))
  );

  const locationPages = crawledPages.filter((p) => p.url.includes("/locations/") || p.url.includes("/stores/") || p.url.includes("/branches/"));

  if (locationPages.length >= 2) {
    return {
      applicability: "MULTI_LOCATION_BUSINESS",
      rationale: `Discovered ${locationPages.length} dedicated location detail pages in site structure.`,
      isLocalIntelligenceApplicable: true,
    };
  }

  if (hasLocalBusinessSchema || locationPages.length === 1) {
    return {
      applicability: "LOCAL_BUSINESS",
      rationale: "Discovered LocalBusiness structured data and dedicated location/contact page.",
      isLocalIntelligenceApplicable: true,
    };
  }

  // Default to Online Only / Unknown if no local storefront or location pages exist
  return {
    applicability: "ONLINE_ONLY_BUSINESS",
    rationale: "No physical locations, Service Area declarations, or LocalBusiness schema discovered on site.",
    isLocalIntelligenceApplicable: false,
  };
}
