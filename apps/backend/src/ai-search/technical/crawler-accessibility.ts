/**
 * Engine A: AI Crawler & Technical Accessibility Evaluator (Methodology: v28c-2.0).
 * Evaluates RFC 9309 robots.txt compliance for documented AI agents,
 * inspects /llms.txt, rendered DOM textual availability, indexability ratio,
 * semantic DOM structure, and structured data syntax validity.
 */

import { nanoid } from "nanoid";
import type {
  AICrawlerStatus,
  LlmsTxtStatus,
  AISearchFinding,
  AIObservabilityRecord,
  EvaluatorResult,
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
  const explicitBlock = blocks.find((b) => b.userAgents.some((ua) => ua === normAgent || ua === normAgent + "*"));
  const wildcardBlock = blocks.find((b) => b.userAgents.some((ua) => ua === "*"));

  const targetBlock = explicitBlock || wildcardBlock;
  if (!targetBlock) {
    return { state: "ALLOWED", matchedDirective: null, isExplicit: false, affectedPaths: [] };
  }

  const isExplicit = Boolean(explicitBlock);
  const blockedPaths: string[] = [];

  for (const path of samplePaths) {
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
  evaluators: EvaluatorResult[];
} {
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];
  const evaluators: EvaluatorResult[] = [];
  const blocks = robotsTxtContent ? parseRobotsTxt(robotsTxtContent) : [];

  const statuses: AICrawlerStatus[] = [];
  let blockedSearchBots = 0;
  const searchAgents = DOCUMENTED_AI_AGENTS.filter((a) => a.purpose === "SEARCH_RETRIEVAL");

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
    if (isSearchBot && res.state === "BLOCKED") blockedSearchBots++;

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
            `Verify training crawler remains blocked if you only want search citations without model pre-training ingestion.`,
          ],
          verificationMethod: `Re-inspect /robots.txt using the robots policy parser.`,
        },
      });
    }
  }

  // AIO Evaluator 1: AI Search Crawler Access (Weight: 20%)
  const searchBotPassRate = (searchAgents.length - blockedSearchBots) / searchAgents.length;
  const aio1Score = searchBotPassRate === 1.0 ? 1.0 : searchBotPassRate >= 0.6 ? 0.6 : 0.0;
  evaluators.push({
    evaluatorId: "AIO_ROBOTS_AI_AGENTS",
    evaluatorName: "AI Search Retrieval Crawler Directives",
    pillar: "TECHNICAL",
    weight: 20,
    aggregationLevel: "SITE_LEVEL",
    status: aio1Score === 1.0 ? "PASS" : aio1Score >= 0.5 ? "PARTIAL" : "FAIL",
    score: aio1Score,
    earnedPoints: Math.round(aio1Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: blockedSearchBots === 0
      ? "All primary AI search retrieval agents (OAI-SearchBot, PerplexityBot, ClaudeBot) are permitted in robots.txt."
      : `${blockedSearchBots} / ${searchAgents.length} AI search retrieval agents are blocked in robots.txt.`,
    threshold: "100% of search retrieval bots permitted with HTTP 200 or default allow.",
    recommendation: blockedSearchBots > 0 ? "Permit AI search retrieval user-agents in robots.txt." : undefined,
  });

  // Eligible HTML indexable pages
  const eligiblePages = crawledPages.filter(
    (p) => p.resourceType === "html_page" && p.statusCode >= 200 && p.statusCode < 400 && p.isIndexable
  );
  const totalPages = Math.max(1, eligiblePages.length);

  // AIO Evaluator 2: Rendered vs Raw Content Availability (Weight: 25%)
  let pagesWithSubstantialRaw = 0;
  let rawVsRenderAccessible = true;
  for (const p of eligiblePages) {
    const rawWords = p.rawWordCount || (p.rawFacts as any)?.visibleBodyWordCount || 0;
    const rendWords = p.renderedWordCount || (p.renderedFacts as any)?.visibleBodyWordCount || rawWords;
    if (rendWords === 0 || rawWords >= rendWords * 0.7 || rawWords >= 200) {
      pagesWithSubstantialRaw++;
    } else {
      rawVsRenderAccessible = false;
    }
  }
  const rawRatio = Math.round((pagesWithSubstantialRaw / totalPages) * 100) / 100;
  const aio2Score = rawRatio >= 0.85 ? 1.0 : rawRatio >= 0.6 ? 0.75 : rawRatio >= 0.4 ? 0.5 : 0.25;
  evaluators.push({
    evaluatorId: "AIO_RENDERED_CONTENT_AVAILABILITY",
    evaluatorName: "Server-Delivered Textual Availability (SSR / SSG)",
    pillar: "TECHNICAL",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    status: aio2Score === 1.0 ? "PASS" : aio2Score >= 0.5 ? "PARTIAL" : "FAIL",
    score: aio2Score,
    earnedPoints: Math.round(aio2Score * 25 * 10) / 10,
    maxPoints: 25,
    rawObservation: `${pagesWithSubstantialRaw} / ${totalPages} pages (${Math.round(rawRatio * 100)}%) deliver complete body content in initial server HTML without client hydration dependency.`,
    threshold: ">= 85% of pages deliver text without client hydration dependency.",
    recommendation: aio2Score < 1.0 ? "Implement Server-Side Rendering (SSR) or Static Site Generation (SSG) for client-dependent pages." : undefined,
  });

  // AIO Evaluator 3: Clean Canonical Indexability Ratio (Weight: 20%)
  const indexableCount = eligiblePages.length;
  const hygieneRatio = Math.min(1.0, Math.round((indexableCount / Math.max(1, crawledPages.length)) * 100) / 100);
  const aio3Score = hygieneRatio >= 0.9 ? 1.0 : hygieneRatio >= 0.75 ? 0.75 : 0.5;
  evaluators.push({
    evaluatorId: "AIO_INDEXABLE_CORPUS_HYGIENE",
    evaluatorName: "Clean Canonical Indexability Ratio",
    pillar: "TECHNICAL",
    weight: 20,
    aggregationLevel: "SITE_LEVEL",
    status: aio3Score === 1.0 ? "PASS" : "PARTIAL",
    score: aio3Score,
    earnedPoints: Math.round(aio3Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: `${indexableCount} / ${crawledPages.length} crawled URLs (${Math.round(hygieneRatio * 100)}%) are clean, canonical, indexable 200 OK HTML pages.`,
    threshold: ">= 90% of discovered crawl corpus is canonical and indexable.",
  });

  // AIO Evaluator 4: Semantic DOM Landmarks (Weight: 20%)
  let semanticPages = 0;
  for (const p of eligiblePages) {
    if ((p as any).hasMainLandmark || (p.rawFacts as any)?.hasMainLandmark || (p.html && /<main\b|<article\b/i.test(p.html))) {
      semanticPages++;
    }
  }
  const semanticRatio = Math.round((semanticPages / totalPages) * 100) / 100;
  const aio4Score = semanticRatio >= 0.8 ? 1.0 : semanticRatio >= 0.5 ? 0.75 : 0.4;
  evaluators.push({
    evaluatorId: "AIO_SEMANTIC_STRUCTURE",
    evaluatorName: "Semantic DOM Landmarks (<main>, <article>, <header>)",
    pillar: "TECHNICAL",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    status: aio4Score === 1.0 ? "PASS" : "PARTIAL",
    score: aio4Score,
    earnedPoints: Math.round(aio4Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: `${semanticPages} / ${totalPages} pages (${Math.round(semanticRatio * 100)}%) use semantic landmark containers (<main>, <article>) for clear content boundary extraction.`,
    threshold: ">= 80% of pages contain semantic landmark containers.",
    recommendation: aio4Score < 1.0 ? "Wrap primary page content in <main> or <article> landmark elements." : undefined,
  });

  // AIO Evaluator 5: Structured Data Syntax Validity (Weight: 15%)
  let validSchemaPages = 0;
  for (const p of eligiblePages) {
    if (p.schemaJsonLd && Array.isArray(p.schemaJsonLd) && p.schemaJsonLd.length > 0) {
      validSchemaPages++;
    }
  }
  const schemaRatio = Math.round((validSchemaPages / totalPages) * 100) / 100;
  const aio5Score = schemaRatio >= 0.7 ? 1.0 : schemaRatio >= 0.3 ? 0.6 : 0.2;
  evaluators.push({
    evaluatorId: "AIO_STRUCTURED_DATA_SYNTAX",
    evaluatorName: "Machine-Readable Schema Presence & Syntax",
    pillar: "TECHNICAL",
    weight: 15,
    aggregationLevel: "PAGE_LEVEL",
    status: aio5Score >= 0.8 ? "PASS" : aio5Score >= 0.5 ? "PARTIAL" : "FAIL",
    score: aio5Score,
    earnedPoints: Math.round(aio5Score * 15 * 10) / 10,
    maxPoints: 15,
    rawObservation: `${validSchemaPages} / ${totalPages} pages (${Math.round(schemaRatio * 100)}%) include syntactically valid JSON-LD structured data blocks.`,
    threshold: ">= 70% of indexable pages include valid JSON-LD structured data.",
    recommendation: aio5Score < 1.0 ? "Implement valid JSON-LD schema (Article, Service, BreadcrumbList) on remaining pages." : undefined,
  });

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
    failedCount: 0,
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
      impactScore: 0,
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

  return {
    statuses,
    llmsTxtStatus,
    rawVsRenderAccessible,
    findings,
    observability,
    evaluators,
  };
}
