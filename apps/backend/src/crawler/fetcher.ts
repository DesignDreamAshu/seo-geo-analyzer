import axios, { AxiosResponse } from "axios";
import type { ExternalLinkEvidence, ExternalLinkOutcome, ExternalLinkStatus, RedirectHop } from "./types";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; DreamSEOBot/1.0; +https://dreamseo.dev/bot)";
const MAX_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max per HTML response

export interface FetchResult {
  ok: boolean;
  statusCode: number;
  finalUrl: string;
  redirectHops: RedirectHop[];
  html: string;
  headers: Record<string, string | string[] | undefined>;
  contentType: string;
  responseTimeMs: number;
  byteSize: number;
  errorMessage?: string;
}

/**
 * Fetches an HTML page via fast streaming HTTP with size limits and redirect tracking.
 */
export async function fetchPageHtml(
  targetUrl: string,
  timeoutMs = 12000,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const startedAt = Date.now();
  const redirectHops: RedirectHop[] = [];

  try {
    const response: AxiosResponse = await axios.get(targetUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      timeout: timeoutMs,
      maxRedirects: 10,
      maxContentLength: MAX_BODY_SIZE_BYTES,
      responseType: "text",
      signal,
      validateStatus: () => true, // Don't throw on 4xx/5xx to capture status
      beforeRedirect: (_options, responseDetails) => {
        if (responseDetails?.statusCode) {
          redirectHops.push({
            statusCode: responseDetails.statusCode,
            fromUrl: (responseDetails as any).headers?.location || targetUrl,
            toUrl: (responseDetails as any).url || targetUrl,
          });
        }
      },
    });

    const responseTimeMs = Date.now() - startedAt;
    const finalUrl = (response.request as any)?.res?.responseUrl || targetUrl;
    const contentType = String(response.headers["content-type"] || "");
    const rawHtml = typeof response.data === "string" ? response.data : "";

    return {
      ok: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      finalUrl,
      redirectHops,
      html: rawHtml,
      headers: response.headers as Record<string, string | string[] | undefined>,
      contentType,
      responseTimeMs,
      byteSize: Buffer.byteLength(rawHtml, "utf8"),
    };
  } catch (error: any) {
    const responseTimeMs = Date.now() - startedAt;
    return {
      ok: false,
      statusCode: error.response?.status || 0,
      finalUrl: targetUrl,
      redirectHops,
      html: "",
      headers: error.response?.headers || {},
      contentType: "",
      responseTimeMs,
      byteSize: 0,
      errorMessage: error.message,
    };
  }
}

/**
 * Verifies a link (especially external) via lightweight GET, accurately classifying bot-protected domains.
 */
export async function verifyLinkTarget(
  targetUrl: string,
  sourcePageUrl = "",
  rawHref = "",
  timeoutMs = 8000,
  signal?: AbortSignal,
): Promise<ExternalLinkEvidence> {
  const startedAt = Date.now();
  const redirectHops: RedirectHop[] = [];
  const checkedAt = new Date().toISOString();

  // Validate URL scheme first
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: null,
        finalUrl: targetUrl,
        redirectChain: redirectHops,
        outcome: "unsupported_scheme",
        reason: `Unsupported URL protocol: ${parsed.protocol}`,
        checkedAt,
      };
    }
  } catch {
    return {
      rawHref: rawHref || targetUrl,
      resolvedUrl: targetUrl,
      normalizedUrl: targetUrl,
      sourcePageUrl,
      verificationMethod: "http_get",
      requestMethod: "GET",
      httpStatus: null,
      finalUrl: targetUrl,
      redirectChain: redirectHops,
      outcome: "unsupported_scheme",
      reason: "Malformed URL target",
      checkedAt,
    };
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: timeoutMs,
      maxRedirects: 5,
      responseType: "stream", // abort immediately after headers to save bandwidth
      signal,
      validateStatus: () => true,
    });

    // Destroy stream immediately after reading headers
    if (response.data && typeof response.data.destroy === "function") {
      response.data.destroy();
    }

    const status = response.status;
    const finalUrl = (response.request as any)?.res?.responseUrl || targetUrl;

    // Track redirect if finalUrl differs from targetUrl
    if (finalUrl !== targetUrl) {
      redirectHops.push({
        statusCode: 301,
        fromUrl: targetUrl,
        toUrl: finalUrl,
      });
    }

    // 1. Bot-Blocked / Rate-Limited Platforms (LinkedIn 999, Cloudflare 403, Glassdoor 403/429, ServiceNow Store 403)
    if (status === 429) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: status,
        finalUrl,
        redirectChain: redirectHops,
        outcome: "rate_limited_inconclusive",
        reason: `Target server rate limited verification request (HTTP ${status})`,
        checkedAt,
      };
    }

    if (status === 403 || status === 999 || status === 401) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: status,
        finalUrl,
        redirectChain: redirectHops,
        outcome: "bot_blocked_inconclusive",
        reason: `Target server bot-shield or authentication returned HTTP ${status} (requires browser review)`,
        checkedAt,
      };
    }

    // 2. Redirected or Success 2xx/3xx
    if (status >= 200 && status < 300) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: status,
        finalUrl,
        redirectChain: redirectHops,
        outcome: redirectHops.length > 0 ? "redirected_ok" : "confirmed_ok",
        reason: `Target reachable with HTTP ${status}`,
        checkedAt,
      };
    }

    // 3. Definitive Broken Status (404 Not Found, 410 Gone)
    if (status === 404 || status === 410) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: status,
        finalUrl,
        redirectChain: redirectHops,
        outcome: "confirmed_broken",
        reason: `Target returned definitive broken response: HTTP ${status}`,
        checkedAt,
      };
    }

    // 4. Other 4xx / 5xx responses
    if (status >= 500) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: status,
        finalUrl,
        redirectChain: redirectHops,
        outcome: "manual_review",
        reason: `Target server error HTTP ${status}`,
        checkedAt,
      };
    }

    return {
      rawHref: rawHref || targetUrl,
      resolvedUrl: targetUrl,
      normalizedUrl: targetUrl,
      sourcePageUrl,
      verificationMethod: "http_get",
      requestMethod: "GET",
      httpStatus: status,
      finalUrl,
      redirectChain: redirectHops,
      outcome: "confirmed_ok",
      reason: `Target reachable with HTTP ${status}`,
      checkedAt,
    };
  } catch (error: any) {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: null,
        finalUrl: targetUrl,
        redirectChain: redirectHops,
        outcome: "timeout_inconclusive",
        reason: "Request timed out during external verification",
        checkedAt,
      };
    }

    if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: null,
        finalUrl: targetUrl,
        redirectChain: redirectHops,
        outcome: "dns_failure",
        reason: `Domain name resolution failed: ${error.code}`,
        checkedAt,
      };
    }

    if (
      error.code?.includes("SSL") ||
      error.code?.includes("CERT") ||
      error.message?.includes("certificate")
    ) {
      return {
        rawHref: rawHref || targetUrl,
        resolvedUrl: targetUrl,
        normalizedUrl: targetUrl,
        sourcePageUrl,
        verificationMethod: "http_get",
        requestMethod: "GET",
        httpStatus: null,
        finalUrl: targetUrl,
        redirectChain: redirectHops,
        outcome: "ssl_failure",
        reason: `SSL/TLS handshake failure: ${error.message}`,
        checkedAt,
      };
    }

    return {
      rawHref: rawHref || targetUrl,
      resolvedUrl: targetUrl,
      normalizedUrl: targetUrl,
      sourcePageUrl,
      verificationMethod: "http_get",
      requestMethod: "GET",
      httpStatus: null,
      finalUrl: targetUrl,
      redirectChain: redirectHops,
      outcome: "network_failure",
      reason: `Network error during verification: ${error.message}`,
      checkedAt,
    };
  }
}
