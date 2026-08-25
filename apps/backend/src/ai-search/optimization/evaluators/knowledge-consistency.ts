/**
 * Phase 28G: Knowledge Consistency Evaluator.
 * Detects substantive factual contradictions across crawled pages regarding
 * company naming, primary offerings, and corporate positioning without flagging harmless paraphrasing.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { CrawledPageContext } from "../mapper";
import { AIOptimizationFinding } from "../types";

export function evaluateKnowledgeConsistency(
  projectId: string,
  runId: string,
  pages: CrawledPageContext[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brand = profile.brand;

  // Compare brand naming references across pages
  const brandVariations = new Map<string, string[]>();

  for (const page of pages) {
    const text = (page.visibleText || "").toLowerCase();
    const title = (page.title || "").toLowerCase();

    // Check for substantive naming discrepancies (e.g. calling company by contradictory legal names)
    for (const alias of brand.aliases || []) {
      const aliasLower = alias.toLowerCase();
      if (text.includes(aliasLower) || title.includes(aliasLower)) {
        if (!brandVariations.has(alias)) brandVariations.set(alias, []);
        brandVariations.get(alias)!.push(page.url);
      }
    }
  }

  // Check for substantive conflicts reported in knowledge profile
  if (profile.conflicts && profile.conflicts.length > 0) {
    for (const conf of profile.conflicts) {
      const sourceA = conf.sources?.[0]?.sourceUrl || profile.domain;
      const sourceB = conf.sources?.[1]?.sourceUrl || profile.domain;

      findings.push({
        id: `opt_know_conflict_${projectId}_${conf.id}`,
        projectId,
        runId,
        code: "AI_OPT_KNOWLEDGE_FACTUAL_CONTRADICTION",
        category: "KNOWLEDGE_CONSISTENCY",
        type: "DEFECT",
        priority: "HIGH_IMPACT",
        confidence: "HIGH",
        evidenceStrength: "STRONG",
        title: `Factual Inconsistency for "${conf.entityName}"`,
        summary: `Conflicting factual claims detected across crawled pages: "${conf.description}".`,
        whyItMatters:
          "Language models cross-reference multiple pages to synthesize facts. Contradictory statements confuse knowledge graph extraction and reduce factual confidence.",
        problem: {
          observed: `Contradiction detected: ${conf.description}`,
          explanation: `Conflicting claims regarding entity "${conf.entityName}" across sources ${sourceA} and ${sourceB}.`,
        },
        evidence: {
          sourceSignal: "KNOWLEDGE_GRAPH_CONTRADICTION_DETECTION",
          websiteEvidence: {
            url: sourceA,
            element: "Page Content Claims",
            observedFact: {
              entityName: conf.entityName,
              description: conf.description,
              sources: (conf.sources || []).map((s) => s.sourceUrl),
            },
          },
        },
        rootCause: {
          hypothesis: "Legacy content or un-synchronized marketing pages contain outdated factual claims.",
          contributingFactors: ["Content was updated on primary pages but legacy sub-pages were not aligned."],
          isDeterministic: true,
          rationale: "Deterministic extraction of contradictory attribute statements across crawled URLs.",
        },
        affectedPrompts: [],
        affectedPages: [
          { url: sourceA, matchType: "CONFLICT_SOURCE_A" },
          { url: sourceB, matchType: "CONFLICT_SOURCE_B" },
        ],
        affectedEntities: [brand.name, conf.entityName],
        affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
        recommendation: {
          objective: "Reconcile contradictory factual statements across all website pages.",
          whatShouldChange: `Review and align the descriptions for "${conf.entityName}" to state consistent canonical facts.`,
          whereToChange: `${sourceA} and ${sourceB}`,
          actionSteps: [
            `Review the discrepancy between ${sourceA} and ${sourceB}.`,
            "Update legacy copy to ensure uniform description of offerings, dates, and capabilities.",
          ],
          cautions: ["Ensure factual edits reflect accurate business reality."],
        },
        verificationMethod: {
          level1WebsiteVerification: {
            method: "Cross-Page Factual Consistency Check",
            targetCheck: "Both pages state identical canonical facts without contradiction",
            expectedEvidence: "Re-crawl verifies zero conflicting attribute assertions.",
          },
          level2ProviderVerification: {
            method: "AI Engine Factual Extraction Query",
            targetPromptIds: [],
            expectedOutcome: "AI models state the consistent fact without hedging or confusion.",
          },
        },
        lifecycleStatus: "OPEN",
        noGuaranteeDisclaimer:
          "Maintaining factual consistency eliminates ambiguous grounding data for AI scrapers.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}
