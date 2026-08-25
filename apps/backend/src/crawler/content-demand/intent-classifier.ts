/**
 * Query Search-Intent & Modifier Classifier.
 * Evaluates multi-dimensional search intent, modifier shape, and question-demand patterns.
 */

import { QueryIntent, BrandState } from "./types";
import { normalizeQuery } from "./normalization";

export interface IntentClassificationResult {
  primaryIntent: QueryIntent;
  allIntents: QueryIntent[];
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  modifiers: string[];
  isQuestionDemand: boolean;
  isComparisonDemand: boolean;
  isCommercialDemand: boolean;
}

const QUESTION_STARTERS = ["what", "how", "why", "when", "where", "can", "does", "which", "who", "is"];

const COMPARISON_MARKERS = [" vs ", " versus ", "alternatives", "compared to", "difference between", " or "];

const COMMERCIAL_MARKERS = [
  "service", "services", "company", "agency", "consultant", "consulting",
  "provider", "pricing", "cost", "solution", "solutions", "firm", "expert", "specialist"
];

const TRANSACTIONAL_MARKERS = ["hire", "quote", "buy", "demo", "contact", "pricing plan", "request quote", "schedule"];

const INFORMATIONAL_MARKERS = ["guide", "tutorial", "best practices", "overview", "definition", "examples", "tips", "how to"];

const SUPPORT_MARKERS = ["documentation", "docs", "help", "support", "ticket", "error", "troubleshooting", "api reference", "manual", "api"];

const NAVIGATIONAL_MARKERS = ["login", "portal", "sign in", "dashboard", "homepage", "account", "careers"];

export function classifyQueryIntent(
  rawQuery: string,
  brandState: BrandState = "NON_BRANDED"
): IntentClassificationResult {
  const norm = normalizeQuery(rawQuery);
  const words = norm.split(" ");
  const intents: Set<QueryIntent> = new Set();
  const modifiers: Set<string> = new Set();

  // 1. Brand Intent
  if (brandState === "BRANDED") {
    intents.add("BRANDED");
  }

  // 2. Question Demand Check
  const firstWord = words[0] || "";
  const isQuestion = QUESTION_STARTERS.includes(firstWord) || norm.endsWith("?");
  if (isQuestion) {
    intents.add("INFORMATIONAL");
    modifiers.add(firstWord);
  }

  // 3. Comparison Intent Check
  const isComparison = COMPARISON_MARKERS.some((m) => norm.includes(m));
  if (isComparison) {
    intents.add("COMPARISON");
    modifiers.add("comparison");
  }

  // 4. Commercial Intent Check
  let hasCommercial = false;
  for (const m of COMMERCIAL_MARKERS) {
    if (words.includes(m) || (m.includes(" ") && norm.includes(m))) {
      modifiers.add(m);
      hasCommercial = true;
    }
  }
  if (hasCommercial) {
    intents.add("COMMERCIAL_INVESTIGATION");
  }

  // 5. Transactional Intent Check
  let hasTransactional = false;
  for (const m of TRANSACTIONAL_MARKERS) {
    if (words.includes(m) || (m.includes(" ") && norm.includes(m))) {
      modifiers.add(m);
      hasTransactional = true;
    }
  }
  if (hasTransactional) {
    intents.add("TRANSACTIONAL");
  }

  // 6. Support Intent Check
  let hasSupport = false;
  for (const m of SUPPORT_MARKERS) {
    if (words.includes(m) || (m.includes(" ") && norm.includes(m))) {
      modifiers.add(m);
      hasSupport = true;
    }
  }
  if (hasSupport) {
    intents.add("SUPPORT");
  }

  // 7. Navigational Intent Check
  let hasNavigational = false;
  for (const m of NAVIGATIONAL_MARKERS) {
    if (words.includes(m) || (m.includes(" ") && norm.includes(m))) {
      modifiers.add(m);
      hasNavigational = true;
    }
  }
  if (hasNavigational) {
    intents.add("NAVIGATIONAL");
  }

  // 8. Informational Intent Check
  let hasInformational = false;
  for (const m of INFORMATIONAL_MARKERS) {
    if (words.includes(m) || (m.includes(" ") && norm.includes(m))) {
      modifiers.add(m);
      hasInformational = true;
    }
  }
  if (hasInformational && !intents.has("INFORMATIONAL")) {
    intents.add("INFORMATIONAL");
  }

  // 9. Local Intent Check
  if (norm.includes("near me") || norm.includes(" in ")) {
    intents.add("LOCAL");
    modifiers.add("local");
  }

  // 10. Check for UNKNOWN / Ambiguous Intent
  const cleanCharsOnly = norm.replace(/[^a-z0-9]/g, "");
  if (cleanCharsOnly.length <= 2) {
    return {
      primaryIntent: "UNKNOWN",
      allIntents: ["UNKNOWN"],
      confidence: "LOW_CONFIDENCE",
      modifiers: [],
      isQuestionDemand: false,
      isComparisonDemand: false,
      isCommercialDemand: false,
    };
  }

  // 11. Determine Primary Intent & Confidence
  const intentArray = Array.from(intents);
  let primaryIntent: QueryIntent = "UNKNOWN";
  let confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" = "MEDIUM_CONFIDENCE";

  if (intentArray.length === 0) {
    primaryIntent = "INFORMATIONAL"; // Default non-commercial noun phrase intent
    confidence = "LOW_CONFIDENCE";
  } else if (intentArray.length === 1) {
    primaryIntent = intentArray[0];
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("COMPARISON")) {
    primaryIntent = "COMPARISON";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("BRANDED") && intents.has("COMMERCIAL_INVESTIGATION")) {
    primaryIntent = "MIXED";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("TRANSACTIONAL")) {
    primaryIntent = "TRANSACTIONAL";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("SUPPORT")) {
    primaryIntent = "SUPPORT";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("LOCAL")) {
    primaryIntent = "LOCAL";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("COMMERCIAL_INVESTIGATION")) {
    primaryIntent = "COMMERCIAL_INVESTIGATION";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("NAVIGATIONAL")) {
    primaryIntent = "NAVIGATIONAL";
    confidence = "HIGH_CONFIDENCE";
  } else if (intents.has("BRANDED")) {
    primaryIntent = "BRANDED";
    confidence = "HIGH_CONFIDENCE";
  } else {
    primaryIntent = "MIXED";
    confidence = "MEDIUM_CONFIDENCE";
  }

  return {
    primaryIntent,
    allIntents: intentArray.length > 0 ? intentArray : ["UNKNOWN"],
    confidence,
    modifiers: Array.from(modifiers),
    isQuestionDemand: isQuestion,
    isComparisonDemand: isComparison,
    isCommercialDemand: hasCommercial,
  };
}
