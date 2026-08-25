/**
 * Phase 28G: Prompt-to-Page Mapping & Answer Coverage Engine.
 * Defensibly determines which existing crawled page should logically answer each canonical prompt,
 * and assesses semantic answer completeness without keyword stuffing assumptions.
 */

import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptCandidate, PromptUniverseReport } from "../prompts/types";
import { PromptPageMapping, CandidatePageMatch, PromptPageCoverageState, AnswerCoverageLevel } from "./types";

export interface CrawledPageContext {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  h1Texts?: string[];
  headings?: string[];
  visibleText?: string;
  schemaTypes?: string[];
}

export class PromptPageMapper {
  public mapPromptsToPages(
    prompts: PromptCandidate[],
    pages: CrawledPageContext[],
    profile: ProjectKnowledgeProfile
  ): PromptPageMapping[] {
    const mappings: PromptPageMapping[] = [];

    for (const p of prompts) {
      const mapping = this.mapSinglePrompt(p, pages, profile);
      mappings.push(mapping);
    }

    return mappings;
  }

  public mapSinglePrompt(
    prompt: PromptCandidate,
    pages: CrawledPageContext[],
    profile: ProjectKnowledgeProfile
  ): PromptPageMapping {
    if (!pages || pages.length === 0) {
      return {
        promptId: prompt.id,
        promptText: prompt.prompt,
        intent: prompt.intents[0] || "INFORMATIONAL",
        funnelStage: prompt.funnelStage,
        brandedness: prompt.brandedness,
        targetPageUrl: null,
        candidatePages: [],
        mappingConfidence: "HIGH",
        coverageState: "NO_TARGET_PAGE",
        answerCoverage: "NOT_COVERED",
        answerCoverageEvidence: {
          whatIsProvided: null,
          targetAudienceMentioned: false,
          businessProblemSolved: false,
          missingElements: ["No crawled website pages available to map."],
        },
        notes: "No pages available in website crawl corpus.",
      };
    }

    const scoredCandidates: CandidatePageMatch[] = [];
    const promptTerms = this.extractSearchTokens(prompt.prompt);
    const isBrandedCompanyDiscovery = prompt.brandedness === "BRANDED" && (prompt.promptType === "BRAND_SPECIFIC" || prompt.promptType === "BRAND_DISCOVERY");
    const isVendorOrCategoryDiscovery = prompt.intents.includes("VENDOR_DISCOVERY") || prompt.intents.includes("RECOMMENDATION") || prompt.promptType === "CATEGORY_DISCOVERY" || prompt.promptType === "BEST_VENDOR";
    const isHowToOrGuide = prompt.intents.includes("HOW_TO") || prompt.promptType === "IMPLEMENTATION_GUIDANCE" || prompt.promptType === "DECISION_SUPPORT";

    // Identify matching offerings from Knowledge Profile
    const matchedOfferings = profile.offerings.filter((off) => {
      const offTerms = [off.name, ...(off.aliases || []), ...(off.relatedTopics || [])].map((t) => t.toLowerCase());
      return offTerms.some((term) => {
        const normTerm = term.replace(/[^a-z0-9]/g, "");
        const normPrompt = prompt.prompt.toLowerCase().replace(/[^a-z0-9]/g, "");
        return normPrompt.includes(normTerm) || (normTerm.length > 3 && prompt.prompt.toLowerCase().includes(term));
      });
    });

    const offeringSupportingUrls = new Set<string>();
    for (const off of matchedOfferings) {
      for (const u of off.supportingUrls || []) {
        offeringSupportingUrls.add(u.toLowerCase());
      }
    }

    for (const page of pages) {
      let score = 0;
      const reasons: string[] = [];
      const pageUrlLower = page.url.toLowerCase();
      const titleLower = (page.title || "").toLowerCase();
      const h1Combined = (page.h1Texts || []).join(" ").toLowerCase();
      const headingsCombined = (page.headings || []).join(" ").toLowerCase();
      const bodyTextLower = (page.visibleText || "").toLowerCase();

      // Classify Page Type
      const isHomepage = pageUrlLower === "https://www.botconsulting.io/" || pageUrlLower === "https://www.botconsulting.io" || pageUrlLower.endsWith(".io/") || pageUrlLower.endsWith(".com/");
      const isSolutionsOverview = pageUrlLower.endsWith("/solutions") || pageUrlLower.endsWith("/solutions/");
      const isDedicatedSolution = pageUrlLower.includes("/solution-") || pageUrlLower.includes("/cloudsmith") || pageUrlLower.includes("/odyssey");
      const isAboutPage = pageUrlLower.includes("/about");
      const isEditorialBlog = pageUrlLower.includes("/post/") || pageUrlLower.includes("/blogs") || pageUrlLower.includes("/news/");

      // 1. Direct Offering Supporting URL match from Knowledge Profile
      if (offeringSupportingUrls.has(pageUrlLower) || Array.from(offeringSupportingUrls).some((u) => pageUrlLower.includes(u) || u.includes(pageUrlLower))) {
        score += 35;
        reasons.push("Explicit supporting URL defined in Knowledge Profile for matching offering");
      }

      // 2. Intent-Aware Page Prioritization
      if (isBrandedCompanyDiscovery) {
        if (isHomepage) {
          score += 35;
          reasons.push("Homepage prioritized for company-wide brand discovery");
        } else if (isSolutionsOverview) {
          score += 30;
          reasons.push("Solutions overview page prioritized for general capability discovery");
        } else if (isAboutPage) {
          score += 25;
          reasons.push("About page prioritized for company profile intent");
        } else if (isEditorialBlog) {
          score -= 20;
          reasons.push("Single editorial blog penalized for general brand-wide query");
        }
      } else if (isVendorOrCategoryDiscovery) {
        if (isDedicatedSolution) {
          score += 35;
          reasons.push("Dedicated commercial solution landing page prioritized for vendor discovery");
        } else if (isSolutionsOverview) {
          score += 20;
          reasons.push("Solutions overview considered for category exploration");
        } else if (isEditorialBlog) {
          score -= 10;
          reasons.push("Editorial post deprioritized relative to commercial service landing page");
        }
      } else if (isHowToOrGuide) {
        if (isEditorialBlog) {
          score += 25;
          reasons.push("In-depth editorial post prioritized for how-to/implementation guidance");
        }
      }

      // Identify specific technology or offering tokens in prompt
      const knownTechTokens = ["cloudsmith", "servicenow", "salesforce", "snowflake", "odyssey", "hakkoda", "databricks", "redshift", "powerbi", "teamcity"];
      const promptTechTokens = promptTerms.filter((t) => knownTechTokens.some((kt) => t.includes(kt) || kt.includes(t)));
      const pageFullContent = `${pageUrlLower} ${titleLower} ${h1Combined} ${headingsCombined} ${bodyTextLower}`.replace(/[^a-z0-9]/g, " ");

      // Strict Entity / Technology Mismatch Penalty
      if (promptTechTokens.length > 0) {
        const pageHasTech = promptTechTokens.some((pt) => {
          const normPt = pt.replace(/[^a-z0-9]/g, "");
          return pageFullContent.includes(pt) || (normPt.length > 3 && pageFullContent.includes(normPt));
        });
        if (!pageHasTech) {
          // If page does not mention the prompt's specific technology, it cannot be a target
          continue;
        }
      }

      // 3. URL slug semantic match (with hyphen normalization)
      let urlTokenMatches = 0;
      const normalizedSlug = pageUrlLower.replace(/[^a-z0-9]/g, " ");
      for (const term of promptTerms) {
        const normTerm = term.replace(/[^a-z0-9]/g, "");
        if (normTerm.length > 2 && (normalizedSlug.includes(term) || normalizedSlug.includes(normTerm))) {
          urlTokenMatches++;
        }
      }
      if (urlTokenMatches > 0) {
        const slugScore = Math.min(25, urlTokenMatches * 10);
        score += slugScore;
        reasons.push(`URL path contains ${urlTokenMatches} prompt keyword(s)`);
      }

      // 4. Title semantic match
      let titleTokenMatches = 0;
      const normalizedTitle = titleLower.replace(/[^a-z0-9]/g, " ");
      for (const term of promptTerms) {
        const normTerm = term.replace(/[^a-z0-9]/g, "");
        if (normTerm.length > 2 && (normalizedTitle.includes(term) || normalizedTitle.includes(normTerm))) {
          titleTokenMatches++;
        }
      }
      if (titleTokenMatches > 0) {
        const tScore = Math.min(25, titleTokenMatches * 8);
        score += tScore;
        reasons.push(`Page title matches ${titleTokenMatches} prompt token(s)`);
      }

      // 5. H1 & Headings match
      let h1TokenMatches = 0;
      const normalizedH1 = (h1Combined + " " + headingsCombined).replace(/[^a-z0-9]/g, " ");
      for (const term of promptTerms) {
        const normTerm = term.replace(/[^a-z0-9]/g, "");
        if (normTerm.length > 2 && (normalizedH1.includes(term) || normalizedH1.includes(normTerm))) {
          h1TokenMatches++;
        }
      }
      if (h1TokenMatches > 0) {
        score += Math.min(20, h1TokenMatches * 8);
        reasons.push(`Heading outline matches ${h1TokenMatches} prompt token(s)`);
      }

      // 6. Body content topical relevance
      let bodyMatches = 0;
      for (const term of promptTerms) {
        if (bodyTextLower.includes(term)) {
          bodyMatches++;
        }
      }
      if (bodyMatches >= 2) {
        score += 10;
        reasons.push("Main content discusses primary prompt topics");
      }

      // 7. Schema signal
      if (page.schemaTypes && (page.schemaTypes.includes("Service") || page.schemaTypes.includes("Product"))) {
        score += 5;
        reasons.push("Page contains structured Service/Product entity schema");
      }

      if (score > 15) {
        scoredCandidates.push({
          url: page.url,
          score: Math.min(100, Math.max(0, score)),
          title: page.title || null,
          matchReasons: reasons,
        });
      }
    }

    scoredCandidates.sort((a, b) => b.score - a.score);

    let coverageState: PromptPageCoverageState = "NO_TARGET_PAGE";
    let targetPageUrl: string | null = null;
    let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    if (scoredCandidates.length === 0 || scoredCandidates[0].score < 25) {
      coverageState = "NO_TARGET_PAGE";
      targetPageUrl = null;
      confidence = "HIGH";
    } else if (
      scoredCandidates.length > 1 &&
      scoredCandidates[0].score >= 50 &&
      scoredCandidates[1].score >= 45 &&
      Math.abs(scoredCandidates[0].score - scoredCandidates[1].score) <= 5 &&
      !isBrandedCompanyDiscovery
    ) {
      coverageState = "MULTIPLE_COMPETING_PAGES";
      targetPageUrl = scoredCandidates[0].url;
      confidence = "MEDIUM";
    } else if (scoredCandidates[0].score >= 55) {
      coverageState = "STRONG_MATCH";
      targetPageUrl = scoredCandidates[0].url;
      confidence = "HIGH";
    } else if (scoredCandidates[0].score >= 35) {
      coverageState = "PARTIAL_MATCH";
      targetPageUrl = scoredCandidates[0].url;
      confidence = "MEDIUM";
    } else {
      coverageState = "WEAK_MATCH";
      targetPageUrl = scoredCandidates[0].url;
      confidence = "LOW";
    }

    // Evaluate answer coverage on target page
    const targetPage = pages.find((p) => p.url === targetPageUrl);
    const answerEval = this.evaluateAnswerCoverage(prompt, targetPage);

    return {
      promptId: prompt.id,
      promptText: prompt.prompt,
      intent: prompt.intents[0] || "INFORMATIONAL",
      funnelStage: prompt.funnelStage,
      brandedness: prompt.brandedness,
      targetPageUrl,
      candidatePages: scoredCandidates.slice(0, 5),
      mappingConfidence: confidence,
      coverageState,
      answerCoverage: answerEval.level,
      answerCoverageEvidence: answerEval.evidence,
      notes: `Mapped with ${coverageState} (${scoredCandidates[0]?.score || 0}% score).`,
    };
  }

  private evaluateAnswerCoverage(
    prompt: PromptCandidate,
    page?: CrawledPageContext
  ): { level: AnswerCoverageLevel; evidence: PromptPageMapping["answerCoverageEvidence"] } {
    if (!page) {
      return {
        level: "NOT_COVERED",
        evidence: {
          whatIsProvided: null,
          targetAudienceMentioned: false,
          businessProblemSolved: false,
          missingElements: ["No target page mapped for this prompt."],
        },
      };
    }

    const textLower = (page.visibleText || "").toLowerCase();
    const titleH1Lower = ((page.title || "") + " " + (page.h1Texts || []).join(" ")).toLowerCase();
    const fullText = titleH1Lower + " " + textLower;

    // 1. Service / Offering Definition
    const serviceDefKeywords = [
      "provide", "offering", "offers", "offer", "deliver", "delivers", "specializes",
      "specialization", "consulting", "services", "solutions", "implementation", "advisory",
      "architecture", "integration", "workflow", "management", "platform"
    ];
    const hasServiceDefinition = serviceDefKeywords.some((k) => fullText.includes(k)) && fullText.length > 50;

    // 2. Audience Identification
    const audienceKeywords = [
      "enterprise", "client", "clients", "organization", "organizations",
      "team", "teams", "company", "companies", "leader", "leaders",
      "business", "businesses", "industry", "industries", "decision maker"
    ];
    const hasAudience = audienceKeywords.some((k) => fullText.includes(k));

    // 3. Problem / Outcome Resolution
    const problemKeywords = [
      "help", "transform", "optimize", "reduce", "streamline", "accelerate",
      "automate", "solve", "challenge", "challenges", "efficiency", "roi",
      "modernize", "scale", "eliminate", "improve", "impact", "results"
    ];
    const hasProblemOutcome = problemKeywords.some((k) => fullText.includes(k));

    const missing: string[] = [];
    if (!hasServiceDefinition) {
      missing.push("Concise definition of what exact service or capability is delivered");
    }
    if (!hasAudience) {
      missing.push("Clear identification of target enterprise client / industry audience");
    }
    if (!hasProblemOutcome) {
      missing.push("Explicit business problem solved or operational outcome achieved");
    }

    let level: AnswerCoverageLevel = "NOT_COVERED";
    if (hasServiceDefinition && hasAudience && hasProblemOutcome) {
      level = "COVERED";
    } else if (hasServiceDefinition || (hasAudience && hasProblemOutcome)) {
      level = "PARTIALLY_COVERED";
    } else {
      level = "NOT_COVERED";
    }

    return {
      level,
      evidence: {
        whatIsProvided: hasServiceDefinition ? "Service definition identified in page content." : null,
        targetAudienceMentioned: hasAudience,
        businessProblemSolved: hasProblemOutcome,
        missingElements: missing,
        extractedSnippet: page.visibleText ? page.visibleText.slice(0, 250).trim() + "..." : null,
      },
    };
  }

  private extractSearchTokens(promptText: string): string[] {
    const stopwords = new Set([
      "what", "is", "the", "does", "provide", "for", "to", "in", "and", "or", "of",
      "who", "are", "top", "best", "how", "can", "a", "an", "on", "with", "by", "clients",
      "firm", "firms", "company", "companies", "approach", "recommended", "should", "looking",
      "modernize", "operations", "we", "our", "which", "using", "evaluate", "choose"
    ]);

    return promptText
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopwords.has(t));
  }
}
