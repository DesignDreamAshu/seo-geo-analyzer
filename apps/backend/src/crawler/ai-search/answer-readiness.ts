/**
 * Answer Readiness & Intent-Aware Direct-Answer Extraction Analyzer.
 * Extracts high-value direct answers, definitions, and procedure steps.
 * Explicitly guards against magic-number folklore and suppresses inappropriate heuristics per intent.
 */

import * as cheerio from "cheerio";
import { CrawledPageData } from "../types";
import { DirectAnswerCandidate, PageIntentClass, PageIntentClassification } from "./types";

export interface AnswerReadinessEvaluation {
  pageIntent: PageIntentClassification;
  candidates: DirectAnswerCandidate[];
  qaPairsCount: number;
  hasConciseDefinition: boolean;
  isContentChunked: boolean;
  advisorySuggestions: string[];
}

export const AEO_HEURISTIC_THRESHOLDS = {
  // Advisory length ranges for direct answer summaries
  DEFINITION_WORD_COUNT_MIN: 10,
  DEFINITION_WORD_COUNT_MAX: 90, // Generous upper bound (prevents false flags on 70-word definitions)
  CHUNK_WORD_COUNT_THRESHOLD: 750,
  CHUNK_MIN_SUBHEADINGS: 2,
};

export function evaluateAnswerReadiness(page: CrawledPageData): AnswerReadinessEvaluation {
  const $ = cheerio.load(page.html || "");
  const candidates: DirectAnswerCandidate[] = [];
  const advisorySuggestions: string[] = [];

  // 1. Classify Page Intent Across 14 Classes with Evidence Signals
  const pageIntent = classifyPageIntent(page, $);

  // 2. Extract Headings and Direct Answer Candidates (if applicable to intent)
  let qaPairsCount = 0;
  let hasConciseDefinition = false;

  if (pageIntent.applicableHeuristics.answerFirstDefinitionExpected || pageIntent.applicableHeuristics.faqStructureExpected) {
    $("h2, h3, h4").each((idx, el) => {
      const headingText = $(el).text().trim();
      const headingLevel = parseInt(el.tagName.replace(/^h/i, ""), 10) || 2;
      const lowerHeading = headingText.toLowerCase();

      const isQuestionOrDefinitionPrompt =
        lowerHeading.startsWith("what is") ||
        lowerHeading.startsWith("what are") ||
        lowerHeading.startsWith("how to") ||
        lowerHeading.startsWith("why ") ||
        lowerHeading.startsWith("how does") ||
        lowerHeading.startsWith("benefits of") ||
        lowerHeading.startsWith("difference between") ||
        lowerHeading.startsWith("overview of") ||
        lowerHeading.endsWith("?");

      if (isQuestionOrDefinitionPrompt) {
        qaPairsCount++;

        // Inspect immediate next sibling elements
        const nextEl = $(el).next();
        const domLocation = `main > ${el.tagName.toLowerCase()}:nth-of-type(${idx + 1}) + ${nextEl[0]?.tagName?.toLowerCase() || "p"}`;

        if (nextEl.is("p")) {
          const pText = nextEl.text().trim();
          const words = pText.split(/\s+/).length;

          if (words >= AEO_HEURISTIC_THRESHOLDS.DEFINITION_WORD_COUNT_MIN && words <= AEO_HEURISTIC_THRESHOLDS.DEFINITION_WORD_COUNT_MAX) {
            hasConciseDefinition = true;
            candidates.push({
              questionOrHeading: headingText,
              headingLevel,
              conciseAnswerText: pText,
              wordCount: words,
              domLocation,
              format: "definition",
              confidence: "high",
            });
          }
        } else if (nextEl.is("ol, ul")) {
          candidates.push({
            questionOrHeading: headingText,
            headingLevel,
            conciseAnswerText: nextEl.find("li").first().text().trim(),
            wordCount: nextEl.find("li").length,
            domLocation,
            format: "step_procedure",
            confidence: "moderate",
          });
        }
      }
    });
  }

  // 3. Evaluate Content Chunking (strictly on informational / long-form content)
  const totalWords = page.rawFacts?.visibleBodyWordCount || page.wordCount || 0;
  const totalHeadings = $("h2, h3").length;
  let isContentChunked = true;

  if (pageIntent.applicableHeuristics.answerFirstDefinitionExpected && totalWords > AEO_HEURISTIC_THRESHOLDS.CHUNK_WORD_COUNT_THRESHOLD && totalHeadings < AEO_HEURISTIC_THRESHOLDS.CHUNK_MIN_SUBHEADINGS) {
    isContentChunked = false;
    advisorySuggestions.push(
      `[ADVISORY_HEURISTIC] Article contains ${totalWords} words with fewer than ${AEO_HEURISTIC_THRESHOLDS.CHUNK_MIN_SUBHEADINGS} subheadings. Dividing into thematic sections improves document clarity.`
    );
  }

  return {
    pageIntent,
    candidates,
    qaPairsCount,
    hasConciseDefinition,
    isContentChunked,
    advisorySuggestions,
  };
}

/**
 * Robust Intent Classifier across 14 distinct page classes.
 */
function classifyPageIntent(page: CrawledPageData, $: cheerio.CheerioAPI): PageIntentClassification {
  const urlLower = page.url.toLowerCase();
  const titleLower = (page.title || "").toLowerCase();
  const h1Lower = (page.rawFacts?.h1Texts?.[0] || "").toLowerCase();
  const primaryClass = page.classification.primaryClass;
  const signals: string[] = [];

  let intentClass: PageIntentClass = "unknown";
  let confidence: PageIntentClassification["confidence"] = "MODERATE";

  // 1. Homepage
  if (primaryClass === "homepage" || urlLower.endsWith(".io/") || urlLower.endsWith(".com/") || urlLower.endsWith(".com")) {
    intentClass = "homepage";
    confidence = "CONFIRMED";
    signals.push("Root domain URI");
  }
  // 2. Contact Page
  else if (urlLower.includes("/contact") || primaryClass === "form_application" || $("form input[type='email']").length > 0 && totalBodyWordCount($) < 200) {
    intentClass = "contact";
    confidence = "HIGH";
    signals.push("Contact path or lead form dominance");
  }
  // 3. About Page
  else if (urlLower.includes("/about") || urlLower.includes("/team") || titleLower.includes("about us")) {
    intentClass = "about";
    confidence = "HIGH";
    signals.push("About / Team path or title");
  }
  // 4. FAQ Page
  else if (urlLower.includes("/faq") || titleLower.includes("frequently asked") || $("dl, .faq-item").length >= 3) {
    intentClass = "faq";
    confidence = "HIGH";
    signals.push("FAQ URL or accordion structure");
  }
  // 5. Comparison Page
  else if (urlLower.includes("-vs-") || urlLower.includes("/compare") || titleLower.includes(" vs ") || h1Lower.includes(" vs ")) {
    intentClass = "comparison";
    confidence = "HIGH";
    signals.push("Versus / Comparison keyword in URI or H1");
  }
  // 6. Case Study / Portfolio
  else if (urlLower.includes("/case-studies/") || urlLower.includes("/customer-stories/") || urlLower.includes("/portfolio/")) {
    intentClass = "case_study";
    confidence = "HIGH";
    signals.push("Case study or customer story collection path");
  }
  // 7. Informational Guide
  else if (urlLower.includes("/guide/") || urlLower.includes("/docs/") || titleLower.includes("guide") || titleLower.includes("tutorial")) {
    intentClass = "informational_guide";
    confidence = "HIGH";
    signals.push("Guide / Tutorial keyword in path or metadata");
  }
  // 8. Article / Blog Post
  else if (primaryClass === "article_blog" || urlLower.includes("/blog/") || urlLower.includes("/news/") || urlLower.includes("/insights/")) {
    intentClass = "article_blog";
    confidence = "HIGH";
    signals.push("Blog or editorial article path");
  }
  // 9. Service / Product Page
  else if (primaryClass === "product_job_detail" || urlLower.includes("/services/") || urlLower.includes("/solutions/") || urlLower.includes("/product/")) {
    intentClass = "service_product";
    confidence = "HIGH";
    signals.push("Solutions or service product offering path");
  }
  // 10. Category / Collection Listing
  else if (primaryClass === "category_listing" || urlLower.includes("/category/")) {
    intentClass = "category_collection";
    confidence = "HIGH";
    signals.push("Category listing index page");
  }
  // 11. Location Page
  else if (urlLower.includes("/locations/") || urlLower.includes("/offices/")) {
    intentClass = "location";
    confidence = "HIGH";
    signals.push("Physical location or regional office path");
  }
  // 12. Legal / Privacy
  else if (primaryClass === "utility_legal" || urlLower.includes("/privacy") || urlLower.includes("/terms") || urlLower.includes("/cookie-policy")) {
    intentClass = "legal";
    confidence = "CONFIRMED";
    signals.push("Privacy or Terms legal document");
  }
  // 13. Utility / Error
  else if (["utility_endpoint", "thank_you_confirmation", "search_filter", "sitemap_resource", "error"].includes(primaryClass)) {
    intentClass = "utility";
    confidence = "CONFIRMED";
    signals.push("System utility or confirmation endpoint");
  }
  else {
    intentClass = "unknown";
    confidence = "INFERRED";
    signals.push("General content page without strong pattern signals");
  }

  // Define applicable heuristics based on intent
  const isEditorial = intentClass === "article_blog" || intentClass === "informational_guide";
  const isCommercial = intentClass === "service_product" || intentClass === "homepage" || intentClass === "case_study";

  return {
    primaryClass: intentClass,
    confidence,
    applicableHeuristics: {
      answerFirstDefinitionExpected: isEditorial,
      faqStructureExpected: intentClass === "faq",
      editorialAuthorExpected: isEditorial,
      comparisonTableExpected: intentClass === "comparison",
      entityIdentityExpected: isCommercial || intentClass === "about",
    },
    evidenceSignals: signals,
  };
}

function totalBodyWordCount($: cheerio.CheerioAPI): number {
  return $("body").text().trim().split(/\s+/).length || 0;
}
