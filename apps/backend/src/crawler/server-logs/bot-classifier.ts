/**
 * Hardened Bot Classifier & Authoritative Verification Engine.
 * Accurately classifies search and AI crawlers with provider-authoritative range matching and DNS verification.
 */

import { BotIdentity, BotFamily, BotDeviceType, VerificationState, BotRangeMetadata } from "./types";
import {
  GOOGLEBOT_OFFICIAL_DATASET,
  GPTBOT_OFFICIAL_DATASET,
  OAI_SEARCHBOT_OFFICIAL_DATASET,
  CHATGPT_USER_OFFICIAL_DATASET,
  BINGBOT_OFFICIAL_DATASET,
  matchIpInDataset,
  CidrRangeDataset,
} from "./bot-ranges";

export interface BotVerifierOptions {
  dnsLookupFn?: (ip: string, family: BotFamily) => boolean;
  customGooglebotDataset?: CidrRangeDataset;
  customGptbotDataset?: CidrRangeDataset;
  customOaiSearchDataset?: CidrRangeDataset;
  customChatGptUserDataset?: CidrRangeDataset;
  customBingbotDataset?: CidrRangeDataset;
}

export function classifyBotRequest(
  userAgent: string | undefined,
  ipAddress: string | undefined,
  options?: BotVerifierOptions
): BotIdentity {
  const ua = (userAgent || "").trim();
  const ip = (ipAddress || "").trim();

  if (!ua) {
    return {
      name: "Empty User-Agent",
      family: "UNKNOWN_BOT",
      deviceType: "GENERIC",
      verificationState: "UNKNOWN",
      verificationEvidence: ["No User-Agent string provided in request"],
      isVerifiedSearchBot: false,
      isAiCrawler: false,
    };
  }

  // 1. Googlebot
  if (/Googlebot/i.test(ua)) {
    let name = "Googlebot Desktop";
    let deviceType: BotDeviceType = "DESKTOP";

    if (/Mobile|Smartphone/i.test(ua)) {
      name = "Googlebot Smartphone";
      deviceType = "SMARTPHONE";
    } else if (/Googlebot-Image/i.test(ua)) {
      name = "Googlebot Image";
      deviceType = "IMAGE";
    } else if (/Googlebot-Video/i.test(ua)) {
      name = "Googlebot Video";
      deviceType = "VIDEO";
    }

    const dataset = options?.customGooglebotDataset || GOOGLEBOT_OFFICIAL_DATASET;
    const verification = verifyCrawlerIdentity(ip, "GOOGLEBOT", dataset, options?.dnsLookupFn);

    return {
      name,
      family: "GOOGLEBOT",
      deviceType,
      verificationState: verification.state,
      verificationEvidence: [`User-Agent matched ${name}`, ...verification.evidence],
      isVerifiedSearchBot: verification.state === "VERIFIED_PROVIDER_RANGE" || verification.state === "VERIFIED_FORWARD_REVERSE_DNS",
      isAiCrawler: false,
      rangeMetadata: verification.metadata,
    };
  }

  // 2. Bingbot
  if (/bingbot/i.test(ua)) {
    const dataset = options?.customBingbotDataset || BINGBOT_OFFICIAL_DATASET;
    const verification = verifyCrawlerIdentity(ip, "BINGBOT", dataset, options?.dnsLookupFn);

    return {
      name: "Bingbot",
      family: "BINGBOT",
      deviceType: /Mobile/i.test(ua) ? "SMARTPHONE" : "DESKTOP",
      verificationState: verification.state,
      verificationEvidence: ["User-Agent matched Bingbot", ...verification.evidence],
      isVerifiedSearchBot: verification.state === "VERIFIED_PROVIDER_RANGE" || verification.state === "VERIFIED_FORWARD_REVERSE_DNS",
      isAiCrawler: false,
      rangeMetadata: verification.metadata,
    };
  }

  // 3. OpenAI GPTBot (AI Training)
  if (/GPTBot/i.test(ua)) {
    const dataset = options?.customGptbotDataset || GPTBOT_OFFICIAL_DATASET;
    const verification = verifyCrawlerIdentity(ip, "GPTBOT", dataset, options?.dnsLookupFn);

    return {
      name: "GPTBot",
      family: "GPTBOT",
      deviceType: "GENERIC",
      verificationState: verification.state,
      verificationEvidence: ["User-Agent matched GPTBot (AI Training Crawler)", ...verification.evidence],
      isVerifiedSearchBot: false,
      isAiCrawler: true,
      aiPurpose: "AI_TRAINING",
      rangeMetadata: verification.metadata,
    };
  }

  // 4. OpenAI OAI-SearchBot (Search Indexing)
  if (/OAI-SearchBot/i.test(ua)) {
    const dataset = options?.customOaiSearchDataset || OAI_SEARCHBOT_OFFICIAL_DATASET;
    const verification = verifyCrawlerIdentity(ip, "OAI_SEARCHBOT", dataset, options?.dnsLookupFn);

    return {
      name: "OAI-SearchBot",
      family: "OAI_SEARCHBOT",
      deviceType: "GENERIC",
      verificationState: verification.state,
      verificationEvidence: ["User-Agent matched OAI-SearchBot (Search Indexing Crawler)", ...verification.evidence],
      isVerifiedSearchBot: false,
      isAiCrawler: true,
      aiPurpose: "SEARCH_INDEXING",
      rangeMetadata: verification.metadata,
    };
  }

  // 5. OpenAI ChatGPT-User (User-Triggered Web Browsing)
  if (/ChatGPT-User/i.test(ua)) {
    const dataset = options?.customChatGptUserDataset || CHATGPT_USER_OFFICIAL_DATASET;
    const verification = verifyCrawlerIdentity(ip, "CHATGPT_USER", dataset, options?.dnsLookupFn);

    return {
      name: "ChatGPT-User",
      family: "CHATGPT_USER",
      deviceType: "GENERIC",
      verificationState: verification.state,
      verificationEvidence: ["User-Agent matched ChatGPT-User (User-Triggered Fetch)", ...verification.evidence],
      isVerifiedSearchBot: false,
      isAiCrawler: true,
      aiPurpose: "USER_TRIGGERED_FETCH",
      rangeMetadata: verification.metadata,
    };
  }

  // 6. ClaudeBot (Anthropic)
  if (/ClaudeBot|anthropic-ai/i.test(ua)) {
    return {
      name: "ClaudeBot",
      family: "CLAUDEBOT",
      deviceType: "GENERIC",
      verificationState: ip ? "USER_AGENT_ONLY" : "VERIFICATION_UNAVAILABLE",
      verificationEvidence: ["User-Agent matched ClaudeBot (Anthropic)"],
      isVerifiedSearchBot: false,
      isAiCrawler: true,
      aiPurpose: "AI_TRAINING",
    };
  }

  // 7. PerplexityBot
  if (/PerplexityBot/i.test(ua)) {
    return {
      name: "PerplexityBot",
      family: "PERPLEXITYBOT",
      deviceType: "GENERIC",
      verificationState: ip ? "USER_AGENT_ONLY" : "VERIFICATION_UNAVAILABLE",
      verificationEvidence: ["User-Agent matched PerplexityBot"],
      isVerifiedSearchBot: false,
      isAiCrawler: true,
      aiPurpose: "SEARCH_INDEXING",
    };
  }

  // 8. Applebot
  if (/Applebot/i.test(ua)) {
    return {
      name: "Applebot",
      family: "APPLEBOT",
      deviceType: "DESKTOP",
      verificationState: ip ? "USER_AGENT_ONLY" : "VERIFICATION_UNAVAILABLE",
      verificationEvidence: ["User-Agent matched Applebot"],
      isVerifiedSearchBot: false,
      isAiCrawler: false,
    };
  }

  // 9. Generic / Unknown Bot
  if (/bot|crawl|spider|slurp|headless/i.test(ua)) {
    return {
      name: "Generic / Unknown Crawler",
      family: "UNKNOWN_BOT",
      deviceType: "GENERIC",
      verificationState: "USER_AGENT_ONLY",
      verificationEvidence: ["Generic crawler keyword identified in User-Agent"],
      isVerifiedSearchBot: false,
      isAiCrawler: false,
    };
  }

  // 10. Standard Human / Browser
  return {
    name: "Standard Client Browser",
    family: "HUMAN_OR_NON_BOT",
    deviceType: "GENERIC",
    verificationState: "UNKNOWN",
    verificationEvidence: ["Standard browser request tokens"],
    isVerifiedSearchBot: false,
    isAiCrawler: false,
  };
}

function verifyCrawlerIdentity(
  ip: string,
  family: BotFamily,
  dataset: CidrRangeDataset,
  dnsLookupFn?: (ip: string, family: BotFamily) => boolean
): { state: VerificationState; evidence: string[]; metadata?: BotRangeMetadata } {
  const metadata: BotRangeMetadata = {
    provider: dataset.provider,
    sourceUrl: dataset.sourceUrl,
    retrievedAt: dataset.retrievedAt,
    datasetVersionOrHash: dataset.datasetVersionOrHash,
    freshness: dataset.freshness,
    verifierVersion: dataset.verifierVersion,
    rangesCount: dataset.prefixes.length,
  };

  if (!ip) {
    return {
      state: "VERIFICATION_UNAVAILABLE",
      evidence: ["Client IP address unavailable for verification"],
      metadata,
    };
  }

  // Check custom forward/reverse DNS lookup if provided
  if (dnsLookupFn) {
    const isDnsValid = dnsLookupFn(ip, family);
    if (isDnsValid) {
      return {
        state: "VERIFIED_FORWARD_REVERSE_DNS",
        evidence: [`IP [${ip}] verified via Authoritative Reverse & Forward DNS lookup`],
        metadata,
      };
    }
  }

  // Check dataset freshness
  if (dataset.freshness === "STALE") {
    const inRange = matchIpInDataset(ip, dataset);
    return {
      state: inRange ? "PROVIDER_RANGE_STALE" : "USER_AGENT_ONLY",
      evidence: [`Provider dataset (${dataset.sourceUrl}) is marked STALE. Verified status withheld.`],
      metadata,
    };
  }

  if (dataset.freshness === "UNAVAILABLE") {
    return {
      state: "VERIFICATION_UNAVAILABLE",
      evidence: ["Authoritative provider IP dataset is unavailable"],
      metadata,
    };
  }

  // Match in authoritative published CIDRs
  const isMatch = matchIpInDataset(ip, dataset);
  if (isMatch) {
    return {
      state: "VERIFIED_PROVIDER_RANGE",
      evidence: [`IP [${ip}] matched authoritative published CIDR in ${dataset.sourceUrl} (${dataset.datasetVersionOrHash})`],
      metadata,
    };
  }

  return {
    state: "USER_AGENT_ONLY",
    evidence: [`IP [${ip}] does not match published ${family} CIDRs; treated as unverified`],
    metadata,
  };
}
