/**
 * Hardened Query Normalization & Brand Classifier.
 * Normalizes queries conservatively with language-aware plural safeguards and precise brand matching.
 */

import { BrandState } from "./types";

// Words that end in 's' or 'es' that must NOT have their suffix stripped or merged naively
const FALSE_PLURAL_STEM_BLOCKLIST = new Set([
  "news",
  "glass",
  "glasses",
  "analytic",
  "analytics",
  "canvas",
  "focus",
  "species",
  "series",
  "basis",
  "status",
  "lens",
  "virus",
]);

// Explicit approved regular plural transformations
const APPROVED_PLURAL_PAIRS = new Map<string, string>([
  ["business", "businesses"],
  ["service", "services"],
  ["consultant", "consultants"],
  ["solution", "solutions"],
  ["practice", "practices"],
  ["assessment", "assessments"],
  ["partner", "partners"],
  ["integration", "integrations"],
  ["expert", "experts"],
  ["guide", "guides"],
  ["review", "reviews"],
]);

export function normalizeQuery(rawQuery: string): string {
  if (!rawQuery) return "";

  // 1. Unicode Normalization (NFKC) & Lowercase
  let normalized = rawQuery.normalize("NFKC").toLowerCase().trim();

  // 2. Collapse Multiple Whitespaces
  normalized = normalized.replace(/\s+/g, " ");

  // 3. Strip External Quotation Marks & Leading/Trailing Punctuation
  normalized = normalized.replace(/^["'“”‘’.,;:!?()]+|["'“”‘’.,;:!?()]+$/g, "");

  return normalized;
}

export function extractSemanticTokens(normalizedQuery: string): string[] {
  return normalizedQuery
    .split(" ")
    .map((w) => stemTokenSafely(w))
    .filter((w) => w.length > 0)
    .sort();
}

function stemTokenSafely(token: string): string {
  if (FALSE_PLURAL_STEM_BLOCKLIST.has(token)) {
    return token;
  }

  for (const [singular, plural] of APPROVED_PLURAL_PAIRS.entries()) {
    if (token === plural) return singular;
    if (token === singular) return singular;
  }

  // Safe fallback for regular words > 4 chars not on blocklist
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is")) {
    return token.substring(0, token.length - 1);
  }

  return token;
}

export function classifyBrandState(
  normalizedQuery: string,
  brandAliases?: string[]
): BrandState {
  if (!brandAliases || brandAliases.length === 0) {
    return "AMBIGUOUS";
  }

  const cleanAliases = brandAliases.map((a) => normalizeQuery(a)).filter(Boolean);
  const queryTokens = normalizedQuery.split(" ");

  for (const alias of cleanAliases) {
    // Exact match
    if (normalizedQuery === alias) {
      return "BRANDED";
    }

    // Multi-word alias exact phrase match (with word boundary)
    if (alias.includes(" ")) {
      const aliasRegex = new RegExp(`(^|\\s)${escapeRegex(alias)}(\\s|$)`, "i");
      if (aliasRegex.test(normalizedQuery)) {
        return "BRANDED";
      }
    } else {
      // Single token match must match full token, NOT substring (e.g. 'bot' should not match 'robot' or 'bottom')
      if (queryTokens.includes(alias)) {
        return "BRANDED";
      }
    }
  }

  return "NON_BRANDED";
}

export function areQueriesNearIdentical(q1: string, q2: string): boolean {
  const norm1 = normalizeQuery(q1);
  const norm2 = normalizeQuery(q2);

  if (norm1 === norm2) return true;

  // Check false plural blocklist
  if (FALSE_PLURAL_STEM_BLOCKLIST.has(norm1) || FALSE_PLURAL_STEM_BLOCKLIST.has(norm2)) {
    if ((norm1 === "glass" && norm2 === "glasses") || (norm1 === "glasses" && norm2 === "glass")) {
      return false;
    }
    if ((norm1 === "analytic" && norm2 === "analytics") || (norm1 === "analytics" && norm2 === "analytic")) {
      return false;
    }
    if ((norm1 === "new" && norm2 === "news") || (norm1 === "news" && norm2 === "new")) {
      return false;
    }
  }

  // Token-level semantic comparison
  const tokens1 = extractSemanticTokens(norm1);
  const tokens2 = extractSemanticTokens(norm2);

  if (tokens1.length === tokens2.length && tokens1.length > 0) {
    if (tokens1.every((t, i) => t === tokens2[i])) {
      return true;
    }
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
