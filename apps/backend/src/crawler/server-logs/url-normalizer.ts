/**
 * URL Normalization, Resource Classification & Privacy Redaction Engine.
 * Preserves raw requested URLs, computes canonical analysis URLs, redacts sensitive query values,
 * and categorizes query parameters into functional taxonomy.
 */

import { ResourceType, QueryParameterCategory } from "./types";
import { SENSITIVE_PARAMETER_PATTERNS, PARAMETER_CLASSIFICATION_RULES } from "./config";

export function categorizeParameter(paramName: string): QueryParameterCategory {
  const cleanName = paramName.trim().toLowerCase();
  for (const rule of PARAMETER_CLASSIFICATION_RULES) {
    if (rule.pattern.test(cleanName)) {
      return rule.category;
    }
  }
  return "UNKNOWN";
}

export function redactSensitiveQueryParams(queryString: string): string {
  if (!queryString) return "";
  const params = new URLSearchParams(queryString);
  const outParams = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    const isSensitive = SENSITIVE_PARAMETER_PATTERNS.some((p) => key.toLowerCase().includes(p));
    if (isSensitive) {
      outParams.set(key, "[REDACTED]");
    } else {
      outParams.set(key, value);
    }
  }

  const res = decodeURIComponent(outParams.toString());
  return res ? `?${res}` : "";
}

export function detectResourceType(path: string): ResourceType {
  const cleanPath = path.split("?")[0].toLowerCase();

  if (/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif)$/i.test(cleanPath)) return "IMAGE";
  if (/\.(mp4|webm|ogv|mov|avi)$/i.test(cleanPath)) return "VIDEO";
  if (/\.pdf$/i.test(cleanPath)) return "PDF";
  if (/\.css$/i.test(cleanPath)) return "CSS";
  if (/\.(js|mjs|cjs|ts)$/i.test(cleanPath)) return "JAVASCRIPT";
  if (/\.(woff|woff2|ttf|eot|otf)$/i.test(cleanPath)) return "FONT";
  if (/\.(xml|rss|atom)$/i.test(cleanPath) || cleanPath.includes("sitemap")) return "XML";
  if (cleanPath.startsWith("/api/") || cleanPath.startsWith("/v1/") || cleanPath.endsWith(".json")) return "API";

  return "HTML_DOCUMENT";
}

export function normalizeLogUrl(host: string, rawPath: string, rawQuery?: string): {
  rawUrl: string;
  normalizedUrl: string;
  resourceType: ResourceType;
  queryParamCategories: Record<string, QueryParameterCategory>;
} {
  const cleanHost = host.toLowerCase().replace(/:\d+$/, "");
  const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const safeQuery = rawQuery ? (rawQuery.startsWith("?") ? rawQuery.slice(1) : rawQuery) : "";

  // 1. Build Raw URL with redacted sensitive parameters
  const redactedQuery = redactSensitiveQueryParams(safeQuery);
  const rawUrl = `https://${cleanHost}${cleanPath}${redactedQuery}`;

  // 2. Classify Parameters
  const paramCategories: Record<string, QueryParameterCategory> = {};
  const queryParams = new URLSearchParams(safeQuery);
  for (const [key] of queryParams.entries()) {
    paramCategories[key] = categorizeParameter(key);
  }

  // 3. Build Normalized Analysis URL (stripping non-functional tracking params, normalizing trailing slash)
  const normalizedParams = new URLSearchParams();
  for (const [key, value] of queryParams.entries()) {
    const cat = paramCategories[key];
    // Keep sorting, filtering, pagination, search, faceting, functional; drop tracking & session
    if (cat !== "TRACKING" && cat !== "SESSION") {
      normalizedParams.set(key.toLowerCase(), value);
    }
  }

  // Normalize path trailing slash (preserve on directories, omit on static files)
  let normPath = cleanPath.toLowerCase();
  const resourceType = detectResourceType(cleanPath);
  if (resourceType === "HTML_DOCUMENT" && !normPath.endsWith("/") && !normPath.includes(".")) {
    normPath += "/";
  }

  const normQueryStr = normalizedParams.toString();
  const normalizedUrl = `https://${cleanHost}${normPath}${normQueryStr ? `?${normQueryStr}` : ""}`;

  return {
    rawUrl,
    normalizedUrl,
    resourceType,
    queryParamCategories: paramCategories,
  };
}
