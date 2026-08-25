/**
 * Entity Clarity & Structured Data Cross-Validation Analyzer.
 * Validates consistency between visible DOM text and declared JSON-LD schema facts.
 * Handles legal suffix normalization and deep FAQ Q&A verification.
 */

import * as cheerio from "cheerio";
import { CrawledPageData } from "../types";
import { EntityConsistencyReport } from "./types";

const LEGAL_SUFFIXES = [
  /\bllc\b/gi,
  /\binc\.?\b/gi,
  /\bcorp\.?\b/gi,
  /\bcorporation\b/gi,
  /\bltd\.?\b/gi,
  /\blimited\b/gi,
  /\bco\.?\b/gi,
  /\bcompany\b/gi,
  /\bpartners\b/gi,
  /\bgroup\b/gi,
  /\bservices\b/gi,
];

function normalizeBrandName(name: string): string {
  let clean = name.toLowerCase();
  for (const suf of LEGAL_SUFFIXES) {
    clean = clean.replace(suf, "");
  }
  return clean.replace(/[^a-z0-9]/g, "").trim();
}

export function evaluateEntityConsistency(page: CrawledPageData): EntityConsistencyReport {
  const $ = cheerio.load(page.html || "");
  const discrepancies: string[] = [];
  const normalizationNotes: string[] = [];

  // 1. Extract Visible Brand Candidates
  const pageTitle = page.title || "";
  const titleParts = pageTitle.split(/[|\-–—]/).map((p) => p.trim()).filter(Boolean);
  const headerLogoText = $("header, nav").find(".logo, .brand, [class*='logo']").text().trim() || null;
  const footerCopyrightText = $("footer").text().match(/(?:copyright|©|\(c\))\s*(?:\d{4})?\s*([A-Za-z0-9\s]+?)(?:\.|\n|$)/i)?.[1]?.trim() || null;

  const brandCandidates = [
    ...titleParts,
    headerLogoText,
    footerCopyrightText,
  ].filter(Boolean) as string[];

  const visibleOrganizationName = headerLogoText || titleParts[0] || null;

  // 2. Extract Visible Author & Date Clues
  const authorEl = $("[class*='author'], [rel='author'], .byline, .author-name").first();
  const visibleAuthor = authorEl.text().replace(/^by\s+/i, "").trim() || null;

  const timeEl = $("time, [class*='date'], [class*='published'], [class*='post-date']").first();
  const visibleDate = timeEl.attr("datetime") || timeEl.text().trim() || null;

  // 3. Extract Schema Facts
  let schemaOrganizationName: string | null = null;
  let schemaAuthor: string | null = null;
  let schemaDatePublished: string | null = null;
  let schemaDateModified: string | null = null;

  for (const block of page.schemaJsonLd || []) {
    if (!block.parsedSuccessfully || !block.parsed) continue;
    const obj = block.parsed as any;

    // Organization Schema
    if (obj["@type"] === "Organization" || obj["@type"] === "Corporation") {
      schemaOrganizationName = obj.name || obj.legalName || null;
    }

    // Article / BlogPosting Schema
    if (["Article", "NewsArticle", "BlogPosting", "TechArticle"].includes(obj["@type"])) {
      if (obj.author) {
        if (typeof obj.author === "string") {
          schemaAuthor = obj.author;
        } else if (typeof obj.author === "object" && obj.author.name) {
          schemaAuthor = obj.author.name;
        }
      }
      if (obj.datePublished) schemaDatePublished = String(obj.datePublished);
      if (obj.dateModified) schemaDateModified = String(obj.dateModified);

      if (obj.publisher && typeof obj.publisher === "object" && obj.publisher.name) {
        if (!schemaOrganizationName) schemaOrganizationName = obj.publisher.name;
      }
    }

    // FAQPage Schema Deep Cross-Validation
    if (obj["@type"] === "FAQPage" && Array.isArray(obj.mainEntity)) {
      const pageTextLower = $("main, body").text().toLowerCase();

      for (const item of obj.mainEntity) {
        const question = item.name || item.question;
        const answer = typeof item.acceptedAnswer === "object" ? item.acceptedAnswer.text : item.acceptedAnswer;

        if (question && typeof question === "string") {
          const cleanQuestion = question.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
          const cleanPageText = pageTextLower.replace(/[^a-z0-9\s]/g, "");

          // Test if significant fragment of question exists in body
          const questionSnippet = cleanQuestion.slice(0, 35);
          if (!cleanPageText.includes(questionSnippet)) {
            discrepancies.push(
              `FAQ schema declares question "${question.slice(0, 50)}...", but this question text does not visibly appear in page content.`
            );
          } else if (answer && typeof answer === "string") {
            const cleanAnswerSnippet = answer.toLowerCase().replace(/[^a-z0-9\s]/g, "").slice(0, 30);
            if (!cleanPageText.includes(cleanAnswerSnippet)) {
              normalizationNotes.push(
                `FAQ question "${question.slice(0, 35)}..." was located in visible text, but schema answer differs materially from visible text.`
              );
            }
          }
        }
      }
    }
  }

  // 4. Cross-Check Organization Consistency with Legal Suffix Normalization
  let isOrganizationConsistent = true;
  if (schemaOrganizationName && brandCandidates.length > 0) {
    const sNorm = normalizeBrandName(schemaOrganizationName);

    const matchesAny = brandCandidates.some((cand) => {
      const cNorm = normalizeBrandName(cand);
      if (cNorm.includes(sNorm) || sNorm.includes(cNorm)) {
        if (cand !== schemaOrganizationName) {
          normalizationNotes.push(
            `Matched visible brand "${cand}" to schema name "${schemaOrganizationName}" via legal suffix normalization.`
          );
        }
        return true;
      }
      return false;
    });

    if (!matchesAny) {
      isOrganizationConsistent = false;
      discrepancies.push(
        `Visible branding "${visibleOrganizationName || brandCandidates[0]}" differs from Organization schema name "${schemaOrganizationName}".`
      );
    }
  }

  // 5. Cross-Check Author Consistency
  let isAuthorConsistent = true;
  if (visibleAuthor && schemaAuthor) {
    const vClean = visibleAuthor.toLowerCase().replace(/[^a-z0-9]/g, "");
    const sClean = schemaAuthor.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!vClean.includes(sClean) && !sClean.includes(vClean)) {
      isAuthorConsistent = false;
      discrepancies.push(
        `Visible author byline "${visibleAuthor}" does not match Article schema author "${schemaAuthor}".`
      );
    }
  }

  // 6. Cross-Check Date Consistency
  let isDateConsistent = true;
  if (visibleDate && schemaDatePublished) {
    const vYear = visibleDate.match(/\b(20\d\d)\b/)?.[1];
    const sYear = schemaDatePublished.match(/\b(20\d\d)\b/)?.[1];
    if (vYear && sYear && vYear !== sYear) {
      isDateConsistent = false;
      discrepancies.push(
        `Visible publication year (${vYear}) conflicts with schema datePublished (${sYear}).`
      );
    }
  }

  return {
    visibleOrganizationName,
    schemaOrganizationName,
    visibleAuthor,
    schemaAuthor,
    visibleDate,
    schemaDatePublished,
    schemaDateModified,
    isOrganizationConsistent,
    isAuthorConsistent,
    isDateConsistent,
    discrepancies,
    normalizationNotes,
  };
}
