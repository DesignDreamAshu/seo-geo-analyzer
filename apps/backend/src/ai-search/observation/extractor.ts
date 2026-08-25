/**
 * Phase 28D: Evidence-Backed AI Observation Extraction & Multi-Signal Entity Attribution Engine.
 * Extracts String Mentions, Validates Entity Attribution, Detects Ambiguity, and Filters False Positives.
 * Strictly isolated from traditional SEO diagnostic rules.
 */

import { BrandIdentity, CompetitorCandidate, ProjectKnowledgeProfile } from "../knowledge-profile/types";
import {
  BrandMention,
  CompetitorMention,
  CitationObservation,
  CitationDomainType,
  MentionContextType,
  EntityAttribution,
  EntityAttributionState,
  AI_OBSERVATION_EXTRACTOR_VERSION,
} from "./types";

export interface ExtractionResult {
  brandMentioned: boolean; // Strictly CONFIRMED or PROBABLE entity visibility
  brandMentionCount: number;
  stringMentionDetected: boolean;
  entityMentionConfirmed: boolean;
  entityAttribution: EntityAttribution;
  brandRecommendationOrder?: number | null;
  brandMentions: BrandMention[];
  competitorsMentioned: CompetitorMention[];
  citations: CitationObservation[];
  ownDomainCited: boolean;
  ownDomainCitationCount: number;
  extractorVersion: string;
}

export function extractObservationIntelligence(
  promptText: string,
  responseText: string,
  rawCitations: CitationObservation[],
  brand: BrandIdentity,
  competitors: CompetitorCandidate[],
  activeDomain: string,
  knowledgeProfile?: ProjectKnowledgeProfile | null
): ExtractionResult {
  const cleanResponse = responseText || "";
  const normResponse = cleanResponse.toLowerCase();
  const cleanDomain = activeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "").toLowerCase();

  // -------------------------------------------------------------------------
  // 1. STRING MENTION DETECTION WITH STRICT WORD BOUNDARIES
  // -------------------------------------------------------------------------
  const brandPatterns: Array<{ name: string; regex: RegExp; confidence: number; isDomain: boolean }> = [];

  // Canonical Brand Name
  if (brand.name) {
    const escaped = brand.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    brandPatterns.push({
      name: brand.name,
      regex: new RegExp(`\\b${escaped}\\b`, "gi"),
      confidence: 1.0,
      isDomain: false,
    });
  }

  // Canonical Domain
  if (cleanDomain) {
    const escapedDomain = cleanDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    brandPatterns.push({
      name: cleanDomain,
      regex: new RegExp(`\\b${escapedDomain}\\b`, "gi"),
      confidence: 1.0,
      isDomain: true,
    });
  }

  // Sub-brands and proprietary offerings
  for (const sub of brand.subBrands || []) {
    const normSub = sub.trim().toLowerCase();
    if (normSub.length > 2 && normSub !== cleanDomain && normSub !== brand.name.toLowerCase()) {
      const escaped = sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      brandPatterns.push({
        name: sub,
        regex: new RegExp(`\\b${escaped}\\b`, "gi"),
        confidence: 0.95,
        isDomain: false,
      });
    }
  }

  // Known Aliases (excluding high-frequency single words)
  for (const alias of brand.aliases || []) {
    const normAlias = alias.trim().toLowerCase();
    if (
      normAlias !== "bot" &&
      normAlias !== "ai" &&
      normAlias !== "consulting" &&
      normAlias !== "the" &&
      normAlias !== brand.name.toLowerCase() &&
      normAlias !== cleanDomain
    ) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      brandPatterns.push({
        name: alias,
        regex: new RegExp(`\\b${escaped}\\b`, "gi"),
        confidence: 0.9,
        isDomain: false,
      });
    }
  }

  const rawMatches: Array<{
    matchedText: string;
    offset: number;
    paraIdx: number;
    contextSnippet: string;
    isDomain: boolean;
  }> = [];

  const paragraphs = cleanResponse.split(/\n+/);
  for (const bp of brandPatterns) {
    let match: RegExpExecArray | null;
    while ((match = bp.regex.exec(cleanResponse)) !== null) {
      const offset = match.index;
      const matchedText = match[0];

      let charAccumulator = 0;
      let paraIdx = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        charAccumulator += paragraphs[i].length + 1;
        if (charAccumulator > offset) {
          paraIdx = i;
          break;
        }
      }

      const start = Math.max(0, offset - 100);
      const end = Math.min(cleanResponse.length, offset + matchedText.length + 100);
      const contextSnippet = cleanResponse.slice(start, end).replace(/\s+/g, " ").trim();

      rawMatches.push({
        matchedText,
        offset,
        paraIdx,
        contextSnippet,
        isDomain: bp.isDomain,
      });
    }
  }

  const stringMentionDetected = rawMatches.length > 0;

  // -------------------------------------------------------------------------
  // 2. MULTI-SIGNAL ENTITY ATTRIBUTION & AMBIGUITY DETECTION
  // -------------------------------------------------------------------------
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  const ambiguityReasons: string[] = [];
  let positiveScore = 0.0;
  let negativeScore = 0.0;

  // Positive Signal A: Direct Domain Citation / Mention
  const hasDomainMention = rawMatches.some((m) => m.isDomain) || normResponse.includes(cleanDomain);
  const hasDomainCitation = rawCitations.some((c) => (c.domain || "").toLowerCase().includes(cleanDomain) || (c.sourceUrl || "").toLowerCase().includes(cleanDomain));
  if (hasDomainMention || hasDomainCitation) {
    positiveSignals.push("CANONICAL_DOMAIN_CITED_OR_MENTIONED");
    positiveScore += 0.55;
  }

  // Positive Signal B: Specific Offering / Capability Matches from Knowledge Profile
  const knownOfferings: string[] = [];
  if (knowledgeProfile?.offerings) {
    for (const off of knowledgeProfile.offerings) {
      if (off.name && off.name.length > 2) knownOfferings.push(off.name.toLowerCase());
      if (off.canonicalName && off.canonicalName.length > 2) knownOfferings.push(off.canonicalName.toLowerCase());
      for (const al of off.aliases || []) {
        if (al.length > 2) knownOfferings.push(al.toLowerCase());
      }
    }
  }
  // Include brand sub-brands
  for (const sb of brand.subBrands || []) {
    if (sb && sb.length > 2) knownOfferings.push(sb.toLowerCase());
  }

  const matchedOfferings: string[] = [];
  for (const offering of knownOfferings) {
    if (offering === "consulting" || offering === "ai" || offering === "bot") continue;
    if (normResponse.includes(offering)) {
      matchedOfferings.push(offering);
    }
  }

  if (matchedOfferings.length > 0) {
    positiveSignals.push(`KNOWLEDGE_OFFERING_MATCHES: [${matchedOfferings.slice(0, 4).join(", ")}]`);
    positiveScore += Math.min(0.45, 0.20 + matchedOfferings.length * 0.10);
  }

  // Positive Signal C: Explicit Corporate Profile Context
  const corporatePhrasingPatterns = [
    /\b(?:is\s+an?\s+(?:enterprise\s+)?(?:consulting\s+firm|digital\s+transformation\s+company|consultancy|it\s+services\s+provider|advisory\s+firm|elite\s+partner|technology\s+consultancy))\b/i,
    /\b(?:founded\s+in|headquartered\s+in|based\s+in|official\s+partner\s+of|clients\s+include|specializes\s+in\s+delivering)\b/i,
    /\b(?:boutique\s+consulting\s+firm|premier\s+partner|elite\s+service\s+partner)\b/i,
    /\b(?:specialized\s+consultancy|consultancy\s+with\s+deep|strategy\s+and\s+implementation|enterprise\s+technology\s+consulting)\b/i,
  ];

  let hasCorporatePhrasing = false;
  for (const m of rawMatches) {
    if (corporatePhrasingPatterns.some((p) => p.test(m.contextSnippet))) {
      hasCorporatePhrasing = true;
      break;
    }
  }

  if (hasCorporatePhrasing) {
    positiveSignals.push("EXPLICIT_CORPORATE_PROFILE_PHRASING");
    positiveScore += 0.30;
  }

  // Negative / Ambiguity Signal A: Clarification / Disambiguation Requests
  const clarificationPatterns = [
    /\b(?:if\s+you\s+are\s+looking\s+for\s+a\s+(?:specific|boutique|particular)\s+(?:firm|company|agency|consultancy)\s+(?:named|called)\s+["']?[a-z0-9 _-]+["']?)/i,
    /\b(?:please\s+provide|could\s+you\s+provide|need)\s+(?:more|additional|a\s+bit\s+of)\s+context\s+(?:about|such\s+as|to\s+provide|regarding)\b/i,
    /\b(?:which|what)\s+["']?[a-z0-9 _-]+["']?\s+(?:firm|company|consulting\s+firm|are\s+you\s+referring\s+to|do\s+you\s+mean)\b/i,
    /\b(?:can\s+refer\s+to|could\s+refer\s+to)\s+(?:several|multiple|different|either)\s+(?:companies|concepts|things|definitions)\b/i,
    /\b(?:please\s+clarify|more\s+context\s+is\s+needed|depending\s+on\s+which\s+company)\b/i,
  ];

  let hasClarificationRequest = false;
  for (const pat of clarificationPatterns) {
    if (pat.test(cleanResponse)) {
      hasClarificationRequest = true;
      negativeSignals.push("PROVIDER_EXPLICITLY_REQUESTED_CLARIFICATION_OR_DISAMBIGUATION");
      ambiguityReasons.push("Provider explicitly asks user to clarify if a specific boutique firm was intended.");
      negativeScore += 0.50;
      break;
    }
  }

  // Negative / Ambiguity Signal B: Acronym Expansion into Generic Concept
  const genericExpansionPatterns = [
    /\b(?:build[- ]operate[- ]transfer|build,?\s*operate,?\s*transfer|b\.o\.t\.?\s*model|b\.o\.t\.?\s*framework)\b/i,
    /\b(?:software\s+bots?|automation\s+bots?|rpa\s+bots?|digital\s+workers?|conversational\s+ai\s+and\s+chatbots?)\b/i,
    /\b(?:fruit|citrus|botanical|apple\s+orchard|jaguar\s+cat|amazon\s+river|amazon\s+basin)\b/i,
  ];

  let hasGenericExpansion = false;
  for (const pat of genericExpansionPatterns) {
    if (pat.test(cleanResponse)) {
      hasGenericExpansion = true;
      negativeSignals.push("GENERIC_ACRONYM_OR_HOMONYM_EXPANSION_DETECTED");
      ambiguityReasons.push("Response expands brand token as a generic industry methodology or technology concept.");
      negativeScore += 0.45;
      break;
    }
  }

  // Negative / Ambiguity Signal C: Multiple Generic Category Bifurcations
  const bifurcationPatterns = [
    /\b(?:falls\s+into\s+one\s+of\s+two\s+categories|typically\s+refers\s+to\s+(?:two|several|multiple)\s+different\s+concepts)\b/i,
    /\b(?:definition\s+[12]:|category\s+[12]:|concept\s+[12]:)\b/i,
    /\b(?:refers\s+to\s+one\s+of\s+two\s+major\s+areas)\b/i,
  ];

  let hasBifurcation = false;
  for (const pat of bifurcationPatterns) {
    if (pat.test(cleanResponse)) {
      hasBifurcation = true;
      negativeSignals.push("MULTIPLE_GENERIC_CATEGORIES_DEFINED");
      ambiguityReasons.push("Provider treats the brand term as a generic dual-meaning concept.");
      negativeScore += 0.40;
      break;
    }
  }

  // Negative / Ambiguity Signal D: Unrelated Industry or Product Domain
  const unrelatedIndustryPatterns = [
    /\b(?:toy\s+manufacturing|rc\s+bots?|toy\s+company|robotics\s+toy|pet\s+supplies|clothing\s+brand|apparel\s+company|fast\s+food|restaurant\s+chain|bakery|car\s+dealership)\b/i,
  ];

  let hasUnrelatedIndustry = false;
  if (matchedOfferings.length === 0 && !hasDomainMention && !hasDomainCitation) {
    for (const pat of unrelatedIndustryPatterns) {
      if (pat.test(cleanResponse)) {
        hasUnrelatedIndustry = true;
        negativeSignals.push("UNRELATED_INDUSTRY_OR_PRODUCT_DOMAIN");
        ambiguityReasons.push("Response describes an unrelated commercial business domain or product type.");
        negativeScore += 0.55;
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. SYNTHESIZE ATTRIBUTION STATE
  // -------------------------------------------------------------------------
  let attributionState: EntityAttributionState = "INSUFFICIENT_EVIDENCE";
  let entityMentionConfirmed = false;
  let attributionConfidence = 0.0;
  let rationale = "";

  if (!stringMentionDetected) {
    attributionState = "INSUFFICIENT_EVIDENCE";
    entityMentionConfirmed = false;
    attributionConfidence = 0.0;
    rationale = "No brand string or alias was detected in the provider response.";
  } else if (hasUnrelatedIndustry) {
    attributionState = "DIFFERENT_ENTITY";
    entityMentionConfirmed = false;
    attributionConfidence = 0.10;
    rationale = "Brand string matches an unrelated entity in a completely different industry or product domain.";
  } else if (negativeScore >= 0.40) {
    // Strong ambiguity or generic usage detected
    if (hasClarificationRequest || hasBifurcation) {
      attributionState = "AMBIGUOUS_ENTITY";
      entityMentionConfirmed = false;
      attributionConfidence = Number(Math.max(0.1, 0.4 - negativeScore * 0.3).toFixed(2));
      rationale = `Response treats '${brand.name}' as an ambiguous or generic concept (${ambiguityReasons.join("; ")}).`;
    } else if (hasGenericExpansion && positiveScore < 0.30) {
      attributionState = "GENERIC_TERM";
      entityMentionConfirmed = false;
      attributionConfidence = Number(Math.max(0.05, 0.3 - negativeScore * 0.3).toFixed(2));
      rationale = `Brand string matches generic industry terminology rather than the specific tracked entity.`;
    } else if (positiveScore >= 0.55) {
      // Overriding positive evidence (e.g. domain cited despite mentioning BOT model)
      attributionState = "PROBABLE_ENTITY";
      entityMentionConfirmed = true;
      attributionConfidence = Number(Math.min(0.85, positiveScore - negativeScore * 0.5).toFixed(2));
      rationale = `Strong domain citation/offering context confirms entity despite generic term references.`;
    } else {
      attributionState = "AMBIGUOUS_ENTITY";
      entityMentionConfirmed = false;
      attributionConfidence = 0.20;
      rationale = `Ambiguous mention with insufficient entity corroboration.`;
    }
  } else if (positiveScore >= 0.45 || (positiveScore >= 0.25 && hasCorporatePhrasing)) {
    // Confirmed Entity Mention
    attributionState = "CONFIRMED_ENTITY";
    entityMentionConfirmed = true;
    attributionConfidence = Number(Math.min(1.0, 0.70 + positiveScore * 0.3).toFixed(2));
    rationale = `Confirmed entity visibility supported by ${positiveSignals.join(", ")}.`;
  } else if (positiveScore >= 0.20) {
    attributionState = "PROBABLE_ENTITY";
    entityMentionConfirmed = true;
    attributionConfidence = 0.65;
    rationale = `Probable entity mention with supporting contextual signals.`;
  } else {
    // String match only without any corroborating corporate or offering signals
    attributionState = "AMBIGUOUS_ENTITY";
    entityMentionConfirmed = false;
    attributionConfidence = 0.25;
    rationale = `String matched but lacked corroborating corporate profile or offering context to confirm entity identity.`;
  }

  const entityAttribution: EntityAttribution = {
    state: attributionState,
    confidence: attributionConfidence,
    stringMentionDetected,
    entityMentionConfirmed,
    positiveSignals,
    negativeSignals,
    ambiguityReasons,
    rationale,
  };

  // -------------------------------------------------------------------------
  // 4. STRUCTURED BRAND MENTIONS ARRAY
  // -------------------------------------------------------------------------
  const brandMentions: BrandMention[] = [];
  let occurrenceCounter = 1;

  for (const rm of rawMatches) {
    let mentionType: MentionContextType = "NEUTRAL_MENTION";
    const snippetLower = rm.contextSnippet.toLowerCase();

    // Recommendation requires entity confirmation
    if (entityMentionConfirmed) {
      if (
        snippetLower.includes("recommend") ||
        snippetLower.includes("top firm") ||
        snippetLower.includes("leading") ||
        snippetLower.includes("best for") ||
        snippetLower.includes("specialist")
      ) {
        mentionType = "RECOMMENDED";
      } else if (snippetLower.includes("compare") || snippetLower.includes("versus") || snippetLower.includes("vs")) {
        mentionType = "COMPARISON";
      } else if (snippetLower.includes("not recommended") || snippetLower.includes("drawback") || snippetLower.includes("avoid")) {
        mentionType = "NEGATIVE";
      }
    } else {
      mentionType = "NEUTRAL_MENTION"; // Never attribute recommendation to unconfirmed entity
    }

    brandMentions.push({
      canonicalEntity: brand.name,
      matchedText: rm.matchedText,
      occurrenceIndex: occurrenceCounter++,
      characterOffset: rm.offset,
      paragraphIndex: rm.paraIdx,
      contextSnippet: rm.contextSnippet,
      mentionType,
      entityAttributionState: attributionState,
      isConfirmedEntity: entityMentionConfirmed,
      confidence: attributionConfidence,
    });
  }

  // -------------------------------------------------------------------------
  // 5. RECOMMENDATION ORDER EXTRACTION (REQUIRES CONFIRMED ENTITY)
  // -------------------------------------------------------------------------
  let brandRecommendationOrder: number | null = null;
  const listItems = cleanResponse.match(/^\s*(?:\d+[\.\)]|\*|\-)\s+([^\n]+)/gm) || [];

  if (entityMentionConfirmed && listItems.length > 0) {
    for (let idx = 0; idx < listItems.length; idx++) {
      const itemText = listItems[idx];
      const matchBrand = brandPatterns.some((bp) => new RegExp(bp.regex.source, "i").test(itemText));
      if (matchBrand) {
        brandRecommendationOrder = idx + 1;
        break;
      }
    }

    if (brandMentions.length > 0 && brandRecommendationOrder) {
      brandMentions[0].recommendationOrder = brandRecommendationOrder;
      if (brandMentions[0].mentionType === "NEUTRAL_MENTION") {
        brandMentions[0].mentionType = "RECOMMENDED";
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. COMPETITOR EXTRACTION WITH ENTITY VALIDATION
  // -------------------------------------------------------------------------
  const competitorPool = [
    ...competitors.map((c) => ({ name: c.name, isKnown: true })),
    { name: "Accenture", isKnown: false },
    { name: "Deloitte", isKnown: false },
    { name: "PwC", isKnown: false },
    { name: "KPMG", isKnown: false },
    { name: "EY", isKnown: false },
    { name: "Cognizant", isKnown: false },
    { name: "Infosys", isKnown: false },
    { name: "Wipro", isKnown: false },
    { name: "Slalom", isKnown: false },
    { name: "Acorio", isKnown: false },
    { name: "GlideFast", isKnown: false },
    { name: "Thirdera", isKnown: false },
  ];

  const competitorsMentioned: CompetitorMention[] = [];
  let compCounter = 1;

  for (const comp of competitorPool) {
    if (comp.name.toLowerCase() === brand.name.toLowerCase()) continue;
    const escaped = comp.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    const testRegex = new RegExp(`\\b${escaped}\\b`, "i");

    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleanResponse)) !== null) {
      const offset = match.index;
      const start = Math.max(0, offset - 60);
      const end = Math.min(cleanResponse.length, offset + match[0].length + 60);
      const contextSnippet = cleanResponse.slice(start, end).replace(/\s+/g, " ").trim();

      // Guard: competitor name used in sports/generic context (e.g. "slalom skiing")
      const snippetLow = contextSnippet.toLowerCase();
      let compState: EntityAttributionState = "CONFIRMED_ENTITY";
      if (comp.name.toLowerCase() === "slalom" && (snippetLow.includes("ski") || snippetLow.includes("course"))) {
        compState = "GENERIC_TERM";
      }

      let compOrder: number | null = null;
      if (compState === "CONFIRMED_ENTITY" && listItems.length > 0) {
        for (let idx = 0; idx < listItems.length; idx++) {
          if (testRegex.test(listItems[idx])) {
            compOrder = idx + 1;
            break;
          }
        }
      }

      if (compState === "CONFIRMED_ENTITY") {
        competitorsMentioned.push({
          competitorName: comp.name,
          canonicalEntity: comp.name,
          matchedText: match[0],
          occurrenceIndex: compCounter++,
          characterOffset: offset,
          contextSnippet,
          entityAttributionState: compState,
          isConfirmedEntity: true,
          recommendationOrder: compOrder,
          isKnownCompetitor: comp.isKnown,
          confidence: 0.9,
        });
      }
      break; // Single entry per competitor
    }
  }

  // -------------------------------------------------------------------------
  // 7. CITATION DOMAIN CLASSIFICATION & OWN-DOMAIN DETECTION
  // -------------------------------------------------------------------------
  const citations: CitationObservation[] = [];
  let ownDomainCitationCount = 0;

  for (const rawCit of rawCitations) {
    const citUrl = rawCit.sourceUrl || "";
    let domain = rawCit.domain || "";
    if (!domain && citUrl) {
      try {
        domain = new URL(citUrl).hostname.replace(/^www\./, "");
      } catch {
        domain = "";
      }
    }
    const cleanCitDomain = domain.toLowerCase();

    let domainType: CitationDomainType = "OTHER";
    let isOwnDomain = false;

    if (cleanCitDomain && (cleanCitDomain === cleanDomain || cleanCitDomain.endsWith(`.${cleanDomain}`))) {
      domainType = "OWN_DOMAIN";
      isOwnDomain = true;
      ownDomainCitationCount++;
    } else if (
      cleanCitDomain.includes("g2.com") ||
      cleanCitDomain.includes("clutch.co") ||
      cleanCitDomain.includes("trustradius.com") ||
      cleanCitDomain.includes("capterra.com")
    ) {
      domainType = "DIRECTORY";
    } else if (
      cleanCitDomain.includes("forbes.com") ||
      cleanCitDomain.includes("reuters.com") ||
      cleanCitDomain.includes("bloomberg.com") ||
      cleanCitDomain.includes("techcrunch.com")
    ) {
      domainType = "NEWS";
    } else if (
      cleanCitDomain.includes("reddit.com") ||
      cleanCitDomain.includes("quora.com") ||
      cleanCitDomain.includes("stackoverflow.com")
    ) {
      domainType = "COMMUNITY";
    } else if (
      cleanCitDomain.includes("linkedin.com") ||
      cleanCitDomain.includes("twitter.com") ||
      cleanCitDomain.includes("x.com") ||
      cleanCitDomain.includes("youtube.com")
    ) {
      domainType = "SOCIAL";
    } else if (
      cleanCitDomain.includes("servicenow.com") ||
      cleanCitDomain.includes("snowflake.com") ||
      cleanCitDomain.includes("microsoft.com") ||
      cleanCitDomain.includes("aws.amazon.com")
    ) {
      domainType = "THIRD_PARTY_AUTHORITY";
    } else if (competitors.some((c) => (c.domain || "").toLowerCase().includes(cleanCitDomain))) {
      domainType = "COMPETITOR_DOMAIN";
    }

    citations.push({
      sourceUrl: citUrl,
      domain: cleanCitDomain,
      title: rawCit.title || null,
      citationIndex: rawCit.citationIndex || citations.length + 1,
      domainType,
      isOwnDomain,
      matchedBrandOffering: isOwnDomain ? "Core Services" : null,
      attributionSnippet: rawCit.attributionSnippet || null,
    });
  }

  // -------------------------------------------------------------------------
  // 8. FINAL RETURN
  // -------------------------------------------------------------------------
  return {
    brandMentioned: entityMentionConfirmed, // Strictly confirmed visibility
    brandMentionCount: entityMentionConfirmed ? brandMentions.length : 0,
    stringMentionDetected,
    entityMentionConfirmed,
    entityAttribution,
    brandRecommendationOrder: entityMentionConfirmed ? brandRecommendationOrder : null,
    brandMentions,
    competitorsMentioned,
    citations,
    ownDomainCited: ownDomainCitationCount > 0,
    ownDomainCitationCount,
    extractorVersion: AI_OBSERVATION_EXTRACTOR_VERSION,
  };
}
