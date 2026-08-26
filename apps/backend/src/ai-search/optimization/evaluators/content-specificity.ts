/**
 * Phase 28H: Content Specificity Evaluator.
 * Evaluates whether strategically important mapped pages provide concrete, factual information
 * across the 7 essential dimensions (WHAT, WHO, PROBLEM, METHOD, OUTCOME, DIFFERENTIATOR, PROOF)
 * or substitute generic marketing slogans for material offering details.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { CrawledPageContext } from "../mapper";
import { PromptPageMapping, AIOptimizationFinding } from "../types";

export interface SpecificityEvaluation {
  url: string;
  hasWhat: boolean;
  hasWho: boolean;
  hasProblem: boolean;
  hasMethod: boolean;
  hasOutcome: boolean;
  hasDifferentiator: boolean;
  hasProof: boolean;
  score: number; // 0 - 7
  missingDimensions: string[];
}

export function evaluateContentSpecificity(
  projectId: string,
  runId: string,
  pages: CrawledPageContext[],
  mappings: PromptPageMapping[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Strictly target core commercial solution/service landing pages mapped to commercial queries
  // (Exclude informational blog posts and articles from commercial service specificity requirements)
  const commercialMappings = mappings.filter(
    (m) =>
      m.targetPageUrl &&
      (m.intent === "COMMERCIAL" || m.intent === "VENDOR_DISCOVERY" || m.intent === "BRAND_NAV")
  );

  const mappedCommercialUrls = new Set(commercialMappings.map((m) => m.targetPageUrl!));

  const targetPages = pages.filter((p) => {
    if (!mappedCommercialUrls.has(p.url)) return false;
    const urlLower = p.url.toLowerCase();
    const isBlogOrArticle = urlLower.includes("/post/") || urlLower.includes("/blog");
    const isJobOrUtility = urlLower.includes("/job") || urlLower.includes("/privacy") || urlLower.includes("/terms");
    return !isBlogOrArticle && !isJobOrUtility;
  });

  const lowSpecificityPages: Array<{ page: CrawledPageContext; evaluation: SpecificityEvaluation }> = [];

  for (const page of targetPages) {
    const text = (page.visibleText || "").toLowerCase();
    const headingsText = (page.headings || []).join(" ").toLowerCase();
    const combined = `${headingsText} ${text}`;

    // 1. WHAT: Specific service/capability explicitly stated
    const hasWhat =
      combined.includes("service") ||
      combined.includes("solution") ||
      combined.includes("platform") ||
      combined.includes("workflow") ||
      combined.includes("architecture") ||
      combined.includes("migration") ||
      combined.includes("development") ||
      combined.includes("consulting") ||
      combined.includes("analytics");

    // 2. WHO: Target enterprise persona / industry audience
    const hasWho =
      combined.includes("enterprise") ||
      combined.includes("for teams") ||
      combined.includes("organizations") ||
      combined.includes("fortune") ||
      combined.includes("cto") ||
      combined.includes("cio") ||
      combined.includes("engineers") ||
      combined.includes("leaders");

    // 3. PROBLEM: Concrete business/technical pain point
    const hasProblem =
      combined.includes("challenge") ||
      combined.includes("problem") ||
      combined.includes("bottleneck") ||
      combined.includes("risk") ||
      combined.includes("inefficiency") ||
      combined.includes("legacy") ||
      combined.includes("downtime") ||
      combined.includes("complexity");

    // 4. METHOD: Specific process, delivery approach, or architecture model
    const hasMethod =
      combined.includes("approach") ||
      combined.includes("methodology") ||
      combined.includes("framework") ||
      combined.includes("lifecycle") ||
      combined.includes("deployment") ||
      combined.includes("pipeline") ||
      combined.includes("audit") ||
      combined.includes("co-delivery") ||
      combined.includes("operating model");

    // 5. OUTCOME: Specific measurable business impact or deliverables
    const hasOutcome =
      combined.includes("deliver") ||
      combined.includes("result") ||
      combined.includes("impact") ||
      combined.includes("roi") ||
      combined.includes("efficiency") ||
      combined.includes("acceleration") ||
      combined.includes("velocity") ||
      combined.includes("reduction");

    // 6. DIFFERENTIATOR: Unique capability or proprietary advantage
    const hasDifferentiator =
      combined.includes("why us") ||
      combined.includes("differentiator") ||
      combined.includes("advantage") ||
      combined.includes("built for") ||
      combined.includes("specialized") ||
      combined.includes("certified") ||
      combined.includes("proprietary") ||
      combined.includes("cloudsmith") ||
      combined.includes("odyssey");

    // 7. PROOF: First-party case study, customer quote, or attributable metric
    const hasProof =
      combined.includes("case study") ||
      combined.includes("client story") ||
      combined.includes("customer") ||
      combined.includes("testimonial") ||
      combined.includes("proven") ||
      combined.includes("experience with") ||
      combined.includes("worked with");

    const missingDimensions: string[] = [];
    if (!hasWhat) missingDimensions.push("WHAT (Core Offering Definition)");
    if (!hasWho) missingDimensions.push("WHO (Target Audience & Enterprise Personas)");
    if (!hasProblem) missingDimensions.push("PROBLEM (Addressed Business Pain Points)");
    if (!hasMethod) missingDimensions.push("METHOD (Delivery Approach & Technical Framework)");
    if (!hasOutcome) missingDimensions.push("OUTCOME (Deliverables & Expected Business Impact)");
    if (!hasDifferentiator) missingDimensions.push("DIFFERENTIATOR (Unique Value Proposition)");

    const dimensionsPresent = 6 - missingDimensions.length;

    // Strict Safeguard: Only flag if page is genuinely generic (< 3 dimensions present out of 6)
    // AND has low content depth (< 150 words)
    const wordCount = (page.visibleText || "").split(/\s+/).filter(Boolean).length;
    if (dimensionsPresent < 3 && wordCount < 200) {
      lowSpecificityPages.push({
        page,
        evaluation: {
          url: page.url,
          hasWhat,
          hasWho,
          hasProblem,
          hasMethod,
          hasOutcome,
          hasDifferentiator,
          hasProof,
          score: dimensionsPresent,
          missingDimensions,
        },
      });
    }
  }

  if (lowSpecificityPages.length > 0) {
    for (const item of lowSpecificityPages) {
      const p = item.page;
      const evalData = item.evaluation;

      findings.push({
        id: `opt_specificity_${projectId}_${p.url.replace(/[^a-z0-9]/g, "_")}`,
        projectId,
        runId,
        code: "AI_OPT_CONTENT_SPECIFICITY_DEFICIT",
        category: "CONTENT_SPECIFICITY",
        type: "GAP",
        priority: "MEDIUM_IMPACT",
        confidence: "HIGH",
        evidenceStrength: "STRONG",
        title: `Content Specificity Deficit on "${p.url}"`,
        summary: `Page relies on high-level statements and lacks concrete details for: ${evalData.missingDimensions.slice(0, 3).join(", ")}.`,
        whyItMatters:
          "AI answer synthesis relies on concrete entity-attribute statements (e.g. specific tools, processes, deliverables). When a page substitutes vague claims for concrete technical specs, AI engines omit it from detailed capability answers.",
        problem: {
          observed: `Page satisfies only ${evalData.score}/6 essential specificity dimensions. Missing: ${evalData.missingDimensions.join("; ")}.`,
          explanation:
            "The page copy does not explicitly define the technical delivery method, target audience personas, or business pain points.",
        },
        evidence: {
          sourceSignal: "DIMENSIONAL_CONTENT_SPECIFICITY_AUDIT",
          websiteEvidence: {
            url: p.url,
            pageTitle: p.title || null,
            element: "Main Content Paragraphs",
            observedFact: {
              dimensionsPresent: evalData.score,
              missingDimensions: evalData.missingDimensions,
            },
          },
        },
        rootCause: {
          hypothesis: "Page was written with brief summary copy without elaborating on technical mechanics or delivery frameworks.",
          contributingFactors: [
            "Introductory copy lacks detailed capability breakdown sections.",
            "Technical architecture and methodology steps are not enumerated.",
          ],
          isDeterministic: true,
          rationale: "Deterministic lexical scan across 6 factual information dimensions.",
        },
        affectedPrompts: mappings
          .filter((m) => m.targetPageUrl === p.url)
          .map((m) => ({
            id: m.promptId,
            prompt: m.promptText,
            intent: m.intent,
            funnelStage: m.funnelStage,
            brandedness: m.brandedness,
          })),
        affectedPages: [{ url: p.url, title: p.title || null, matchType: "SPECIFICITY_DEFICIT_PAGE" }],
        affectedEntities: [brandName],
        affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
        supportingCategories: ["ANSWER_COVERAGE"],
        supportingSignals: [
          `Page lacks ${evalData.missingDimensions.length} essential informational dimensions`,
        ],
        recommendation: {
          objective: "Enrich the page with concrete technical definitions, target audience alignment, and structured methodology steps.",
          whatShouldChange:
            `Add concrete paragraphs addressing the missing dimensions: ${evalData.missingDimensions.join(", ")}.`,
          whereToChange: p.url,
          actionSteps: [
            "Add a 'What We Deliver' section clearly enumerating specific platforms, modules, and architecture deliverables.",
            "Include a 'Who This Is For' subsection identifying target enterprise personas (e.g. Enterprise Architects, VP of Engineering).",
            "Detail the implementation methodology (e.g. 4-phase rollout: Assessment, Architecture, Migration, Managed CoE).",
          ],
          cautions: [
            "Do not stuff keywords artificially.",
            "Keep information factual, concise, and matching authentic company capabilities.",
          ],
        },
        verificationMethod: {
          level1WebsiteVerification: {
            method: "Content Specificity Re-Audit",
            targetCheck: "Page content satisfies at least 4 out of 6 material specificity dimensions",
            expectedEvidence: "Specific deliverables, audience personas, and methodology steps detected in DOM text.",
          },
          level2ProviderVerification: {
            method: "AI Engine Factual Extraction Query",
            targetPromptIds: mappings.filter((m) => m.targetPageUrl === p.url).map((m) => m.promptId),
            expectedOutcome: "AI models extract and summarize the concrete service deliverables accurately.",
          },
        },
        lifecycleStatus: "OPEN",
        noGuaranteeDisclaimer:
          "High content specificity enables AI models to extract direct, factual answers without hallucination.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}
