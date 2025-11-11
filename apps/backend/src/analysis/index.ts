import { nanoid } from "nanoid";
import { normalizeAuditUrl } from "../storage/lighthouse-store";
import { ANALYSIS_TIMEOUT_MS } from "./constants";
import { fetchHtmlDocument, fetchPsi, fetchRobotsTxt, fetchSitemaps } from "./http";
import { lookupGeo } from "./geo";
import { evaluateLinkSample, buildModuleResults } from "./modules";
import type { AnalyzeOptions, AnalysisContext, AnalysisResult } from "./types";
import { calculateWeightedScore, deriveCountryFromLocale } from "./utils";
import { getAnalysisSnapshotsForUrl, saveAnalysisRun } from "../storage/analysis-store";

export class AnalysisTimeoutError extends Error {
  constructor(message = "Analysis timed out") {
    super(message);
    this.name = "AnalysisTimeoutError";
  }
}

const createAbortController = (timeoutMs: number, external?: AbortSignal | null) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new AnalysisTimeoutError(`Analysis timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const cleanup = () => clearTimeout(timeout);

  if (external) {
    const relay = () => controller.abort(external.reason);
    if (external.aborted) {
      controller.abort(external.reason);
    } else {
      external.addEventListener("abort", relay, { once: true });
      controller.signal.addEventListener(
        "abort",
        () => {
          external.removeEventListener("abort", relay);
        },
        { once: true },
      );
    }
  }

  return { controller, cleanup };
};

export const analyzeSite = async (options: AnalyzeOptions): Promise<AnalysisResult> => {
  if (!options.url || typeof options.url !== "string") {
    throw new Error("url is required.");
  }

  const startedAt = new Date();
  const normalizedUrl = normalizeAuditUrl(options.url);
  const strategy = options.strategy === "desktop" ? "desktop" : "mobile";
  const locale = options.locale?.trim() || "en_US";
  const targetCountry = deriveCountryFromLocale(locale);
  const skipCache = Boolean(options.skipCache);

  const { controller, cleanup } = createAbortController(ANALYSIS_TIMEOUT_MS, options.signal ?? null);
  const signal = controller.signal;

  try {
    const psiPromise = fetchPsi(normalizedUrl, strategy, locale, { skipCache, signal });
    const htmlPromise = fetchHtmlDocument(normalizedUrl, { skipCache, signal });
    const robotsPromise = fetchRobotsTxt(new URL(normalizedUrl), { skipCache, signal });

    const [psi, html, robots] = await Promise.all([psiPromise, htmlPromise, robotsPromise]);
    const finalUrl = html.finalUrl ?? normalizedUrl;
    const finalOrigin = new URL(finalUrl);

    const [sitemap, geo, linkSample] = await Promise.all([
      fetchSitemaps(finalOrigin, robots.text, { skipCache, signal }),
      lookupGeo(finalOrigin.hostname, { skipCache, signal }),
      evaluateLinkSample(html.dom, finalOrigin, signal),
    ]);

    const context: AnalysisContext = {
      url: finalOrigin,
      normalizedUrl,
      locale,
      targetCountry,
      strategy,
      psi,
      html: html.html,
      dom: html.dom,
      headers: html.headers,
      robotsTxt: robots.text,
      sitemap,
      geo,
      linkSample,
    };

    const modules = await buildModuleResults(context);
    const overall = calculateWeightedScore(modules);
    const finishedAt = new Date();

    const recordId = nanoid(12);
    const createdAt = finishedAt.toISOString();

    await saveAnalysisRun({
      id: recordId,
      url: finalOrigin.toString(),
      normalizedUrl,
      strategy,
      locale,
      overall,
      modules,
      createdAt,
    });

    const historySnapshots = await getAnalysisSnapshotsForUrl(finalOrigin.toString(), 10);

    return {
      ok: true,
      url: finalOrigin.toString(),
      strategy,
      locale,
      overall,
      modules,
      raw: {
        psi,
        headers: html.headers,
        robots: robots.text,
        sitemap,
        geo,
      },
      timingMs: finishedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      historySnapshots,
    };
  } catch (error) {
    if (signal.aborted) {
      const reason = signal.reason;
      if (reason instanceof AnalysisTimeoutError) {
        throw reason;
      }
      if (reason instanceof Error) {
        throw reason;
      }
      throw new Error("Analysis aborted");
    }
    throw error;
  } finally {
    cleanup();
  }
};

export { calculateWeightedScore } from "./utils";
