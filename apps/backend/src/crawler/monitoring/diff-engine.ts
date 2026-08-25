/**
 * Hardened Master SEO Diff & Regression Engine.
 * Implements positive-evidence URL removal, rule-aware finding identity, CHANGED lifecycle states,
 * rule semantic versioning, and configurable threshold policies.
 */

import {
  CrawlSnapshot,
  SnapshotDiagnosticFinding,
  FindingChangeRecord,
  PageChangeRecord,
  RegressionPriority,
  UrlLifecycleState,
  DirectUrlProbe,
} from "./types";
import { evaluateCrawlComparability } from "./comparability";
import { buildStableFindingIdentity } from "./finding-identity";
import { DEFAULT_MONITORING_CONFIG, MonitoringConfig } from "./config";

export function diffCrawlSnapshots(
  baseline: CrawlSnapshot | null | undefined,
  current: CrawlSnapshot,
  historicalSnapshots: CrawlSnapshot[] = [],
  directProbes: Record<string, DirectUrlProbe> = {},
  config: MonitoringConfig = DEFAULT_MONITORING_CONFIG
): {
  findingChanges: FindingChangeRecord[];
  pageChanges: PageChangeRecord[];
} {
  const findingChanges: FindingChangeRecord[] = [];
  const pageChanges: PageChangeRecord[] = [];

  const comp = evaluateCrawlComparability(baseline, current, config);

  // If no baseline or domain mismatch, emit baseline findings as BASELINE_UNAVAILABLE
  if (!baseline || baseline.rootDomain !== current.rootDomain) {
    for (const f of current.findings) {
      findingChanges.push({
        stableFindingKey: buildStableFindingIdentity(f),
        ruleCode: f.ruleCode,
        monitoringSignalCode: f.monitoringSignalCode || f.ruleCode,
        url: f.url,
        lifecycle: "BASELINE_UNAVAILABLE",
        technicalSeverity: f.severity,
        regressionPriority: mapSeverityToRegressionPriority(f.severity),
        firstSeenSnapshotId: current.snapshotId,
        lastSeenSnapshotId: current.snapshotId,
        recurrenceCount: 1,
        previousEvidence: null,
        currentEvidence: f.evidence || null,
        remediationSummary: f.remediationBlueprint?.summary || f.message || "Remediate finding.",
      });
    }
    return { findingChanges, pageChanges };
  }

  // 1. Map Baseline Findings by Stable Identity
  const baselineFindingMap = new Map<string, SnapshotDiagnosticFinding>();
  for (const f of baseline.findings) {
    baselineFindingMap.set(buildStableFindingIdentity(f), f);
  }

  // 2. Map Current Findings by Stable Identity
  const currentFindingMap = new Map<string, SnapshotDiagnosticFinding>();
  for (const f of current.findings) {
    currentFindingMap.set(buildStableFindingIdentity(f), f);
  }

  // 3. Evaluate Current Findings against Baseline
  for (const [key, curFinding] of currentFindingMap) {
    const baseFinding = baselineFindingMap.get(key);

    if (baseFinding) {
      // Finding existed in baseline
      // Check if Evidence Changed materially (CHANGED vs PERSISTING)
      const evidenceChanged = baseFinding.evidence !== curFinding.evidence && Boolean(baseFinding.evidence && curFinding.evidence);
      const lifecycle = evidenceChanged ? "CHANGED" : "PERSISTING";

      findingChanges.push({
        stableFindingKey: key,
        ruleCode: curFinding.ruleCode,
        monitoringSignalCode: curFinding.monitoringSignalCode || (evidenceChanged ? "EVIDENCE_MATERIAL_CHANGE" : curFinding.ruleCode),
        url: curFinding.url,
        lifecycle,
        technicalSeverity: curFinding.severity,
        regressionPriority: mapSeverityToRegressionPriority(curFinding.severity),
        firstSeenSnapshotId: baseline.snapshotId,
        lastSeenSnapshotId: current.snapshotId,
        recurrenceCount: 2,
        previousEvidence: baseFinding.evidence || null,
        currentEvidence: curFinding.evidence || null,
        remediationSummary: curFinding.remediationBlueprint?.summary || curFinding.message || "Remediate finding.",
      });
    } else {
      // Finding is NEW in Current
      // Check Rule Semantic Signatures
      const baseRuleSig = baseline.ruleSignatures?.[curFinding.ruleCode] || baseline.ruleSetVersion || "1.0.0";
      const currRuleSig = current.ruleSignatures?.[curFinding.ruleCode] || curFinding.ruleSemanticVersion || current.ruleSetVersion || "1.0.0";

      const isNewRule = baseline.ruleSetVersion !== current.ruleSetVersion && !baseline.findings.some((f) => f.ruleCode === curFinding.ruleCode);
      const isSemanticsChanged = baseRuleSig !== currRuleSig && !isNewRule;

      if (isNewRule) {
        findingChanges.push({
          stableFindingKey: key,
          ruleCode: curFinding.ruleCode,
          monitoringSignalCode: "NEW_RULE_INTRODUCED",
          url: curFinding.url,
          lifecycle: "NEWLY_DETECTABLE",
          technicalSeverity: curFinding.severity,
          regressionPriority: "INFORMATIONAL_CHANGE",
          firstSeenSnapshotId: current.snapshotId,
          lastSeenSnapshotId: current.snapshotId,
          recurrenceCount: 1,
          previousEvidence: null,
          currentEvidence: curFinding.evidence || null,
          remediationSummary: `Rule ${curFinding.ruleCode} introduced in rule-set ${current.ruleSetVersion}.`,
        });
      } else if (isSemanticsChanged) {
        findingChanges.push({
          stableFindingKey: key,
          ruleCode: curFinding.ruleCode,
          monitoringSignalCode: "RULE_SEMANTICS_UPDATED",
          url: curFinding.url,
          lifecycle: "NEWLY_DETECTABLE",
          technicalSeverity: curFinding.severity,
          regressionPriority: "INFORMATIONAL_CHANGE",
          firstSeenSnapshotId: current.snapshotId,
          lastSeenSnapshotId: current.snapshotId,
          recurrenceCount: 1,
          previousEvidence: null,
          currentEvidence: curFinding.evidence || null,
          remediationSummary: `Diagnostic rule ${curFinding.ruleCode} logic updated (${baseRuleSig} -> ${currRuleSig}).`,
        });
      } else {
        // Check if REOPENED (existed in older historical snapshot before baseline)
        const existedHistorically = historicalSnapshots.some(
          (s) => s.snapshotId !== baseline.snapshotId && s.findings.some((f) => buildStableFindingIdentity(f) === key)
        );

        const lifecycle = existedHistorically ? "REOPENED" : "NEW";
        const priority = lifecycle === "REOPENED" ? "HIGH_REGRESSION" : mapSeverityToRegressionPriority(curFinding.severity, true);

        findingChanges.push({
          stableFindingKey: key,
          ruleCode: curFinding.ruleCode,
          monitoringSignalCode: curFinding.monitoringSignalCode || (lifecycle === "REOPENED" ? "REGRESSION_RECURRED" : "NEW_REGRESSION_OBSERVED"),
          url: curFinding.url,
          lifecycle,
          technicalSeverity: curFinding.severity,
          regressionPriority: priority,
          firstSeenSnapshotId: current.snapshotId,
          lastSeenSnapshotId: current.snapshotId,
          recurrenceCount: lifecycle === "REOPENED" ? 2 : 1,
          previousEvidence: null,
          currentEvidence: curFinding.evidence || null,
          remediationSummary: curFinding.remediationBlueprint?.summary || curFinding.message || "Remediate finding.",
        });
      }
    }
  }

  // 4. Evaluate Baseline Findings Missing in Current (Rule-Aware RESOLVED vs NOT_EVALUATED)
  for (const [key, baseFinding] of baselineFindingMap) {
    if (!currentFindingMap.has(key)) {
      const pageInCurrent = current.pages[baseFinding.url] || current.pages[baseFinding.url.toLowerCase().replace(/\/$/, "")];
      const directProbe = directProbes[baseFinding.url];

      const isResolvedByRedirect = directProbe && (directProbe.statusCode === 301 || directProbe.statusCode === 308);
      const isResolvedByCleanCrawl = pageInCurrent && (pageInCurrent.statusCode === 200 || pageInCurrent.statusCode === 301);

      if (isResolvedByCleanCrawl || isResolvedByRedirect) {
        findingChanges.push({
          stableFindingKey: key,
          ruleCode: baseFinding.ruleCode,
          monitoringSignalCode: "FINDING_CONFIRMED_RESOLVED",
          url: baseFinding.url,
          lifecycle: "RESOLVED",
          technicalSeverity: baseFinding.severity,
          regressionPriority: "INFORMATIONAL_CHANGE",
          firstSeenSnapshotId: baseline.snapshotId,
          lastSeenSnapshotId: baseline.snapshotId,
          recurrenceCount: 1,
          previousEvidence: baseFinding.evidence || null,
          currentEvidence: isResolvedByRedirect
            ? `Verified resolved via redirect to ${directProbe?.redirectTarget || "new location"}.`
            : "Confirmed resolved in current crawl traversal.",
          remediationSummary: `Issue ${baseFinding.ruleCode} verified resolved on ${baseFinding.url}.`,
        });
      } else {
        // Page was not crawled and no probe confirmed resolution -> NOT_EVALUATED
        findingChanges.push({
          stableFindingKey: key,
          ruleCode: baseFinding.ruleCode,
          monitoringSignalCode: "RESOLVE_PENDING_RECRAWL",
          url: baseFinding.url,
          lifecycle: "NOT_EVALUATED",
          technicalSeverity: baseFinding.severity,
          regressionPriority: "INFORMATIONAL_CHANGE",
          firstSeenSnapshotId: baseline.snapshotId,
          lastSeenSnapshotId: baseline.snapshotId,
          recurrenceCount: 1,
          previousEvidence: baseFinding.evidence || null,
          currentEvidence: "Page was absent from current crawl traversal; resolution cannot be confirmed without re-evaluation.",
          remediationSummary: `Pending re-crawl of ${baseFinding.url}.`,
        });
      }
    }
  }

  // 5. Evaluate Page-Level Transitions & Positive-Evidence URL Removal
  const allUrls = new Set([...Object.keys(baseline.pages), ...Object.keys(current.pages), ...Object.keys(directProbes)]);

  for (const url of allUrls) {
    const basePage = baseline.pages[url];
    const curPage = current.pages[url];
    const probe = directProbes[url];

    if (!basePage && curPage) {
      pageChanges.push({
        url,
        lifecycle: "NEW_URL",
      });
    } else if (basePage && !curPage) {
      // URL absent from current crawl traversal
      // Check Direct Probe Positive Evidence
      let urlLife: UrlLifecycleState = "POSSIBLY_REMOVED";

      if (probe) {
        if (probe.statusCode === 404 || probe.statusCode === 410) {
          urlLife = "REMOVED_CONFIRMED";
        } else if (probe.statusCode === 301 || probe.statusCode === 302 || probe.statusCode === 307 || probe.statusCode === 308) {
          urlLife = "REDIRECTED_CONFIRMED";
        } else if (probe.statusCode === 200) {
          urlLife = "NO_LONGER_DISCOVERED"; // Still returns 200, just unlinked/orphaned!
        }
      } else if (current.isComplete) {
        urlLife = "NO_LONGER_DISCOVERED";
      } else {
        urlLife = "POSSIBLY_REMOVED";
      }

      pageChanges.push({
        url,
        lifecycle: urlLife,
      });
    } else if (basePage && curPage) {
      let urlLife: UrlLifecycleState = "EXISTING_URL";
      let statusChange: PageChangeRecord["statusCodeChange"] | undefined = undefined;
      let indexChange: PageChangeRecord["indexabilityChange"] | undefined = undefined;
      let titleChange: PageChangeRecord["titleChange"] | undefined = undefined;
      let h1Change: PageChangeRecord["h1Change"] | undefined = undefined;
      let canonicalChange: PageChangeRecord["canonicalChange"] | undefined = undefined;
      let ogImageChange: PageChangeRecord["ogImageChange"] | undefined = undefined;
      let contentLoss = false;

      // Status change
      if (basePage.statusCode !== curPage.statusCode) {
        urlLife = "STATUS_CHANGED";
        statusChange = { previous: basePage.statusCode, current: curPage.statusCode };
      } else if (basePage.isIndexable !== curPage.isIndexable) {
        urlLife = "INDEXABILITY_CHANGED";
      } else if (basePage.canonicalUrl !== curPage.canonicalUrl) {
        urlLife = "CANONICAL_CHANGED";
      }

      // Record all specific changes
      if (basePage.isIndexable !== curPage.isIndexable) {
        indexChange = { previous: basePage.isIndexable, current: curPage.isIndexable };
      }
      if (basePage.canonicalUrl !== curPage.canonicalUrl) {
        canonicalChange = { previous: basePage.canonicalUrl, current: curPage.canonicalUrl };
      }

      // Title change
      if (basePage.title !== curPage.title) {
        titleChange = { previous: basePage.title, current: curPage.title };
      }

      // H1 change
      if (basePage.h1 !== curPage.h1) {
        h1Change = { previous: basePage.h1, current: curPage.h1 };
      }

      // OG Image change
      if (basePage.ogImage !== curPage.ogImage || basePage.ogImageFetchState !== curPage.ogImageFetchState) {
        ogImageChange = {
          previous: basePage.ogImage,
          current: curPage.ogImage,
          fetchStateChange:
            basePage.ogImageFetchState !== curPage.ogImageFetchState
              ? `${basePage.ogImageFetchState || "UNKNOWN"} -> ${curPage.ogImageFetchState || "UNKNOWN"}`
              : undefined,
        };
      }

      // Proportional Content Loss Check
      const prevWords = basePage.contentWordCount || 0;
      const currWords = curPage.contentWordCount || 0;
      if (prevWords >= config.contentLoss.minPreviousWordCount && currWords <= config.contentLoss.maxCurrentWordCount) {
        const dropRatio = (prevWords - currWords) / prevWords;
        if (dropRatio >= config.contentLoss.proportionalReductionThreshold) {
          contentLoss = true;
        }
      }

      // Performance Lab & Field Regression Evaluation
      let perfReg: PageChangeRecord["performanceRegression"] | undefined = undefined;
      if (basePage.lcpMs && curPage.lcpMs) {
        const delta = curPage.lcpMs - basePage.lcpMs;
        // Check Lab Configuration Inconclusive Guard
        const labMismatch =
          basePage.labConfig &&
          curPage.labConfig &&
          (basePage.labConfig.device !== curPage.labConfig.device || basePage.labConfig.throttling !== curPage.labConfig.throttling);

        if (labMismatch) {
          perfReg = {
            metric: "LCP",
            previous: `${basePage.lcpMs}ms`,
            current: `${curPage.lcpMs}ms`,
            type: "PERFORMANCE_COMPARISON_INCONCLUSIVE",
          };
        } else if (delta >= config.performance.lcpMaterialDeltaMs && (curPage.lcpMs > 2500 || basePage.lcpMs <= 2500)) {
          perfReg = {
            metric: "LCP",
            previous: `${basePage.lcpMs}ms`,
            current: `${curPage.lcpMs}ms`,
            type: "FIELD_REGRESSION",
          };
        }
      }

      // GSC correlation (preserves temporal correlation, avoids causation)
      let gscCorr: PageChangeRecord["gscTrendCorrelation"] | undefined = undefined;
      if (basePage.gscData && curPage.gscData) {
        const deltaClicks = curPage.gscData.currentPeriod.clicks - basePage.gscData.currentPeriod.clicks;
        if (deltaClicks < -15) {
          gscCorr = {
            clicksDelta: deltaClicks,
            correlationNote: `Clicks decreased by ${Math.abs(deltaClicks)} over comparison window. Temporally correlated with technical findings on page.`,
          };
        }
      }

      // GEO/AEO changes
      let geoChanges: PageChangeRecord["geoAeoChanges"] | undefined = undefined;
      if (basePage.geoAeoResult && curPage.geoAeoResult) {
        const baseSearchBlocked = basePage.geoAeoResult.crawlerAccess.some((c) => c.crawler.role === "SEARCH_INDEXER" && c.accessStatus === "DISALLOWED");
        const curSearchBlocked = curPage.geoAeoResult.crawlerAccess.some((c) => c.crawler.role === "SEARCH_INDEXER" && c.accessStatus === "DISALLOWED");

        if (!baseSearchBlocked && curSearchBlocked) {
          geoChanges = {
            crawlerAccessChanges: ["Search indexer (OAI-SearchBot/Googlebot) access changed from ALLOWED to DISALLOWED in robots.txt."],
            isTrainingPolicyChangeOnly: false,
          };
        }
      }

      pageChanges.push({
        url,
        lifecycle: urlLife,
        statusCodeChange: statusChange,
        indexabilityChange: indexChange,
        canonicalChange,
        titleChange,
        h1Change,
        ogImageChange,
        contentLossDetected: contentLoss,
        performanceRegression: perfReg,
        gscTrendCorrelation: gscCorr,
        geoAeoChanges: geoChanges,
      });
    }
  }

  return { findingChanges, pageChanges };
}

function mapSeverityToRegressionPriority(
  severity: SnapshotDiagnosticFinding["severity"],
  isNew = false
): RegressionPriority {
  if (severity === "critical") return "CRITICAL_REGRESSION";
  if (severity === "high") return isNew ? "HIGH_REGRESSION" : "HIGH_REGRESSION";
  if (severity === "medium") return isNew ? "HIGH_REGRESSION" : "MEDIUM_REGRESSION";
  if (severity === "low") return "LOW_REGRESSION";
  return "INFORMATIONAL_CHANGE";
}
