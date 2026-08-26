/**
 * Phase 28J: Competitor AI Intelligence & Benchmarking Engine.
 * Evaluates PROMPT × INTENT × PAGE × EVIDENCE competitive dynamics.
 * Strictly prevents keyword-count or word-count superiority fallacies.
 */

import { nanoid } from "nanoid";
import {
  AICompetitiveBenchmarkSnapshot,
  ProjectCompetitor,
  CompetitorCorpusSummary,
  PromptCompetitiveDetail,
  PromptCompetitiveState,
  PromptOwnership,
  CompetitiveAdvantageEvidence,
  CompetitorPageMatch,
  IntentCompetitiveSummary,
  CompetitiveOpportunity,
  ClientAdvantageRecord,
  OpportunityType,
  OpportunityActionType,
  COMPETITIVE_ENGINE_VERSION,
} from "./types";
import { AIMeasurementSnapshot } from "../measurement/types";
import { PromptPageMapper, CrawledPageContext } from "../optimization/mapper";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptCandidate, PromptUniverseReport } from "../prompts/types";
import { AIObservation } from "../observation/types";
import { validateCompetitiveInvariants } from "./invariants";
import { computeCompetitiveFingerprint } from "./fingerprint";

export interface CompetitorEvaluationContext {
  competitor: ProjectCompetitor;
  corpusSummary: CompetitorCorpusSummary;
  pages: CrawledPageContext[];
  profile: ProjectKnowledgeProfile;
}

export class AICompetitiveIntelligenceEngine {
  private mapper = new PromptPageMapper();

  public generateCompetitiveBenchmark(
    projectId: string,
    clientMeasurementSnapshot: AIMeasurementSnapshot,
    clientProfile: ProjectKnowledgeProfile,
    promptUniverse: PromptUniverseReport,
    clientPages: CrawledPageContext[],
    competitorContexts: CompetitorEvaluationContext[],
    observations: AIObservation[] = []
  ): AICompetitiveBenchmarkSnapshot {
    const rawPrompts: PromptCandidate[] =
      promptUniverse.allCandidates || promptUniverse.monitoringSet || (promptUniverse as any).prompts || [];

    const promptComparisons: PromptCompetitiveDetail[] = [];
    const opportunities: CompetitiveOpportunity[] = [];
    const clientAdvantages: ClientAdvantageRecord[] = [];

    let clientAdvCount = 0;
    let compAdvCount = 0;
    let parityCount = 0;
    let bothWeakCount = 0;
    let highPriorityGaps = 0;

    // Track pages for opportunity consolidation
    const pageGapMap = new Map<
      string,
      {
        pageUrl: string;
        prompts: Array<{ id: string; text: string; intent: string; priority: "HIGH" | "MEDIUM" | "LOW" }>;
        competitorRefs: Array<{ competitorName: string; referenceUrl: string | null; observedAdvantage: string }>;
        missingDimensions: Set<string>;
      }
    >();

    // 1. Evaluate Each Prompt in Universe
    for (const prompt of rawPrompts) {
      // A. Client Mapping
      const clientDetail = clientMeasurementSnapshot.promptDetails.find((p) => p.promptId === prompt.id);
      const clientLevel = clientDetail?.coverageLevel || "INSUFFICIENT_EVIDENCE";
      const clientUrl = clientDetail?.targetPageUrl || null;
      const clientConf = clientDetail?.mappingConfidence || "LOW";

      // B. Competitor Mappings
      const competitorMatches: CompetitorPageMatch[] = [];

      for (const compCtx of competitorContexts) {
        if (compCtx.competitor.status !== "ACTIVE") continue;

        const compMapping = this.mapper.mapSinglePrompt(prompt, compCtx.pages, compCtx.profile);

        let compCoverage = "WEAK";
        if (compMapping.coverageState === "STRONG_MATCH" && compMapping.answerCoverage === "COVERED") {
          compCoverage = "STRONG";
        } else if (compMapping.coverageState === "STRONG_MATCH" || compMapping.answerCoverage === "COVERED") {
          compCoverage = "ADEQUATE";
        } else if (compMapping.coverageState === "PARTIAL_MATCH") {
          compCoverage = "PARTIAL";
        } else if (compMapping.coverageState === "NO_TARGET_PAGE") {
          compCoverage = "UNSERVED";
        }

        competitorMatches.push({
          competitorId: compCtx.competitor.competitorId,
          competitorName: compCtx.competitor.displayName,
          competitorDomain: compCtx.competitor.domain,
          coverageState: compCoverage,
          bestPageUrl: compMapping.targetPageUrl,
          bestPageTitle: compMapping.targetPageUrl,
          mappingConfidence: compMapping.mappingConfidence,
          answerCoverage: compMapping.answerCoverage,
          evidenceSummary: compMapping.notes,
        });
      }

      // C. Determine Competitive State & Advantage Evidence
      const clientScore = this.getCoverageScore(clientLevel);
      const topCompetitor = competitorMatches.sort((a, b) => this.getCoverageScore(b.coverageState) - this.getCoverageScore(a.coverageState))[0];
      const compScore = topCompetitor ? this.getCoverageScore(topCompetitor.coverageState) : 0;

      let competitiveState: PromptCompetitiveState = "ROUGH_PARITY";
      let ownership: PromptOwnership = "PARITY";
      let winner: "CLIENT" | "COMPETITOR" | "NEITHER" = "NEITHER";
      const reasons: string[] = [];

      const promptPriority =
        prompt.monitoringTier === "TIER_1_CORE" ? "HIGH" : prompt.priorityScore && prompt.priorityScore > 75 ? "HIGH" : "MEDIUM";

      if (competitorMatches.length === 0) {
        if (clientScore >= 3) {
          competitiveState = "CLIENT_ADVANTAGE";
          ownership = "CLIENT";
          winner = "CLIENT";
          clientAdvCount++;
          reasons.push(`Client provides dedicated content satisfying "${prompt.intents[0] || "intent"}".`);
        } else {
          competitiveState = "INSUFFICIENT_EVIDENCE";
          ownership = "INSUFFICIENT_EVIDENCE";
        }
      } else if (clientScore <= 2 && compScore <= 2) {
        // Both sites lack adequate content
        competitiveState = "BOTH_WEAK";
        ownership = "NO_CLEAR_OWNER";
        bothWeakCount++;
        reasons.push("Neither client nor analyzed competitors adequately satisfy this discovery query.");
      } else if (clientScore >= 3 && compScore >= 3 && Math.abs(clientScore - compScore) === 0) {
        // Genuine parity between two substantial content sources
        competitiveState = "ROUGH_PARITY";
        ownership = "PARITY";
        parityCount++;
        reasons.push("Client and competitors demonstrate equivalent semantic coverage depth.");
      } else if (clientScore > compScore) {
        // Client leads
        competitiveState = "CLIENT_ADVANTAGE";
        ownership = "CLIENT";
        winner = "CLIENT";
        clientAdvCount++;
        reasons.push(`Client provides superior content depth (${clientLevel}) satisfying "${prompt.intents[0] || "intent"}".`);
        if (topCompetitor) {
          reasons.push(`Competitor (${topCompetitor.competitorName}) only has ${topCompetitor.coverageState} coverage.`);
        }
      } else if (compScore > clientScore) {
        // Competitor leads
        competitiveState = "COMPETITOR_ADVANTAGE";
        ownership = "COMPETITOR";
        winner = "COMPETITOR";
        compAdvCount++;
        if (promptPriority === "HIGH") highPriorityGaps++;
        reasons.push(`Competitor (${topCompetitor?.competitorName || "Competitor"}) provides superior content depth (${topCompetitor?.coverageState || "STRONG"}) for "${prompt.intents[0]}".`);
        reasons.push(`Client only provides ${clientLevel} coverage.`);

        // Record for opportunity consolidation
        const targetKey = clientUrl || "NO_TARGET_PAGE";
        if (!pageGapMap.has(targetKey)) {
          pageGapMap.set(targetKey, {
            pageUrl: targetKey,
            prompts: [],
            competitorRefs: [],
            missingDimensions: new Set(),
          });
        }
        const gapGroup = pageGapMap.get(targetKey)!;
        gapGroup.prompts.push({
          id: prompt.id,
          text: prompt.prompt,
          intent: prompt.intents[0] || "INFORMATIONAL",
          priority: promptPriority,
        });
        if (topCompetitor) {
          gapGroup.competitorRefs.push({
            competitorName: topCompetitor.competitorName,
            referenceUrl: topCompetitor.bestPageUrl,
            observedAdvantage: `${topCompetitor.competitorName} provides structured ${topCompetitor.answerCoverage} guidance.`,
          });
        }
        gapGroup.missingDimensions.add(prompt.intents[0] || "INFORMATIONAL");
      } else {
        competitiveState = "ROUGH_PARITY";
        ownership = "PARITY";
        parityCount++;
        reasons.push("Client and competitors demonstrate comparable semantic coverage.");
      }

      const advantageEvidence: CompetitiveAdvantageEvidence = {
        winner,
        reasons,
        dimensions: {
          intentSatisfaction: winner === "CLIENT" ? "Client provides direct alignment" : winner === "COMPETITOR" ? "Competitor provides direct alignment" : "Parity",
          answerCoverage: clientDetail?.answerCoverage || "UNCLEAR",
          contentSpecificity: clientScore >= 4 ? "Specific" : "Generic / Broad",
          evidenceSupport: "Observed on-page evidence",
          targetingClarity: clientDetail?.pageTargetingState || "CLEAR_PRIMARY_TARGET",
          citationReadiness: "Factual first-party claims",
        },
      };

      promptComparisons.push({
        promptId: prompt.id,
        promptText: prompt.prompt,
        priority: promptPriority,
        intent: prompt.intents[0] || "INFORMATIONAL",
        clientState: clientLevel,
        clientBestPageUrl: clientUrl,
        clientMappingConfidence: clientConf,
        competitorMatches,
        competitiveState,
        ownership,
        winningCompetitorName: winner === "COMPETITOR" ? topCompetitor?.competitorName : null,
        advantageEvidence,
      });
    }

    // 2. Generate Consolidated Opportunities (Anti-Duplication & Anti-Copying)
    let oppCounter = 1;
    for (const [targetKey, gapGroup] of pageGapMap.entries()) {
      const isExistingPage = targetKey !== "NO_TARGET_PAGE";
      const hasHighPriority = gapGroup.prompts.some((p) => p.priority === "HIGH");

      const actionType: OpportunityActionType = isExistingPage
        ? gapGroup.missingDimensions.has("HOW_TO") || gapGroup.missingDimensions.has("EVALUATION")
          ? "CREATE_SUPPORTING_CONTENT"
          : "IMPROVE_EXISTING_PAGE"
        : "CREATE_NEW_TARGET_PAGE";

      const oppType: OpportunityType = gapGroup.missingDimensions.has("HOW_TO")
        ? "INTENT_COVERAGE_GAP"
        : isExistingPage
        ? "ANSWER_DEPTH_GAP"
        : "PROMPT_COVERAGE_GAP";

      const dims = Array.from(gapGroup.missingDimensions).join(", ");
      const sampleCompetitor = gapGroup.competitorRefs[0];

      opportunities.push({
        opportunityId: `opp_${nanoid(8)}`,
        type: oppType,
        priority: hasHighPriority ? "HIGH" : "MEDIUM",
        actionType,
        title: isExistingPage
          ? `Enrich ${dims} Depth on ${targetKey.replace(/^https?:\/\/[^\/]+/, "")}`
          : `Publish Dedicated Target Page for ${dims} Discovery Queries`,
        clientTargetPageUrl: isExistingPage ? targetKey : null,
        affectedPrompts: gapGroup.prompts,
        competitorReferences: gapGroup.competitorRefs.slice(0, 3),
        observedGap: `${sampleCompetitor?.competitorName || "Competitors"} provide structured ${dims} guidance which is currently missing or generic on client site.`,
        strategicRationale: `Directly answers ${gapGroup.prompts.length} high-intent queries where competitors currently win synthesis visibility.`,
        recommendedChange: isExistingPage
          ? `Add an explicit evaluation framework, procedural steps, and first-party case study links to ${targetKey}.`
          : `Create a dedicated solution guide covering ${dims} criteria with original methodology.`,
        copySafetyWarning:
          "Do NOT copy competitor wording or structure. Synthesize original first-party capabilities and verified case proof.",
        verificationMethod: isExistingPage
          ? `Re-crawl ${targetKey} and verify prompt mapping coverage reaches STRONG.`
          : `Crawl newly published page and confirm mapper associates target queries with >80% confidence.`,
      });
      oppCounter++;
    }

    // 3. Extract Client Advantage Records (Preservation Guidance)
    const clientAdvantagePrompts = promptComparisons.filter((p) => p.competitiveState === "CLIENT_ADVANTAGE");
    const clientAdvMap = new Map<string, Array<{ id: string; text: string; intent: string }>>();

    for (const p of clientAdvantagePrompts) {
      const url = p.clientBestPageUrl || "Site-Wide";
      if (!clientAdvMap.has(url)) clientAdvMap.set(url, []);
      clientAdvMap.get(url)!.push({ id: p.promptId, text: p.promptText, intent: p.intent });
    }

    for (const [url, prompts] of clientAdvMap.entries()) {
      clientAdvantages.push({
        advantageId: `adv_${nanoid(8)}`,
        clientTargetPageUrl: url,
        clientPageTitle: url,
        affectedPrompts: prompts,
        advantageType: "DEDICATED_INTENT_AUTHORITY",
        whyClientWins: `Client provides dedicated, comprehensive answer structure for ${prompts.length} queries while competitors offer only surface-level positioning.`,
        preservationGuidance: `Preserve core headings, service definitions, and case study proof blocks on ${url} during upcoming site updates.`,
      });
    }

    // 4. Compute Intent-Level Summaries
    const intentMap = new Map<string, PromptCompetitiveDetail[]>();
    for (const p of promptComparisons) {
      if (!intentMap.has(p.intent)) intentMap.set(p.intent, []);
      intentMap.get(p.intent)!.push(p);
    }

    const intentComparisons: IntentCompetitiveSummary[] = [];
    for (const [intentFamily, list] of intentMap.entries()) {
      const cAdv = list.filter((p) => p.competitiveState === "CLIENT_ADVANTAGE" || p.competitiveState === "CLIENT_ONLY").length;
      const compAdv = list.filter((p) => p.competitiveState === "COMPETITOR_ADVANTAGE" || p.competitiveState === "COMPETITOR_ONLY").length;
      const parity = list.filter((p) => p.competitiveState === "ROUGH_PARITY").length;
      const bothWeak = list.filter((p) => p.competitiveState === "BOTH_WEAK").length;
      const insufficient = list.filter((p) => p.competitiveState === "INSUFFICIENT_EVIDENCE").length;

      intentComparisons.push({
        intentFamily,
        totalComparablePrompts: list.length,
        clientAdvantages: cAdv,
        competitorAdvantages: compAdv,
        roughParity: parity,
        bothWeak,
        insufficientEvidence: insufficient,
      });
    }

    // 5. Corpus Summaries
    const competitorCorpusSummaries: Record<string, CompetitorCorpusSummary> = {};
    for (const compCtx of competitorContexts) {
      competitorCorpusSummaries[compCtx.competitor.competitorId] = compCtx.corpusSummary;
    }

    // 6. Assemble Draft Snapshot
    const draftSnapshot: Omit<AICompetitiveBenchmarkSnapshot, "fingerprint"> = {
      snapshotId: `comp_snap_${nanoid(10)}`,
      projectId,
      clientMeasurementSnapshotId: clientMeasurementSnapshot.measurementId,
      promptUniverseVersion: "v1.0",
      optimizationEngineVersion: "phase28h-advanced-content-intelligence",
      measurementEngineVersion: "phase28i-measurement-v1",
      competitiveEngineVersion: COMPETITIVE_ENGINE_VERSION,
      comparability: "DIRECTLY_COMPARABLE",
      comparabilityNote: "Client and competitors evaluated using identical Phase 28H/28I semantic mapper and intent rules.",
      generatedAt: new Date().toISOString(),
      competitors: competitorContexts.map((c) => c.competitor),
      competitorCorpusSummaries,
      summary: {
        totalPromptsCompared: promptComparisons.length,
        clientAdvantagesCount: clientAdvCount,
        competitorAdvantagesCount: compAdvCount,
        roughParityCount: parityCount,
        bothWeakCount,
        highPriorityGapsCount: highPriorityGaps,
        opportunitiesCount: opportunities.length,
        clientAdvantagesRecordCount: clientAdvantages.length,
      },
      promptComparisons,
      intentComparisons,
      opportunities,
      clientAdvantages,
      providerObservationStatus: {
        availabilityState: "PROVIDER_EVIDENCE_UNAVAILABLE",
        totalObserved: observations.length,
        note: "Live search grounding is parked. Competitive analysis derives strictly from deterministic multi-site crawl telemetry.",
      },
      disclaimer:
        "Competitive intelligence reflects observable content, structural, and evidence coverage across crawled public domains. It does not infer proprietary search rankings or fabricate probabilistic LLM outputs.",
    };

    // Validate Invariants
    validateCompetitiveInvariants(draftSnapshot as any);

    // Compute Fingerprint
    const fingerprint = computeCompetitiveFingerprint(draftSnapshot);

    return {
      ...draftSnapshot,
      fingerprint,
    };
  }

  private getCoverageScore(level: string): number {
    switch (level) {
      case "STRONG":
        return 5;
      case "ADEQUATE":
        return 4;
      case "PARTIAL":
        return 3;
      case "WEAK":
        return 2;
      case "UNSERVED":
        return 1;
      default:
        return 0;
    }
  }
}
