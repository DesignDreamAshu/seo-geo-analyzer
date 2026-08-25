/**
 * Alternate Cluster & Reciprocal Graph Engine.
 * Analyzes multi-page hreflang clusters, verifies bidirectional return links,
 * detects duplicate locale declarations, and validates x-default configurations.
 */

import { HreflangCluster, HreflangEdge, LocalePageReference, ReciprocityState, XDefaultState } from "./types";
import { validateHreflangCode } from "./code-validator";

export interface RawHreflangDeclaration {
  sourceUrl: string;
  targetUrl: string;
  hreflang: string;
  sourceType: "HTML" | "SITEMAP" | "HTTP_HEADER";
}

export function buildHreflangClusters(
  declarations: RawHreflangDeclaration[],
  pageMetadataMap: Map<string, { statusCode?: number; isIndexable: boolean; canonicalUrl?: string; detectedLanguage?: string; htmlLang?: string }>
): HreflangCluster[] {
  // 1. Group declarations by cluster root
  // We normalize declarations into edges
  const edges: HreflangEdge[] = declarations.map((d) => {
    const val = validateHreflangCode(d.hreflang);
    return {
      sourceUrl: d.sourceUrl,
      targetUrl: d.targetUrl,
      hreflang: d.hreflang,
      sourceType: d.sourceType,
      isSelfReference: d.sourceUrl === d.targetUrl,
      isValidCode: val.isValid,
      codeValidationIssue: val.issueDescription,
    };
  });

  // Group pages by sourceUrl
  const declarationsBySource = new Map<string, HreflangEdge[]>();
  for (const edge of edges) {
    const list = declarationsBySource.get(edge.sourceUrl) || [];
    list.push(edge);
    declarationsBySource.set(edge.sourceUrl, list);
  }

  const clusters: HreflangCluster[] = [];
  const processedSources = new Set<string>();

  for (const [sourceUrl, sourceEdges] of declarationsBySource.entries()) {
    if (processedSources.has(sourceUrl)) continue;

    // Collect all URLs participating in this alternate set
    const clusterUrlSet = new Set<string>([sourceUrl]);
    for (const e of sourceEdges) {
      clusterUrlSet.add(e.targetUrl);
    }

    const clusterPages: LocalePageReference[] = [];
    const clusterEdges: HreflangEdge[] = [];
    const duplicateLocaleDetails: string[] = [];

    // Track x-default targets in this cluster
    const xDefaultUrls = new Set<string>();

    for (const url of clusterUrlSet) {
      processedSources.add(url);
      const meta = pageMetadataMap.get(url) || { isIndexable: true, statusCode: 200 };

      // Find declared locale for this URL
      const matchingEdge = sourceEdges.find((e) => e.targetUrl === url);
      const localeCode = matchingEdge?.hreflang || "unknown";

      clusterPages.push({
        url,
        localeCode,
        statusCode: meta.statusCode,
        isIndexable: meta.isIndexable,
        canonicalUrl: meta.canonicalUrl,
        detectedContentLanguage: meta.detectedLanguage,
        htmlLangAttribute: meta.htmlLang,
      });

      const pageEdges = declarationsBySource.get(url) || [];
      clusterEdges.push(...pageEdges);

      // Check for duplicate locale targets on this page
      const localeCountMap = new Map<string, string[]>();
      for (const pe of pageEdges) {
        if (pe.hreflang === "x-default") {
          xDefaultUrls.add(pe.targetUrl);
        }
        const currentList = localeCountMap.get(pe.hreflang) || [];
        currentList.push(pe.targetUrl);
        localeCountMap.set(pe.hreflang, currentList);
      }

      for (const [loc, targets] of localeCountMap.entries()) {
        if (targets.length > 1) {
          duplicateLocaleDetails.push(`Page [${url}] declares multiple targets for locale '${loc}': ${targets.join(", ")}`);
        }
      }
    }

    // 2. Evaluate Reciprocity across Cluster
    let reciprocityState: ReciprocityState = "HREFLANG_RECIPROCAL";
    for (const edge of sourceEdges) {
      if (edge.isSelfReference) continue;
      const targetEdges = declarationsBySource.get(edge.targetUrl);
      if (!targetEdges) {
        reciprocityState = "HREFLANG_RETURN_LINK_MISSING";
        break;
      }
      const hasReturn = targetEdges.some((te) => te.targetUrl === sourceUrl);
      if (!hasReturn) {
        reciprocityState = "HREFLANG_RETURN_LINK_MISSING";
        break;
      }
    }

    // 3. Evaluate x-default
    let xDefaultState: XDefaultState = "X_DEFAULT_MISSING_ADVISORY";
    let xDefaultUrl: string | undefined;
    if (xDefaultUrls.size === 1) {
      xDefaultUrl = Array.from(xDefaultUrls)[0];
      const targetMeta = pageMetadataMap.get(xDefaultUrl);
      if (targetMeta && (targetMeta.statusCode === 404 || targetMeta.statusCode === 410 || targetMeta.isIndexable === false)) {
        xDefaultState = "X_DEFAULT_TARGET_INVALID";
      } else {
        xDefaultState = "X_DEFAULT_VALID";
      }
    } else if (xDefaultUrls.size > 1) {
      xDefaultState = "X_DEFAULT_MULTIPLE_CONFLICT";
    }

    const clusterId = `cluster_${Math.abs(sourceUrl.length + clusterPages.length)}_${clusterPages[0]?.localeCode || "root"}`;

    clusters.push({
      clusterId,
      pages: clusterPages,
      declaredAlternates: clusterEdges,
      xDefaultUrl,
      xDefaultState,
      reciprocityState,
      hasDuplicateLocaleTargets: duplicateLocaleDetails.length > 0,
      duplicateLocaleDetails: duplicateLocaleDetails.length > 0 ? duplicateLocaleDetails : undefined,
      completenessState: reciprocityState === "HREFLANG_RECIPROCAL" ? "COMPLETE_CLUSTER" : "INCOMPLETE_CLUSTER",
      canonicalCompatibility: "HREFLANG_CANONICAL_ALIGNED",
      provenance: {
        sources: Array.from(new Set(clusterEdges.map((e) => e.sourceType))),
        evaluatedAt: new Date().toISOString(),
      },
    });
  }

  return clusters;
}
