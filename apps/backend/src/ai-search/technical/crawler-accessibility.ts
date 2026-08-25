/**
 * Engine A: AI Crawler & Technical Accessibility Evaluator
 * Evaluates RFC 9309 robots.txt compliance for documented AI agents,
 * inspects /llms.txt, and verifies raw vs rendered DOM text accessibility.
 */

import { nanoid } from "nanoid";
import type {
  AICrawlerStatus,
  LlmsTxtStatus,
  AISearchFinding,
  AIObservabilityRecord,
} from "../types";
import type { CrawledPageData } from "../../crawler/types";

export interface DocumentedAIAgent {
  agentName: string;
  owner: string;
  purpose: "SEARCH_RETRIEVAL" | "MODEL_TRAINING" | "USER_INITIATED_FETCH" | "GENERAL_INDEXING";
  docSourceVersion: string;
  description: string;
}

export const DOCUMENTED_AI_AGENTS: DocumentedAIAgent[] = [
  {
    agentName: "OAI-SearchBot",
    owner: "OpenAI",
    purpose: "SEARCH_RETRIEVAL",
    docSourceVersion: "OpenAI-2026",
    description: "Retrieval crawler for OpenAI / ChatGPT live web search citations.",
  },
  {
    agentName: "GPTBot",
    owner: "OpenAI",
    purpose: "MODEL_TRAINING",
    docSourceVersion: "OpenAI-2026",
    description: "Training dataset collection crawler for OpenAI foundation models.",
  },
  {
    agentName: "ChatGPT-User",
    owner: "OpenAI",
    purpose: "USER_INITIATED_FETCH",
    docSourceVersion: "OpenAI-2026",
    description: "Direct user-initiated live web browsing fetch inside ChatGPT sessions.",
  },
  {
    agentName: "PerplexityBot",
    owner: "Perplexity AI",
    purpose: "SEARCH_RETRIEVAL",
    docSourceVersion: "Perplexity-2026",
    description: "Search retrieval bot used to power Perplexity answer synthesis and citations.",
  },
  {
    agentName: "ClaudeBot",
    owner: "Anthropic",
    purpose: "SEARCH_RETRIEVAL",
    docSourceVersion: "Anthropic-2026",
    description: "Anthropic search indexer and knowledge retrieval crawler.",
  },
  {
    agentName: "Claude-User",
    owner: "Anthropic",
    purpose: "USER_INITIATED_FETCH",
    docSourceVersion: "Anthropic-2026",
    description: "User-initiated browsing bot used by Claude interactive web artifacts.",
  },
  {
    agentName: "Google-Extended",
    owner: "Google",
    purpose: "MODEL_TRAINING",
    docSourceVersion: "Google-2026",
    description: "Standalone training opt-out token for Gemini models without impacting Google Search.",
  },
  {
    agentName: "Bingbot",
    owner: "Microsoft",
    purpose: "GENERAL_INDEXING",
    docSourceVersion: "Microsoft-2026",
    description: "General web search crawler powering Bing Search & Copilot grounding.",
  },
];

interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
  length: number;
}

interface UserAgentBlock {
  userAgents: string[];
  rules: RobotsRule[];
}

function parseRobotsTxt(content: string): UserAgentBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: UserAgentBlock[] = [];
  let currentUas: string[] = [];
  let currentRules: RobotsRule[] = [];

  for (let line of lines) {
    line = line.split("#")[0].trim();
    if (!line) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === "user-agent") {
      if (currentRules.length > 0 && currentUas.length > 0) {
        blocks.push({ userAgents: currentUas, rules: currentRules });
        currentUas = [];
        currentRules = [];
      }
      currentUas.push(value.toLowerCase());
    } else if (directive === "allow" || directive === "disallow") {
      if (currentUas.length > 0) {
        currentRules.push({
          type: directive as "allow" | "disallow",
          path: value,
          length: value.length,
        });
      }
    }
  }

  if (currentUas.length > 0 && currentRules.length > 0) {
    blocks.push({ userAgents: currentUas, rules: currentRules });
  }

  return blocks;
}

function matchesPath(rulePath: string, targetPath: string): boolean {
  if (!rulePath) return false;
  if (rulePath === "/") return true;

  // Convert simple wildcard to regex
  const regexPattern = "^" + rulePath.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\\\*/g, ".*");
  try {
    const reg = new RegExp(regexPattern);
    return reg.test(targetPath);
  } catch {
    return targetPath.startsWith(rulePath);
  }
}

export function evaluateRobotsAccessForAgent(
  agentName: string,
  blocks: UserAgentBlock[],
  samplePaths: string[] = ["/", "/about", "/blog", "/services"]
): { state: "ALLOWED" | "BLOCKED" | "PARTIALLY_BLOCKED" | "UNKNOWN"; matchedDirective: string | null; isExplicit: boolean; affectedPaths: string[] } {
  const normAgent = agentName.toLowerCase();

  // 1. Look for explicit user-agent block
  const explicitBlock = blocks.find((b) => b.userAgents.some((ua) => ua === normAgent || ua === normAgent + "*"));

  // 2. Look for wildcard block
  const wildcardBlock = blocks.find((b) => b.userAgents.some((ua) => ua === "*"));

  const targetBlock = explicitBlock || wildcardBlock;
  if (!targetBlock) {
    return { state: "ALLOWED", matchedDirective: null, isExplicit: false, affectedPaths: [] };
  }

  const isExplicit = Boolean(explicitBlock);
  const blockedPaths: string[] = [];

  for (const path of samplePaths) {
    // Sort rules by length (most specific first)
    const matchingRules = targetBlock.rules
      .filter((r) => matchesPath(r.path, path))
      .sort((a, b) => b.length - a.length);

    if (matchingRules.length > 0) {
      const mostSpecific = matchingRules[0];
      if (mostSpecific.type === "disallow" && mostSpecific.path !== "") {
        blockedPaths.push(path);
      }
    }
  }

  if (blockedPaths.length === 0) {
    return { state: "ALLOWED", matchedDirective: "Allow (or empty disallow)", isExplicit, affectedPaths: [] };
  } else if (blockedPaths.length === samplePaths.length) {
    return { state: "BLOCKED", matchedDirective: "Disallow: /", isExplicit, affectedPaths: blockedPaths };
  } else {
    return { state: "PARTIALLY_BLOCKED", matchedDirective: `Disallow: ${blockedPaths[0]}`, isExplicit, affectedPaths: blockedPaths };
  }
}

export function evaluateAICrawlerAccessibility(
  robotsTxtContent: string | null,
  llmsTxtContent: string | null,
  crawledPages: CrawledPageData[]
): {
  statuses: AICrawlerStatus[];
  llmsTxtStatus: LlmsTxtStatus;
  rawVsRenderAccessible: boolean;
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
} {
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];
  const blocks = robotsTxtContent ? parseRobotsTxt(robotsTxtContent) : [];

  const statuses: AICrawlerStatus[] = [];

  for (const agent of DOCUMENTED_AI_AGENTS) {
    const res = evaluateRobotsAccessForAgent(agent.agentName, blocks);

    statuses.push({
      agentName: agent.agentName,
      owner: agent.owner,
      purpose: agent.purpose,
      accessState: res.state,
      matchedDirective: res.matchedDirective,
      isExplicit: res.isExplicit,
      affectedPaths: res.affectedPaths,
      docSourceVersion: agent.docSourceVersion,
    });

    const isSearchBot = agent.purpose === "SEARCH_RETRIEVAL";
    const dimId = `TC_ROBOTS_${agent.agentName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_STATUS`;

    observability.push({
      dimensionId: dimId,
      pillar: "TECHNICAL",
      measurementClass: "DETERMINISTIC",
      evidenceLevel: "LEVEL_A",
      eligibleCount: 1,
      evaluatedCount: 1,
      passedCount: res.state === "ALLOWED" ? 1 : 0,
      failedCount: res.state === "BLOCKED" && isSearchBot ? 1 : 0,
      skippedCount: 0,
      status: res.state === "BLOCKED" && isSearchBot ? "FAILED" : "PASSED",
    });

    // Create findings only for meaningful search retrieval blockers
    if (res.state === "BLOCKED" && isSearchBot) {
      findings.push({
        id: `ai_finding_${nanoid(10)}`,
        dimensionId: `TC_ROBOTS_${agent.agentName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
        pillar: "TECHNICAL",
        measurementClass: "DETERMINISTIC",
        evidenceLevel: "LEVEL_A",
        severity: "WARNING",
        title: `Search retrieval bot ${agent.agentName} is blocked in robots.txt`,
        description: `${agent.agentName} (${agent.owner}) is disallowed from crawling this site. This prevents your content from being retrieved and cited in live AI search answers on this platform.`,
        recommendation: `Allow ${agent.agentName} in robots.txt with 'User-agent: ${agent.agentName}\\nAllow: /' if you want your site cited in live ${agent.owner} search results.`,
        confidenceScore: 1.0,
        impactScore: 6,
        isScoring: true,
        affectedUrl: "/robots.txt",
        evidence: {
          observed: `Directives matching ${agent.agentName} result in BLOCKED state for paths: ${res.affectedPaths.join(", ")}`,
          codeSnippet: res.matchedDirective || undefined,
        },
        remediationBlueprint: {
          objective: `Permit ${agent.agentName} search retrieval access.`,
          actionSteps: [
            `Add explicit User-agent block for ${agent.agentName} in robots.txt.`,
            `Ensure Allow: / directive is present.`,
            `Verify training crawler (${agent.agentName === "OAI-SearchBot" ? "GPTBot" : "training bots"}) remains blocked if you only want search citations without model pre-training ingestion.`,
          ],
          verificationMethod: `Re-inspect /robots.txt using the robots policy parser.`,
        },
      });
    }
  }

  // LLMS.txt inspection
  const hasLlmsTxt = Boolean(llmsTxtContent && llmsTxtContent.length > 20);
  const llmsSections: string[] = [];
  if (hasLlmsTxt && llmsTxtContent) {
    if (llmsTxtContent.includes("# ")) llmsSections.push("h1_header");
    if (llmsTxtContent.includes("## ")) llmsSections.push("h2_sections");
    if (llmsTxtContent.includes("- [")) llmsSections.push("markdown_links");
  }

  const llmsTxtStatus: LlmsTxtStatus = {
    present: hasLlmsTxt,
    url: "/llms.txt",
    isSyntacticallyValid: hasLlmsTxt,
    charLength: llmsTxtContent?.length || 0,
    sectionsFound: llmsSections,
    notes: hasLlmsTxt
      ? "Valid /llms.txt documentation index present."
      : "/llms.txt is an optional experimental proposal and absence does not cause score penalties.",
  };

  observability.push({
    dimensionId: "TC_LLMS_TXT_VALIDITY",
    pillar: "TECHNICAL",
    measurementClass: "EXPERIMENTAL",
    evidenceLevel: "LEVEL_D",
    eligibleCount: 1,
    evaluatedCount: 1,
    passedCount: hasLlmsTxt ? 1 : 0,
    failedCount: 0, // Never fail experimental
    skippedCount: 0,
    status: "PASSED",
  });

  if (!hasLlmsTxt) {
    findings.push({
      id: `ai_finding_${nanoid(10)}`,
      dimensionId: "TC_LLMS_TXT_VALIDITY",
      pillar: "TECHNICAL",
      measurementClass: "EXPERIMENTAL",
      evidenceLevel: "LEVEL_D",
      severity: "NOTICE",
      title: "Consider adding an /llms.txt index file",
      description: "/llms.txt is an emerging web specification providing curated markdown documentation directly formatted for LLM developer tools and context ingestion.",
      recommendation: "Provide a concise /llms.txt at the root linking to core markdown documentation or company overview pages.",
      confidenceScore: 0.8,
      impactScore: 0, // Non-scoring experimental notice
      isScoring: false,
      affectedUrl: "/llms.txt",
      evidence: {
        observed: "HTTP GET /llms.txt returned 404 / Not Found.",
      },
      remediationBlueprint: {
        objective: "Create an experimental /llms.txt file.",
        actionSteps: [
          "Create /llms.txt containing a clear H1 site title, short description, and curated list of key markdown URLs.",
        ],
        verificationMethod: "Inspect HTTP GET /llms.txt response.",
        disclaimer: "Presence of llms.txt is an emerging convention and does not guarantee ranking improvements.",
      },
    });
  }

  // Raw vs Render Content Accessibility
  let rawVsRenderAccessible = true;
  for (const page of crawledPages.slice(0, 20)) {
    if (page.authoritativeSource === "rendered" && page.rawFacts && page.renderedFacts) {
      const rawWords = (page.rawFacts as any)?.visibleBodyWordCount || page.rawWordCount || 0;
      const renderedWords = page.renderedFacts.mainContentWordCount || page.renderedFacts.visibleBodyWordCount || 0;
      if (rawWords < 50 && renderedWords > 250) {
        rawVsRenderAccessible = false;
        findings.push({
          id: `ai_finding_${nanoid(10)}`,
          dimensionId: "TC_HEADLESS_JS_READABILITY",
          pillar: "TECHNICAL",
          measurementClass: "DETERMINISTIC",
          evidenceLevel: "LEVEL_A",
          severity: "OPPORTUNITY",
          title: "Primary content requires client-side JavaScript hydration to read",
          description: "Raw HTML delivered to crawlers contains fewer than 50 words, requiring browser JavaScript rendering to extract text. Fast AI search indexing bots may index incomplete snippets.",
          recommendation: "Implement Server-Side Rendering (SSR) or Static Site Generation (SSG) so critical content is visible in the initial HTTP response.",
          confidenceScore: 0.95,
          impactScore: 3,
          isScoring: true,
          affectedUrl: page.url,
          evidence: {
            observed: `Raw HTML word count: ${rawWords} words vs Rendered DOM word count: ${renderedWords} words.`,
          },
          remediationBlueprint: {
            objective: "Deliver essential body text in server-rendered initial HTML.",
            actionSteps: [
              "Enable SSR or pre-rendering for key content pages.",
              "Ensure introductory paragraphs are present in initial server HTML payload.",
            ],
            verificationMethod: "Compare raw curl output word count against browser DOM.",
          },
        });
        break;
      }
    }
  }

  return {
    statuses,
    llmsTxtStatus,
    rawVsRenderAccessible,
    findings,
    observability,
  };
}
