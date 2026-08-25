/**
 * Certified AI Robots & Crawler Accessibility Inspector.
 * Deterministically parses robots.txt directives per RFC 9309 rules:
 * - Exact user-agent matching takes precedence over wildcard '*'
 * - Most specific (longest) pattern matching for Allow vs Disallow
 * - Empty Disallow: (treat as full Allow)
 * - Strict separation of search discoverability risk vs training opt-out
 */

import { OFFICIAL_AI_CRAWLERS } from "./crawler-registry";
import { AiCrawlerAccessFinding, AccessStatus } from "./types";

interface DirectiveRule {
  directive: "allow" | "disallow";
  pattern: string;
  lineLength: number;
}

export function inspectAiCrawlerAccess(robotsTxtContent: string | null, targetPath = "/"): AiCrawlerAccessFinding[] {
  if (!robotsTxtContent || robotsTxtContent.trim() === "") {
    return OFFICIAL_AI_CRAWLERS.map((crawler) => ({
      crawler,
      accessStatus: "NO_ROBOTS_TXT",
      matchedDirective: null,
      matchedPattern: null,
      confidence: "confirmed",
      evidence: "No robots.txt found or file is empty; all AI crawlers have full default access.",
      affectedScope: "none",
      searchAccessRisk: "NONE",
      trainingOptOutConfirmed: false,
    }));
  }

  // Parse robots.txt into structured User-agent blocks
  const lines = robotsTxtContent.split(/\r?\n/);
  const rulesByUserAgent = new Map<string, DirectiveRule[]>();
  let currentGroupUas: string[] = [];

  for (const line of lines) {
    const cleanLine = line.split("#")[0].trim();
    if (!cleanLine) continue;

    const colonIndex = cleanLine.indexOf(":");
    if (colonIndex === -1) continue;

    const field = cleanLine.slice(0, colonIndex).trim().toLowerCase();
    const value = cleanLine.slice(colonIndex + 1).trim();

    if (field === "user-agent") {
      const ua = value.toLowerCase();
      // If previous line was also a User-agent, append to the same group block
      if (currentGroupUas.length === 0 || !rulesByUserAgent.has(currentGroupUas[0])) {
        currentGroupUas.push(ua);
      } else {
        currentGroupUas = [ua];
      }
    } else if (field === "disallow" || field === "allow") {
      for (const ua of currentGroupUas) {
        const list = rulesByUserAgent.get(ua) || [];
        list.push({
          directive: field,
          pattern: value,
          lineLength: value.length,
        });
        rulesByUserAgent.set(ua, list);
      }
    }
  }

  const findings: AiCrawlerAccessFinding[] = [];

  for (const crawler of OFFICIAL_AI_CRAWLERS) {
    const specificUa = crawler.userAgent.toLowerCase();
    const specificRules = rulesByUserAgent.get(specificUa);
    const wildcardRules = rulesByUserAgent.get("*");

    let status: AccessStatus = "ALLOWED";
    let matchedDirective: string | null = null;
    let matchedPattern: string | null = null;
    let evidence = "";
    let affectedScope: AiCrawlerAccessFinding["affectedScope"] = "none";
    let remediationGuidance: string | undefined = undefined;

    // 1. Evaluate User-agent Specific Directives First (RFC 9309 rule precedence)
    if (specificRules && specificRules.length > 0) {
      const match = evaluateRulesForPath(targetPath, specificRules);
      if (match.isDisallowed) {
        status = "DISALLOWED";
        matchedDirective = `User-agent: ${crawler.userAgent}\nDisallow: ${match.matchedPattern}`;
        matchedPattern = match.matchedPattern;
        affectedScope = match.matchedPattern === "/" ? "sitewide" : "path_specific";
        evidence = `Explicitly disallowed for ${crawler.crawlerName} via pattern "${match.matchedPattern}".`;
      } else if (match.matchedDirective === "allow") {
        status = "ALLOWED";
        matchedDirective = `User-agent: ${crawler.userAgent}\nAllow: ${match.matchedPattern}`;
        matchedPattern = match.matchedPattern;
        evidence = `Explicitly allowed for ${crawler.crawlerName} via pattern "${match.matchedPattern}".`;
      } else {
        status = "ALLOWED";
        evidence = `Specific User-agent block exists for ${crawler.userAgent} without matching disallows for "${targetPath}".`;
      }
    }
    // 2. Fallback to Wildcard User-agent: * Directives
    else if (wildcardRules && wildcardRules.length > 0) {
      const match = evaluateRulesForPath(targetPath, wildcardRules);
      if (match.isDisallowed) {
        status = "INHERITED_WILDCARD_DISALLOWED";
        matchedDirective = `User-agent: *\nDisallow: ${match.matchedPattern}`;
        matchedPattern = match.matchedPattern;
        affectedScope = match.matchedPattern === "/" ? "sitewide" : "path_specific";
        evidence = `Inherits wildcard Disallow: ${match.matchedPattern} (no specific User-agent: ${crawler.userAgent} block declared).`;
      } else {
        status = "INHERITED_WILDCARD_ALLOWED";
        evidence = `Allowed via wildcard User-agent: * directives.`;
      }
    } else {
      status = "ALLOWED";
      evidence = `No disallow directives apply to ${crawler.crawlerName}.`;
    }

    // Determine exact Search Access Risk vs Training Opt-Out
    let searchAccessRisk: AiCrawlerAccessFinding["searchAccessRisk"] = "NONE";
    let trainingOptOutConfirmed = false;

    const isBlocked = status === "DISALLOWED" || status === "INHERITED_WILDCARD_DISALLOWED";

    if (isBlocked) {
      if (crawler.role === "SEARCH_INDEXER") {
        searchAccessRisk = crawler.userAgent === "Googlebot" ? "SEARCH_ACCESS_BLOCKED" : "SEARCH_DISCOVERABILITY_HIGH_RISK";
        remediationGuidance = `Blocking ${crawler.crawlerName} (${crawler.userAgent}) prevents your site from being indexed in ${crawler.provider} search results. If you wish to be discoverable in AI search, update Webflow Site Settings → SEO → robots.txt to allow '${crawler.userAgent}'.`;
      } else if (crawler.role === "TRAINING_CRAWLER") {
        trainingOptOutConfirmed = true;
        remediationGuidance = `Your site successfully opts out of ${crawler.provider} AI training data ingestion. Note: This does NOT impact search rankings or organic discoverability.`;
      } else if (crawler.role === "USER_INITIATED_RETRIEVAL") {
        remediationGuidance = `Blocking ${crawler.crawlerName} (${crawler.userAgent}) prevents on-demand live page browsing when a user provides your URL in a prompt.`;
      }
    }

    findings.push({
      crawler,
      accessStatus: status,
      matchedDirective,
      matchedPattern,
      confidence: "confirmed",
      evidence,
      affectedScope,
      searchAccessRisk,
      trainingOptOutConfirmed,
      remediationGuidance,
    });
  }

  return findings;
}

/**
 * Evaluates a list of Allow/Disallow rules against targetPath using longest-match precedence.
 */
function evaluateRulesForPath(
  path: string,
  rules: DirectiveRule[]
): { isDisallowed: boolean; matchedDirective: "allow" | "disallow" | null; matchedPattern: string | null } {
  let longestMatch: { rule: DirectiveRule; patternLength: number } | null = null;

  for (const rule of rules) {
    // Empty Disallow: means "Allow all"
    if (rule.directive === "disallow" && rule.pattern === "") {
      if (!longestMatch || 0 >= longestMatch.patternLength) {
        longestMatch = { rule: { directive: "allow", pattern: "", lineLength: 0 }, patternLength: 0 };
      }
      continue;
    }

    if (matchesPattern(path, rule.pattern)) {
      const len = rule.pattern.length;
      if (!longestMatch || len > longestMatch.patternLength || (len === longestMatch.patternLength && rule.directive === "allow")) {
        longestMatch = { rule, patternLength: len };
      }
    }
  }

  if (!longestMatch) {
    return { isDisallowed: false, matchedDirective: null, matchedPattern: null };
  }

  return {
    isDisallowed: longestMatch.rule.directive === "disallow",
    matchedDirective: longestMatch.rule.directive,
    matchedPattern: longestMatch.rule.pattern,
  };
}

function matchesPattern(path: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === "/") return true;

  let regexStr = "^" + pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  if (regexStr.endsWith("\\$")) {
    regexStr = regexStr.slice(0, -2) + "$";
  }

  try {
    const regex = new RegExp(regexStr);
    return regex.test(path);
  } catch {
    return path.startsWith(pattern);
  }
}
