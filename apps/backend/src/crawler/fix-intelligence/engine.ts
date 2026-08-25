/**
 * Core Fix Intelligence Engine.
 * Converts raw diagnostic issues into actionable, evidence-aware, platform-tailored remediation blueprints.
 */

import type { DiagnosticIssue, CrawledPageData } from "../types";
import { IMPLEMENTED_DIAGNOSTIC_RULES, getImplementedRulesCount } from "../verification/rule-inventory";
import type {
  SeoFixIntelligence,
  FixGroup,
  RootCauseGroup,
  AuditFixIntelligenceResult,
  SupportedPlatform,
} from "./types";
import { detectPlatformFromPages } from "./platform-adapters";
import { findFixStrategyForRule, ALL_FIX_STRATEGIES } from "./strategies";
import type { FixContext } from "./strategies/base";

/**
 * Generates Fix Intelligence for a single Diagnostic Issue.
 */
export function generateFixIntelligenceForIssue(
  issue: DiagnosticIssue,
  context: FixContext
): SeoFixIntelligence {
  const strategy = findFixStrategyForRule(issue.code);
  if (!strategy) {
    throw new Error(`Missing fix intelligence strategy for diagnostic rule: ${issue.code}`);
  }
  return strategy.buildFixIntelligence(issue, context);
}

/**
 * Detects systemic / template-level / global component fix groups across all issues.
 */
export function detectSystemicFixGroups(
  issues: DiagnosticIssue[],
  pages: CrawledPageData[],
  detectedPlatform: SupportedPlatform
): FixGroup[] {
  const groups: FixGroup[] = [];

  for (const issue of issues) {
    const affectedUrls = Array.from(new Set(issue.affectedPages.map((p) => p.url)));
    if (affectedUrls.length === 0) continue;

    // Check if issue is systemic template or global component
    const isGlobalNavOrFooter = issue.componentGuess === "navbar" || issue.componentGuess === "footer";
    const isSystemicTemplate = issue.isSystemicTemplateIssue || affectedUrls.length >= 3;
    const isCmsCollection = affectedUrls.some((u) => u.includes("/jobopenings-copy/") || u.includes("/news/") || u.includes("/blog/"));

    let scope: FixGroup["scope"] = "page_specific";
    let likelySharedCause = "Page-specific editorial content or metadata";
    let recommendedFixLocation = "Page Settings / Editor";
    let confidence = 0.6;
    let estimatedFixesRequired = affectedUrls.length;

    if (isGlobalNavOrFooter) {
      scope = "global_component";
      likelySharedCause = `Global ${issue.componentGuess === "navbar" ? "Navbar Header" : "Footer"} Component`;
      recommendedFixLocation = `${detectedPlatform === "webflow" ? "Webflow Symbol / Component" : "Global Layout Component"} (${issue.componentGuess})`;
      confidence = 0.95;
      estimatedFixesRequired = 1;
    } else if (isCmsCollection && affectedUrls.length >= 2) {
      scope = "template";
      likelySharedCause = `${detectedPlatform === "webflow" ? "Webflow CMS Collection Template" : "CMS Dynamic Template"} (${issue.componentGuess || "Collection Page"})`;
      recommendedFixLocation = "CMS Collection Template Settings & Canvas";
      confidence = 0.92;
      estimatedFixesRequired = 1;
    } else if (isSystemicTemplate) {
      scope = "template";
      likelySharedCause = "Shared Page Layout / Section Template";
      recommendedFixLocation = "Shared Layout Template / Custom Code Embed";
      confidence = 0.85;
      estimatedFixesRequired = 1;
    }

    if (scope !== "page_specific") {
      const fixContext: FixContext = {
        platform: detectedPlatform,
        allPages: pages,
        isCmsPage: isCmsCollection,
        templateName: issue.componentGuess || (isCmsCollection ? "CMS Collection Template" : "Shared Template"),
      };

      const primaryFixIntelligence = generateFixIntelligenceForIssue(issue, fixContext);
      primaryFixIntelligence.fixScope.type = scope;
      primaryFixIntelligence.fixScope.targetComponentOrTemplate = likelySharedCause;

      const leverageScore = Math.round(
        ((issue.impactScore || 5) * affectedUrls.length * confidence) /
          (primaryFixIntelligence.effort === "quick" ? 1 : 2) *
          10
      ) / 10;

      const locationCertainty = isGlobalNavOrFooter
        ? "CONFIRMED_FIX_LOCATION"
        : isCmsCollection || isSystemicTemplate
        ? "LIKELY_FIX_LOCATION"
        : "GENERIC_GUIDANCE";

      groups.push({
        groupId: `group_${issue.code}_${issue.templateFingerprint || "shared"}`,
        ruleCode: issue.code,
        title: issue.title,
        scope,
        affectedUrls,
        affectedCount: affectedUrls.length,
        confidence,
        locationCertainty,
        likelySharedCause,
        recommendedFixLocation,
        estimatedFixesRequired,
        leverageScore,
        primaryFixIntelligence,
      });
    }
  }

  // Sort groups by remediation leverage (highest leverage first)
  groups.sort((a, b) => b.leverageScore - a.leverageScore);
  return groups;
}

/**
 * Consolidates root causes across related diagnostic findings.
 */
export function consolidateRootCauses(issues: DiagnosticIssue[]): RootCauseGroup[] {
  const rootCauses: RootCauseGroup[] = [];

  // Root Cause 1: 3xx Redirect Architecture
  const redirectIssues = issues.filter(
    (i) =>
      i.code === "REDIRECT_CHAIN" ||
      i.code === "REDIRECT_LOOP" ||
      i.code === "CANONICAL_POINTS_TO_REDIRECT" ||
      i.code === "SITEMAP_URL_REDIRECT" ||
      i.code === "LINKS_INTERNAL_TO_REDIRECT"
  );
  if (redirectIssues.length >= 2) {
    const urls = Array.from(new Set(redirectIssues.flatMap((i) => i.affectedPages.map((p) => p.url))));
    rootCauses.push({
      rootCauseId: "root_cause_redirect_routing",
      rootCauseTitle: "Intermediate 3xx Redirect Routing Architecture",
      description:
        "Multiple diagnostics (redirect chains, canonicals pointing to redirects, internal links to redirects, and sitemaps with redirects) stem from intermediate redirect hops.",
      primaryRuleCode: "REDIRECT_CHAIN",
      relatedRuleCodes: redirectIssues.map((i) => i.code),
      affectedUrls: urls,
      recommendedAction:
        "Consolidate redirect table to ensure all internal links, sitemaps, and canonical tags point directly to final 200 OK URLs in 1 hop.",
      potentialFindingsResolved: redirectIssues.reduce((sum, i) => sum + i.affectedPages.length, 0),
    });
  }

  // Root Cause 2: Broken Links & 404 Targets
  const brokenLinkIssues = issues.filter(
    (i) =>
      i.code === "LINKS_BROKEN_INTERNAL" ||
      i.code === "CANONICAL_POINTS_TO_4XX" ||
      i.code === "SITEMAP_URL_4XX"
  );
  if (brokenLinkIssues.length >= 2) {
    const urls = Array.from(new Set(brokenLinkIssues.flatMap((i) => i.affectedPages.map((p) => p.url))));
    rootCauses.push({
      rootCauseId: "root_cause_broken_endpoints",
      rootCauseTitle: "Dead / Deleted URL Endpoints (4xx Errors)",
      description: "Broken internal links, broken canonical targets, and sitemap 404 entries share deleted URL references.",
      primaryRuleCode: "LINKS_BROKEN_INTERNAL",
      relatedRuleCodes: brokenLinkIssues.map((i) => i.code),
      affectedUrls: urls,
      recommendedAction:
        "Update or remove dead URL references across internal navigation, XML sitemaps, and canonical link elements.",
      potentialFindingsResolved: brokenLinkIssues.reduce((sum, i) => sum + i.affectedPages.length, 0),
    });
  }

  return rootCauses;
}

/**
 * Prioritizes the fix queue enforcing strict SEO-Impact Precedence.
 * Priority tiers: Critical > High > Medium > Low > Informational.
 * High affected page count alone CANNOT elevate a low-impact issue above a higher-tier SEO issue.
 */
export function prioritizeFixQueue(fixList: SeoFixIntelligence[]): SeoFixIntelligence[] {
  const getTierWeight = (priority: SeoFixIntelligence["priority"], subCategory: SeoFixIntelligence["subCategory"]): number => {
    // Critical indexability or core SEO defects always top the list
    if (priority === "critical") return 100000;
    if (priority === "high") return 50000;
    if (priority === "medium") return 20000;
    if (priority === "low") return 5000;
    // Informational & Security-lite hygiene remain at baseline
    return 1000;
  };

  const computeScore = (f: SeoFixIntelligence): number => {
    const tier = getTierWeight(f.priority, f.subCategory);

    // Intra-tier leverage calculation (max 4000 points to never cross tier boundaries)
    let intraTier = 0;
    if (f.classification === "SYSTEMIC_FIX") intraTier += 1500;
    if (f.classification === "QUICK_WIN") intraTier += 800;
    if (f.safety === "SAFE") intraTier += 400;
    if (f.effort === "quick") intraTier += 600;
    else if (f.effort === "small") intraTier += 300;

    // Logarithmic scale for affected pages so high page counts provide healthy signal without overflowing tiers
    intraTier += Math.min(700, Math.round(Math.log2(f.affectedCount + 1) * 100));

    return tier + intraTier;
  };

  const sorted = [...fixList].sort((a, b) => computeScore(b) - computeScore(a));

  // Attach human-readable ranking rationale
  sorted.forEach((f, idx) => {
    f.rankingRationale = `P${idx + 1}: [${f.priority.toUpperCase()} SEO Priority] ${
      f.classification === "SYSTEMIC_FIX"
        ? `High-leverage systemic template fix resolving ${f.affectedCount} pages with 1 change`
        : f.classification === "QUICK_WIN"
        ? `Quick-win remediation (< 15 mins) on ${f.affectedCount} pages`
        : `Targeted ${f.subCategory.toLowerCase().replace("_", " ")} remediation`
    } (${f.effort} effort, ${f.safety.toLowerCase().replace("_", " ")})`;
  });

  return sorted;
}

/**
 * Generates comprehensive Audit Fix Intelligence across an entire audit result.
 */
export function generateFixIntelligenceForAudit(
  issues: DiagnosticIssue[],
  crawledPages: CrawledPageData[],
  targetSite = "https://www.botconsulting.io/",
  runId = `audit-fix-${Date.now()}`
): AuditFixIntelligenceResult {
  const platformRes = detectPlatformFromPages(crawledPages);
  const detectedPlatform = platformRes.platform;

  const fixIntelligenceList: SeoFixIntelligence[] = [];

  for (const issue of issues) {
    const isCms = issue.affectedPages.some((p) => p.url.includes("/jobopenings-copy/") || p.url.includes("/news/"));
    const fixContext: FixContext = {
      platform: detectedPlatform,
      allPages: crawledPages,
      targetSite,
      isCmsPage: isCms,
      templateName: issue.componentGuess,
    };

    const fixIntel = generateFixIntelligenceForIssue(issue, fixContext);
    fixIntelligenceList.push(fixIntel);
  }

  const systemicFixGroups = detectSystemicFixGroups(issues, crawledPages, detectedPlatform);
  const rootCauseGroups = consolidateRootCauses(issues);
  const prioritizedFixQueue = prioritizeFixQueue(fixIntelligenceList);

  const uniquePages = new Set(issues.flatMap((i) => i.affectedPages.map((p) => p.url)));

  const quickWinsCount = fixIntelligenceList.filter((f) => f.classification === "QUICK_WIN").length;
  const systemicFixesCount = systemicFixGroups.length;
  const globalComponentFixesCount = systemicFixGroups.filter((g) => g.scope === "global_component").length;
  const cmsContentFixesCount = fixIntelligenceList.filter((f) => f.fixScope.type === "cms_content").length;
  const pageSpecificFixesCount = fixIntelligenceList.filter((f) => f.classification === "PAGE_SPECIFIC").length;
  const manualReviewsCount = fixIntelligenceList.filter((f) => f.safety === "HIGH_RISK" || f.confidence === "manual_review").length;
  const highRiskFixesCount = fixIntelligenceList.filter((f) => f.safety === "HIGH_RISK").length;

  // Strict occurrence math & deduplication
  const totalIssueOccurrences = issues.reduce((sum, i) => sum + i.affectedPages.length, 0);

  const groupedOccurrencesSet = new Set<string>();
  for (const g of systemicFixGroups) {
    for (const u of g.affectedUrls) {
      groupedOccurrencesSet.add(`${g.ruleCode}::${u}`);
    }
  }
  const totalGroupedOccurrences = groupedOccurrencesSet.size;
  const totalUngroupedOccurrences = Math.max(0, totalIssueOccurrences - totalGroupedOccurrences);

  const estimatedIndividualChangesRequired =
    systemicFixGroups.reduce((sum, g) => sum + g.estimatedFixesRequired, 0) +
    fixIntelligenceList.filter((f) => f.classification === "PAGE_SPECIFIC").reduce((sum, f) => sum + f.affectedCount, 0);

  // Deduplicated unique occurrence resolution
  const allUniqueOccurrences = new Set<string>();
  for (const issue of issues) {
    for (const p of issue.affectedPages) {
      allUniqueOccurrences.add(`${issue.code}::${p.url}`);
    }
  }
  const potentialFindingsResolved = allUniqueOccurrences.size;

  return {
    runId,
    generatedAt: new Date().toISOString(),
    targetSite,
    detectedPlatform,
    platformConfidence: platformRes.confidence,
    totalFindings: issues.length,
    totalUniquePagesAffected: uniquePages.size,
    fixIntelligenceList,
    systemicFixGroups,
    rootCauseGroups,
    summary: {
      quickWinsCount,
      systemicFixesCount,
      globalComponentFixesCount,
      cmsContentFixesCount,
      pageSpecificFixesCount,
      manualReviewsCount,
      highRiskFixesCount,
      totalIssueOccurrences,
      totalGroupedOccurrences,
      totalUngroupedOccurrences,
      estimatedIndividualChangesRequired,
      potentialFindingsResolved,
    },
    prioritizedFixQueue,
  };
}

/**
 * Validates that every registered diagnostic rule in `rule-inventory.ts` has active fix intelligence.
 */
export function validateAllRulesHaveFixIntelligence(): {
  totalImplemented: number;
  coveredCount: number;
  missingCount: number;
  missingRules: string[];
  coveragePercent: number;
} {
  const implemented = IMPLEMENTED_DIAGNOSTIC_RULES;
  const missingRules: string[] = [];

  for (const r of implemented) {
    const strategy = findFixStrategyForRule(r.ruleCode);
    if (!strategy) {
      missingRules.push(r.ruleCode);
    }
  }

  const coveredCount = implemented.length - missingRules.length;
  const coveragePercent = implemented.length > 0 ? (coveredCount / implemented.length) * 100 : 100;

  return {
    totalImplemented: implemented.length,
    coveredCount,
    missingCount: missingRules.length,
    missingRules,
    coveragePercent,
  };
}
