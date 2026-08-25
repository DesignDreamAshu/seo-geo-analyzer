/**
 * Phase 28G: Answer Coverage & Page Targeting Evaluator.
 * Converts prompt-to-page mapping gaps and incomplete answer structures into actionable,
 * page-specific content recommendations.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { PromptPageMapping, AIOptimizationFinding } from "../types";

export function evaluateAnswerCoverage(
  projectId: string,
  runId: string,
  mappings: PromptPageMapping[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];

  // 1. Group prompts with NO TARGET PAGE
  const noTargetPrompts = mappings.filter((m) => m.coverageState === "NO_TARGET_PAGE");
  if (noTargetPrompts.length > 0) {
    const affectedPrompts = noTargetPrompts.map((m) => ({
      id: m.promptId,
      prompt: m.promptText,
      intent: m.intent,
      funnelStage: m.funnelStage,
      brandedness: m.brandedness,
    }));

    findings.push({
      id: `opt_targeting_no_page_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_PROMPT_NO_TARGET_PAGE",
      category: "PAGE_TARGETING",
      type: "GAP",
      priority: "HIGH_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Missing Dedicated Landing Pages for ${noTargetPrompts.length} Strategic Discovery Prompts`,
      summary: `The website currently lacks target landing pages or dedicated service sections for ${noTargetPrompts.length} canonical discovery prompts.`,
      whyItMatters:
        "When an AI search engine evaluates enterprise capabilities, the absence of a dedicated authoritative URL covering the core service topic makes it unlikely that AI systems can synthesize a comprehensive recommendation.",
      problem: {
        observed: `${noTargetPrompts.length} prompt candidates have a mapping score < 25% across all crawled website pages.`,
        explanation:
          "The current website architecture does not contain dedicated sub-pages or detailed sections addressing these specific customer questions or solution categories.",
      },
      evidence: {
        sourceSignal: "PROMPT_UNIVERSE_PAGE_MAPPING_DEFICIT",
        websiteEvidence: {
          url: profile.domain,
          pageTitle: "Website Site Structure",
          element: "URL Sitemap & Page Hierarchy",
          observedFact: {
            unmappedPromptsCount: noTargetPrompts.length,
            samplePrompts: noTargetPrompts.slice(0, 3).map((p) => p.promptText),
          },
        },
      },
      rootCause: {
        hypothesis: "Content architecture has not expanded to cover specialized service permutations and decision-stage buyer questions.",
        contributingFactors: [
          "Services are grouped into a broad overview without dedicated sub-pages.",
          "Specific enterprise integration frameworks lack dedicated technical/service documentation.",
        ],
        isDeterministic: true,
        rationale: "Deterministic URL and DOM crawl confirmed zero matching target pages with topic relevance $\\ge 25\\%$.",
      },
      affectedPrompts,
      affectedPages: [],
      affectedEntities: [profile.brand.name],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      recommendation: {
        objective: "Create or expand dedicated service landing pages targeting these key solution areas.",
        whatShouldChange: "Publish dedicated, high-depth service pages that directly define the service, target audience, and enterprise deliverables.",
        whereToChange: `Create new URL path(s) under ${profile.domain.replace(/\/$/, "")}/services/`,
        actionSteps: [
          "Create a dedicated solution page for each primary unmapped service area.",
          "Structure the page with a concise definition header, enterprise audience alignment, primary capabilities, and case study proof.",
          "Add the new pages to the XML sitemap and internal navigation menus.",
        ],
        cautions: [
          "Do not create thin or duplicate pages.",
          "Ensure each new page provides substantive technical and business value.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Crawler URL & Sitemap Re-Audit",
          targetCheck: "New dedicated service page reachable with HTTP 200 and listed in sitemap.xml",
          expectedEvidence: "Crawled page maps to prompt with mapping score >= 60% (STRONG_MATCH).",
        },
        level2ProviderVerification: {
          method: "AI Engine Discovery Prompt Re-Evaluation",
          targetPromptIds: affectedPrompts.map((p) => p.id),
          expectedOutcome: "AI models begin referencing the new service URL and recognizing the capability.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Publishing dedicated landing pages establishes essential on-site crawl and retrieval eligibility for AI engines.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // 2. Group prompts with PARTIAL or NOT COVERED answer on existing target page
  const partialAnswerMappings = mappings.filter(
    (m) =>
      m.targetPageUrl &&
      (m.answerCoverage === "PARTIALLY_COVERED" || m.answerCoverage === "NOT_COVERED") &&
      m.coverageState !== "NO_TARGET_PAGE"
  );

  // Group by target page URL to avoid duplicate findings for the same page
  const pageGroups = new Map<string, PromptPageMapping[]>();
  for (const m of partialAnswerMappings) {
    if (!m.targetPageUrl) continue;
    if (!pageGroups.has(m.targetPageUrl)) pageGroups.set(m.targetPageUrl, []);
    pageGroups.get(m.targetPageUrl)!.push(m);
  }

  for (const [pageUrl, mList] of pageGroups.entries()) {
    const affectedPrompts = mList.map((m) => ({
      id: m.promptId,
      prompt: m.promptText,
      intent: m.intent,
      funnelStage: m.funnelStage,
      brandedness: m.brandedness,
    }));

    const sampleMissing = Array.from(new Set(mList.flatMap((m) => m.answerCoverageEvidence.missingElements)));

    findings.push({
      id: `opt_answer_coverage_${projectId}_${pageUrl.replace(/[^a-z0-9]/g, "_")}`,
      projectId,
      runId,
      code: "AI_OPT_ANSWER_COVERAGE_GAP",
      category: "ANSWER_COVERAGE",
      type: "GAP",
      priority: "MEDIUM_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Answer Coverage Gap on "${pageUrl}" for ${mList.length} Prompts`,
      summary: `Page "${pageUrl}" matches target queries but does not provide complete, concise answers to core user questions.`,
      whyItMatters:
        "AI engines extract concise answer blocks from authoritative pages. When a page mentions a topic without clearly defining the service offering, audience, and outcomes, AI extractors fail to synthesize direct answers.",
      problem: {
        observed: `Semantic answer evaluation classified coverage as "${mList[0].answerCoverage}". Missing key components: ${sampleMissing.join(", ")}.`,
        explanation:
          "The target page mentions relevant keywords, but lacks a concise introductory answer block explicitly answering what service is provided, who it is for, and what problem it solves.",
      },
      evidence: {
        sourceSignal: "SEMANTIC_ANSWER_COMPLETENESS_EVALUATION",
        websiteEvidence: {
          url: pageUrl,
          pageTitle: mList[0].candidatePages[0]?.title || null,
          element: "Main Content Introduction & Service Summary",
          snippet: mList[0].answerCoverageEvidence.extractedSnippet || null,
          observedFact: {
            missingElements: sampleMissing,
            targetAudienceMentioned: mList[0].answerCoverageEvidence.targetAudienceMentioned,
            businessProblemSolved: mList[0].answerCoverageEvidence.businessProblemSolved,
          },
        },
      },
      rootCause: {
        hypothesis: "Page structure uses narrative or marketing phrasing rather than a structured, direct informational format.",
        contributingFactors: [
          "Introductory section does not concisely define the primary service capabilities.",
          "Target audience and operational deliverables are implied rather than explicitly stated.",
        ],
        isDeterministic: true,
        rationale: "Deterministic parsing of visible text revealed absence of core service, audience, or outcome definitions.",
      },
      affectedPrompts,
      affectedPages: [{ url: pageUrl, title: mList[0].candidatePages[0]?.title || null, matchType: "TARGET_PAGE" }],
      affectedEntities: [profile.brand.name],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      recommendation: {
        objective: "Provide clear, self-contained service and audience definitions on the target page answering the primary prompt intent.",
        whatShouldChange: "Add a concise informational overview (via a summary section, structured paragraph, or bulleted breakdown) explicitly stating what is delivered, who it serves, and key outcomes.",
        whereToChange: `${pageUrl} (in the main introductory or capabilities section)`,
        actionSteps: [
          "Ensure the introductory section clearly answers: (1) What specific service is provided, (2) Who the enterprise client is, and (3) What business problems are solved.",
          "Present the information in any scannable format (e.g., concise definition paragraph, structured capability bullets, or overview card).",
          "Ensure terms match the primary capabilities recognized by industry practitioners.",
        ],
        exampleBefore: "<p>We empower enterprises with modern cloud solutions for the future of work.</p>",
        exampleAfter: `<p><strong>${profile.brand.name}</strong> delivers enterprise ServiceNow advisory, custom workflow implementation, and digital transformation consulting. We help enterprise IT and operations leaders streamline complex business processes, reduce legacy operational overhead, and maximize ServiceNow ROI.</p>`,
        cautions: [
          "Avoid keyword stuffing or unnatural phrasing.",
          "Ensure definitions reflect true organizational capabilities.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Semantic Content Re-Evaluation",
          targetCheck: "Target page text contains explicit service definition, audience, and problem statement",
          expectedEvidence: "Answer coverage level improves to COVERED with 0 missing elements.",
        },
        level2ProviderVerification: {
          method: "AI Engine Prompt Query",
          targetPromptIds: affectedPrompts.map((p) => p.id),
          expectedOutcome: "AI models extract and quote the concise service definition in synthesis responses.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Direct answer blocks optimize semantic extractability for RAG pipelines and language model answer synthesis.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
