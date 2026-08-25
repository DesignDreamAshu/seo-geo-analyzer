/**
 * Crawl Comparability Gate.
 * Multi-signal comparability evaluation based on configurable monitoring thresholds.
 */

import { CrawlSnapshot, ComparabilityReport, ComparabilityStatus, ComparabilityCheck } from "./types";
import { DEFAULT_MONITORING_CONFIG, MonitoringConfig } from "./config";

export function evaluateCrawlComparability(
  baseline: CrawlSnapshot | null | undefined,
  current: CrawlSnapshot,
  config: MonitoringConfig = DEFAULT_MONITORING_CONFIG
): ComparabilityReport {
  if (!baseline) {
    return {
      status: "NOT_COMPARABLE",
      isComparable: false,
      checks: [
        { name: "baseline_available", satisfied: false, details: "No baseline snapshot provided." },
      ],
      reasons: ["No baseline snapshot provided or baseline is unavailable."],
      limitations: ["Initial crawl snapshot; historical regression monitoring will activate on subsequent crawls."],
    };
  }

  const checks: ComparabilityCheck[] = [];
  const reasons: string[] = [];
  const limitations: string[] = [];

  // 1. Origin Domain Match
  const domainMatch = baseline.rootDomain === current.rootDomain;
  checks.push({
    name: "domain_match",
    satisfied: domainMatch,
    details: `Baseline: ${baseline.rootDomain}, Current: ${current.rootDomain}`,
  });
  if (!domainMatch) {
    reasons.push(`Root domain mismatch: baseline was '${baseline.rootDomain}', current is '${current.rootDomain}'.`);
    return {
      status: "NOT_COMPARABLE",
      isComparable: false,
      checks,
      reasons,
      limitations: ["Cross-domain comparisons are strictly forbidden."],
    };
  }

  // 2. Current Crawl Traversal Completeness
  const currentComplete = current.isComplete;
  checks.push({
    name: "current_crawl_complete",
    satisfied: currentComplete,
    details: currentComplete ? "Current crawl completed full traversal." : "Current crawl was interrupted before completion.",
  });
  if (!currentComplete) {
    reasons.push("Current crawl was interrupted before completing full traversal.");
    limitations.push("URLs absent from current crawl cannot be marked as REMOVED or RESOLVED.");
  }

  // 3. Baseline Crawl Traversal Completeness
  const baselineComplete = baseline.isComplete;
  checks.push({
    name: "baseline_crawl_complete",
    satisfied: baselineComplete,
    details: baselineComplete ? "Baseline crawl was complete." : "Baseline crawl was incomplete.",
  });
  if (!baselineComplete) {
    reasons.push("Baseline crawl was incomplete; some baseline findings may be absent.");
  }

  // 4. Crawl Scope Match
  const scopeMatch = baseline.crawlScope === current.crawlScope;
  checks.push({
    name: "scope_match",
    satisfied: scopeMatch,
    details: `Baseline scope: '${baseline.crawlScope || "full_site"}', Current scope: '${current.crawlScope || "full_site"}'`,
  });
  if (!scopeMatch) {
    reasons.push(`Crawl scope differs: baseline was '${baseline.crawlScope}', current is '${current.crawlScope}'.`);
    limitations.push("Scope differences may create artificial URL additions or deletions.");
  }

  // 5. Multi-Signal Traversal Volume Check
  const baseCount = baseline.totalUrlsEvaluated || Object.keys(baseline.pages).length;
  const currCount = current.totalUrlsEvaluated || Object.keys(current.pages).length;
  let volumeRatioSatisfied = true;

  if (baseCount > 0 && currCount > 0) {
    const ratio = currCount / baseCount;
    if (ratio < config.comparability.minTraversalRatioForPartialComparison) {
      volumeRatioSatisfied = false;
      checks.push({
        name: "traversal_volume_ratio",
        satisfied: false,
        details: `Crawl volume ratio ${Math.round(ratio * 100)}% is below minimum partial threshold ${config.comparability.minTraversalRatioForPartialComparison * 100}%.`,
      });
      reasons.push(`Significant crawl volume drop (${currCount} vs ${baseCount} URLs).`);
      limitations.push("Mass URL disappearance must not be claimed when current volume is under partial comparison threshold.");
    } else {
      checks.push({
        name: "traversal_volume_ratio",
        satisfied: true,
        details: `Crawl volume ratio: ${Math.round(ratio * 100)}% (${currCount} vs ${baseCount} URLs).`,
      });
    }
  }

  // 6. Rule-Set Version & Semantic Signatures
  if (baseline.ruleSetVersion !== current.ruleSetVersion) {
    limitations.push(
      `Rule-set version updated from '${baseline.ruleSetVersion || "1.0.0"}' to '${current.ruleSetVersion || "1.0.0"}'. Newly introduced rules are classified as NEWLY_DETECTABLE.`
    );
  }

  // Determine overall status based on check satisfaction
  let status: ComparabilityStatus = "COMPARABLE";
  if (!domainMatch || !volumeRatioSatisfied) {
    status = "NOT_COMPARABLE";
  } else if (!currentComplete || !baselineComplete || !scopeMatch) {
    status = "PARTIALLY_COMPARABLE";
  }

  return {
    status,
    isComparable: status === "COMPARABLE" || status === "PARTIALLY_COMPARABLE",
    checks,
    reasons,
    limitations,
  };
}
