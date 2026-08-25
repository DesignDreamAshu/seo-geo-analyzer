/**
 * Phase 28C: Authentic Question Discovery Engine.
 * Discovers questions from headings, FAQ schemas, service problem-solution pairs, and content.
 */

import { CrawledPageData } from "../../crawler/types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";

export interface DiscoveredQuestion {
  id: string;
  questionText: string;
  questionType: "WHAT" | "WHY" | "HOW" | "WHICH" | "CAN" | "SHOULD" | "BEST" | "VS" | "COST" | "IMPLEMENTATION" | "TROUBLESHOOTING";
  sourceType: "OBSERVED_WEBSITE_QUESTION" | "OBSERVED_GSC_QUERY" | "DERIVED_FROM_EVIDENCE";
  sourceUrl?: string;
  relatedOfferingId?: string;
  relatedTopicId?: string;
  relevanceScore: number; // 0 - 100
}

export function discoverQuestions(
  pages: CrawledPageData[],
  profile: ProjectKnowledgeProfile
): DiscoveredQuestion[] {
  const questions: DiscoveredQuestion[] = [];
  const seenTexts = new Set<string>();

  let counter = 1;

  // 1. Discover from Headings with ? or question words
  for (const page of pages) {
    const pageHeadings = page.headingsOutline?.map((h) => h.text) || (page as any).headings || [];
    const headings = [page.h1Tags?.[0] || (page as any).h1, ...pageHeadings].filter(Boolean) as string[];
    for (const h of headings) {
      const trimmed = h.trim();
      const isQuestion =
        trimmed.endsWith("?") ||
        /^(what|why|how|which|can|should|who|where|when|is|are)\b/i.test(trimmed);

      if (isQuestion && trimmed.length >= 10 && trimmed.length <= 150) {
        const norm = trimmed.toLowerCase();
        if (!seenTexts.has(norm)) {
          seenTexts.add(norm);

          let qType: DiscoveredQuestion["questionType"] = "WHAT";
          if (/^how/i.test(trimmed)) qType = "HOW";
          else if (/^why/i.test(trimmed)) qType = "WHY";
          else if (/^which/i.test(trimmed) || /\bbest\b/i.test(trimmed)) qType = "WHICH";
          else if (/^(can|should|is|are)/i.test(trimmed)) qType = "CAN";
          else if (/\b(vs|versus|compared)\b/i.test(trimmed)) qType = "VS";
          else if (/\b(cost|pricing|price|rate)\b/i.test(trimmed)) qType = "COST";

          const matchingOffering = profile.offerings.find((o) =>
            norm.includes(o.canonicalName) || o.aliases.some((a) => norm.includes(a.toLowerCase()))
          );

          questions.push({
            id: `q_${counter++}`,
            questionText: trimmed,
            questionType: qType,
            sourceType: "OBSERVED_WEBSITE_QUESTION",
            sourceUrl: page.url,
            relatedOfferingId: matchingOffering?.id,
            relevanceScore: matchingOffering ? 90 : 75,
          });
        }
      }
    }

    // 2. Discover from FAQ JSON-LD if present
    const jsonLdBlocks = (page as any).jsonLd || (page as any).jsonLdBlocks?.map((j: any) => j.rawJson) || [];
    if (jsonLdBlocks.length > 0) {
      for (const item of jsonLdBlocks) {
        if (item && item["@type"] === "FAQPage" && Array.isArray(item.mainEntity)) {
          for (const q of item.mainEntity) {
            if (q.name && !seenTexts.has(q.name.toLowerCase())) {
              seenTexts.add(q.name.toLowerCase());
              questions.push({
                id: `q_${counter++}`,
                questionText: q.name,
                questionType: "HOW",
                sourceType: "OBSERVED_WEBSITE_QUESTION",
                sourceUrl: page.url,
                relevanceScore: 95,
              });
            }
          }
        }
      }
    }
  }

  // 3. Synthesize Core Problem & Service Questions from Knowledge Profile
  for (const offering of profile.offerings) {
    const q1 = `How can enterprises implement ${offering.name}?`;
    const q2 = `Which consulting firms specialize in ${offering.name}?`;
    const q3 = `What are the benefits of ${offering.name} for enterprise workflows?`;

    for (const qText of [q1, q2, q3]) {
      if (!seenTexts.has(qText.toLowerCase())) {
        seenTexts.add(qText.toLowerCase());
        questions.push({
          id: `q_${counter++}`,
          questionText: qText,
          questionType: qText.startsWith("Which") ? "WHICH" : qText.startsWith("How") ? "HOW" : "WHAT",
          sourceType: "DERIVED_FROM_EVIDENCE",
          relatedOfferingId: offering.id,
          relevanceScore: 85,
        });
      }
    }
  }

  return questions;
}
