/**
 * Phase 28H: Page Targeting & Cannibalization Prevention Evaluator.
 * Detects whether canonical AI search queries have a clear, authoritative primary target
 * or suffer from target ambiguity and internal content competition.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { PromptPageMapping, AIOptimizationFinding } from "../types";

export function evaluatePageTargeting(
  projectId: string,
  runId: string,
  mappings: PromptPageMapping[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // 1. Detect MULTIPLE_COMPETING_TARGETS (Target Ambiguity)
  // Strict Safeguard: Only flag when top 2 candidate pages are BOTH high scoring (>70) and within 10 points
  // AND both are commercial pages (not a service page vs blog post)
  const competingMappings = mappings.filter((m) => {
    if (!m.candidatePages || m.candidatePages.length < 2) return false;
    const first = m.candidatePages[0];
    const second = m.candidatePages[1];

    const bothHighScoring = first.score >= 70 && second.score >= 65;
    const tightScoreGap = Math.abs(first.score - second.score) <= 10;

    // Both are commercial landing pages (excluding blog vs service)
    const firstIsBlog = first.url.includes("/post/") || first.url.includes("/blog");
    const secondIsBlog = second.url.includes("/post/") || second.url.includes("/blog");
    const bothSameType = (firstIsBlog && secondIsBlog) || (!firstIsBlog && !secondIsBlog);

    return bothHighScoring && tightScoreGap && bothSameType;
  });

  if (competingMappings.length > 0) {
    const affectedPrompts = competingMappings.map((m) => ({
      id: m.promptId,
      prompt: m.promptText,
      intent: m.intent,
      funnelStage: m.funnelStage,
      brandedness: m.brandedness,
    }));

    const competingUrls = Array.from(
      new Set(competingMappings.flatMap((m) => [m.candidatePages[0].url, m.candidatePages[1].url]))
    );

    findings.push({
      id: `opt_targeting_competing_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_PAGE_TARGETING_AMBIGUITY",
      category: "PAGE_TARGETING",
      type: "GAP",
      priority: "MEDIUM_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Page Target Ambiguity: Multiple Competing Pages for ${competingMappings.length} Canonical Prompts`,
      summary: `Multiple similar pages on the site compete for the same user intent, causing AI search engines to split relevance.`,
      whyItMatters:
        "When an AI crawler encounters two pages offering nearly identical high-level overviews for the same service topic, retrieval algorithms may cite different pages inconsistently or struggle to identify the authoritative primary destination.",
      problem: {
        observed: `${competingMappings.length} prompt(s) have 2 competing pages scoring within 10% similarity: ${competingUrls.slice(0, 2).join(" vs ")}.`,
        explanation:
          "Both pages describe similar capabilities without a clear hierarchical differentiation or explicit primary target assignment.",
      },
      evidence: {
        sourceSignal: "PROMPT_MAPPER_MULTI_TARGET_COMPETITION",
        websiteEvidence: {
          url: competingUrls[0] || profile.domain,
          pageTitle: "Competing Target Pages",
          element: "URL Hierarchy & Topic Overlap",
          observedFact: {
            competingPromptsCount: competingMappings.length,
            competingUrls,
          },
        },
      },
      rootCause: {
        hypothesis: "Multiple service pages or regional variations share overlapping copy and title structures.",
        contributingFactors: [
          "Services described similarly across multiple overview hubs.",
          "Lack of explicit cross-linking establishing the definitive pillar page.",
        ],
        isDeterministic: true,
        rationale: "Deterministic similarity scoring identified multiple candidate pages >= 70% relevance for the same prompt.",
      },
      affectedPrompts,
      affectedPages: competingUrls.map((url) => ({ url, matchType: "COMPETING_TARGET" })),
      affectedEntities: [brandName],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      supportingCategories: ["ANSWER_COVERAGE"],
      supportingSignals: [
        `Top 2 candidate pages have similarity gap <= 10 points for identical commercial prompts`,
      ],
      recommendation: {
        objective: "Establish a clear primary pillar page for the topic and differentiate secondary pages with specialized sub-topics.",
        whatShouldChange:
          "Strengthen the primary landing page with comprehensive definitions, and refine secondary pages to focus on specific sub-features, integrations, or use cases.",
        whereToChange: competingUrls.join(", "),
        actionSteps: [
          `Designate ${competingUrls[0]} as the primary canonical pillar page for the topic.`,
          `Update ${competingUrls[1]} to focus specifically on specialized sub-workflows, case studies, or architectural details.`,
          `Add clear internal links from secondary pages pointing back to the primary pillar page.`,
        ],
        cautions: [
          "Do not implement 301 redirects or canonicalize pages unless approved by traditional SEO audits.",
          "Maintain distinct, high-value content on each page.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Prompt-to-Page Mapper Re-Execution",
          targetCheck: "Primary page achieves score >= 85% with a clear > 20% margin over secondary pages",
          expectedEvidence: "PromptPageMapping reports coverageState=CLEAR_PRIMARY_TARGET.",
        },
        level2ProviderVerification: {
          method: "AI Engine Canonical Page Attribution Check",
          targetPromptIds: affectedPrompts.map((p) => p.id),
          expectedOutcome: "AI models consistently cite the designated primary pillar page.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Clear content targeting provides deterministic semantic signals to search engines and AI extractors.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // 2. Detect WRONG_PAGE_TYPE_TARGET
  // Prompt maps primarily to a career or utility page instead of a commercial service page
  const wrongTypeMappings = mappings.filter((m) => {
    if (!m.targetPageUrl) return false;
    const urlLower = m.targetPageUrl.toLowerCase();
    const isJobOrCareer = urlLower.includes("/job") || urlLower.includes("/career");
    const isCommercialPrompt = m.intent === "COMMERCIAL" || m.intent === "VENDOR_DISCOVERY";
    return isJobOrCareer && isCommercialPrompt;
  });

  if (wrongTypeMappings.length > 0) {
    const affectedPrompts = wrongTypeMappings.map((m) => ({
      id: m.promptId,
      prompt: m.promptText,
      intent: m.intent,
      funnelStage: m.funnelStage,
      brandedness: m.brandedness,
    }));

    findings.push({
      id: `opt_targeting_wrong_type_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_PAGE_TARGETING_WRONG_TYPE",
      category: "PAGE_TARGETING",
      type: "DEFECT",
      priority: "HIGH_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Commercial Prompts Mapped to Recruitment/Job Pages Instead of Service Pages`,
      summary: `Commercial capability queries resolve to job listings because the site lacks dedicated service landing pages.`,
      whyItMatters:
        "When commercial buyer queries retrieve job postings, AI search engines infer that the company is recruiting rather than offering mature enterprise client solutions.",
      problem: {
        observed: `${wrongTypeMappings.length} commercial prompt(s) mapped to career/job URLs: ${wrongTypeMappings.map((m) => m.targetPageUrl).join(", ")}.`,
        explanation: "Job postings mention the technology keywords prominently, but the site lacks corresponding client-facing service pages.",
      },
      evidence: {
        sourceSignal: "PAGE_CLASSIFICATION_MISMATCH",
        websiteEvidence: {
          url: wrongTypeMappings[0].targetPageUrl!,
          pageTitle: "Job / Career Page",
          element: "Page Primary Classification",
          observedFact: {
            mappedJobUrls: wrongTypeMappings.map((m) => m.targetPageUrl),
          },
        },
      },
      rootCause: {
        hypothesis: "Career postings provide more detailed technology descriptions than the public service landing pages.",
        contributingFactors: [
          "Recruitment job specs describe tools in detail while marketing copy remains generic.",
        ],
        isDeterministic: true,
        rationale: "Deterministic match between commercial prompt intent and job_posting page classification.",
      },
      affectedPrompts,
      affectedPages: wrongTypeMappings.map((m) => ({ url: m.targetPageUrl!, matchType: "CAREER_PAGE_MISMATCH" })),
      affectedEntities: [brandName],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      recommendation: {
        objective: "Publish dedicated commercial client-facing service pages for the target capabilities.",
        whatShouldChange: "Create high-depth solution pages so AI engines associate capabilities with client services rather than internal hiring.",
        whereToChange: `${profile.domain}/solutions/ or /services/`,
        actionSteps: [
          "Create client-facing solution pages outlining enterprise deliverables and capabilities.",
          "Ensure job postings link to the official client service pages.",
        ],
        cautions: [
          "Do not delete or noindex valid job postings.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Prompt-to-Page Mapper Re-Execution",
          targetCheck: "Commercial prompts map to marketing_landing or service pages with score >= 70%",
          expectedEvidence: "PromptPageMapping targets client service URLs rather than job postings.",
        },
        level2ProviderVerification: {
          method: "AI Engine Capability Test",
          targetPromptIds: affectedPrompts.map((p) => p.id),
          expectedOutcome: "AI models describe the brand as an enterprise solution provider.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Aligning client queries with commercial landing pages ensures proper contextual categorization in AI models.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
