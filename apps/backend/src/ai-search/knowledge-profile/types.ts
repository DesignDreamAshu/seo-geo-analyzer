/**
 * Phase 28C: Project Knowledge Profile Types & Data Contracts.
 * Strictly isolated from traditional SEO diagnostic rules.
 */

export type KnowledgeSourceType =
  | "WEBSITE_EXPLICIT"
  | "STRUCTURED_DATA"
  | "GSC"
  | "KEYWORD_DATA"
  | "SERP_DATA"
  | "USER_CONFIRMED"
  | "EXTERNAL_PROVIDER"
  | "INFERRED";

export type KnowledgeItemStatus =
  | "CONFIRMED"
  | "DETECTED"
  | "NEEDS_REVIEW"
  | "REJECTED";

export interface EvidenceProvenance {
  sourceType: KnowledgeSourceType;
  sourceUrl?: string;
  sourceField?: string;
  evidenceSnippet?: string;
  confidence: number; // 0.0 - 1.0
  observedAt: string;
}

export type OfferingType =
  | "SERVICE"
  | "PRODUCT"
  | "PLATFORM"
  | "SOLUTION"
  | "FEATURE"
  | "PACKAGE"
  | "OTHER";

export type OfferingImportance =
  | "PRIMARY"
  | "SECONDARY"
  | "SUPPORTING"
  | "INCIDENTAL";

export interface OfferingItem {
  id: string;
  name: string;
  canonicalName: string;
  aliases: string[];
  type: OfferingType;
  importance: OfferingImportance;
  description: string;
  supportingUrls: string[];
  confidence: number;
  status: KnowledgeItemStatus;
  userOverride?: boolean;
  audiences: string[];
  industries: string[];
  relatedTopics: string[];
  provenance: EvidenceProvenance[];
}

export type EntityType =
  | "ORGANIZATION"
  | "PERSON"
  | "SERVICE"
  | "PRODUCT"
  | "PLATFORM"
  | "TECHNOLOGY"
  | "INDUSTRY"
  | "LOCATION"
  | "CUSTOMER_TYPE"
  | "PROBLEM"
  | "CONCEPT"
  | "COMPETITOR";

export type EntityRelationshipType =
  | "OFFERS"
  | "SERVES"
  | "OPERATES_IN"
  | "SPECIALIZES_IN"
  | "INTEGRATES_WITH"
  | "USES"
  | "SOLVES"
  | "COMPETES_WITH"
  | "FOUNDED_BY"
  | "WORKS_FOR"
  | "TARGETS"
  | "RELATED_TO";

export interface EntityNode {
  id: string;
  name: string;
  type: EntityType;
  confidence: number;
  status: KnowledgeItemStatus;
  attributes: Record<string, any>;
  provenance: EvidenceProvenance[];
}

export interface EntityRelationship {
  sourceEntityId: string;
  targetEntityId: string;
  relationship: EntityRelationshipType;
  confidence: number;
  provenance: EvidenceProvenance[];
}

export type TopicClassification =
  | "CORE"
  | "SUPPORTING"
  | "ADJACENT"
  | "EXPERIMENTAL";

export interface TopicItem {
  id: string;
  name: string;
  slug: string;
  classification: TopicClassification;
  relevanceScore: number; // 0 - 100
  parentTopicId?: string;
  subTopicIds: string[];
  relatedOfferingIds: string[];
  contentCoverageCount: number;
  confidence: number;
  status: KnowledgeItemStatus;
  provenance: EvidenceProvenance[];
}

export interface AudienceSegment {
  id: string;
  name: string;
  roleOrType: string;
  buyerStage: "DECISION_MAKER" | "TECHNICAL_EVALUATOR" | "END_USER" | "EXECUTIVE";
  confidence: number;
  status: KnowledgeItemStatus;
  relatedOfferingIds: string[];
  provenance: EvidenceProvenance[];
}

export type IndustryEvidenceLevel =
  | "EXPLICITLY_SERVED"
  | "CASE_STUDY_EVIDENCE"
  | "CONTENT_RELEVANCE"
  | "INFERRED";

export interface IndustryServed {
  id: string;
  name: string;
  evidenceLevel: IndustryEvidenceLevel;
  confidence: number;
  status: KnowledgeItemStatus;
  supportingUrls: string[];
  provenance: EvidenceProvenance[];
}

export type LocationScope =
  | "PHYSICAL_LOCATION"
  | "SERVICE_MARKET"
  | "CONTENT_TARGET"
  | "SEARCH_DEMAND_MARKET";

export interface GeographicMarket {
  id: string;
  name: string;
  countryCode?: string;
  region?: string;
  scope: LocationScope;
  confidence: number;
  status: KnowledgeItemStatus;
  provenance: EvidenceProvenance[];
}

export interface ProblemStatement {
  id: string;
  problem: string;
  solutionSummary: string;
  relatedOfferingId?: string;
  targetAudienceId?: string;
  confidence: number;
  status: KnowledgeItemStatus;
  provenance: EvidenceProvenance[];
}

export interface DifferentiatorItem {
  id: string;
  claim: string;
  evidenceBacked: boolean;
  category: "CERTIFICATION" | "PROPRIETARY_TECH" | "SPECIALIZED_EXPERTISE" | "DELIVERY_MODEL" | "VERIFIED_OUTCOME" | "UNSUPPORTED_CLAIM";
  confidence: number;
  status: KnowledgeItemStatus;
  provenance: EvidenceProvenance[];
}

export type CompetitorClassification =
  | "DIRECT_BUSINESS_COMPETITOR"
  | "SEARCH_COMPETITOR"
  | "CONTENT_COMPETITOR"
  | "AI_VISIBILITY_CANDIDATE"
  | "UNKNOWN";

export interface CompetitorCandidate {
  id: string;
  name: string;
  domain?: string;
  classification: CompetitorClassification;
  overlappingOfferings: string[];
  confidence: number;
  status: KnowledgeItemStatus;
  provenance: EvidenceProvenance[];
}

export interface KnowledgeConflict {
  id: string;
  entityName: string;
  description: string;
  sources: EvidenceProvenance[];
  status: "UNRESOLVED" | "USER_RESOLVED";
  resolutionNotes?: string;
}

export interface BrandIdentity {
  name: string;
  legalName?: string;
  aliases: string[];
  domain: string;
  tagline?: string;
  description?: string;
  organizationType: string;
  parentBrand?: string;
  subBrands: string[];
  confidence: number;
}

export interface ProjectKnowledgeProfile {
  profileId: string;
  projectId: string;
  domain: string;
  brand: BrandIdentity;
  offerings: OfferingItem[];
  entities: EntityNode[];
  relationships: EntityRelationship[];
  topics: TopicItem[];
  audiences: AudienceSegment[];
  industries: IndustryServed[];
  locations: GeographicMarket[];
  problems: ProblemStatement[];
  differentiators: DifferentiatorItem[];
  competitors: CompetitorCandidate[];
  conflicts: KnowledgeConflict[];
  completenessScore: number; // 0 - 100
  generatedAt: string;
  methodologyVersion: string;
}
