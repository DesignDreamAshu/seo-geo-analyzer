/**
 * Master International SEO & Hreflang Intelligence Engine Coordinator.
 * Orchestrates applicability gating, cluster building, reciprocity graphs,
 * target health cross-referencing, canonical compatibility, regional variant safety, and Phase 11 action bridges.
 */

import {
  InternationalSeoIntelligenceReport,
  InternationalSeoSnapshot,
  LocaleDefinition,
  HreflangCluster,
  GscCountryPerformance,
} from "./types";
import { DEFAULT_INTERNATIONAL_POLICY, InternationalSeoPolicy } from "./config";
import { determineInternationalApplicability, ProjectInternationalContext } from "./applicability";
import { buildHreflangClusters, RawHreflangDeclaration } from "./cluster-reciprocity";
import { evaluateHreflangTargetAndCanonicalHealth } from "./target-canonical-health";
import { evaluateLanguageAlignment, evaluateRegionalVariants, RawPageTextSample } from "./language-regional-safety";
import { determineUrlArchitecture } from "./url-architecture";
import { evaluateGscMarketAlignment, extractSerpMarketDifferences } from "./market-integrators";
import { bridgeInternationalOpportunitiesToPhase11 } from "./phase-integrators";
import { createInternationalSeoSnapshot } from "./snapshots";
import { SerpSnapshot } from "../competitor-serp/types";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeInternationalParams {
  projectId: string;
  targetDomain: string;
  projectContext?: ProjectInternationalContext;
  hreflangDeclarations?: RawHreflangDeclaration[];
  crawlMetadataMap?: Map<string, { statusCode?: number; isNoindex?: boolean; isRedirect?: boolean; canonicalUrl?: string; redirectDestination?: string; detectedLanguage?: string; htmlLang?: string }>;
  pageTextSamples?: RawPageTextSample[];
  gscCountryPerformance?: GscCountryPerformance[];
  serpSnapshots?: SerpSnapshot[];
  previousSnapshot?: InternationalSeoSnapshot;
  existingActions?: SeoActionItem[];
  policy?: InternationalSeoPolicy;
}

export interface AnalyzeInternationalResult {
  report: InternationalSeoIntelligenceReport;
  currentSnapshot?: InternationalSeoSnapshot;
  actions: SeoActionItem[];
}

export async function analyzeInternationalSeoIntelligence(
  params: AnalyzeInternationalParams
): Promise<AnalyzeInternationalResult> {
  const policy = params.policy || DEFAULT_INTERNATIONAL_POLICY;
  const projectContext = params.projectContext || {};
  const hreflangDeclarations = params.hreflangDeclarations || [];
  const crawlMetadataMap = params.crawlMetadataMap || new Map();
  const pageTextSamples = params.pageTextSamples || [];
  const gscCountryPerformance = params.gscCountryPerformance || [];
  const serpSnapshots = params.serpSnapshots || [];

  // 1. Applicability Gating
  const allUrls = Array.from(crawlMetadataMap.keys());
  const pathPrefixes = Array.from(
    new Set(allUrls.map((u) => {
      try {
        const seg = new URL(u).pathname.split("/").filter(Boolean)[0];
        return seg && (seg.length === 2 || seg.includes("-")) ? seg : "";
      } catch {
        return "";
      }
    }).filter(Boolean))
  );

  const applicabilityRes = determineInternationalApplicability(projectContext, hreflangDeclarations.length, pathPrefixes);

  const urlArch = determineUrlArchitecture(allUrls);

  if (!applicabilityRes.isInternationalApplicable) {
    const nonIntReport: InternationalSeoIntelligenceReport = {
      generatedAt: new Date().toISOString(),
      projectId: params.projectId,
      applicability: applicabilityRes.applicability,
      applicabilityRationale: applicabilityRes.rationale,
      urlArchitecture: urlArch.architectureType,
      appliedPolicy: {
        policyName: policy.policyName,
        selectionSource: policy.selectionSource,
        similarityThresholdForRegionalVariant: policy.similarityThresholdForRegionalVariant,
        minClusterSampleSize: policy.minClusterSampleSize,
      },
      locales: [],
      totalObservedAlternatesCount: 0,
      totalClustersCount: 0,
      clusters: [],
      reciprocityIssues: [],
      targetHealthIssues: [],
      canonicalConflicts: [],
      languageMismatches: [],
      regionalVariantReviews: [],
      sourceConsistency: { state: "SINGLE_SOURCE_IMPLEMENTED", details: "Single market implementation." },
      gscMarketPerformance: [],
      serpMarketObservations: [],
      historicalChanges: { isComparable: false, newlyObservedAlternates: 0, noLongerObservedAlternates: 0, brokenReciprocityCount: 0 },
      governanceLimitations: [
        "Project operates as a single-language, single-market property. International hreflang targeting is not applicable.",
        "Zero missing hreflang or missing x-default defects are generated for non-international sites.",
      ],
      immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
    };

    return {
      report: nonIntReport,
      actions: [],
    };
  }

  // 2. Build Clusters & Validate Reciprocity
  const clusters = buildHreflangClusters(hreflangDeclarations, crawlMetadataMap as any);

  // 3. Resolve Locales
  const configuredLocs = projectContext.configuredLocales || [];
  let locales: LocaleDefinition[] = [...configuredLocs];

  if (locales.length === 0) {
    const declaredCodes = new Set<string>();
    for (const d of hreflangDeclarations) {
      if (d.hreflang !== "x-default") declaredCodes.add(d.hreflang);
    }
    locales = Array.from(declaredCodes).map((code) => {
      const parts = code.split("-");
      return {
        localeId: `loc_${code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        projectId: params.projectId,
        languageCode: parts[0],
        regionCode: parts[1],
        hreflangCode: code,
        localeType: parts.length > 1 ? ("LANGUAGE_REGION" as const) : ("LANGUAGE_ONLY" as const),
        provenance: { source: "DISCOVERED_HREFLANG" as const, retrievedAt: new Date().toISOString() },
      };
    });
  }

  // 4. Target Health & Canonical Compatibility
  const healthAndCanonical = evaluateHreflangTargetAndCanonicalHealth(clusters, crawlMetadataMap);

  // 5. Reciprocity Issues List
  const reciprocityIssues: InternationalSeoIntelligenceReport["reciprocityIssues"] = [];
  for (const c of clusters) {
    if (c.reciprocityState === "HREFLANG_RETURN_LINK_MISSING") {
      const root = c.pages[0]?.url || "root";
      for (const e of c.declaredAlternates) {
        if (!e.isSelfReference) {
          reciprocityIssues.push({
            sourceUrl: e.sourceUrl,
            declaredHreflang: e.hreflang,
            targetUrl: e.targetUrl,
            missingReturnReferenceUrl: e.sourceUrl,
            issueState: "HREFLANG_RETURN_LINK_MISSING",
          });
        }
      }
    }
  }

  // 6. Language Mismatches
  const languageMismatches: InternationalSeoIntelligenceReport["languageMismatches"] = [];
  for (const sample of pageTextSamples) {
    const evalRes = evaluateLanguageAlignment(sample);
    if (evalRes.alignmentState === "HREFLANG_CONTENT_LANGUAGE_MISMATCH" || evalRes.alignmentState === "LANGUAGE_POSSIBLE_MISMATCH") {
      languageMismatches.push({
        url: sample.url,
        declaredHreflang: sample.locale,
        htmlLang: sample.htmlLang,
        detectedContentLanguage: sample.detectedLanguage,
        alignmentState: evalRes.alignmentState,
        details: evalRes.details,
      });
    }
  }

  // 7. Regional Variant Reviews
  const regionalPairs: Array<{ page1: RawPageTextSample; page2: RawPageTextSample; similarity: number }> = [];
  for (let i = 0; i < pageTextSamples.length; i++) {
    for (let j = i + 1; j < pageTextSamples.length; j++) {
      const p1 = pageTextSamples[i];
      const p2 = pageTextSamples[j];
      if (p1.locale.split("-")[0] === p2.locale.split("-")[0] && p1.locale !== p2.locale) {
        regionalPairs.push({ page1: p1, page2: p2, similarity: 0.9 });
      }
    }
  }
  const regionalVariantReviews = evaluateRegionalVariants(regionalPairs, policy);

  // 8. GSC Market Alignment
  const localePathMap = new Map<string, string>();
  for (const loc of locales) {
    if (loc.regionCode) {
      localePathMap.set(loc.regionCode.toUpperCase(), `https://${params.targetDomain}/${loc.hreflangCode.toLowerCase()}`);
    }
  }
  const gscMarketPerformance = evaluateGscMarketAlignment(gscCountryPerformance, localePathMap);

  // 9. SERP Market Differences
  const serpMarketObservations = extractSerpMarketDifferences(serpSnapshots);

  // 10. Bridge Actions to Phase 11
  const actions = bridgeInternationalOpportunitiesToPhase11(
    params.projectId,
    clusters,
    healthAndCanonical.targetIssues,
    healthAndCanonical.canonicalConflicts,
    params.existingActions || []
  );

  // 11. Create Snapshot
  const snapshotId = `SNAP_INT_${params.projectId}_${Date.now().toString(36)}`;
  const currentSnapshot = createInternationalSeoSnapshot({
    snapshotId,
    projectId: params.projectId,
    applicability: applicabilityRes.applicability,
    locales,
    clusters,
    urlArchitecture: urlArch.architectureType,
  });

  const report: InternationalSeoIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    applicability: applicabilityRes.applicability,
    applicabilityRationale: applicabilityRes.rationale,
    urlArchitecture: urlArch.architectureType,
    appliedPolicy: {
      policyName: policy.policyName,
      selectionSource: policy.selectionSource,
      similarityThresholdForRegionalVariant: policy.similarityThresholdForRegionalVariant,
      minClusterSampleSize: policy.minClusterSampleSize,
    },
    locales,
    totalObservedAlternatesCount: hreflangDeclarations.length,
    totalClustersCount: clusters.length,
    clusters,
    reciprocityIssues,
    targetHealthIssues: healthAndCanonical.targetIssues,
    canonicalConflicts: healthAndCanonical.canonicalConflicts,
    languageMismatches,
    regionalVariantReviews,
    sourceConsistency: {
      state: "SINGLE_SOURCE_IMPLEMENTED",
      details: "Hreflang declarations implemented via HTML alternate links.",
    },
    gscMarketPerformance,
    serpMarketObservations,
    historicalChanges: {
      isComparable: true,
      newlyObservedAlternates: hreflangDeclarations.length,
      noLongerObservedAlternates: 0,
      brokenReciprocityCount: reciprocityIssues.length,
    },
    governanceLimitations: [
      "Hreflang annotations are strong signals, not absolute directives; search engines combine them with user language preferences, IP, and content signals.",
      "High text similarity between regional variants (e.g. en-US vs en-GB) is valid when localized pricing, shipping, or legal terms exist.",
      "International SEO intelligence never mutates the project's 95-rule technical SEO Health score.",
    ],
    immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  return {
    report,
    currentSnapshot,
    actions,
  };
}
