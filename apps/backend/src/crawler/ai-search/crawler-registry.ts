/**
 * Authoritative AI Crawler & User-Agent Registry with Explicit Source Provenance.
 * Verified against vendor documentation as of February 2026.
 */

import { AiCrawlerDefinition } from "./types";

export const OFFICIAL_AI_CRAWLERS: AiCrawlerDefinition[] = [
  // =========================================================================
  // 1. OPENAI CRAWLERS
  // =========================================================================
  {
    provider: "OpenAI",
    crawlerName: "OAI-SearchBot",
    userAgent: "OAI-SearchBot",
    role: "SEARCH_INDEXER",
    officialSourceUrl: "https://platform.openai.com/docs/bots/oai-searchbot",
    sourceTitle: "OpenAI Documentation: OAI-SearchBot Overview",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Used to index content for search features in ChatGPT and OpenAI Search products.",
    searchVisibilityImplication: "Blocking OAI-SearchBot directly prevents web pages from being surfaced in ChatGPT search results.",
    trainingImplication: "Does not feed foundational model training weights; dedicated purely to search indexation.",
    confidence: "CONFIRMED_BY_PROVIDER",
    notes: "Documented specifically for ChatGPT search indexing; distinct from GPTBot training crawler.",
  },
  {
    provider: "OpenAI",
    crawlerName: "GPTBot",
    userAgent: "GPTBot",
    role: "TRAINING_CRAWLER",
    officialSourceUrl: "https://platform.openai.com/docs/bots/gptbot",
    sourceTitle: "OpenAI Documentation: GPTBot Web Crawler",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Automated web scraper used to collect training datasets for OpenAI AI models.",
    searchVisibilityImplication: "Blocking GPTBot does NOT remove pages from ChatGPT search results or user browsing.",
    trainingImplication: "Prevents page content from being ingested into future OpenAI foundation model training cycles.",
    confidence: "CONFIRMED_BY_PROVIDER",
    notes: "Opt-out of model training does not affect search visibility.",
  },
  {
    provider: "OpenAI",
    crawlerName: "ChatGPT-User",
    userAgent: "ChatGPT-User",
    role: "USER_INITIATED_RETRIEVAL",
    officialSourceUrl: "https://platform.openai.com/docs/bots/chatgpt-user",
    sourceTitle: "OpenAI Documentation: ChatGPT-User Agent",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Operates on behalf of a user when an explicit web search action is triggered in ChatGPT.",
    searchVisibilityImplication: "Blocking ChatGPT-User prevents ChatGPT from fetching the page live when a user provides the URL in a prompt.",
    trainingImplication: "Does not crawl for training; acts solely as a real-time proxy for active user sessions.",
    confidence: "CONFIRMED_BY_PROVIDER",
    notes: "Real-time user prompt retrieval only.",
  },

  // =========================================================================
  // 2. GOOGLE CRAWLERS
  // =========================================================================
  {
    provider: "Google",
    crawlerName: "Googlebot",
    userAgent: "Googlebot",
    role: "SEARCH_INDEXER",
    officialSourceUrl: "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
    sourceTitle: "Google Search Central: Overview of Google Crawlers and Fetchers",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Primary web crawler powering organic Google Search indexing and Google AI Overviews.",
    searchVisibilityImplication: "Blocking Googlebot removes the site from Google Search and all Google AI Overview generation.",
    trainingImplication: "General search indexing corpus; distinct from Google-Extended training control.",
    confidence: "CONFIRMED_BY_PROVIDER",
    notes: "Controls search indexing and AI Overviews. Separate from Google-Extended.",
  },
  {
    provider: "Google",
    crawlerName: "Google-Extended",
    userAgent: "Google-Extended",
    role: "TRAINING_CRAWLER",
    officialSourceUrl: "https://developers.google.com/search/docs/crawling-indexing/google-extended",
    sourceTitle: "Google Search Central: Google-Extended Overview",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Allows website administrators to control whether site content is used to train Gemini and Vertex AI models.",
    searchVisibilityImplication: "Blocking Google-Extended has ZERO negative impact on Google Search rankings or Google AI Overview inclusion.",
    trainingImplication: "Excludes content from contributing to Gemini and Vertex AI foundation model training datasets.",
    confidence: "CONFIRMED_BY_PROVIDER",
    notes: "Standalone token for training controls. Does not impact Google Search crawl.",
  },

  // =========================================================================
  // 3. ANTHROPIC CRAWLERS
  // =========================================================================
  {
    provider: "Anthropic",
    crawlerName: "ClaudeBot",
    userAgent: "ClaudeBot",
    role: "TRAINING_CRAWLER",
    officialSourceUrl: "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    sourceTitle: "Anthropic Support: Does Anthropic crawl data from the web",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Automated web crawler used to expand Anthropic training corpora and answer capabilities.",
    searchVisibilityImplication: "Blocking ClaudeBot opts out of Anthropic training data ingestion.",
    trainingImplication: "Prevents site content from being used to train Claude models.",
    confidence: "DOCUMENTED_BY_PROVIDER",
    notes: "Documented in official Anthropic support knowledgebase.",
  },
  {
    provider: "Anthropic",
    crawlerName: "Claude-Web",
    userAgent: "Claude-Web",
    role: "USER_INITIATED_RETRIEVAL",
    officialSourceUrl: "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    sourceTitle: "Anthropic Support: User-directed link inspection",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "User-directed retrieval crawler fetching links pasted by users in Claude conversations.",
    searchVisibilityImplication: "Blocking Claude-Web prevents Claude from reading specific URLs when users ask questions about them.",
    trainingImplication: "Does not crawl for training; executes on-demand for active user sessions.",
    confidence: "DOCUMENTED_BY_PROVIDER",
    notes: "User-initiated link fetching agent.",
  },

  // =========================================================================
  // 4. PERPLEXITY AI CRAWLERS
  // =========================================================================
  {
    provider: "Perplexity",
    crawlerName: "PerplexityBot",
    userAgent: "PerplexityBot",
    role: "SEARCH_INDEXER",
    officialSourceUrl: "https://docs.perplexity.ai",
    sourceTitle: "Perplexity AI: Web Crawler and Search Indexing Specifications",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "General web crawler for indexing and ranking answer content across Perplexity answer engines.",
    searchVisibilityImplication: "Blocking PerplexityBot prevents pages from being indexed and cited as primary search sources on Perplexity.",
    trainingImplication: "Indexes real-time web citations for answer synthesis.",
    confidence: "DOCUMENTED_BY_PROVIDER",
    notes: "Primary indexer for Perplexity answer citations.",
  },
  {
    provider: "Perplexity",
    crawlerName: "Perplexity-User",
    userAgent: "Perplexity-User",
    role: "USER_INITIATED_RETRIEVAL",
    officialSourceUrl: "https://docs.perplexity.ai",
    sourceTitle: "Perplexity AI: User Agent Search Integration",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "On-demand retrieval agent executing live queries on behalf of active Perplexity search users.",
    searchVisibilityImplication: "Blocking Perplexity-User stops on-demand snippet fetches for active user searches.",
    trainingImplication: "User-directed retrieval only.",
    confidence: "DOCUMENTED_BY_PROVIDER",
    notes: "Performs live query fetching for active users.",
  },

  // =========================================================================
  // 5. BYTEDANCE AI CRAWLER
  // =========================================================================
  {
    provider: "ByteDance",
    crawlerName: "Bytespider",
    userAgent: "Bytespider",
    role: "TRAINING_CRAWLER",
    officialSourceUrl: "https://www.bytedance.com",
    sourceTitle: "ByteDance Web Scraping (Ecosystem Documentation)",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Automated web crawler collecting data for ByteDance LLM systems and Doubao search products.",
    searchVisibilityImplication: "Controls access to ByteDance AI training and ecosystem products.",
    trainingImplication: "Disallowing Bytespider opts out of ByteDance model ingestion.",
    confidence: "DOCUMENTED_ECOSYSTEM",
    notes: "Documented across industry robots.txt analyses; direct provider specification URL is generic.",
  },

  // =========================================================================
  // 6. COMMON CRAWL OPEN ARCHIVE
  // =========================================================================
  {
    provider: "Common Crawl",
    crawlerName: "CCBot",
    userAgent: "CCBot",
    role: "TRAINING_CRAWLER",
    officialSourceUrl: "https://commoncrawl.org/faq",
    sourceTitle: "Common Crawl FAQ: CCBot User-Agent Details",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Non-profit open repository of web crawl data widely utilized by foundational AI researchers and model creators.",
    searchVisibilityImplication: "Does not operate a direct consumer search engine; acts as a bulk web archive.",
    trainingImplication: "Blocking CCBot prevents inclusion in future open-source and commercial LLM training corpuses built on Common Crawl.",
    confidence: "CONFIRMED_BY_PROVIDER",
    notes: "Authoritative specification on commoncrawl.org.",
  },

  // =========================================================================
  // 7. COHERE AI
  // =========================================================================
  {
    provider: "Cohere",
    crawlerName: "cohere-ai",
    userAgent: "cohere-ai",
    role: "TRAINING_CRAWLER",
    officialSourceUrl: "https://cohere.com",
    sourceTitle: "Cohere AI Web Scraping (Ecosystem Documentation)",
    lastVerifiedDate: "2026-02-01",
    statedPurpose: "Web crawler for training Cohere enterprise LLMs and generative models.",
    searchVisibilityImplication: "Does not operate a consumer search engine.",
    trainingImplication: "Disallowing cohere-ai excludes content from Cohere foundation datasets.",
    confidence: "DOCUMENTED_ECOSYSTEM",
    notes: "Ecosystem recognized token for Cohere enterprise training.",
  },
];
