/**
 * Vercel Access & Edge Function Log Adapter.
 * Parses Vercel JSON structured logs.
 */

import { SeoServerLogEvent } from "../types";
import { classifyBotRequest } from "../bot-classifier";
import { normalizeLogUrl } from "../url-normalizer";

export function parseVercelLogEvent(
  raw: any,
  projectId: string,
  defaultHost: string
): SeoServerLogEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const host = raw.host || raw.domain || defaultHost;
  const pathPart = raw.path || raw.pathname || "/";
  const queryPart = raw.query || raw.search || undefined;

  const method = (raw.method || "GET").toUpperCase();
  const statusCode = raw.statusCode || raw.status || 200;
  const userAgent = raw.userAgent || raw.requestHeaders?.["user-agent"] || "";
  const ip = raw.clientIp || raw.ip || "";
  const responseTimeMs = raw.executionTimeMs || raw.durationMs || undefined;

  let timestamp: string;
  try {
    timestamp = raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString();
  } catch {
    timestamp = new Date().toISOString();
  }

  const norm = normalizeLogUrl(host, pathPart, queryPart);
  const botIdentity = classifyBotRequest(userAgent, ip);

  return {
    eventId: `vc_${Math.abs(pathPart.length + statusCode)}_${Date.now().toString(36)}`,
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
    responseTimeMs,
    sourceProvider: "VERCEL",
    resourceType: norm.resourceType,
    botIdentity,
  };
}
