import axios, { AxiosResponse } from "axios";
import { chromium, type Browser } from "playwright";
import type {
  BrowserPageState,
  BrowserVerificationCapability,
  ExternalLinkBrowserEvidence,
  ExternalLinkEvidence,
  ExternalLinkHttpEvidence,
  ExternalLinkOutcome,
  ExternalLinkStatus,
  RedirectHop,
} from "./types";

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
 * Shared Bounded Playwright Browser Pool
 * Prevents spawning dozens of heavy Chromium processes during audit crawls.
 */
class PlaywrightBrowserPool {
  private browserInstance: Browser | null = null;
  private isLaunching = false;

  async getBrowser(): Promise<Browser | null> {
    if (this.browserInstance && this.browserInstance.isConnected()) {
      return this.browserInstance;
    }
    if (this.isLaunching) {
      while (this.isLaunching) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.browserInstance && this.browserInstance.isConnected()) {
        return this.browserInstance;
      }
    }

    this.isLaunching = true;
    try {
      this.browserInstance = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      return this.browserInstance;
    } catch (err: any) {
      console.warn(`[BrowserPool] Failed to launch Chromium: ${err.message}`);
      return null;
    } finally {
      this.isLaunching = false;
    }
  }

  async close(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close().catch(() => {});
      this.browserInstance = null;
    }
  }
}

export const sharedBrowserPool = new PlaywrightBrowserPool();

export interface BrowserCapabilityCheckResult {
  capability: BrowserVerificationCapability;
  details: string;
  chromiumVersion?: string;
  chromiumExecutableAvailable: boolean;
  browserLaunchSucceeded: boolean;
  navigationSmokeSucceeded: boolean;
}

/**
 * Self-check diagnostic for browser verification capability.
 */
export async function checkBrowserCapability(): Promise<BrowserCapabilityCheckResult> {
  try {
    const browser = await sharedBrowserPool.getBrowser();
    if (!browser) {
      return {
        capability: "unavailable",
        details: "Playwright Chromium executable failed to launch",
        chromiumExecutableAvailable: false,
        browserLaunchSucceeded: false,
        navigationSmokeSucceeded: false,
      };
    }
    const version = browser.version ? browser.version() : "unknown";
    const page = await browser.newPage();
    await page.setContent("<html><body><p>Capability Test</p></body></html>");
    const text = await page.textContent("p");
    await page.close();

    if (text === "Capability Test") {
      return {
        capability: "available",
        details: "Playwright Chromium operational and verified",
        chromiumVersion: version,
        chromiumExecutableAvailable: true,
        browserLaunchSucceeded: true,
        navigationSmokeSucceeded: true,
      };
    }
    return {
      capability: "degraded",
      details: "Browser initialized but evaluation returned unexpected result",
      chromiumVersion: version,
      chromiumExecutableAvailable: true,
      browserLaunchSucceeded: true,
      navigationSmokeSucceeded: false,
    };
  } catch (err: any) {
    return {
      capability: "unavailable",
      details: `Browser initialization failed: ${err.message}`,
      chromiumExecutableAvailable: false,
      browserLaunchSucceeded: false,
      navigationSmokeSucceeded: false,
    };
  }
}

/**
 * Generic Page State Classifier for rendered browser environments.
 * Evaluates navigation status, text volume, challenge markers, and 404 patterns WITHOUT site-specific hardcoding.
 */
export function classifyBrowserPageState(
  navStatus: number | null,
  pageTitle: string,
  bodyText: string,
  headings: string[] = [],
): { pageState: BrowserPageState; isChallenge: boolean } {
  const combined = (pageTitle + " " + bodyText + " " + headings.join(" ")).toLowerCase();
  const titleLower = pageTitle.toLowerCase().trim();
  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;

  // 1. Generic Bot Challenge / CAPTCHA / WAF Protection
  const isChallenge =
    (combined.includes("cloudflare") &&
      (combined.includes("verify you are human") ||
        combined.includes("turnstile") ||
        combined.includes("just a moment"))) ||
    combined.includes("access denied") ||
    combined.includes("attention required") ||
    combined.includes("security check") ||
    combined.includes("perimeterx") ||
    combined.includes("human verification") ||
    combined.includes("unusual traffic from your computer network") ||
    combined.includes("press & hold") ||
    combined.includes("please verify that you are not a robot");

  if (isChallenge) {
    return { pageState: "challenge_page", isChallenge: true };
  }

  // 2. Generic Authentication / Login Wall
  const isLoginWall =
    (titleLower.includes("sign in") || titleLower.includes("log in") || titleLower.includes("login")) &&
    (combined.includes("sign in to continue") ||
      combined.includes("enter your password") ||
      combined.includes("login required") ||
      combined.includes("join linkedin") ||
      combined.includes("sign in to view this profile"));

  if (isLoginWall) {
    return { pageState: "login_wall", isChallenge: false };
  }

  // 3. Genuine 404 / Gone Page Detection (High-Confidence Explicit Signals)
  const isExplicitNotFoundTitle =
    titleLower.includes("404 not found") ||
    titleLower === "page not found" ||
    titleLower === "not found" ||
    titleLower.includes("404 - ") ||
    titleLower.startsWith("error 404") ||
    titleLower === "404" ||
    titleLower.startsWith("404 error");

  const hasExplicitNotFoundHeading = headings.some((h) => {
    const hl = h.toLowerCase().trim();
    return (
      hl === "page not found" ||
      hl === "404 - page not found" ||
      hl === "404 not found" ||
      hl === "error 404" ||
      hl === "404 error" ||
      hl === "page does not exist" ||
      hl === "page cannot be found" ||
      hl === "we can't seem to find that page"
    );
  });

  const isShortErrorBody =
    (combined.includes("page not found") ||
      combined.includes("the page you were looking for doesn't exist") ||
      combined.includes("404 error") ||
      combined.includes("we can't seem to find the page") ||
      combined.includes("this page could not be found") ||
      combined.includes("the requested url was not found")) &&
    wordCount < 120;

  const hasStrongNotFoundSignals = isExplicitNotFoundTitle || hasExplicitNotFoundHeading || isShortErrorBody;

  // 4. Substantial Valid Rendered Destination Detection (SPAs, Store Pages, Content Portals)
  const hasMeaningfulTitle = Boolean(pageTitle && pageTitle.trim().length >= 3 && !isExplicitNotFoundTitle);
  const hasMeaningfulHeadings = headings.some((h) => {
    const hl = h.toLowerCase().trim();
    return (
      hl.length >= 3 &&
      !hl.includes("404") &&
      !hl.includes("not found") &&
      !hl.includes("error") &&
      !hl.includes("access denied")
    );
  });
  const hasMeaningfulContent = wordCount >= 15;
  const hasSubstantialBody = wordCount >= 50;

  const hasStrongValidPageEvidence =
    !hasStrongNotFoundSignals && (hasSubstantialBody || (hasMeaningfulContent && (hasMeaningfulTitle || hasMeaningfulHeadings)));

  // 5. Evidence Fusion Resolution
  if (hasStrongNotFoundSignals) {
    if (navStatus === 200) {
      return { pageState: "soft_404_candidate", isChallenge: false };
    }
    return { pageState: "not_found_page", isChallenge: false };
  }

  if (hasStrongValidPageEvidence) {
    // Rendered DOM proves valid reachable destination regardless of initial navigation status
    return { pageState: "valid_page", isChallenge: false };
  }

  if (wordCount < 10 && navStatus === 200) {
    return { pageState: "empty_shell", isChallenge: false };
  }

  if (navStatus && navStatus >= 200 && navStatus < 400 && wordCount >= 10) {
    return { pageState: "valid_page", isChallenge: false };
  }

  // Ambiguous DOM with status 404 or other status without explicit not-found signals -> unknown/inconclusive
  return { pageState: "unknown", isChallenge: false };
}

/**
 * Runs Playwright verification using the shared browser pool.
 */
export async function verifyLinkWithBrowser(
  targetUrl: string,
  timeoutMs = 12000,
): Promise<ExternalLinkBrowserEvidence> {
  const browser = await sharedBrowserPool.getBrowser();
  if (!browser) {
    return {
      attempted: false,
      navigationStatus: null,
      challengeDetected: false,
      checkedAt: new Date().toISOString(),
      outcome: "http_404_browser_inconclusive",
    };
  }

  let context = null;
  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    // Settle delay for client scripts / SPA render
    await page.waitForTimeout(1000);

    const navStatus = response ? response.status() : 200;
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => "");
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || "").catch(() => "");
    const headings = await page
      .evaluate(() => Array.from(document.querySelectorAll("h1, h2")).map((el) => (el.textContent || "").trim()))
      .catch(() => []);

    const { pageState, isChallenge } = classifyBrowserPageState(navStatus, pageTitle, bodyText, headings);

    let outcome: ExternalLinkOutcome = "browser_verified_ok";
    if (pageState === "challenge_page") {
      outcome = "browser_challenge_inconclusive";
    } else if (pageState === "login_wall") {
      outcome = "bot_blocked_inconclusive";
    } else if (pageState === "not_found_page") {
      outcome = "confirmed_broken";
    } else if (pageState === "valid_page") {
      outcome = "browser_verified_ok";
    } else {
      outcome = "http_404_browser_inconclusive";
    }

    await context.close();
    return {
      attempted: true,
      navigationStatus: navStatus,
      finalUrl,
      pageTitle,
      pageState,
      visibleTextSample: bodyText.slice(0, 150),
      challengeDetected: isChallenge,
      checkedAt: new Date().toISOString(),
      outcome,
    };
  } catch (err: any) {
    if (context) {
      await context.close().catch(() => {});
    }
    return {
      attempted: true,
      navigationStatus: null,
      challengeDetected: false,
      checkedAt: new Date().toISOString(),
      outcome: "http_404_browser_inconclusive",
    };
  }
}

/**
 * Verifies a link (especially external) via lightweight GET, with conditional Playwright browser
 * verification before declaring 404/410/403/429 targets broken.
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
      responseType: "stream",
      signal,
      validateStatus: () => true,
    });

    if (response.data && typeof response.data.destroy === "function") {
      response.data.destroy();
    }

    const status = response.status;
    const finalUrl = (response.request as any)?.res?.responseUrl || targetUrl;

    if (finalUrl !== targetUrl) {
      redirectHops.push({
        statusCode: 301,
        fromUrl: targetUrl,
        toUrl: finalUrl,
      });
    }

    const httpEvidence: ExternalLinkHttpEvidence = {
      status,
      finalUrl,
      method: "GET",
      checkedAt,
      outcome:
        status >= 200 && status < 300
          ? redirectHops.length > 0
            ? "redirected_ok"
            : "confirmed_ok"
          : status === 404 || status === 410
            ? "confirmed_broken"
            : status === 429
              ? "rate_limited_inconclusive"
              : status === 403 || status === 999 || status === 401
                ? "bot_blocked_inconclusive"
                : "manual_review",
    };

    // 1. Success 2xx/3xx on initial HTTP request
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
        httpVerification: httpEvidence,
      };
    }

    // 2. Conditional Browser Verification for 404, 410, 403, 429, 999
    if (status === 404 || status === 410 || status === 403 || status === 999 || status === 429) {
      try {
        const browserEv = await verifyLinkWithBrowser(targetUrl, 12000);
        if (browserEv.outcome === "browser_verified_ok") {
          return {
            rawHref: rawHref || targetUrl,
            resolvedUrl: targetUrl,
            normalizedUrl: targetUrl,
            sourcePageUrl,
            verificationMethod: "http_plus_playwright",
            requestMethod: "GET",
            httpStatus: status,
            finalUrl: browserEv.finalUrl || finalUrl,
            redirectChain: redirectHops,
            outcome: "browser_verified_ok",
            reason: `HTTP returned ${status}, but real browser verified reachable page (Title: "${browserEv.pageTitle?.slice(0, 50) || "Valid Destination"}")`,
            checkedAt,
            httpVerification: httpEvidence,
            browserVerification: browserEv,
          };
        } else if (
          browserEv.outcome === "browser_challenge_inconclusive" ||
          browserEv.outcome === "http_404_browser_inconclusive"
        ) {
          return {
            rawHref: rawHref || targetUrl,
            resolvedUrl: targetUrl,
            normalizedUrl: targetUrl,
            sourcePageUrl,
            verificationMethod: "http_plus_playwright",
            requestMethod: "GET",
            httpStatus: status,
            finalUrl: browserEv.finalUrl || finalUrl,
            redirectChain: redirectHops,
            outcome: browserEv.outcome,
            reason: `Target returned HTTP ${status} and browser verification was inconclusive (bot protection/wall)`,
            checkedAt,
            httpVerification: httpEvidence,
            browserVerification: browserEv,
          };
        } else if (browserEv.outcome === "confirmed_broken") {
          return {
            rawHref: rawHref || targetUrl,
            resolvedUrl: targetUrl,
            normalizedUrl: targetUrl,
            sourcePageUrl,
            verificationMethod: "http_plus_playwright",
            requestMethod: "GET",
            httpStatus: status,
            finalUrl: browserEv.finalUrl || finalUrl,
            redirectChain: redirectHops,
            outcome: "confirmed_broken",
            reason: `Target returned HTTP ${status} and browser confirmed page not found`,
            checkedAt,
            httpVerification: httpEvidence,
            browserVerification: browserEv,
          };
        }
      } catch {
        // Fallback to safe inconclusive classification
      }
    }

    // 3. Fallback for non-browser resolved errors
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
        httpVerification: httpEvidence,
      };
    }

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
        httpVerification: httpEvidence,
      };
    }

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
        httpVerification: httpEvidence,
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
      outcome: "manual_review",
      reason: `Target returned HTTP status ${status}`,
      checkedAt,
      httpVerification: httpEvidence,
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
