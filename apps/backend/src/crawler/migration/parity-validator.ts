/**
 * Comprehensive Content Parity, Staging Leak Matrix, and Environment Safety Engine.
 * Evaluates semantic parity (non-word-count based) and inspects staging references across
 * canonical, hreflang, sitemap, internal links, OG tags, and schema data.
 */

import { UrlMappingEntry, DestinationUrlRecord, LaunchBlockerState, ContentParityState } from "./types";

export interface ParityIssue {
  issueType:
    | "STAGING_CANONICAL_LEAK"
    | "STAGING_HREFLANG_LEAK"
    | "STAGING_SITEMAP_LEAK"
    | "STAGING_INTERNAL_LINK_LEAK"
    | "STAGING_OG_URL_LEAK"
    | "STAGING_SCHEMA_URL_LEAK"
    | "MIGRATION_STALE_CANONICAL"
    | "PRODUCTION_INHERITED_NOINDEX"
    | "PRODUCTION_X_ROBOTS_NOINDEX"
    | "PRODUCTION_ROBOTS_TXT_DISALLOW"
    | "MIGRATION_STALE_SITEMAP_URL"
    | "MIGRATION_INTERNAL_LINK_TO_LEGACY_URL"
    | "POST_MIGRATION_ORPHAN_CANDIDATE"
    | "MIGRATION_SCHEMA_LOSS"
    | "MIGRATION_SIGNIFICANT_CONTENT_LOSS";
  url: string;
  blockerState: LaunchBlockerState;
  details: string;
  suggestedFix: string;
}

export function evaluateSemanticContentParity(
  source: { topicIntent?: string; primaryEntities?: string[]; title?: string; h1?: string },
  destination: { topicIntent?: string; primaryEntities?: string[]; title?: string; h1?: string },
  textSimilarity: number = 0.5
): { parityState: ContentParityState; rationale: string } {
  // If intent and entities align, even with low lexical similarity / shorter redesign -> STRONG
  const sameIntent = source.topicIntent && destination.topicIntent && source.topicIntent === destination.topicIntent;
  const sameTitleH1Core = source.h1 && destination.h1 && source.h1.toLowerCase() === destination.h1.toLowerCase();

  if (sameIntent || sameTitleH1Core) {
    return {
      parityState: "CONTENT_PARITY_STRONG",
      rationale: "Core conversion intent, primary service entities, and heading purpose are preserved cleanly.",
    };
  }

  // High lexical similarity but completely different intent -> WEAK
  if (textSimilarity > 0.8 && source.topicIntent && destination.topicIntent && source.topicIntent !== destination.topicIntent) {
    return {
      parityState: "CONTENT_PARITY_WEAK",
      rationale: "High structural/lexical similarity observed but target intent differs fundamentally from source purpose.",
    };
  }

  if (textSimilarity >= 0.7) {
    return {
      parityState: "CONTENT_PARITY_STRONG",
      rationale: "Strong content and entity alignment between legacy source and new destination.",
    };
  }

  if (textSimilarity >= 0.4) {
    return {
      parityState: "CONTENT_PARITY_PARTIAL",
      rationale: "Partial content overlap. Verify whether specific sub-topics or conversion elements were omitted.",
    };
  }

  return {
    parityState: "CONTENT_PARITY_WEAK",
    rationale: "Substantial topic and structural divergence between source and destination pages.",
  };
}

export function validateMigrationParity(params: {
  mappings: UrlMappingEntry[];
  destinationPages: DestinationUrlRecord[];
  isProductionEnvironment: boolean;
  legacyDomain?: string;
  stagingDomain?: string;
  sitemapUrls?: string[];
  hreflangUrls?: Array<{ sourceUrl: string; targetUrl: string }>;
  internalLinks?: Array<{ sourceUrl: string; targetUrl: string }>;
  robotsTxtDisallows?: string[];
  xRobotsNoindexUrls?: string[];
}): {
  parityIssues: ParityIssue[];
  strongParityCount: number;
  partialParityCount: number;
  weakParityCount: number;
  schemaLossCount: number;
  stagingLeaksCount: number;
  staleCanonicalCount: number;
  legacyInternalLinksCount: number;
} {
  const issues: ParityIssue[] = [];
  const stagingDomain = (params.stagingDomain || "staging.example.com").toLowerCase();
  const legacyDomain = (params.legacyDomain || "legacy.com").toLowerCase();

  let strongCount = 0;
  let partialCount = 0;
  let weakCount = 0;
  let schemaLossCount = 0;
  let stagingLeaksCount = 0;
  let staleCanonicalCount = 0;
  let legacyInternalLinksCount = 0;

  // 1. Destination Canonical, Staging Leaks & Schema
  for (const dest of params.destinationPages) {
    if (dest.canonicalUrl) {
      const canonLower = dest.canonicalUrl.toLowerCase();

      // Check staging canonical leak
      if (canonLower.includes("staging.") || canonLower.includes("dev.") || canonLower.includes(stagingDomain)) {
        stagingLeaksCount++;
        issues.push({
          issueType: "STAGING_CANONICAL_LEAK",
          url: dest.url,
          blockerState: params.isProductionEnvironment ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
          details: `Destination URL [${dest.url}] specifies a canonical tag pointing to staging domain [${dest.canonicalUrl}].`,
          suggestedFix: `Update canonical URL to production domain [${dest.url}].`,
        });
      }

      // Check legacy old-domain canonical
      if (canonLower.includes(legacyDomain) && !dest.url.includes(legacyDomain)) {
        staleCanonicalCount++;
        issues.push({
          issueType: "MIGRATION_STALE_CANONICAL",
          url: dest.url,
          blockerState: params.isProductionEnvironment ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
          details: `Destination URL [${dest.url}] specifies a canonical tag pointing to old legacy domain [${dest.canonicalUrl}].`,
          suggestedFix: `Update canonical tag to point to self on the new production destination.`,
        });
      }
    }

    // Check Open Graph Staging URL
    if (dest.ogUrl && (dest.ogUrl.includes("staging.") || dest.ogUrl.includes("dev."))) {
      stagingLeaksCount++;
      issues.push({
        issueType: "STAGING_OG_URL_LEAK",
        url: dest.url,
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Open Graph og:url metadata points to staging URL [${dest.ogUrl}].`,
        suggestedFix: `Update og:url tag to production destination [${dest.url}].`,
      });
    }

    // Check Schema Staging URLs
    if (dest.schemaUrls) {
      for (const sUrl of dest.schemaUrls) {
        if (sUrl.includes("staging.") || sUrl.includes("dev.")) {
          stagingLeaksCount++;
          issues.push({
            issueType: "STAGING_SCHEMA_URL_LEAK",
            url: dest.url,
            blockerState: "REVIEW_BEFORE_LAUNCH",
            details: `Structured data JSON-LD contains staging URL reference [${sUrl}].`,
            suggestedFix: `Update JSON-LD entity URLs to production domain.`,
          });
        }
      }
    }

    // Check Production Inherited Noindex (HTML Meta Robots)
    if (params.isProductionEnvironment && !dest.isIndexable) {
      issues.push({
        issueType: "PRODUCTION_INHERITED_NOINDEX",
        url: dest.url,
        blockerState: "LAUNCH_BLOCKER",
        details: `Production destination URL [${dest.url}] has a meta robots noindex directive inherited from staging/dev environment.`,
        suggestedFix: `Remove staging noindex header/tag before pushing production live.`,
      });
    }

    // Check Post-Migration Orphaning
    if (dest.internalLinkCount === 0 && dest.isIndexable) {
      issues.push({
        issueType: "POST_MIGRATION_ORPHAN_CANDIDATE",
        url: dest.url,
        blockerState: "REVIEW_BEFORE_LAUNCH",
        details: `Destination URL [${dest.url}] is indexable but has 0 incoming internal links in the new site structure.`,
        suggestedFix: `Add internal links from relevant category, navigation, or parent pages.`,
      });
    }
  }

  // 2. X-Robots-Tag Noindex & Robots.txt Disallow on Production
  if (params.isProductionEnvironment) {
    if (params.xRobotsNoindexUrls) {
      for (const xUrl of params.xRobotsNoindexUrls) {
        issues.push({
          issueType: "PRODUCTION_X_ROBOTS_NOINDEX",
          url: xUrl,
          blockerState: "LAUNCH_BLOCKER",
          details: `Production HTTP response header for [${xUrl}] contains 'X-Robots-Tag: noindex'.`,
          suggestedFix: "Remove X-Robots-Tag noindex header in server configuration.",
        });
      }
    }

    if (params.robotsTxtDisallows) {
      for (const dis of params.robotsTxtDisallows) {
        if (dis === "/" || dis === "/*") {
          issues.push({
            issueType: "PRODUCTION_ROBOTS_TXT_DISALLOW",
            url: "https://" + (params.legacyDomain || "domain.com") + "/robots.txt",
            blockerState: "LAUNCH_BLOCKER",
            details: `Production robots.txt contains site-wide 'Disallow: /' block. Search engine crawlers cannot index the new site.`,
            suggestedFix: "Update robots.txt to allow crawling of production routes.",
          });
        }
      }
    }
  }

  // 3. Sitemap Migration & Staging Leaks
  if (params.sitemapUrls) {
    for (const smUrl of params.sitemapUrls) {
      const smLower = smUrl.toLowerCase();
      if (smLower.includes("staging.") || smLower.includes("dev.")) {
        stagingLeaksCount++;
        issues.push({
          issueType: "STAGING_SITEMAP_LEAK",
          url: smUrl,
          blockerState: params.isProductionEnvironment ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
          details: `XML sitemap contains staging/dev URL [${smUrl}].`,
          suggestedFix: "Remove staging URLs and regenerate XML sitemap with production URLs.",
        });
      } else if (smLower.includes(legacyDomain)) {
        issues.push({
          issueType: "MIGRATION_STALE_SITEMAP_URL",
          url: smUrl,
          blockerState: "REVIEW_BEFORE_LAUNCH",
          details: `Production XML sitemap contains old legacy domain URL [${smUrl}].`,
          suggestedFix: `Regenerate XML sitemap containing only live, indexable destination URLs.`,
        });
      }
    }
  }

  // 4. Hreflang Staging Leaks
  if (params.hreflangUrls) {
    for (const hLink of params.hreflangUrls) {
      if (hLink.targetUrl.includes("staging.") || hLink.targetUrl.includes("dev.")) {
        stagingLeaksCount++;
        issues.push({
          issueType: "STAGING_HREFLANG_LEAK",
          url: hLink.sourceUrl,
          blockerState: params.isProductionEnvironment ? "LAUNCH_BLOCKER" : "HIGH_RISK_PRE_LAUNCH",
          details: `Hreflang alternate tag on [${hLink.sourceUrl}] points to staging URL [${hLink.targetUrl}].`,
          suggestedFix: `Update hreflang target to production localized URL.`,
        });
      }
    }
  }

  // 5. Internal Links Staging / Legacy Leaks
  if (params.internalLinks) {
    for (const link of params.internalLinks) {
      const tLower = link.targetUrl.toLowerCase();
      if (tLower.includes("staging.") || tLower.includes("dev.")) {
        stagingLeaksCount++;
        issues.push({
          issueType: "STAGING_INTERNAL_LINK_LEAK",
          url: link.sourceUrl,
          blockerState: "REVIEW_BEFORE_LAUNCH",
          details: `Internal link on [${link.sourceUrl}] points to staging URL [${link.targetUrl}].`,
          suggestedFix: `Update internal link to production destination URL.`,
        });
      } else if (tLower.includes(legacyDomain)) {
        legacyInternalLinksCount++;
        issues.push({
          issueType: "MIGRATION_INTERNAL_LINK_TO_LEGACY_URL",
          url: link.sourceUrl,
          blockerState: "REVIEW_BEFORE_LAUNCH",
          details: `Internal link on [${link.sourceUrl}] still points to legacy domain [${link.targetUrl}].`,
          suggestedFix: `Update internal link to point directly to the new production URL.`,
        });
      }
    }
  }

  // 6. Content Parity Counts
  for (const m of params.mappings) {
    if (m.contentParity === "CONTENT_PARITY_STRONG") strongCount++;
    else if (m.contentParity === "CONTENT_PARITY_PARTIAL") partialCount++;
    else if (m.contentParity === "CONTENT_PARITY_WEAK") weakCount++;
  }

  return {
    parityIssues: issues,
    strongParityCount: strongCount,
    partialParityCount: partialCount,
    weakParityCount: weakCount,
    schemaLossCount,
    stagingLeaksCount,
    staleCanonicalCount,
    legacyInternalLinksCount,
  };
}
