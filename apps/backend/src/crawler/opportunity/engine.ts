/**
 * Hardened Master SEO Opportunity & Prioritized Action Planning Engine.
 * Converts raw diagnostic findings, regressions, GSC performance metrics, and AEO opportunities
 * into a consolidated, prioritized, actionable execution plan with stable deduplicated identities.
 */

import {
  OpportunityType,
  SeoActionItem,
  SeoOpportunityPlan,
  GscSearchExposure,
} from "./types";
import { evaluateActionPriority } from "./priority-engine";
import { resolveActionDependencies } from "./dependency-engine";
import { evaluateQuickWin } from "./quick-win-evaluator";
import { buildTeamWorkQueues } from "./queue-router";
import { buildStableActionId, deduplicateActions } from "./deduplicator";
import { DEFAULT_OPPORTUNITY_CONFIG, OpportunityConfig } from "./config";
import { MonitoringAuditResult } from "../monitoring/types";
import { GeoAeoAuditResult } from "../ai-search/types";

export interface PlanGenerationInputs {
  projectId: string;
  monitoringResult?: MonitoringAuditResult | null;
  gscResult?: any | null;
  performanceResult?: any | null;
  geoAeoResult?: GeoAeoAuditResult | null;
  platform?: string;
  config?: OpportunityConfig;
  watchlistUrls?: string[];
}

export function generateOpportunityPlan(inputs: PlanGenerationInputs): SeoOpportunityPlan {
  const cfg = inputs.config || DEFAULT_OPPORTUNITY_CONFIG;
  const watchlistSet = new Set((inputs.watchlistUrls || []).map((u) => u.toLowerCase().replace(/\/$/, "")));

  const actionList: SeoActionItem[] = [];

  // 1. Process Systemic Regressions & Findings from Monitoring
  if (inputs.monitoringResult) {
    // Process Systemic Groups
    for (const sg of inputs.monitoringResult.systemicRegressions) {
      const gscExp = extractGscExposure(sg.affectedUrls, inputs.gscResult);
      const isNew = sg.firstObservedSnapshotId === inputs.monitoringResult.currentSnapshotId;
      const isWatchlisted = sg.affectedUrls.some((u) => watchlistSet.has(u.toLowerCase().replace(/\/$/, "")));

      const priorityRes = evaluateActionPriority({
        technicalSeverity: "high",
        ruleCode: sg.ruleCode,
        isNewRegression: isNew,
        isReopened: false,
        isSystemic: true,
        affectedUrlsCount: sg.affectedUrlsCount,
        estimatedRealEdits: sg.estimatedRealEdits,
        gscExposure: gscExp,
        opportunityType: "SYSTEMIC_TEMPLATE_FIX",
        platform: inputs.platform,
        isWatchlistedPage: isWatchlisted,
        config: cfg,
      });

      const actionId = buildStableActionId("SYS", sg.ruleCode, sg.templateOrRoutePattern);

      const action: SeoActionItem = {
        actionId,
        projectId: inputs.projectId,
        type: "SYSTEMIC_TEMPLATE_FIX",
        nature: "DETERMINISTIC_FIX",
        title: sg.title,
        description: `Resolve systemic ${sg.ruleCode} issue across ${sg.affectedUrlsCount} pages sharing template '${sg.templateOrRoutePattern}'.`,
        underlyingRuleCodes: [sg.ruleCode],
        monitoringSignals: [sg.monitoringSignalCode],
        sourceSignals: ["MONITORING_SYSTEMIC_DETECTOR"],
        affectedUrls: sg.affectedUrls,
        representativeUrls: sg.affectedUrls.slice(0, 3),
        affectedUrlsCount: sg.affectedUrlsCount,
        estimatedRealEdits: sg.estimatedRealEdits,
        technicalSeverity: "high",
        actionPriority: priorityRes.actionPriority,
        whyThisPriority: priorityRes.whyThisPriority,
        effort: priorityRes.effort,
        effortRationale: priorityRes.effortRationale,
        primaryOwner: priorityRes.primaryOwner,
        secondaryOwners: priorityRes.secondaryOwners,
        owners: priorityRes.owners,
        ownerRoutingConfidence: priorityRes.ownerRoutingConfidence,
        pageImportanceStatus: priorityRes.pageImportanceStatus,
        isWatchlistedPage: isWatchlisted,
        gscExposure: gscExp,
        isQuickWin: false,
        timelineBucket: priorityRes.timelineBucket,
        blockedByActionIds: [],
        blockingActionIds: [],
        rootCauseGroup: sg.rootCauseHypothesis,
        rootCauseConfidence: sg.rootCauseConfidence,
        whereToFix: sg.whereToFix,
        recommendedAction: sg.remediationGuidance,
        verificationInstructions: sg.verificationInstructions,
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
      };

      const qWin = evaluateQuickWin(action);
      action.isQuickWin = qWin.isQuickWin;
      action.quickWinRationale = qWin.quickWinRationale;

      actionList.push(action);
    }

    // Process Non-Systemic New & Reopened Findings
    const systemicAffectedUrls = new Set(inputs.monitoringResult.systemicRegressions.flatMap((s) => s.affectedUrls));

    for (const fc of inputs.monitoringResult.findingChanges) {
      if ((fc.lifecycle === "NEW" || fc.lifecycle === "REOPENED") && !systemicAffectedUrls.has(fc.url)) {
        const gscExp = extractGscExposure([fc.url], inputs.gscResult);
        const isWatchlisted = watchlistSet.has(fc.url.toLowerCase().replace(/\/$/, ""));

        const priorityRes = evaluateActionPriority({
          technicalSeverity: fc.technicalSeverity,
          ruleCode: fc.ruleCode,
          isNewRegression: fc.lifecycle === "NEW",
          isReopened: fc.lifecycle === "REOPENED",
          isSystemic: false,
          affectedUrlsCount: 1,
          estimatedRealEdits: 1,
          gscExposure: gscExp,
          opportunityType: fc.technicalSeverity === "critical" ? "INDEXABILITY_FIX" : "REGRESSION_FIX",
          platform: inputs.platform,
          isWatchlistedPage: isWatchlisted,
          config: cfg,
        });

        const actionId = buildStableActionId("REG", fc.ruleCode, fc.url);

        const action: SeoActionItem = {
          actionId,
          projectId: inputs.projectId,
          type: fc.technicalSeverity === "critical" ? "INDEXABILITY_FIX" : "REGRESSION_FIX",
          nature: "DETERMINISTIC_FIX",
          title: `Fix ${fc.ruleCode} on ${fc.url}`,
          description: fc.remediationSummary,
          underlyingRuleCodes: [fc.ruleCode],
          monitoringSignals: [fc.monitoringSignalCode],
          sourceSignals: ["MONITORING_DIFF_ENGINE"],
          affectedUrls: [fc.url],
          representativeUrls: [fc.url],
          affectedUrlsCount: 1,
          estimatedRealEdits: 1,
          technicalSeverity: fc.technicalSeverity,
          actionPriority: priorityRes.actionPriority,
          whyThisPriority: priorityRes.whyThisPriority,
          effort: priorityRes.effort,
          effortRationale: priorityRes.effortRationale,
          primaryOwner: priorityRes.primaryOwner,
          secondaryOwners: priorityRes.secondaryOwners,
          owners: priorityRes.owners,
          ownerRoutingConfidence: priorityRes.ownerRoutingConfidence,
          pageImportanceStatus: priorityRes.pageImportanceStatus,
          isWatchlistedPage: isWatchlisted,
          gscExposure: gscExp,
          isQuickWin: false,
          timelineBucket: priorityRes.timelineBucket,
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "Page Settings or HTML Template",
          recommendedAction: fc.remediationSummary,
          verificationInstructions: "Recrawl page to verify clean resolution.",
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
        };

        const qWin = evaluateQuickWin(action);
        action.isQuickWin = qWin.isQuickWin;
        action.quickWinRationale = qWin.quickWinRationale;

        actionList.push(action);
      }
    }
  }

  // 2. Ingest GSC Declining & CTR Opportunities
  if (inputs.gscResult) {
    for (const opp of inputs.gscResult.opportunities || []) {
      const gscExp: GscSearchExposure = {
        totalImpressions: opp.metrics.impressions,
        totalClicks: opp.metrics.clicks,
        averageCtr: opp.metrics.ctr,
        averagePosition: opp.metrics.position,
        topQueries: [{ query: opp.query || "general_traffic", impressions: opp.metrics.impressions, clicks: opp.metrics.clicks, position: opp.metrics.position }],
        dataQuality: "FRESH_COMPLETE",
        evaluatedPeriodRange: "Latest evaluated GSC window",
      };

      const oppType: OpportunityType = opp.opportunityType === "HIGH_IMPRESSION_LOW_CTR" ? "CTR_OPPORTUNITY" : "POSITION_OPPORTUNITY";
      const isWatchlisted = watchlistSet.has(opp.url.toLowerCase().replace(/\/$/, ""));

      const priorityRes = evaluateActionPriority({
        technicalSeverity: "medium",
        isNewRegression: false,
        isReopened: false,
        isSystemic: false,
        affectedUrlsCount: 1,
        estimatedRealEdits: 1,
        gscExposure: gscExp,
        opportunityType: oppType,
        platform: inputs.platform,
        isWatchlistedPage: isWatchlisted,
        config: cfg,
      });

      const actionId = buildStableActionId("GSC", oppType, opp.url);

      const action: SeoActionItem = {
        actionId,
        projectId: inputs.projectId,
        type: oppType,
        nature: "CONTENT_RECOMMENDATION", // Advisory
        title: `Optimize CTR / SERP snippet for '${opp.query || opp.url}'`,
        description: opp.recommendedAction,
        underlyingRuleCodes: [], // Growth opportunity
        monitoringSignals: [],
        sourceSignals: ["GSC_SEARCH_CONSOLE"],
        affectedUrls: [opp.url],
        representativeUrls: [opp.url],
        affectedUrlsCount: 1,
        estimatedRealEdits: 1,
        technicalSeverity: "info",
        actionPriority: priorityRes.actionPriority,
        whyThisPriority: priorityRes.whyThisPriority,
        effort: "LOW",
        effortRationale: "Title tag and meta description refinement.",
        primaryOwner: "SEO",
        secondaryOwners: ["Content"],
        owners: ["SEO", "Content"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: priorityRes.pageImportanceStatus,
        isWatchlistedPage: isWatchlisted,
        gscExposure: gscExp,
        isQuickWin: false,
        timelineBucket: priorityRes.timelineBucket,
        blockedByActionIds: [],
        blockingActionIds: [],
        whereToFix: "Page Settings → Title & Meta Description",
        recommendedAction: opp.recommendedAction,
        verificationInstructions: "Monitor GSC CTR over subsequent 14-day window.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
      };

      const qWin = evaluateQuickWin(action);
      action.isQuickWin = qWin.isQuickWin;
      action.quickWinRationale = qWin.quickWinRationale;

      actionList.push(action);
    }
  }

  // 3. Deduplicate Multi-Source Actions into Canonical Items
  const deduplicatedActions = deduplicateActions(actionList);

  // 4. Resolve Dependencies & Blocking Relationships
  const resolvedActions = resolveActionDependencies(deduplicatedActions);

  // 5. Build Segments & Team Queues
  const doNow = resolvedActions.filter((a) => a.timelineBucket === "DO_NOW" && a.actionStatus !== "BLOCKED");
  const doNext = resolvedActions.filter((a) => a.timelineBucket === "DO_NEXT" && a.actionStatus !== "BLOCKED");
  const laterOptimize = resolvedActions.filter((a) => a.timelineBucket === "LATER_OPTIMIZE" || a.actionStatus === "BLOCKED");
  const quickWins = resolvedActions.filter((a) => a.isQuickWin);
  const systemicFixes = resolvedActions.filter((a) => a.type === "SYSTEMIC_TEMPLATE_FIX");
  const teamQueues = buildTeamWorkQueues(resolvedActions);

  // 6. Calculate High-Leverage Summary (80/20 View)
  const topActions = [...resolvedActions]
    .sort((a, b) => (b.gscExposure?.totalImpressions || 0) - (a.gscExposure?.totalImpressions || 0))
    .slice(0, 5);

  const topEdits = topActions.reduce((sum, a) => sum + a.estimatedRealEdits, 0);
  const topUrls = topActions.reduce((sum, a) => sum + a.affectedUrlsCount, 0);
  const topImpressions = topActions.reduce((sum, a) => sum + (a.gscExposure?.totalImpressions || 0), 0);
  const topRawFindings = topActions.reduce((sum, a) => sum + (a.underlyingRuleCodes.length * a.affectedUrlsCount), 0);

  const totalEditsTotal = resolvedActions.reduce((sum, a) => sum + a.estimatedRealEdits, 0);
  const totalUrlsTotal = resolvedActions.reduce((sum, a) => sum + a.affectedUrlsCount, 0);
  const totalImpressionsTotal = resolvedActions.reduce((sum, a) => sum + (a.gscExposure?.totalImpressions || 0), 0);

  return {
    planId: `plan_${Date.now()}`,
    projectId: inputs.projectId,
    generatedAt: new Date().toISOString(),
    trafficPolicy: {
      selectedPolicy: cfg.siteScale,
      selectionSource: inputs.config ? "PROJECT_CONFIGURED" : "DEFAULT_FALLBACK",
      thresholdsUsed: cfg.thresholds,
    },
    summary: {
      totalActions: resolvedActions.length,
      doNowCount: doNow.length,
      doNextCount: doNext.length,
      laterOptimizeCount: laterOptimize.length,
      criticalCount: resolvedActions.filter((a) => a.actionPriority === "CRITICAL").length,
      highCount: resolvedActions.filter((a) => a.actionPriority === "HIGH").length,
      quickWinsCount: quickWins.length,
      systemicFixesCount: systemicFixes.length,
      blockedCount: resolvedActions.filter((a) => a.actionStatus === "BLOCKED").length,
      estimatedRealEditsTotal: totalEditsTotal,
      totalAffectedUrlsTotal: totalUrlsTotal,
      totalSearchExposureImpressions: totalImpressionsTotal,
    },
    eightyTwentySummary: {
      topActionCount: topActions.length,
      estimatedEdits: topEdits,
      affectedUrls: topUrls,
      gscImpressionsCovered: topImpressions,
      addressedRawFindings: Math.max(topRawFindings, topUrls),
    },
    doNowActions: doNow,
    doNextActions: doNext,
    laterOptimizeActions: laterOptimize,
    quickWins,
    systemicFixes,
    teamQueues,
    allActions: resolvedActions,
  };
}

function extractGscExposure(
  urls: string[],
  gscResult?: any | null
): GscSearchExposure | undefined {
  if (!gscResult || !gscResult.opportunities) return undefined;

  let totalImpressions = 0;
  let totalClicks = 0;
  const queries: GscSearchExposure["topQueries"] = [];

  const urlSet = new Set(urls.map((u) => u.toLowerCase().replace(/\/$/, "")));

  for (const opp of gscResult.opportunities) {
    const norm = opp.url.toLowerCase().replace(/\/$/, "");
    if (urlSet.has(norm)) {
      totalImpressions += opp.metrics.impressions;
      totalClicks += opp.metrics.clicks;
      if (opp.query) {
        queries.push({
          query: opp.query,
          impressions: opp.metrics.impressions,
          clicks: opp.metrics.clicks,
          position: opp.metrics.position,
        });
      }
    }
  }

  if (totalImpressions === 0 && totalClicks === 0) return undefined;

  return {
    totalImpressions,
    totalClicks,
    averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    averagePosition: queries.length > 0 ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length : 10,
    topQueries: queries.slice(0, 5),
    dataQuality: "FRESH_COMPLETE",
    evaluatedPeriodRange: "Evaluated GSC window",
  };
}
