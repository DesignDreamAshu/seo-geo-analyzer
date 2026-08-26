/**
 * Phase 28H: Evidence Support & Claim Verification Evaluator.
 * Classifies on-page assertions into claim categories and evaluates whether material
 * quantitative or performance claims are backed by verifiable first-party case studies or attributable evidence.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { CrawledPageContext } from "../mapper";
import { AIOptimizationFinding } from "../types";

export type ClaimType =
  | "QUANTITATIVE_CLAIM"
  | "PERFORMANCE_CLAIM"
  | "MARKET_POSITION_CLAIM"
  | "CLIENT_OUTCOME_CLAIM"
  | "ORDINARY_MARKETING_CLAIM";

export interface ExtractedClaim {
  text: string;
  type: ClaimType;
  requiresSupport: boolean;
  isSupported: boolean;
  supportType?: "FIRST_PARTY_CASE_STUDY" | "ATTRIBUTABLE_METRIC" | "EXTERNAL_CITATION" | "NONE";
}

export function evaluateEvidenceSupport(
  projectId: string,
  runId: string,
  pages: CrawledPageContext[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  const unsupportedClaimPages: Array<{ page: CrawledPageContext; claims: ExtractedClaim[] }> = [];

  for (const page of pages) {
    const text = page.visibleText || "";
    // Split sentences without breaking decimal numbers (e.g. 99.9% or 3.5x)
    const sentences = text
      .split(/(?<!\d)\.(?!\d)\s+|[\n\r]+|[!?]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15);

    const extractedClaims: ExtractedClaim[] = [];

    for (const sentence of sentences) {
      const sLower = sentence.toLowerCase();

      // 1. Check for Quantitative Claim ($500M, 300%, 10x, 99.9%, etc.)
      const hasMetric =
        /\b\d+(?:\.\d+)?%/.test(sentence) ||
        /\$\d+(?:\.\d+)?[mkb]?\b/i.test(sentence) ||
        /\b\d+(?:\.\d+)?x\b/i.test(sentence) ||
        /\b\d+\+\s+(clients|enterprises|projects|engineers)\b/i.test(sentence);

      // 2. Check for Performance Claim (fastest, guaranteed, 0-downtime)
      const hasSuperlative =
        /\b(fastest|highest|guaranteed|zero-downtime|unrivaled|industry-leading)\b/i.test(sentence);

      if (hasMetric || hasSuperlative) {
        const type: ClaimType = hasMetric ? "QUANTITATIVE_CLAIM" : "PERFORMANCE_CLAIM";

        // Check if page contains nearby proof or case study links
        const hasCaseStudyLink =
          text.toLowerCase().includes("case study") ||
          text.toLowerCase().includes("client story") ||
          text.toLowerCase().includes("our work") ||
          (page.headings || []).some((h) => h.toLowerCase().includes("result") || h.toLowerCase().includes("proof"));

        extractedClaims.push({
          text: sentence.trim().slice(0, 150),
          type,
          requiresSupport: true,
          isSupported: hasCaseStudyLink,
          supportType: hasCaseStudyLink ? "FIRST_PARTY_CASE_STUDY" : "NONE",
        });
      }
    }

    const unbacked = extractedClaims.filter((c) => c.requiresSupport && !c.isSupported);
    if (unbacked.length > 0) {
      unsupportedClaimPages.push({ page, claims: unbacked });
    }
  }

  if (unsupportedClaimPages.length > 0) {
    const samplePages = unsupportedClaimPages.slice(0, 3);
    const affectedUrls = unsupportedClaimPages.map((u) => u.page.url);

    findings.push({
      id: `opt_evidence_unsupported_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_EVIDENCE_SUPPORT_UNANCHORED_CLAIMS",
      category: "EVIDENCE_SUPPORT",
      type: "OPPORTUNITY",
      priority: "MEDIUM_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Unanchored Quantitative & Performance Claims on ${unsupportedClaimPages.length} Website Pages`,
      summary: `Pages state numerical metrics or bold performance assertions without referencing verifiable case studies, methodologies, or primary data.`,
      whyItMatters:
        "Modern AI answer engines prioritize factual claims that link directly to authoritative evidence or first-party case studies. Unanchored numerical claims are frequently omitted by AI models due to hallucination-prevention filters.",
      problem: {
        observed: `${unsupportedClaimPages.length} page(s) feature quantitative claims (e.g. "${samplePages[0]?.claims[0]?.text}") without internal case study links or methodology citations.`,
        explanation:
          "Quantitative and performance statements lack direct attribution to first-party proof, methodology blueprints, or customer outcome summaries.",
      },
      evidence: {
        sourceSignal: "QUANTITATIVE_CLAIM_ATTRIBUTION_AUDIT",
        websiteEvidence: {
          url: samplePages[0]?.page.url || profile.domain,
          pageTitle: samplePages[0]?.page.title || null,
          element: "Body Copy & Hero Sections",
          observedFact: {
            affectedPagesCount: unsupportedClaimPages.length,
            sampleClaims: samplePages.map((s) => ({
              url: s.page.url,
              claim: s.claims[0]?.text,
              type: s.claims[0]?.type,
            })),
          },
        },
      },
      rootCause: {
        hypothesis: "Marketing copy emphasizes impressive figures without embedding contextual proof links or methodology footnotes.",
        contributingFactors: [
          "Case study repository is not linked directly from capability landing pages.",
          "Performance claims are stated as general facts without source context.",
        ],
        isDeterministic: true,
        rationale: "Deterministic extraction of quantitative regex metrics on pages with zero case study links or attribution.",
      },
      affectedPrompts: [],
      affectedPages: affectedUrls.map((url) => ({ url, matchType: "UNANCHORED_CLAIM_PAGE" })),
      affectedEntities: [brandName],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      supportingCategories: ["SOURCE_CITATION_READINESS"],
      supportingSignals: [
        `${unsupportedClaimPages.length} pages have quantitative claims without first-party case study links`,
      ],
      recommendation: {
        objective: "Anchor all numerical and performance claims with verifiable first-party case study links, client results, or methodology summaries.",
        whatShouldChange:
          "Attach a clickable link to a relevant case study, client outcome summary, or methodology whitepaper for every quantitative claim.",
        whereToChange: affectedUrls.join(", "),
        actionSteps: [
          "Link specific metric claims (e.g. scale figures, migration timelines) directly to the relevant case study or technical whitepaper.",
          "Add a short 'Evidence & Impact' section summarizing customer verification data.",
          "Ensure first-party evidence is published under an accessible URL on the domain.",
        ],
        cautions: [
          "Do not remove valid claims; simply anchor them with evidence.",
          "Do not invent fake third-party citations when first-party case studies are appropriate.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Claim Support Link Verification",
          targetCheck: "Quantitative metrics link to accessible case studies or contain verifiable footnotes",
          expectedEvidence: "DOM contains contextual links to /case-studies, /work, or published methodology pages.",
        },
        level2ProviderVerification: {
          method: "AI Engine Factual Citation Check",
          targetPromptIds: [],
          expectedOutcome: "AI models cite the specific metric alongside the brand's published case evidence.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Anchoring claims with verifiable evidence improves information credibility and citation retrieval probability in AI systems.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
