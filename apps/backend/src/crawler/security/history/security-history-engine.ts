/**
 * Security History, Lifecycle & Comparison Engine (SECURITY S7).
 * Authoritatively computes finding lifecycles, coverage comparability, score deltas, and multi-audit diffs.
 */

import type {
  SecurityAuditSnapshotEntity,
  SecurityComparisonViewModel,
  HistoricalFindingLifecycleItem,
  SecurityCategoryComparisonItem,
  SecurityCapabilityComparisonItem,
  ThirdPartyComparisonItem,
  SecurityTimelineItem,
  SecurityHistoryTimelineResponse,
  SecurityFindingLifecycleState,
} from "./types";
import type { SecurityFinding } from "../rule-types";
import type { SecurityAuditViewModel, SecurityCategoryPosture } from "../scoring/score-types";

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  transport: "Transport & HTTPS",
  hsts: "HSTS Transport Security",
  csp: "Content Security Policy",
  frame_protection: "Clickjacking & Framing",
  headers: "Browser Security Headers",
  cookies: "Cookies & Session Security",
  cors: "Cross-Origin Sharing (CORS)",
  information_disclosure: "Technology Disclosure",
  sensitive_files: "Sensitive Files & Probes",
  mixed_content: "Mixed Content & Downgrades",
  forms_inputs: "Forms & Input Security",
  dns_email: "Domain & Email Security",
  third_party_js: "Third-Party JavaScript & Supply Chain",
  manual_pentest: "Manual Penetration Testing",
};

/**
 * Computes a deterministic, stable finding identity across audits.
 * Stable under URL reordering, crawl pass reordering, and multi-page grouping.
 */
export function computeFindingIdentity(finding: SecurityFinding): string {
  // If rule has an explicit dedup key or ID, normalize it
  const ruleId = finding.ruleId || "UNKNOWN_RULE";
  const scope = finding.scope || "HOST";
  const category = finding.category || "GENERAL";
  
  if (scope === "HOST" || scope === "DOMAIN" || scope === "SITE") {
    return `sec_host_${category}_${ruleId}`.toLowerCase();
  }

  // Page / URL level finding: normalize affected URL pathname
  const rawUrl = finding.affectedUrls?.[0] || (finding as any).url || "";
  let normalizedPath = "";
  try {
    if (rawUrl) {
      const u = new URL(rawUrl);
      normalizedPath = u.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    }
  } catch {
    normalizedPath = (rawUrl || "").toLowerCase();
  }

  return `sec_page_${category}_${ruleId}_${normalizedPath}`.toLowerCase();
}

/**
 * Evaluates whether two snapshots are comparable and checks coverage guardrails.
 */
export function evaluateSecurityComparability(
  baseline: SecurityAuditSnapshotEntity,
  current: SecurityAuditSnapshotEntity
): {
  status: "FULLY_COMPARABLE" | "PARTIALLY_COMPARABLE" | "NOT_COMPARABLE";
  reason: string;
  isScopeReduced: boolean;
} {
  const baseCrawled = baseline.actualCrawledPageCount ?? baseline.payload?.pages?.length ?? 1;
  const currCrawled = current.actualCrawledPageCount ?? current.payload?.pages?.length ?? 1;

  const baseCeiling = baseline.requestedCrawlLimit;
  const currCeiling = current.requestedCrawlLimit;

  // If user explicitly reduced ceiling or crawl completed with significantly fewer pages
  const isCeilingReduced = Boolean(baseCeiling && currCeiling && currCeiling < baseCeiling);
  const isCrawledReduced = currCrawled < Math.floor(baseCrawled * 0.8) && currCrawled < (baseline.discoveredPageCount || baseCrawled);

  if (baseline.domain !== current.domain) {
    return {
      status: "NOT_COMPARABLE",
      reason: `Audits target different domains (${baseline.domain} vs ${current.domain}).`,
      isScopeReduced: false,
    };
  }

  if (current.isPartialAudit || (currCeiling && currCeiling < 10)) {
    return {
      status: "PARTIALLY_COMPARABLE",
      reason: `Current audit is a partial crawl or restricted scope (${currCrawled} pages). Historical comparisons may be incomplete.`,
      isScopeReduced: true,
    };
  }

  if (isCeilingReduced) {
    return {
      status: "PARTIALLY_COMPARABLE",
      reason: `Audit ceiling was reduced from ${baseCeiling} to ${currCeiling} pages. Some pages tested in baseline may not have been reached.`,
      isScopeReduced: true,
    };
  }

  if (isCrawledReduced && !isCeilingReduced) {
    return {
      status: "PARTIALLY_COMPARABLE",
      reason: `Current audit crawled ${currCrawled} pages compared to ${baseCrawled} in baseline. Unseen URLs cannot confirm resolution.`,
      isScopeReduced: true,
    };
  }

  return {
    status: "FULLY_COMPARABLE",
    reason: "Both audits executed standard authoritative assessment across comparable scope.",
    isScopeReduced: false,
  };
}

/**
 * Computes authoritative comparison between baseline and current security snapshots.
 */
export function compareSecuritySnapshots(
  baseline: SecurityAuditSnapshotEntity,
  current: SecurityAuditSnapshotEntity,
  historicalSnapshotsForProject: SecurityAuditSnapshotEntity[] = []
): SecurityComparisonViewModel {
  const comparability = evaluateSecurityComparability(baseline, current);

  // 1. Score Comparison
  const scorePolicyCompatible = baseline.scorePolicyVersion === current.scorePolicyVersion;
  const scoreDelta = scorePolicyCompatible ? Math.round((current.score - baseline.score) * 10) / 10 : null;
  const scorePolicyMismatchNote = !scorePolicyCompatible
    ? `Scoring model updated (${baseline.scorePolicyVersion} → ${current.scorePolicyVersion}). Direct score delta suppressed.`
    : null;

  // 2. Severity Totals Diff
  const severityDiff = {
    critical: { baseline: baseline.criticalCount, current: current.criticalCount, delta: current.criticalCount - baseline.criticalCount },
    high: { baseline: baseline.highCount, current: current.highCount, delta: current.highCount - baseline.highCount },
    medium: { baseline: baseline.mediumCount, current: current.mediumCount, delta: current.mediumCount - baseline.mediumCount },
    low: { baseline: baseline.lowCount, current: current.lowCount, delta: current.lowCount - baseline.lowCount },
    informational: { baseline: baseline.informationalCount, current: current.informationalCount, delta: current.informationalCount - baseline.informationalCount },
  };

  // 3. Finding Lifecycle Classification
  const baselineFindings = baseline.payload?.findings || [];
  const currentFindings = current.payload?.findings || [];

  const baselineMap = new Map<string, SecurityFinding>();
  for (const f of baselineFindings) {
    const id = computeFindingIdentity(f);
    baselineMap.set(id, f);
  }

  const currentMap = new Map<string, SecurityFinding>();
  for (const f of currentFindings) {
    const id = computeFindingIdentity(f);
    currentMap.set(id, f);
  }

  // Pre-index prior audits before baseline to detect REOPENED findings
  const priorFindingIds = new Set<string>();
  const resolvedInPastIds = new Set<string>();
  for (const past of historicalSnapshotsForProject) {
    if (new Date(past.createdAt).getTime() < new Date(baseline.createdAt).getTime()) {
      for (const pf of past.payload?.findings || []) {
        priorFindingIds.add(computeFindingIdentity(pf));
      }
    }
  }

  const lifecycleFindings: HistoricalFindingLifecycleItem[] = [];

  // A. Evaluate Current Findings (NEW, PERSISTING, REOPENED)
  for (const [id, currFinding] of currentMap.entries()) {
    const baseFinding = baselineMap.get(id);

    if (baseFinding) {
      // Exists in baseline and current
      lifecycleFindings.push({
        findingId: id,
        ruleId: currFinding.ruleId,
        title: currFinding.title,
        category: currFinding.category,
        severity: currFinding.severity,
        scope: currFinding.scope || "HOST",
        targetResource: currFinding.affectedUrls?.[0] || (currFinding as any).url || null,
        lifecycleState: "PERSISTING",
        baselineFinding: baseFinding,
        currentFinding: currFinding,
        resolutionReason: null,
      });
    } else {
      // Absent in baseline. Was it present in an older prior audit?
      const isReopened = priorFindingIds.has(id);
      lifecycleFindings.push({
        findingId: id,
        ruleId: currFinding.ruleId,
        title: currFinding.title,
        category: currFinding.category,
        severity: currFinding.severity,
        scope: currFinding.scope || "HOST",
        targetResource: currFinding.affectedUrls?.[0] || (currFinding as any).url || null,
        lifecycleState: isReopened ? "REOPENED" : "NEW",
        baselineFinding: null,
        currentFinding: currFinding,
        reopenReason: isReopened ? "Finding was previously detected in an earlier audit, absent in baseline, and reappeared now." : null,
      });
    }
  }

  // B. Evaluate Baseline Findings Not in Current (RESOLVED vs UNABLE_TO_CONFIRM_RESOLUTION)
  const currentCoverage = current.payload?.coverage || [];
  const currentCoverageMap = new Map<string, any>(currentCoverage.map((c: any) => [c.ruleId, c]));
  const currentCapabilities = current.payload?.capabilities || {};

  for (const [id, baseFinding] of baselineMap.entries()) {
    if (currentMap.has(id)) continue; // Already processed as PERSISTING

    const ruleId = baseFinding.ruleId;
    const ruleCov = currentCoverageMap.get(ruleId);

    // Resolution Guard 1: Was the rule executed in current audit?
    if (!ruleCov) {
      lifecycleFindings.push({
        findingId: id,
        ruleId: baseFinding.ruleId,
        title: baseFinding.title,
        category: baseFinding.category,
        severity: baseFinding.severity,
        scope: baseFinding.scope || "HOST",
        targetResource: baseFinding.affectedUrls?.[0] || (baseFinding as any).url || null,
        lifecycleState: "UNABLE_TO_CONFIRM_RESOLUTION",
        baselineFinding: baseFinding,
        currentFinding: null,
        unableToConfirmReason: `Rule ${ruleId} was not executed in current audit.`,
      });
      continue;
    }

    // Resolution Guard 2: Capability or rule non-evaluable state in current audit
    if (
      ruleCov.coverageState === "NOT_AVAILABLE" ||
      ruleCov.coverageState === "NOT_OBSERVABLE" ||
      ruleCov.coverageState === "NOT_APPLICABLE" ||
      ruleCov.coverageState === "PROVIDER_REQUIRED" ||
      ruleCov.coverageState === "REQUIRES_MANUAL_VERIFICATION" ||
      ruleCov.coverageState === "ERROR" ||
      ruleCov.coverageState !== "PASS"
    ) {
      lifecycleFindings.push({
        findingId: id,
        ruleId: baseFinding.ruleId,
        title: baseFinding.title,
        category: baseFinding.category,
        severity: baseFinding.severity,
        scope: baseFinding.scope || "HOST",
        targetResource: baseFinding.affectedUrls?.[0] || (baseFinding as any).url || null,
        lifecycleState: "UNABLE_TO_CONFIRM_RESOLUTION",
        baselineFinding: baseFinding,
        currentFinding: null,
        unableToConfirmReason: `Current audit rule coverage state is ${ruleCov.coverageState}; automated resolution cannot be proven without verified PASS.`,
      });
      continue;
    }

    // Resolution Guard 3: Crawl Scope Truncation for Page-Level Findings
    if ((baseFinding.scope as string) === "PAGE" || (baseFinding.scope as string) === "URL") {
      const affectedUrl = baseFinding.affectedUrls?.[0] || (baseFinding as any).url || "";
      const currentPages = current.payload?.pages || [];
      const isUrlCrawled = currentPages.some((p: any) => {
        try {
          return new URL(p.url).pathname.toLowerCase() === new URL(affectedUrl).pathname.toLowerCase();
        } catch {
          return p.url === affectedUrl;
        }
      });

      if (!isUrlCrawled) {
        // Page was not crawled in current audit
        lifecycleFindings.push({
          findingId: id,
          ruleId: baseFinding.ruleId,
          title: baseFinding.title,
          category: baseFinding.category,
          severity: baseFinding.severity,
          scope: baseFinding.scope || "PAGE",
          targetResource: affectedUrl,
          lifecycleState: "UNABLE_TO_CONFIRM_RESOLUTION",
          baselineFinding: baseFinding,
          currentFinding: null,
          unableToConfirmReason: `Affected URL was not reached in current audit (crawl scope or routing difference).`,
        });
        continue;
      }
    }

    // Passed all guards: Validly RESOLVED!
    lifecycleFindings.push({
      findingId: id,
      ruleId: baseFinding.ruleId,
      title: baseFinding.title,
      category: baseFinding.category,
      severity: baseFinding.severity,
      scope: baseFinding.scope || "HOST",
      targetResource: baseFinding.affectedUrls?.[0] || (baseFinding as any).url || null,
      lifecycleState: "RESOLVED",
      baselineFinding: baseFinding,
      currentFinding: null,
      resolutionReason: `Control re-evaluated and verified passing in current audit.`,
    });
  }

  // Summary counts
  const lifecycleSummary = {
    totalNew: lifecycleFindings.filter((f) => f.lifecycleState === "NEW").length,
    totalPersisting: lifecycleFindings.filter((f) => f.lifecycleState === "PERSISTING").length,
    totalResolved: lifecycleFindings.filter((f) => f.lifecycleState === "RESOLVED").length,
    totalReopened: lifecycleFindings.filter((f) => f.lifecycleState === "REOPENED").length,
    totalUnableToConfirm: lifecycleFindings.filter((f) => f.lifecycleState === "UNABLE_TO_CONFIRM_RESOLUTION").length,
  };

  // 4. Category Health Comparisons
  const baseCatMap = new Map<string, any>((baseline.payload?.categoryHealth || []).map((c: any) => [c.category, c]));
  const currCatMap = new Map<string, any>((current.payload?.categoryHealth || []).map((c: any) => [c.category, c]));
  
  const allCategoryKeys = Array.from(new Set([...Array.from(baseCatMap.keys()), ...Array.from(currCatMap.keys())]));
  const categoryComparisons: SecurityCategoryComparisonItem[] = allCategoryKeys.map((catKey) => {
    const bCat = baseCatMap.get(catKey);
    const cCat = currCatMap.get(catKey);

    const bHealth: SecurityCategoryPosture = bCat?.posture || "Moderate";
    const cHealth: SecurityCategoryPosture = cCat?.posture || "Moderate";

    const postureRanks: Record<string, number> = {
      Critical: 1,
      "Action Required": 1,
      Weak: 2,
      Moderate: 3,
      Strong: 4,
      Excellent: 5,
      "Manual Testing": 3,
    };

    const bRank = postureRanks[bHealth] || 3;
    const cRank = postureRanks[cHealth] || 3;

    return {
      category: catKey,
      displayName: CATEGORY_DISPLAY_NAMES[catKey] || bCat?.displayName || cCat?.displayName || catKey,
      baselineHealth: bHealth,
      currentHealth: cHealth,
      healthChanged: bHealth !== cHealth,
      isImprovement: cRank > bRank,
      isRegression: cRank < bRank,
      baselineFindingsCount: bCat?.findingsCount || 0,
      currentFindingsCount: cCat?.findingsCount || 0,
    };
  });

  // 5. Capability Comparisons
  const baseCaps: Record<string, any> = baseline.payload?.capabilities || {};
  const currCaps: Record<string, any> = current.payload?.capabilities || {};
  const allCapKeys = Array.from(new Set([...Object.keys(baseCaps), ...Object.keys(currCaps)]));

  const capabilityComparisons: SecurityCapabilityComparisonItem[] = allCapKeys.map((capKey) => {
    const bCap = baseCaps[capKey];
    const cCap = currCaps[capKey];
    const bStatus = bCap?.status || "NOT_AVAILABLE";
    const cStatus = cCap?.status || "NOT_AVAILABLE";

    return {
      capabilityKey: capKey,
      displayName: bCap?.displayName || cCap?.displayName || capKey,
      baselineStatus: bStatus,
      currentStatus: cStatus,
      statusChanged: bStatus !== cStatus,
      explanation: cCap?.explanation || bCap?.explanation || "",
    };
  });

  // 6. Third-Party Comparisons
  const baseTP = (baseline.payload?.thirdParties as any)?.inventory || (baseline.payload?.thirdParties as any)?.origins || [];
  const currTP = (current.payload?.thirdParties as any)?.inventory || (current.payload?.thirdParties as any)?.origins || [];
  const baseTPMap = new Map<string, any>(baseTP.map((t: any) => [t.origin, t]));
  const currTPMap = new Map<string, any>(currTP.map((t: any) => [t.origin, t]));

  const thirdPartyComparisons: ThirdPartyComparisonItem[] = [];
  for (const [origin, cItem] of currTPMap.entries()) {
    if (baseTPMap.has(origin)) {
      thirdPartyComparisons.push({
        origin,
        domain: cItem.domain || origin,
        status: "PERSISTING",
        category: cItem.category,
        scriptCount: cItem.scriptCount || 1,
      });
    } else {
      thirdPartyComparisons.push({
        origin,
        domain: cItem.domain || origin,
        status: "ADDED",
        category: cItem.category,
        scriptCount: cItem.scriptCount || 1,
      });
    }
  }

  for (const [origin, bItem] of baseTPMap.entries()) {
    if (!currTPMap.has(origin)) {
      thirdPartyComparisons.push({
        origin,
        domain: bItem.domain || origin,
        status: "REMOVED",
        category: bItem.category,
        scriptCount: bItem.scriptCount || 1,
      });
    }
  }

  return {
    projectId: current.projectId,
    baselineAuditRunId: baseline.auditRunId,
    currentAuditRunId: current.auditRunId,
    baselineDate: baseline.completedAt || baseline.startedAt,
    currentDate: current.completedAt || current.startedAt,
    computedAt: new Date().toISOString(),
    comparability: {
      status: comparability.status,
      reason: comparability.reason,
      isScopeReduced: comparability.isScopeReduced,
      baselinePagesCrawled: baseline.actualCrawledPageCount ?? baseline.payload?.pages?.length ?? 1,
      currentPagesCrawled: current.actualCrawledPageCount ?? current.payload?.pages?.length ?? 1,
      baselineRequestedCeiling: baseline.requestedCrawlLimit ?? null,
      currentRequestedCeiling: current.requestedCrawlLimit ?? null,
    },
    scoreComparison: {
      baselineScore: baseline.score,
      currentScore: current.score,
      scoreDelta,
      scorePolicyCompatible,
      scorePolicyMismatchNote,
      baselinePosture: baseline.postureBand,
      currentPosture: current.postureBand,
    },
    severityDiff,
    lifecycleSummary,
    lifecycleFindings,
    categoryComparisons,
    capabilityComparisons,
    thirdPartyComparisons,
  };
}

/**
 * Builds the complete project security history timeline response.
 */
export function buildSecurityHistoryTimeline(
  projectId: string,
  domain: string,
  snapshots: SecurityAuditSnapshotEntity[]
): SecurityHistoryTimelineResponse {
  if (!snapshots || snapshots.length === 0) {
    return {
      projectId,
      domain,
      isBaselineOnly: false,
      totalSecurityAudits: 0,
      latestScore: 0,
      latestPosture: "Moderate",
      previousScore: null,
      scoreDelta: null,
      historyTimeline: [],
      latestSnapshot: null,
    };
  }

  // Snapshots sorted newest first
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const latest = sorted[0];
  const previous = sorted.length > 1 ? sorted[1] : null;

  const scoreDelta =
    previous && latest.scorePolicyVersion === previous.scorePolicyVersion
      ? Math.round((latest.score - previous.score) * 10) / 10
      : null;

  const historyTimeline: SecurityTimelineItem[] = sorted.map((snap, idx) => {
    const prior = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    let deltaFromPrior: number | null = null;
    let lifecycleFromPrior = null;

    if (prior) {
      if (snap.scorePolicyVersion === prior.scorePolicyVersion) {
        deltaFromPrior = Math.round((snap.score - prior.score) * 10) / 10;
      }
      try {
        const comp = compareSecuritySnapshots(prior, snap, sorted.slice(idx + 1));
        lifecycleFromPrior = {
          newCount: comp.lifecycleSummary.totalNew,
          persistingCount: comp.lifecycleSummary.totalPersisting,
          resolvedCount: comp.lifecycleSummary.totalResolved,
          reopenedCount: comp.lifecycleSummary.totalReopened,
        };
      } catch {
        lifecycleFromPrior = null;
      }
    }

    return {
      snapshotId: snap.snapshotId,
      auditRunId: snap.auditRunId,
      projectId: snap.projectId,
      completedAt: snap.completedAt || snap.startedAt,
      score: snap.score,
      postureBand: snap.postureBand,
      criticalCount: snap.criticalCount,
      highCount: snap.highCount,
      mediumCount: snap.mediumCount,
      lowCount: snap.lowCount,
      testsExecuted: snap.testsExecuted,
      passedControls: snap.passedControls,
      actualCrawledPageCount: snap.actualCrawledPageCount,
      isPartialAudit: snap.isPartialAudit,
      scoreDeltaFromPrevious: deltaFromPrior,
      lifecycleFromPrevious: lifecycleFromPrior,
    };
  });

  return {
    projectId,
    domain,
    isBaselineOnly: sorted.length === 1,
    totalSecurityAudits: sorted.length,
    latestScore: latest.score,
    latestPosture: latest.postureBand,
    previousScore: previous ? previous.score : null,
    scoreDelta,
    historyTimeline,
    latestSnapshot: latest.payload,
  };
}
