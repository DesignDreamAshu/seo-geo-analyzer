/**
 * Phase 28G: Source Citation Readiness & Grounding Gating Evaluator.
 * Evaluates on-site source substantiation, evidence references, and first-party proof,
 * while strictly gating provider citation claims when search grounding is unavailable.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { AIObservation } from "../../observation/types";
import { CrawledPageContext } from "../mapper";
import { AIOptimizationFinding } from "../types";

export function evaluateSourceReadiness(
  projectId: string,
  runId: string,
  observations: AIObservation[],
  pages: CrawledPageContext[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Check if live grounding was active on any observation
  const groundedObs = observations.filter((o) => o.groundingState === "GROUNDING_ACTIVE");
  const groundingUnavailable = observations.some(
    (o) => o.groundingState === "GROUNDING_NOT_ACTIVE" || o.groundingState === "CITATIONS_NOT_OBSERVED_GROUNDING_DISABLED"
  );

  // 1. On-Site Source & Evidence Readiness Check
  const pagesWithUnsubstantiatedClaims: CrawledPageContext[] = [];
  for (const page of pages) {
    const text = (page.visibleText || "").toLowerCase();
    // Check if page makes strong quantitative or performance claims without cited sources or case studies
    const hasUnsubstantiatedClaim =
      (text.includes("%") || text.includes("proven") || text.includes("guaranteed") || text.includes("industry leading")) &&
      !text.includes("case study") &&
      !text.includes("source:") &&
      !text.includes("report") &&
      !text.includes("gartner") &&
      !text.includes("forrester");

    if (hasUnsubstantiatedClaim) {
      pagesWithUnsubstantiatedClaims.push(page);
    }
  }

  if (pagesWithUnsubstantiatedClaims.length > 0) {
    findings.push({
      id: `opt_src_readiness_claims_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_SOURCE_READINESS_UNSUBSTANTIATED_CLAIMS",
      category: "SOURCE_CITATION_READINESS",
      type: "OPPORTUNITY",
      priority: "MEDIUM_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Unsubstantiated Performance Claims on ${pagesWithUnsubstantiatedClaims.length} Website Pages`,
      summary: `Pages make quantitative performance assertions without linking to first-party case studies or third-party authoritative sources.`,
      whyItMatters:
        "AI engines equipped with web search grounding favor sources that substantiate claims with attributable facts, verified metrics, and author identity.",
      problem: {
        observed: `${pagesWithUnsubstantiatedClaims.length} page(s) contain quantitative/superlative statements without accompanying source citations or case studies.`,
        explanation:
          "On-site content makes assertions (e.g. percentage improvements, industry-leading claims) without traceable data points or linked customer proof.",
      },
      evidence: {
        sourceSignal: "ON_SITE_EVIDENCE_SUBSTANTIATION_AUDIT",
        websiteEvidence: {
          url: pagesWithUnsubstantiatedClaims[0].url,
          pageTitle: pagesWithUnsubstantiatedClaims[0].title || null,
          element: "Main Content Claims",
          snippet: pagesWithUnsubstantiatedClaims[0].visibleText ? pagesWithUnsubstantiatedClaims[0].visibleText.slice(0, 150) + "..." : null,
          observedFact: {
            affectedPagesCount: pagesWithUnsubstantiatedClaims.length,
            sampleUrls: pagesWithUnsubstantiatedClaims.slice(0, 3).map((p) => p.url),
          },
        },
        groundingStatus: groundedObs.length > 0 ? "GROUNDING_ACTIVE" : "PROVIDER_EVIDENCE_UNAVAILABLE",
        groundingDetails:
          groundedObs.length > 0
            ? "Evaluated alongside active provider search grounding."
            : "Search grounding was unavailable on provider tier. Evaluated strictly as an on-site source readiness audit without fabricating provider citation gaps.",
      },
      rootCause: {
        hypothesis: "Marketing copy emphasizes persuasive value propositions without embedding verifiable data sources or client case links.",
        contributingFactors: [
          "Performance claims are stated as general slogans.",
          "Case studies are not linked directly alongside specific capability claims.",
        ],
        isDeterministic: true,
        rationale: "Deterministic lexical inspection confirmed presence of quantitative claims lacking cited evidence anchors.",
      },
      affectedPrompts: [],
      affectedPages: pagesWithUnsubstantiatedClaims.map((p) => ({
        url: p.url,
        title: p.title || null,
        matchType: "UNSUBSTANTIATED_CLAIMS_PAGE",
      })),
      affectedEntities: [brandName],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      recommendation: {
        objective: "Anchor quantitative and performance claims with first-party case study links and attributable data.",
        whatShouldChange:
          "Attach verifiable proof (e.g. client results, specific metrics, link to case study) to major capability and efficiency claims.",
        whereToChange: pagesWithUnsubstantiatedClaims.map((p) => p.url).join(", "),
        actionSteps: [
          "Identify superlative claims on key service pages and add supporting context (e.g. 'reduced incident resolution time by 40% across a 10,000-seat enterprise deployment').",
          "Link directly to a published case study or whitepaper substantiating the outcome.",
          "Include clear author or corporate practice leader attribution on technical guides.",
        ],
        exampleBefore: "<p>We deliver 100% reliable enterprise workflow automation.</p>",
        exampleAfter: `<p>In a recent ServiceNow HRSD deployment for an enterprise healthcare client, ${brandName} reduced ticket onboarding cycle time by 45% (<a href="/case-studies/healthcare-workflow">view case study</a>).</p>`,
        cautions: ["Ensure all cited metrics reflect actual client engagements."],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "On-Site Evidence Link Inspection",
          targetCheck: "Performance claims are accompanied by valid supporting links or methodology notes",
          expectedEvidence: "Re-audit confirms verifiable evidence anchors for major claims.",
        },
        level2ProviderVerification: {
          method: "Grounded AI Retrieval Query",
          targetPromptIds: [],
          expectedOutcome: "Search-grounded AI engines cite the specific page and quote the substantiated metric.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Substantiated content improves factual extractability. Citation inclusion depends on external search grounding algorithms.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
