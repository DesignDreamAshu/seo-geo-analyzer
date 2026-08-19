import axios, { AxiosResponse } from "axios";
import type { ExternalLinkStatus, RedirectHop } from "./types";

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
  timeoutMs = 8000,
  signal?: AbortSignal,
): Promise<{
  statusCode: number | null;
  statusCategory: ExternalLinkStatus;
  redirectHops: RedirectHop[];
  responseTimeMs: number;
}> {
  const startedAt = Date.now();
  const redirectHops: RedirectHop[] = [];

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "*/*",
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

    const responseTimeMs = Date.now() - startedAt;
    const status = response.status;

    // Classify Bot-Blocked platforms (LinkedIn 999, Cloudflare 403, Glassdoor 403/429, etc.)
    if (status === 403 || status === 429 || status === 999) {
      return {
        statusCode: status,
        statusCategory: "bot_blocked_inconclusive",
        redirectHops,
        responseTimeMs,
      };
    }

    if (status >= 200 && status < 400) {
      return {
        statusCode: status,
        statusCategory: "reachable",
        redirectHops,
        responseTimeMs,
      };
    }

    if (status >= 400) {
      return {
        statusCode: status,
        statusCategory: "confirmed_broken",
        redirectHops,
        responseTimeMs,
      };
    }

    return {
      statusCode: status,
      statusCategory: "reachable",
      redirectHops,
      responseTimeMs,
    };
  } catch (error: any) {
    const responseTimeMs = Date.now() - startedAt;

    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      return {
        statusCode: null,
        statusCategory: "timeout",
        redirectHops,
        responseTimeMs,
      };
    }

    if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
      return {
        statusCode: null,
        statusCategory: "dns_failure",
        redirectHops,
        responseTimeMs,
      };
    }

    if (
      error.code?.includes("SSL") ||
      error.code?.includes("CERT") ||
      error.message?.includes("certificate")
    ) {
      return {
        statusCode: null,
        statusCategory: "ssl_failure",
        redirectHops,
        responseTimeMs,
      };
    }

    return {
      statusCode: null,
      statusCategory: "confirmed_broken",
      redirectHops,
      responseTimeMs,
    };
  }
}
