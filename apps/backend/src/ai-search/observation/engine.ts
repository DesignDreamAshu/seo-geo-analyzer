/**
 * Phase 28D: Live AI Visibility Observation Orchestration Engine.
 * Manages provider adapters, stochastic sampling, batch execution, and aggregation metrics.
 */

import { nanoid } from "nanoid";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptCandidate, PromptUniverseReport } from "../prompts/types";
import {
  AIObservation,
  AIProviderId,
  ObservationRunConfig,
  ObservationRunSummary,
  PromptObservationSummary,
  ProviderCapability,
  AI_OBSERVATION_EXTRACTOR_VERSION,
} from "./types";
import { AIObservationProvider } from "./adapters/provider-adapter";
import { OpenAIProviderAdapter } from "./adapters/openai-adapter";
import { GeminiProviderAdapter } from "./adapters/gemini-adapter";
import { PerplexityProviderAdapter } from "./adapters/perplexity-adapter";
import { ManualImportProviderAdapter, ManualImportPayload } from "./adapters/manual-import-adapter";
import { extractObservationIntelligence } from "./extractor";
import { SqliteObservationRepository } from "./persistence/sqlite-observation-repo";
import { getDatabase } from "../../crawler/persistence/db";

export class AIVisibilityObservationEngine {
  private providers = new Map<AIProviderId, AIObservationProvider>();
  private repo: SqliteObservationRepository;

  constructor() {
    this.repo = new SqliteObservationRepository(getDatabase());
    this.registerProvider(new OpenAIProviderAdapter());
    this.registerProvider(new GeminiProviderAdapter());
    this.registerProvider(new PerplexityProviderAdapter());
    this.registerProvider(new ManualImportProviderAdapter());
  }

  public registerProvider(adapter: AIObservationProvider): void {
    this.providers.set(adapter.providerId, adapter);
  }

  public getProviderCapabilities(): ProviderCapability[] {
    return Array.from(this.providers.values()).map((p) => p.getCapabilities());
  }

  public estimateObservationRequests(
    config: ObservationRunConfig,
    availablePrompts: PromptCandidate[]
  ): {
    eligiblePromptsCount: number;
    activeProvidersCount: number;
    runsPerPrompt: number;
    totalEstimatedRequests: number;
  } {
    const prompts = this.filterPrompts(config, availablePrompts);
    const runsPerPrompt = config.runsPerPrompt || (config.samplingMode === "HIGH_CONFIDENCE" ? 5 : config.samplingMode === "STANDARD" ? 3 : 1);
    const providersCount = config.providers.length;

    return {
      eligiblePromptsCount: prompts.length,
      activeProvidersCount: providersCount,
      runsPerPrompt,
      totalEstimatedRequests: prompts.length * providersCount * runsPerPrompt,
    };
  }

  public async executeObservationRun(
    config: ObservationRunConfig,
    profile: ProjectKnowledgeProfile,
    promptUniverse: PromptUniverseReport,
    onProgress?: (completed: number, total: number) => void
  ): Promise<ObservationRunSummary> {
    const runId = `obs_run_${nanoid(10)}`;
    const prompts = this.filterPrompts(config, promptUniverse.allCandidates);
    const runsPerPrompt = config.runsPerPrompt || (config.samplingMode === "HIGH_CONFIDENCE" ? 5 : config.samplingMode === "STANDARD" ? 3 : 1);
    const totalPlanned = prompts.length * config.providers.length * runsPerPrompt;

    const runSummary: ObservationRunSummary = {
      runId,
      projectId: config.projectId,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      completedAt: null,
      config,
      knowledgeProfileVersion: profile.methodologyVersion,
      promptUniverseVersion: promptUniverse.methodologyVersion,
      totalPlannedObservations: totalPlanned,
      completedObservations: 0,
      successfulObservations: 0,
      failedObservations: 0,
      overallBrandMentionRate: 0.0,
      unbrandedBrandMentionRate: 0.0,
      brandedBrandMentionRate: 0.0,
      ownDomainCitationRate: 0.0,
      activeProviders: config.providers,
      promptSummaries: [],
    };

    this.repo.createObservationRun(runSummary);

    const observations: AIObservation[] = [];
    let completedCount = 0;

    for (const prompt of prompts) {
      for (const providerId of config.providers) {
        const adapter = this.providers.get(providerId);

        for (let runNum = 1; runNum <= runsPerPrompt; runNum++) {
          const obsId = `obs_${nanoid(12)}`;
          const now = new Date().toISOString();

          if (!adapter || !adapter.isConfigured()) {
            const unconfiguredObs: AIObservation = {
              observationId: obsId,
              runId,
              projectId: config.projectId,
              promptId: prompt.id,
              clusterId: prompt.clusterId,
              promptText: prompt.prompt,
              promptType: prompt.promptType,
              intent: prompt.intents[0] || "INFORMATIONAL",
              funnelStage: prompt.funnelStage,
              specificity: prompt.specificity,
              brandedness: prompt.brandedness,
              providerId,
              model: adapter?.getCapabilities().defaultModel || "unknown",
              runNumber: runNum,
              totalRunsPlanned: runsPerPrompt,
              status: "PROVIDER_NOT_CONFIGURED",
              failureReason: `${providerId} credentials or API key not configured in environment.`,
              brandMentioned: false,
              brandMentionCount: 0,
              brandMentions: [],
              competitorsMentioned: [],
              citations: [],
              ownDomainCited: false,
              ownDomainCitationCount: 0,
              extractorVersion: AI_OBSERVATION_EXTRACTOR_VERSION,
              observedAt: now,
            };
            observations.push(unconfiguredObs);
            this.repo.saveObservation(unconfiguredObs);
            completedCount++;
            if (onProgress) onProgress(completedCount, totalPlanned);
            continue;
          }

          // Execute genuine provider call
          const execRes = await adapter.executePrompt(prompt.prompt, {
            country: config.country,
            language: config.language,
          });

          if (execRes.status !== "SUCCESS" || !execRes.response) {
            const failedObs: AIObservation = {
              observationId: obsId,
              runId,
              projectId: config.projectId,
              promptId: prompt.id,
              clusterId: prompt.clusterId,
              promptText: prompt.prompt,
              promptType: prompt.promptType,
              intent: prompt.intents[0] || "INFORMATIONAL",
              funnelStage: prompt.funnelStage,
              specificity: prompt.specificity,
              brandedness: prompt.brandedness,
              providerId,
              model: adapter.getCapabilities().defaultModel,
              runNumber: runNum,
              totalRunsPlanned: runsPerPrompt,
              status: execRes.status,
              failureReason: execRes.failureReason || "Provider execution failed",
              brandMentioned: false,
              brandMentionCount: 0,
              brandMentions: [],
              competitorsMentioned: [],
              citations: [],
              ownDomainCited: false,
              ownDomainCitationCount: 0,
              extractorVersion: AI_OBSERVATION_EXTRACTOR_VERSION,
              observedAt: now,
            };
            observations.push(failedObs);
            this.repo.saveObservation(failedObs);
          } else {
            // Extract structured evidence with multi-signal entity attribution
            const extraction = extractObservationIntelligence(
              prompt.prompt,
              execRes.response.rawText,
              execRes.response.citations,
              profile.brand,
              profile.competitors,
              profile.domain,
              profile
            );

            const successObs: AIObservation = {
              observationId: obsId,
              runId,
              projectId: config.projectId,
              promptId: prompt.id,
              clusterId: prompt.clusterId,
              promptText: prompt.prompt,
              promptType: prompt.promptType,
              intent: prompt.intents[0] || "INFORMATIONAL",
              funnelStage: prompt.funnelStage,
              specificity: prompt.specificity,
              brandedness: prompt.brandedness,
              providerId,
              model: execRes.response.model,
              configuredModel: execRes.response.configuredModel || "gemini-3.5-flash",
              requestedModel: execRes.response.requestedModel || execRes.response.model,
              providerConfirmedModel: execRes.response.providerConfirmedModel ?? null,
              runNumber: runNum,
              totalRunsPlanned: runsPerPrompt,
              status: "SUCCESS",
              rawResponse: execRes.response.rawText,
              normalizedResponse: execRes.response.normalizedText,
              responseHash: execRes.response.responseHash,
              stringMentionDetected: extraction.stringMentionDetected,
              entityAttribution: extraction.entityAttribution,
              requestedGrounding: execRes.response.requestedGrounding ?? true,
              groundingState: execRes.response.groundingState || (execRes.response.isGroundingActive ? "GROUNDING_ACTIVE" : "GROUNDING_NOT_ACTIVE"),
              fallbackUsed: execRes.response.fallbackUsed ?? false,
              fallbackReason: execRes.response.fallbackReason ?? null,
              brandMentioned: extraction.brandMentioned,
              brandMentionCount: extraction.brandMentionCount,
              brandRecommendationOrder: extraction.brandRecommendationOrder,
              brandMentions: extraction.brandMentions,
              competitorsMentioned: extraction.competitorsMentioned,
              citations: extraction.citations,
              ownDomainCited: extraction.ownDomainCited,
              ownDomainCitationCount: extraction.ownDomainCitationCount,
              extractorVersion: extraction.extractorVersion,
              observedAt: now,
            };
            observations.push(successObs);
            this.repo.saveObservation(successObs);
          }

          completedCount++;
          if (onProgress) onProgress(completedCount, totalPlanned);
        }
      }
    }

    // Compute aggregation metrics
    const summaries = this.aggregateObservationMetrics(observations, promptUniverse);
    const successfulObs = observations.filter((o) => o.status === "SUCCESS");
    const failedObs = observations.filter((o) => o.status !== "SUCCESS");

    const totalSuccessful = successfulObs.length;
    const brandMentionedCount = successfulObs.filter((o) => o.brandMentioned).length;
    const ownDomainCitedCount = successfulObs.filter((o) => o.ownDomainCited).length;

    const unbrandedSuccess = successfulObs.filter((o) => o.brandedness === "UNBRANDED");
    const unbrandedMentions = unbrandedSuccess.filter((o) => o.brandMentioned).length;

    const brandedSuccess = successfulObs.filter((o) => o.brandedness === "BRANDED");
    const brandedMentions = brandedSuccess.filter((o) => o.brandMentioned).length;

    runSummary.completedObservations = completedCount;
    runSummary.successfulObservations = totalSuccessful;
    runSummary.failedObservations = failedObs.length;
    runSummary.status = totalSuccessful > 0 ? "COMPLETED" : "FAILED";
    runSummary.completedAt = new Date().toISOString();
    runSummary.overallBrandMentionRate = totalSuccessful > 0 ? brandMentionedCount / totalSuccessful : 0.0;
    runSummary.unbrandedBrandMentionRate = unbrandedSuccess.length > 0 ? unbrandedMentions / unbrandedSuccess.length : 0.0;
    runSummary.brandedBrandMentionRate = brandedSuccess.length > 0 ? brandedMentions / brandedSuccess.length : 1.0;
    runSummary.ownDomainCitationRate = totalSuccessful > 0 ? ownDomainCitedCount / totalSuccessful : 0.0;
    runSummary.promptSummaries = summaries;

    this.repo.updateObservationRun(runId, runSummary);
    return runSummary;
  }

  public importManualObservation(
    payload: ManualImportPayload,
    profile: ProjectKnowledgeProfile,
    matchedPrompt?: PromptCandidate
  ): AIObservation {
    const adapter = this.providers.get("MANUAL_IMPORT") as ManualImportProviderAdapter;
    const importRes = adapter.importResponse(payload);

    const extraction = extractObservationIntelligence(
      payload.promptText,
      payload.responseText,
      importRes.response?.citations || [],
      profile.brand,
      profile.competitors,
      profile.domain
    );

    const now = payload.observedAt || new Date().toISOString();
    const runId = `run_manual_${nanoid(8)}`;

    // Ensure parent project and run exist to satisfy FK constraints
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT OR IGNORE INTO projects (
          project_id, name, primary_domain, normalized_domain, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        profile.projectId,
        profile.brand.name || "Default Project",
        profile.domain || "example.com",
        profile.domain || "example.com",
        now,
        now
      );

      this.repo.createObservationRun({
        runId,
        projectId: profile.projectId,
        status: "COMPLETED",
        startedAt: now,
        completedAt: now,
        config: {
          projectId: profile.projectId,
          promptTier: "SELECTED_PROMPTS",
          providers: ["MANUAL_IMPORT"],
          samplingMode: "QUICK",
          runsPerPrompt: 1,
          country: "US",
          language: "en",
        },
        knowledgeProfileVersion: profile.methodologyVersion,
        promptUniverseVersion: "v28c-1.0",
        totalPlannedObservations: 1,
        completedObservations: 1,
        successfulObservations: 1,
        failedObservations: 0,
        overallBrandMentionRate: extraction.brandMentioned ? 1.0 : 0.0,
        unbrandedBrandMentionRate: extraction.brandMentioned ? 1.0 : 0.0,
        brandedBrandMentionRate: 1.0,
        ownDomainCitationRate: extraction.ownDomainCited ? 1.0 : 0.0,
        activeProviders: ["MANUAL_IMPORT"],
        promptSummaries: [],
      });
    } catch {
      // Ignore
    }

    const obs: AIObservation = {
      observationId: `obs_man_${nanoid(12)}`,
      runId,
      projectId: profile.projectId,
      promptId: matchedPrompt?.id || `prm_man_${nanoid(8)}`,
      clusterId: matchedPrompt?.clusterId || "cls_manual",
      promptText: payload.promptText,
      promptType: matchedPrompt?.promptType || "CATEGORY_DISCOVERY",
      intent: matchedPrompt?.intents[0] || "VENDOR_DISCOVERY",
      funnelStage: matchedPrompt?.funnelStage || "CONSIDERATION",
      specificity: matchedPrompt?.specificity || "MID",
      brandedness: matchedPrompt?.brandedness || (payload.promptText.toLowerCase().includes(profile.brand.name.toLowerCase()) ? "BRANDED" : "UNBRANDED"),
      providerId: "MANUAL_IMPORT",
      model: payload.sourceEngineName || "manual-web-entry",
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "SUCCESS",
      rawResponse: payload.responseText,
      normalizedResponse: payload.responseText.trim(),
      responseHash: importRes.response?.responseHash,
      brandMentioned: extraction.brandMentioned,
      brandMentionCount: extraction.brandMentionCount,
      brandRecommendationOrder: extraction.brandRecommendationOrder,
      brandMentions: extraction.brandMentions,
      competitorsMentioned: extraction.competitorsMentioned,
      citations: extraction.citations,
      ownDomainCited: extraction.ownDomainCited,
      ownDomainCitationCount: extraction.ownDomainCitationCount,
      extractorVersion: extraction.extractorVersion,
      observedAt: now,
    };

    this.repo.saveObservation(obs);
    return obs;
  }

  public getObservationRuns(projectId: string, limit: number = 20): ObservationRunSummary[] {
    return this.repo.listObservationRuns(projectId, limit);
  }

  public getObservationsForRun(runId: string): AIObservation[] {
    return this.repo.getObservationsForRun(runId);
  }

  public getObservationsForProject(projectId: string, limit: number = 500): AIObservation[] {
    return this.repo.getObservationsForProject(projectId, limit);
  }

  private filterPrompts(
    config: ObservationRunConfig,
    allPrompts: PromptCandidate[]
  ): PromptCandidate[] {
    if (config.promptTier === "SELECTED_PROMPTS" && config.selectedPromptIds?.length) {
      const idSet = new Set(config.selectedPromptIds);
      return allPrompts.filter((p) => idSet.has(p.id));
    }
    if (config.selectedClusterIds?.length) {
      const clsSet = new Set(config.selectedClusterIds);
      return allPrompts.filter((p) => clsSet.has(p.clusterId));
    }
    if (config.promptTier === "TIER_1") {
      return allPrompts.filter((p) => p.monitoringTier === "TIER_1_CORE" || p.isPinned);
    }
    if (config.promptTier === "TIER_2") {
      return allPrompts.filter((p) => p.monitoringTier === "TIER_1_CORE" || p.monitoringTier === "TIER_2_EXPANDED" || p.isPinned);
    }
    return allPrompts;
  }

  private aggregateObservationMetrics(
    observations: AIObservation[],
    promptUniverse: PromptUniverseReport
  ): PromptObservationSummary[] {
    const map = new Map<string, AIObservation[]>();
    for (const obs of observations) {
      if (!map.has(obs.promptId)) map.set(obs.promptId, []);
      map.get(obs.promptId)!.push(obs);
    }

    const clusterMap = new Map<string, string>();
    for (const cl of promptUniverse.clusters) {
      clusterMap.set(cl.id, cl.name);
    }

    const summaries: PromptObservationSummary[] = [];

    for (const [promptId, obsList] of map.entries()) {
      const first = obsList[0];
      const successful = obsList.filter((o) => o.status === "SUCCESS");
      const failed = obsList.filter((o) => o.status !== "SUCCESS");
      const brandMentionedObs = successful.filter((o) => o.brandMentioned);
      const ownDomainCitedObs = successful.filter((o) => o.ownDomainCited);

      // Average recommendation order
      const orders = brandMentionedObs.map((o) => o.brandRecommendationOrder).filter((ord): ord is number => ord !== null && ord !== undefined);
      const avgOrder = orders.length > 0 ? Number((orders.reduce((a, b) => a + b, 0) / orders.length).toFixed(1)) : null;

      // Top observed competitors
      const compFreq = new Map<string, number>();
      for (const obs of successful) {
        for (const comp of obs.competitorsMentioned) {
          compFreq.set(comp.competitorName, (compFreq.get(comp.competitorName) || 0) + 1);
        }
      }
      const topCompetitors = Array.from(compFreq.entries())
        .map(([name, frequency]) => ({ name, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);

      // Top cited domains
      const domFreq = new Map<string, { count: number; isOwnDomain: boolean }>();
      for (const obs of successful) {
        for (const cit of obs.citations) {
          if (!domFreq.has(cit.domain)) domFreq.set(cit.domain, { count: 0, isOwnDomain: cit.isOwnDomain });
          domFreq.get(cit.domain)!.count++;
        }
      }
      const topCitedDomains = Array.from(domFreq.entries())
        .map(([domain, data]) => ({ domain, frequency: data.count, isOwnDomain: data.isOwnDomain }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);

      // Provider breakdown
      const providerBreakdown: PromptObservationSummary["providerBreakdown"] = {};
      for (const obs of obsList) {
        if (!providerBreakdown[obs.providerId]) {
          providerBreakdown[obs.providerId] = { runs: 0, mentions: 0, mentionRate: 0, citations: 0, citationRate: 0 };
        }
        const b = providerBreakdown[obs.providerId];
        b.runs++;
        if (obs.status === "SUCCESS") {
          if (obs.brandMentioned) b.mentions++;
          if (obs.ownDomainCited) b.citations++;
        }
      }
      for (const pKey of Object.keys(providerBreakdown)) {
        const b = providerBreakdown[pKey];
        b.mentionRate = b.runs > 0 ? Number((b.mentions / b.runs).toFixed(2)) : 0;
        b.citationRate = b.runs > 0 ? Number((b.citations / b.runs).toFixed(2)) : 0;
      }

      summaries.push({
        promptId,
        promptText: first.promptText,
        clusterId: first.clusterId,
        clusterName: clusterMap.get(first.clusterId) || "General",
        brandedness: first.brandedness,
        promptType: first.promptType,
        intent: first.intent,
        funnelStage: first.funnelStage,
        totalObservationsPlanned: obsList.length,
        successfulObservations: successful.length,
        failedObservations: failed.length,
        brandMentionCount: brandMentionedObs.length,
        brandMentionRate: successful.length > 0 ? Number((brandMentionedObs.length / successful.length).toFixed(2)) : 0,
        averageRecommendationOrder: avgOrder,
        ownDomainCitationCount: ownDomainCitedObs.length,
        ownDomainCitationRate: successful.length > 0 ? Number((ownDomainCitedObs.length / successful.length).toFixed(2)) : 0,
        topObservedCompetitors: topCompetitors,
        topCitedDomains,
        providerBreakdown,
        latestObservationAt: obsList[obsList.length - 1].observedAt,
      });
    }

    return summaries;
  }
}

export const globalAIObservationEngine = new AIVisibilityObservationEngine();
