/**
 * Phase 28C: Deterministic AI Search Readiness Scoring Contract (Methodology: ai-readiness-v2 / v28c-2.0).
 * Defines versioning, pillar weights, evaluator definitions, eligibility, and historical comparability.
 */

import type {
  AISearchPillar,
  EvaluationStatus,
  EvaluatorStatus,
  EvaluatorResult,
} from "../types";

export interface EvaluatorDefinition {
  id: string;
  name: string;
  pillar: AISearchPillar;
  weight: number;
  aggregationLevel: "SITE_LEVEL" | "PAGE_LEVEL" | "PROMPT_LEVEL" | "ENTITY_LEVEL";
  description: string;
  threshold: string;
  scoringScale: "DISCRETE_5_STEP" | "CONTINUOUS_NORMALIZED" | "BINARY";
}

export const SCORING_MODEL_VERSION = "v28c-2.1";
export const METHODOLOGY_VERSION = "ai-readiness-v2";

export const PILLAR_WEIGHTS: Record<AISearchPillar, number> = {
  TECHNICAL: 25,
  AEO: 25,
  GEO: 25,
  ENTITY_LLM: 25,
};

export const EVALUATOR_DEFINITIONS: Record<string, EvaluatorDefinition> = {
  // AIO / Technical (Sum = 100)
  AIO_ROBOTS_AI_AGENTS: {
    id: "AIO_ROBOTS_AI_AGENTS",
    name: "AI Search Retrieval Crawler Directives",
    pillar: "TECHNICAL",
    weight: 20,
    aggregationLevel: "SITE_LEVEL",
    description: "Evaluates robots.txt permissions for primary AI search retrieval bots (OAI-SearchBot, PerplexityBot, ClaudeBot, Bingbot).",
    threshold: "100% of primary search retrieval bots permitted with HTTP 200 or default allow.",
    scoringScale: "DISCRETE_5_STEP",
  },
  AIO_RENDERED_CONTENT_AVAILABILITY: {
    id: "AIO_RENDERED_CONTENT_AVAILABILITY",
    name: "Server-Delivered Textual Availability (SSR / SSG)",
    pillar: "TECHNICAL",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    description: "Evaluates the proportion of indexable pages delivering complete body copy in raw initial HTML without client hydration dependency.",
    threshold: ">= 85% of pages deliver text without client hydration dependency.",
    scoringScale: "DISCRETE_5_STEP",
  },
  AIO_INDEXABLE_CORPUS_HYGIENE: {
    id: "AIO_INDEXABLE_CORPUS_HYGIENE",
    name: "Clean Canonical Indexability Ratio",
    pillar: "TECHNICAL",
    weight: 20,
    aggregationLevel: "SITE_LEVEL",
    description: "Measures the ratio of clean, canonical 200 OK indexable HTML pages versus crawl errors, redirects, or non-indexable URLs.",
    threshold: ">= 90% of discovered crawl corpus is canonical and indexable.",
    scoringScale: "DISCRETE_5_STEP",
  },
  AIO_SEMANTIC_STRUCTURE: {
    id: "AIO_SEMANTIC_STRUCTURE",
    name: "Semantic DOM Landmarks (<main>, <article>, <header>)",
    pillar: "TECHNICAL",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures the presence of semantic HTML5 landmark tags enabling clear content boundary extraction for LLM parsers.",
    threshold: ">= 80% of pages contain semantic landmark containers.",
    scoringScale: "DISCRETE_5_STEP",
  },
  AIO_STRUCTURED_DATA_SYNTAX: {
    id: "AIO_STRUCTURED_DATA_SYNTAX",
    name: "Machine-Readable Schema Presence & Syntax",
    pillar: "TECHNICAL",
    weight: 15,
    aggregationLevel: "PAGE_LEVEL",
    description: "Evaluates presence and syntax validity of JSON-LD structured data blocks across the indexable corpus.",
    threshold: ">= 70% of indexable pages include valid JSON-LD structured data.",
    scoringScale: "DISCRETE_5_STEP",
  },

  // AEO / Answer Readiness (Sum = 100)
  AEO_QUESTION_DIRECT_ANSWER: {
    id: "AEO_QUESTION_DIRECT_ANSWER",
    name: "Direct Answer Proximity under Question Headings",
    pillar: "AEO",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures whether question headings (e.g. 'What is...', 'How to...') are followed immediately by concise 15–80 word direct answer summaries.",
    threshold: ">= 75% of question headings followed immediately by concise answer blocks (15–80 words).",
    scoringScale: "CONTINUOUS_NORMALIZED",
  },
  AEO_PASSAGE_SELF_CONTAINMENT: {
    id: "AEO_PASSAGE_SELF_CONTAINMENT",
    name: "Passage Self-Containment (Explicit Entity Naming)",
    pillar: "AEO",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    description: "Checks that introductory answer passages name explicit entities rather than relying on ambiguous isolated pronouns ('it', 'they', 'this').",
    threshold: ">= 80% of section lead paragraphs begin with explicit entity subjects.",
    scoringScale: "CONTINUOUS_NORMALIZED",
  },
  AEO_FAQ_QNA_STRUCTURE: {
    id: "AEO_FAQ_QNA_STRUCTURE",
    name: "FAQPage / QAPage Structured Data Markup",
    pillar: "AEO",
    weight: 15,
    aggregationLevel: "SITE_LEVEL",
    description: "Checks for structured FAQPage or QAPage JSON-LD schema on high-intent service or support pages.",
    threshold: "At least 1 core service or support page implements structured FAQPage schema.",
    scoringScale: "BINARY",
  },
  AEO_LIST_TABLE_EXTRACTABILITY: {
    id: "AEO_LIST_TABLE_EXTRACTABILITY",
    name: "Extractable Bulleted, Numbered, and Tabular Data",
    pillar: "AEO",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures the presence of ordered lists, bulleted lists, and structured comparison tables for step-by-step AI extraction.",
    threshold: ">= 70% of indexable pages include structured list or table elements.",
    scoringScale: "DISCRETE_5_STEP",
  },
  AEO_PROMPT_UNIVERSE_COVERAGE: {
    id: "AEO_PROMPT_UNIVERSE_COVERAGE",
    name: "Corpus Coverage for Core Monitoring Prompts",
    pillar: "AEO",
    weight: 20,
    aggregationLevel: "PROMPT_LEVEL",
    description: "Evaluates the proportion of Tier 1 canonical monitoring prompts that have dedicated or relevant topical content pages in the site corpus.",
    threshold: ">= 80% of core monitoring prompts have candidate landing pages.",
    scoringScale: "DISCRETE_5_STEP",
  },

  // GEO / Evidence Readiness (Sum = 100)
  GEO_STATISTICAL_CLAIM_ATTRIBUTION: {
    id: "GEO_STATISTICAL_CLAIM_ATTRIBUTION",
    name: "Quantitative Statistical Claim Citation Rate",
    pillar: "GEO",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures the percentage of numerical/statistical benchmark claims accompanied by inline source hyperlinks or footnote citations.",
    threshold: ">= 70% of quantitative claims accompanied by source citation links.",
    scoringScale: "CONTINUOUS_NORMALIZED",
  },
  GEO_FIRST_PARTY_EVIDENCE_DENSITY: {
    id: "GEO_FIRST_PARTY_EVIDENCE_DENSITY",
    name: "First-Party Data, Case Studies & Proprietary Research",
    pillar: "GEO",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    description: "Evaluates the proportion of pages containing original research indicators, client case studies, benchmark indicators, or proprietary data.",
    threshold: ">= 40% of indexable pages include verifiable first-party evidence or case study outcomes.",
    scoringScale: "DISCRETE_5_STEP",
  },
  GEO_AUTHOR_ENTITY_CREDENTIALS: {
    id: "GEO_AUTHOR_ENTITY_CREDENTIALS",
    name: "Author Entity Verification & E-E-A-T Schema Linkage",
    pillar: "GEO",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures whether editorial and knowledge base articles declare explicit author Person schema with credentials and sameAs links.",
    threshold: ">= 80% of editorial articles declare structured Person author credentials.",
    scoringScale: "DISCRETE_5_STEP",
  },
  GEO_TEMPORAL_FRESHNESS_SIGNALS: {
    id: "GEO_TEMPORAL_FRESHNESS_SIGNALS",
    name: "Publication & Modification Timestamp Freshness",
    pillar: "GEO",
    weight: 15,
    aggregationLevel: "PAGE_LEVEL",
    description: "Evaluates the presence of explicit publication and modification timestamps in article metadata or JSON-LD schema.",
    threshold: ">= 80% of article/content pages declare explicit publication and modification timestamps.",
    scoringScale: "DISCRETE_5_STEP",
  },
  GEO_CONTENT_DEPTH_SUBSTANCE: {
    id: "GEO_CONTENT_DEPTH_SUBSTANCE",
    name: "Substantive Topical Depth & Section Breadth (>=350 words)",
    pillar: "GEO",
    weight: 15,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures the proportion of pages with substantive body copy (>350 words) suitable for RAG generative synthesis.",
    threshold: ">= 70% of indexable pages have >= 350 words of substantive body copy.",
    scoringScale: "DISCRETE_5_STEP",
  },

  // LLMO / Entity Grounding (Sum = 100)
  LLMO_ORGANIZATION_SCHEMA: {
    id: "LLMO_ORGANIZATION_SCHEMA",
    name: "Canonical Organization / Business Schema on Homepage",
    pillar: "ENTITY_LLM",
    weight: 25,
    aggregationLevel: "SITE_LEVEL",
    description: "Verifies structured @type: Organization or LocalBusiness JSON-LD schema on the homepage.",
    threshold: "Homepage must declare valid @type: Organization with name and url.",
    scoringScale: "BINARY",
  },
  LLMO_SAMEAS_AUTHORITY_ALIGNMENT: {
    id: "LLMO_SAMEAS_AUTHORITY_ALIGNMENT",
    name: "External Authority sameAs Disambiguation Profiles",
    pillar: "ENTITY_LLM",
    weight: 20,
    aggregationLevel: "SITE_LEVEL",
    description: "Checks for external authority profile links in Organization.sameAs for entity disambiguation in knowledge graphs.",
    threshold: ">= 2 verified external authority profile links in Organization.sameAs.",
    scoringScale: "DISCRETE_5_STEP",
  },
  LLMO_BRAND_IDENTITY_CONSISTENCY: {
    id: "LLMO_BRAND_IDENTITY_CONSISTENCY",
    name: "Brand Entity Naming Consistency Across Metadata & DOM",
    pillar: "ENTITY_LLM",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    description: "Measures consistency of brand naming across Title tags, OpenGraph siteName, and DOM headings across the site corpus.",
    threshold: ">= 80% of pages maintain consistent brand entity reference.",
    scoringScale: "DISCRETE_5_STEP",
  },
  LLMO_OFFERING_SERVICE_GROUNDING: {
    id: "LLMO_OFFERING_SERVICE_GROUNDING",
    name: "Core Product & Service Offering Hierarchy Grounding",
    pillar: "ENTITY_LLM",
    weight: 20,
    aggregationLevel: "ENTITY_LEVEL",
    description: "Evaluates grounding of discrete core offerings/services with dedicated URLs and structured context in the Knowledge Profile.",
    threshold: ">= 4 core service/product offerings extracted with evidence-backed provenance.",
    scoringScale: "DISCRETE_5_STEP",
  },
  LLMO_ENTITY_TOPIC_ASSOCIATION: {
    id: "LLMO_ENTITY_TOPIC_ASSOCIATION",
    name: "Topical Cluster & Industry Concept Association",
    pillar: "ENTITY_LLM",
    weight: 15,
    aggregationLevel: "ENTITY_LEVEL",
    description: "Measures the mapping of site content into recognized topical clusters and industry domain concepts.",
    threshold: ">= 5 distinct domain topic clusters mapped across site content.",
    scoringScale: "DISCRETE_5_STEP",
  },
};

/**
 * Evaluates comparability between two audit snapshot scoring versions.
 */
export function determineHistoricalComparability(
  versionA: string,
  versionB: string
): {
  isComparable: boolean;
  status: "DIRECTLY_COMPARABLE" | "COMPARABLE_WITH_CAVEAT" | "NOT_DIRECTLY_COMPARABLE";
  message: string;
} {
  if (versionA === versionB) {
    return {
      isComparable: true,
      status: "DIRECTLY_COMPARABLE",
      message: `Both snapshots evaluated under methodology version ${versionA}.`,
    };
  }

  // Major version difference: v28b vs v28c
  const majorA = versionA.split("-")[0] || versionA;
  const majorB = versionB.split("-")[0] || versionB;

  if (majorA === majorB) {
    return {
      isComparable: true,
      status: "COMPARABLE_WITH_CAVEAT",
      message: `Minor methodology revision between ${versionA} and ${versionB}. Scores are generally comparable.`,
    };
  }

  return {
    isComparable: false,
    status: "NOT_DIRECTLY_COMPARABLE",
    message: `Scoring methodology changed from ${versionA} to ${versionB} (calibrated granular readiness model). Score deltas reflect methodology improvements rather than site regression.`,
  };
}
