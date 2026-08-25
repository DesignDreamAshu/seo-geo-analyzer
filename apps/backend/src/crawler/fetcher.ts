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
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
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
  retries = 2,
): Promise<FetchResult> {
  const startedAt = Date.now();
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
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

      const capturedHeaders: Record<string, string | string[] | undefined> = {};
      if (response.headers && typeof response.headers === "object") {
        for (const [k, v] of Object.entries(response.headers)) {
          if (v !== undefined && v !== null) {
            capturedHeaders[k.toLowerCase()] = Array.isArray(v)
              ? v.map((item) => String(item))
              : String(v);
          }
        }
      }

      // In Node.js, Axios auto-decompresses gzip/br/deflate streams and strips Content-Encoding from response.headers.
      // Recover the wire Content-Encoding from underlying HTTP rawHeaders if not present on response.headers.
      if (!capturedHeaders["content-encoding"]) {
        const rawHeaders = (response.request as any)?.res?.rawHeaders || [];
        for (let i = 0; i < rawHeaders.length; i += 2) {
          if (String(rawHeaders[i]).toLowerCase() === "content-encoding") {
            capturedHeaders["content-encoding"] = String(rawHeaders[i + 1]);
            break;
          }
        }
      }

      return {
        ok: response.status >= 200 && response.status < 400,
        statusCode: response.status,
        finalUrl,
        redirectHops,
        html: rawHtml,
        headers: capturedHeaders,
        contentType,
        responseTimeMs,
        byteSize: Buffer.byteLength(rawHtml, "utf8"),
      };
    } catch (error: any) {
      lastError = error;
      if (attempt < retries && !signal?.aborted) {
        // Transient network failure retry with small backoff
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
    }
  }

  const responseTimeMs = Date.now() - startedAt;
  return {
    ok: false,
    statusCode: lastError?.response?.status || 0,
    finalUrl: targetUrl,
    redirectHops: [],
    html: "",
    headers: {},
    contentType: "",
    responseTimeMs,
    byteSize: 0,
    errorMessage: lastError?.message || "Failed to fetch page",
  };
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
    ((combined.includes("page not found") ||
      combined.includes("the page you were looking for doesn't exist") ||
      combined.includes("404 error") ||
      combined.includes("we can't seem to find the page") ||
      combined.includes("this page could not be found") ||
      combined.includes("the requested url was not found")) &&
      wordCount < 120) ||
    ((combined.includes("404") || combined.includes("not found")) && wordCount < 30);

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
 * Helper to run a single browser probe with bounded DOM stabilization.
 */
async function runSingleBrowserProbe(
  browser: any,
  targetUrl: string,
  timeoutMs: number,
  stabilizationWaitMs = 1500
): Promise<{
  navStatus: number;
  finalUrl: string;
  pageTitle: string;
  bodyText: string;
  headings: string[];
  pageState: BrowserPageState;
  isChallenge: boolean;
  timestamp: string;
}> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const timestamp = new Date().toISOString();
  try {
    const page = await context.newPage();
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    // Bounded stabilization: wait for networkidle or timeout
    await page.waitForLoadState("networkidle", { timeout: Math.min(2500, stabilizationWaitMs) }).catch(() => {});
    await page.waitForTimeout(500);

    const navStatus = response ? response.status() : 200;
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => "");
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || "").catch(() => "");
    const headings = await page
      .evaluate(() => Array.from(document.querySelectorAll("h1, h2")).map((el) => (el.textContent || "").trim()))
      .catch(() => []);

    const { pageState, isChallenge } = classifyBrowserPageState(navStatus, pageTitle, bodyText, headings);
    await context.close();
    return {
      navStatus,
      finalUrl,
      pageTitle,
      bodyText,
      headings,
      pageState,
      isChallenge,
      timestamp,
    };
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
}

/**
 * Runs Playwright verification with multi-observation confirmation for disputed 404/410 targets.
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

  try {
    // Probe 1: Normal settle
    const probe1 = await runSingleBrowserProbe(browser, targetUrl, timeoutMs, 1500);

    // If Probe 1 indicates not_found_page or 404/410, run Probe 2 in fresh context with extended stabilization
    if (probe1.pageState === "not_found_page" || probe1.navStatus === 404 || probe1.navStatus === 410) {
      try {
        const probe2 = await runSingleBrowserProbe(browser, targetUrl, timeoutMs + 2000, 3000);

        // If probe 1 and probe 2 conflict (e.g. one valid and one not-found), classify as inconclusive with zero penalty
        if (probe1.pageState !== probe2.pageState) {
          if (probe1.pageState === "valid_page" || probe2.pageState === "valid_page") {
            return {
              attempted: true,
              navigationStatus: probe2.navStatus || probe1.navStatus,
              finalUrl: probe2.finalUrl || probe1.finalUrl,
              pageTitle: probe2.pageTitle || probe1.pageTitle,
              pageState: "valid_page",
              visibleTextSample: (probe2.bodyText || probe1.bodyText).slice(0, 150),
              challengeDetected: probe1.isChallenge || probe2.isChallenge,
              checkedAt: new Date().toISOString(),
              outcome: "http_404_browser_inconclusive",
            };
          }
        }

        // Both probes agree on not_found_page
        if (probe2.pageState === "not_found_page") {
          return {
            attempted: true,
            navigationStatus: probe2.navStatus,
            finalUrl: probe2.finalUrl,
            pageTitle: probe2.pageTitle,
            pageState: "not_found_page",
            visibleTextSample: probe2.bodyText.slice(0, 150),
            challengeDetected: probe2.isChallenge,
            checkedAt: new Date().toISOString(),
            outcome: "confirmed_broken",
          };
        }
      } catch {
        // Fall back to probe 1 if probe 2 times out
      }
    }

    let outcome: ExternalLinkOutcome = "browser_verified_ok";
    if (probe1.pageState === "challenge_page") {
      outcome = "browser_challenge_inconclusive";
    } else if (probe1.pageState === "login_wall") {
      outcome = "bot_blocked_inconclusive";
    } else if (probe1.pageState === "not_found_page") {
      outcome = "confirmed_broken";
    } else if (probe1.pageState === "valid_page") {
      outcome = "browser_verified_ok";
    } else {
      outcome = "http_404_browser_inconclusive";
    }

    return {
      attempted: true,
      navigationStatus: probe1.navStatus,
      finalUrl: probe1.finalUrl,
      pageTitle: probe1.pageTitle,
      pageState: probe1.pageState,
      visibleTextSample: probe1.bodyText.slice(0, 150),
      challengeDetected: probe1.isChallenge,
      checkedAt: new Date().toISOString(),
      outcome,
    };
  } catch (err: any) {
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
