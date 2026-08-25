import { PageGscMetrics } from "../gsc/types";
import { AnswerReadinessEvaluation } from "./answer-readiness";

export interface GscAeoOpportunity {
  url: string;
  query: string;
  impressions: number;
  clicks: number;
  averagePosition: number;
  opportunityType: "HIGH_IMPRESSION_INFORMATIONAL_DEFICIT" | "STRIKING_DISTANCE_ANSWER_BOOST";
  recommendation: string;
}

const INFORMATIONAL_QUERY_PATTERNS = [
  /^what\s+is\b/i,
  /^how\s+to\b/i,
  /^how\s+does\b/i,
  /^why\s+/i,
  /^benefits\s+of\b/i,
  /^difference\s+between\b/i,
  /\bvs\b/i,
  /\bguide\b/i,
  /\btutorial\b/i,
  /\bdefinition\b/i,
];

export function findGscAeoOpportunities(
  url: string,
  gscData: PageGscMetrics | null | undefined,
  answerEval: AnswerReadinessEvaluation
): GscAeoOpportunity[] {
  if (!gscData || !gscData.topQueries || gscData.topQueries.length === 0) {
    return [];
  }

  const opportunities: GscAeoOpportunity[] = [];

  for (const q of gscData.topQueries) {
    const isInformational = INFORMATIONAL_QUERY_PATTERNS.some((pattern) => pattern.test(q.query));
    if (!isInformational) continue;

    const impressions = q.currentPeriod.impressions;
    const clicks = q.currentPeriod.clicks;
    const position = q.currentPeriod.averagePosition;

    // Condition 1: High impression informational query on page lacking concise definition
    if (impressions >= 100 && !answerEval.hasConciseDefinition) {
      opportunities.push({
        url,
        query: q.query,
        impressions,
        clicks,
        averagePosition: position,
        opportunityType: "HIGH_IMPRESSION_INFORMATIONAL_DEFICIT",
        recommendation: `Query "${q.query}" generates ${impressions} impressions, but the page lacks a direct concise definition. Add a 30-50 word answer below an <h2> heading targeting this concept.`,
      });
    }
    // Condition 2: Striking distance query (pos 6-15) with good demand
    else if (position >= 6.0 && position <= 15.0 && impressions >= 200) {
      opportunities.push({
        url,
        query: q.query,
        impressions,
        clicks,
        averagePosition: position,
        opportunityType: "STRIKING_DISTANCE_ANSWER_BOOST",
        recommendation: `Ranking at position ${position.toFixed(1)} for "${q.query}". Structuring a direct Q&A summary or comparison table can improve answer engine visibility.`,
      });
    }
  }

  return opportunities;
}
