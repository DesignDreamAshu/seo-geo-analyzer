/**
 * Phase 28C: Natural & Neutral Prompt Candidate Generator.
 * Constructs evidence-constrained AI search prompts across 18 prompt types and 4 funnel stages.
 */

import { ProjectKnowledgeProfile, OfferingItem, TopicItem } from "../knowledge-profile/types";
import { DiscoveredQuestion } from "./question-discovery";
import { PromptCandidate, PromptType, PromptBrandedness, IntentTaxonomy, FunnelStage, PromptSpecificity } from "./types";
import crypto from "node:crypto";

function stablePromptId(text: string): string {
  return "prm_" + crypto.createHash("md5").update(text.trim().toLowerCase()).digest("hex").slice(0, 12);
}

export function generatePromptCandidates(
  profile: ProjectKnowledgeProfile,
  discoveredQuestions: DiscoveredQuestion[]
): PromptCandidate[] {
  const candidates: PromptCandidate[] = [];
  const seenTexts = new Set<string>();
  const now = new Date().toISOString();

  const brandName = profile.brand.name;
  const supportedTopicsSet = new Set(profile.topics.map((t) => t.name.toLowerCase()));
  const primaryOfferings = profile.offerings.filter((o) => o.importance === "PRIMARY" || o.importance === "SECONDARY");

  // Helper to add candidate safely
  function addCandidate(
    promptText: string,
    type: PromptType,
    brandedness: PromptBrandedness,
    intents: IntentTaxonomy[],
    funnel: FunnelStage,
    specificity: PromptSpecificity,
    offering?: OfferingItem,
    topic?: TopicItem,
    audienceName?: string,
    industryName?: string
  ) {
    const clean = promptText.trim();
    const norm = clean.toLowerCase();
    if (seenTexts.has(norm)) return;
    seenTexts.add(norm);

    // Safety: Verify unbranded prompts do NOT contain brand name
    if (brandedness === "UNBRANDED" && clean.toLowerCase().includes(brandName.toLowerCase())) {
      return; // Reject corrupted unbranded prompt
    }

    candidates.push({
      id: stablePromptId(clean),
      prompt: clean,
      promptType: type,
      brandedness,
      intents,
      funnelStage: funnel,
      specificity,
      clusterId: "", // Will be assigned during clustering
      monitoringTier: "TIER_2_EXPANDED",
      isRepresentative: false,
      isPinned: false,
      isExcluded: false,
      isManual: false,
      priorityScore: 50,
      confidenceScore: 0.9,
      evidenceTrace: {
        derivedFromOfferingId: offering?.id,
        derivedFromOfferingName: offering?.name,
        derivedFromTopicId: topic?.id,
        derivedFromTopicName: topic?.name,
        derivedFromAudienceName: audienceName,
        derivedFromIndustryName: industryName,
        sourceSignal: "DERIVED_FROM_EVIDENCE",
        reason: `Generated from ${offering ? `offering: ${offering.name}` : `brand: ${brandName}`}`,
      },
      locale: { country: "US", language: "en" },
      createdAt: now,
      updatedAt: now,
    });
  }

  // 1. BRANDED PROMPTS
  addCandidate(
    `What services does ${brandName} provide for enterprise clients?`,
    "BRAND_SPECIFIC",
    "BRANDED",
    ["INFORMATIONAL", "DEFINITIONAL"],
    "AWARENESS",
    "MID"
  );
  addCandidate(
    `What are the core consulting specializations of ${brandName}?`,
    "BRAND_SPECIFIC",
    "BRANDED",
    ["INFORMATIONAL", "VENDOR_DISCOVERY"],
    "CONSIDERATION",
    "MID"
  );

  // 2. UNBRANDED CATEGORY & VENDOR DISCOVERY PROMPTS
  for (const off of primaryOfferings) {
    // Unbranded Vendor Discovery (Broad)
    addCandidate(
      `Which consulting firms specialize in ${off.name}?`,
      "CATEGORY_DISCOVERY",
      "UNBRANDED",
      ["VENDOR_DISCOVERY", "COMMERCIAL_INVESTIGATION"],
      "CONSIDERATION",
      "BROAD",
      off
    );

    // Unbranded Best Vendor Recommendation (Mid)
    addCandidate(
      `What are the top enterprise consulting companies for ${off.name}?`,
      "BEST_VENDOR",
      "UNBRANDED",
      ["RECOMMENDATION", "BEST_OF", "COMMERCIAL_INVESTIGATION"],
      "CONSIDERATION",
      "MID",
      off
    );

    // Decision Support / Selection (Specific)
    addCandidate(
      `How should an enterprise evaluate and choose a consulting partner for ${off.name}?`,
      "DECISION_SUPPORT",
      "UNBRANDED",
      ["HOW_TO", "PURCHASE_SELECTION"],
      "DECISION",
      "SPECIFIC",
      off
    );

    // Implementation Guidance (How-To)
    addCandidate(
      `What is the recommended approach for enterprise ${off.name} implementation?`,
      "IMPLEMENTATION_GUIDANCE",
      "UNBRANDED",
      ["HOW_TO", "IMPLEMENTATION"],
      "IMPLEMENTATION",
      "SPECIFIC",
      off
    );

    // Industry-Specific Discovery (if industries exist)
    for (const ind of profile.industries) {
      addCandidate(
        `Which ${off.name} consulting partners have proven experience in ${ind.name}?`,
        "INDUSTRY_SPECIFIC",
        "UNBRANDED",
        ["VENDOR_DISCOVERY", "RECOMMENDATION"],
        "CONSIDERATION",
        "SPECIFIC",
        off,
        undefined,
        undefined,
        ind.name
      );

      // Long-Context Scenario Prompt
      addCandidate(
        `We are an enterprise organization in ${ind.name} looking to modernize our operations using ${off.name}. Which specialized consulting firms should we evaluate?`,
        "DECISION_SUPPORT",
        "UNBRANDED",
        ["VENDOR_DISCOVERY", "RECOMMENDATION", "COMMERCIAL_INVESTIGATION"],
        "DECISION",
        "LONG_CONTEXT",
        off,
        undefined,
        undefined,
        ind.name
      );
    }
  }

  // 3. SEMI-BRANDED COMPARISON & EXPERTISE VALIDATION
  for (const off of primaryOfferings.slice(0, 3)) {
    addCandidate(
      `How does ${brandName} compare to other consulting firms for ${off.name}?`,
      "COMPETITOR_COMPARISON",
      "SEMI_BRANDED",
      ["COMPARISON", "COMMERCIAL_INVESTIGATION"],
      "DECISION",
      "SPECIFIC",
      off
    );
    addCandidate(
      `What are client reviews and reputation regarding ${brandName}'s ${off.name} practice?`,
      "EXPERTISE_VALIDATION",
      "SEMI_BRANDED",
      ["VALIDATION", "COMMERCIAL_INVESTIGATION"],
      "DECISION",
      "SPECIFIC",
      off
    );
  }

  // 4. INCORPORATE DISCOVERED AUTHENTIC QUESTIONS
  for (const dq of discoveredQuestions) {
    const isBranded = dq.questionText.toLowerCase().includes(brandName.toLowerCase());
    addCandidate(
      dq.questionText,
      isBranded ? "BRAND_SPECIFIC" : dq.questionType === "WHICH" ? "CATEGORY_DISCOVERY" : "HOW_TO",
      isBranded ? "BRANDED" : "UNBRANDED",
      [dq.questionType === "WHICH" ? "VENDOR_DISCOVERY" : "INFORMATIONAL"],
      "CONSIDERATION",
      "MID"
    );
  }

  return candidates;
}
