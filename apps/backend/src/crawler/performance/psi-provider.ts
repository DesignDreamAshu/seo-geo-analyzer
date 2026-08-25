/**
 * Google PageSpeed Insights & CrUX Production Provider
 * Fetches lab simulation (Lighthouse) and real-user field data (CrUX) with caching and rate limiting.
 */

import { NormalizedPerformanceResult, PerformanceProvider, normalizePageSpeedResponse } from "./provider";
import { PerformanceCache } from "./cache";

export interface PsiProviderOptions {
  apiKey?: string;
  cache?: PerformanceCache;
  timeoutMs?: number;
  maxRetries?: number;
}

export class PageSpeedInsightsProvider implements PerformanceProvider {
  name = "GooglePageSpeedInsights";
  private apiKey: string | undefined;
  private cache: PerformanceCache;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options?: PsiProviderOptions) {
    this.apiKey = options?.apiKey || process.env.PAGESPEED_API_KEY;
    this.cache = options?.cache || new PerformanceCache();
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.maxRetries = options?.maxRetries ?? 1;
  }

  async fetchPerformanceData(url: string, strategy: "mobile" | "desktop"): Promise<NormalizedPerformanceResult> {
    // 1. Check Cache
    const cached = this.cache.get(url, strategy);
    if (cached) {
      return cached;
    }

    // 2. Build PSI URL
    const encodedUrl = encodeURIComponent(url);
    let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodedUrl}&strategy=${strategy}&category=PERFORMANCE`;
    if (this.apiKey) {
      apiUrl += `&key=${this.apiKey}`;
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            "User-Agent": "Dream-SEO-Performance-Analyzer/1.0",
          },
        });
        clearTimeout(timer);

        if (response.status === 429) {
          const rateLimitedResult: NormalizedPerformanceResult = {
            url,
            strategy,
            status: "RATE_LIMITED",
            errorMessage: "PageSpeed Insights API rate limit / quota exceeded (HTTP 429).",
          };
          this.cache.set(url, strategy, rateLimitedResult, 10 * 60 * 1000); // 10 min cooldown
          return rateLimitedResult;
        }

        if (response.status >= 500) {
          throw new Error(`PageSpeed Insights Server Error: HTTP ${response.status}`);
        }

        if (!response.ok) {
          const errBody = await response.text();
          const apiUnavailableResult: NormalizedPerformanceResult = {
            url,
            strategy,
            status: "API_UNAVAILABLE",
            errorMessage: `PageSpeed Insights API request failed (HTTP ${response.status}): ${errBody.slice(0, 200)}`,
          };
          return apiUnavailableResult;
        }

        const rawJson = await response.json();
        const profile = normalizePageSpeedResponse(rawJson, strategy);

        if (!profile) {
          return {
            url,
            strategy,
            status: "ERROR",
            errorMessage: "Failed to parse and normalize PageSpeed Insights response.",
          };
        }

        const result: NormalizedPerformanceResult = {
          url,
          strategy,
          status: "OK",
          profile,
          rawResponse: rawJson,
        };

        // Cache successful response
        this.cache.set(url, strategy, result);
        return result;
      } catch (err: any) {
        lastError = err;
        if (err.name === "AbortError") {
          return {
            url,
            strategy,
            status: "API_UNAVAILABLE",
            errorMessage: `PageSpeed Insights request timed out after ${this.timeoutMs}ms.`,
          };
        }
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    return {
      url,
      strategy,
      status: "ERROR",
      errorMessage: lastError ? lastError.message : "Unknown error executing PageSpeed Insights request.",
    };
  }
}
