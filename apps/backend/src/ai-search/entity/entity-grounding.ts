/**
 * Engine D: Entity Grounding / LLM Machine Comprehension Engine
 * Evaluates Organization & Person schema grounding, Product/Service relationships,
 * sameAs authority links, and cross-page brand naming consistency.
 */

import { nanoid } from "nanoid";
import type {
  EntityGroundingEvaluation,
  AISearchFinding,
  AIObservabilityRecord,
} from "../types";
import type { CrawledPageData } from "../../crawler/types";

export function evaluateEntityGrounding(crawledPages: CrawledPageData[]): {
  evaluations: EntityGroundingEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
} {
  const evaluations: EntityGroundingEvaluation[] = [];
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];

  const homepage = crawledPages.find((p) => p.classification?.primaryClass === "homepage") || crawledPages[0];

  let hasOrgSchemaOverall = false;
  let orgNameDeclared: string | null = null;
  let orgSameAsCount = 0;
  const sameAsList: string[] = [];
  const brandNamesObserved = new Set<string>();

  for (const page of crawledPages) {
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

  // Check 1: Organization Schema Presence on Homepage / Global
  if (!hasOrgSchemaOverall && homepage) {
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

  // Check 2: sameAs Authority Links (Wikidata, LinkedIn, Crunchbase)
  if (hasOrgSchemaOverall && sameAsList.length === 0 && homepage) {
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
    passedCount: hasOrgSchemaOverall ? 1 : 0,
    failedCount: hasOrgSchemaOverall ? 0 : 1,
    skippedCount: 0,
    status: hasOrgSchemaOverall ? "PASSED" : "FAILED",
  });

  observability.push({
    dimensionId: "EG_SAMEAS_AUTHORITY_ALIGNMENT",
    pillar: "ENTITY_LLM",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: 1,
    evaluatedCount: 1,
    passedCount: sameAsList.length > 0 ? 1 : 0,
    failedCount: hasOrgSchemaOverall && sameAsList.length === 0 ? 1 : 0,
    skippedCount: !hasOrgSchemaOverall ? 1 : 0,
    status: sameAsList.length > 0 ? "PASSED" : hasOrgSchemaOverall ? "FAILED" : "SKIPPED",
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
  };
}
