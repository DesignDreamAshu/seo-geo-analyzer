/**
 * Competitor Page Structural Observation Extractor.
 * Observes factual page structures (headings, FAQ, schema, tables, media)
 * without copying copyrighted passages or manufacturing word-count gap errors.
 */

import { CompetitorPageObservation } from "./types";
import { parseAndNormalizeUrl } from "./normalization";

export interface MockPageContent {
  url: string;
  statusCode?: number;
  isBlockedByRobots?: boolean;
  html?: string;
  title?: string;
  h1?: string;
  headings?: string[];
  approximateWordCount?: number;
  schemaTypes?: string[];
  hasFaq?: boolean;
  hasTable?: boolean;
  hasLists?: boolean;
  hasAuthor?: boolean;
  extractedTopics?: string[];
}

export function extractCompetitorPageObservation(page: MockPageContent): CompetitorPageObservation {
  const { domain } = parseAndNormalizeUrl(page.url);

  if (page.isBlockedByRobots) {
    return {
      url: page.url,
      domain,
      fetchStatus: "BLOCKED_ROBOTS",
      observedEntitiesAndTopics: [],
    };
  }

  if (page.statusCode && (page.statusCode >= 400 || page.statusCode === 0)) {
    return {
      url: page.url,
      domain,
      fetchStatus: page.statusCode === 403 ? "ACCESS_DENIED" : "FAILED",
      observedEntitiesAndTopics: [],
    };
  }

  const topics: string[] = [];
  if (page.extractedTopics && page.extractedTopics.length > 0) {
    topics.push(...page.extractedTopics);
  } else {
    // Derive topic tokens conservatively from title, H1, and headings
    if (page.title) {
      topics.push(...extractTopicsFromText(page.title));
    }
    if (page.h1) {
      topics.push(...extractTopicsFromText(page.h1));
    }
    if (page.headings) {
      for (const h of page.headings) {
        topics.push(...extractTopicsFromText(h));
      }
    }
  }

  const uniqueTopics = Array.from(new Set(topics.map((t) => t.toLowerCase())));

  return {
    url: page.url,
    domain,
    fetchStatus: "SUCCESS",
    crawlTimestamp: new Date().toISOString(),
    title: page.title,
    h1: page.h1,
    headingsSample: (page.headings || []).slice(0, 8),
    approximateWordCount: page.approximateWordCount || 0,
    schemaTypes: page.schemaTypes || [],
    hasFaqStructure: page.hasFaq || false,
    hasComparisonTable: page.hasTable || false,
    hasOrderedLists: page.hasLists || false,
    hasAuthorSignals: page.hasAuthor || false,
    observedEntitiesAndTopics: uniqueTopics,
  };
}

function extractTopicsFromText(text: string): string[] {
  const stopWords = new Set(["the", "and", "for", "with", "from", "how", "what", "why", "best", "top", "your", "our", "all"]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
  return words;
}
