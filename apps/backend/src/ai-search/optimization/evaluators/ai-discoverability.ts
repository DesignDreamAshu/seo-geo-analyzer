/**
 * Phase 28H: AI Discoverability & Technical Crawler Policy Evaluator (Partial Implementation).
 * Evaluates deterministic on-site AI crawler policies (robots.txt directives for GPTBot, ClaudeBot,
 * PerplexityBot, Google-Extended) and server-side content accessibility without making unsupported
 * claims regarding third-party LLM search indexing.
 */

import { ProjectKnowledgeProfile } from "../../knowledge-profile/types";
import { AIOptimizationFinding } from "../types";

export interface AICrawlerDirectiveInfo {
  botName: string;
  isExplicitlyBlocked: boolean;
  isExplicitlyAllowed: boolean;
  userAgentSnippet?: string;
}

export function evaluateAIDiscoverability(
  projectId: string,
  runId: string,
  robotsTxtContent: string | null | undefined,
  profile: ProjectKnowledgeProfile
): AIOptimizationFinding[] {
  const findings: AIOptimizationFinding[] = [];
  const brandName = profile.brand.name;

  if (!robotsTxtContent) return findings;

  const lines = robotsTxtContent.split(/\r?\n/);
  const knownAIBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

  const blockedBots: string[] = [];

  let currentUserAgent = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;

    const [directive, value] = trimmed.split(":").map((s) => s.trim());
    if (!directive || !value) continue;

    if (directive.toLowerCase() === "user-agent") {
      currentUserAgent = value;
    } else if (directive.toLowerCase() === "disallow" && value === "/") {
      if (knownAIBots.includes(currentUserAgent)) {
        blockedBots.push(currentUserAgent);
      }
    }
  }

  if (blockedBots.length > 0) {
    findings.push({
      id: `opt_ai_discoverability_blocked_${projectId}`,
      projectId,
      runId,
      code: "AI_OPT_DISCOVERABILITY_CRAWLER_EXPLICITLY_BLOCKED",
      category: "AI_DISCOVERABILITY",
      type: "OBSERVATION",
      priority: "MEDIUM_IMPACT",
      confidence: "HIGH",
      evidenceStrength: "STRONG",
      title: `Explicit robots.txt Disallow Directives for ${blockedBots.length} AI Web Crawlers`,
      summary: `Your robots.txt file explicitly blocks access to AI scraping bots (${blockedBots.join(", ")}).`,
      whyItMatters:
        "When an AI crawler (such as GPTBot or PerplexityBot) is disallowed in robots.txt, the corresponding AI search engine cannot perform live retrieval against your pages to synthesize up-to-date answers.",
      problem: {
        observed: `robots.txt contains explicit 'Disallow: /' directive for user-agent(s): ${blockedBots.join(", ")}.`,
        explanation:
          "AI models will rely only on outdated training corpus snapshots or third-party syndications rather than fetching your live website content.",
      },
      evidence: {
        sourceSignal: "ROBOTS_TXT_AI_DIRECTIVE_AUDIT",
        websiteEvidence: {
          url: `${profile.domain.replace(/\/$/, "")}/robots.txt`,
          pageTitle: "robots.txt",
          element: "robots.txt User-Agent Rules",
          observedFact: {
            blockedAIBots: blockedBots,
          },
        },
      },
      rootCause: {
        hypothesis: "Robots.txt security configurations restrict AI training crawlers from indexing website assets.",
        contributingFactors: [
          "Security/privacy policy blocks automated scrapers indiscriminately.",
        ],
        isDeterministic: true,
        rationale: "Deterministic match of Disallow: / directive against known AI crawler user-agents.",
      },
      affectedPrompts: [],
      affectedPages: [{ url: `${profile.domain.replace(/\/$/, "")}/robots.txt`, matchType: "ROBOTS_TXT_POLICY" }],
      affectedEntities: [brandName],
      affectedProviders: blockedBots.map((b) => (b.includes("GPT") ? "OPENAI" : b.includes("Claude") ? "ANTHROPIC" : "PERPLEXITY")),
      recommendation: {
        objective: "Review AI crawler directives in robots.txt and selectively allow search retrieval bots if live AI visibility is desired.",
        whatShouldChange:
          "If the company wishes to be discovered and cited in AI answer engines, update robots.txt to allow search retrieval crawlers while maintaining restrictions on training dump crawlers if desired.",
        whereToChange: `${profile.domain.replace(/\/$/, "")}/robots.txt`,
        actionSteps: [
          "Consult with marketing and legal stakeholders regarding AI discovery preferences.",
          "To allow AI search discovery (e.g. Perplexity, ChatGPT Search), remove the Disallow directive for those specific bots.",
        ],
        cautions: [
          "Do not modify robots.txt without organization policy consensus.",
          "Allowing a crawler in robots.txt does not guarantee inclusion in AI search summaries.",
        ],
      },
      verificationMethod: {
        level1WebsiteVerification: {
          method: "robots.txt Policy Re-Audit",
          targetCheck: "robots.txt parsed without Disallow: / on designated AI search user-agents",
          expectedEvidence: "Target AI user-agents permitted in robots.txt HTTP response.",
        },
        level2ProviderVerification: {
          method: "AI Engine Real-Time Retrieval Test",
          targetPromptIds: [],
          expectedOutcome: "AI search engines perform live HTTP fetch against the domain.",
        },
      },
      lifecycleStatus: "OPEN",
      noGuaranteeDisclaimer:
        "robots.txt directives determine crawler retrieval permissions. They do not guarantee search engine ranking.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
