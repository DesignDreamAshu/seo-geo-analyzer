/**
 * Dream SEO — AI Analysis & Executive Report Generator.
 * Constructs bounded deterministic audit context, invokes certified OpenRouter provider,
 * validates structured output, and stores report telemetry.
 */

import { nanoid } from "nanoid";
import { OpenRouterProviderAdapter } from "../observation/adapters/openrouter-adapter";
import { globalAIEntitlementService } from "../entitlement/ai-entitlement-service";
import { SqliteAiAnalysisReportRepository } from "./ai-report-persistence";
import { AIExecutiveReport, PersistedAIAnalysisRecord } from "./ai-report-types";
import { getDatabase } from "../../crawler/persistence/db";

export const AI_REPORT_SCHEMA_VERSION = "v1.0-2026.09";

export interface BoundedAuditContext {
  domain: string;
  auditRunId: string;
  crawlSummary: {
    totalCrawled: number;
    totalIndexable: number;
    totalNonIndexable: number;
    totalRedirects: number;
    totalBrokenPages: number;
    sitemapDiscovered: number;
  };
  healthScore: number;
  severityCounts: {
    critical: number;
    warnings: number;
    opportunities: number;
    notices: number;
  };
  topIssues: Array<{
    code: string;
    label: string;
    severity: string;
    affectedCount: number;
    impactCategory: string;
  }>;
  securityPosture?: {
    score: number;
    postureBand: string;
    criticalFindings: number;
    highFindings: number;
  };
  performanceCWV?: {
    mobileScore?: number;
    desktopScore?: number;
    lcp?: string;
    cls?: string;
  };
  aiSearchReadiness?: {
    brandMentionRate?: number;
    citationCoverage?: number;
  };
}

export class AIReportGenerator {
  private adapter: OpenRouterProviderAdapter;
  private repo: SqliteAiAnalysisReportRepository;

  constructor(adapter?: OpenRouterProviderAdapter, repo?: SqliteAiAnalysisReportRepository) {
    this.adapter = adapter || new OpenRouterProviderAdapter();
    this.repo = repo || new SqliteAiAnalysisReportRepository(getDatabase());
  }

  /**
   * Builds normalized bounded audit context from raw audit run data.
   */
  public buildBoundedContext(siteAudit: any, auditRunId: string, projectId: string): BoundedAuditContext {
    const inv = siteAudit.inventory || {};
    const sev = siteAudit.severityCounts || {};
    const rawIssues: any[] = siteAudit.issues || [];

    // Filter and sort top 8 most impactful deterministic issues
    const topIssues = rawIssues
      .filter((i) => i.severity === "critical" || i.severity === "warning" || i.severity === "opportunity")
      .slice(0, 8)
      .map((i) => ({
        code: i.id || i.code || "ISSUE",
        label: i.label || i.title || "Diagnostic finding",
        severity: i.severity || "warning",
        affectedCount: i.affectedPages?.length || i.affectedCount || 1,
        impactCategory: i.category || "General SEO",
      }));

    const sec = siteAudit.security?.scoreBreakdown;

    return {
      domain: siteAudit.seedUrl ? new URL(siteAudit.seedUrl).hostname : projectId,
      auditRunId,
      crawlSummary: {
        totalCrawled: inv.totalCrawled || rawIssues.length,
        totalIndexable: inv.totalIndexable || 0,
        totalNonIndexable: inv.totalNonIndexable || 0,
        totalRedirects: inv.totalRedirects || 0,
        totalBrokenPages: inv.totalBrokenPages || 0,
        sitemapDiscovered: inv.sitemapDiscoveredCount || 0,
      },
      healthScore: siteAudit.healthScore ?? 85,
      severityCounts: {
        critical: sev.critical || 0,
        warnings: sev.warnings || 0,
        opportunities: sev.opportunities || 0,
        notices: sev.notices || 0,
      },
      topIssues,
      securityPosture: sec
        ? {
            score: sec.score,
            postureBand: sec.postureBand || "Good",
            criticalFindings: sec.criticalCount || 0,
            highFindings: sec.highCount || 0,
          }
        : undefined,
    };
  }

  /**
   * Generates, validates, and persists a structured AI Executive Report.
   */
  public async generateReport(
    projectId: string,
    auditRunId: string,
    siteAudit: any,
    userId = "default_user",
    preferredModel?: string
  ): Promise<{
    success: boolean;
    record?: PersistedAIAnalysisRecord;
    error?: string;
    entitlement: any;
  }> {
    // 1. Entitlement Check
    const entitlement = await globalAIEntitlementService.checkAiReportAccess(userId, projectId);
    if (!entitlement.allowed) {
      return {
        success: false,
        error: entitlement.reason || "AI report generation entitlement denied.",
        entitlement,
      };
    }

    // 2. Build Bounded Context
    const context = this.buildBoundedContext(siteAudit, auditRunId, projectId);

    // 3. Resolve Model
    const modelToUse =
      preferredModel ||
      process.env.DREAMSEO_AI_MODEL ||
      "meta-llama/llama-3.3-70b-instruct:free";

    // 4. Construct Prompt and Schema
    const systemPrompt =
      "You are the Dream SEO Chief Technical AI Officer. You generate rigorous, high-impact executive SEO reports grounded strictly in deterministic audit evidence. Never hallucinate non-existent issues or fabricated URLs.";

    const schemaDescription = `{
  "executiveSummary": "Concise 2-3 sentence executive synopsis of overall website health, primary risk, and highest-ROI opportunity.",
  "overallAssessment": "Strategic assessment of current technical architecture and indexability.",
  "healthBand": "Strong | Moderate | Needs Attention | Critical",
  "topPriorities": [
    {
      "priority": 1,
      "title": "Clear action title",
      "reason": "Why this matters to business/traffic",
      "evidence": ["Deterministic finding summary"],
      "recommendedAction": "Exact technical step to fix",
      "expectedImpact": "High | Medium | Low",
      "difficulty": "Easy | Moderate | Complex",
      "affectedPagesCount": 5
    }
  ],
  "quickWins": [
    {
      "title": "Fast turnaround fix",
      "impact": "High | Medium",
      "action": "What to do",
      "effort": "Under 1 hour | 1-2 hours"
    }
  ],
  "structuralImprovements": [
    {
      "area": "Site Architecture / Security / Core Web Vitals",
      "observation": "What the audit revealed",
      "strategicRecommendation": "Long term structural enhancement"
    }
  ],
  "crossIssueInsights": ["Key synergy or compounding issue found across categories"],
  "implementationPlan": [
    {
      "phase": "Phase 1: Immediate Critical Fixes (Days 1-3)",
      "actions": ["Action 1", "Action 2"],
      "timeframe": "Week 1"
    }
  ],
  "limitations": ["Audit analysis is based on static and rendered crawl snapshots."]
}`;

    const userPrompt = `Generate a comprehensive Executive SEO Improvement Report for website "${context.domain}" based strictly on the following deterministic audit evidence:\n\n` +
      `AUDIT METRICS:\n` +
      `- Health Score: ${context.healthScore}/100\n` +
      `- Crawled Scope: ${context.crawlSummary.totalCrawled} pages (${context.crawlSummary.totalIndexable} indexable, ${context.crawlSummary.totalBrokenPages} broken, ${context.crawlSummary.totalRedirects} redirects)\n` +
      `- Severity Breakdown: ${context.severityCounts.critical} Critical, ${context.severityCounts.warnings} Warnings, ${context.severityCounts.opportunities} Opportunities\n` +
      (context.securityPosture ? `- Security Posture Score: ${context.securityPosture.score}/100 (${context.securityPosture.postureBand})\n` : "") +
      `\nTOP DETECTED ISSUES:\n` +
      context.topIssues.map((i, idx) => `${idx + 1}. [${i.severity.toUpperCase()}] ${i.label} (Code: ${i.code}, Scope: ${i.affectedCount} pages)`).join("\n");

    // 5. Invoke OpenRouter
    const startTime = Date.now();
    const completion = await this.adapter.executeStructuredPrompt<AIExecutiveReport>(
      userPrompt,
      schemaDescription,
      {
        model: modelToUse,
        systemPrompt,
        maxTokens: 1200,
        temperature: 0.2,
      }
    );

    const latencyMs = Date.now() - startTime;

    if (completion.status !== "SUCCESS" || !completion.data) {
      return {
        success: false,
        error: `AI provider execution failed: ${completion.failureReason || "Invalid response format"}`,
        entitlement,
      };
    }

    const reportData = completion.data;

    // Validate required keys
    if (!reportData.executiveSummary || !Array.isArray(reportData.topPriorities)) {
      return {
        success: false,
        error: "AI provider output failed schema validation (missing executiveSummary or topPriorities).",
        entitlement,
      };
    }

    // 6. Deduct credits / record entitlement
    const usage = completion.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    await globalAIEntitlementService.consumeAiReportCredits(userId, {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });

    // 7. Persist Report Record
    const record: PersistedAIAnalysisRecord = {
      reportId: `ai_rep_${nanoid(12)}`,
      projectId,
      auditRunId,
      generatedAt: new Date().toISOString(),
      provider: "OPENROUTER",
      gateway: "OpenRouter",
      requestedModel: modelToUse,
      resolvedModel: completion.resolvedModel || modelToUse,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: 0.0, // Free model default
      latencyMs,
      entitlementSource: entitlement.source,
      creditsConsumed: entitlement.creditsConsumed,
      generationStatus: "COMPLETED",
      schemaVersion: AI_REPORT_SCHEMA_VERSION,
      report: reportData,
      createdAt: new Date().toISOString(),
    };

    this.repo.saveReport(record);

    return {
      success: true,
      record,
      entitlement,
    };
  }

  /**
   * Retrieves latest report and verifies freshness against latest audit run.
   */
  public getLatestReportStatus(
    projectId: string,
    currentAuditRunId?: string
  ): {
    hasReport: boolean;
    record: PersistedAIAnalysisRecord | null;
    isStale: boolean;
    currentAuditRunId?: string;
    reportAuditRunId?: string;
  } {
    const record = this.repo.getLatestReportForProject(projectId);
    if (!record) {
      return { hasReport: false, record: null, isStale: false, currentAuditRunId };
    }

    const isStale = Boolean(currentAuditRunId && record.auditRunId !== currentAuditRunId);
    return {
      hasReport: true,
      record,
      isStale,
      currentAuditRunId,
      reportAuditRunId: record.auditRunId,
    };
  }
}
