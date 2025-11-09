import fetch from "node-fetch";
import { config } from "../config.js";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const cache = new Map();

const METRIC_DEFINITIONS = [
  { key: "firstContentfulPaint", auditId: "first-contentful-paint", label: "First Contentful Paint", unit: "ms" },
  { key: "largestContentfulPaint", auditId: "largest-contentful-paint", label: "Largest Contentful Paint", unit: "ms" },
  { key: "totalBlockingTime", auditId: "total-blocking-time", label: "Total Blocking Time", unit: "ms" },
  { key: "cumulativeLayoutShift", auditId: "cumulative-layout-shift", label: "Cumulative Layout Shift", unit: "" },
  { key: "speedIndex", auditId: "speed-index", label: "Speed Index", unit: "ms" },
  { key: "interactive", auditId: "interactive", label: "Time to Interactive", unit: "ms" },
  { key: "serverResponseTime", auditId: "server-response-time", label: "Server Response Time", unit: "ms" },
];

const FIELD_METRICS = {
  firstContentfulPaint: "FIRST_CONTENTFUL_PAINT_MS",
  largestContentfulPaint: "LARGEST_CONTENTFUL_PAINT_MS",
  cumulativeLayoutShift: "CUMULATIVE_LAYOUT_SHIFT_SCORE",
  interactionToNextPaint: "INTERACTION_TO_NEXT_PAINT",
  experimentalTimeToFirstByte: "EXPERIMENTAL_TIME_TO_FIRST_BYTE",
};

const clone = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const scoreToPercent = (score) => (typeof score === "number" ? Math.round(score * 100) : null);

const buildCacheKey = ({ url, strategy, locale }) => `${strategy}:${locale}:${url}`;

const getFromCache = (key) => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return clone(entry.payload);
};

const setCache = (key, payload) => {
  if (config.psi.cacheTtlMs <= 0) {
    return;
  }
  cache.set(key, {
    payload: clone(payload),
    expiresAt: Date.now() + config.psi.cacheTtlMs,
  });
};

const formatMetrics = (audits) =>
  METRIC_DEFINITIONS.map(({ key, auditId, label, unit }) => {
    const audit = audits[auditId] ?? {};
    return {
      key,
      label,
      unit,
      numericValue: audit.numericValue ?? null,
      displayValue: audit.displayValue ?? null,
      score: scoreToPercent(audit.score),
    };
  });

const formatOpportunities = (audits) =>
  Object.values(audits)
    .filter(
      (audit) =>
        audit.details?.type === "opportunity" &&
        typeof audit.details.overallSavingsMs === "number" &&
        (audit.score ?? 1) < 1,
    )
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      description: audit.description,
      score: scoreToPercent(audit.score),
      savingsMs: Math.round(audit.details.overallSavingsMs),
      savingsBytes: audit.details.overallSavingsBytes ?? null,
    }))
    .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
    .slice(0, config.psi.maxOpportunities);

const formatCategories = (categories = {}) =>
  Object.values(categories).map((category) => ({
    id: category.id ?? category.title?.toLowerCase() ?? "category",
    title: category.title ?? category.id,
    score: scoreToPercent(category.score),
  }));

const formatFieldMetrics = (experience = {}) => {
  const metrics = experience.metrics ?? {};
  return Object.entries(FIELD_METRICS).reduce((acc, [key, metricId]) => {
    const metric = metrics[metricId];
    if (!metric) {
      return acc;
    }
    acc[key] = {
      percentile: metric.percentile ?? null,
      category: metric.category ?? null,
      distributions: metric.distributions ?? [],
    };
    return acc;
  }, {});
};

export class AuditError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const fetchPsiPayload = async ({ url, strategy, locale }) => {
  if (!config.psi.apiKey) {
    throw new AuditError("PSI_API_KEY is not configured on the server", 500);
  }

  const psiUrl = new URL(PSI_ENDPOINT);
  psiUrl.searchParams.set("url", url);
  psiUrl.searchParams.set("strategy", strategy);
  psiUrl.searchParams.set("key", config.psi.apiKey);
  psiUrl.searchParams.set("locale", locale || config.psi.locale);
  config.psi.categories.forEach((category) => psiUrl.searchParams.append("category", category));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.psi.timeoutMs);

  try {
    const response = await fetch(psiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new AuditError("PageSpeed request failed", response.status, message);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AuditError("PageSpeed request timed out", 504);
    }
    if (error instanceof AuditError) {
      throw error;
    }
    throw new AuditError("Unable to reach PageSpeed API", 502, error.message);
  } finally {
    clearTimeout(timeoutId);
  }
};

const shapeAuditResponse = (payload, { url, strategy }) => {
  const lighthouseResult = payload.lighthouseResult ?? {};
  const audits = lighthouseResult.audits ?? {};

  return {
    url,
    requestedUrl: lighthouseResult.requestedUrl ?? url,
    finalUrl: lighthouseResult.finalUrl ?? url,
    strategy,
    fetchedAt: payload.analysisUTCTimestamp ?? new Date().toISOString(),
    categories: formatCategories(lighthouseResult.categories),
    metrics: formatMetrics(audits),
    opportunities: formatOpportunities(audits),
    fieldData: {
      page: formatFieldMetrics(payload.loadingExperience),
      origin: formatFieldMetrics(payload.originLoadingExperience),
    },
    psiMeta: {
      lighthouseVersion: lighthouseResult.lighthouseVersion,
      formFactor: lighthouseResult.configSettings?.formFactor,
      userAgent: lighthouseResult.userAgent,
    },
  };
};

export const runPageSpeedAudit = async ({ url, strategy, locale, skipCache = false }) => {
  const cacheKey = buildCacheKey({ url, strategy, locale: locale || config.psi.locale });

  if (!skipCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  const payload = await fetchPsiPayload({ url, strategy, locale });
  const shaped = shapeAuditResponse(payload, { url, strategy });
  setCache(cacheKey, shaped);
  return { ...shaped, cached: false };
};
