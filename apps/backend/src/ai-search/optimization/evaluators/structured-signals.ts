/**
 * Phase 28G: Structured Entity Signals Evaluator.
 * Evaluates Schema.org entity markup on relevant landing pages, ensuring valid
 * machine-readable entity graph connections without recommending invalid/fake markup.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { CrawledPageContext } from "../mapper";
import { AIOptimizationFinding } from "../types";

export function evaluateStructuredSignals(
  projectId: string,
  runId: string,
  pages: CrawledPageContext[],
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  // Check key commercial service/solution pages for missing Schema.org Service markup
  const servicePages = pages.filter((p) => {
    const urlLower = p.url.toLowerCase();
    const isBlogOrNews = urlLower.includes("/post/") || urlLower.includes("/blogs") || urlLower.includes("/news/");
    const isJobOrLegal = urlLower.includes("/jobopenings/") || urlLower.includes("/privacy") || urlLower.includes("/terms");
    if (isBlogOrNews || isJobOrLegal) return false;

    return (
      urlLower.includes("/solution-") ||
      urlLower.endsWith("/solutions") ||
      urlLower.endsWith("/solutions/") ||
      urlLower.includes("/service") ||
      urlLower.includes("/cloudsmith") ||
      urlLower.includes("/odyssey")
    );
  });

  const missingServiceSchemaPages = servicePages.filter(
    (p) => !p.schemaTypes || (!p.schemaTypes.includes("Service") && !p.schemaTypes.includes("ProfessionalService"))
  );

  if (missingServiceSchemaPages.length > 0) {
    findings.push({
      id: `opt_struct_service_schema_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_STRUCTURED_ENTITY_SERVICE_SCHEMA_MISSING",
      category: "STRUCTURED_ENTITY_SIGNAL",
      type: "OPPORTUNITY",
      priority: "MEDIUM_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Missing Structured "Service" Schema on ${missingServiceSchemaPages.length} Core Solution Pages`,
      summary: `Primary service landing pages lack Schema.org Service / ProfessionalService structured data linking offerings to "${brandName}".`,
      whyItMatters:
        "Structured entity data explicitly defines service deliverables, provider identity, service type, and target audience in machine-readable JSON-LD, making entity relationships directly extractable by AI scrapers and indexers.",
      problem: {
        observed: `${missingServiceSchemaPages.length} service page(s) contain HTML copy but 0 valid Schema.org Service or ProfessionalService JSON-LD blocks.`,
        explanation:
          "Without structured Service schema, AI search crawlers must rely solely on NLP heuristics to infer service boundaries, provider ownership, and offering relationships.",
      },
      evidence: {
        sourceSignal: "DOM_JSON_LD_SCHEMA_AUDIT",
        websiteEvidence: {
          url: missingServiceSchemaPages[0].url,
          pageTitle: missingServiceSchemaPages[0].title || null,
          element: "HTML <head> / JSON-LD Scripts",
          observedFact: {
            servicePagesCount: servicePages.length,
            missingSchemaPagesCount: missingServiceSchemaPages.length,
            samplePages: missingServiceSchemaPages.slice(0, 3).map((p) => p.url),
          },
        },
      },
      rootCause: {
        hypothesis: "Website templates do not automatically inject Schema.org Service JSON-LD blocks on capability pages.",
        contributingFactors: [
          "CMS template renders visual content without corresponding structured data graph.",
          "Service entity relationships are only expressed in visual HTML paragraphs.",
        ],
        isDeterministic: true,
        rationale: "Deterministic inspection of JSON-LD scripts across all crawled service pages.",
      },
      affectedPrompts: [],
      affectedPages: missingServiceSchemaPages.map((p) => ({
        url: p.url,
        title: p.title || null,
        matchType: "SERVICE_PAGE",
      })),
      affectedEntities: [brandName],
      affectedProviders: ["OPENAI", "GEMINI", "PERPLEXITY"],
      recommendation: {
        objective: "Deploy valid Schema.org Service JSON-LD on all core capability and solution pages.",
        whatShouldChange:
          "Inject a JSON-LD script defining the service name, serviceType, provider (Organization), areaServed, and description matching visible page content.",
        whereToChange: missingServiceSchemaPages.map((p) => p.url).join(", "),
        actionSteps: [
          "Add a Schema.org `Service` JSON-LD block to each service page template.",
          `Link the provider property directly to the canonical organization: {"@type": "Organization", "name": "${brandName}", "url": "${profile.domain}"}.`,
          "Ensure service name and description faithfully match the visible H1 and introductory copy.",
        ],
        exampleBefore: "<!-- No JSON-LD Service schema present -->",
        exampleAfter: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "ServiceNow Advisory & Implementation",
  "serviceType": "Enterprise Workflow Consulting",
  "provider": {
    "@type": "Organization",
    "name": "${brandName}",
    "url": "${profile.domain}"
  },
  "description": "Enterprise ServiceNow advisory, workflow implementation, and digital consulting solutions."
}
</script>`,
        cautions: [
          "Do not add fake FAQ schema.",
          "Do not include services or guarantees that are not visibly stated on the page.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "JSON-LD Structure & Schema Validation",
          targetCheck: "Schema.org Service block present with valid provider, name, and description",
          expectedEvidence: "Valid JSON-LD block detected with @type=Service and provider matching brand.",
        },
        level2ProviderVerification: {
          method: "AI Engine Entity Relationship Query",
          targetPromptIds: [],
          expectedOutcome: "AI models correctly associate the specific service offering with the brand entity.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "Structured data clarifies machine readability. It does not guarantee priority ranking or inclusion in AI search responses.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
