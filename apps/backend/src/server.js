import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { ReportGenerator } from "lighthouse/report/generator/report-generator.js";
import { config, isProduction } from "./config.js";
import { runPageSpeedAudit, AuditError } from "./services/pageSpeed.js";

const app = express();
const ALLOWED_STRATEGIES = new Set(["mobile", "desktop"]);
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const lighthouseRuns = new Map();
const aggregatedRuns = new Map(); // key: aggregated run id
const aggregatedRunsByUrl = new Map(); // key: normalized url -> latest aggregated id
const DEFAULT_STRATEGIES = ["mobile", "desktop"];

const normalizeUrlInput = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(prefixed).toString();
  } catch {
    return null;
  }
};

const normalizeStrategy = (value) => {
  const candidate = typeof value === "string" ? value.toLowerCase() : "";
  return ALLOWED_STRATEGIES.has(candidate) ? candidate : config.psi.defaultStrategy;
};

const normalizeLocale = (value) => {
  if (typeof value !== "string") {
    return config.psi.locale;
  }
  const trimmed = value.trim();
  return trimmed || config.psi.locale;
};

const buildPsiUrl = (url, strategy = config.psi.defaultStrategy, locale = config.psi.locale) => {
  const psiUrl = new URL(PSI_ENDPOINT);
  psiUrl.searchParams.set("url", url);
  psiUrl.searchParams.set("key", config.psi.apiKey);
  psiUrl.searchParams.set("strategy", strategy);
  psiUrl.searchParams.set("locale", locale);
  config.psi.categories.forEach((category) => psiUrl.searchParams.append("category", category));
  return psiUrl;
};

const fetchLegacyLighthouse = async (url, strategy = config.psi.defaultStrategy, locale = config.psi.locale) => {
  if (!config.psi.apiKey) {
    throw new Error("PSI_API_KEY is not configured on the server");
  }
  const psiUrl = buildPsiUrl(url, strategy, locale);
  const response = await fetch(psiUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(config.psi.timeoutMs),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PageSpeed request failed (${response.status}): ${message}`);
  }

  const payload = await response.json();
  if (!payload.lighthouseResult) {
    throw new Error("PSI response did not include lighthouseResult");
  }
  return payload;
};

const buildMockEvents = () => {
  const now = new Date();
  return [
    { id: 1, type: "Lighthouse run", timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString() },
    { id: 2, type: "Page analyzed", timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
    { id: 3, type: "Audit shared", timestamp: now.toISOString() },
  ];
};

const createRunRecord = (payload, { url, strategy, locale }) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const record = {
    id,
    createdAt,
    url,
    strategy,
    locale,
    payload,
    lighthouse: payload.lighthouseResult,
  };
  lighthouseRuns.set(id, record);
  return record;
};

const summarizeVariant = (record) => {
  if (!record?.lighthouse) {
    return null;
  }
  const audits = record.lighthouse.audits ?? {};
  const categories = record.lighthouse.categories ?? {};
  const metricValue = (auditId) => audits[auditId]?.numericValue ?? null;
  const score = categories.performance?.score;
  return {
    id: record.id,
    score: typeof score === "number" ? Math.round(score * 100) : null,
    lcp: metricValue("largest-contentful-paint"),
    cls: metricValue("cumulative-layout-shift"),
    inp:
      metricValue("interaction-to-next-paint") ??
      metricValue("experimental-interaction-to-next-paint") ??
      metricValue("total-blocking-time"),
    tbt: metricValue("total-blocking-time"),
  };
};

const buildVariantEntry = (record) => ({
  record,
  summary: summarizeVariant(record),
});

const storeAggregatedRun = ({ url, locale, variants }) => {
  const aggregated = {
    id: randomUUID(),
    url,
    locale,
    createdAt: new Date().toISOString(),
    variants,
  };
  aggregatedRuns.set(aggregated.id, aggregated);
  aggregatedRunsByUrl.set(url, aggregated.id);
  return aggregated;
};

const formatAggregatedResponse = (record) => ({
  ok: true,
  id: record.id,
  url: record.url,
  locale: record.locale,
  createdAt: record.createdAt,
  mobile: record.variants.mobile?.summary ?? null,
  desktop: record.variants.desktop?.summary ?? null,
});

const renderReportHtml = (record) => {
  if (!record.lighthouse) {
    throw new Error("Run does not contain lighthouse data");
  }
  return ReportGenerator.generateReportHtml(record.lighthouse);
};

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(
  cors({
    origin: config.server.corsOrigin,
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(isProduction ? "combined" : "dev"));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "seo-geo-analyzer-api", time: new Date().toISOString() });
});

app.get("/api/events", (_req, res) => {
  res.json({ events: buildMockEvents() });
});

app.post("/api/audit/lighthouse", async (req, res) => {
  const normalizedUrl = normalizeUrlInput(req.body?.url);
  if (!normalizedUrl) {
    return res.status(400).json({ error: "Please provide a valid URL to audit" });
  }

  const strategy = normalizeStrategy(req.body?.strategy);
  const locale = normalizeLocale(req.body?.locale);
  const skipCache = Boolean(req.body?.skipCache);

  try {
    const audit = await runPageSpeedAudit({ url: normalizedUrl, strategy, locale, skipCache });
    return res.json(audit);
  } catch (error) {
    if (error instanceof AuditError) {
      const payload = { error: error.message };
      if (error.details) {
        payload.details = error.details;
      }
      return res.status(error.statusCode).json(payload);
    }
    console.error("Lighthouse audit failed", error);
    return res.status(500).json({ error: "Unable to complete Lighthouse audit", message: error.message });
  }
});

app.post("/api/lighthouse-runs", async (req, res) => {
  const normalizedUrl = normalizeUrlInput(req.body?.url);
  if (!normalizedUrl) {
    return res.status(400).json({ ok: false, error: "Missing URL" });
  }
  const locale = normalizeLocale(req.body?.locale);
  const requestedStrategy = req.body?.strategy || req.body?.device;
  const strategies = requestedStrategy ? [normalizeStrategy(requestedStrategy)] : DEFAULT_STRATEGIES;
  try {
    const previousAggregatedId = aggregatedRunsByUrl.get(normalizedUrl);
    const baseVariants =
      previousAggregatedId && aggregatedRuns.get(previousAggregatedId)
        ? { ...aggregatedRuns.get(previousAggregatedId).variants }
        : {};

    const variants = { ...baseVariants };
    for (const strategy of strategies) {
      const payload = await fetchLegacyLighthouse(normalizedUrl, strategy, locale);
      const record = createRunRecord(payload, { url: normalizedUrl, strategy, locale });
      variants[strategy] = buildVariantEntry(record);
    }

    const aggregatedRecord = storeAggregatedRun({ url: normalizedUrl, locale, variants });
    return res.json(formatAggregatedResponse(aggregatedRecord));
  } catch (error) {
    console.error("Lighthouse run error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Failed to fetch from PSI API" });
  }
});

app.get("/api/lighthouse-runs/latest", async (req, res) => {
  const normalizedUrl = normalizeUrlInput(req.query?.url);
  if (!normalizedUrl) {
    return res.status(400).json({ ok: false, error: "Missing URL" });
  }
  const aggregatedId = aggregatedRunsByUrl.get(normalizedUrl);
  if (!aggregatedId) {
    return res.status(404).json({ ok: false, error: "No Lighthouse runs found for this URL" });
  }
  const aggregatedRecord = aggregatedRuns.get(aggregatedId);
  if (!aggregatedRecord) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }
  return res.json(formatAggregatedResponse(aggregatedRecord));
});

app.get("/api/lighthouse-runs/:runId/report", (req, res) => {
  const aggregatedRecord = aggregatedRuns.get(req.params.runId);
  if (!aggregatedRecord) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }
  const device = normalizeStrategy(req.query?.device);
  const variant = aggregatedRecord.variants[device] ?? aggregatedRecord.variants.mobile;
  if (!variant?.record) {
    return res.status(404).json({ ok: false, error: "Variant not found" });
  }
  const format = typeof req.query?.format === "string" ? req.query.format.toLowerCase() : "html";
  if (format === "json") {
    return res.json(formatAggregatedResponse(aggregatedRecord));
  }
  if (format === "lhr") {
    return res.json(variant.record.lighthouse);
  }
  try {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self' https: data:",
        "style-src 'self' 'unsafe-inline' https:",
        "script-src 'self' 'unsafe-inline'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
      ].join("; "),
    );
    const html = renderReportHtml(variant.record);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    console.error("Failed to render Lighthouse report", error);
    return res.status(500).json({ ok: false, error: "Unable to render report" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.server.port, () => {
  console.log(`Backend API listening on http://localhost:${config.server.port}`);
});
