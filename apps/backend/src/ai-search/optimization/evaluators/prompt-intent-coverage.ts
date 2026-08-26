/**
 * Phase 28H: Prompt Intent Coverage Evaluator.
 * Determines whether important canonical user intents have adequate on-site content capable of satisfying them.
 * Distinguishes intent satisfaction from mere keyword overlap.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { PromptPageMapping, AIOptimizationFinding } from "../types";

export function evaluatePromptIntentCoverage(
  projectId: string,
  runId: string,
  mappings: PromptPageMapping[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Group mappings by intent family to evaluate strategic intent coverage
  const intentGaps: PromptPageMapping[] = [];

  for (const m of mappings) {
    const isInformationalOrGuidance =
      m.intent === "HOW_TO" ||
      m.intent === "EVALUATION" ||
      m.intent === "COMPARISON" ||
      m.intent === "IMPLEMENTATION_GUIDANCE" ||
      m.intent === "INFORMATIONAL";

    // If intent requires procedural/evaluation guidance but the mapped target is a generic marketing shell or missing
    if (isInformationalOrGuidance) {
      if (m.coverageState === "NO_TARGET_PAGE") {
        intentGaps.push(m);
      } else if (m.answerCoverage === "NOT_COVERED" || m.answerCoverage === "UNCLEAR") {
        intentGaps.push(m);
      }
    }
  }

  if (intentGaps.length > 0) {
    // Group by intent type to provide coherent actionable recommendations
    const intentGroups = new Map<string, PromptPageMapping[]>();
    for (const g of intentGaps) {
      const key = g.intent || "INFORMATIONAL";
      if (!intentGroups.has(key)) intentGroups.set(key, []);
      intentGroups.get(key)!.push(g);
    }

    for (const [intentName, gList] of intentGroups.entries()) {
      const samplePrompts = gList.slice(0, 3).map((p) => p.promptText);
      const affectedPages = gList
        .filter((g) => g.targetPageUrl)
        .map((g) => ({ url: g.targetPageUrl!, title: g.targetPageUrl, matchType: "INTENT_GAP_PAGE" }));

      findings.push({
        id: `opt_intent_cov_${projectId}_${intentName.toLowerCase()}`,
        projectId,
        runId,
        code: `AI_OPT_INTENT_COVERAGE_${intentName.toUpperCase()}_DEFICIT`,
        category: "PROMPT_INTENT_COVERAGE",
        type: "GAP",
        priority: intentName === "EVALUATION" || intentName === "COMPARISON" ? "HIGH_IMPACT" : "MEDIUM_IMPACT",
        confidence: "HIGH",
        evidenceStrength: "STRONG",
        title: `Incomplete ${intentName.replace(/_/g, " ")} Intent Coverage for ${gList.length} Decision-Stage Prompts`,
        summary: `The site lacks comprehensive answer content satisfying ${intentName.replace(/_/g, " ")} buyer queries.`,
        whyItMatters:
          "Enterprise decision-makers ask AI engines comparative and evaluative questions (e.g. 'How to evaluate a partner?', 'Architecture comparison'). When a site only provides high-level sales copy, AI search engines cite third-party comparison portals instead of your brand.",
        problem: {
          observed: `${gList.length} prompts in the "${intentName}" intent family lack satisfying explanatory content on their mapped pages.`,
          explanation:
            "The mapped pages mention the broad technology topic but omit the specific methodology, trade-offs, or procedural criteria needed to answer the user's intent.",
        },
        evidence: {
          sourceSignal: "PROMPT_INTENT_ALIGNMENT_AUDIT",
          websiteEvidence: {
            url: affectedPages[0]?.url || profile.domain,
            pageTitle: "Intent Coverage Evaluation",
            element: "On-Page Answer Content",
            observedFact: {
              intentFamily: intentName,
              uncoveredPromptsCount: gList.length,
              samplePrompts,
            },
          },
        },
        rootCause: {
          hypothesis: "Website content is concentrated on commercial capability overviews rather than decision-stage educational guidance.",
          contributingFactors: [
            "Commercial landing pages lack procedural guidance sections.",
            "Technical comparison guides or evaluation frameworks have not been published as supporting content.",
          ],
          isDeterministic: true,
          rationale: "Deterministic evaluation of prompt intent requirements against extracted DOM text.",
        },
        affectedPrompts: gList.map((g) => ({
          id: g.promptId,
          prompt: g.promptText,
          intent: g.intent,
          funnelStage: g.funnelStage,
          brandedness: g.brandedness,
        })),
        affectedPages,
        affectedEntities: [brandName],
        affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
        supportingCategories: ["ANSWER_COVERAGE"],
        supportingSignals: [
          `${gList.length} prompts have answer coverage level '${gList[0].answerCoverage}'`,
        ],
        recommendation: {
          objective: `Publish supporting technical content or expand existing sections to directly satisfy ${intentName.replace(/_/g, " ")} user intents.`,
          whatShouldChange:
            "Add dedicated educational guides or enhance mapped pages with concrete criteria, step-by-step guidance, and architectural trade-offs.",
          whereToChange: affectedPages.length > 0 ? affectedPages.map((p) => p.url).join(", ") : `New guides under ${profile.domain}/post/ or /solutions/`,
          actionSteps: [
            affectedPages.length > 0
              ? "Enhance mapped pages with a dedicated 'Evaluation Criteria' or 'Implementation Approach' section."
              : "Publish a focused supporting guide answering the specific user questions.",
            "Directly answer common comparison and evaluation questions within the first two paragraphs.",
            "Link supporting guides to corresponding commercial solution pages with clear call-to-actions.",
          ],
          cautions: [
            "Do not create duplicate commercial landing pages to solve an informational or evaluation intent gap.",
            "Maintain cannibalization safety by keeping commercial solution pages distinct from educational guides.",
          ],
        },
        verificationMethod: {
          level1WebsiteVerification: {
            method: "Semantic Intent Re-Evaluation",
            targetCheck: "Target page provides explicit answer criteria matching the prompt intent family",
            expectedEvidence: "PromptPageMapping reports answerCoverage=COVERED and intentSatisfaction=STRONG.",
          },
          level2ProviderVerification: {
            method: "AI Engine Intent Query Test",
            targetPromptIds: gList.map((g) => g.promptId),
            expectedOutcome: "AI engine synthesizes answers utilizing the brand's methodology and citations.",
          },
        },
        lifecycleStatus: "OPEN",
        noGuaranteeDisclaimer:
          "Satisfying user intent ensures that AI engines have retrievable source material to synthesize authoritative answers.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}
