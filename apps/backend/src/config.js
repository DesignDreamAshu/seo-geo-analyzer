import dotenv from "dotenv";

dotenv.config();

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseList = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const list = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
};

const DEFAULT_CORS = ["http://localhost:8080"];
const DEFAULT_CATEGORIES = ["performance", "seo", "best-practices", "accessibility"];
const DEFAULT_STRATEGY = "mobile";
const resolvePsiApiKey = () => {
  if (process.env.PSI_API_KEY?.trim()) {
    return process.env.PSI_API_KEY.trim();
  }
  if (process.env.GOOGLE_API_KEY?.trim()) {
    return process.env.GOOGLE_API_KEY.trim();
  }
  return undefined;
};

export const config = {
  server: {
    port: parseNumber(process.env.PORT, 4000),
    corsOrigin: parseList(process.env.CORS_ORIGIN, DEFAULT_CORS),
  },
  psi: {
    apiKey: resolvePsiApiKey(),
    timeoutMs: parseNumber(process.env.PSI_TIMEOUT_MS, 60_000),
    cacheTtlMs: parseNumber(process.env.PSI_CACHE_TTL_MS, 5 * 60 * 1000),
    locale: process.env.PSI_LOCALE?.trim() || "en_US",
    categories: parseList(process.env.PSI_CATEGORIES, DEFAULT_CATEGORIES),
    defaultStrategy: DEFAULT_STRATEGY,
    maxOpportunities: parseNumber(process.env.PSI_MAX_OPPORTUNITIES, 5),
  },
};

export const isProduction = process.env.NODE_ENV === "production";
