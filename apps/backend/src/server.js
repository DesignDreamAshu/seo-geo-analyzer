import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config, isProduction } from "./config.js";
import { runPageSpeedAudit, AuditError } from "./services/pageSpeed.js";

const app = express();
const ALLOWED_STRATEGIES = new Set(["mobile", "desktop"]);

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
  res.json({ ok: true, timestamp: new Date().toISOString() });
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

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.server.port, () => {
  console.log(`Backend API listening on http://localhost:${config.server.port}`);
});
