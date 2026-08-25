/**
 * Phase 28G: Competitor Visibility Gap Evaluator.
 * Evaluates unbranded recommendation/discovery prompts where competitors were recognized
 * and recommended by AI engines while the tracked brand was absent, strictly separating
 * observed facts from comparative hypotheses without unsupported causal claims.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { AIObservation } from "../../observation/types";
import { PromptPageMapping, AIOptimizationFinding } from "../types";

export function evaluateCompetitorGap(
  projectId: string,
  runId: string,
  observations: AIObservation[],
  mappings: PromptPageMapping[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Filter unbranded prompts
  const unbrandedObs = observations.filter(
    (o) => o.brandedness === "UNBRANDED" || o.brandedness === "SEMI_BRANDED"
  );

  // Group by prompt
  const competitorPrompts = unbrandedObs.filter(
    (o) => !o.brandMentioned && o.competitorsMentioned && o.competitorsMentioned.length > 0
  );

  if (competitorPrompts.length === 0) return findings;

  // Aggregate observed competitors
  const competitorCounts = new Map<string, number>();
  const competitorEvidenceList: Array<{ competitorName: string; observedInPrompt: string; sourceSnippet?: string }> = [];

  for (const obs of competitorPrompts) {
    for (const comp of obs.competitorsMentioned || []) {
      competitorCounts.set(comp.competitorName, (competitorCounts.get(comp.competitorName) || 0) + 1);
      competitorEvidenceList.push({
        competitorName: comp.competitorName,
        observedInPrompt: obs.promptText,
        sourceSnippet: comp.contextSnippet,
      });
    }
  }

  const topCompetitors = Array.from(competitorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name} (${count} mentions)`);

  const affectedPrompts = competitorPrompts.map((o) => ({
    id: o.promptId,
    prompt: o.promptText,
    intent: o.intent,
    funnelStage: o.funnelStage,
    brandedness: o.brandedness,
  }));

  const providerList = Array.from(new Set(competitorPrompts.map((o) => o.providerId)));

  findings.push({
    id: `opt_comp_gap_${projectId}`,
    projectId,
    runId,
    code: "AI_OPT_COMPETITOR_VISIBILITY_GAP",
    category: "COMPETITOR_VISIBILITY_GAP",
    type: "GAP",
    priority: "HIGH_IMPACT",
    confidence: "HIGH",
    evidenceStrength: "STRONG",
    title: `Competitor Visibility Dominance on ${competitorPrompts.length} Unbranded Category Queries`,
    summary: `Competitors (${topCompetitors.slice(0, 4).join(", ")}) were repeatedly recommended by AI models on category discovery prompts where "${brandName}" was not identified.`,
    whyItMatters:
      "Category discovery prompts represent high-intent buyer searches (e.g. 'top enterprise ServiceNow partners'). When competitors dominate AI responses, enterprise prospects evaluate alternatives before discovering the tracked brand.",
    problem: {
      observed: `AI models recommended competitors across ${competitorPrompts.length} unbranded prompts while "${brandName}" had 0 confirmed mentions.`,
      explanation:
        "OBSERVED FACT: Competitor entities appeared in AI recommendation lists; tracked brand did not. HYPOTHESIS: Competitors possess deeper authoritative entity graphs, extensive third-party co-citations, and dedicated topical content hubs.",
    },
    evidence: {
      sourceSignal: "OBSERVED_PROVIDER_COMPETITOR_RECOMMENDATION",
      providerObservations: competitorPrompts.map((o) => ({
        observationId: o.observationId,
        providerId: o.providerId,
        model: o.model,
        promptText: o.promptText,
        attributionState: o.entityAttribution?.state,
        confirmedBrandMention: false,
        rawSnippet: o.rawResponse ? o.rawResponse.slice(0, 200) + "..." : undefined,
      })),
      competitorEvidence: competitorEvidenceList.slice(0, 10),
    },
    rootCause: {
      hypothesis: "Competitors have stronger pre-trained co-occurrence signals and extensive web footprint associating their brand with enterprise workflow consulting.",
      contributingFactors: [
        "Major enterprise consultancies have extensive legacy citation footprints.",
        "On-site service content may lack explicit industry proof, certified partner credentials, and case-study depth.",
      ],
      isDeterministic: false,
      rationale: "Comparative observation verified across live provider prompts. Root cause analysis is marked as a hypothesis based on observed footprint differences.",
    },
    affectedPrompts,
    affectedPages: mappings
      .filter((m) => m.targetPageUrl && affectedPrompts.some((p) => p.id === m.promptId))
      .map((m) => ({ url: m.targetPageUrl!, matchType: "CATEGORY_TARGET_PAGE" })),
    affectedEntities: [brandName],
    affectedProviders: providerList,
    recommendation: {
      objective: "Strengthen topic authority, certified credentials, and enterprise case-study evidence across core service pages.",
      whatShouldChange:
        "Publish substantiated enterprise case studies, highlight certified partnership tiers, and establish clear topical depth matching category search intents.",
      whereToChange: "Primary service landing pages and resources section",
      actionSteps: [
        "Expand primary service pages with verified enterprise case studies detailing metrics, challenges, and solutions.",
        "Add explicit badge and credential callouts (e.g. ServiceNow Premier/Elite Partner status, certified architect counts).",
        "Publish comprehensive capability guides comparing enterprise implementation approaches.",
      ],
      cautions: [
        "Do not copy competitor content.",
        "Focus on unique specialized differentiators (e.g. boutique agility, dedicated senior architects) rather than competing solely on firm size.",
      ],
    },
    verificationMethod: {
      level1WebsiteVerification: {
        method: "On-Site Authority & Case Study Audit",
        targetCheck: "Presence of published enterprise case studies and certified partner credentials",
        expectedEvidence: "Service page includes substantiated client outcomes and verified partnership credentials.",
      },
      level2ProviderVerification: {
        method: "Unbranded Category Discovery Re-Evaluation",
        targetPromptIds: affectedPrompts.map((p) => p.id),
        expectedOutcome: "Tracked brand begins appearing in AI synthesis lists alongside category competitors.",
      },
    },
    lifecycleStatus: "OPEN",
    noGuaranteeDisclaimer:
      "AI provider recommendation algorithms consider vast external corpora. Dream SEO strengthens on-site authority signals without guaranteeing external inclusion.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return findings;
}
