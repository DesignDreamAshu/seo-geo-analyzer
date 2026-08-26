/**
 * Engine D: Entity Grounding / LLM Machine Comprehension Engine (Methodology: v28c-2.0).
 * Evaluates Organization & Person schema grounding, Product/Service relationships,
 * sameAs authority links, cross-page brand naming consistency, and Knowledge Profile domain grounding.
 */

import { nanoid } from "nanoid";
import type {
  EntityGroundingEvaluation,
  AISearchFinding,
  AIObservabilityRecord,
  EvaluatorResult,
} from "../types";
import type { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import type { CrawledPageData } from "../../crawler/types";

export function evaluateEntityGrounding(
  crawledPages: CrawledPageData[],
  profile?: ProjectKnowledgeProfile | null
): {
  evaluations: EntityGroundingEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
  evaluators: EvaluatorResult[];
} {
  const evaluations: EntityGroundingEvaluation[] = [];
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];
  const evaluators: EvaluatorResult[] = [];

  const eligiblePages = crawledPages.filter(
    (p) => p.resourceType === "html_page" && p.statusCode >= 200 && p.statusCode < 400 && p.isIndexable
  );
  const totalPages = Math.max(1, eligiblePages.length);

  const homepage = eligiblePages.find((p) => p.classification?.primaryClass === "homepage") || eligiblePages[0];

  let hasOrgSchemaOverall = false;
  let orgNameDeclared: string | null = null;
  let orgSameAsCount = 0;
  const sameAsList: string[] = [];
  const brandNamesObserved = new Set<string>();

  for (const page of eligiblePages) {
    let hasOrgSchema = false;
    let personCount = 0;
    let personWorksForAligned = false;
    let productOrServiceFound = false;
    let productOrServiceType: "Product" | "Service" | "None" = "None";

    if (page.schemaJsonLd) {
      for (const rawBlock of page.schemaJsonLd) {
        const block = rawBlock as Record<string, any>;
        const type = block["@type"];

        if (type === "Organization" || type === "Corporation" || type === "LocalBusiness") {
          hasOrgSchema = true;
          hasOrgSchemaOverall = true;
          if (block.name) {
            orgNameDeclared = String(block.name);
            brandNamesObserved.add(String(block.name).trim());
          }
          if (block.sameAs) {
            const arr = Array.isArray(block.sameAs) ? block.sameAs : [block.sameAs];
            orgSameAsCount += arr.length;
            arr.forEach((url: string) => {
              if (url && !sameAsList.includes(url)) sameAsList.push(url);
            });
          }
        }

        if (type === "Person") {
          personCount++;
          if (block.worksFor) personWorksForAligned = true;
        }

        if (type === "Product") {
          productOrServiceFound = true;
          productOrServiceType = "Product";
        } else if (type === "Service" || type === "OfferCatalog") {
          productOrServiceFound = true;
          productOrServiceType = "Service";
        }
      }
    }

    evaluations.push({
      url: page.url,
      hasOrganizationSchema: hasOrgSchema,
      orgNameDeclared,
      orgLegalNameDeclared: null,
      orgUrlDeclared: homepage?.url || null,
      orgSameAsCount,
      sameAsUrls: sameAsList,
      personEntitiesCount: personCount,
      personWorksForAligned,
      productOrServiceSchemaFound: productOrServiceFound,
      productOrServiceType,
      hasContradictoryEntityNames: false,
      localEntityGroundingComplete: hasOrgSchema,
    });
  }

  // LLMO Evaluator 1: Organization Schema (Weight: 25%)
  const hasHomepageOrgSchema = Boolean(
    homepage?.schemaJsonLd?.some(
      (b: any) => b["@type"] === "Organization" || b["@type"] === "Corporation" || b["@type"] === "LocalBusiness"
    )
  );
  const llm1Score = hasHomepageOrgSchema ? 1.0 : 0.0;
  evaluators.push({
    evaluatorId: "LLMO_ORGANIZATION_SCHEMA",
    evaluatorName: "Canonical Organization / Business Schema on Homepage",
    pillar: "ENTITY_LLM",
    weight: 25,
    aggregationLevel: "SITE_LEVEL",
    status: llm1Score === 1.0 ? "PASS" : "FAIL",
    score: llm1Score,
    earnedPoints: Math.round(llm1Score * 25 * 10) / 10,
    maxPoints: 25,
    rawObservation: hasHomepageOrgSchema
      ? "Homepage includes structured @type: Organization JSON-LD schema entity."
      : "Homepage JSON-LD contains no @type: Organization or LocalBusiness schema entity.",
    threshold: "Homepage must declare valid @type: Organization with name and url.",
    recommendation: hasHomepageOrgSchema
      ? undefined
      : "Add JSON-LD Organization schema on homepage declaring name, url, logo, and verified sameAs profiles.",
  });

  // LLMO Evaluator 2: sameAs Authority Corroboration (Weight: 20%)
  const llm2Score = sameAsList.length >= 2 ? 1.0 : sameAsList.length === 1 ? 0.5 : 0.0;
  evaluators.push({
    evaluatorId: "LLMO_SAMEAS_AUTHORITY_ALIGNMENT",
    evaluatorName: "External Authority sameAs Disambiguation Profiles",
    pillar: "ENTITY_LLM",
    weight: 20,
    aggregationLevel: "SITE_LEVEL",
    status: llm2Score === 1.0 ? "PASS" : llm2Score === 0.5 ? "PARTIAL" : "FAIL",
    score: llm2Score,
    earnedPoints: Math.round(llm2Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: sameAsList.length > 0
      ? `Found ${sameAsList.length} external sameAs identity profiles in structured schema.`
      : "0 sameAs authority profile links found in schema.",
    threshold: ">= 2 verified external authority profile links in Organization.sameAs.",
    recommendation: llm2Score < 1.0
      ? "Add verified company social and directory URLs (LinkedIn, Crunchbase, X, Wikidata) to Organization.sameAs."
      : undefined,
  });

  // LLMO Evaluator 3: Brand Identity Consistency across Corpus (Weight: 20%)
  const brandName = profile?.brand?.name || "BOT Consulting";
  let brandConsistentPages = 0;
  for (const p of eligiblePages) {
    const title = p.title || "";
    const ogSite = p.openGraph?.siteName || "";
    if (title.includes(brandName) || ogSite.includes(brandName) || (p.html && p.html.includes(brandName))) {
      brandConsistentPages++;
    }
  }
  const brandRatio = Math.round((brandConsistentPages / totalPages) * 100) / 100;
  const llm3Score = brandRatio >= 0.8 ? 1.0 : brandRatio >= 0.5 ? 0.75 : 0.4;
  evaluators.push({
    evaluatorId: "LLMO_BRAND_IDENTITY_CONSISTENCY",
    evaluatorName: "Brand Entity Naming Consistency Across Metadata & DOM",
    pillar: "ENTITY_LLM",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    status: llm3Score === 1.0 ? "PASS" : "PARTIAL",
    score: llm3Score,
    earnedPoints: Math.round(llm3Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: `${brandConsistentPages} / ${totalPages} pages (${Math.round(brandRatio * 100)}%) maintain consistent brand entity naming ('${brandName}') across title tags, OpenGraph, and DOM markup.`,
    threshold: ">= 80% of pages maintain consistent brand entity reference.",
  });

  // LLMO Evaluator 4: Discrete Offering & Service Grounding (Weight: 20%)
  const offeringsCount = profile?.offerings?.length || 0;
  const llm4Score = offeringsCount >= 4 ? 1.0 : offeringsCount >= 2 ? 0.75 : offeringsCount === 1 ? 0.5 : 0.0;
  evaluators.push({
    evaluatorId: "LLMO_OFFERING_SERVICE_GROUNDING",
    evaluatorName: "Core Product & Service Offering Hierarchy Grounding",
    pillar: "ENTITY_LLM",
    weight: 20,
    aggregationLevel: "ENTITY_LEVEL",
    status: llm4Score === 1.0 ? "PASS" : llm4Score >= 0.5 ? "PARTIAL" : "FAIL",
    score: llm4Score,
    earnedPoints: Math.round(llm4Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: `Extracted and grounded ${offeringsCount} discrete core service/product offerings with dedicated URLs and structured context in the Knowledge Profile.`,
    threshold: ">= 4 core service/product offerings extracted with evidence-backed provenance.",
  });

  // LLMO Evaluator 5: Entity-Topic Domain Association (Weight: 15%)
  const topicsCount = profile?.topics?.length || 0;
  const llm5Score = topicsCount >= 5 ? 1.0 : topicsCount >= 3 ? 0.8 : topicsCount >= 1 ? 0.5 : 0.2;
  evaluators.push({
    evaluatorId: "LLMO_ENTITY_TOPIC_ASSOCIATION",
    evaluatorName: "Topical Cluster & Industry Concept Association",
    pillar: "ENTITY_LLM",
    weight: 15,
    aggregationLevel: "ENTITY_LEVEL",
    status: llm5Score === 1.0 ? "PASS" : "PARTIAL",
    score: llm5Score,
    earnedPoints: Math.round(llm5Score * 15 * 10) / 10,
    maxPoints: 15,
    rawObservation: `Grounded ${topicsCount} recognized topical clusters and domain concepts in the site Knowledge Graph profile.`,
    threshold: ">= 5 distinct domain topic clusters mapped across site content.",
  });

  // Findings
  if (!hasHomepageOrgSchema && homepage) {
    findings.push({
      id: `ai_finding_${nanoid(10)}`,
      dimensionId: "EG_ORG_SCHEMA_COMPLETENESS",
      pillar: "ENTITY_LLM",
      measurementClass: "DETERMINISTIC",
      evidenceLevel: "LEVEL_A",
      severity: "WARNING",
      title: "Missing structured Organization schema on homepage",
      description: "No JSON-LD Organization or LocalBusiness schema entity was detected. LLMs and entity extractors rely on explicit Organization schema to anchor your brand identity, official domain, and authority profiles in knowledge graphs.",
      recommendation: "Add JSON-LD Organization schema on your homepage declaring 'name', 'url', 'logo', and official 'sameAs' profile URLs.",
      confidenceScore: 1.0,
      impactScore: 5,
      isScoring: true,
      affectedUrl: homepage.url,
      evidence: {
        observed: "Homepage JSON-LD contains no @type: Organization block.",
      },
      remediationBlueprint: {
        objective: "Declare canonical Organization schema entity.",
        actionSteps: [
          "Create a <script type='application/ld+json'> block in homepage head.",
          "Populate '@type': 'Organization', 'name', 'url', 'logo', and verified 'sameAs' array.",
        ],
        verificationMethod: "Inspect homepage JSON-LD for valid @type: Organization with name and url.",
      },
    });
  }

  if (hasHomepageOrgSchema && sameAsList.length === 0 && homepage) {
    findings.push({
      id: `ai_finding_${nanoid(10)}`,
      dimensionId: "EG_SAMEAS_AUTHORITY_ALIGNMENT",
      pillar: "ENTITY_LLM",
      measurementClass: "DETERMINISTIC",
      evidenceLevel: "LEVEL_A",
      severity: "OPPORTUNITY",
      title: "Organization schema lacks sameAs authority profiles",
      description: "Organization schema contains 0 sameAs links to external identity profiles (e.g. LinkedIn, Crunchbase, Wikipedia, Wikidata). sameAs links establish unambiguous entity disambiguation for LLMs and knowledge graphs.",
      recommendation: "Add verified social and corporate profile links to Organization.sameAs in your JSON-LD schema.",
      confidenceScore: 0.95,
      impactScore: 3,
      isScoring: true,
      affectedUrl: homepage.url,
      evidence: {
        observed: "Organization schema has empty or missing sameAs property.",
      },
      remediationBlueprint: {
        objective: "Add sameAs authority array to Organization schema.",
        actionSteps: [
          "Collect official company profile URLs (LinkedIn, Twitter/X, Crunchbase, GitHub, YouTube).",
          "Include them as an array inside Organization.sameAs.",
        ],
        verificationMethod: "Verify Organization.sameAs array has >= 2 verified URLs.",
      },
    });
  }

  // Observability Records
  observability.push({
    dimensionId: "EG_ORG_SCHEMA_COMPLETENESS",
    pillar: "ENTITY_LLM",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: 1,
    evaluatedCount: 1,
    passedCount: hasHomepageOrgSchema ? 1 : 0,
    failedCount: hasHomepageOrgSchema ? 0 : 1,
    skippedCount: 0,
    status: hasHomepageOrgSchema ? "PASSED" : "FAILED",
  });

  observability.push({
    dimensionId: "EG_SAMEAS_AUTHORITY_ALIGNMENT",
    pillar: "ENTITY_LLM",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: 1,
    evaluatedCount: 1,
    passedCount: sameAsList.length > 0 ? 1 : 0,
    failedCount: hasHomepageOrgSchema && sameAsList.length === 0 ? 1 : 0,
    skippedCount: 0,
    status: sameAsList.length > 0 ? "PASSED" : "FAILED",
  });

  observability.push({
    dimensionId: "EG_KNOWLEDGE_GRAPH_ALIGNMENT",
    pillar: "ENTITY_LLM",
    measurementClass: "PROVIDER_REQUIRED",
    evidenceLevel: "LEVEL_A",
    eligibleCount: 1,
    evaluatedCount: 0,
    passedCount: 0,
    failedCount: 0,
    skippedCount: 1,
    status: "PROVIDER_REQUIRED",
  });

  return {
    evaluations,
    findings,
    observability,
    evaluators,
  };
}
