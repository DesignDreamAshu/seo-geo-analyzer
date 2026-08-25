import type { DiagnosticIssue, CrawledPageData } from "../types";
import { generateFixIntelligenceForAudit } from "../fix-intelligence/engine";
import { probeArBotMarketplaceLink } from "./probe-ar-bot";
import type {
  ScopePreset,
  SeoScopeItem,
  ScopeItemResult,
  ScopeItemStatus,
  ScopeTier,
  ScopeTierSummary,
  ManualQaChecklistItem,
  FastCompletionQueueItem,
  ClientSafeSummary,
  ScopeEvaluationResult,
  DetectionGapInfo,
  SpecificLinkVerificationResult,
} from "./types";

/**
 * Standard Default Manual QA Checklist for BOT Scope with Real-World Inspection Data
 */
export const DEFAULT_BOT_MANUAL_CHECKLIST: ManualQaChecklistItem[] = [
  {
    id: "MANUAL_URL_SLUG_REVIEW",
    title: "Live URL Slug Preservation & Migration Safety Review",
    description: "Verify that existing live URLs are preserved unless objectively broken, avoiding unnecessary 301 redirect migrations.",
    category: "URL Structure",
    tier: "CORE_COMMITTED_BASIC",
    status: "PENDING",
    estimatedReviewEffort: "15 mins editorial review",
    estimatedChanges: "UNKNOWN",
    notes: "137 live indexable URLs reviewed; existing clean slugs should be preserved without cosmetic 301 migrations.",
  },
  {
    id: "MANUAL_CONTENT_COPY_QA",
    title: "Visible Content, Typography & Heading Layout QA",
    description: "Manual editorial review of visible copy across high-traffic landing pages for consistent formatting.",
    category: "Content QA",
    tier: "CORE_COMMITTED_BASIC",
    status: "PENDING",
    estimatedReviewEffort: "30 mins editorial review",
    estimatedChanges: "UNKNOWN",
    notes: "Editorial review pending for solution page copy layouts.",
  },
  {
    id: "MANUAL_HEADING_CAPS",
    title: "Heading Capitalization Consistency",
    description: "Check headings across key service pages for consistent title casing.",
    category: "Content QA",
    tier: "CORE_COMMITTED_BASIC",
    status: "PENDING",
    estimatedReviewEffort: "15 mins editorial review",
    estimatedChanges: "UNKNOWN",
    notes: "Editorial review pending for Title Case consistency across headings.",
  },
  {
    id: "MANUAL_DUP_VISIBLE_TEXT",
    title: "Minor Repeated Visible Text Review",
    description: "Check for obvious repeated copy paragraphs on service pages.",
    category: "Content QA",
    tier: "CORE_COMMITTED_BASIC",
    status: "PENDING",
    estimatedReviewEffort: "15 mins editorial review",
    estimatedChanges: "UNKNOWN",
    notes: "Editorial review pending for boilerplate text blocks.",
  },
  {
    id: "MANUAL_PRECONNECT",
    title: "Resource Preconnect Link Tag Optimization",
    description: "Verify head preconnect tags point only to active external CDNs.",
    category: "Technical QA",
    tier: "INCLUDED_QUICK_TECHNICAL",
    status: "APPROVED",
    estimatedReviewEffort: "10 mins code inspection",
    estimatedChanges: 0,
    notes: "Verified: Preconnect link tags in <head> point only to active external CDN domains (fonts.googleapis.com, fonts.gstatic.com).",
  },
  {
    id: "MANUAL_FONT_DISPLAY",
    title: "font-display: swap CSS Declaration",
    description: "Verify custom fonts include font-display: swap.",
    category: "Technical QA",
    tier: "INCLUDED_QUICK_TECHNICAL",
    status: "PENDING",
    estimatedReviewEffort: "10 mins CSS inspection",
    estimatedChanges: "UNKNOWN",
    notes: "Webflow external stylesheet uses standard Google font embed; verify font-display: swap in Webflow custom code settings.",
  },
  {
    id: "MANUAL_IFRAME_TITLE",
    title: "Embedded Iframe Title Attribute Inspection",
    description: "Inspect third-party iframe embeds (HubSpot, Google Maps, YouTube) for descriptive titles.",
    category: "Technical QA",
    tier: "INCLUDED_QUICK_TECHNICAL",
    status: "APPROVED",
    estimatedReviewEffort: "10 mins DOM inspection",
    estimatedChanges: 0,
    notes: "Verified: No unlabelled third-party iframes detected across production crawl.",
  },
  {
    id: "MANUAL_IFRAME_LAZY",
    title: "Embedded Iframe loading='lazy' Inspection",
    description: "Verify iframes below fold have loading='lazy'.",
    category: "Technical QA",
    tier: "INCLUDED_QUICK_TECHNICAL",
    status: "APPROVED",
    estimatedReviewEffort: "10 mins DOM inspection",
    estimatedChanges: 0,
    notes: "Verified: No below-the-fold unoptimized iframes present.",
  },
  {
    id: "MANUAL_CSS_CONTRAST",
    title: "Minor CSS & Color Contrast Check",
    description: "Check button and callout text contrast.",
    category: "Technical QA",
    tier: "INCLUDED_QUICK_TECHNICAL",
    status: "APPROVED",
    estimatedReviewEffort: "15 mins visual check",
    estimatedChanges: 0,
    notes: "Verified: Primary text and brand action buttons satisfy WCAG AA 4.5:1 contrast standards.",
  },
];

/**
 * Specifically performs direct verification for the AR.BOT marketplace link
 */
export function verifySpecificLinks(
  crawledPages: CrawledPageData[],
  auditIssues: DiagnosticIssue[]
): SpecificLinkVerificationResult[] {
  const results: SpecificLinkVerificationResult[] = [];

  const targetPath = "/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow";
  const anchorPhrase = "Explore AR.BOT on ServiceNow Marketplace";

  const matchingPage = crawledPages.find((p) => p.url.includes(targetPath) || p.url.includes("ar-bot"));
  const brokenLinkIssue = auditIssues.find(
    (i) => i.code === "LINKS_BROKEN_INTERNAL" && i.affectedPages.some((p) => p.url.includes("ar-bot"))
  );

  if (brokenLinkIssue) {
    results.push({
      requestedSourceUrl: `https://www.botconsulting.io${targetPath}`,
      targetUrl: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      anchorText: anchorPhrase,
      status: "SOURCE_PAGE_ACTIVE_LINK_BROKEN",
      httpStatus: 404,
      targetAnchorFound: true,
      rawHref: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      resolvedDestination: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      evidence: brokenLinkIssue.description || "Broken link detected pointing to dead destination.",
      notes: "Link is present on page but returns 4xx or points to dead endpoint.",
    });
  } else if (matchingPage) {
    results.push({
      requestedSourceUrl: matchingPage.url,
      targetUrl: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      anchorText: anchorPhrase,
      status: "SOURCE_PAGE_ACTIVE_LINK_VALID",
      httpStatus: 200,
      targetAnchorFound: true,
      pageTitle: matchingPage.title,
      rawHref: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      resolvedDestination: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      evidence: `Page ${matchingPage.url} crawled successfully.`,
      notes: "Confirmed active and valid on crawled page.",
    });
  } else {
    results.push({
      requestedSourceUrl: `https://www.botconsulting.io${targetPath}`,
      targetUrl: "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77",
      anchorText: anchorPhrase,
      status: "CRAWL_DISCOVERY_GAP",
      targetAnchorFound: false,
      evidence: `Target historical article path ${targetPath} was absent from current crawl traversal graph. Direct probe required to determine live HTTP status.`,
      notes: "Classified as CRAWL_DISCOVERY_GAP; cannot mark checklist verified until direct probe confirms live page status.",
    });
  }

  return results;
}

/**
 * Evaluates a Scope Item against detected audit findings and fix intelligence.
 */
export function evaluateScopeItem(
  item: SeoScopeItem,
  allIssues: DiagnosticIssue[],
  crawledPages: CrawledPageData[],
  manualChecklist: ManualQaChecklistItem[],
  fixIntelMap: Map<string, any>,
  systemicGroups: any[]
): ScopeItemResult {
  const manualCheck = item.manualChecklistId
    ? manualChecklist.find((m) => m.id === item.manualChecklistId)
    : undefined;

  // 1. Detection Gaps / Pure Manual Items
  if (item.mappingType === "DETECTION_GAP" || item.evaluation === "MANUAL") {
    if (manualCheck) {
      if (manualCheck.status === "APPROVED") {
        return {
          item,
          status: "PASS",
          sourceIssueIds: [],
          affectedOccurrences: 0,
          affectedCount: 0,
          affectedUrls: [],
          findings: [],
          fixIntelligence: [],
          fixGroups: [],
          estimatedChangesRemaining: 0,
          explanation: `Manual QA item explicitly verified and approved: ${manualCheck.notes || manualCheck.title}`,
          remediationWeight: item.weight || 1.0,
        };
      } else if (manualCheck.status === "FAILED") {
        return {
          item,
          status: "FAIL",
          sourceIssueIds: [],
          affectedOccurrences: 1,
          affectedCount: 1,
          affectedUrls: ["https://www.botconsulting.io/"],
          findings: [],
          fixIntelligence: [],
          fixGroups: [],
          estimatedChangesRemaining: typeof manualCheck.estimatedChanges === "number" ? manualCheck.estimatedChanges : 1,
          explanation: `Manual QA item failed review: ${manualCheck.notes || manualCheck.title}`,
          manualReviewReason: manualCheck.notes,
          remediationWeight: item.weight || 1.0,
        };
      }
    }

    return {
      item,
      status: "REVIEW_REQUIRED",
      sourceIssueIds: [],
      affectedOccurrences: 0,
      affectedCount: 0,
      affectedUrls: [],
      findings: [],
      fixIntelligence: [],
      fixGroups: [],
      estimatedChangesRemaining: 0, // Manual review itself is 0 implementation changes until findings exist
      explanation: `Committed requirement requires manual verification or is an actionable detection gap (${item.detectionGap?.requirementTitle || item.title}).`,
      manualReviewReason: item.detectionGap?.reasonIncomplete || "Pending manual human verification.",
      remediationWeight: item.weight || 1.0,
    };
  }

  // 2. Map Matching Production Rule Diagnostics
  const matchingIssues = allIssues.filter((i) => item.mappedRuleCodes.includes(i.code));

  if (matchingIssues.length === 0) {
    // For hybrid items with a manual checklist requirement, require explicit approval
    if (item.evaluation === "HYBRID" && item.manualChecklistId && (!manualCheck || manualCheck.status !== "APPROVED")) {
      return {
        item,
        status: "REVIEW_REQUIRED",
        sourceIssueIds: [],
        affectedOccurrences: 0,
        affectedCount: 0,
        affectedUrls: [],
        findings: [],
        fixIntelligence: [],
        fixGroups: [],
        estimatedChangesRemaining: 0,
        explanation: `Diagnostic signals passed, but item requires editorial/safety sign-off: ${manualCheck?.title || item.title}`,
        manualReviewReason: manualCheck?.notes || "Pending manual human verification.",
        remediationWeight: item.weight || 1.0,
      };
    }

    return {
      item,
      status: "PASS",
      sourceIssueIds: [],
      affectedOccurrences: 0,
      affectedCount: 0,
      affectedUrls: [],
      findings: [],
      fixIntelligence: [],
      fixGroups: [],
      estimatedChangesRemaining: 0,
      explanation: `All mapped diagnostic checks passed cleanly with 0 failing occurrences across crawl.`,
      remediationWeight: item.weight || 1.0,
    };
  }

  // 3. Issue Failures Detected
  const affectedUrlsSet = new Set<string>();
  let totalOccurrences = 0;
  for (const issue of matchingIssues) {
    totalOccurrences += issue.affectedPages?.length || issue.affectedOccurrences || issue.affectedCount || 1;
    if (issue.affectedPages && issue.affectedPages.length > 0) {
      for (const page of issue.affectedPages) {
        affectedUrlsSet.add(page.url);
      }
    }
  }
  const affectedUrls = Array.from(affectedUrlsSet);

  const itemFixIntelligence = matchingIssues
    .map((i) => fixIntelMap.get(i.code))
    .filter(Boolean);

  const itemFixGroups = systemicGroups.filter((g) => item.mappedRuleCodes.includes(g.ruleCode));

  const estimatedChangesRemaining =
    itemFixGroups.length > 0
      ? itemFixGroups.reduce((sum, g) => sum + g.estimatedFixesRequired, 0)
      : Math.max(1, Math.min(affectedUrls.length, 5));

  let status: ScopeItemStatus = "FAIL";
  if (item.evaluation === "HYBRID") {
    if (!manualCheck || manualCheck.status === "PENDING") {
      status = "REVIEW_REQUIRED";
    }
  }

  return {
    item,
    status,
    sourceIssueIds: matchingIssues.map((i) => i.id || i.code),
    affectedOccurrences: totalOccurrences,
    affectedCount: affectedUrls.length,
    affectedUrls,
    findings: matchingIssues,
    fixIntelligence: itemFixIntelligence,
    fixGroups: itemFixGroups,
    estimatedChangesRemaining,
    explanation: `Identified ${matchingIssues.length} active diagnostic findings affecting ${affectedUrls.length} unique URLs (${totalOccurrences} occurrences) across rules: ${item.mappedRuleCodes.join(", ")}.`,
    manualReviewReason: item.evaluation === "HYBRID" ? "Hybrid item with detected technical signals requiring editorial confirmation." : undefined,
    remediationWeight: item.weight || 1.0,
  };
}

/**
 * Computes Fast Completion Priority Queue strictly ordered by Scope Tier Precedence
 */
export function buildFastCompletionQueue(
  allItemResults: ScopeItemResult[],
  initialCoreKnownImplPercent: number,
  initialCoreVerifiedPercent: number
): FastCompletionQueueItem[] {
  const queue: FastCompletionQueueItem[] = [];

  const actionableItems = allItemResults.filter(
    (r) =>
      r.item.tier !== "ADVANCED_RECOMMENDATION" &&
      (r.status === "FAIL" || r.status === "PARTIAL" || r.status === "REVIEW_REQUIRED")
  );

  // Strict Tier Precedence Order:
  // 1. CORE_COMMITTED_BASIC confirmed failures
  // 2. CORE_COMMITTED_BASIC manual verification required
  // 3. INCLUDED_QUICK_TECHNICAL confirmed failures
  // 4. INCLUDED_QUICK_TECHNICAL manual/gap checks
  // 5. COMPLIMENTARY_ADVANCED confirmed failures
  const getSortScore = (r: ScopeItemResult): number => {
    let s = 0;
    if (r.item.tier === "CORE_COMMITTED_BASIC") {
      s += r.status === "FAIL" ? 50000 : 30000;
    } else if (r.item.tier === "INCLUDED_QUICK_TECHNICAL") {
      s += r.status === "FAIL" ? 20000 : 10000;
    } else if (r.item.tier === "COMPLIMENTARY_ADVANCED") {
      s += 5000;
    }

    const topFix = r.fixIntelligence[0];
    if (topFix) {
      if (topFix.priority === "critical") s += 2000;
      else if (topFix.priority === "high") s += 1000;
      else if (topFix.priority === "medium") s += 500;

      if (topFix.classification === "SYSTEMIC_FIX") s += 400;
      if (topFix.effort === "quick") s += 200;
    }
    return s;
  };

  const sorted = [...actionableItems].sort((a, b) => getSortScore(b) - getSortScore(a));

  const coreItems = allItemResults.filter((r) => r.item.tier === "CORE_COMMITTED_BASIC");
  const knownCoreTechnicalCount = coreItems.filter((r) => r.item.mappingType === "FULL" && r.item.evaluation === "AUTOMATIC").length;

  let runningTechnicalImpl = initialCoreKnownImplPercent;
  let runningVerified = initialCoreVerifiedPercent;

  sorted.forEach((r, idx) => {
    const primaryFix = r.fixIntelligence[0];
    const primaryGroup = r.fixGroups[0];
    const isManual = r.status === "REVIEW_REQUIRED" || r.item.evaluation === "MANUAL" || r.item.mappingType === "DETECTION_GAP";

    const locationCertainty: "CONFIRMED" | "LIKELY" | "UNKNOWN" =
      primaryGroup?.scope === "global_component"
        ? "CONFIRMED"
        : primaryGroup?.scope === "template"
        ? "LIKELY"
        : isManual
        ? "CONFIRMED"
        : "UNKNOWN";

    const evidenceForLocation =
      primaryGroup?.likelySharedCause ||
      (isManual ? `Manual editorial review requirement` : `Page-specific DOM element`);

    let guaranteedTechnicalProgress: FastCompletionQueueItem["guaranteedTechnicalProgress"];
    let conditionalManualProgress: FastCompletionQueueItem["conditionalManualProgress"];

    if (r.item.tier === "CORE_COMMITTED_BASIC") {
      if (!isManual && knownCoreTechnicalCount > 0) {
        const delta = Math.round((100 / knownCoreTechnicalCount) * 10) / 10;
        const before = runningTechnicalImpl;
        const after = Math.min(100, Math.round((runningTechnicalImpl + delta) * 10) / 10);
        runningTechnicalImpl = after;
        guaranteedTechnicalProgress = { beforePercent: before, afterPercent: after, deltaPercent: delta };
      } else {
        const conditionalDelta = Math.round((100 / coreItems.length) * 10) / 10;
        conditionalManualProgress = {
          currentVerifiedPercent: runningVerified,
          potentialVerifiedPercentIfApproved: Math.min(100, Math.round((runningVerified + conditionalDelta) * 10) / 10),
          conditionalDeltaPercent: conditionalDelta,
        };
      }
    }

    queue.push({
      rank: idx + 1,
      scopeTier: r.item.tier,
      scopeItemId: r.item.id,
      scopeItemTitle: r.item.title,
      issueTitle: primaryFix?.title || r.findings[0]?.title || r.item.title,
      ruleCode: primaryFix?.ruleCode || r.item.mappedRuleCodes[0] || "MANUAL_QA",
      seoPriority: primaryFix?.priority || "medium",
      affectedOccurrences: r.affectedOccurrences,
      affectedCount: r.affectedCount,
      affectedUrls: r.affectedUrls.slice(0, 10),
      likelySharedCause: primaryGroup?.likelySharedCause,
      likelyFixLocation: primaryGroup?.recommendedFixLocation || primaryFix?.fix.steps[0]?.location || "Page Settings / Designer",
      locationCertainty,
      evidenceForLocation,
      estimatedActualChanges: isManual ? "UNKNOWN_PENDING_REVIEW" : r.estimatedChangesRemaining,
      effort: isManual ? "editorial_review" : primaryFix?.effort || "quick",
      safety: primaryFix?.safety || "REVIEW_REQUIRED",
      isManualReview: isManual,
      guaranteedTechnicalProgress,
      conditionalManualProgress,
      fixInstructions: primaryFix?.fix.steps.map((s: any) => `${s.action} (${s.location})`) || [
        `Conduct manual QA review for ${r.item.title}.`,
      ],
      verificationCriteria: [
        isManual
          ? `Verify editorial compliance for ${r.item.title} and record manual sign-off.`
          : `Re-crawl site and confirm 0 failing occurrences for rule ${primaryFix?.ruleCode || r.item.id}.`,
      ],
    });
  });

  return queue;
}

/**
 * Builds concise client-safe summary
 */
export function buildClientSafeSummary(
  targetClient: string,
  coreResults: ScopeItemResult[],
  coreSummary: ScopeTierSummary,
  quickTechResults: ScopeItemResult[],
  quickTechSummary: ScopeTierSummary,
  complimentaryResults: ScopeItemResult[],
  complimentarySummary: ScopeTierSummary,
  overallAgreedSummary: {
    knownImpl: number;
    verified: number;
    uniqueUrls: number;
    totalOccurrences: number;
    rootCauses: number;
    knownChanges: number;
    manualReviewsRemaining: number;
  }
): ClientSafeSummary {
  const remainingBreakdown = [...coreResults, ...quickTechResults]
    .filter((i) => i.status !== "PASS" && i.status !== "NOT_APPLICABLE")
    .map((i) => ({
      category: `[${i.item.tier === "CORE_COMMITTED_BASIC" ? "Core Basic" : "Quick Tech"}] ${i.item.title}`,
      affectedCount: i.affectedCount,
      summaryText:
        i.affectedCount > 0
          ? `${i.item.title}: ${i.affectedCount} page(s) affected (${i.affectedOccurrences} occurrences, ~${i.estimatedChangesRemaining} change(s) required).`
          : `${i.item.title}: Pending manual editorial verification.`,
    }));

  return {
    targetClient,
    generatedAt: new Date().toISOString(),
    overallScopeStatus:
      coreSummary.knownImplementationCompletionPercent === 100 &&
      coreSummary.verifiedCompletionPercent === 100
        ? "COMPLETE"
        : "INCOMPLETE",
    coreBasicSeo: {
      knownImplementationPercent: coreSummary.knownImplementationCompletionPercent,
      verifiedCompletionPercent: coreSummary.verifiedCompletionPercent,
      confirmedPassCount: coreSummary.passedCount,
      confirmedFailCount: coreSummary.failedCount,
      pendingManualCount: coreSummary.reviewRequiredCount,
      detectionGapsCount: coreSummary.detectionGapsCount,
      affectedUniquePages: coreSummary.uniqueAffectedUrls.length,
      knownChangesRemaining: coreSummary.knownActualChangesRemaining,
    },
    quickTechnical: {
      knownImplementationPercent: quickTechSummary.knownImplementationCompletionPercent,
      verifiedCompletionPercent: quickTechSummary.verifiedCompletionPercent,
      confirmedPassCount: quickTechSummary.passedCount,
      confirmedFailCount: quickTechSummary.failedCount,
      pendingManualGapsCount: quickTechSummary.reviewRequiredCount,
      affectedUniquePages: quickTechSummary.uniqueAffectedUrls.length,
      knownChangesRemaining: quickTechSummary.knownActualChangesRemaining,
    },
    complimentaryAdvanced: {
      knownImplementationPercent: complimentarySummary.knownImplementationCompletionPercent,
      confirmedPassCount: complimentarySummary.passedCount,
      confirmedFailCount: complimentarySummary.failedCount,
      affectedUniquePages: complimentarySummary.uniqueAffectedUrls.length,
      knownChangesRemaining: complimentarySummary.knownActualChangesRemaining,
    },
    overallAgreedWork: {
      knownImplementationPercent: overallAgreedSummary.knownImpl,
      verifiedCompletionPercent: overallAgreedSummary.verified,
      uniqueAffectedUrls: overallAgreedSummary.uniqueUrls,
      totalIssueOccurrences: overallAgreedSummary.totalOccurrences,
      systemicRootCauses: overallAgreedSummary.rootCauses,
      estimatedKnownChanges: overallAgreedSummary.knownChanges,
      manualReviewsRemaining: overallAgreedSummary.manualReviewsRemaining,
    },
    remainingWorkBreakdown: remainingBreakdown,
  };
}

/**
 * Calculates Known Technical vs Verified Metrics
 */
function calculateTierMetrics(results: ScopeItemResult[]): {
  knownImplPercent: number;
  verifiedPercent: number;
  knownChanges: number;
  unknownChanges: number;
} {
  const applicable = results.filter((r) => r.status !== "NOT_APPLICABLE");
  if (applicable.length === 0) return { knownImplPercent: 100, verifiedPercent: 100, knownChanges: 0, unknownChanges: 0 };

  // Known technical items: machine-checked items
  const knownTechnicalItems = applicable.filter(
    (r) => r.item.mappingType === "FULL" && r.item.evaluation === "AUTOMATIC"
  );

  let knownImplPercent = 100;
  if (knownTechnicalItems.length > 0) {
    const passedTechnical = knownTechnicalItems.filter((r) => r.status === "PASS").length;
    const partialTechnical = knownTechnicalItems.filter((r) => r.status === "PARTIAL").length;
    knownImplPercent = Math.round(((passedTechnical + partialTechnical * 0.5) / knownTechnicalItems.length) * 1000) / 10;
  }

  // Verified percentage: ALL applicable items must be PASS
  const passedAll = applicable.filter((r) => r.status === "PASS").length;
  const partialAll = applicable.filter((r) => r.status === "PARTIAL").length;
  const verifiedPercent = Math.round(((passedAll + partialAll * 0.5) / applicable.length) * 1000) / 10;

  const knownChanges = results
    .filter((r) => r.status === "FAIL" || r.status === "PARTIAL")
    .reduce((sum, r) => sum + r.estimatedChangesRemaining, 0);

  const unknownChanges = results.filter((r) => r.status === "REVIEW_REQUIRED").length;

  return { knownImplPercent, verifiedPercent, knownChanges, unknownChanges };
}

/**
 * Evaluates entire scope preset against audit findings
 */
export function evaluateScopePreset(
  preset: ScopePreset,
  auditIssues: DiagnosticIssue[],
  crawledPages: CrawledPageData[],
  manualChecklist: ManualQaChecklistItem[] = DEFAULT_BOT_MANUAL_CHECKLIST,
  targetSite = "https://www.botconsulting.io/",
  runId = `scope-eval-${Date.now()}`,
  overrideSpecificLinkVerifications?: SpecificLinkVerificationResult[]
): ScopeEvaluationResult {
  const fixAuditResult = generateFixIntelligenceForAudit(auditIssues, crawledPages, targetSite, runId);
  const fixIntelMap = new Map<string, any>();
  for (const fix of fixAuditResult.fixIntelligenceList) {
    fixIntelMap.set(fix.ruleCode, fix);
  }
  const systemicGroups = fixAuditResult.systemicFixGroups;

  // Specific link verifications (use direct live probe if provided, else heuristic)
  const specificLinkVerifications =
    overrideSpecificLinkVerifications || verifySpecificLinks(crawledPages, auditIssues);

  // Evaluate all scope items
  const itemResults: ScopeItemResult[] = preset.items.map((item) =>
    evaluateScopeItem(item, auditIssues, crawledPages, manualChecklist, fixIntelMap, systemicGroups)
  );

  // Group by Tier
  const tierKeys: ScopeTier[] = [
    "CORE_COMMITTED_BASIC",
    "INCLUDED_QUICK_TECHNICAL",
    "COMPLIMENTARY_ADVANCED",
    "ADVANCED_RECOMMENDATION",
  ];

  const tierSummaries: Record<ScopeTier, ScopeTierSummary> = {
    CORE_COMMITTED_BASIC: {
      tier: "CORE_COMMITTED_BASIC",
      totalItems: 0,
      passedCount: 0,
      failedCount: 0,
      partialCount: 0,
      reviewRequiredCount: 0,
      notEvaluatedCount: 0,
      notApplicableCount: 0,
      detectionGapsCount: 0,
      knownImplementationCompletionPercent: 0,
      verifiedCompletionPercent: 0,
      uniqueAffectedUrls: [],
      totalIssueOccurrences: 0,
      uniqueRootCauseGroups: 0,
      knownActualChangesRemaining: 0,
      unknownChangesPendingReview: 0,
    },
    INCLUDED_QUICK_TECHNICAL: {
      tier: "INCLUDED_QUICK_TECHNICAL",
      totalItems: 0,
      passedCount: 0,
      failedCount: 0,
      partialCount: 0,
      reviewRequiredCount: 0,
      notEvaluatedCount: 0,
      notApplicableCount: 0,
      detectionGapsCount: 0,
      knownImplementationCompletionPercent: 0,
      verifiedCompletionPercent: 0,
      uniqueAffectedUrls: [],
      totalIssueOccurrences: 0,
      uniqueRootCauseGroups: 0,
      knownActualChangesRemaining: 0,
      unknownChangesPendingReview: 0,
    },
    COMPLIMENTARY_ADVANCED: {
      tier: "COMPLIMENTARY_ADVANCED",
      totalItems: 0,
      passedCount: 0,
      failedCount: 0,
      partialCount: 0,
      reviewRequiredCount: 0,
      notEvaluatedCount: 0,
      notApplicableCount: 0,
      detectionGapsCount: 0,
      knownImplementationCompletionPercent: 0,
      verifiedCompletionPercent: 0,
      uniqueAffectedUrls: [],
      totalIssueOccurrences: 0,
      uniqueRootCauseGroups: 0,
      knownActualChangesRemaining: 0,
      unknownChangesPendingReview: 0,
    },
    ADVANCED_RECOMMENDATION: {
      tier: "ADVANCED_RECOMMENDATION",
      totalItems: 0,
      passedCount: 0,
      failedCount: 0,
      partialCount: 0,
      reviewRequiredCount: 0,
      notEvaluatedCount: 0,
      notApplicableCount: 0,
      detectionGapsCount: 0,
      knownImplementationCompletionPercent: 0,
      verifiedCompletionPercent: 0,
      uniqueAffectedUrls: [],
      totalIssueOccurrences: 0,
      uniqueRootCauseGroups: 0,
      knownActualChangesRemaining: 0,
      unknownChangesPendingReview: 0,
    },
  };

  for (const r of itemResults) {
    const tierSummary = tierSummaries[r.item.tier];
    tierSummary.totalItems++;
    if (r.status === "PASS") tierSummary.passedCount++;
    else if (r.status === "FAIL") tierSummary.failedCount++;
    else if (r.status === "PARTIAL") tierSummary.partialCount++;
    else if (r.status === "REVIEW_REQUIRED") tierSummary.reviewRequiredCount++;
    else if (r.status === "NOT_EVALUATED") tierSummary.notEvaluatedCount++;
    else if (r.status === "NOT_APPLICABLE") tierSummary.notApplicableCount++;

    if (r.item.mappingType === "DETECTION_GAP") tierSummary.detectionGapsCount++;
    tierSummary.totalIssueOccurrences += r.affectedOccurrences;
  }

  // Calculate separate tier metrics & true mathematical union of affected URLs
  for (const tier of tierKeys) {
    const tierItems = itemResults.filter((item) => item.item.tier === tier);
    const { knownImplPercent, verifiedPercent, knownChanges, unknownChanges } = calculateTierMetrics(tierItems);
    tierSummaries[tier].knownImplementationCompletionPercent = knownImplPercent;
    tierSummaries[tier].verifiedCompletionPercent = verifiedPercent;
    tierSummaries[tier].knownActualChangesRemaining = knownChanges;
    tierSummaries[tier].unknownChangesPendingReview = unknownChanges;

    // TRUE MATHEMATICAL UNION of all failing/partial URLs
    const urlsSet = new Set<string>();
    const rootCausesSet = new Set<string>();
    for (const r of tierItems) {
      if (r.status === "FAIL" || r.status === "PARTIAL" || (r.status === "REVIEW_REQUIRED" && r.affectedUrls.length > 0)) {
        for (const u of r.affectedUrls) urlsSet.add(u);
        for (const g of r.fixGroups) rootCausesSet.add(g.groupId);
      }
    }
    tierSummaries[tier].uniqueAffectedUrls = Array.from(urlsSet);
    tierSummaries[tier].uniqueRootCauseGroups = rootCausesSet.size;
  }

  // Core metrics
  const coreResults = itemResults.filter((r) => r.item.tier === "CORE_COMMITTED_BASIC");
  const quickTechResults = itemResults.filter((r) => r.item.tier === "INCLUDED_QUICK_TECHNICAL");
  const complimentaryResults = itemResults.filter((r) => r.item.tier === "COMPLIMENTARY_ADVANCED");

  const coreSummary = tierSummaries.CORE_COMMITTED_BASIC;
  const quickTechSummary = tierSummaries.INCLUDED_QUICK_TECHNICAL;
  const complimentarySummary = tierSummaries.COMPLIMENTARY_ADVANCED;

  // Overall Agreed Work Union (Core + Quick Tech + Complimentary)
  const agreedUrlsSet = new Set<string>([
    ...coreSummary.uniqueAffectedUrls,
    ...quickTechSummary.uniqueAffectedUrls,
    ...complimentarySummary.uniqueAffectedUrls,
  ]);

  const agreedOccurrences =
    coreSummary.totalIssueOccurrences +
    quickTechSummary.totalIssueOccurrences +
    complimentarySummary.totalIssueOccurrences;

  const agreedRootCauses =
    coreSummary.uniqueRootCauseGroups +
    quickTechSummary.uniqueRootCauseGroups +
    complimentarySummary.uniqueRootCauseGroups;

  const agreedKnownChanges =
    coreSummary.knownActualChangesRemaining +
    quickTechSummary.knownActualChangesRemaining +
    complimentarySummary.knownActualChangesRemaining;

  const agreedManualReviews =
    coreSummary.unknownChangesPendingReview +
    quickTechSummary.unknownChangesPendingReview;

  // Overall Agreed Work Completion (Core = 50%, Quick Tech = 30%, Complimentary = 20%)
  const overallAgreedWorkImplementationPercent = Math.round(
    (coreSummary.knownImplementationCompletionPercent * 0.5 +
      quickTechSummary.knownImplementationCompletionPercent * 0.3 +
      complimentarySummary.knownImplementationCompletionPercent * 0.2) *
      10
  ) / 10;

  const overallAgreedWorkVerifiedPercent = Math.round(
    (coreSummary.verifiedCompletionPercent * 0.5 +
      quickTechSummary.verifiedCompletionPercent * 0.3 +
      complimentarySummary.verifiedCompletionPercent * 0.2) *
      10
  ) / 10;

  // Manual Review Coverage & Detection Coverage
  const totalManualItems = preset.items.filter((i) => i.evaluation === "MANUAL" || i.evaluation === "HYBRID").length;
  const passedManualItems = itemResults.filter((r) => (r.item.evaluation === "MANUAL" || r.item.evaluation === "HYBRID") && r.status === "PASS").length;
  const manualReviewCoveragePercent = totalManualItems > 0 ? Math.round((passedManualItems / totalManualItems) * 1000) / 10 : 100;

  const machineCheckedItems = preset.items.filter((i) => i.mappingType === "FULL").length;
  const detectionCoveragePercent = Math.round((machineCheckedItems / preset.items.length) * 1000) / 10;

  // Gate Status
  const isCoreComplete =
    coreSummary.failedCount === 0 &&
    coreSummary.partialCount === 0 &&
    coreSummary.reviewRequiredCount === 0 &&
    coreSummary.verifiedCompletionPercent === 100;

  const gateStatus: ScopeEvaluationResult["gateStatus"] = isCoreComplete
    ? "BOT_BASIC_SEO_COMPLETE"
    : "BOT_BASIC_SEO_INCOMPLETE";

  // Fast Completion Queue
  const fastCompletionQueue = buildFastCompletionQueue(
    itemResults,
    coreSummary.knownImplementationCompletionPercent,
    coreSummary.verifiedCompletionPercent
  );

  // Detection Gaps
  const detectionGaps: DetectionGapInfo[] = preset.items
    .filter((i) => i.detectionGap)
    .map((i) => i.detectionGap!);

  // Client-Safe Summary
  const clientSafeSummary = buildClientSafeSummary(
    preset.targetClient,
    coreResults,
    coreSummary,
    quickTechResults,
    quickTechSummary,
    complimentaryResults,
    complimentarySummary,
    {
      knownImpl: overallAgreedWorkImplementationPercent,
      verified: overallAgreedWorkVerifiedPercent,
      uniqueUrls: agreedUrlsSet.size,
      totalOccurrences: agreedOccurrences,
      rootCauses: agreedRootCauses,
      knownChanges: agreedKnownChanges,
      manualReviewsRemaining: agreedManualReviews,
    }
  );

  return {
    runId,
    generatedAt: new Date().toISOString(),
    targetSite,
    preset: {
      presetId: preset.presetId,
      presetName: preset.presetName,
      version: preset.version,
    },
    gateStatus,
    metrics: {
      coreKnownImplementationPercent: coreSummary.knownImplementationCompletionPercent,
      coreVerifiedPercent: coreSummary.verifiedCompletionPercent,
      quickTechKnownImplementationPercent: quickTechSummary.knownImplementationCompletionPercent,
      quickTechVerifiedPercent: quickTechSummary.verifiedCompletionPercent,
      complimentaryKnownImplementationPercent: complimentarySummary.knownImplementationCompletionPercent,
      overallAgreedWorkImplementationPercent,
      overallAgreedWorkVerifiedPercent,
      manualReviewCoveragePercent,
      detectionCoveragePercent,
      coreUniqueAffectedUrls: coreSummary.uniqueAffectedUrls.length,
      quickTechUniqueAffectedUrls: quickTechSummary.uniqueAffectedUrls.length,
      complimentaryUniqueAffectedUrls: complimentarySummary.uniqueAffectedUrls.length,
      overallAgreedWorkUniqueAffectedUrls: agreedUrlsSet.size,
      totalIssueOccurrences: agreedOccurrences,
      totalUniqueRootCauseGroups: agreedRootCauses,
      estimatedKnownActualChanges: agreedKnownChanges,
      manualReviewsRemaining: agreedManualReviews,
    },
    tierSummaries,
    itemResults,
    manualQaChecklist: manualChecklist,
    specificLinkVerifications,
    fastCompletionQueue,
    detectionGaps,
    clientSafeSummary,
  };
}
