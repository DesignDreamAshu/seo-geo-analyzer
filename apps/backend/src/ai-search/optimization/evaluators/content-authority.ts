/**
 * Phase 28H: Content Authority & Observable Expertise Evaluator (Partial Implementation).
 * Evaluates concrete, observable on-page authority signals (named frameworks, implementation blueprints,
 * client evidence) without inventing subjective domain authority metrics or reducing authority to word counts.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { CrawledPageContext } from "../mapper";
import { AIOptimizationFinding } from "../types";

export function evaluateContentAuthority(
  projectId: string,
  runId: string,
  pages: CrawledPageContext[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Evaluate key solution landing pages for presence of concrete expertise frameworks or customer proof
  const solutionPages = pages.filter((p) => {
    const urlLower = p.url.toLowerCase();
    const isSolution =
      urlLower.includes("/solution") ||
      urlLower.includes("/cloudsmith") ||
      urlLower.includes("/odyssey") ||
      urlLower.endsWith("/solutions");
    const isBlogOrJob = urlLower.includes("/post/") || urlLower.includes("/job");
    return isSolution && !isBlogOrJob;
  });

  const pagesMissingFrameworks = solutionPages.filter((p) => {
    const textLower = (p.visibleText || "").toLowerCase();
    const hasFramework =
      textLower.includes("framework") ||
      textLower.includes("operating model") ||
      textLower.includes("blueprint") ||
      textLower.includes("methodology") ||
      textLower.includes("co-delivery") ||
      textLower.includes("coe");
    const hasProof =
      textLower.includes("case study") ||
      textLower.includes("proven") ||
      textLower.includes("testimonial") ||
      textLower.includes("client");

    return !hasFramework && !hasProof;
  });

  if (pagesMissingFrameworks.length > 0) {
    const affectedUrls = pagesMissingFrameworks.map((p) => p.url);

    findings.push({
      id: `opt_auth_frameworks_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_CONTENT_AUTHORITY_METHODOLOGY_SIGNAL_OPPORTUNITY",
      category: "CONTENT_AUTHORITY",
      type: "OPPORTUNITY",
      priority: "LOW_IMPACT",
      confidence: "MEDIUM",
      evidenceStrength: "MODERATE",
      title: `Enhance Observable Technical Authority with Named Frameworks on ${pagesMissingFrameworks.length} Solution Pages`,
      summary: `Solution pages describe technical capabilities without articulating the proprietary delivery methodology, architecture blueprint, or client proof.`,
      whyItMatters:
        "AI models synthesize recommendations from pages that demonstrate authoritative first-party expertise. Naming your concrete methodology and architecture framework increases the probability that AI systems quote your specific delivery model.",
      problem: {
        observed: `${pagesMissingFrameworks.length} solution page(s) list services without featuring a named methodology blueprint, architectural lifecycle, or case study proof.`,
        explanation:
          "The pages explain what tools are used but omit the distinctive process and proprietary frameworks that establish the firm's authentic engineering depth.",
      },
      evidence: {
        sourceSignal: "OBSERVABLE_EXPERTISE_FRAMEWORK_AUDIT",
        websiteEvidence: {
          url: affectedUrls[0] || profile.domain,
          pageTitle: "Solution Landing Pages",
          element: "Methodology & Framework Content",
          observedFact: {
            unframedSolutionPagesCount: pagesMissingFrameworks.length,
            sampleUrls: affectedUrls.slice(0, 3),
          },
        },
      },
      rootCause: {
        hypothesis: "Pages list technology offerings in bullet points rather than detailing the strategic delivery framework.",
        contributingFactors: [
          "Technical architecture processes are kept in private pitch decks rather than public landing pages.",
        ],
        isDeterministic: true,
        rationale: "Deterministic scan of solution pages for named methodology, blueprint, and client evidence tokens.",
      },
      affectedPrompts: [],
      affectedPages: affectedUrls.map((url) => ({ url, matchType: "SOLUTION_PAGE_AUTHORITY_OPPORTUNITY" })),
      affectedEntities: [brandName],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      supportingCategories: ["CONTENT_SPECIFICITY"],
      supportingSignals: [
        `${pagesMissingFrameworks.length} solution pages lack named delivery frameworks or proof blocks`,
      ],
      recommendation: {
        objective: "Incorporate named architectural frameworks, delivery lifecycles, and attributable case evidence into core solution landing pages.",
        whatShouldChange:
          "Introduce a clear 'Our Methodology & Framework' section detailing the technical phases and proprietary delivery standards.",
        whereToChange: affectedUrls.join(", "),
        actionSteps: [
          "Add a structured diagram or phased lifecycle describing the implementation approach.",
          "Highlight named proprietary delivery assets (e.g. Cloudsmith, Odyssey, Automation Accelerators).",
          "Include a client outcome highlight box summarizing real-world impact.",
        ],
        cautions: [
          "Do not inflate claims with generic buzzwords.",
          "Keep frameworks directly aligned with real operational capabilities.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Expertise Signal Re-Audit",
          targetCheck: "Named methodology or architectural lifecycle detected in page content",
          expectedEvidence: "Structured delivery framework and case proof present in DOM text.",
        },
        level2ProviderVerification: {
          method: "AI Model Methodology Retrieval Query",
          targetPromptIds: [],
          expectedOutcome: "AI models reference the brand's proprietary methodology when answering technical consulting queries.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Observable authority signals enhance content quality and brand attribution in AI knowledge synthesis.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
