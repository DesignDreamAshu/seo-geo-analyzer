/**
 * Phase 24: Deterministic Audit Comparison & Change Intelligence Engine.
 * Computes identity-level finding diffs, reopen detection, page history, and rule comparisons.
 */

import {
  AuditRunEntity,
  AuditPageEntity,
  AuditFindingEntity,
  AuditComparisonResult,
  FindingDiffItem,
  RuleComparisonSummary,
  PageDiffItem,
  PageDisappearanceReason,
  ScoreDriverItem,
} from "./types";
import { sanitizeEvidenceForComparison } from "./fingerprint";

export interface CompareAuditsInput {
  projectId: string;
  baselineAudit: AuditRunEntity;
  currentAudit: AuditRunEntity;
  baselinePages: AuditPageEntity[];
  currentPages: AuditPageEntity[];
  baselineFindings: AuditFindingEntity[];
  currentFindings: AuditFindingEntity[];
  historicalFindingsForProject?: AuditFindingEntity[];
}

export function computeAuditComparison(input: CompareAuditsInput): AuditComparisonResult {
  const {
    projectId,
    baselineAudit,
    currentAudit,
    baselinePages,
    currentPages,
    baselineFindings,
    currentFindings,
    historicalFindingsForProject = [],
  } = input;

  const baselinePagesMap = new Map<string, AuditPageEntity>();
  for (const p of baselinePages) baselinePagesMap.set(p.normalizedUrl, p);

  const currentPagesMap = new Map<string, AuditPageEntity>();
  for (const p of currentPages) currentPagesMap.set(p.normalizedUrl, p);

  const baselineFindingsMap = new Map<string, AuditFindingEntity>();
  for (const f of baselineFindings) baselineFindingsMap.set(f.findingFingerprint, f);

  const currentFindingsMap = new Map<string, AuditFindingEntity>();
  for (const f of currentFindings) currentFindingsMap.set(f.findingFingerprint, f);

  // Group historical findings by fingerprint for lifecycle tracing
  const historyByFingerprint = new Map<string, AuditFindingEntity[]>();
  for (const h of historicalFindingsForProject) {
    let list = historyByFingerprint.get(h.findingFingerprint);
    if (!list) {
      list = [];
      historyByFingerprint.set(h.findingFingerprint, list);
    }
    list.push(h);
  }

  // Extract rule evaluation contexts
  const baseEvaluated = baselineAudit.configurationSnapshot?.ruleEvaluationContext?.evaluatedRuleIds;
  const currEvaluated = currentAudit.configurationSnapshot?.ruleEvaluationContext?.evaluatedRuleIds;
  const currDisabled = new Set(currentAudit.configurationSnapshot?.ruleEvaluationContext?.disabledRuleIds || []);

  const baseEvaluatedSet = baseEvaluated ? new Set(baseEvaluated) : null;
  const currEvaluatedSet = currEvaluated ? new Set(currEvaluated) : null;

  const findingDiffs: FindingDiffItem[] = [];
  let fixedCount = 0;
  let newCount = 0;
  let unchangedCount = 0;
  let reopenedCount = 0;
  let changedCount = 0;
  let severityIncreasedCount = 0;
  let severityDecreasedCount = 0;
  let uncomparableCount = 0;

  const severityRank: Record<string, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFORMATIONAL: 1,
  };

  const allFingerprints = new Set([
    ...Array.from(baselineFindingsMap.keys()),
    ...Array.from(currentFindingsMap.keys()),
  ]);

  const ruleMap = new Map<string, {
    prevAffected: Set<string>;
    currAffected: Set<string>;
    fixed: number;
    newF: number;
    unchanged: number;
    reopened: number;
    changed: number;
    uncomparable: number;
  }>();

  const getRuleBucket = (ruleId: string) => {
    let b = ruleMap.get(ruleId);
    if (!b) {
      b = {
        prevAffected: new Set(),
        currAffected: new Set(),
        fixed: 0,
        newF: 0,
        unchanged: 0,
        reopened: 0,
        changed: 0,
        uncomparable: 0,
      };
      ruleMap.set(ruleId, b);
    }
    return b;
  };

  // Populate affected pages per rule
  for (const bf of baselineFindings) {
    getRuleBucket(bf.ruleId).prevAffected.add(bf.normalizedUrl);
  }
  for (const cf of currentFindings) {
    getRuleBucket(cf.ruleId).currAffected.add(cf.normalizedUrl);
  }

  for (const fprint of allFingerprints) {
    const base = baselineFindingsMap.get(fprint);
    const curr = currentFindingsMap.get(fprint);
    const history = historyByFingerprint.get(fprint) || [];

    const firstSeenAuditRunId = history.length > 0 ? history[0].auditRunId : (base?.auditRunId || curr?.auditRunId || currentAudit.auditRunId);
    const lastSeenAuditRunId = curr ? curr.auditRunId : (base ? base.auditRunId : currentAudit.auditRunId);
    const reopenCountVal = history.length > 1 ? history.length - 1 : 0;

    if (base && !curr) {
      // Present in baseline, absent in current
      // 1. Check if the rule was disabled in current audit
      if (currDisabled.has(base.ruleId) || (currEvaluatedSet && !currEvaluatedSet.has(base.ruleId))) {
        uncomparableCount += 1;
        getRuleBucket(base.ruleId).uncomparable += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: base.ruleId,
          normalizedUrl: base.normalizedUrl,
          previousSeverity: base.severity,
          comparisonState: "UNCOMPARABLE_RULE_NOT_EVALUATED",
          previousEvidence: base.evidence,
          changeReason: "Rule was disabled or omitted from current evaluation inventory; cannot confirm resolution.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
        continue;
      }

      const relevantCurrentPage = currentPagesMap.get(base.normalizedUrl);

      // 2. Non-200 page-level semantics
      if (relevantCurrentPage) {
        if (relevantCurrentPage.statusCode >= 300 && relevantCurrentPage.statusCode < 400) {
          // Intentionally redirected -> resolves old URL page defects
          fixedCount += 1;
          getRuleBucket(base.ruleId).fixed += 1;
          findingDiffs.push({
            findingFingerprint: fprint,
            ruleId: base.ruleId,
            normalizedUrl: base.normalizedUrl,
            previousSeverity: base.severity,
            comparisonState: "FIXED",
            previousEvidence: base.evidence,
            changeReason: `Page was redirected with status ${relevantCurrentPage.statusCode}; previous page defect resolved.`,
            firstSeenAuditRunId,
            lastSeenAuditRunId,
            reopenCount: reopenCountVal,
          });
          continue;
        } else if (relevantCurrentPage.statusCode === 410) {
          // Intentionally removed with 410
          fixedCount += 1;
          getRuleBucket(base.ruleId).fixed += 1;
          findingDiffs.push({
            findingFingerprint: fprint,
            ruleId: base.ruleId,
            normalizedUrl: base.normalizedUrl,
            previousSeverity: base.severity,
            comparisonState: "NOT_APPLICABLE",
            previousEvidence: base.evidence,
            changeReason: "Page was intentionally removed with 410 Gone status; finding no longer applicable.",
            firstSeenAuditRunId,
            lastSeenAuditRunId,
            reopenCount: reopenCountVal,
          });
          continue;
        } else if (relevantCurrentPage.statusCode >= 500) {
          // Crawl failed on page -> UNCOMPARABLE
          uncomparableCount += 1;
          getRuleBucket(base.ruleId).uncomparable += 1;
          findingDiffs.push({
            findingFingerprint: fprint,
            ruleId: base.ruleId,
            normalizedUrl: base.normalizedUrl,
            previousSeverity: base.severity,
            comparisonState: "UNCOMPARABLE_PAGE_UNAVAILABLE",
            previousEvidence: base.evidence,
            changeReason: `Page crawl failed with status ${relevantCurrentPage.statusCode}; resolution cannot be confirmed.`,
            firstSeenAuditRunId,
            lastSeenAuditRunId,
            reopenCount: reopenCountVal,
          });
          continue;
        }
      }

      // 3. Missing from current crawl altogether
      if (!relevantCurrentPage && currentPages.length > 0) {
        uncomparableCount += 1;
        getRuleBucket(base.ruleId).uncomparable += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: base.ruleId,
          normalizedUrl: base.normalizedUrl,
          previousSeverity: base.severity,
          comparisonState: "UNCOMPARABLE",
          previousEvidence: base.evidence,
          changeReason: "Page was not crawled in current audit. Evidence insufficient to determine resolution.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
      } else {
        // Page was crawled successfully and defect is confirmed absent -> FIXED
        fixedCount += 1;
        getRuleBucket(base.ruleId).fixed += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: base.ruleId,
          normalizedUrl: base.normalizedUrl,
          previousSeverity: base.severity,
          comparisonState: "FIXED",
          previousEvidence: base.evidence,
          changeReason: "Remediation verified: defect is absent in current crawl.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
      }
    } else if (!base && curr) {
      // Absent in baseline, present in current
      // 1. Check if rule was newly evaluated (not evaluated in baseline)
      const baseRuleCount = baselineAudit.productionRuleCount || 95;
      const isRuleUnevaluatedInBaseline =
        (baseEvaluatedSet && !baseEvaluatedSet.has(curr.ruleId)) ||
        (currentAudit.productionRuleCount > baseRuleCount && !baselineFindings.some((bf) => bf.ruleId === curr.ruleId));

      // 2. Check historical audits prior to baseline to detect REOPENED
      const hadEarlierOccurrence = history.some(
        (h) => h.auditRunId !== currentAudit.auditRunId && h.auditRunId !== baselineAudit.auditRunId
      );

      if (hadEarlierOccurrence) {
        reopenedCount += 1;
        getRuleBucket(curr.ruleId).reopened += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          currentSeverity: curr.severity,
          comparisonState: "REOPENED",
          currentEvidence: curr.evidence,
          changeReason: "Regression detected: defect was resolved in baseline but reappeared in current audit.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal + 1,
        });
      } else if (isRuleUnevaluatedInBaseline) {
        uncomparableCount += 1;
        getRuleBucket(curr.ruleId).uncomparable += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          currentSeverity: curr.severity,
          comparisonState: "NEWLY_EVALUATED",
          currentEvidence: curr.evidence,
          changeReason: "This issue was detected by rule coverage that was not evaluated in the selected baseline audit.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: 0,
        });
      } else {
        newCount += 1;
        getRuleBucket(curr.ruleId).newF += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          currentSeverity: curr.severity,
          comparisonState: "NEW",
          currentEvidence: curr.evidence,
          changeReason: "New finding introduced in current audit.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: 0,
        });
      }
    } else if (base && curr) {
      // Present in both audits
      const baseRank = severityRank[base.severity] || 1;
      const currRank = severityRank[curr.severity] || 1;
      const isSeverityIncreased = currRank > baseRank;
      const isSeverityDecreased = currRank < baseRank;

      const cleanBase = sanitizeEvidenceForComparison(base.evidence);
      const cleanCurr = sanitizeEvidenceForComparison(curr.evidence);
      const isEvidenceChanged = JSON.stringify(cleanBase) !== JSON.stringify(cleanCurr);

      if (isSeverityIncreased) {
        severityIncreasedCount += 1;
        changedCount += 1;
        getRuleBucket(curr.ruleId).changed += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          previousSeverity: base.severity,
          currentSeverity: curr.severity,
          comparisonState: "SEVERITY_INCREASED",
          previousEvidence: base.evidence,
          currentEvidence: curr.evidence,
          changeReason: `Severity increased from ${base.severity} to ${curr.severity}.`,
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
      } else if (isSeverityDecreased) {
        severityDecreasedCount += 1;
        changedCount += 1;
        getRuleBucket(curr.ruleId).changed += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          previousSeverity: base.severity,
          currentSeverity: curr.severity,
          comparisonState: "SEVERITY_DECREASED",
          previousEvidence: base.evidence,
          currentEvidence: curr.evidence,
          changeReason: `Severity decreased from ${base.severity} to ${curr.severity}.`,
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
      } else if (isEvidenceChanged) {
        changedCount += 1;
        getRuleBucket(curr.ruleId).changed += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          previousSeverity: base.severity,
          currentSeverity: curr.severity,
          comparisonState: "CHANGED",
          previousEvidence: base.evidence,
          currentEvidence: curr.evidence,
          changeReason: "Defect persists with materially modified diagnostic evidence.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
      } else {
        unchangedCount += 1;
        getRuleBucket(curr.ruleId).unchanged += 1;
        findingDiffs.push({
          findingFingerprint: fprint,
          ruleId: curr.ruleId,
          normalizedUrl: curr.normalizedUrl,
          previousSeverity: base.severity,
          currentSeverity: curr.severity,
          comparisonState: "UNCHANGED",
          previousEvidence: base.evidence,
          currentEvidence: curr.evidence,
          changeReason: "Unchanged issue persists with identical diagnostic signature.",
          firstSeenAuditRunId,
          lastSeenAuditRunId,
          reopenCount: reopenCountVal,
        });
      }
    }
  }

  // Compute Page Diffs with rich disappearance classification
  const pageChanges: PageDiffItem[] = [];
  const allUrls = new Set([
    ...Array.from(baselinePagesMap.keys()),
    ...Array.from(currentPagesMap.keys()),
  ]);

  for (const url of allUrls) {
    const bPage = baselinePagesMap.get(url);
    const cPage = currentPagesMap.get(url);

    if (bPage && !cPage) {
      let disappearanceReason: PageDisappearanceReason = "CRAWL_MISSED";
      if (bPage.statusCode >= 300 && bPage.statusCode < 400) {
        disappearanceReason = "INTENTIONALLY_REDIRECTED";
      } else if (bPage.statusCode === 410) {
        disappearanceReason = "INTENTIONALLY_REMOVED";
      }

      pageChanges.push({
        normalizedUrl: url,
        originalUrl: bPage.originalUrl,
        previousStatusCode: bPage.statusCode,
        comparisonState: "PAGE_REMOVED",
        disappearanceReason,
        details: `Page was crawled in Audit #${baselineAudit.sequenceNumber} but absent in Audit #${currentAudit.sequenceNumber} (${disappearanceReason}).`,
      });
    } else if (!bPage && cPage) {
      pageChanges.push({
        normalizedUrl: url,
        originalUrl: cPage.originalUrl,
        currentStatusCode: cPage.statusCode,
        comparisonState: "PAGE_NEW",
        details: `Newly discovered page in Audit #${currentAudit.sequenceNumber}.`,
      });
    } else if (bPage && cPage) {
      const isStatusChanged = bPage.statusCode !== cPage.statusCode;
      const isRedirected = (cPage.redirectChain && cPage.redirectChain.length > 0) || (cPage.statusCode >= 300 && cPage.statusCode < 400);
      const isContentChanged = bPage.contentHash && cPage.contentHash && bPage.contentHash !== cPage.contentHash;

      if (isRedirected) {
        pageChanges.push({
          normalizedUrl: url,
          originalUrl: cPage.originalUrl,
          previousStatusCode: bPage.statusCode,
          currentStatusCode: cPage.statusCode,
          comparisonState: "PAGE_REDIRECTED",
          disappearanceReason: "INTENTIONALLY_REDIRECTED",
          details: `Redirected to ${cPage.finalUrl}`,
        });
      } else if (isStatusChanged || isContentChanged) {
        pageChanges.push({
          normalizedUrl: url,
          originalUrl: cPage.originalUrl,
          previousStatusCode: bPage.statusCode,
          currentStatusCode: cPage.statusCode,
          comparisonState: "PAGE_CHANGED",
          details: isStatusChanged
            ? `Status changed from ${bPage.statusCode} to ${cPage.statusCode}`
            : "Page content hash altered.",
        });
      } else {
        pageChanges.push({
          normalizedUrl: url,
          originalUrl: cPage.originalUrl,
          previousStatusCode: bPage.statusCode,
          currentStatusCode: cPage.statusCode,
          comparisonState: "PAGE_PRESENT",
        });
      }
    }
  }

  // Compute Rule Summaries
  const ruleSummaries: RuleComparisonSummary[] = [];
  for (const [ruleId, bucket] of ruleMap.entries()) {
    const prevCount = bucket.prevAffected.size;
    const currCount = bucket.currAffected.size;
    ruleSummaries.push({
      ruleId,
      previousAffectedPagesCount: prevCount,
      currentAffectedPagesCount: currCount,
      difference: currCount - prevCount,
      fixedCount: bucket.fixed,
      newCount: bucket.newF,
      unchangedCount: bucket.unchanged,
      reopenedCount: bucket.reopened,
      changedCount: bucket.changed,
      uncomparableCount: bucket.uncomparable,
    });
  }

  const basePagesCount = baselineAudit.summaryStats?.pagesCrawled || baselinePages.length;
  const currPagesCount = currentAudit.summaryStats?.pagesCrawled || currentPages.length;
  const pagesCrawledDelta = currPagesCount - basePagesCount;

  let coverageQuality: "FULLY_COMPARABLE" | "PARTIALLY_COMPARABLE" | "INSUFFICIENT_COVERAGE" = "FULLY_COMPARABLE";
  let coverageWarning: string | undefined;
  let scoreComparisonNotice: string | undefined;

  const isMaterialPageDifference =
    Math.abs(currPagesCount - basePagesCount) >= 10 ||
    (basePagesCount > 0 && currPagesCount / basePagesCount < 0.75) ||
    (currPagesCount > 0 && basePagesCount / currPagesCount < 0.75);

  if (isMaterialPageDifference) {
    coverageQuality = "PARTIALLY_COMPARABLE";
    coverageWarning = `Crawl scope differs significantly (Baseline evaluated ${basePagesCount} pages, current evaluated ${currPagesCount} pages). Findings on unevaluated pages are classified as UNCOMPARABLE rather than resolved.`;
    scoreComparisonNotice = `Score comparison limited by crawl coverage difference (${basePagesCount} vs ${currPagesCount} pages evaluated).`;
  }

  const scoreDelta =
    currentAudit.summaryStats?.seoScore !== undefined && baselineAudit.summaryStats?.seoScore !== undefined
      ? Number((currentAudit.summaryStats.seoScore - baselineAudit.summaryStats.seoScore).toFixed(1))
      : undefined;

  const scoreDrivers: ScoreDriverItem[] = [];
  for (const rs of ruleSummaries) {
    if (rs.fixedCount > 0 || rs.newCount > 0 || rs.reopenedCount > 0 || rs.difference !== 0) {
      const netResolved = rs.fixedCount - (rs.newCount + rs.reopenedCount);
      let explanation = "";
      if (rs.fixedCount > 0 && rs.newCount === 0 && rs.reopenedCount === 0) {
        explanation = `${rs.fixedCount} affected occurrences resolved.`;
      } else if (rs.newCount > 0 || rs.reopenedCount > 0) {
        explanation = `${rs.newCount + rs.reopenedCount} new/reopened occurrences detected.`;
      } else {
        explanation = `Occurrence count changed by ${rs.difference}.`;
      }

      scoreDrivers.push({
        ruleId: rs.ruleId,
        ruleTitle: rs.ruleId,
        penaltyDelta: Number((-netResolved * 0.1).toFixed(1)),
        scoreImpact: Number((netResolved * 0.1).toFixed(1)),
        previousPenalty: rs.previousAffectedPagesCount,
        currentPenalty: rs.currentAffectedPagesCount,
        explanation,
      });
    }
  }

  const comparisonId = `comp_${baselineAudit.auditRunId}_to_${currentAudit.auditRunId}`;

  return {
    comparisonId,
    projectId,
    baselineAuditRunId: baselineAudit.auditRunId,
    currentAuditRunId: currentAudit.auditRunId,
    baselineSequenceNumber: baselineAudit.sequenceNumber,
    currentSequenceNumber: currentAudit.sequenceNumber,
    computedAt: new Date().toISOString(),
    comparisonEngineVersion: "1.2.0",
    previousIssueCount: baselineFindings.length,
    currentIssueCount: currentFindings.length,
    fixedCount,
    newCount,
    unchangedCount,
    reopenedCount,
    changedCount,
    severityIncreasedCount,
    severityDecreasedCount,
    uncomparableCount,
    pageChanges,
    ruleSummaries,
    findingDiffs,
    metricChanges: {
      pagesCrawledDelta,
      scoreDelta,
      scoreDrivers,
    },
    coverageQuality,
    coverageWarning,
    scoreComparisonNotice,
  };
}
