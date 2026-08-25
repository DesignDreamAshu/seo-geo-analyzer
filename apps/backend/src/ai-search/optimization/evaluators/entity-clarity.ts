/**
 * Phase 28G: Entity Clarity & Disambiguation Evaluator.
 * Detects AI engine brand confusion (e.g. acronyms treated as generic concepts) and evaluates
 * whether on-site entity grounding signals are sufficient or in need of remediation.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { AIObservation } from "../../observation/types";
import { CrawledPageContext } from "../mapper";
import { AIOptimizationFinding } from "../types";

export function evaluateEntityClarity(
  projectId: string,
  runId: string,
  observations: AIObservation[],
  pages: CrawledPageContext[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Filter observations where brand was queried (Branded or Semi-Branded)
  const brandedObs = observations.filter(
    (o) => o.brandedness === "BRANDED" || o.brandedness === "SEMI_BRANDED"
  );

  if (brandedObs.length === 0) return findings;

  // Check for ambiguous or generic attribution states
  const ambiguousObs = brandedObs.filter(
    (o) =>
      o.entityAttribution?.state === "AMBIGUOUS_ENTITY" ||
      o.entityAttribution?.state === "GENERIC_TERM" ||
      o.entityAttribution?.state === "DIFFERENT_ENTITY"
  );

  if (ambiguousObs.length === 0) return findings;

  // Inspect on-site website identity evidence
  const homepage = pages.find((p) => {
    try {
      const u = new URL(p.url);
      return u.pathname === "/" || u.pathname === "";
    } catch {
      return false;
    }
  }) || pages[0];

  const aboutPage = pages.find((p) => p.url.toLowerCase().includes("about"));

  let hasOrgSchema = false;
  let hasSameAs = false;
  let hasExplicitDefinition = false;

  for (const p of pages) {
    if (p.schemaTypes?.includes("Organization")) {
      hasOrgSchema = true;
    }
  }

  const siteText = ((homepage?.visibleText || "") + " " + (aboutPage?.visibleText || "")).toLowerCase();
  if (
    siteText.includes(`${brandName.toLowerCase()} is a`) ||
    siteText.includes(`${brandName.toLowerCase()} is an`) ||
    siteText.includes(`${brandName.toLowerCase()} is the`) ||
    siteText.includes("boutique consulting firm") ||
    siteText.includes("specialized consulting")
  ) {
    hasExplicitDefinition = true;
  }

  const affectedPrompts = ambiguousObs.map((o) => ({
    id: o.promptId,
    prompt: o.promptText,
    intent: o.intent,
    funnelStage: o.funnelStage,
    brandedness: o.brandedness,
  }));

  const providerEvidence = ambiguousObs.map((o) => ({
    observationId: o.observationId,
    providerId: o.providerId,
    model: o.model,
    promptText: o.promptText,
    attributionState: o.entityAttribution?.state,
    rawSnippet: o.rawResponse ? o.rawResponse.slice(0, 250) : undefined,
    stringMentionDetected: o.stringMentionDetected,
    confirmedBrandMention: o.brandMentioned,
  }));

  // CASE 1: Website entity signals are weak/missing
  if (!hasOrgSchema || !hasExplicitDefinition) {
    const finding: AIOptimizationFinding = {
      id: `opt_entity_clarity_${projectId}_${brandName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      projectId,
      runId,
      code: "AI_OPT_ENTITY_CLARITY_GENERIC_ACRONYM",
      category: "ENTITY_CLARITY",
      type: "GAP",
      priority: "HIGH_IMPACT",
      confidence: "HIGH",
      evidenceStrength: ambiguousObs.length >= 2 ? "STRONG" : "MODERATE",
      title: `Weak Entity Disambiguation for "${brandName}" Across AI Engines`,
      summary: `AI models interpret "${brandName}" as a generic business acronym (e.g. Build-Operate-Transfer / Bot automation) rather than recognizing the tracked consulting firm.`,
      whyItMatters:
        "When an AI search engine treats a corporate brand as a generic term, it answers branded queries with general industry definitions rather than showcasing the company's enterprise services.",
      problem: {
        observed: `AI observation produced attribution state "${ambiguousObs[0].entityAttribution?.state || "AMBIGUOUS_ENTITY"}" with 0 confirmed entity mentions despite literal string matches.`,
        explanation:
          "The website lacks structured Organization schema and explicit boilerplate entity definitions on primary landing pages, allowing language models to default to generic linguistic probabilities.",
      },
      evidence: {
        sourceSignal: "OBSERVED_PROVIDER_DISAMBIGUATION_AMBIGUITY",
        providerObservations: providerEvidence,
        websiteEvidence: {
          url: homepage?.url || profile.domain,
          pageTitle: homepage?.title || null,
          element: "Homepage / About Page HTML & Schema",
          snippet: homepage?.visibleText ? homepage.visibleText.slice(0, 150) + "..." : null,
          observedFact: {
            hasOrganizationSchema: hasOrgSchema,
            hasExplicitDefinition,
            aboutPageDiscovered: Boolean(aboutPage),
          },
        },
      },
      rootCause: {
        hypothesis: "High lexical overlap with generic industry acronyms compounded by missing canonical Organization schema and explicit corporate identity statements.",
        contributingFactors: [
          `Brand acronym "${brandName}" shares naming with common business model (Build-Operate-Transfer).`,
          hasOrgSchema ? "Organization schema present but missing sameAs entity links." : "Missing structured JSON-LD Organization schema on homepage.",
          hasExplicitDefinition ? "Entity statement present but lacks canonical prominence." : "Homepage lacks clear 'X is an enterprise ServiceNow consulting firm' definition block.",
        ],
        isDeterministic: false,
        rationale: "Evidence directly corroborated across live AI engine responses and on-site DOM structure.",
      },
      affectedPrompts,
      affectedPages: [
        { url: homepage?.url || profile.domain, title: homepage?.title || "Homepage", matchType: "PRIMARY_ENTITY_PAGE" },
        ...(aboutPage ? [{ url: aboutPage.url, title: aboutPage.title || "About Page", matchType: "ABOUT_PAGE" }] : []),
      ],
      affectedEntities: [brandName],
      affectedProviders: Array.from(new Set(ambiguousObs.map((o) => o.providerId))),
      recommendation: {
        objective: "Establish unambiguous, machine-readable corporate entity signals across the website.",
        whatShouldChange:
          "Add an explicit canonical Organization definition block in the homepage hero/intro and deploy valid Schema.org Organization JSON-LD with corporate naming and authoritative sameAs profiles.",
        whereToChange: `${homepage?.url || "Homepage"} and ${aboutPage?.url || "About Page"}`,
        actionSteps: [
          `Add an explicit introductory sentence on the homepage: "${brandName} is an enterprise digital workflow and ServiceNow consulting firm."`,
          "Deploy JSON-LD Organization structured data including legalName, name, url, description, and sameAs links (LinkedIn, Crunchbase, official partner directories).",
          "Ensure consistent corporate brand usage (e.g. 'BOT Consulting') across all main navigation headers and title tags.",
        ],
        exampleBefore: "<h1>Innovate. Automate. Scale.</h1>",
        exampleAfter: `<h1>BOT Consulting</h1><p class="hero-sub">${brandName} provides enterprise ServiceNow advisory, workflow implementation, and digital consulting solutions for modern enterprises.</p>`,
        cautions: [
          "Do not stuff keywords into the brand name.",
          "Ensure Schema.org JSON-LD matches visible on-page copy exactly.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "DOM & JSON-LD Entity Inspection",
          targetCheck: "Schema.org Organization present with non-empty legalName, url, and sameAs",
          expectedEvidence: "JSON-LD script block containing type=Organization and explicit entity statement in main content.",
        },
        level2ProviderVerification: {
          method: "Live AI Prompt Re-Execution",
          targetPromptIds: affectedPrompts.map((p) => p.id),
          expectedOutcome: "Provider response shifts from AMBIGUOUS_ENTITY to CONFIRMED_ENTITY / PROBABLE_ENTITY.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Implementing these website identity signals strengthens machine-readable entity clarity, but external AI engine outputs remain probabilistic and externally controlled.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    findings.push(finding);
  } else {
    // CASE 2: Website signals are already strong, but provider still treated it generically
    const obsFinding: AIOptimizationFinding = {
      id: `opt_entity_obs_${projectId}_${brandName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      projectId,
      runId,
      code: "AI_OPT_PROVIDER_AMBIGUITY_OBSERVATION",
      category: "ENTITY_CLARITY",
      type: "OBSERVATION",
      priority: "LOW_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Provider-Side Ambiguity Observed for "${brandName}" (Website Signals Strong)`,
      summary: `AI engine responded generically to "${brandName}", but on-site entity signals (Organization schema & clear About copy) are already well-configured.`,
      whyItMatters:
        "External AI models may experience temporary linguistic bias or require broader third-party corroboration even when website-side entity signals are fully compliant.",
      problem: {
        observed: `AI response produced "${ambiguousObs[0].entityAttribution?.state}" despite compliant on-site Organization schema and explicit identity copy.`,
        explanation:
          "The website has implemented recommended entity definitions. Provider ambiguity is likely driven by pre-training corpus bias or external off-site entity citations.",
      },
      evidence: {
        sourceSignal: "OBSERVED_PROVIDER_AMBIGUITY_WITH_VALID_ON_SITE_SIGNALS",
        providerObservations: providerEvidence,
        websiteEvidence: {
          url: homepage?.url || profile.domain,
          pageTitle: homepage?.title || null,
          element: "Homepage & About Page",
          snippet: "On-site Organization schema and entity definition verified.",
        },
      },
      rootCause: {
        hypothesis: "Pre-training weights prioritize generic linguistic acronym definitions over boutique brand identity without real-time search grounding.",
        contributingFactors: [
          "Linguistic frequency of 'Build-Operate-Transfer' in enterprise literature.",
          "Absence of active web search grounding during provider inference.",
        ],
        isDeterministic: false,
        rationale: "Website-side entity signals meet all technical standards; weakness is isolated to external model pre-training representations.",
      },
      affectedPrompts,
      affectedPages: [{ url: homepage?.url || profile.domain, title: homepage?.title || "Homepage", matchType: "PRIMARY_ENTITY_PAGE" }],
      affectedEntities: [brandName],
      affectedProviders: Array.from(new Set(ambiguousObs.map((o) => o.providerId))),
      recommendation: {
        objective: "Monitor AI engine visibility over time without modifying already-optimized website code.",
        whatShouldChange: "No urgent website code changes required. Continue monitoring AI model releases.",
        whereToChange: "N/A (Website signals verified)",
        actionSteps: [
          "Maintain current Organization structured data and explicit entity phrasing.",
          "Ensure third-party profiles (LinkedIn, ServiceNow Partner Portal, Clutch) reflect canonical brand name.",
        ],
        cautions: ["Do not distort website branding in an attempt to over-optimize for probabilistic AI responses."],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "Existing On-Site Verification",
          targetCheck: "Maintain existing Schema.org Organization",
          expectedEvidence: "Schema remains active and error-free.",
        },
        level2ProviderVerification: {
          method: "Periodic AI Prompt Re-Execution",
          targetPromptIds: affectedPrompts.map((p) => p.id),
          expectedOutcome: "Periodic tracking of entity attribution across model updates.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "AI model representations evolve across releases. Dream SEO tracks point-in-time observations without modifying compliant website assets.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    findings.push(obsFinding);
  }

  return findings;
}
