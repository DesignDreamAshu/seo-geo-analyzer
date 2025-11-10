import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config, isProduction } from "./config.js";
import { runPageSpeedAudit, AuditError } from "./services/pageSpeed.js";

const app = express();
const ALLOWED_STRATEGIES = new Set(["mobile", "desktop"]);
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

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

const fetchLegacyLighthouse = async (url) => {
  if (!config.psi.apiKey) {
    throw new Error("PSI_API_KEY is not configured on the server");
  }
  const psiUrl = buildPsiUrl(url);
  const response = await fetch(psiUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(config.psi.timeoutMs),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PageSpeed request failed (${response.status}): ${message}`);
  }

  const payload = await response.json();
  const lighthouse = payload.lighthouseResult;
  if (!lighthouse) {
    throw new Error("PSI response did not include lighthouseResult");
  }
  return lighthouse;
};

const buildMockEvents = () => {
  const now = new Date();
  return [
    { id: 1, type: "Lighthouse run", timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString() },
    { id: 2, type: "Page analyzed", timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
    { id: 3, type: "Audit shared", timestamp: now.toISOString() },
  ];
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
  try {
    const lighthouse = await fetchLegacyLighthouse(normalizedUrl);
    return res.json({ ok: true, url: normalizedUrl, lighthouse });
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
  try {
    const lighthouse = await fetchLegacyLighthouse(normalizedUrl);
    return res.json({ ok: true, url: normalizedUrl, lighthouse });
  } catch (error) {
    console.error("Latest Lighthouse run error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Failed to fetch from PSI API" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.server.port, () => {
  console.log(`Backend API listening on http://localhost:${config.server.port}`);
});
