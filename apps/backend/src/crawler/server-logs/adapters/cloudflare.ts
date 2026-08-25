/**
 * Cloudflare HTTP Log Adapter.
 * Parses Cloudflare Logpush JSON and structured log lines.
 */

import { SeoServerLogEvent } from "../types";
import { classifyBotRequest } from "../bot-classifier";
import { normalizeLogUrl } from "../url-normalizer";

export function parseCloudflareLogEvent(
  raw: any,
  projectId: string,
  defaultHost: string
): SeoServerLogEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const host = raw.ClientRequestHost || defaultHost;
  const rawPathWithQuery = raw.ClientRequestURI || raw.ClientRequestPath || "/";
  const [pathPart, queryPart] = rawPathWithQuery.split("?");

  const method = (raw.ClientRequestMethod || "GET").toUpperCase();
  const statusCode = raw.EdgeResponseStatus || raw.OriginResponseStatus || 200;
  const userAgent = raw.ClientRequestUserAgent || "";
  const ip = raw.ClientIP || "";
  const responseBytes = raw.EdgeResponseBytes || raw.OriginResponseBytes || 0;
  const responseTimeMs = raw.OriginResponseDurationMs || (raw.EdgeTimeToFirstByteMs ? Math.round(raw.EdgeTimeToFirstByteMs) : undefined);

  let timestamp: string;
  try {
    timestamp = raw.EdgeStartTimestamp ? new Date(raw.EdgeStartTimestamp).toISOString() : new Date().toISOString();
  } catch {
    timestamp = new Date().toISOString();
  }

  const norm = normalizeLogUrl(host, pathPart, queryPart);
  const botIdentity = classifyBotRequest(userAgent, ip);

  return {
    eventId: `cf_${Math.abs(pathPart.length + statusCode)}_${Date.now().toString(36)}`,
    timestamp,
    projectId,
    host,
    method,
    rawPath: pathPart,
    rawQuery: queryPart,
    rawUrl: norm.rawUrl,
    normalizedUrl: norm.normalizedUrl,
    statusCode,
    userAgent,
    ipAddress: ip,
    responseBytes,
    responseTimeMs,
    cacheStatus: raw.CacheCacheStatus || undefined,
    sourceProvider: "CLOUDFLARE",
    resourceType: norm.resourceType,
    botIdentity,
  };
}
